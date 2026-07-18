# CI 摘要：docs-absorption-ledger-20260718

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git branch -a`（PKT/翰林/普查/Alembic 分支核实） | 0 | task/p5-* p8-* p9-* resource-census-p0 等命中 | 台账 #8–#11 本机来源 | 隔离 worktree，2026-07-18 |
| `ls` + `git log -1`（家目录散档核实） | 0 | 钦天监台账文件、legal-agent/chaotang-landing/battery-rd-os git 仓、CourtOS-Brain 均存在 | 台账 #3 #17–#20 本机来源 | 本机，2026-07-18 |
| `node scripts/harness-doctor.mjs` | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` | 根/前端/后端三层结构 | 隔离 worktree，2026-07-18 |

## 结果

docs-only 候选成文。本机来源全部实证；Gitee jiqun-port 与 openclaw 侧
本机不可达，台账统一标 UNVERIFIED-REMOTE 并设「合入前 checkout 核 SHA」门禁。

## 未验证项

- 远端 10 分支与 openclaw 22 项的实际内容（登记不阻塞；对应 packet 开工时首步核实）。
- 未运行前端/后端测试：本包零代码变更，无测试面。

## Diff 与回滚复核

- changed files：本 change 目录内 7 个文件（四件套 + 台账 + 两份 ③ 档吸收文档）。
- diff review：无 rules、前端、后端、lockfile 变化。
- 回滚是否演练：未执行；删目录即回滚，无运行态。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 22 项全登记六档裁决 | `absorption-ledger.md` | PASS |
| 本机来源逐项实证 | 上表核实命令 | PASS |
| ③ 档原档直读吸收 | 两份协议/模板文档 | PASS |
| 三层结构完整 | doctor 0 errors | PASS |
| 业主 diff 审批 | staged 待批 | PENDING |

## 声明状态

- `DRAFT`：候选 staged，等业主审批后 commit；不推送。
