# Task Workflow Guide

## Status Definitions

| Status | Who sets it | Meaning |
|--------|-------------|---------|
| `draft` | Claude Code / user | Being drafted, not ready for implementation |
| `approved` | User | Ready for Claude Code to implement |
| `working` | Claude Code | Currently being implemented |
| `blocked` | Claude Code | Cannot proceed, waiting on external input |
| `implemented` | Claude Code | Implementation committed; awaiting user review |
| `reviewed` | User | User has reviewed; awaiting final close |
| `done` | User | Closed and accepted |

## Unfinished Work Count Rule

**Unfinished = `draft` + `approved` + `working`**

Active task files may exceed 10. This is allowed. Claude Code should limit each implementation batch to at most 10 eligible tasks, rather than stopping task creation at 10 active files.

Do NOT count by:
- Number of files in `docs/tasks/active/`
- Number of entries in `memory/MEMORY.md`
- Number of entries in `memory/project-state.md`

Many files in `docs/tasks/active/` have `status: implemented` and are waiting for user review before being moved to `docs/tasks/done/`. These are NOT available for new implementation.

Run `docs/tasks/count-tasks.ps1` to get a reliable status breakdown, or open the `/devstatus`
page in the app (backed by `app/modules/devstatus/`) for a live, cross-platform view of the same
counts plus the current harness (hooks/skills/permissions) state.

## Agent Rules

1. **Before starting work**, check available tasks by status:
   ```powershell
   powershell -File docs/tasks/count-tasks.ps1
   ```

2. **Do not move `implemented` → `done`** without explicit user instruction in the same session.

3. **Do not create new tasks** based on memory.md content alone. Check actual file status first. Do not block new task creation solely because there are 10 or more files in `docs/tasks/active/`.

4. **When implementing**: select at most 10 eligible tasks for the current batch, update each active file to `status: working`, then to `status: implemented` when committed. Copy to `docs/tasks/done/` with `status: implemented`.

5. **Do not re-implement** tasks that are already `implemented`, `reviewed`, or `done`.

## Folder Convention

```
docs/tasks/
├── active/          # All tasks still needing attention (any status)
│   ├── TASK-NNN-*.md    status: draft/approved/working/blocked/implemented
│   └── ...
├── done/            # Tasks fully closed by the user (status: done or reviewed)
│   └── TASK-NNN-*.md    status: implemented (user-closed copy)
├── count-tasks.ps1  # Status count script
└── task-workflow.md # This file
```

`implemented` tasks remain in `active/` until the **user** moves them. Claude Code must not perform this move autonomously.
