"""GitHub 저장소를 직접 폴링해 Life Dashboard의 개발 현황(devstatus)을 계산한다.

배포된 백엔드(Render)를 거치지 않고 GitHub REST API에서 파일을 직접 읽으므로,
커밋 후 재배포를 기다릴 필요 없이 push 직후 곧바로 반영된다.

app/modules/devstatus/service.py 와 동일한 파싱 규칙을 그대로 포팅했다 —
백엔드 쪽 파일 형식이 바뀌면 이 파일도 함께 업데이트해야 한다.
"""
from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass, field

import requests

_TITLE_RE = re.compile(r"^#\s*(TASK-\d+)\s*:\s*(.+)$")
_KV_RE = re.compile(r"^([a-z_]+)\s*:\s*(.*)$")
_SKILL_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)

API_ROOT = "https://api.github.com"


class GitHubApiError(Exception):
    pass


@dataclass
class TaskSummary:
    id: str
    title: str
    status: str
    priority: str | None = None
    task_type: str | None = None
    updated_at: str | None = None


@dataclass
class ActivityStep:
    label: str
    status: str


@dataclass
class ActivityLog:
    task: str | None = None
    started_at: str | None = None
    updated_at: str | None = None
    steps: list[ActivityStep] = field(default_factory=list)


@dataclass
class Overview:
    task_counts: dict[str, int]
    active_tasks: list[TaskSummary]
    recent_done: list[TaskSummary]
    permission_rule_count: int
    hooks: list[dict]
    skills: list[dict]
    claudeignore_present: bool
    recent_dev_log: list[dict]
    branch: str
    last_commit_hash: str | None
    last_commit_message: str | None
    last_commit_date: str | None
    activity: ActivityLog | None


