# CI 摘要：fix-pr3-required-doc-consistency-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git diff --check` | 0 | PASS | 空白错误、冲突标记与 patch 结构 | 本地候选，2026-07-19 |
| Node 内容契约断言 | 0 | PASS：16 项断言 | R0 数据禁入、风险命名空间/分母、5/3/1/1 正反口径及 change 完成状态 | 本地候选，2026-07-19 |
| Node Markdown 围栏与相对链接检查 | 0 | PASS：8 个 Markdown、17 个本地链接、0 failure | 全部变更/新增文档 | 本地候选，2026-07-19 |
| `node scripts/harness-doctor.mjs` | 0 | PASS：0 errors、0 warnings | 根/前端/后端护栏结构与边界 | 本地候选，2026-07-19 |
| `pytest -q backend/tests/test_menxia_veto.py backend/tests/test_direct_canonical_dispatch.py backend/tests/test_commercial_loop_harness.py backend/tests/test_legal_redteam_harness.py` | 0 | PASS：71 passed | 既有门下否决、canonical direct dispatch、商业 loop 与法律 red-team 回归 | 本地候选，2026-07-19 |
| `shasum -a 256` 四份当前产品文档 | 0 | PASS：SSOT=`d3f8b963…e137`、PRD=`98be3636…5375`、决策记录=`dd0f748c…36fb`、guide=`c4356308…de26` | 精确候选内容 | 本地候选，2026-07-19 |

## 结果

- R0 数据边界统一为：只允许合成材料，或经合法性复核且不可重新识别的去标识材料；客户原件和可重新识别材料首次只能在 R1 门通过后进入。
- 合同风险统一为 `critical/high/medium/low`，与 release-severity P0/P1、运营 P1 告警分离；风险项匹配、召回、precision、macro-F1 和零分母 `NO_DATA` 行为已冻结。
- 5/3/1/1 统一为同一 R1 cohort 的 5 家完成、其中 3 家主动复用、1 家已清算未退款付款、1 条书面授权公开客户证言；私有 outcome 不再可替代证言。
- 仅修改产品文档和根级 change 证据；没有运行时、数据或部署副作用。

## 未验证项

- 未实现或验证对应 runtime schema、黄金集 scorer、cohort ledger、付款/证言审计字段；它们仍需 M0–M10 amendment 和独立工程 change。
- 未运行真实 provider、高成本模型 harness、真实客户数据、浏览器产品体验或生产部署；本 change 不触碰这些范围。
- 未证明 R0/R1/R2 已通过；当前只证明文档契约的一致性与护栏健康。

## Diff 与回滚复核

- changed files：8 个 Markdown；4 份当前产品文档 + 4 份本 change 记录；无 `frontend/`、`backend/`、`scripts/` 或 `source_inputs/` 变更。
- diff review：三项 blocker 逐项核对，旧冲突短语无残留；新增定义均指向 PRD 唯一精确口径，没有新增平行事实源。
- 回滚是否演练：未执行实际 revert；documents-only 变更可用普通提交 revert，且无 schema/数据回滚需求。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| R0 不接收真实/可重识别客户材料 | 产品宪法、PRD、决策记录、guide + 内容断言 | PASS |
| 合同风险 taxonomy 与分母可复算 | PRD `8.0` + 16 项内容断言 | PASS |
| R2 商业入口 5/3/1/1 一致且不可用 outcome 替代证言 | 产品宪法、PRD `8.3.1`、决策记录 + 内容断言 | PASS |
| 文档结构与本地链接有效 | 8 文档 / 17 链接 / 0 failure | PASS |
| 根级护栏与代表回归健康 | doctor 0/0；pytest 71 passed | PASS |

## 声明状态

- `VERIFIED_COMPLETE`：仅声明本 change 的三项文档一致性修复及列出的静态/代表回归验证完成；不声明运行实现、客户数据门或任何 release 已通过。
