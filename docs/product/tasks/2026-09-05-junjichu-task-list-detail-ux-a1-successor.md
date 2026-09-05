# 军机处任务列表与详情体验纠偏 A1

任务 ID：`JUNJICHU-TASK-LIST-DETAIL-UX-A1-SUCCESSOR-20260905`

## Status

Draft

DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION。当前仅审阅目录中的治理候选，未物化 .harness/approvals，未创建治理提交，未获得本任务 machine GO，未实施产品。proposed JSON 的 state=APPROVED_FOR_ONE_CHILD 是现有 schema 规定的未来消费字段，不表示 Owner 已批准本包；正式路径、独立提交、Owner 对 digest 的确认及机器授权均缺一不可。

## Product Definition

Owner 于2026-09-05要求按《工作台比较与吸收清单》先准备独立A1治理候选，保留V2及近期主线，不覆盖目录、不迁入cdesktop运行时、不打断铭硕。该最新范围替代原“按钮与任务详情”exact14设计；虽然本包亦为14路径，但原8 MODIFY+6 ADD身份不继承，本包为9 MODIFY+5 ADD。

目标用户：在既有军机处场景看板查看、跟进业务的人员。首屏明确任务目标、当前记录阶段、阻塞、现有结果和下一步；精准打开正确任务并保留筛选与登录回跳。不是全量ScenePack纠偏，也不是铭硕业务闭环已经完成。

基线：`20594bbef826996314241c2b03005124ced7ee21` / tree `ace83b6ceba0338b7d3ad739e47f7f308903fb0d`。本轮实时远端已核验为该版本，冻结前再次核验；漂移停止，不re-anchor。

铭硕已正常收口：此基线是427c9c5cbcb5b33bb75e45d082348a9f17e865d2的直接单亲产品子提交，只有4 ADD，machine verify PASS后普通快进。其bundle sha256:ed6bfea2667a081be036b91cf1b9438075138b6ef03ef4793ba1de7053710462保持不变。铭硕authority已随产品落地完成其生命周期，不可用于A1。

输入资料：/tmp/chaotang-workbench-absorption-candidate-20260905.md；raw SHA-256 sha256:f52321b9426a404d7fbe135e65d146d42ad387a7d6f1cb301bb79414b5b7daba。历史427c9c5只是该报告观察基线，不回退。cdesktop仅提供交互思路，本候选不读取其凭据、不复制其组件代码、不引入依赖或运行时。既有V2及近期能力以当前主线为准。

已核实代码：ScenePack POST保存SceneRun和BoardMission，API返回missionId；看板用鉴权列表关联runId读取详情，后端同时约束owner与tenant。missionId、runId、jobId、caseId不互换。列表无分页total；现有任务标题可复用。当前详情会混入旧run、错误被吞；登录next白名单不支持看板深链接。当前SceneMission无合法取消接口或cancelled状态。

## Acceptance Criteria

