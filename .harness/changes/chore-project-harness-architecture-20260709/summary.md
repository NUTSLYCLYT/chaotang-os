# 变更摘要：chore-project-harness-architecture-20260709

| Field | Value |
| --- | --- |
| Change ID | chore-project-harness-architecture-20260709 |
| Type | chore |
| Status | DELIVERED |
| Owner | Project Agent |
| Created | 20260709 |

## 范围

- 主线：根项目、前端、后端、文档。
- 文件：根级 `.harness/`、根 `AGENTS.md`、根 `README.md`、根 `scripts/harness-doctor.mjs`。
- 验证：`node scripts/harness-doctor.mjs`；`cd backend && python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py`。
