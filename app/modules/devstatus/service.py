import json
import re
import subprocess
from pathlib import Path

from app.modules.devstatus.schemas import (
    ActivityLog,
    DevLogEntry,
    DevStatusOverview,
    GitStatus,
    HarnessStatus,
    HookInfo,
    SkillInfo,
    TaskCounts,
    TaskSummary,
)

_TITLE_RE = re.compile(r"^#\s*(TASK-\d+)\s*:\s*(.+)$")
_KV_RE = re.compile(r"^([a-z_]+)\s*:\s*(.*)$")


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _parse_task_file(path: Path) -> TaskSummary | None:
    """마크다운 태스크 파일의 제목·frontmatter 라인을 읽어 요약으로 변환. 형식이 다르면 None."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    stem_parts = path.stem.split("-", 2)
    task_id = "-".join(stem_parts[:2]) if len(stem_parts) >= 2 else path.stem
    title: str | None = None
    fields: dict[str, str] = {}
    for line in lines[:20]:
        title_match = _TITLE_RE.match(line)
        if title_match:
            task_id, title = title_match.group(1), title_match.group(2).strip()
            continue
        kv_match = _KV_RE.match(line)
        if kv_match:
            fields[kv_match.group(1)] = kv_match.group(2).strip()

    if title is None:
        title = path.stem

    return TaskSummary(
        id=task_id,
        title=title,
        status=fields.get("status", "unknown"),
        priority=fields.get("priority") or None,
        task_type=fields.get("task_type") or fields.get("type") or None,
        updated_at=fields.get("updated_at") or fields.get("created_at") or None,
    )


def list_active_tasks() -> list[TaskSummary]:
    active_dir = _repo_root() / "docs" / "tasks" / "active"
    if not active_dir.is_dir():
        return []
    tasks = [_parse_task_file(p) for p in sorted(active_dir.glob("TASK-*.md"))]
    return [t for t in tasks if t is not None]


def list_done_tasks() -> list[TaskSummary]:
    """docs/tasks/done/의 파일들은 status 필드가 implemented/done 등으로 일관되지 않으므로,
    폴더 위치(=사용자가 최종 승인해 옮긴 것) 자체를 상태의 근거로 삼아 강제로 done 처리한다."""
    done_dir = _repo_root() / "docs" / "tasks" / "done"
    if not done_dir.is_dir():
        return []
    tasks = [_parse_task_file(p) for p in sorted(done_dir.glob("TASK-*.md"))]
    return [t.model_copy(update={"status": "done"}) for t in tasks if t is not None]


def compute_task_counts(active_tasks: list[TaskSummary], done_count: int) -> TaskCounts:
    counts = TaskCounts()
    for task in active_tasks:
        if hasattr(counts, task.status):
            setattr(counts, task.status, getattr(counts, task.status) + 1)
    counts.done = done_count
    return counts


_SKILL_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)


def _parse_skill(path: Path) -> SkillInfo | None:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    match = _SKILL_FRONTMATTER_RE.match(text)
    if not match:
        return None
    name = description = ""
    for line in match.group(1).splitlines():
        kv = _KV_RE.match(line)
        if kv:
            key, value = kv.group(1), kv.group(2).strip()
            if key == "name":
                name = value
            elif key == "description":
                description = value
    if not name:
        return None
    return SkillInfo(name=name, description=description)


def get_harness_status() -> HarnessStatus:
    root = _repo_root()
    claude_dir = root / ".claude"

    permission_rule_count = 0
    hooks: list[HookInfo] = []
    settings_path = claude_dir / "settings.json"
    if settings_path.is_file():
        try:
            data = json.loads(settings_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = {}
        permission_rule_count = len(data.get("permissions", {}).get("allow", []))
        hook_events = data.get("hooks", {})
        by_command: dict[str, list[str]] = {}
        for event_name, entries in hook_events.items():
            for entry in entries:
                for h in entry.get("hooks", []):
                    cmd = h.get("command", "")
                    filename = cmd.rsplit("/", 1)[-1] if cmd else "?"
                    by_command.setdefault(filename, []).append(event_name)
        hooks = [HookInfo(file=f, events=events) for f, events in by_command.items()]

    skills: list[SkillInfo] = []
    skills_dir = claude_dir / "skills"
    if skills_dir.is_dir():
        for skill_md in sorted(skills_dir.glob("*/SKILL.md")):
            parsed = _parse_skill(skill_md)
            if parsed:
                skills.append(parsed)

    return HarnessStatus(
        permission_rule_count=permission_rule_count,
        hooks=hooks,
        skills=skills,
        claudeignore_present=(root / ".claudeignore").is_file(),
    )


def get_recent_dev_log(limit: int = 5) -> list[DevLogEntry]:
    dev_log_dir = _repo_root() / "docs" / "dev-log"
    if not dev_log_dir.is_dir():
        return []
    entries: list[DevLogEntry] = []
    for path in sorted(dev_log_dir.glob("*.md"), reverse=True)[:limit]:
        date = path.stem
        summary = ""
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except OSError:
            lines = []
        in_done_section = False
        for line in lines:
            if line.strip().startswith("## "):
                in_done_section = "한 일" in line
                continue
            if in_done_section and line.strip().startswith("-"):
                summary = line.strip().lstrip("- ").strip()
                break
        entries.append(DevLogEntry(date=date, summary=summary))
    return entries


def _run_git(args: list[str]) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=_repo_root(),
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


def get_git_status() -> GitStatus:
    branch = _run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    log_line = _run_git(["log", "-1", "--format=%h|%s|%ci"])
    commit_hash = commit_message = commit_date = None
    if log_line:
        parts = log_line.split("|", 2)
        if len(parts) == 3:
            commit_hash, commit_message, commit_date = parts
    return GitStatus(
        branch=branch,
        last_commit_hash=commit_hash,
        last_commit_message=commit_message,
        last_commit_date=commit_date,
    )


def get_overview() -> DevStatusOverview:
    active_tasks = list_active_tasks()
    done_tasks = list_done_tasks()
    not_done = [t for t in active_tasks if t.status != "done"]
    return DevStatusOverview(
        task_counts=compute_task_counts(active_tasks, len(done_tasks)),
        active_tasks=not_done,
        recent_done=list(reversed(done_tasks))[:10],
        harness=get_harness_status(),
        recent_dev_log=get_recent_dev_log(),
        git=get_git_status(),
    )


def get_activity_log() -> ActivityLog | None:
    """Claude Code가 작업 시작 전 체크포인트를 적어두고 진행하며 갱신하는 실시간 로그.
    파일이 없으면(=현재 진행 중인 작업이 없음) None을 반환한다."""
    path = _repo_root() / ".claude" / "state" / "activity-log.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return ActivityLog(**data)
