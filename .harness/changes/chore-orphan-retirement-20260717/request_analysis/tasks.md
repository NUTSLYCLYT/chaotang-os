# 任务：chore-orphan-retirement-20260717

## 任务 1：迁移 7 条 known-red

- 目标：保留安全意图，修复事实源漂移，不以删除测试清红灯。
- 前置条件：focused RED 固定为 27 tests / 20 pass / 7 fail。
- 输入：taxonomy、产品定义、现行 backend compatibility routes、BFF doctor 与 canonical projection guards。
- 输出：礼部 pending/href/null 路由门、出纳司预期、学习/招聘/派发守门现行锚点。
- 涉及文件：5 个前端 nodetest、礼部配置/动态路由、后端 contract/auth tests。
- 状态 / 数据变化：无持久化数据变化；未认证 POST 由可达变 401。
- 验证命令与证据：focused node tests、backend auth/contract pytest。
- 回滚边界：认证与礼部门控可分别 revert；不得恢复旧 BFF。
- 完成定义：7 条全部 GREEN，旧→新意图映射落盘。

## 任务 2：蒸馏三省孤儿安全语义

- 目标：壳归档前保留 fail-closed、非准不执行、职责分离与证据相关性规则。
- 前置条件：后端 canonical owner/现有 golden harness 已确认。
- 输入：旧 `court-pipeline`/`three-chamber-engine` 与现有后端 tests/golden。
- 输出：新增或扩展 canonical golden/test；不复制具体 prompt 或旧执行顺序。
- 涉及文件：后端 department protocol golden/tests、前端 architecture guard/censor。
- 状态 / 数据变化：仅版本化测试资产。
- 验证命令与证据：先 RED，后 GREEN；backend doctor。
- 回滚边界：测试资产可独立 revert；不得以 revert 复活旧生产 import。
- 完成定义：安全不变量由 canonical tests 承接。

## 任务 3：可逆归档前端三省孤儿簇

- 目标：移动 3 个生产孤儿与 2 个孤儿测试到 dated attic，生产引用保持 0。
- 前置条件：任务 2 GREEN；retired-import guard 已存在。
- 输入：0 runtime import/page mount 审计。
- 输出：dated attic、README、expiry、restore manifest、原路径不存在。
- 涉及文件：`frontend/dev/_attic/governance-orphans-2026-07-17/**`。
- 状态 / 数据变化：无运行态数据变化。
- 验证命令与证据：retirement layout test、grep、censor、knip、type/build。
- 回滚边界：只能通过新 review change 移回并同步调整 guard。
- 完成定义：0 生产引用且恢复路径可执行。

## 任务 4：登记后端归档阻塞

- 目标：对 active/无遥测候选给出诚实处置，不绕过 capability-entry 删除门。
- 前置条件：只读调用方与治理审计完成。
- 输入：`p6_backend_audit`、capability entry governance。
- 输出：scope decision/retirement inventory，状态为 ACTIVE 或 MIGRATE_REQUIRED/BLOCKED。
- 涉及文件：本 change 证据目录；不移动候选源文件。
- 状态 / 数据变化：无运行行为变化。
- 验证命令与证据：production import scan、OpenAPI/consumer scan、root doctor。
- 回滚边界：纯证据文件可 revert。
- 完成定义：每个候选均有处置、证据、下一门和恢复/迁移边界。

## 任务 5：累计验证与审查

- 目标：证明本 Packet 无新增回归并保留统一闭环体验。
- 前置条件：任务 1–4 完成。
- 输入：最终 diff。
- 输出：CI 摘要、浏览器证据、独立 packet review。
- 涉及文件：`ci_result/**`、`e2e_test/**`、`packet_review/**`。
- 状态 / 数据变化：仅证据；测试使用临时数据库。
- 验证命令与证据：前后端全量/专项、doctors、build、冒烟。
- 回滚边界：实现回滚不依赖真实 DB downgrade。
- 完成定义：无未解释新红灯；阻塞项保持诚实 PARTIAL/BLOCKED，审查绑定精确 SHA。
