"""uvicorn 生产配置 — 用于替代 gunicorn.conf.py。

启动方式::

    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc \
        gunicorn web.main:app \
            -c gunicorn.conf.py \
            -k uvicorn.workers.UvicornWorker

或纯 uvicorn::

    uvicorn web.main:app --host 127.0.0.1 --port 8081 --workers 4

Prometheus multiprocess 注意事项与 gunicorn.conf.py 相同：
- PROMETHEUS_MULTIPROC_DIR 在容器重启时需清理
- 多 worker 模式下每个进程独立指标，需 multiprocess collector 聚合
"""
from __future__ import annotations

import multiprocessing
import os

# ── uvicorn CLI 风格配置（被 `uvicorn --config-file` 读取）─────────────

host = "127.0.0.1"
port = int(os.environ.get("FENGQUN_WEB_PORT", "8081"))
workers = int(os.environ.get("FENGQUN_WEB_WORKERS", str(multiprocessing.cpu_count() * 2 + 1)))
log_level = "info"
access_log = True
timeout_keep_alive = 5

# 优雅停机：允许进行中的请求最多再跑这么久
timeout_graceful_shutdown = 30
