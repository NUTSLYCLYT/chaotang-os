# 任务拆解

## 任务 1：注册→登录 E2E 底线测试【DONE，见 coding/coding_report_v1.md】

- 目标：用真实浏览器把"新用户注册→登录→落地到已登录页"这条前门流程钉死成回归测试，防止 `invite_code`/`inviteCode` 这类字段名漂移再次无声无息通过。
- **实际发现**：不需要新写测试文件——`e2e/invite-enter-register-smoke.spec.ts` 已经存在(2026-07-09 commit af8278a 引入)，覆盖面比原计划更全(`/enter`、`/invite`、`/invite/[code]`、`/register` 四个入口)，但当时只改了后端+写了测试，前端页面代码从未跟着改，8 个用例里有 2 个此前是失败的：① `/enter` 页面对任意非空 token 一律 setTimeout 后放行到 `/dadian`，完全没调用任何后端校验(比原计划设想的"字段名漂移"更严重——是一处真实的准入绕过)；② `/register` 页面没有邀请码时不会在前端拦截，会带着 `invite_code: undefined` 真的发请求到后端吃 422，而不是给出清楚的"请通过邀请链接进入"提示。已修：`enter/page.tsx` 改为调用 `/api/auth/verify-invite` 真实校验(和 `/invite` 页面同款)；`register/page.tsx` 加了提交前的 `!inviteCode` 前端拦截。
- 验收：`pnpm exec playwright test e2e/invite-enter-register-smoke.spec.ts` 8/8 全绿(此前 6/8，另外发现 2 个失败最初是因为用了带 `BASE_PATH=/chaotang` 的手动 dev 服务器，不是这套 e2e 自己按约定起的裸路径实例——已用 `webServer` 自带的隔离实例复核，环境问题排除后才看到真实的 2 个业务 bug)。
- 依赖：无新增——复用仓库已有的 `playwright.config.ts` webServer(自动隔离 `.next-e2e`，dev=3002 端口纪律)与 `backend/scripts/manage_invites.py` 生成的 `CHAOTANG-DEV-E2E` 常驻邀请码。

## 任务 2：下旨提交→终态 E2E 底线测试

- 目标：把"提交下旨→轮询到 awaiting_decision/awaiting_emperor_decision 等终态"这条主链路钉成回归测试，这是产品的核心价值主张，不能只靠人工偶尔点一次来确认它还活着。
- 输入：任务 1 里已登录的会话状态(可复用 `storageState`)。
- 输出：`frontend/tests/e2e/shangshufang-decree.spec.ts`，覆盖：跳过/关闭引导弹窗→填写下旨文本→点击下旨→断言出现"蜂群执行中"或等价状态文案→(可选，标记为 slow test)轮询 `GET /api/shangshufang/tasks/{id}/status` 直到 `current_stage !== 'executing'`，超时给出明确失败信息而不是挂起。
- 验收：正常路径跑绿；轮询超时上限设置为 4 分钟(略高于实测 160 秒)，超时判定为失败并打印最后一次轮询到的 `current_stage`。
- 依赖：任务 1(需要登录态)；后端 8081 需要真实可用(非 mock)。

## 任务 3：密旨入口诚实降级(UI 层，不改路由)【DONE，见 coding/coding_report_v1.md】

- 目标：让密旨入口在决策落地前就诚实展示"当前是兼容占位"，不需要用户 hover tooltip 才能发现。
- 输入：`DecreeInput.tsx` 里 `MODE_OPTIONS` 的 secret 项；`chaotang-frontend-design`/`taste` skill 的视觉纪律(禁止另起一套 UI 语言，复用现有徽标/badge 组件)。
- 输出：密旨按钮旁常驻一个小徽标(参考 office-kit 里 `sourceNote`/协办徽的视觉语言，而不是新发明一套)，文案如"占位·未接真实蜂群"；点击后如果提交，任务详情里也要能看到同样的诚实标注，不能提交后就看不出来了。
- 验收：不登录 hover 也能在默认视图里看到这个状态标注；浏览器截图留档。
- 依赖：无(纯前端展示层变更，不改后端路由)。此任务不实现"密旨接入真实调度"——那是需要用户明确拍板的产品决策，本任务只做诚实降级。

## 任务 4：契约漂移检查脚本

- 目标：把这次审计端点覆盖率用的"归一化路径比对"方法论，扩展成一个能抓 `invite_code` 这类字段名漂移的常设检查，而不是每次人工重新写一遍。
- 输入：本轮已经写好的路径归一化 Python 脚本(session 内产出，需要迁移/重写成仓库内可维护脚本)；后端运行时 `/openapi.json`(或 `app.openapi()` 离线导出)里每个 POST/PUT/PATCH 端点的 `requestBody` schema 的 `required` 字段列表。
- 输出：`frontend/scripts/check-contract-drift.mjs` 或等价 `.ts`：对每个已知会发 body 的 `backendFetch`/`fetch` 调用点，抽取其 `JSON.stringify({...})` 字面量对象的 key 集合，和后端 schema 的 required 字段集合做差集比对，有缺失或大小写形态不匹配时非 0 退出并打印具体文件:行号。
- 验收：跑一遍能清楚报告"0 处漂移"；人为在测试夹具里引入一个 `fooBar` vs `foo_bar` 的错配能被检出。接入 `pnpm harness:doctor`，doctor 挂了要红。
- 依赖：需要一份可离线读取的后端 openapi schema 导出(建议后端那边配合导出一份 json 文件，而不是每次跑脚本临时起后端)；如后端侧暂不提供，先支持"传入一个正在运行的后端 base url，脚本自己请求 `/openapi.json`"作为退路。