class GitHubSource:
    def __init__(self, owner: str, repo: str, token: str, ref: str = "main", timeout: int = 10):
        self.owner = owner
        self.repo = repo
        self.token = token
        self.ref = ref
        self.timeout = timeout
        self.session = requests.Session()
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self.session.headers.update(headers)

    def _get(self, path: str, params: dict | None = None):
        url = f"{API_ROOT}/repos/{self.owner}/{self.repo}/{path}"
        resp = self.session.get(url, params=params, timeout=self.timeout)
        if resp.status_code == 404:
            return None
        if not resp.ok:
            raise GitHubApiError(f"GitHub API {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    def fetch_file(self, path: str) -> str | None:
        data = self._get(f"contents/{path}", params={"ref": self.ref})
        if data is None or not isinstance(data, dict) or "content" not in data:
            return None
        return base64.b64decode(data["content"]).decode("utf-8", errors="replace")

    def list_dir_entries(self, path: str) -> list[dict]:
        """디렉터리 내 항목을 {name, type} 형태로 반환 (type: file|dir)."""
        data = self._get(f"contents/{path}", params={"ref": self.ref})
        if not data or not isinstance(data, list):
            return []
        return [{"name": item["name"], "type": item.get("type")} for item in data]

    def fetch_dir(self, path: str) -> list[str]:
        return sorted(e["name"] for e in self.list_dir_entries(path) if e["type"] == "file")

    def fetch_latest_commit(self) -> dict | None:
        data = self._get("commits", params={"sha": self.ref, "per_page": 1})
        if not data:
            return None
        commit = data[0]
        return {
            "hash": commit["sha"][:7],
            "message": commit["commit"]["message"].splitlines()[0],
            "date": commit["commit"]["committer"]["date"],
        }


# ---- 파싱 (app/modules/devstatus/service.py와 동일 규칙) ----

def parse_task_content(filename: str, content: str) -> TaskSummary:
    stem = filename[:-3] if filename.endswith(".md") else filename
    stem_parts = stem.split("-", 2)
    task_id = "-".join(stem_parts[:2]) if len(stem_parts) >= 2 else stem
    title: str | None = None
    fields: dict[str, str] = {}
    for line in content.splitlines()[:20]:
        title_match = _TITLE_RE.match(line)
        if title_match:
            task_id, title = title_match.group(1), title_match.group(2).strip()
            continue
        kv_match = _KV_RE.match(line)
        if kv_match:
            fields[kv_match.group(1)] = kv_match.group(2).strip()
    if title is None:
        title = stem
    return TaskSummary(
        id=task_id,
        title=title,
        status=fields.get("status", "unknown"),
        priority=fields.get("priority") or None,
        task_type=fields.get("task_type") or fields.get("type") or None,
        updated_at=fields.get("updated_at") or fields.get("created_at") or None,
    )


def parse_skill_content(content: str) -> dict | None:
    match = _SKILL_FRONTMATTER_RE.match(content)
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
    return {"name": name, "description": description}


def parse_dev_log_content(filename: str, content: str) -> dict:
    date = filename[:-3] if filename.endswith(".md") else filename
    summary = ""
    in_done_section = False
    for line in content.splitlines():
        if line.strip().startswith("## "):
            in_done_section = "한 일" in line
            continue
        if in_done_section and line.strip().startswith("-"):
            summary = line.strip().lstrip("- ").strip()
            break
    return {"date": date, "summary": summary}


def compute_task_counts(active_tasks: list[TaskSummary], done_count: int) -> dict[str, int]:
    counts = {"draft": 0, "approved": 0, "working": 0, "blocked": 0, "implemented": 0, "reviewed": 0, "done": 0}
    for task in active_tasks:
        if task.status in counts:
            counts[task.status] += 1
    counts["done"] = done_count
    return counts


def build_overview(src: GitHubSource) -> Overview:
    active_files = src.fetch_dir("docs/tasks/active")
    active_tasks = []
    for name in active_files:
        content = src.fetch_file(f"docs/tasks/active/{name}")
        if content is not None:
            active_tasks.append(parse_task_content(name, content))

    done_files = src.fetch_dir("docs/tasks/done")
    done_tasks = []
    for name in done_files:
        content = src.fetch_file(f"docs/tasks/done/{name}")
        if content is not None:
            task = parse_task_content(name, content)
            task.status = "done"
            done_tasks.append(task)

    not_done = [t for t in active_tasks if t.status != "done"]

    settings_content = src.fetch_file(".claude/settings.json")
    permission_rule_count = 0
    hooks: list[dict] = []
    if settings_content:
        try:
            settings_data = json.loads(settings_content)
        except ValueError:
            settings_data = {}
        permission_rule_count = len(settings_data.get("permissions", {}).get("allow", []))
        by_file: dict[str, list[str]] = {}
        for event_name, entries in settings_data.get("hooks", {}).items():
            for entry in entries:
                for h in entry.get("hooks", []):
                    cmd = h.get("command", "")
                    fname = cmd.rsplit("/", 1)[-1] if cmd else "?"
                    by_file.setdefault(fname, []).append(event_name)
        hooks = [{"file": f, "events": events} for f, events in by_file.items()]

    # fetch_dir only lists files, not subdirectories; skills live one level deeper
    # (skills/<name>/SKILL.md), so list .claude/skills/ directly to find subdirectories.
    skills: list[dict] = []
    for item in src.list_dir_entries(".claude/skills"):
        if item["type"] == "dir":
            skill_md = src.fetch_file(f".claude/skills/{item['name']}/SKILL.md")
            if skill_md:
                parsed = parse_skill_content(skill_md)
                if parsed:
                    skills.append(parsed)

    claudeignore = src.fetch_file(".claudeignore")

    dev_log_files = src.fetch_dir("docs/dev-log")
    recent_dev_log = []
    for name in sorted(dev_log_files, reverse=True)[:5]:
        content = src.fetch_file(f"docs/dev-log/{name}")
        if content is not None:
            recent_dev_log.append(parse_dev_log_content(name, content))

    commit = src.fetch_latest_commit() or {}

    activity_content = src.fetch_file(".claude/state/activity-log.json")
    activity = None
    if activity_content:
        try:
            data = json.loads(activity_content)
            activity = ActivityLog(
                task=data.get("task"),
                started_at=data.get("started_at"),
                updated_at=data.get("updated_at"),
                steps=[ActivityStep(**s) for s in data.get("steps", [])],
            )
        except (ValueError, TypeError):
            activity = None

    return Overview(
        task_counts=compute_task_counts(active_tasks, len(done_tasks)),
        active_tasks=not_done,
        recent_done=list(reversed(done_tasks))[:10],
        permission_rule_count=permission_rule_count,
        hooks=hooks,
        skills=skills,
        claudeignore_present=claudeignore is not None,
        recent_dev_log=recent_dev_log,
        branch=src.ref,
        last_commit_hash=commit.get("hash"),
        last_commit_message=commit.get("message"),
        last_commit_date=commit.get("date"),
        activity=activity,
    )
