"""gunicorn 生产配置 — FastAPI (UvicornWorker) 默认模式。

Prometheus multiprocess 模式配置说明：
- 必须在每个 worker 启动后重置 registry，否则父进程指标会被继承，导致重复计数
- PROMETHEUS_MULTIPROC_DIR 目录在容器重启时需清理，避免旧 worker pid 文件累积

启动方式::

    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc \\
        gunicorn -c gunicorn.conf.py web.main:app

或纯 uvicorn（开发推荐）::

    uvicorn web.main:app --host 127.0.0.1 --port 8081 --reload
"""

import multiprocessing
import os

# ── 服务器绑定 ──
bind = "127.0.0.1:8081"
workers = multiprocessing.cpu_count() * 2 + 1

# 默认 UvicornWorker（支持 async + sync handler + WebSocket + SSE）。
# 兜底机制：可通过 FENGQUN_WORKER_CLASS=sync 退回（仅在极少数老调试场景下使用）。
worker_class = os.environ.get(
    "FENGQUN_WORKER_CLASS",
    "uvicorn.workers.UvicornWorker",
)
timeout = 120
keepalive = 5

# ── 日志 ──
loglevel = "info"
accesslog = "-"
errorlog = "-"

# ── Prometheus multiprocess 支持 ──
_PROM_DIR = os.environ.get("PROMETHEUS_MULTIPROC_DIR", "/tmp/prometheus_multiproc")


def on_starting(server):
    """主进程启动时清理旧的 multiprocess 状态文件。"""
    import shutil
    if os.path.exists(_PROM_DIR):
        shutil.rmtree(_PROM_DIR)
    os.makedirs(_PROM_DIR, exist_ok=True)


def post_fork(server, worker):
    """每个 worker 进程启动后重置 registry，防止父进程指标污染子进程。"""
    try:
        from prometheus_client import multiprocess as prom_mp
        prom_mp.mark_process_dead(os.getpid())
    except ImportError:
        pass


def child_exit(server, worker):
    """worker 退出时清理该 worker 的 multiprocess 状态文件。"""
    try:
        from prometheus_client import multiprocess as prom_mp
        prom_mp.mark_process_dead(worker.pid)
    except ImportError:
        pass
