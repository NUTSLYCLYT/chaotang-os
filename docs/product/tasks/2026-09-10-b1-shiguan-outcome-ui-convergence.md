# 任务：B1 史馆结果账接收与五项修复

## Status
Ready

批准包待Owner确认；未创建批准提交、未获机器GO、未实施。

## Product Definition
用户已确认执行顺序和五项修复目标；此卡仅请求具体范围与摘要确认。目标用户为史馆结果登记者。接收ct-run已保全Outcome前端实现，修复初始读取、切档锁死、错误恢复、更正、分页。不得更改ADR0028、后端身份/事件语义、其他产品族、CI或authority。

## Acceptance Criteria
- [ ] 已有事件的初始选中档案无需再次点击即加载；加载中、空、失败分别呈现。
- [ ] 提交A->切B->回A，不永久loading；迟到回执不串档，响应未知重试保持同一键和载荷。
- [ ] 422拒绝允许修改后生成新键；网络不确定保留冻结请求；409不假称唯一原因是幂等冲突。时间提示从后端ADOPTED时间窗口而非归档时间解释。
- [ ] 选择有效事件头可生成绑定supersedesEventId的CORRECTED；保留历史，旧头分叉被拒绝且可恢复。
- [ ] 101条及以上可分页读取，无重复遗漏；当前页数量不冒充总量。
- [ ] 后端既有身份隔离、事务重验、幂等与不可变约束回归通过。
- [ ] 最终候选实际浏览器逐项操作通过，保存候选SHA、步骤、预期/实际、截图、脱敏请求与控制台结果。不能以源码正则断言代替浏览器验收。
- [ ] 独立Reviewer检查最终diff与证据；未关闭P1/P2不得接收。

## Delivery Constraints
技能：codex-engineering-workflow、using-git-worktrees。Codex-only：是（此实施批次不启动Claude CLI）。采用隔离现场，保留原39文件工作区。跨模块前端行为变更，Selected route: Superpowers；执行证据闭环，不引入第三方项目文件。范围扩大或后端语义需改时重新定义批次。

## Affected Modules

- 模块：史馆Outcome前端、BFF与后端客户端。
- 允许路径：
  - `frontend/src/app/api/shiguan/archives/[id]/outcomes/route.test.ts`
  - `frontend/src/app/api/shiguan/archives/[id]/outcomes/route.ts`
  - `frontend/src/app/api/shiguan/outcomes/route.test.ts`
  - `frontend/src/app/api/shiguan/outcomes/route.ts`
  - `frontend/src/app/shiguan/ShiguanClient.tsx`
  - `frontend/src/app/shiguan/shiguanController.test.ts`
  - `frontend/src/app/shiguan/shiguanController.ts`
  - `frontend/src/app/shiguan/shiguanPayload.test.ts`
  - `frontend/src/app/shiguan/shiguanPayload.ts`
  - `frontend/src/features/shiguan-visual/ShiguanOutcomePanel.test.ts`
  - `frontend/src/features/shiguan-visual/ShiguanOutcomePanel.tsx`
  - `frontend/src/features/shiguan-visual/ShiguanWorkspace.test.ts`
  - `frontend/src/features/shiguan-visual/ShiguanWorkspace.tsx`
  - `frontend/src/lib/backendClient.shiguanOutcome.test.ts`
  - `frontend/src/lib/backendClient.ts`

允许路径以同提交approval manifest的productPaths为唯一清单。backendClient.ts只允许Outcome接入，不接收其他产品族差异。下列来源哈希固定本批已有实现；未列源文件的允许路径是将新增/修改的测试，不代表缺文件可跳过。

