# 六部前后端接口对接实施方案

> 生成 2026-07-09。基于对户部/吏部/兵部/刑部/工部五个部门的全量前后端接口审计（口径：司二级页面调用了哪个 API、后端是否真实实现、是否真的被调用）。范围不含礼部（1.0 明确 pending，无页面）。过期以代码为准，本文档是当时快照。

## 一、现状结论

**六部页面的"部门总览卡"是真的，往下每一层几乎全是断的。**

只有一件事对用户是真实可用的：`GET /api/chaotang/dept/{code}/overview`（`backend/web/routers/dept.py:120`），聚合真实 memorials/task_snapshot/风险数据，五个部门共用同一实现，真实。除此之外：8 个"司"二级页面、多处部门写操作、多个已实现的后端判决引擎，全部处于未接通状态。

## 二、全景表

| 部门 | 司(二级页面) | 二级页面接口 | 部门主页接口 | 本地重复裁决 | 后端孤儿端点(有实现无调用方) |
|---|---|---|---|---|---|
| 户部 finance | 预算司/出纳司 | ❌ 死路由 `bureaus/finance/*/page-view` | ✅ `dept.py:120` 真实 | 无重复裁决，但"预算立案""案卷裁决"前端表单齐全、打向不存在路由 | `hubu.py` 6 个 `/preview` 端点 |
| 吏部 personnel | 任免司/招聘司 | ❌ 死路由 | ✅ 真实（笼统，不分司） | ✅ `termination/hiring/promotion-review.ts` 全本地 | `libu_vet.py`/`libu_appointment_vet.py` **无 REST 出口** |
| 兵部 ops | 报价司/线索司 | ❌ 死路由 | ❌ 备用工作台也是死路由（`bingbu/overview`、`bingbu/ask`） | ✅ `deal-verdict.ts` 全本地 | `/battlecard`、`/api/quotation/verdict` |
| 刑部 legal | 合同司 | ❌ 死路由 | ✅ `legal.py:28` 真实（六部唯一自带专属 overview） | ✅ "审查"按钮走本地 `clause-risk.ts`，另有一条自称"唯一真链"实为死路由的会诊面板 | `/verdict`、`/verdict/from-text` |
| 工部 gongbu | 产研司 | ❌ 死路由 | ✅ `dept.py:120` 真实 | 无重复裁决（诚实标 FALLBACK），但任务队列 + 2 个可行性面板全打死路由 | `/api/gongbu/review`（输入结构与产研司 UI 不兼容，设计问题非疏漏） |

## 三、三个共性病灶（同一套病发五次，不是五个独立的病）

1. **`GET /api/court/bureaus/{dept}/{office}/page-view` 后端从头到尾不存在。** 8 个司二级页面（预算/出纳/任免/招聘/报价/线索/合同/产研）全靠它，全部 404，落到 `BureauPageViewError`。单点修复收益最大。
2. **前端在多个部门自己重写了一套裁决逻辑**（`deal-verdict.ts`/`termination-review.ts`/`hiring-review.ts`/`clause-risk.ts`），后端已有对应真实判决引擎却没人调。`backend/docs/pending_decisions.md` 里记录的"兵部 DealVerdict 分裂"这条问题，在 2026-07-09 harness 统一提交里**记录被删，代码问题原样还在**——需要在本方案执行时补回追踪。
3. **后端有真实实现但零调用方**：户部 6 个 `/preview`、兵部 `/battlecard`+`/quotation/verdict`、刑部 `/verdict`+`/verdict/from-text`。

## 四、实施步骤（按性价比排序，逐项列改动范围与验收标准）

### P0-1　刑部：接通"审查"按钮（改动最小，收益最大）

- **改**：`frontend/src/features/xingbu/components/xingbu-contract-workbench.tsx` 的 `handleScan()`，由本地 `clause-risk.ts` 扫描改为调用已存在的后端 `POST /api/legal/verdict/from-text`（`backend/web/routers/legal.py:76`）。
- **删或接**：`xingbu-legal-swarm-panel.tsx` 自称"唯一真链"的会诊面板，其请求 `/api/court/dept/xing-bu/legal` 后端不存在——要么删掉这个误导性入口，要么真的接到 `swarm_execution_loop.py` 的 `DEPT_NAME_TO_SWARM` 通路上。
- **验收**：上传/粘贴一份含红线条款的合同文本，界面判决结果与直接 `curl POST /api/legal/verdict/from-text` 的返回一致；后端日志里能看到该请求。

