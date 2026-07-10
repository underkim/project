"""Life Dashboard 개발 현황 — Windows(및 다른 OS) 데스크톱 모니터.

GitHub 저장소를 직접 폴링해 배포(Render/Vercel) 재배포를 기다리지 않고
개발 현황(태스크 상태, 하네스 설정, 실시간 작업 로그)을 보여준다.

실행: python devstatus_desktop.py
최초 실행 시 저장소 정보(owner/repo)와 GitHub Personal Access Token을 입력받아
로컬 설정 파일(~/.lifedashboard-status/config.json)에 저장한다.
"""
from __future__ import annotations

import json
import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import simpledialog, ttk

from github_source import GitHubApiError, GitHubSource, Overview, build_overview

CONFIG_PATH = Path.home() / ".lifedashboard-status" / "config.json"
DEFAULT_POLL_SECONDS = 8

STATUS_ORDER = ["draft", "approved", "working", "blocked", "implemented", "reviewed", "done"]
STATUS_LABEL = {
    "draft": "초안", "approved": "승인됨", "working": "진행 중", "blocked": "막힘",
    "implemented": "구현됨", "reviewed": "검토됨", "done": "완료",
}
STEP_ICON = {"done": "✅", "in_progress": "🔵", "pending": "⚪"}


def load_config() -> dict | None:
    if not CONFIG_PATH.is_file():
        return None
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")


def prompt_for_config(root: tk.Tk) -> dict | None:
    owner = simpledialog.askstring("설정", "GitHub 저장소 소유자(owner):", parent=root)
    if not owner:
        return None
    repo = simpledialog.askstring("설정", "GitHub 저장소 이름(repo):", parent=root)
    if not repo:
        return None
    token = simpledialog.askstring(
        "설정", "GitHub Personal Access Token (repo 읽기 권한):", parent=root, show="*"
    )
    if not token:
        return None
    return {"owner": owner, "repo": repo, "token": token, "ref": "main", "poll_seconds": DEFAULT_POLL_SECONDS}


