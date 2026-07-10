from pydantic import BaseModel


class TaskCounts(BaseModel):
    draft: int = 0
    approved: int = 0
    working: int = 0
    blocked: int = 0
    implemented: int = 0
    reviewed: int = 0
    done: int = 0


class TaskSummary(BaseModel):
    id: str
    title: str
    status: str
    priority: str | None = None
    task_type: str | None = None
    updated_at: str | None = None


class HookInfo(BaseModel):
    file: str
    events: list[str]


class SkillInfo(BaseModel):
    name: str
    description: str


class HarnessStatus(BaseModel):
    permission_rule_count: int
    hooks: list[HookInfo]
    skills: list[SkillInfo]
    claudeignore_present: bool


class DevLogEntry(BaseModel):
    date: str
    summary: str


class GitStatus(BaseModel):
    branch: str | None
    last_commit_hash: str | None
    last_commit_message: str | None
    last_commit_date: str | None


class DevStatusOverview(BaseModel):
    task_counts: TaskCounts
    active_tasks: list[TaskSummary]
    recent_done: list[TaskSummary]
    harness: HarnessStatus
    recent_dev_log: list[DevLogEntry]
    git: GitStatus


class ActivityStep(BaseModel):
    label: str
    status: str  # pending | in_progress | done


class ActivityLog(BaseModel):
    task: str | None = None
    started_at: str | None = None
    updated_at: str | None = None
    steps: list[ActivityStep] = []