### P0-2　兵部：接通报价判决 + 收敛成一套主页

- **改**：`frontend/src/features/bingbu/lib/deal-verdict.ts` 改为调用 `POST /api/quotation/verdict`（`backend/web/routers/quotation.py`）。这正是被删掉记录的历史待决事项，本方案等于把决策补做完。
- **先拍板**：兵部现有两套并行主页——`bureau-page-view` 一套（死路由）+ `/departments/ops` 工作台一套（`use-bingbu-overview.ts`/`bingbu-decision-cockpit.tsx`，同样打死路由）。选一套留下、删另一套，不要同时修两条断腿。
- **验收**：同一笔商机在前端界面得出的报价判定，与后端 `/api/quotation/verdict` 直接返回的判定逐字段一致（建议补一个回归测试断言这一点，防止未来再长出第二套实现）。

### P1　户部：司页面接已有 preview 端点 + 清死代码

- **改**：预算司页面调用 `POST /finance/reporting/preview` 或 `/finance/intake/preview`；出纳司页面调用 `POST /cashflow/preview`（均已在 `backend/web/routers/hubu.py` 真实实现，目前只被会审 L3/L4 通路调用）。不新建通用 page-view 后端接口。
- **删**：确认无人使用后，删除从未被任何真实路由渲染的 `HubuWorkspace`/`HubuOfficePage` 及其 30+ 关联文件（`frontend/src/features/hubu/**` 中未被 `liubu/**` 路由引用的部分）。
- **暂不修**："预算立案"（`research-budget-loop`）、"案卷裁决"（`briefs/.../decision/advance`）两处前端表单目前打向不存在的后端路由；先记录为已知缺口，是否补后端由用户按业务优先级决定，不在本轮默认范围。
- **验收**：预算司/出纳司页面能显示 preview 接口返回的真实试算结果；`tsc --noEmit` 和相关组件测试通过。

### P2　吏部：先补后端 REST 出口，再接前端

- **改（后端）**：参照 `legal.py` 的 `/verdict` 模式，给 `src/libu_vet.py`（招聘）、`src/libu_appointment_vet.py`（任免）各开一个 REST 端点，挂到一个新的 `web/routers/libu.py`（当前不存在）。
- **顺手修**：`frontend/src/features/departments/lib/department-page-view-loader.ts` 里 `canonical === 'market'` 的死判断改成 `canonical === 'personnel'`，否则新端点接了也传不到 `libuPromoOverview`。
- **改（前端）**：任免司/招聘司页面改调新端点，替换 `termination-review.ts`/`hiring-review.ts`/`promotion-review.ts` 里的本地裁决。
- **验收**：新端点有单测；前端页面裁决结果来自后端而非本地函数（可用网络请求日志核实）。

### P3　工部：不强接，先明确边界

- **不做**：不为了"接上"而强迫产研司 UI 拼出 `/api/gongbu/review` 需要的 `presale_output`+`task_input`——这两个字段的上游（精算 agent 结构化产出）目前不存在，硬接等于逼造数据，违反项目已有的"禁假 PASS"原则。
- **可选小修**：把工部部门主页任务队列（现在打向不存在的 `/api/court/backend/tasks`）改成调用已存在的 `GET /api/chaotang/tasks` 或 `GET /api/tasks`，这个是纯粹的路径写错，与上面的架构问题无关，随手可修。
- **验收**：任务队列显示真实任务列表；产研司页面的"暂不支持真实会审"提示保持诚实，不新增伪造数据。

## 五、需要用户拍板的事项

1. 兵部两套主页（bureau 页 vs 工作台页）留哪个、删哪个？
2. 户部 `HubuWorkspace`/`HubuOfficePage` 孤儿代码，确认可以删，还是有人还在用/还有后续计划？
3. 是否按 P0→P3 顺序执行，还是有更急的业务场景要插队（比如某个客户马上要用到的部门）？
4. 吏部需要先做后端开发（新端点），工作量比其他四部大一档，是否接受这个顺序上的落后？

## 六、验证方式