- `frontend/src/app/api/shiguan/archives/[id]/outcomes/route.test.ts` SHA256 `43e280686560d4744f28132489ff3a107c61e6288b544b5c11440fd7761db9e4`
- `frontend/src/app/api/shiguan/archives/[id]/outcomes/route.ts` SHA256 `11756efede4cd907efb8ec48eb5c36d0e1cb81c4f08eade478d3bf2d360a6f40`
- `frontend/src/app/api/shiguan/outcomes/route.test.ts` SHA256 `f7a085de16170d4e22c6daaf96334f3fba3f5ceee0eff444151fe18a83860ad3`
- `frontend/src/app/api/shiguan/outcomes/route.ts` SHA256 `a93353ba2079292bd93620454e08b3aa9f744a00b626402c04d66d8dedc6157e`
- `frontend/src/app/shiguan/ShiguanClient.tsx` SHA256 `df3c371662e1b9af0fa8982da26a55c53b3e198d3456e9854e42ed34df449927`
- `frontend/src/app/shiguan/shiguanController.ts` SHA256 `6c38e449e384fc48dd3340d40495b3c2d6a1c48bf4aac38b4c1ea5978a438ceb`
- `frontend/src/app/shiguan/shiguanPayload.ts` SHA256 `272989402cf670607a98c0383592818a709639f8dfa0dfbcc0406d536b95902a`
- `frontend/src/features/shiguan-visual/ShiguanOutcomePanel.test.ts` SHA256 `3905f113349a7a216cac1fdd4b3e219565ff3f1ee81526362ddb9983173bdfc4`
- `frontend/src/features/shiguan-visual/ShiguanOutcomePanel.tsx` SHA256 `5c3c053429b13288b464ca5d44febba3a06d5d2c8c9bba5db5c818f5ed5901a6`
- `frontend/src/features/shiguan-visual/ShiguanWorkspace.tsx` SHA256 `b4a014c40bf9c153bf2645e5f4e7be4707fe821a740f33f3108ef58574e8421f`
- `frontend/src/lib/backendClient.shiguanOutcome.test.ts` SHA256 `86e40c49ed9fecd128a78204fe473f4c5acdb832fb0bbbaa30d9d93215c11ad1`
- `frontend/src/lib/backendClient.ts` SHA256 `e657e271a4f1103634f7d7e5a89d8ce724b0a7d88669ac653cca861f720de5b4`

## Technical Plan
先基于c825创建干净隔离批准现场，approval仅包含manifest和本卡。Owner确认exact digest和批准提交的Git动作后，以独立提交落到ext-dev；origin应使用已验证HTTPS身份，真实authorize连续核验通过后才导入与修复。此任务不接受P4旧批准。

实施先引入冻结Outcome实现，建立五项失败行为回归，再最小修复。读取和写入状态分离；当前档案切换不得抹掉未知提交身份；更正与分页沿用后端契约。完整npm test/lint/typecheck/build及backend-outcome矩阵必须在同一最终候选通过。

Setup：隔离现场frontend按锁文件npm ci；backend建立独立.venv，依赖按backend/AGENTS.md安装，不借用生产数据。构建/tsc增量缓存必须处于gitignore覆盖内。浏览器使用隔离合成数据与测试账户，禁止真实模型/外部副作用；既有check_outcome.mjs仅烟雾脚本，不够证明五项修复。浏览器验收由审查者通过浏览器工具执行，作为候选第二次确认的必需证据，不伪称已纳入机器矩阵自动检查。

## Implementation Report
未实施。已有历史35前端/16后端测试和两个controller反例只作基线，不算最终候选证据。

## Acceptance Review
Pending。需要机器候选验证、浏览器五项证据及独立审查。最终candidate SHA/tree必须另行确认，未授权部署。


## 浏览器验收记录契约（强制人工门）

### 环境与数据

