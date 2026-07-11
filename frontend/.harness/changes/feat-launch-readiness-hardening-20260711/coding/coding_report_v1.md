# 实现报告 v1

## 改动(任务 1 · 注册→登录 E2E，2026-07-11)

发现仓库已有 `e2e/invite-enter-register-smoke.spec.ts`(2026-07-09 commit `af8278a` "selectively integrate backend invite closure from dev" 引入)——那次改动只选择性合并了后端(`auth.py`/`schemas/auth.py`/`tenant.py`)和这份测试，前端 `/enter`、`/register` 页面代码没有跟着更新，导致测试写的是"意图行为"，代码还是旧行为，8 个用例里 2 个此前失败：

1. **`src/app/enter/page.tsx`**：原实现只要 `token` 非空就 `setTimeout` 后判定 `granted` 并跳转 `/dadian`，从未调用任何后端校验——比"字段名漂移"更严重，是一处真实的邀请令牌准入绕过(任意字符串当 token 都能"入朝")。改为调用 `/api/auth/verify-invite`(与 `/invite` 页面同一个真实后端端点)，只有 `body.valid === true` 才放行，否则展示"此令牌无法入朝"拒绝态；组件卸载/token 变化时用 `cancelled` 标记防止竞态写入已经不需要的状态。
2. **`src/app/register/page.tsx`**：`handleSubmit` 开头补一条 `if (!inviteCode) { setError('注册需要有效邀请码，请通过邀请链接进入本页面。'); return; }`——后端 `invite_code` 是必填字段，没有邀请码提交必然 422，与其让用户填完整张表单才在网络层看到报错，不如提交前就挡住并给出清楚的下一步。

运行 e2e 时发现一个环境陷阱：本机手动跑着的 dev server 设了 `BASE_PATH=/chaotang`(供整个 session 手动浏览器验证用)，而这套 e2e 套件的 `playwright.config.ts` 明确约定"不带 basePath"、有自己的隔离 `webServer`(独立 `.next-e2e` 构建目录，避免和手动 `pnpm dev` 打架)。用 `PLAYWRIGHT_SKIP_WEBSERVER=1` 直接冲手动服务器测出的"5 个失败"大多是环境不匹配的假阳性，不是真 bug；停掉手动 server、让 Playwright 用自己的隔离实例后，才看到上面这 2 个真实业务缺口。修完后已重新拉起手动 dev server(同样带 `BASE_PATH=/chaotang`)供后续继续人工验证用，两者互不冲突(分属不同 `.next*` 构建目录)。

### Codex 停止前审查纠正(任务 1，2026-07-11)

Codex 停止前审查指出:"注册页关键修复没有被现有 E2E 真正覆盖"。复核发现两处真实覆盖缺口，都在 `e2e/invite-enter-register-smoke.spec.ts` 里：

1. 名为"提交被前端拦截，不发请求"的用例，断言只查了错误文案是否可见，**从来没有验证过真的没有发请求**——如果拦截逻辑有 bug(比如条件写反、缺 `return`、`return` 在错误的分支里)，文案照样可能显示，请求照样可能发出去，这条用例会"假阳性通过"。补了 `page.on('request', ...)` 监听，真实统计打到 `/api/auth/register` 的请求数，断言为 0。
2. **更关键的缺口**：全部 9(原 8)个用例里，"注册携带有效邀请码 → 201"这条正向路径只用裸 `fetch()` 直接打后端 API 验证，从没有一个用例通过浏览器 UI 真正驱动一次"带有效邀请码的注册表单填写→提交"，去证明我新加的 `!inviteCode` 前端拦截门没有连带把正常路径也挡住。这正是"关键修复没有被覆盖"的准确含义——修复本身可能是对的，但没有任何测试证明它不会误伤合法用户。补了一条新用例：`/register?invite=真实邀请码` → 真实填表→提交→断言"注册成功"卷轴出现→断言最终跳转 `/login`，全程走浏览器 DOM 交互，不绕过 UI。

修完后 `pnpm exec playwright test e2e/invite-enter-register-smoke.spec.ts` 9/9 全绿(含新增的 2 处断言)。

