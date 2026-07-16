# 后端 Agent 工作入口

作用域：`backend/`。已确定最小技术栈：Python + FastAPI + uvicorn，扁平 `app/` 包，
pytest 测试，ruff 静态检查，pip + venv 管理依赖。选型理由、取舍和验证证据见
`docs/decisions/0006-frontend-backend-foundation-stack.md`（`## 后端` 章节）。

## 边界

- 这里只放后端运行/评测工程及其验证，不实现前端内部功能。
- 当前只暴露 `GET /health` 一个入口；不承载业务 API、鉴权、数据库模型、agent
  runtime 或任务编排——这些超出本次范围，新增前先确认是否有对应产品任务。
- 不引入 `app/` 之外的多包结构、alembic、cli.py、多环境 docker-compose 或 `src/`
  布局，除非有新的 ADR 明确变更。

## 环境要求

- Python `>=3.11`（`pyproject.toml` 中 `requires-python` 为准）。
- 包管理器为 pip + 标准库 `venv`；不依赖 uv（原因见 ADR 0006）。

## Setup

```bash
cd backend
python -m venv .venv

# Windows（直接调用 venv 内可执行文件，不依赖 activate 脚本）
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -e ".[dev]"

# Ubuntu / CI
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e ".[dev]"
```

## Lint

```bash
# Windows
.venv\Scripts\python.exe -m ruff check .

# Ubuntu / CI
.venv/bin/python -m ruff check .
```

## Test

```bash
# Windows
.venv\Scripts\python.exe -m pytest

# Ubuntu / CI
.venv/bin/python -m pytest
```

## Run

```bash
# Windows
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Ubuntu / CI
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

启动后可用 `curl http://127.0.0.1:8000/health`（或等效工具）确认返回
`200 OK`、`application/json`、`{"status": "ok", "service": "chaotang-os-backend",
"version": "<pyproject.toml 中的 version>"}`。本次范围不包含 eval 命令。

## 后续变更要求

再次改变语言、运行方式、包管理器或评测方式时，在同一变更中：

1. 用最小原型验证关键假设。
2. 在 `docs/decisions/` 记录选择和取舍。
3. 更新本文件，登记准确的 setup、lint、test、run/eval 命令，并接入 CI。
4. 让 agent 能直接读取测试、日志和必要的本地运行状态；工具优先提供非交互接口、
   可操作错误信息和安全的 dry-run。
