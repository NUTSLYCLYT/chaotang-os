# Project Boundaries

## Canonical Lines

| 层级 | 路径 | 事实源 |
| --- | --- | --- |
| Root coordination | `.harness/`、`AGENTS.md`、`scripts/harness-doctor.mjs` | 项目入口、边界与只读观察 |
| Frontend experience | `frontend/` | 页面、BFF、浏览器契约与前端验证 |
| Backend runtime | `backend/`、`backend/harness/` | API、运行、证据、评测与归档 |

`.agents/`、`.claude/` 与 `.codex/` 只配置 agent/tool 调用，不得拥有业务逻辑、运行状态、第二
Outcome ledger 或第四套 Harness 事实源。

## G1 Limits

- G1 只建立 `BOOTSTRAP_OBSERVE` 根观察核，不恢复旧 root v1/v2、R0、trust、runtime、rollout、
  release、lease、change history、模板或 generator。
- Root doctor 只能读取 closed schema/manifest、磁盘状态，并调用 ext authority 的 `--status`。
- `--check` 通过不等于 READY；`--status` 不等于治理 GO；`--ready` 必须固定 NOT_READY。
- Frontend 缺少 `frontend/.harness` 是 `ABSENT` 事实；backend 只有候选评测目录且无 manifest/doctor，
  是 `PARTIAL` 事实。不得把二者伪装 READY。
- 产品、CI、数据库、ADR 0028、外部平台配置和现有 ext authority 不属于 G1 修改范围。