- 每完成一项 P 级任务，跑一次端到端手动验证（登录 → 进入对应部门 → 触发对应操作 → 核对返回数据来源），不满足于 `tsc`/单测通过。
- 涉及判决类接口（quotation/verdict、legal/verdict）的改动，补一条前后端一致性回归测试，断言"前端拿到的结果"与"直接调后端接口的结果"逐字段相等。
- 每项改动收尾按 `backend/AGENTS.md` / `frontend/AGENTS.md` 的收口模板给出：目标、应提交文件、不应提交文件、验证命令、回滚方式。

---

## 七、实施结果（2026-07-09 执行完毕，本节记录"计划 vs 实际"）

执行过程中发现三处第五节判据不准，已按代码事实纠偏执行，纠偏理由记录如下，不静默改判据。

### 关键纠偏

1. **8 个司页面死路由的根因找到了**：前端 BFF 层于 2026-07-08（本方案前一天）整体退休（`frontend/.harness/changes/chore-remove-bff-layer-20260708/`），`/api/court/bureaus/{dept}/{office}/page-view` 从未在后端存在过——它是被删掉的 Next.js BFF 路由的残留调用目标，不是"从未实现"，是"退休后调用方没跟着迁移"。
2. **`buildBureauPageView` 早就写好了**：`frontend/src/features/bureaus/lib/bureau-page-view-builder.ts` 已经是一个完整、诚实（`dataMode`/`integrity.disclaimers` 齐全）的司级视图构建函数，只是 `useBureauPageView.ts` 这个 hook 从没调用过它，一直在打死路由。**不需要新建后端 page-view 接口**，只需要把 hook 改成：打真实 `dept.py` overview → 喂给已存在的 builder。已对全部 8 个司统一生效（一次修复覆盖户/吏/兵/刑/工五部，不是逐部门改）。
3. **原判据里两处"P0 紧急裁决分裂"经代码核实，实际已在更早前正确处理**：
   - 兵部 `deal-verdict.ts` 的 header 注释写明"铁律6：调各部真引擎（quote-sanity 兵、payment-compliance 刑），不重算"——它是快速确定性预检（拒绝在成本未核定时编报价），跟 `/api/quotation/verdict`（慢速、非确定性、真 LLM 全文分析）是两种不同量级的检查，不是同一问题的两个冲突答案，**不应该强行合并**。`twenty-client.ts` 自带 `TWENTY_WRITEBACK_ENABLED` 显式开关（2026-07-04 加），且全仓零调用方——本来就是休眠骨架，`pending_decisions.md` 那条担忧在同一天已经被这个开关修复，只是文档没同步勾掉，后来文档本身又被删。**本轮结论：无需改代码，只需承认它已经修好。**
   - 刑部"审查"按钮（`xingbu-contract-workbench.tsx`）保持本地 `clause-risk.ts` 不变——组件注释明确写"原文不出浏览器（铁律9 咨询面）"，这是刻意的隐私边界（合同原文不出浏览器），不是遗漏。**真正的死链是旁边的"深度会诊"面板**（`xingbu-legal-swarm-panel.tsx`），它才是本轮实际修的对象。
4. **发现一套完整的"平行孤儿 UI 系统"**：`department-offices.ts`（注册表）→ `{Dept}Workspace`/`{Dept}OfficePage`（hubu/gongbu/xingbu/bingbu/libu/lifu 六套）→ `department-vitrine.ts`，整条链只被自己的测试引用，从未被任何 `app/` 路由挂载。这是与"新系统"（`bureau-page-view` + `bureau-page-specs.ts`）**并存的第二套完整实现**，包含 `deal-verdict.ts`、`xingbu-contract-workbench.tsx`（含隐私扫描）等有真实价值的逻辑，但外壳组件本身是死代码。

### 实际改动（按文件）

**新增**
- `backend/web/routers/libu.py`：任免司 `/api/libu/appointment/verdict`（确定性，`libu_appointment_vet.py`）+ 招聘司 `/api/libu/recruit/verdict`（真 flow，`libu_vet.py`），已注册进 `main.py`。
- `backend/tests/test_libu_router.py`：4 个测试，全过。