### Codex 停止前审查再纠正(任务 1，2026-07-11 第二轮)

Codex 停止前审查又指出:"新增 E2E 未完成其声明的'注册→登录→已登录落地'闭环"。复核发现上一轮补的那条正向用例，标题和描述都写着"注册→登录"，但实际断言只走到 `page.waitForURL(/\/login/)`——跳转到登录页就算结束，从来没有真的用刚创建的账号密码去提交登录、也没断言最终落地到已登录页(`/dadian`)。这跟任务 1 在 `request_analysis/tasks.md` 里写的原始目标"新用户注册→登录→落地到已登录页"名不副实，只做了前一半。

修复：在原有断言之后，续接真实登录动作——`page.getByLabel('用户名')`/`page.getByLabel('密码')` 填入刚注册的同一组用户名密码(`login/page.tsx` 的两个输入框是 `<label>` 包裹 `<span>用户名/密码</span>` + `<input>`，用 `getByLabel` 能正确关联)，点击"入朝议政"提交，断言 `page.waitForURL(/\/dadian/)`(登录页默认 `next=/dadian`)。用例名同步改成"真实注册成功→登录→落地已登录页"，不再半路声称完成。

验证：`pnpm exec playwright test e2e/invite-enter-register-smoke.spec.ts` 9/9 全绿(含完整走完注册→登录→落地 `/dadian` 的这条用例)。`tsc --noEmit`、`test:node`(989/995，同一组既有失败)复跑均绿。

## 改动(任务 3 · 密旨入口诚实降级)

- `src/features/shangshufang/components/DecreeInput.tsx`：
  - 模式切换按钮(圣旨/密旨segmented control)里，密旨按钮常驻一个小圆点标记(`decree-mode-secret-placeholder-dot`)，`aria-hidden`，靠按钮自带的 `title` 承载无障碍文案。
  - 操作行里(与 paperclip/模式切换/输入框同一行)，密旨选中时常驻显示一个文字徽标"占位·未接蜂群"(`decree-secret-placeholder-badge`)，圣旨模式下不渲染。这个徽标在紧凑 dock(`inSlot=true`)和展开工作台(`inSlot=false`)两种布局下都会出现——之前只在展开工作台的身份条里加了一版，浏览器截图验证后发现紧凑 dock(全局常驻的那个)才是用户日常实际看到的入口，身份条那版够不到，所以额外补了这处。
  - 展开工作台的身份条里同时保留一份同文案徽标，两处样式一致(琥珀/暖红金色系，和密旨态强调色 `#E8A38C` 一致)。

## 取舍

- 没有改路由/后端逻辑，只做纯 UI 层诚实标注——密旨接入真实调度与否是产品决策，不在本任务范围内(见 request_analysis/spec.md 非目标)。
- 没有用弹窗/Modal 打断式提示，因为密旨本身还能提交(不是被禁用状态)，只是提交后不会产生真实分部门意见；用常驻小徽标而不是阻断式确认框，避免对一个"仍可点击、只是效果不同"的功能过度打断。
- 复用了密旨态已有的强调色 `#E8A38C`(SECRET 常量)，没有新引入调色，符合"不新发明一套视觉语言"的要求；但没有找到 office-kit 里可直接复用的现成小徽标组件(`SourcePlaque` 未导出，且尺寸对紧凑 dock 太大)，因此手写了一个更小尺寸的行内 badge，视觉语言(圆角 pill + 边框 + 半透明背景)与 `SourcePlaque` 一致。

## 验收标准核对(任务 3)

- "不 hover 也能看到状态标注"：已满足，见上方改动。
- "提交后任务详情里也要看到诚实标注"：核查后发现 `secretBriefToEdict()`(ShangshufangPage.tsx:2233)已经把 `coverage.realResponded/realExpected` 写进卷轴正文("直奏进度：0/1"、"当前结论：部分实司未应答，密报待补全"，subtitle 也带 "0/1 实司直奏 · 待补全")——这部分诚实标注在本轮改动前就存在，不需要重复实现，只需确认它没有被本轮改动破坏(未触碰该函数，行为不变)。