在隔离候选工作区构建实际Next应用，连接单独启动、仅绑定127.0.0.1的FastAPI实例。数据库、成果目录和合成附件必须位于新建临时目录；不得引用ct-run正在使用的数据或账号。先从backend/tests/test_shiguan_api.py及test_shiguan_storage.py的Outcome fixture复用构造方法，通过现有认证与storage API建立专用合成用户owner-A和owner-B，密码随机且仅保存在临时环境，不写入证据。准备A1/A2两个owner-A的REPLY、一个owner-B的REPLY；A1/A2均有合法采纳裁决与合法合成证据，事件发生时间设为采纳时间后、当前时间前。A1预置101条事件，A2预置1条。额外准备未采纳及缺证据档案用于资格拒绝。构造脚本仅写临时环境，记录完整脚本和sha256，以便Reviewer复算；禁止虚构采纳或证据字段绕过后端校验。

浏览器使用全新context，经实际登录表单登录owner-A。每个案例重建fixture或记录其明确初始状态；101条验证案例从原始fixture开始。故障注入仅拦截当前测试浏览器的指定请求：可控延迟或丢弃回执，禁止修改生产服务；故障注入方法与命中请求一起记录。实际写入与读取均走候选BFF和真实隔离后端，不能用全mock响应冒充跨层验证。

### 固定案例

| 编号 | 操作 | 必须断言 |
|---|---|---|
| B1-01 | 登录后直接进入史馆，首选A1，不额外点击档案 | 发出A1结果读取请求；至少显示已加载事件；不先把未加载状态称为共0条；刷新后结果一致 |
| B1-02 | 延迟A1提交回执，切A2再切A1，然后释放回执；再分别重复失败与服务端写成功但回执丢失场景 | 不永久loading、不串档；可恢复；结果未知重试键与载荷不变，后端事件数只增加1 |
| B1-03 | 提交早于采纳时间的结果，收到422后修改；另测未采纳/缺证据409与网络未知 | 422后可编辑并用新键成功；409文案不误指唯一原因为幂等冲突；网络重试保持原键/载荷；恢复后可再次操作 |
| B1-04 | 对合法事件头执行更正，再尝试更正已被替代的旧头 | 新事件为CORRECTED且supersedesEventId正确；原事件仍在；旧头拒绝后用户可恢复；刷新后链一致 |
| B1-05 | 从A1的101条初始事件开始逐页读取，再切A2并返回 | 101个唯一ID全部可读，无重复遗漏和串档；有剩余页时不显示为全量；无下一页时结束 |

每个案例检查360px与桌面视口关键控件可操作；至少一项跨owner读写验证保留实际404回执。人工结论不能覆盖自动矩阵失败。

### 证据目录与绑定

唯一交付入口：/home/ubuntu/ct-p4/b1-evidence/<完整candidate-SHA>/INDEX.json。INDEX记录candidate SHA/tree、approval SHA、任务ID、开始/结束时间、源码是否干净、服务启动命令（凭据与token替换为REDACTED）、工具版本、fixture脚本sha256、全部证据文件sha256及每例PASS/FAIL/BLOCKED。

每例文件命名：<candidate-SHA>-B1-01.steps.md、<candidate-SHA>-B1-01-desktop.png、<candidate-SHA>-B1-01-mobile.png、<candidate-SHA>-B1-01-network.json、<candidate-SHA>-B1-01-console.txt；其余案例替换编号。steps逐步记录操作、预期与实际；network仅保留方法、相对路径、状态码、必要合成请求字段和响应结果，不保存cookie、Authorization、密码或完整HAR。重试键可用一致性哈希记录。fixture-script及启动记录放同目录，随机密码从记录中剔除。

最终人工验收前后核对HEAD、tree和git status；任何源码变化使证据失效，必须在新candidate目录重跑受影响验证。独立Reviewer从INDEX入口核对五例、fixture、截图、网络及控制台，与最终diff一起形成REVIEW.md，列出未验证项和未关闭问题。Owner第二次候选确认必须同时得到这个入口；缺任一必需证据时保持Pending，即使机器verify-candidate通过也不能主线接收。临时测试数据验收后按明确临时路径清理，证据保留。
