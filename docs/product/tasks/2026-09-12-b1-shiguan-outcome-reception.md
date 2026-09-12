# 任务：B1 史馆结果账在 SCENE 主线后的接收

任务 ID：`B1-SHIGUAN-OUTCOME-RECEPTION-20260912`

## Status

Ready

Owner 已于2026-09-12明确批准本任务及摘要 sha256:7e07f590f5afc923353c349e64958519e4e0e3d4e7a6e371761ab547b7a97f03，并授权两文件独立批准提交在远端仍为c9fb067331bf5dcb47d31d0b23b00b6f7be4b2ae时正常创建、快进推送。以下“草案/尚未实施”等段落保留准备阶段事实，不撤销本次批准；Ready与聊天批准不代替新task实际机器GO，取得GO后才实施产品。

## Product Definition

目标用户为史馆结果登记者。保留既定五项用户结果：首次读取、切档及迟到响应隔离、失败重试语义、更正链、完整分页。在已接收 SCENE 的唯一主线 ext-dev 上接收旧 B1 的十五文件实现并完成组合候选验收，不丢失本轮五场景输入/事务/S4改动。

新基础 `c9fb067331bf5dcb47d31d0b23b00b6f7be4b2ae` / tree `6d29e716e7db52bb344679a4f9c6e42f356a142d`，来源候选 `c096d7db86e10dea73f027cab07473f3c2f05c57` / tree `f7ad25de57fa85002a55941ea2ade79e010067c4`，来源唯一父 `aa869db1ab0dc99ac2e707ce00f17fce65edc90e`。旧候选仅为代码来源及历史证据，不继承旧authority、候选身份或验收。

## Acceptance Criteria
- [ ] 已有事件的初始选中档案无需再次点击即加载；加载中、空、失败分别呈现。
- [ ] 提交A->切B->回A，不永久loading；迟到回执不串档，响应未知重试保持同一键和载荷。
- [ ] 422拒绝允许修改后生成新键；网络不确定保留冻结请求；409不假称唯一原因是幂等冲突。时间提示从后端ADOPTED时间窗口而非归档时间解释。
- [ ] 选择有效事件头可生成绑定supersedesEventId的CORRECTED；保留历史，旧头分叉被拒绝且可恢复。
- [ ] 101条及以上可分页读取，无重复遗漏；当前页数量不冒充总量。
- [ ] 后端既有身份隔离、事务重验、幂等与不可变约束回归通过。
- [ ] 最终候选实际浏览器逐项操作通过，保存候选SHA、步骤、预期/实际、截图、脱敏请求与控制台结果。不能以源码正则断言代替浏览器验收。
- [ ] 独立Reviewer检查最终diff与证据；未关闭P1/P2不得接收。


- [ ] 当前主线的 SCENE 输入、事务、S4 与前端恢复行为回归通过，十五个B1路径之外无产品改动。
- [ ] 新候选为本次独立批准提交的精确单亲子，八项机器矩阵通过；新的实际浏览器证据绑定新候选SHA/tree，独立Reviewer无未关闭P1/P2。
- [ ] 原强制证据入口 INDEX/REVIEW 完整并可由Reviewer核对；未经合法恢复，不重试此前被拒归档动作、不改入口规避。

## Delivery Constraints

沿用项目 codex-engineering-workflow，Selected route: Superpowers，原生隔离/RED-GREEN/针对性验证/独立安全审查；不安装技能。Codex-only 子批次，不调用Claude CLI；B1与SCENE合成阶段一完整候选后仍须Claude集中审查。只在明确批准的新治理提交落地、准确机器authorize为GO后进行十五文件物化或修复。

不修改authority/ADR、后端实现、数据库、CI或其他产品族，不调用真实模型，不读写运行数据。旧B1和两个共享用户工作区保持原状。只在独立隔离工作区实施，依赖采用既有锁文件安装，不借用生产数据。

## Affected Modules

- 模块：史馆Outcome前端、BFF与后端客户端。
- 允许路径：仅 manifest 的十五 productPaths，逐项如下：
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

`backendClient.ts`仍只接收Outcome接口，不引入其他族的差异。批准提交只有本task卡和对应新manifest两文件。既有B1/SCENE批准文件保持不变。

## Technical Plan

1. Owner确认本新manifest摘要及两文件批准提交的创建/普通快进推送；核对远端仍为冻结base。独立批准提交落地后，在新隔离工作区运行准确task的authorize，未GO不物化产品。
2. 逐文件核对下列donor身份，从c096精确提交读取十五路径。原aa869基础与新c9fb基础在这十五路径逐个blob相同，包括同样缺失的新文件；不存在与SCENE十二路径的路径交集。这个结论仅证明文件兼容，不能替代组合运行回归。
3. 以donor作为初始实现，保留既有测试。若出现新基线引起的失败，只在十五路径内最小修复、先复现再验证；需要额外路径/后端修改时停止相关动作并提交差异。任何候选修改均须最终冻结并获准确SHA/tree确认，原c096不是获准推送的候选。
4. 八项矩阵为原七项完整保留，加backend-scene组合回归；前端完整test/lint/typecheck/build覆盖SCENE与B1。增加必要针对性失败案例，不放宽断言。正式机器门输出不替代真实浏览器及独立审查。
5. 在新候选完成下方B1全部真实浏览器案例，并验证SCENE主入口/结果/看板未受影响；旧截图和旧候选Review不冒充新候选结果。
6. 按原强制入口完成新候选INDEX、逐例证据及REVIEW。若宿主此前拒绝条件尚无可验证的合法恢复，保持接收Pending；本包不授权绕过或试探同一归档操作。归档具备执行条件前不得宣称可完成接收，也不得提前推送产品候选。
7. 独立Review、完整证据和机器PASS后请求Owner确认新候选SHA/tree及条件普通快进；远端必须仍为新批准提交，不force、不部署。阶段一Claude审查另按原长目标执行。

