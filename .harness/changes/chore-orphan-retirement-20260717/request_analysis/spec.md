# 规格说明：chore-orphan-retirement-20260717

## 背景

FULL_COURT_V1 严格顺序已完成 P5/P5.1，下一工作包为 P6。原计划要求把后端
`swarm_orchestrator.py`、两个 mock router、若干 `.bak` 与前端三省孤儿簇移动归档，
同时迁移 7 条引用退役 BFF 的前端守门。本轮调查发现计划锚点已部分漂移：后端候选
仍有生产调用或缺少 14 天调用遥测；只有前端三省簇具备 0 运行时引用的静态证据。

本变更按上位约束执行：不删除产品功能、不修改平台路由族、不把 `null` 当零调用、
不因旧测试路径消失而删除安全意图。可安全闭环的内容继续实施，受治理门阻断的后端
归档明确保留，不伪报完成。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 前端基线精确为 1047 tests / 1040 pass / 7 fail | `pnpm test:node`；focused 27 tests / 20 pass / 7 fail，2026-07-17 | 前端 Owner / 已验证 | 否 |
| 已确认事实 | 前端三省簇外部运行时 import、动态引用、页面挂载均为 0，但两个测试与 censor 仍锚旧文件 | `p6_frontend_audit`；`rg` | 前端 Owner / 已验证 | 否 |
| 已确认事实 | 四个后端兼容派发 POST 未强制认证，可匿名登记内存任务 | `backend/web/routers/orchestration_compat.py`；新增 401 RED | 后端 Owner / 待修复 | 是 |
| 已确认事实 | `swarm_orchestrator.py` 被 CLI、上书房、swarm/runs/chaotang/direct 等运行面使用 | `p6_backend_audit`；生产 import 扫描 | 后端 Owner / 已验证 | 是，阻断归档 |
| 已确认事实 | qintian/forecast mock routers 仍挂载；`/api/court/intel` 有真实页面调用；无 14 天遥测 | `p6_backend_audit`；capability-entry governance | 后端/根 Owner / 已验证 | 是，阻断归档 |
| 已确认事实 | 基线没有 tracked `.bak`；隔离工作树外的 ignored 本地副本不属于本 Packet | `git ls-tree -r d7f7436f` | Git 事实 / 已验证 | 是，阻断移动 |
| 未知问题 | 旧 mock API 是否存在未登记外部客户端 | 无统一 runtime telemetry sink | 后端 Owner / 需观察窗口 | 是 |

## 数据流与调用链

```text
当前浏览器动作
  -> backend compatibility POST
  -> get_current_user（本包补强）
  -> in-memory task_registry（不写 DecisionTask/tasks）

前端三省孤儿簇（无 app/runtime consumer）
  -> 安全语义先迁入 canonical 后端 golden/tests
  -> permanent retired-import guard
  -> dated dev/_attic（保留原相对路径与恢复清单）

仍在用或无遥测的后端入口
  -> 保持原位
  -> 后续调用方迁移/遥测
  -> 14 天零调用 + replacement VERIFIED
  -> 独立归档变更
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 六部/情报兼容派发认证 | `web.deps.get_current_user` | 四个 POST endpoint | 未认证 401；已认证响应形状不变 |
| 招聘零写主库 | `web.task_registry` 内存登记边界 | `/api/court/dept/li-bu/recruit` | 测试证明不产生 SQLAlchemy `DecisionTask` 写入 |
| 礼部发布状态 | `docs/chaotang-v1-taxonomy.json` | `chaotang-v1-modules.ts` 与路由/导航 | `pending + href:null`，不可直达 |
| 司级名称 | `PROJECT_PRODUCT.md` + taxonomy | bureau view test | canonical 名称为“出纳司” |
| 入口删除门 | `.harness/wiki/capability-entry-governance.md` | 后端 mock routers | 无 14 天零调用不得断挂载 |

## 范围

- 新增后端认证与隔离 RED/GREEN 测试，覆盖四个兼容派发 POST。
- 让礼部实现与 taxonomy 的 `pending + href:null` 一致，并补不可直达测试。
- 把“国库司”旧预期修正为 canonical “出纳司”。
- 迁移其余失效 BFF 守门到现行 BFF 禁令、学习证据链和 canonical projection 守门。
- 把前端三省孤儿簇及仅服务该簇的两个测试移动到 dated attic；先蒸馏 fail-closed、非准不执行、职责分离与缺证不放行语义。
- 更新 censor/architecture guard，永久禁止生产重新 import 退役簇。
- 写退役清单、原路径、digest、恢复前置条件和范围阻塞记录。

## 非目标

- 不移动或改写 `backend/src/swarm_orchestrator.py`。
- 不修改 `runs/prompts/flows/swarm/chat/knowledge/memory` 平台路由族。
- 不断挂载 qintian/forecast/intel/taiyi 兼容 router；无 14 天遥测不得宣称 RETIRED。
- 不触碰主工作树 ignored `.bak`，不读取或写入真实数据库，不重启服务。
- 不处理后端基线 7 失败、P7 closeout、P8/P9 或 `/governance` 陈旧路由登记。
- 不修改大殿/王座冻结边界。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 未认证调用四个兼容派发 POST | 401，不能登记任务 | 后端 auth 回归测试 |
| 已认证调用 | 既有响应 envelope/sourceLabel 不变 | 现有 contract tests |
| 礼部 pending | 不进导航/static params，动态直达 fail closed | node test + build |
| 退役模块被重新 import | architecture guard 失败 | guard negative fixture/source scan |
| 证据缺失或模型失败 | 不准奏、不派发 | backend golden/evaluator |
| 后端入口无遥测 | 保持原位并标 BLOCKED，不归档 | scope decision + root doctor |

## 风险与回滚边界

认证变化可能暴露此前依赖匿名写入的调用方；回滚为单独 revert auth commit，但不会恢复前端
admin-token BFF。前端孤儿通过 dated attic 可逆；恢复必须新立 change，证明真实调用方、后端
契约、source label，并同步修改 retired-import guard。后端受阻候选不发生文件移动，因此无
运行回滚风险。

## 计划确认记录

- 批准人：用户（连续“按照顺序执行”“继续任务”“同意”）
- 批准日期：2026-07-17
- 批准范围：严格顺序进入 P6；安全可验证的守门迁移、孤儿归档、测试与证据。
- 明确未批准：绕过 14 天删除门、修改禁改平台路由、触碰真实数据库/服务、夹带 P7/P9。

## 验收标准

1. focused 7 条 known-red 全绿，安全意图逐条有现行等价锚点。
2. 四个兼容派发 POST 未认证均 401；已认证 contract 形状不变。
3. 前端三省孤儿原路径不存在、dated attic 与恢复清单存在、生产引用为 0。
4. fail-closed/非准不执行/职责分离/缺证不放行语义进入 canonical 测试资产。
5. 后端受阻候选保持原位，并有 file:line 与治理门证据；不伪称 RETIRED。
6. 前端全量 node 测试由 1040/7 变为全绿；type/build/censor/doctor 通过。
7. 后端专项与全量回归、根 doctor、统一浏览器冒烟按证据真实记录。

## 验证计划

先运行新增 auth/retirement/golden RED；再做最小实现；每个子闭环后跑 focused tests。
收尾运行前端全量 node、typecheck、build、censor、reachability、前后端 doctors、后端相关
pytest 与统一浏览器冒烟。任何测试只使用临时/内存数据库；不得连接真实服务数据库。