- [ ] A1-01 精准导航：原“保存到军机处”仅改为“查看这份结果的任务”，携带合法result.missionId；无结果、正在生成、结果slug或demo与当前场景不符、标识非法时禁用。链接只查看已有结果，不声称最新输入已保存；仅必要导航守卫，不重写生成链。
- [ ] A1-02 身份闭合：显式mission从现有鉴权完整列表精确定位，重复ID、缺失、无权或runId/missionId/packSlug不一致均不展示详情，不回退第一项。成功刷新按ID使用新对象，不保留旧对象。无显式mission默认列表视图，用户选择后打开详情。
- [ ] A1-03 URL与登录：仅固定 /junjichu/scene-board 和可选唯一mission、filter、panel参数；mission为1–128位[A-Za-z0-9_-]，filter只允许all/awaiting/high/done，panel只允许list/detail。拒绝重复、额外、空值、畸形编码、片段、协议相对/外部URL及非规范路径。页面和登录使用同一纯解析/构造器，禁止类型断言或localStorage绕过登录白名单。保持原四个登录目的地兼容；无效登录next安全回/dadian，不改认证本身。
- [ ] A1-04 列表与详情：桌面分栏，窄屏列表→详情→返回；返回保留合法筛选和选择。panel=detail但无mission时拒绝该导航组合；panel=list携带合法mission时保留选择但不显示详情。省略panel时，有mission规范为detail，无mission规范为list；页面/刷新/返回/登录使用相同规范。显式任务被当前筛选排除时明确提示并允许恢复筛选，不偷偷换任务。计数只表述已加载N项/当前筛选M项；待补齐和高风险可重叠，不相加当全量。
- [ ] A1-05 请求一致性：列表、详情、PATCH分别有代次/身份约束；旧成功/失败/finally不能覆盖新上下文。切换时立即隐藏旧详情；退出、会话失效和401不得残留其他身份旧数据。同事件循环重复点击只发一个PATCH。取消过时GET不等于取消业务。
- [ ] A1-06 失败关闭：缺字段、错误类型、非法标识、身份错配拒绝；仅使用脱敏稳定错误。加载/空/读取失败/不可查看/更新中/更新失败分别呈现。GET允许用户重读；POST和PATCH不得自动重放，超时或响应丢失时提示结果未确认并只读刷新。PATCH成功前不乐观改成新阶段。
- [ ] A1-07 内容与动作：成功详情使用经过校验的非空mission.title；缺失、非字符串或空白title是契约错误，不臆造业务名。通用“场景任务”仅用于加载/不可查看状态，不用它放宽成功响应校验。SceneRun.status与人工mission.stage分开标注；看板done不代表正式业务验收、下旨、报价批准或史馆归档。保留现有阶段PATCH语义，按钮写清“标记看板阶段”；blocked不改riskGrade，不称已判定高风险。次级阶段操作折叠，避免多个同等主行动。
- [ ] A1-08 不发明能力：首屏只显示现有摘要和证据，技术ID默认折叠，不展示原始含敏感字段JSON；无下载/有效期/取消合同就不造按钮。dueAt仅是任务提示日期，不作为证据、权限或产物有效期。demo标记来自run响应；demo=false不表示独立核验。证据只显示既有文本，不把sourceLabel拼接外链。
- [ ] A1-09 视觉保全：CSS只追加/修改boardWorkspace限定的看板样式；不改变strategyPanel、大殿、共享Workspace外观、全局字体/素材。窄屏不遮挡内容，键盘可达、焦点可见、选中/错误不只靠颜色。现有V2画面与近期增量保留。
- [ ] A1-10 证明：真实RED针对上述旧行为；精准/受影响/类型/lint/build/根门禁通过；真实本地浏览器桌面与360px验证通过；独立Governance、TypeScript、Security无未关闭P0–P2。只读设计审查和源码守卫不替代页面或业务验证。

## Delivery Constraints

- 本轮仅准备治理候选；产品修改、测试执行、安装、模型/外网使用、真实账号/材料、commit/push/deploy不由本包文本授予。未来每个权限阶段独立批准并匹配machine authority。
- 技能计划：codex-engineering-workflow + product-manager-ai-workflow；复杂安全接线采用Codex原生等价规划/TDD/独立Review，不安装缺失第三方skill。Codex-only：是。
- 未来只允许下述14条产品路径，9 MODIFY+5 ADD，全部100644。现有认证helper只调整精确看板返回路径；不得放宽会话、owner、tenant、cookie或后端权限。
- 不修改backend、BFF、types、schema、数据库、ADR、Harness、authority、MFP4文件、CapabilityRegistry、大殿、全局CSS或依赖锁文件。若实际需第15条路径，STOP并独立纠偏。
- 不迁移Rust服务、终端、工作区数据库、工程approvalsApi、executionProcessId、Git写入、密钥或整个目录。没有复制代码，不以本报告声称已做许可证审计。
- 现有ScenePack评分/完成映射及SceneWorkspace生成/样例/证据全部状态纠偏是后继，保留问题清单，不以A1完成消除它们。

## Affected Modules

- 模块：军机处场景任务列表/详情、精准入口导航、受限登录回跳。
- 允许路径：下表精确14条；当前草案不是实施授权。
- 依赖模块：现有同源scene GET/PATCH、后端owner/tenant鉴权与列表/run关联，均只读复用。不新增任务事实源。

| 操作 | 路径 |
| --- | --- |
| MODIFY | `frontend/src/app/junjichu/scene-board/page.tsx` |
| MODIFY | `frontend/src/features/pre-auth/formValidation.test.ts` |
| MODIFY | `frontend/src/features/pre-auth/formValidation.ts` |
| MODIFY | `frontend/src/features/scene-packs/SceneBoard.tsx` |
| MODIFY | `frontend/src/features/scene-packs/ScenePackWorkspace.tsx` |
| MODIFY | `frontend/src/features/scene-packs/client.ts` |
| MODIFY | `frontend/src/features/scene-packs/scenePacks.module.css` |
| MODIFY | `frontend/src/lib/requireUser.test.ts` |
| MODIFY | `frontend/src/lib/requireUser.ts` |
| ADD | `frontend/src/features/scene-packs/SceneBoard.test.ts` |
| ADD | `frontend/src/features/scene-packs/ScenePackWorkspace.test.ts` |
| ADD | `frontend/src/features/scene-packs/client.test.ts` |
| ADD | `frontend/src/features/scene-packs/sceneBoardController.test.ts` |
| ADD | `frontend/src/features/scene-packs/sceneBoardController.ts` |

