"""github_source.py의 순수 파싱 로직 검증. 실제 GitHub 네트워크 호출은 하지 않는다.

pytest 없이도 돌아가도록 plain assert + __main__ 실행 방식을 쓴다
(이 도구는 저장소 루트의 uv 가상환경과 별개로 관리되므로 `uv run pytest`에 걸리지 않음 —
pyproject.toml의 testpaths = ["tests"] 덕분에 자동 수집되지도 않는다).

실행: python3 test_github_source.py
"""
from github_source import (
    ActivityLog,
    ActivityStep,
    TaskSummary,
    build_overview,
    compute_task_counts,
    parse_dev_log_content,
    parse_skill_content,
    parse_task_content,
)


def test_parse_task_content_extracts_frontmatter():
    summary = parse_task_content(
        "TASK-032-ai-travel-planning-confirm-before-save.md",
        "# TASK-032: AI Travel Planning Confirm Before Save\n\nstatus: implemented\npriority: high\ntask_type: bugfix\nupdated_at: 2026-06-28\n",
    )
    assert summary.id == "TASK-032"
    assert summary.title == "AI Travel Planning Confirm Before Save"
    assert summary.status == "implemented"
    assert summary.priority == "high"
    assert summary.task_type == "bugfix"


def test_parse_task_content_type_field_alias():
    summary = parse_task_content("TASK-001-x.md", "# TASK-001: X\n\nstatus: done\ntype: feature\n")
    assert summary.task_type == "feature"


def test_parse_task_content_falls_back_to_filename():
    summary = parse_task_content("TASK-100-no-title.md", "status: draft\n")
    assert summary.id == "TASK-100"
    assert summary.title == "TASK-100-no-title"


def test_parse_skill_content():
    content = "---\nname: new-module\ndescription: Scaffold a new module.\n---\n\n# body\n"
    parsed = parse_skill_content(content)
    assert parsed == {"name": "new-module", "description": "Scaffold a new module."}


def test_parse_skill_content_no_frontmatter_returns_none():
    assert parse_skill_content("# just a heading\n") is None


def test_parse_dev_log_content_extracts_first_bullet():
    content = "# 2026-05-10\n\n## 한 일\n\n- 첫 번째 작업\n- 두 번째 작업\n"
    entry = parse_dev_log_content("2026-05-10.md", content)
    assert entry == {"date": "2026-05-10", "summary": "첫 번째 작업"}


def test_compute_task_counts():
    tasks = [
        TaskSummary(id="T1", title="a", status="draft"),
        TaskSummary(id="T2", title="b", status="approved"),
        TaskSummary(id="T3", title="c", status="approved"),
    ]
    counts = compute_task_counts(tasks, done_count=7)
    assert counts["draft"] == 1
    assert counts["approved"] == 2
    assert counts["done"] == 7
    assert counts["working"] == 0


class _FakeGitHubSource:
    """네트워크 호출 없이 build_overview()를 검증하기 위한 스텁."""

    def __init__(self):
        self.ref = "main"
        self._files = {
            "docs/tasks/active/TASK-001-a.md": "# TASK-001: A\n\nstatus: approved\n",
            "docs/tasks/done/TASK-000-b.md": "# TASK-000: B\n\nstatus: implemented\n",
            ".claude/settings.json": '{"permissions": {"allow": ["Bash(uv run pytest*)"]}, "hooks": {"SessionStart": [{"hooks": [{"command": "$X/session-start.sh"}]}]}}',
            ".claudeignore": ".env\n",
            "docs/dev-log/2026-05-10.md": "# 2026-05-10\n\n## 한 일\n\n- 작업함\n",
            ".claude/state/activity-log.json": '{"task": "테스트", "started_at": "t0", "updated_at": "t1", "steps": [{"label": "1단계", "status": "done"}]}',
            ".claude/skills/new-module/SKILL.md": "---\nname: new-module\ndescription: desc\n---\n",
        }
        self._dirs = {
            "docs/tasks/active": [{"name": "TASK-001-a.md", "type": "file"}],
            "docs/tasks/done": [{"name": "TASK-000-b.md", "type": "file"}],
            "docs/dev-log": [{"name": "2026-05-10.md", "type": "file"}],
            ".claude/skills": [{"name": "new-module", "type": "dir"}],
        }

    def fetch_file(self, path):
        return self._files.get(path)

    def fetch_dir(self, path):
        return sorted(e["name"] for e in self._dirs.get(path, []) if e["type"] == "file")

    def list_dir_entries(self, path):
        return self._dirs.get(path, [])

    def fetch_latest_commit(self):
        return {"hash": "abc1234", "message": "test commit", "date": "2026-07-10T00:00:00Z"}


def test_build_overview_end_to_end_with_fake_source():
    overview = build_overview(_FakeGitHubSource())
    assert overview.task_counts["approved"] == 1
    assert overview.task_counts["done"] == 1
    assert len(overview.active_tasks) == 1
    assert overview.active_tasks[0].id == "TASK-001"
    assert len(overview.recent_done) == 1
    assert overview.recent_done[0].status == "done"
    assert overview.permission_rule_count == 1
    assert overview.hooks == [{"file": "session-start.sh", "events": ["SessionStart"]}]
    assert overview.claudeignore_present is True
    assert overview.skills == [{"name": "new-module", "description": "desc"}]
    assert overview.recent_dev_log == [{"date": "2026-05-10", "summary": "작업함"}]
    assert overview.last_commit_hash == "abc1234"
    assert overview.activity == ActivityLog(
        task="테스트", started_at="t0", updated_at="t1",
        steps=[ActivityStep(label="1단계", status="done")],
    )


if __name__ == "__main__":
    import sys
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