## Codex 停止前审查纠正(2026-07-11 第二轮)

Codex 停止前审查指出:"诚实降级未覆盖默认入口和提交后详情"。复核后发现两处真实缺口:

1. **默认入口未覆盖**：徽标原先只在 `isSecret` 为真(即用户已经点进密旨模式)时才渲染，页面首次加载、圣旨为默认选中态时完全看不到任何提示。已改为只要 `visibleModeOptions` 里存在密旨选项就常驻显示(`secretOptionVisible`)，文案随选中态微调("密旨为占位模式" ↔ "密旨 · 占位未接蜂群")，同时把原来在展开工作台"身份条"里重复的一份徽标删除，避免同一 `data-testid` 出现两次。
2. **提交后详情未真正覆盖**：`secretBriefToEdict()` 的诚实文案写进了 `rows` 数组，但 `MemorialScroll.tsx` 的首屏摘要卡(`圣旨来源`/`建议`)靠 `findFirstRow`/`buildEdictBriefModel` 精确匹配特定 label(如 `来源`、`建议`、`红线`)才会取用对应内容；`蜂群任务执行状态`/`风险摘录` 这类自定义 label 一个都对不上，导致 `buildEdictBriefModel` 返回 `null`，页面首屏摘要卡整体 fallback 成通用占位文案("来源待核"/"请先看圣旨来源，再由皇上选择准奏、驳回、会审或批示。")——诚实文案客观存在于数据里，但用户实际看到的是完全无关的通用文案。已在 `rows` 里补两行标准 label(`来源`、`建议`)承载诚实文案，让它真正显示在首屏摘要卡上。顺带发现并修正了 `runSecretDecree()` 里聊天气泡的 `reply` 文案，之前写"结论待补全"，读起来像"正在处理，稍后完成"，但 `jiqunSwarm.ok===false` 时这个 0/1 是恒定值，永远不会补全——一并改成"恒为占位值，不会随时间变化"。

用真实浏览器复核(未登录跳过 hover，页面加载即可见)：
- 默认(圣旨选中)状态下，无需任何交互即可在操作行看到"密旨为占位模式"。
- 切到密旨、提交后，首屏"圣旨来源"卡显示"兼容占位端点(未接入真实蜂群) · 兼容路径已登记，未执行实时蜂群"，"建议"卡显示"此功能当前不产生真实分部门意见，仅作登记；如需真实六部会审，请改用「下旨」"。
- 聊天气泡显示"密旨当前为兼容占位通道，不产生真实分部门意见（0/1 恒为占位值，不会随时间变化）"。
- 三处口径一致，`tsc --noEmit` 与 `test:node`(989/995，同一组 6 个既有失败，与本次无关)复跑均绿。

## Codex 停止前审查纠正(2026-07-11 第三轮)

Codex 停止前审查再次指出:"密旨详情仍错误声称真实蜂群已接令"。定位到三处，根因都是同一类错误——**把"jiqunSwarm 对象存在"当成"真实蜂群已接令"，没有检查 `jiqunSwarm.ok`**。兼容占位端点恒定返回一个 `ok:false` 但仍带假 `taskId`/`sessionId`/`status` 的 `jiqunSwarm` 对象，这三处判断只看对象是否存在，于是全部误判：

1. `secretBriefToEdict()` 的"蜂群任务执行状态"行：`result.jiqunSwarm ? '状态：后端蜂群已接令' : ...` 恒为真，占位路径也显示"已接令"。改为 `isPlaceholderStub` 时显式说"兼容占位端点已登记，未接令任何真实蜂群"。
2. 同函数"后端蜂群"行：`jiqun_ai 已启动会话/已启动任务/已接令` 只要有 taskId/sessionId 就显示，不看 `.ok`。改为 `isPlaceholderStub` 时显示"未启动任何真实会话/任务——此 ID 是兼容占位端点回显的占位标识"。
3. **最关键的一处（用户实际会看到的，不需要展开详情）**：`runSecretDecree()` 里，只要 `result.jiqunSwarm?.taskId || result.jiqunSwarm?.sessionId` 就调用 `trackJiqunRun()` 启动 SSE/轮询追踪并渲染浮动进度条("蜂群执行中 · 后端蜂群已接旨，正在调度…")——这个占位 taskId 根本不对应任何真实后端任务，SSE 连不上会降级轮询，轮询目标不存在但捕获异常"单次失败不终止"，于是这条假进度条会一直显示"执行中"直到 15 分钟(`POLL_MAX_MS`)超时。之前每一版浏览器截图里角落那条"○ 后端执行中 · 后端蜂群已接旨，正在调度…"横幅，就是这个——一直没意识到这也是一处独立的虚假声称。现在 `isPlaceholderStub` 时完全跳过 `trackJiqunRun` 调用，`jiqunProgress.status` 保持 `idle`，浮动进度条(`jiqunProgress.status !== 'idle'` 才渲染)不会出现。