未来approvalCommitPaths（仅3条）：
- `.harness/approvals/JUNJICHU-TASK-LIST-DETAIL-UX-A1-SUCCESSOR-20260905.json`
- `docs/product/tasks/2026-09-05-junjichu-task-list-detail-ux-a1-successor.md`
- `docs/superpowers/plans/2026-09-05-junjichu-task-list-detail-ux-a1-successor.md`

proposed临时JSON在独立审阅目录，未来物化正式approval时保持JSON字节并重新计算正式三文件bundle；proposed路径不得进入提交。当前三份草案为本Task、对应Plan和proposed JSON。

## Technical Plan

1. 先确认铭硕正常收口及当前base/tree，再仅冻结本包三草案的strict JSON/schema/closed-contract、路径、模式、raw/canonical/bundle及独立审查。本轮到此停止。
2. Owner精确批准canonical及正式三文件后，按独立Git许可形成approval直接单亲提交、普通快进；一次本任务machine authorize GO后才从该approval创建唯一干净候选。旧A/exact14或铭硕身份不继承。
3. 在已有测试入口建立可复现失败：纯控制器注入deferred请求和fetch，不访问网络；必要源码守卫只证明接线，页面旧行为另存真实浏览器证据，不伪造RED。旧行为函数必须从绑定基线实际加载/提取，记录路径、行号、原始字节和失败断言；手写复刻的错误函数不算真实RED。控制器无React/服务端cookie/后端配置导入，注入I/O，供页面和认证模块安全复用纯URL部分。每个页面实例独立创建控制器，模块顶层不保存任务、请求代次、PATCH状态或会话数据；认证模块只调用无状态URL导出，必须有双实例互不污染测试。
4. 顺序实现URL/身份→列表详情生命周期→PATCH反馈→精准入口→看板局部CSS；一个字节写入者。使用现有client导出保持调用签名兼容，只纠正看板GET/PATCH及可选测试注入，不重构runScenePack生成逻辑。
5. 每轮完整验收：proposed manifest中14命令 + 下方B01–B08真实浏览器步骤 + 路径/模式/字节审计。遵守现有工程规范同一最终字节连续10轮完整成功；独立三审在最终字节上进行，任一失败先停，不放宽或拆成只重跑单项。未授权真实环境或工具不具备时标记未验证，不以mock替代。
6. frozen candidate manifest、RED/GREEN、十轮证据、浏览器网络/截图/控制台和审查绑定同一bundle。machine verify只检查其显式矩阵，PASS不替代外部浏览器证据或Owner对Git动作的批准。

验证矩阵（未来执行，本轮未运行）：

| id | cwd | 命令 | timeoutMs |
| --- | --- | --- | --- |
| backend-scene-contract | `backend` | `node --input-type=module --eval "import{spawnSync}from'node:child_process';const r=spawnSync('/usr/bin/python3',['-m','pytest','-q','tests/test_scene_pack_api.py'],{stdio:'inherit',env:{...process.env,TMPDIR:'/tmp',TEMP:'/tmp',TMP:'/tmp',PYTHONDONTWRITEBYTECODE:'1'}});if(r.error||r.signal)process.exit(1);process.exit(r.status??1)"` | 300000 |
| diff-check | `.` | `node --input-type=module --eval "import{execFileSync}from'node:child_process';execFileSync('/usr/bin/git',['diff','--check'],{stdio:'inherit'});execFileSync('/usr/bin/git',['diff','--check','HEAD^','HEAD'],{stdio:'inherit'})"` | 180000 |
| frontend-build | `frontend` | `npm run build` | 300000 |
| frontend-focused | `frontend` | `node --test src/features/pre-auth/formValidation.test.ts src/features/scene-packs/SceneBoard.test.ts src/features/scene-packs/ScenePackWorkspace.test.ts src/features/scene-packs/client.test.ts src/features/scene-packs/sceneBoardController.test.ts src/lib/requireUser.test.ts` | 300000 |
| frontend-lint | `frontend` | `npm run lint` | 300000 |
| frontend-tests | `frontend` | `npm test` | 300000 |
| frontend-typecheck | `frontend` | `npm run typecheck` | 300000 |
| product-authority-regression | `.` | `node --input-type=module --eval "import{spawnSync}from'node:child_process';const r=spawnSync(process.execPath,['--test','scripts/product-authority.test.mjs'],{stdio:'inherit',env:{...process.env,TMPDIR:'/tmp'}});if(r.error||r.signal)process.exit(1);process.exit(r.status??1)"` | 180000 |
| root-doctor | `.` | `node scripts/harness-doctor.mjs --check` | 180000 |
| root-harness | `.` | `node scripts/check_harness.mjs` | 180000 |
| root-hook-self-test | `.` | `node .agents/hooks/check-harness.mjs --self-test` | 180000 |
| root-self-test | `.` | `node scripts/check_harness.mjs --self-test` | 180000 |
| v2-check | `.` | `node scripts/ext-full-value-convergence.mjs --check` | 180000 |
| v2-tests | `.` | `node --test scripts/ext-full-value-convergence.test.mjs` | 180000 |

