# 需求说明

## 背景

2026-07-11 这轮实测(真实注册+真实下旨+真实轮询)连续暴露三个问题,共同病根是"验证方式滞后于代码变化"：

1. 注册端到端 100% 失败——`register/page.tsx` 发 `inviteCode`(camelCase),后端 `RegisterRequest` 要 `invite_code`(snake_case),字段名不匹配导致每次请求都在"缺字段"这一步 422,从未真正走到邀请码校验。此前被误判为"环境相关、无法复现"，其实是必现的系统性 bug，测试套件全绿也没拦住，因为没有一条测试真正端到端跑过注册。
2. 密旨(secret 模式)入口和下旨(order 模式)在 UI 上视觉对等，但 `runSecretDecree()` 实际调用的是后端兼容占位端点 `court_compat.py::orchestrate_all()`，从不调用真实部门引擎——本轮已经在 `DecreeInput.tsx` 把提示文案改成诚实描述，但入口本身仍然可点、仍然会创建一个看似正常、实际空转的任务，缺一个说清楚"这个功能现在处于什么状态"的显式产品决策。
3. 后端契约字段(如 `invite_code`)存在一份类型契约文件(`lib/contracts/backend-openapi-2026-07-09.d.ts`)，但它只是 schema 引用字符串，没有展开成可供调用点类型检查的具体字段形状，实际调用点(`register/page.tsx`)完全没有引用这份契约，纯手写 `JSON.stringify` — 契约存在但没有强制力，是这次 bug 能溜过去的直接原因。

本轮变更目标：把这次实测暴露的"验证滞后"补成可重复检查的机制，而不是就地改完这几行就结束。严格遵循 `chaotang-build-office` skill 的纪律：铁律6(一个领域一个 owner,密旨不应该另起一条调度逻辑，应该复用下旨已验证可用的真实调度桥)、铁律9(工作台=咨询/真发生=转后端蜂群,前端不能编造)、诚实标注(source_label 不伪造)。

## 范围

- 新增 2 个 Playwright E2E 用例(注册→登录落地；提交下旨→轮询到终态),作为前门流程的底线回归，不是锦上添花。
- 密旨入口的 UI 层面诚实降级：在决策(是否接入真实调度)落地前，先让入口本身如实标注"当前为兼容占位，暂不产生真实分部门意见"，避免用户误认为和下旨等价。此部分只做诚实标注和禁用态展示，不改路由/后端逻辑。
- 新增一个轻量契约漂移检查脚本(前端侧)：对已知会发 POST/PUT/PATCH body 的调用点，比对其字面量 key 集合与后端 openapi 契约里对应 schema 的 required 字段名集合，snake_case/camelCase 不一致或缺字段时报错，接入 `pnpm harness:doctor`。

## 非目标

- 不在本轮决定密旨要不要接入真实蜂群调度(这是产品决策，需要用户明确拍板，只做本轮范围内的诚实标注降级)。
- 不重写契约生成流程本身(`backend-openapi-2026-07-09.d.ts` 如何生成)，只在其基础上加一层调用点核对。
- 不改动下旨(order 模式)已验证可用的主链路。

## 验收标准

- `pnpm exec playwright test` 新增的两条 E2E 用例可在本地 dev(3002)+ 真实后端(8081)组合下跑绿，且在故意改错 `invite_code` 字段名时会失败(证明测试真的在测这件事，不是空跑)。
- 密旨按钮/面板在界面上能看到"兼容占位·暂不产生真实分部门意见"一类的诚实提示，视觉上和下旨形成可辨识的区分度(不只是 tooltip hover 文案，要有常驻可见的标注)。
- 契约漂移检查脚本对当前代码库跑通(不再报 `invite_code` 问题，因为已在上一轮修过)，且对着一个人为引入的字段名错配(测试夹具)能报错退出非 0。
- `pnpm exec tsc --noEmit`、`pnpm build`、`pnpm harness:doctor` 全绿。

## 风险

- E2E 用例依赖真实后端 + 真实数据库状态(会创建真实测试账号)，需确认 CI 环境下后端可达，或明确标注为仅本地/预发验证，不接入无后端可用的 CI 阶段。
- 密旨入口视觉降级如果做得不够克制，可能被误读成"产品功能被砍"而不是"如实标注现状"，需要用词经过 `chaotang-frontend-design`/`taste` skill 过一遍语气。
- 契约漂移脚本如果规则过严，可能对合法的"故意省略可选字段"场景产生误报，需要只校验 `required` 字段，不校验 optional 字段。

## 验证计划

- `pnpm exec playwright test tests/e2e/auth-register-login.spec.ts tests/e2e/shangshufang-decree.spec.ts`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm harness:doctor`
- `node scripts/check-contract-drift.mjs`(新增脚本，纳入 harness:doctor)