### 精确代码来源

- `frontend/src/app/api/shiguan/archives/[id]/outcomes/route.test.ts`：mode `100644`，blob `55f50c49d5683776cf0d1651749804b88899f096`，SHA256 `51b46740eb29f5bfab7a295bcdd85fd221f6ac87673f727b4502b0ae78a04674`。
- `frontend/src/app/api/shiguan/archives/[id]/outcomes/route.ts`：mode `100644`，blob `8481c571e2d1e4e9c7d5063b4a0e5d127f5dbc2f`，SHA256 `1a5018c7803a477688264f83bb6d46cbd82190c7b132ee3c5eba808f4bb7d56e`。
- `frontend/src/app/api/shiguan/outcomes/route.test.ts`：mode `100644`，blob `8c754ce2867018b3cf76e37bf4950e12f90bbbc8`，SHA256 `f7a085de16170d4e22c6daaf96334f3fba3f5ceee0eff444151fe18a83860ad3`。
- `frontend/src/app/api/shiguan/outcomes/route.ts`：mode `100644`，blob `367f14d7d1a1d147843a3206756144f75fe5ed9a`，SHA256 `a93353ba2079292bd93620454e08b3aa9f744a00b626402c04d66d8dedc6157e`。
- `frontend/src/app/shiguan/ShiguanClient.tsx`：mode `100644`，blob `c18c85585d5b05f1d1fdbb3cb9fccfdd9eda51c1`，SHA256 `cc2736115aa13df73b51a26da097aaccfa3cfed47a8a85036f5d429d38c57537`。
- `frontend/src/app/shiguan/shiguanController.test.ts`：mode `100644`，blob `2d92b44dc5e269532179547c23a0131fd793ecc1`，SHA256 `5e23634d12a1ece24aff8a63e36bd159ef4af93a0926d512f96cff125f0b9215`。
- `frontend/src/app/shiguan/shiguanController.ts`：mode `100644`，blob `04dc0220fbf1f33047fc5f8bfb72ef42068cc910`，SHA256 `1e03c5b5b0e7ad28268e385b144694f6866affb577172184a97b3b46fb4e6cb3`。
- `frontend/src/app/shiguan/shiguanPayload.test.ts`：mode `100644`，blob `446c025192d30b0b0e53187b99fa0512dd991ab0`，SHA256 `96ade46ad91a24cde9fd8cb87e2383cf627bb36b8d50a1ef390f917c3f8fefaa`。
- `frontend/src/app/shiguan/shiguanPayload.ts`：mode `100644`，blob `1c24d9015e5126e180e7593923154de5b55bb638`，SHA256 `6d7ddc3debc8d9070a846ec17e4d82a5e45871b5a751da38cf6c5200e5bef47a`。
- `frontend/src/features/shiguan-visual/ShiguanOutcomePanel.test.ts`：mode `100644`，blob `88655dd3208c6baa9fbeded7931a09164a0efb7d`，SHA256 `388ebf3b9d844394f9c7d38b3e6cf75d5c9880da9f1c7e9d8d4bb2c1e9a2560c`。
- `frontend/src/features/shiguan-visual/ShiguanOutcomePanel.tsx`：mode `100644`，blob `132db6b3a6969e87e67e2cb116e56777f754dd8b`，SHA256 `2e10af46445f9a8b958456cfa4af3f5e7d314260740db7955247b8c506d8776b`。
- `frontend/src/features/shiguan-visual/ShiguanWorkspace.test.ts`：mode `100644`，blob `b23b0727bbbec462008235129f14bdacea31218d`，SHA256 `e83cf0830f8f42a53e4c2ba427daaac879ce8b7d8a8479909c17f92c270d142a`。
- `frontend/src/features/shiguan-visual/ShiguanWorkspace.tsx`：mode `100644`，blob `1b4ae1c907b53860c945f3110ceec39054dd594d`，SHA256 `adc0f0971645a049806bad2c6c42485f3a0054fa88bff34204a730f8599face2`。
- `frontend/src/lib/backendClient.shiguanOutcome.test.ts`：mode `100644`，blob `ffe7da5b18e92a04be962f95efa6ab65520e19af`，SHA256 `86e40c49ed9fecd128a78204fe473f4c5acdb832fb0bbbaa30d9d93215c11ad1`。
- `frontend/src/lib/backendClient.ts`：mode `100644`，blob `998df50e10438427c9fe91cc6aefd1923d629fe3`，SHA256 `e657e271a4f1103634f7d7e5a89d8ce724b0a7d88669ac653cca861f720de5b4`。

完整来源索引在随包 ALIGNMENT.json；原已提交B1本身可复算，不复制或归档旧B1浏览器材料到新入口。

## Implementation Report

尚未实施新批次。2026-09-12只读核对：SCENE候选/远端为c9fb067331bf5dcb47d31d0b23b00b6f7be4b2ae，两个候选工作区均干净；旧B1准确机器verify返回STOP/REMOTE_HEAD_MOVED，未运行其测试矩阵。十五个B1路径在旧基础和新主线一致，source c096准确修改这十五路径。未rebase/cherry-pick、未创建产品候选、未变更用户工作区。

## Acceptance Review

Pending。本文件是新的待批准材料，不修改旧消费状态。最终接收要求机器、真实浏览器、精确证据归档、独立审查和候选确认全部成立。历史宿主拒绝与新机器批准是两项独立条件；新的Owner批准不能被解释为宿主拒绝已解除。

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