构建与测试仅用本地隔离数据和进程级POSIX临时环境；不持久修改配置、不自动安装依赖。构建生成物须为既有忽略输出，不得产生额外受跟踪修改；否则STOP。backend-full不是本前端包冻结矩阵项，不伪报它通过；全项目RC需后续独立完整后端矩阵。测试环境先证明既有依赖可用，环境失败不得变成跳过。

真实浏览器必验（现有Playwright工具可用，但未安装仓库依赖、未运行本包页面；工具能力不等于验收通过）：
- B01 授权本地合成账号/隔离数据库；从既有场景生成结果，按钮只导航准确mission，核对实际GET、详情ID和无额外POST。
- B02 桌面列表/详情、筛选、已加载计数；360px列表→详情→返回，筛选与选择一致。
- B03 刷新、前进后退、重新进入、登录失效再登录；合法next精确保留，非法/重复/外部目的地拒绝。
- B04 同用户跨tenant及另一owner不可读取任务；不存在/无权统一不可查看，不能闪现旧详情。复用既有本地测试账号能力，不访问真实客户账号。
- B05 切换任务、手动刷新、乱序响应、404/401/503；详情和标题始终同属一任务，错误稳定不泄露。
- B06 阶段PATCH双击、失败、响应丢失和迟到；最多一次在途，不自动重发，不把请求完成当业务验收。故障注入另外标为合成证据，不冒充真实正常链。
- B07 长标题/证据、键盘焦点、窄屏不溢出不遮挡；大殿及现有Workspace共享视觉无回退。
- B08 示例标签、无取消/下载假入口、done与业务验收区分；记录当前代码尚未解决的评分和生成链问题。

## Implementation Report

本轮仅审阅目录中编制三文件草案，未新增工作区、未改产品、未物化正式approval、未运行本任务authority或产品测试。铭硕在独立已获授权条件链完成candidate 20594bbef826996314241c2b03005124ced7ee21、机器PASS及快进；不是本任务实施证据。

只读源码审查确认A1路径必要性；原登录回跳范围P2已纳入requireUser/formValidation及测试，局部CSS避免窄屏只堆叠。未来实现若不能满足安全语义必须STOP，而不是把边界要求降为文案。

## Acceptance Review

Pending / GOVERNANCE_DRAFT_ONLY。产品验证、真实业务验收与生产资格均未授予。

未来三审分别检查：Governance（新身份/范围/权限/不继承）；TypeScript（异步竞争、请求幂等边界、URL/契约、可测试性、响应适配兼容）；Security（open redirect、跨owner/tenant、旧数据泄露、更新误投、错误脱敏和不得外发）。本草案review结论与产品review结论分开保存。

退出与回滚：完成A1仅意味着准确查看和跟进现有场景任务，不意味着诊断可信或铭硕交付完成。未提交产品可在独立批准下停止使用并保留证据，不自动清理。若A1以后落地，另获精确许可创建仅逆转A1前端字节的forward-only回退提交；不回退铭硕、不重写历史、不撤销用户已合法保存的阶段、不改数据库。当前未承诺回滚已实际演练。

STOP：远端/字节/approval身份漂移、machine STOP、任一关键验证失败、三审P0–P2、15路径、共享视觉影响不可控、需backend/权限/状态/schema迁移或无法证明身份/恢复边界。后续B诊断可信度、C真实铭硕交付、D评测复用、E执行器试点均独立授权，不能继承本包。
