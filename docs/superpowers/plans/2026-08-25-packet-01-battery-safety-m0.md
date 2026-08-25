# Packet 01 — Battery Safety M0 Implementation Plan

状态：`READY_FOR_CANONICAL_AUTHORITY / PRODUCT_STOP_UNTIL_GO`
基线：`origin/ext-dev@5004733bcdcac9e570dce99dfe1c993330598a16`
任务：`PACKET-01-BATTERY-SAFETY-M0-20260825`

## 执行纪律

- 本 Plan 只有在三文件治理包先独立提交、推送且 canonical machine authority 精确返回 GO 后才可执行。
- 产品候选必须是 approval commit 的唯一单亲子，并且只修改 manifest 冻结的九条产品路径。
- 采用 TDD：先把 RED-01 至 RED-06 写成失败证据，再做最小实现；不得先写实现后补测试。
- 不 checkout、merge、cherry-pick donor；只依据 Task 中已冻结的 commit/tree/patch digest 迁移语义。
- 全程离线，不调用真实模型、provider、生产数据、外部设备或浏览器。

## Phase 0 — 形成审批链

1. Owner 已接受快速收尾范围信封。
2. 只提交并推送 approval、Task、Plan 三条治理路径。
3. 在 canonical clean worktree 运行：
   `node scripts/product-authority.mjs --authorize --task PACKET-01-BATTERY-SAFETY-M0-20260825`。
4. 只有返回 `GO / APPROVED_FOR_ONE_CHILD` 且 approval digest 精确匹配时进入 Phase 1；否则 STOP。

## Phase 1 — RED：冻结可观察失败

先冻结四条电池安全测试路径：

- 新建 `backend/tests/test_battery_safety.py`，覆盖 P0、P1、良性短语反降级、域外不误触发、逐请求无缓存确定性。
- 在 `backend/tests/test_chancellor_draft_graph.py` 增加模型遗漏/降级工部路由时的安全拟旨与指纹绑定测试。
- 在 `backend/tests/test_chancellor_drafts_api.py` 增加不安全 DRAFT_READY 不得注册 authority 的负例。
- 在 `backend/tests/test_chancellor_graph.py` 增加执行前缺失工部·技术司必须在零模型/零部司调用时失败的负例。

运行 focused pytest 并保存 RED 结论。失败必须来自缺少安全门行为，而不是依赖、导入环境、网络或 fixture 错误。若失败原因不同，先诊断，不进入 GREEN。

## Phase 2 — GREEN A：纯确定性分类器

新建 `backend/app/agents/chancellor_draft/battery_safety.py`：

1. 使用冻结 enum/value object 表达 `NOT_APPLICABLE/P1/P0`、BLACK、人签、必选 route、禁止动作和规则版本。
2. 以电池域词与事故/安全审查上下文的交集判断 scope；泛化“安全”单词不触发。
3. P0 覆盖 donor 固定危险语义；其他 in-scope 请求保守为 P1，不提供 P2 自动降级。
4. 提供纯函数执行 draft enforcement、draft assertion 与 execution-route assertion。
5. 不读取时间、环境、网络、数据库、缓存或模型；不引入新依赖。

只运行 `test_battery_safety.py`，直到分类和负例全绿。

## Phase 3 — GREEN B：拟旨与指纹绑定

修改 `backend/app/agents/chancellor_draft/graph.py`：

1. 拼接原始 user messages 后立即分类，早于 `_get_chat_model()`。
2. 把安全不变量作为系统约束传入首次调用和所有结构修复重试。
3. 在模型响应第一次结构校验后，确定性加入或合并工部·技术司，不删除其他合法部门。
4. 把 P0/P1、BLACK、人签和禁止动作写入用户可见 draft，并生成带稳定安全标记的 `expert_example/decree_text`。
5. 用安全后处理后的 response 与 route snapshot 重新生成 fingerprint；严禁先指纹后修改。

运行 battery unit + draft graph tests。证明同一输入稳定、模型降级无效、非电池请求字节行为保持原样。

## Phase 4 — GREEN C：authority 注册前独立复核

修改 `backend/app/api/chancellor_drafts.py`：

1. 在 `draft_authority_registry.register(...)` 前，以原始 user messages 和已验证 response 独立复核安全不变量。
2. 确认 decree、route snapshot、风险显示和 fingerprint 对应同一安全后处理结果。
3. 任一不一致都转换为现有净化失败，`side_effects=()`，不注册 authority。
4. 保持现有 owner、version、fingerprint、decree、route 和 accounting context 契约不变。

运行 draft API tests，特别证明假图不能把不安全 DRAFT_READY 注入 authority。

## Phase 5 — GREEN D：执行前失败关闭

修改 `backend/app/agents/chancellor/graph.py`：

1. `_decide_route` 在创建 evidence session、调用模型或调用部/司前检查 decree 中的稳定安全标记。
2. 命中时要求 approved route 已含工部且 required bureaus 已含技术司。
3. 缺失时抛出现有净化 `ChancellorGraphInvocationError`，`failure_stage="route"`；不得现场追加未经用户确认的 route。
4. 安全 route 继续沿现有 single/multi 执行，不改变其他路由、军机处或最终汇总契约。

运行 chancellor graph tests，并用调用计数证明失败路径为零模型、零 evidence session、零部司调用。

## Phase 5.5 — GREEN E：SQLite preservation 测试顺序隔离

只修改 `backend/tests/test_sqlite_backup.py` 中失败的文件描述符集合断言：拒绝测试执行后新增的描述符，但允许此前无关描述符被
其他测试或运行时关闭。不得修改 `backend/app/operations/sqlite_backup.py` 或任何生产逻辑。先复现整文件顺序失败，再证明
整文件与全后端矩阵通过。

## Phase 6 — 完整矩阵与独立终审

按 manifest 顺序运行：

1. backend full pytest；
2. Packet 01 focused pytest（含既有 decrees API 回归）；
3. 九路径 ruff；
4. product authority regression；
5. root Harness 与 doctor；
6. V2 convergence check 与 regression。

随后必须取得独立代码终审与安全终审。P0–P2 问题未关闭时不得形成候选；不得用修改测试、降低信号集合、删除负例或跳过全矩阵来换取绿色。

## Phase 7 — 精确候选交付

全绿后才创建唯一产品 candidate commit，确认：

- parent 恰好是 approval commit；
- changed paths 恰好等于九路径；
- 无工作树残留；
- `--verify-candidate` 返回 PASS；
- 输出 candidate commit、tree、九路径 diff digest、approval digest 与 evidence digest。

先把这些精确身份交给 Owner。未获得候选精确授权前，不推送、不合并、不部署、不试点。

## 回滚与停止

回滚单位是未来唯一产品候选整提交；四层安全链（分类、拟旨、API 注册前复核、执行前复核）必须一起保留或一起回退。无 schema/数据迁移，因此不执行数据清理。

需要第十路径、远端基线漂移、新 P0、第二 authority、前端/API/schema/数据库/CI/Harness/ADR 变更，或 RED 无法按 Task 复现时
立即 STOP，返回 Owner 重审；不得创建 V2/V3 式隐性扩张版本。
