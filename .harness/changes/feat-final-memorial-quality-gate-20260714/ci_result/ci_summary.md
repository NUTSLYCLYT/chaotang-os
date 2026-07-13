# CI 摘要：feat-final-memorial-quality-gate-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest -q tests/test_final_memorial_gate.py`（初始） | 1 | RED：5 failed，缺 FinalMemorial/服务 | 正式事实源 | 本地终端，2026-07-14 |
| 同专项测试（分阶段） | 1 | RED：依次抓到裁决绕过、worker 未接入、旧库缺表、人工确认缺失、裁决事件缺失、读模型缺字段 | 每个新增状态转换与质量门 | 本地终端，2026-07-14 |
| `pytest -q tests/test_final_memorial_gate.py`（最终） | 0 | 8 passed | 唯一性、质量/来源门、自愈、worker、裁决、读模型 | 本地终端，2026-07-14 |
| 主链相关 6 文件，排除不稳定实时聊天字面量用例 | 0 | 43 passed, 1 deselected | 事件、outbox、状态、裁决、史馆 | 本地终端，2026-07-14 |
| 后端完整 `pytest -q` | 1 | 2461 passed, 27 skipped, 14 failed | 全量回归观察 | 本地终端，2026-07-14 |
| `python3 -m compileall -q src web tests` | 0 | PASS | Python 编译 | 本地终端，2026-07-14 |
| `ruff check`（本次文件；尚书房忽略两个既有文件级规则） | 0 | PASS | Python 静态检查 | 本地终端，2026-07-14 |
| `pnpm exec tsc --noEmit` | 0 | PASS | 前端正式奏折契约 | 本地终端，2026-07-14 |
| 前端 contract baseline node test | 0 | 2 passed | API 路径与正式来源词表 | 本地终端，2026-07-14 |
| 前端、后端与根 Harness Doctor | 0 | 0 errors, 0 warnings | 三层 harness | 本地终端，2026-07-14 |
| `git diff --check` 与敏感字面量扫描 | 0 | PASS | diff/security review | 本地终端，2026-07-14 |

## 结果

第二纵切面为 GREEN，且已融入 `feature-chaotang-ext` 工作树。正式奏折成为唯一可裁决快照；后端 status/home 与前端类型共同消费该事实源。全量套件的 14 个失败与上一纵切面观察到的集合一致，涉及 sqlite_vec、缺 taxonomy、律师 RAG、persona、实时模型输出及旧 FakeApiOrchestrator，不在本次正式奏折路径。

## 未验证项

- 当前 Python 环境没有可执行 Alembic CLI，`python3 -m alembic heads` 失败；010 文件已编译，旧库缺表由隔离 SQLite self-heal 测试覆盖，但不能替代真实升级演练。
- 未执行前端 build、Playwright、真实后端浏览器闭环、生产部署、备份/回滚或 24h/72h 观察。
- 30 条黄金旨意发布门、tenant/RBAC、常驻 worker、节点 DAG 和结果反馈仍按总控蓝图推进。
- 当前工作树含其他用户/并行成果，未创建提交、未推送，避免把不相关改动混入提交。

## Diff 与回滚复核

- changed files：正式奏折模型/迁移/服务、worker、裁决与读模型、前端类型、主链测试、产品/架构/验证文档及变更档案。
- diff review：Ruff、TypeScript、contract baseline、diff check、敏感字面量扫描通过；未覆盖其他用户改动。
- 回滚是否演练：未做破坏性数据库降级。代码可退回旧读模型/门禁；新增表可保留，已写事件与审计记录不应删除。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 一旨一条正式奏折、幂等重放 | 专项服务与数据库唯一约束测试 | PASS |
| quality/source/empty candidate fail closed | 参数化与 worker 集成测试 | PASS |
| 候选奏折不得绕过正式门进入史馆 | API 正反测试 | PASS |
| 人工确认与裁决事件 | API 正反测试、事件载荷断言 | PASS |
| 后端/前端消费同一正式事实源 | status/home 测试、TS 与 contract baseline | PASS |
| 完整发布验证 | 全量 14 failures；迁移/浏览器/部署/黄金旨意未完成 | PARTIAL |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`