class DevStatusApp:
    def __init__(self, root: tk.Tk, config: dict):
        self.root = root
        self.config = config
        self.source = GitHubSource(config["owner"], config["repo"], config["token"], config.get("ref", "main"))
        self.poll_ms = int(config.get("poll_seconds", DEFAULT_POLL_SECONDS)) * 1000

        root.title(f"Life Dashboard 개발 현황 — {config['owner']}/{config['repo']}")
        root.geometry("620x760")
        root.configure(bg="#f8fafc")

        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Card.TFrame", background="#ffffff", relief="flat")
        style.configure("Header.TLabel", background="#f8fafc", font=("Segoe UI", 13, "bold"))
        style.configure("Sub.TLabel", background="#f8fafc", foreground="#64748b", font=("Segoe UI", 9))
        style.configure("CardTitle.TLabel", background="#ffffff", foreground="#64748b", font=("Segoe UI", 9, "bold"))
        style.configure("Body.TLabel", background="#ffffff", font=("Segoe UI", 10))

        self._result_queue: queue.Queue = queue.Queue()

        self._build_layout()
        self._poll_queue()
        self.refresh(initial=True)

    def _build_layout(self):
        outer = tk.Frame(self.root, bg="#f8fafc")
        outer.pack(fill="both", expand=True, padx=14, pady=14)

        header = tk.Frame(outer, bg="#f8fafc")
        header.pack(fill="x", pady=(0, 10))
        ttk.Label(header, text="개발 현황", style="Header.TLabel").pack(side="left")
        self.status_label = ttk.Label(header, text="불러오는 중...", style="Sub.TLabel")
        self.status_label.pack(side="right")

        self.activity_frame = tk.Frame(outer, bg="#eff6ff", bd=1, relief="solid", highlightbackground="#bfdbfe")
        self.activity_frame.pack(fill="x", pady=(0, 10))
        self.activity_title = tk.Label(self.activity_frame, text="", bg="#eff6ff", font=("Segoe UI", 10, "bold"), anchor="w")
        self.activity_title.pack(fill="x", padx=10, pady=(8, 2))
        self.activity_steps_frame = tk.Frame(self.activity_frame, bg="#eff6ff")
        self.activity_steps_frame.pack(fill="x", padx=10, pady=(0, 8))

        counts_card = tk.Frame(outer, bg="#ffffff", bd=1, relief="solid", highlightbackground="#e2e8f0")
        counts_card.pack(fill="x", pady=(0, 10))
        ttk.Label(counts_card, text="태스크 현황", style="CardTitle.TLabel").pack(anchor="w", padx=10, pady=(8, 4))
        self.counts_frame = tk.Frame(counts_card, bg="#ffffff")
        self.counts_frame.pack(fill="x", padx=10, pady=(0, 10))

        tasks_card = tk.Frame(outer, bg="#ffffff", bd=1, relief="solid", highlightbackground="#e2e8f0")
        tasks_card.pack(fill="both", expand=True, pady=(0, 10))
        ttk.Label(tasks_card, text="활성 태스크", style="CardTitle.TLabel").pack(anchor="w", padx=10, pady=(8, 4))
        columns = ("id", "title", "status")
        self.tasks_tree = ttk.Treeview(tasks_card, columns=columns, show="headings", height=8)
        for col, width in (("id", 80), ("title", 300), ("status", 80)):
            self.tasks_tree.heading(col, text=col)
            self.tasks_tree.column(col, width=width, anchor="w")
        self.tasks_tree.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        footer = tk.Frame(outer, bg="#f8fafc")
        footer.pack(fill="x")
        self.footer_label = ttk.Label(footer, text="", style="Sub.TLabel")
        self.footer_label.pack(anchor="w")

    def refresh(self, initial: bool = False):
        self.status_label.config(text="새로고침 중...")
        threading.Thread(target=self._fetch_and_render, daemon=True).start()
        self.root.after(self.poll_ms, self.refresh)

    def _fetch_and_render(self):
        # 백그라운드 스레드에서는 절대 root.after()/위젯을 직접 건드리지 않는다 —
        # mainloop 시작 전에 다른 스레드가 after()를 호출하면
        # "RuntimeError: main thread is not in main loop"가 날 수 있다.
        # 결과는 큐에 넣고, 메인 스레드가 주기적으로 꺼내가도록 한다.
        try:
            overview = build_overview(self.source)
            self._result_queue.put((overview, None))
        except (GitHubApiError, OSError) as exc:
            self._result_queue.put((None, str(exc)))

    def _poll_queue(self):
        try:
            while True:
                overview, error = self._result_queue.get_nowait()
                self._render(overview, error)
        except queue.Empty:
            pass
        self.root.after(150, self._poll_queue)

    def _render(self, overview: Overview | None, error: str | None):
        if error:
            self.status_label.config(text=f"오류: {error[:60]}")
            return
        assert overview is not None
        self.status_label.config(text="정상 · 자동 새로고침 중")

        for w in self.activity_steps_frame.winfo_children():
            w.destroy()
        if overview.activity and overview.activity.steps:
            self.activity_title.config(text=f"🔴 지금 작업 중 — {overview.activity.task or ''}")
            for step in overview.activity.steps:
                row = tk.Frame(self.activity_steps_frame, bg="#eff6ff")
                row.pack(fill="x", anchor="w")
                icon = STEP_ICON.get(step.status, "⚪")
                tk.Label(row, text=f"{icon} {step.label}", bg="#eff6ff", font=("Segoe UI", 9), anchor="w").pack(side="left")
        else:
            self.activity_title.config(text="지금 진행 중인 작업이 없습니다")

        for w in self.counts_frame.winfo_children():
            w.destroy()
        for i, key in enumerate(STATUS_ORDER):
            cell = tk.Frame(self.counts_frame, bg="#f8fafc")
            cell.grid(row=0, column=i, padx=4, sticky="ew")
            self.counts_frame.grid_columnconfigure(i, weight=1)
            tk.Label(cell, text=str(overview.task_counts.get(key, 0)), bg="#f8fafc", font=("Segoe UI", 13, "bold")).pack()
            tk.Label(cell, text=STATUS_LABEL[key], bg="#f8fafc", font=("Segoe UI", 8), fg="#94a3b8").pack()

        self.tasks_tree.delete(*self.tasks_tree.get_children())
        for task in overview.active_tasks:
            self.tasks_tree.insert("", "end", values=(task.id, task.title, STATUS_LABEL.get(task.status, task.status)))

        branch_line = f"브랜치 {overview.branch}"
        if overview.last_commit_hash:
            branch_line += f" · {overview.last_commit_hash} {overview.last_commit_message}"
        harness_line = (
            f"권한 {overview.permission_rule_count}개 · hooks {len(overview.hooks)}개 · "
            f"skills {len(overview.skills)}개 · .claudeignore {'✓' if overview.claudeignore_present else '✗'}"
        )
        self.footer_label.config(text=f"{branch_line}\n{harness_line}")


def main():
    root = tk.Tk()
    root.withdraw()

    config = load_config()
    if not config:
        config = prompt_for_config(root)
        if not config:
            root.destroy()
            return
        save_config(config)

    root.deiconify()
    DevStatusApp(root, config)
    root.mainloop()


if __name__ == "__main__":
    main()