用真实浏览器复核：提交密旨后，浮动"蜂群执行中"进度条不再出现；`document.body.innerText` 全文搜索确认不含"后端蜂群已接令"/"jiqun_ai 已启动"字样。`tsc --noEmit` 与 `test:node`(989/995，同一组既有失败)复跑均绿。

## Codex 停止前审查纠正(2026-07-11 第四轮)

Codex 停止前审查第四次指出:"占位密旨仍可能显示上一任务的蜂群进度条"。第三轮的修法(`isPlaceholderStub` 时跳过 `trackJiqunRun`)只堵住了"新起一次假追踪"，没堵住"清掉旧的真追踪"——如果用户之前提交过一次真实下旨(`圣旨`)，那次 `trackJiqunRun` 已经把 `jiqunProgress.status` 置为 `running` 且仍在真实轮询/SSE 中，这时候切到密旨提交一次占位请求，`jiqunProgress` 完全没被这次占位提交碰过，旧的"running"状态原样保留，浮动进度条("蜂群执行中 · 后端蜂群已接旨，正在调度…")继续显示——只是这条进度条其实来自上一个真实任务，跟这次占位密旨毫无关系，但时间上紧跟在密旨提交之后出现，用户完全没法分辨，等于变相把"上一任务的真实进度"误当成"这次密旨的进度"展示出来。

修复：`runSecretDecree()` 里 `isPlaceholderStub` 分支现在显式调用 `activeJiqunReturnRef.current = null` + `resetJiqunRun()`，强制清空任何遗留追踪状态（关闭 SSE/轮询定时器，`jiqunProgress` 打回 `idle`），保证提交一次占位密旨之后画面上确定性地不出现任何蜂群进度条，不管之前有没有残留的真实任务追踪。取舍：如果那个真实下旨任务在后端仍在跑，前端会失去对它的实时追踪显示（相当于此前"闭环追踪"退化回旧版"拿到 taskId 后即失明"）——但两权相较，展示一条确定归属不明、可能被误读为密旨结果的进度条，比暂时失去一次真实任务的前端可视化更容易误导用户，选择后者。真实任务本身仍在后端正常执行，只是这次前端不再实时跟踪显示，用户仍可通过军机处或刷新页面另行确认状态。

用真实浏览器复现 Codex 描述的确切场景验证：① 提交一次真实下旨(圣旨)，确认蜂群执行中的编排详情正常显示（案号/Trace 齐全）；② 不等它结束，切到密旨提交一次占位请求；③ 确认提交后画面上没有任何浮动"蜂群执行中"进度条，`document.body.innerText` 全文搜索 `蜂群执行中`/`后端蜂群已接旨，正在调度` 均为 0 命中。`tsc --noEmit` 与 `test:node`(989/995，同一组既有失败)复跑均绿。

## Codex 停止前审查纠正(2026-07-11 第五轮)

Codex 停止前审查第五次指出:"`resetJiqunRun()` 无法保证旧进度不会回写"。复核 `useJiqunRunProgress.ts` 发现这是真实存在的竞态，不是文案/展示层问题，而是 hook 内部的异步时序 bug：

