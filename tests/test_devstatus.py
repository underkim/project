import pytest

from app.modules.devstatus.schemas import TaskSummary
from app.modules.devstatus.service import (
    _parse_task_file,
    compute_task_counts,
    get_activity_log,
    get_harness_status,
    list_done_tasks,
)


def _write_task(tmp_path, filename: str, content: str):
    path = tmp_path / filename
    path.write_text(content, encoding="utf-8")
    return path


def test_parse_task_file_extracts_frontmatter(tmp_path):
    path = _write_task(
        tmp_path,
        "TASK-099-example-task.md",
        "# TASK-099: Example Task\n\nstatus: approved\npriority: high\ntask_type: feature\nupdated_at: 2026-07-01\n",
    )
    summary = _parse_task_file(path)
    assert summary.id == "TASK-099"
    assert summary.title == "Example Task"
    assert summary.status == "approved"
    assert summary.priority == "high"
    assert summary.task_type == "feature"
    assert summary.updated_at == "2026-07-01"


def test_parse_task_file_falls_back_to_filename_stem_when_no_title(tmp_path):
    path = _write_task(tmp_path, "TASK-100-no-title.md", "status: draft\n")
    summary = _parse_task_file(path)
    assert summary.id == "TASK-100"
    assert summary.title == "TASK-100-no-title"
    assert summary.status == "draft"


def test_parse_task_file_falls_back_to_type_field_alias(tmp_path):
    """done/ 태스크 파일은 task_type 대신 type 필드를 쓰는 경우가 있다."""
    path = _write_task(
        tmp_path,
        "TASK-101-legacy.md",
        "# TASK-101: Legacy Task\n\nstatus: done\ntype: bugfix\n",
    )
    summary = _parse_task_file(path)
    assert summary.task_type == "bugfix"


def test_compute_task_counts_groups_by_status():
    tasks = [
        TaskSummary(id="TASK-001", title="a", status="draft"),
        TaskSummary(id="TASK-002", title="b", status="approved"),
        TaskSummary(id="TASK-003", title="c", status="approved"),
        TaskSummary(id="TASK-004", title="d", status="working"),
    ]
    counts = compute_task_counts(tasks, done_count=5)
    assert counts.draft == 1
    assert counts.approved == 2
    assert counts.working == 1
    assert counts.done == 5
    assert counts.blocked == 0


def test_list_done_tasks_normalizes_status_to_done():
    """docs/tasks/done/의 파일들은 내부 status 필드가 implemented/done 등으로 제각각이므로,
    폴더 위치를 근거로 항상 done으로 정규화되어야 한다."""
    done_tasks = list_done_tasks()
    assert len(done_tasks) > 0
    assert all(t.status == "done" for t in done_tasks)


def test_get_harness_status_reflects_actual_claude_dir():
    """이 저장소에 실제로 구성된 .claude/ 하네스를 정확히 읽는지 확인."""
    status = get_harness_status()
    assert status.claudeignore_present is True
    skill_names = {s.name for s in status.skills}
    assert "new-module" in skill_names
    hook_files = {h.file for h in status.hooks}
    assert "session-start.sh" in hook_files
    assert "pre-commit-check.sh" in hook_files


def test_get_activity_log_reads_real_state_file():
    """이 저장소는 실제로 .claude/state/activity-log.json을 유지하고 있어야 한다."""
    log = get_activity_log()
    assert log is not None
    assert isinstance(log.task, str)
    assert len(log.steps) > 0
    assert all(s.status in ("pending", "in_progress", "done") for s in log.steps)


def test_get_activity_log_returns_none_when_missing(monkeypatch, tmp_path):
    import app.modules.devstatus.service as devstatus_service
    monkeypatch.setattr(devstatus_service, "_repo_root", lambda: tmp_path)
    assert devstatus_service.get_activity_log() is None


def test_devstatus_route_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/devstatus/overview" in routes
    assert "/api/v1/devstatus/activity" in routes


@pytest.mark.asyncio
async def test_devstatus_overview_requires_auth(client):
    resp = await client.get("/api/v1/devstatus/overview")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_devstatus_overview_returns_expected_shape(auth_client):
    resp = await auth_client.get("/api/v1/devstatus/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "task_counts" in data
    assert "active_tasks" in data
    assert "harness" in data
    assert "recent_dev_log" in data
    assert "git" in data
    assert data["harness"]["claudeignore_present"] is True


@pytest.mark.asyncio
async def test_devstatus_activity_returns_current_log(auth_client):
    resp = await auth_client.get("/api/v1/devstatus/activity")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["steps"], list)
    assert len(data["steps"]) > 0