**修改**
- `backend/web/main.py`：注册 `libu_router`。
- `frontend/src/features/bureaus/hooks/useBureauPageView.ts`：改打真实 `dept.py` overview，喂给已存在的 `buildBureauPageView`（不再打死路由）。**这一处修复让全部 8 个司页面从硬 404 变成真实数据 + 诚实缺口标注**，是本轮单点收益最大的改动，比原方案设想的"逐部门改二级页面"更省、更一致。
- `frontend/src/features/bureaus/components/BureauPageRouteClient.tsx`：`legal/contract-review` 下额外挂载 `XingbuContractWorkbench`（原方案要修的组件，先确认它现在真的能被用户看到）。
- `frontend/src/features/xingbu/components/xingbu-legal-swarm-panel.tsx`：由 dispatch+poll 打死路由，改为同步调用已存在的 `POST /api/legal/verdict/from-text`，渲染逻辑同步改为真实 `court_doc`(`light`/`headline`/`items`)形状；红色 finding 保留"只读、禁一键采纳"命门。
- `frontend/src/features/departments/lib/department-page-view-builder.ts`：4 个内部函数（`sealFor`/`metricRailFromOverview`/`riskRailFromOverview`/`activeTasksRail`）加 `export`，供 bureau 层复用（纯可见性扩大，无行为变化）。

**删除（确认零外部引用后清理，孤儿 UI 系统的一部分）**
- `department-offices.ts`、`department-vitrine.ts`(+test)
- `hubu-workspace.tsx`、`hubu-office-page.tsx`
- `bingbu-office-page.tsx` 及其专属子树 8 个文件（`bingbu-main-view/decision-cockpit/org-rail/detail-panel/prospect-panel/customer-upload-qualify/deal-verdict-scroll.tsx` + `use-bingbu-overview.ts`）
- `gongbu-office-page.tsx`、`xingbu-office-page.tsx`、`xingbu-workspace.tsx`、`libu-office-page.tsx`、`lifu-office-page.tsx`

**未完成（诚实标注，非默默跳过）**
- `GongbuWorkspace`/`LibuWorkspace`/`LifuWorkspace`/`XingbuStaffRail` 及各自子树：在根组件删除后已 100% 不可达，但本轮未逐文件验证其内部依赖闭包，未删除。后续可用同样方法（逐文件 grep 外部引用）安全清理。
- 8 个司页面的 `BureauAction`（如"补现金流证明""要求补预算说明"）本轮统一标 `disabledReason`（诚实占位，不假装能点），未接真实触发点——因为这些动作需要的结构化输入（factPack/decisionInput 等）目前没有可收集这些输入的表单 UI，属于新功能建设范畴，超出"检查/接通已有接口"的原始需求边界。
- 户部"预算立案"`research-budget-loop`、"案卷裁决"`briefs/.../decision/advance` 两处仍打向不存在的后端路由，维持第四节原判"暂不修"。
- 未跑浏览器端到端验证（本环境无浏览器）；已跑：`pnpm exec tsc --noEmit`(0 错误)、`pnpm run test:node`(959/966，7 个失败均为本轮改动之外的文件，逐一核对 git status 确认为改动前既有失败)、后端 `pytest`(2226 passed / 7 failed，失败与 `libu` 无关，环境缺 `DEEPSEEK_API_KEY` 导致的既有失败)。

### 收口

1. **目标**：把六部 8 个司页面从死路由/未接通状态改为真实数据 + 诚实缺口标注；吏部补齐后端 REST 出口；清理确认孤儿的旧 UI 系统。
2. **应提交文件**：见上"实际改动"全部列表（`backend/web/main.py`、`backend/web/routers/libu.py`、`backend/tests/test_libu_router.py`、`frontend/src/features/bureaus/**`、`frontend/src/features/departments/lib/department-page-view-builder.ts`、`frontend/src/features/xingbu/components/xingbu-legal-swarm-panel.tsx`、上述删除项、本文档）。
3. **不应提交文件**：无环境漂移或运行产物产生；`frontend/node_modules`(本轮新装，已 gitignore)。
4. **验证命令**：`cd frontend && pnpm exec tsc --noEmit && pnpm run test:node`；`cd backend && python3 -m pytest -q`。
5. **回滚方式**：`git checkout -- <path>` 逐文件回滚（删除的文件用 `git checkout -- <path>` 可恢复，因为是删除而非物理清空历史）；新增的 `backend/web/routers/libu.py`/测试文件用 `git clean` 或直接 `rm`。