`startPolling`/`startSessionPolling` 用 `window.setInterval(async () => {...})` 起轮询；`cleanup()`(被 `reset()`/`track()` 调用)只是 `clearInterval`，**无法撤回一个已经在 `await jiqunFetcher(...)` 中的 tick**。时序：某次轮询 tick 触发 → 发出 fetch → 在它 `await` 期间用户提交占位密旨 → `resetJiqunRun()` 执行，`clearInterval` 清掉定时器、`setProgress(IDLE)` 把状态打回空 → 但那个还在 await 的 tick 稍后 resolve，继续往下执行 `if (s.status==='done') { ...; setProgress(...) }`，把已经清空的 `IDLE` 状态用一份陈旧的"真实任务进度"覆盖回去——`reset()` 清得干净，但清不掉"过去已经出发、还没落地"的异步回调，这正是 Codex 指出的点。

修复：给 hook 加一个单调递增的 `epochRef`。`track()`/`reset()` 都令其自增；每个轮询 tick 在真正调用 `setProgress` 前，都要核对自己创建时捕获的 `epoch` 快照是否仍等于当前 `epochRef.current`——tick 开始时查一次(避免陈旧定时器完全没必要地发起新请求)，`await` 结束后再查一次(防止请求发出后、resolve 前这段时间发生了 reset/新 track)，两次任一不匹配就整体丢弃这次写入，不调用 `setProgress`。SSE 的 `onmessage`/`onerror` 同样在处理消息前核对 epoch。这样无论异步回调在什么时刻落地，只要期间发生过 `reset()` 或新的 `track()`，它的结果都保证不会被写回 `progress` 状态——不是"尽量不写回"，是结构上不可能写回。

验证：`tsc --noEmit` 绿；`test:node` 989/995(同一组既有失败，此 hook 目前没有独立的竞态回归测试——仓库没有 `@testing-library/react`/`renderHook` 这类 React hook 测试基础设施，为这一处竞态单独引入测试框架超出本次修复范围，如实记录这个测试覆盖缺口，不假装已经补上)；真实浏览器复现：提交真实下旨后等待超过一个轮询周期(>5s)，再切密旨提交占位请求，之后再等待一个轮询周期，确认浮动进度条全程未重新出现，`document.body.innerText` 全文搜索仍为 0 命中。

## 验证

- `pnpm exec tsc --noEmit`：绿(无新增类型错误；`normalizeSourceLabel`/`ParchmentDialogMessage` 未使用告警为改动前既有，非本次引入，已用 `git stash` 核实)。
- `pnpm test:node`：995 条测试，989 通过 / 6 失败，失败项为改动前既有且与本文件无关(BFF 写隔离/`dispatchDeptToSwarm` 鉴权守门/学习持久化解耦/e2e 后门安全，均不涉及 shangshufang)。
- 真实浏览器验证(playwright-cli,登录态 `验证用户0711`)：
  - 紧凑 dock 默认(圣旨选中)状态下即可见"密旨为占位模式"徽标，无需切换或 hover。
  - 切到密旨提交后：首屏"圣旨来源"/"建议"卡、聊天气泡、均显示占位诚实文案；浮动"蜂群执行中"进度条不再出现；全文文本搜索确认无"已接令"/"已启动"残留声称。
  - 切回"圣旨"，徽标消失，确认条件渲染正确。
  - 截图留档后已清理(未纳入仓库)。
- 未完成：任务 2(下旨提交→终态 E2E)、任务 4(契约漂移脚本)。

## 任务 1 验证

- `pnpm exec tsc --noEmit`：绿。
- `pnpm exec playwright test e2e/invite-enter-register-smoke.spec.ts`：**9/9 全绿**(初次修复后 8/8；Codex 指出覆盖缺口后新增"无请求发出"网络层断言 + "有效邀请码走 UI 真实注册成功"正向用例，共 9 条)。
- `pnpm test:node`：995 条测试，989 通过 / 6 失败，同一组既有失败，与 `enter/page.tsx`、`register/page.tsx` 无关。
- 已重新拉起手动 dev server(`BASE_PATH=/chaotang`，供后续人工验证)，与 e2e 自己的隔离 `webServer`(`.next-e2e`，无 basePath)不冲突——每次跑这套 e2e 前需要先停手动 server 腾出 3002 端口，跑完再重新拉起，本轮两次都是这样操作的。
