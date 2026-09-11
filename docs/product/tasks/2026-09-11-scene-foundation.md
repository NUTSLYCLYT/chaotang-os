# 任务：五场景输入与事务修复、S4 规则预分析接收

## Status

Ready

Owner 已在2026-09-11明确回复“批准”，确认先实施十二文件批次的基础、顺序与正式摘要 sha256:1d842a2dbf922e5b02fd01312af95a642446618c0dc92a1760d360da82e82831。以下原方案中的“备选/DRAFT/拟基础”是批准前的说明，不代表仍需重复选择方案。Git 操作及机器 GO 前置仍按项目规则执行；Ready 不等于已取得 GO。

## Product Definition

- 用户确认：当前任务 Owner 于2026-09-11批准准确顺序调整包及摘要。
- 目标用户：五场景材料提交者与场景看板使用者。
- 目标：区分资料不足、非法输入、内部失败与成功；失败不部分写入；S4 提供忠实于材料的规则预分析及可重访依据。
- 非目标：不改 B1 Outcome、authority、ADR、数据库 schema、正式业务动作、生成幂等或部署，不调用真实模型，不读写运行数据。

## Acceptance Criteria

- [ ] 五场景严格拒绝非法类型、超限和非有限数值；资料不足保持可解释，不假称成功。
- [ ] 输入、序列化和第二次 INSERT 失败均不产生部分成功记录。
- [ ] 401 清除私有旧结果，422 保留合理编辑重试，未知结果不自动重放或假称未写入。
- [ ] S4 五类规则在双字段中正确提示，保留原文依据、缺失说明和零命中限制，不虚构部门或模型执行。
- [ ] 场景页面和看板重访显示可信依据，旧记录安全降级，桌面与360px真实使用链路通过。
- [ ] 已批准八项机器验证与准确候选独立安全审查通过，未关闭P1/P2不得接收。

## Delivery Constraints

- 范围：下列同一 approval manifest 的十二 productPaths；逐字复用下方已批准详细业务契约。
- 兼容性：保留现有 API/BFF 主链、三层 Harness、owner/tenant 边界和旧记录只读降级。
- 技能计划：codex-engineering-workflow；using-git-worktrees 未在 Windows 可用技能目录找到，按项目允许使用等价原生 Git 隔离与状态核验，不安装第三方技能。
- Codex-only：是；本子批次不启动 Claude CLI/runner。阶段一完整候选仍交 Claude 集中审查。
- Task profile：范围清晰、十二路径固定、跨前后端输入和事务边界，需要真实失败恢复验证。
- Selected route：Superpowers；按项目允许使用 Codex 原生的基线、最小修复、针对性验证和独立审查步骤。
- Reason：跨模块输入与持久化契约需要统一验证，但不改变架构、权限或主链。
- Quality gates：准确机器 GO、RED/GREEN、八项矩阵、真实浏览器、独立安全审查、准确候选接收。
- Escalation：范围扩张、数据库变更、真实凭据/运行数据需求或无法解释的失败，停止相应依赖动作并报告差异。

## Affected Modules

- 模块：五场景 API、输入模型、场景与看板存储、场景工作区和看板展示。
- 允许路径：以 .harness/approvals/SCENE-FOUNDATION-20260911.json 的 productPaths 为唯一清单：
  - `backend/app/api/scene_packs.py`
  - `backend/app/scene_packs/models.py`
  - `backend/app/scene_packs/storage.py`
  - `backend/tests/test_scene_pack_api.py`
  - `backend/tests/test_scene_pack_models.py`
  - `frontend/src/features/scene-packs/SceneBoard.tsx`
  - `frontend/src/features/scene-packs/ScenePackWorkspace.test.ts`
  - `frontend/src/features/scene-packs/ScenePackWorkspace.tsx`
  - `frontend/src/features/scene-packs/client.test.ts`
  - `frontend/src/features/scene-packs/client.ts`
  - `frontend/src/features/scene-packs/sceneBoardV4Presentation.test.ts`
  - `frontend/src/features/scene-packs/sceneBoardV4Presentation.ts`
- 依赖模块：既有账户/BFF、场景 registry、三层 Harness；不导入 B1 十五路径。

## Technical Plan

按下方契约执行：复现输入/事务/展示失败 → 模型与服务端边界 → S4 规则与依据 → 前端失败恢复与看板投影 → 八项门禁 → 真实浏览器 → 独立安全审查。正式候选为独立 approval commit 的精确单亲子。源工作区和 B1 候选均保留。

## Implementation Report

产品尚未实施。当前只准备两份批准文件；根 Harness 的任务卡章节缺失已按标准格式修正，不改变原业务契约。机器 GO、RED/GREEN、产品构建/浏览器和候选审查仍待执行，不能将批准材料当作产品成果。

## Acceptance Review

- 验收结果：Pending。
- 验收证据：最终候选机器矩阵、真实用户链路和独立安全审查待执行。
- 未通过项：批准提交与其 Git 动作尚未完成；未取得产品施工 GO。

## 已批准详细契约（保留原文）

以下正文对应批准前 TASK.md SHA256 0796e92ef18cfd04e6315284bca4395672177d77d133f0ebd8f7a997ff28a8f8 的详细契约。本正式任务卡只增加标准章节、状态与执行说明；下方契约原字节对应文本保持不变。

## 基础与调整范围

拟基础为当前实际远端 ext-dev 的 aa869db1ab0dc99ac2e707ce00f17fce65edc90e / tree a483de7c2047de7d949243511750c721916d4828。2026-09-11 已通过 git ls-remote 核验。Owner 明确选择本备选、确认新的正式批准摘要并授权相应 Git 操作后，独立批准提交先落地，准确机器 authorize 返回 GO 才可实施。

此次只调整施工顺序和基础：本十二文件批次可以先实施，B1 接收仍是阶段一完整接收及最终发布的条件。取消“B1 先成为远端主线才能开始本批”的先后依赖，不取消 B1 五项用户结果、浏览器证据、INDEX/REVIEW、独立审查或精确候选确认。历史受拒归档操作保持原状，不委托、重试或通过本备选换路径执行。

已逐文件核对：本批十二路径在拟基础 aa869 与旧拟基础 c096 的 Git blob 摘要完全一致（包括唯一新增测试文件在两边均不存在）；与 B1 十五个 productPaths 没有交集。该结论证明直接文件基线一致，不证明所有运行时契约天然独立；完整八项机器矩阵、真实浏览器验收及独立审查仍须在新最终候选完成。

保留 c096d7db86e10dea73f027cab07473f3c2f05c57 及其全部原始证据作为未接收的 B1 候选。推进 ext-dev 后，B1 原批准的远端位置前提会不再满足，不能再原样接收 c096，也不能声称原批准仍可执行。B1 后续须另行准备基础对齐和合法接收方案，确认准确范围、取得相应机器授权、验证新候选；本备选不提前授权 B1 重写/重放或保证零冲突。

仅修改同目录 approval.proposed.json 中原有十二个产品文件。输入、事务、S4 规则及前端行为、nonGoals、八项 verification 均保持原方案。不会导入 B1 十五路径、修改 authority/ADR/数据库 schema 或增加真实模型/生产副作用。不得把旧批准摘要套到本备选。

解决范围仍是非法输入被接受、非有限数值和错误序列化、部分写入、失败状态恢复，以及 S4 从占位转为可核验规则预分析。以下业务与验证契约逐字复用原方案。

## 明确的输入契约

1. 按 pack_slug 验证字段类型，覆盖五个当前场景。字符串字段只接受字符串，不转换 bool、数字、对象、数组或 null。现行 registry 字段与前端样例字段均应盘点；保留 B2B inquiryTime/applicationScenario 兼容字段。
2. 缺失或空白的必填文本、空的合法列表、缺少关键经营指标表示资料不足，返回可解释的 blocked，不得 completed/可继续。已提供却类型错误、格式错误或超限则在写入前 422。
3. 企业增长 targetMarkets/products/topProblems 只接受最多 30 项、每项最多 200 字符的字符串列表。列表空白项不视为有效材料；全空时资料不足。禁止对象、bool、嵌套集合。
4. threeMonthMetrics 仅允许 sales、profitMargin、grossProfit、cashflow、aov、inquiries、conversionRate、cac。profitMargin/conversionRate/cashflow 三个实际使用指标分别检查；其他合法指标缺失不补零、不冒充已核验。
5. 指标接受有限 int/float（明确排除 bool），或有界数字字符串：首尾空白可去除、允许符号及十进制/指数表达，规范化后必须有限。比例字段允许恰好一个末尾 %；金额禁止 %。拒绝 NaN、Infinity、溢出、空字符串、对象、重复百分号与无效数字。conversionRate 为 0–100 百分数；合法零和负现金流不得被判缺失。profitMargin 不新增未经定义的商业数值范围。
6. 普通文本统一上限 2000 字符；原文/资料字段 contractText、contractSummary、customerOriginalText、chatHistory、knownParameters、productMaterials、customerRequirement、rfqFile 上限 20000；productName/projectName 上限 120。完整 materials 不静默截断。输入契约超限时拒绝，不能扩大输出模型上限以放行。
7. 对从材料生成的有界标题/摘要使用明确的展示摘录，例如带省略号的公司/需求标题；原 action_payload 中已有完整文本保留。不能把显示摘录当完整材料，更不能声称此前没有保存的原文已经完整持久化。输出生成必须满足现有 title/verdict/summary 上限。
8. 未支持输入字段和非空 attachments 明确拒绝；场景内历史 attachments 键仅兼容空列表。demo 采用严格布尔。未知场景继续既有 not-found 语义，不因未知输入规则产生假成功。

以上数字是本具体任务提出的边界，需与 task/digest 一并确认。它们不是既有实现，也不代表文档自动获得产品 authority。

## S4 来源、规则与完成语义

只接收 ct-run 已保全 S4 的相应代码段，不能整文件覆盖共用输入修复。来源工作区 /home/ubuntu/ct-run，HEAD c825c3f7b47755b75cb2fb4a625c9d85cc9134e8；未提交来源摘要：storage.py 为 8d921fcc5568a0bcd888990fc103d6c333ff89f488de24efb53d7fe0850a5722，test_scene_pack_api.py 为 1bed028ff189d4307a43f7a60727fa16ff301188cc42535e4a95ff53b2a74134。导入前重新核对；漂移时先检查差异。

1. 既有 registry 的 projectName、customerRequirement 为必填文本；rfqFile、budget、deadline、competitors 为可选文本。缺少必填信息返回 blocked/canProceed=false；两个必填文本合法时可以完成规则预分析，可选信息未提供时必须保留其缺口、适用限制和补充行动。completed 仅表示本轮规则预分析完成，不表示完整报价、正式业务办理或首发验收通过。资料补充后显式重新分析，不覆盖旧结果。
2. 沿用冻结来源的五类提示：质保/保修/warranty；违约/罚/penalty；保证金/保函/bond；定制/非标/custom；验收/acceptance。对 customerRequirement 和 rfqFile 采用相同处理，英文不区分大小写且按词边界识别，中文按明确词项识别。单类重复命中不重复累加提示；五类外不新增未定义的领域判断。
3. 命中仅证明材料提及相应词项：表述为待核实责任及成本，不能把否定、引用或关键词本身判为已成立义务；未命中明确“当前词表未命中，不能排除风险”。例如“无质保要求”和“penalty excluded”可以产生待核实的词项提示，但不得宣称存在质保承诺或已经承担罚则。
4. 将规则版本、命中类别、输入字段与有界原文摘录放入已有 action_payload/details，并在场景结果及看板重访显示。摘录须忠于原文，字段可验证，不扩大原文读取权限；计算提示不伪装成外部事实。新 S4 结果的 EvidenceRef 只记录真实用户材料来源（user_claim），不使用 model_inference、工部已分析、户部已推演或锦衣卫已核验等不存在的执行记录。下一步建议可以指定部门，但须表述为待办。
5. risk_grade 沿用冻结来源的命中计数映射供既有看板兼容：0类low、1–2类medium、3–5类high。S4 页面解释为“规则提示级别”，零命中不显示成已确认低风险；不能宣称法律/履约风险测量。既有 confidence 字段保留兼容值，本批不改其计算公式，也不显示为置信概率或重新命名为未经定义的资料完整度分。S4 UI 隐藏该数值，明确没有模型分析或校准概率。
6. 输出应为需求关注点、报价待确认假设、未覆盖信息和下一步建议，不能声称逐条偏差表、成本测算、正式报价或投标已经完成。rfqFile 是粘贴的资料文本，不是文件上传/解析。S4 接收完成后才将 registry 标为 real_v1，界面仍明确规则预分析。

本节是与现有来源及 registry 对齐的具体批准提案；保持五场景首发交付要求。更完整的正式成果、来源转交、未知结果幂等恢复与演示隔离继续由阶段二和最终验收证明，不能用本批规则卡替代。

## S4 规则元数据与看板兼容

- 在 details.ruleAnalysis 中使用闭合对象：ruleVersion 固定 s4-keyword-v1；matchedCategories 为 warranty/penalty/bond/custom/acceptance 五类枚举的唯一有序子集；anchors 为最多十项（每类别、每材料字段最多一项）的闭合 {category, field, excerpt} 对象，field 只允许 customerRequirement/rfqFile，excerpt 为非空且最多240 Unicode code point 的原文摘录。前后端统一按码点计数，加入含补充平面字符的边界测试，不把 JavaScript 的 UTF-16 code unit 数当码点数。类别顺序按本卡五类顺序；anchors 中出现的类别集合必须与 matchedCategories 一致，零命中两数组均为空。
- 不把 UI 限制文案作为服务端任意文本解释；前端按已识别规则版本显示固定、诚实的覆盖说明。后端写入前验证元数据，并核对每个 excerpt 来自声明的输入字段。risk_grade 必须与唯一命中类别计数一致；blocked/资料不足不得补造一份零命中成功分析。
- 在既有 client.ts 定义可复用的纯解析函数，Workspace 与看板投影共同使用。新 S4 POST 的 completed 响应必须具有有效元数据，否则为结果未确认，不能自动重放；GET 旧记录仍可读取顶层有效事实，但规则元数据独立降级为 unavailable。不能因严格 GET 拒绝整个记录而让下述历史降级状态不可达。非 S4 的任意 details 继续不产生规则展示、权限或动作。
- 详情采用 available/unavailable/legacy-stub 三态。available 展示规则版本、提示级别、五类命中及原文锚点；零命中明确不能排除风险。unavailable 显示尚无可校验规则依据，不猜测版本或风险；已验证顶层 blocked + STUBBED 显示历史占位，未运行规则。历史内容保持只读，不重写旧库，不把旧 model_inference 引用认证为已发生调用。
- 列表 API 没有规则元数据，S4 列表只显示兼容提示级别，要求打开详情核对依据，不能推断零命中或规则版本。保持现有“高风险”筛选及其 predicate，旁注 S4 按兼容 high 级别纳入，不重新分类旧记录。非 S4 列表/详情、筛选和状态行为不变。
- sceneBoardV4Presentation.test.ts 覆盖合法投影、旧 stub、缺失/未知版本、未知键、错误类型、非法类别/字段、超长摘录、计数矛盾和恶意 details；不投影置信度、原始完整材料、URL、HTML、批准或执行记录。真实浏览器检查列表、详情、筛选解释、返回再进入和窄屏，不以静态源码守卫替代交互证据。

## 写入与响应约束

- 同一验证器覆盖 HTTP 和存储入口；不能通过构造或复制未校验模型绕过。
- 严格序列化规范化输入、结果和将返回的结构，拒绝所有嵌套非有限值；成功预检后才在同一事务写入 run 和 mission。
- 失败需整体回滚。禁止把 NaN 换成 null 后仍标成功；数据库中两张表数量均不能增加。
- 异常映射保持脱敏。对明确输入错误返回 422；内部契约/序列化错误返回稳定的不可用错误，不输出输入原文、路径、栈或凭据。
- 统一边界覆盖到达场景 API 的畸形 JSON、顶层数组/标量以及框架提前抛出的 RequestValidationError，不能仅捕获业务函数内部的模型校验。输入拒绝返回固定 {status:"error",reason:"validation"} 的 422，不带 FastAPI 默认 detail/input。可在已批准的 scene_packs.py 内实现路由级错误映射，不能改全应用异常处理或扩大其他 API 行为。
- 历史异常记录读取失败时明确不可用，不删除、重算、覆盖真实数据；用临时构造的异常记录验证。若需要超出十二文件的历史迁移，应单列后续任务，不越界施工。

## 前端约束

- runScenePack 校验成功响应形状以及返回场景/demo 匹配；401、422 与其他失败保留可判断状态，不全部归结为“请确认登录”。
- 422 提示检查字段类型、格式或长度，已填写内容可编辑后重新提交；401 清除已显示私有结果并提供登录入口。提交前清除旧结果，避免本次失败时继续展示上次成功。
- 输入长度与结构提示清楚。服务端是最终边界，不能仅靠 maxlength 或 disabled。
- 明确保留现有 demoInputs.ts 的 UI 适配：去首尾空白、忽略空文本、逗号分隔字符串列表及过滤空项；threeMonthMetrics JSON 解析失败仍传字符串，由服务器以 422 拒绝。该模块不承担权威校验，本批不修改它，也不承诺修复本地序列化器。客户端测试可直接导入其现有函数验证兼容性；规范化后为空属于资料不足，有值但类型非法属于输入拒绝。不得将对象字符串化来绕过服务端约束。
- 不增加自动重放、幂等键、新查询接口、取消服务器任务或虚假的超时恢复。其他网络/5xx/异常响应提示结果未确认，不声称后台一定没有写入；不将这一批包装成完整生成恢复协议。

## RED → GREEN 验收

先将已复现失败转为持久回归，再实现最小修复：

1. 五场景逐字段类型参数化：对象、数组、bool、null、错误数字；同时保证当前合法样例和 growth 结构化输入兼容。S4 从 stub 转为规则预分析，正常、必填缺失、非法输入、可选资料缺失分别验证，不能以原 stub 的 blocked 断言作为通过。
   另用原始 HTTP body 验证畸形 JSON、顶层非对象和框架请求校验错误，断言固定脱敏 422、无 detail/input 原文，run/mission 均不增加。BFF 自己拒绝无法解析的 JSON 时，沿用其现有固定脱敏 400；不得把这与 FastAPI 的直接请求测试混淆。
2. growth 每个关键指标分别测试缺失、布尔、NaN/Infinity 字符串、指数溢出、非法百分号、合法零/负现金流、conversionRate 边界及错误类型；对返回码和 run/mission 计数同时断言。
3. 内部存储入口绕过尝试、结果序列化失败、第二次 INSERT 失败等事务边界，证明没有部分写入。
4. 输出长标题/摘要、输入刚好上限和上限+1，严格 JSON 往返、旧异常记录稳定不可用，当前身份外不可读取。
5. 客户端合法响应、畸形 2xx、错误场景/demo、401、422、网络错误，证明不自动重放且不会把旧结果作为新成功。
6. 完成 JSON 中八项门禁；增加与最终改动相关的必要检查，不用反复全量测试替代根因分析。
7. 在真实构建前端+BFF+隔离 FastAPI 下，用合成账户实际登录，走正常、资料不足、非法 JSON 指标、修改后重试、重新读取、401 后旧结果清理。S4 额外覆盖两材料字段的五类中英文命中、否定/引用、英文词边界、重复命中、零命中限制、原文摘录一致性、无虚构模型/部门来源；从看板重访核对已保存结果。桌面与 360px 验收并记录控制台/请求/截图，证据绑定最终候选 SHA/tree。两 owner/tenant 交叉读写保持拒绝；连续点击与未知回执验证不自动重放、不声称服务器未写入，完整幂等恢复仍是阶段二的必要交付。
8. 独立安全审查关注输入边界、序列化、事务、身份清理。依照用户 2026-09-11 启动的长任务目标，本子批次由独立 Codex Reviewer 检查；阶段一完整候选形成后再交 Claude 集中审查。不得用作者自审或 CLI 退出码替代结论。

Claude 集中审查是阶段一完整候选的接收前置条件，不作为本子批次每一步实施的前置条件。认证不可用时继续不依赖它的已授权工作，不重复尝试未变化的失效认证，不冒称已经审查。独立 Codex Review 不取消阶段一的 Claude 审查；八项机器验证也不替代真实用户验收。以上只更新 DRAFT 的协作安排，不产生机器 GO，不修改现有批准或接收边界。

## 后续顺序与交付

本批独立实施及子批次 Codex Review → B1 基础重新对齐与完整接收 → 阶段一完整候选 Claude 集中审查 → 阶段二生成意图/未知结果恢复、演示隔离与正式业务来源关联 → 阶段三完整备份恢复、发布与回滚验收。

本备选允许其他已获机器 GO 且独立的工作推进；不宣称历史拒绝已解决，也不保证 B1 可以在宿主条件不变时接收。后续仍可能在阶段一完整接收边界等待，不得宣称已可发布。

交付准确批准提交、其精确单亲候选、tree、十二路径差异、RED/GREEN、真实浏览器和独立审查结果。B1 或其他候选的记录不冒充本候选证据。阶段内不依赖 Claude 登录；阶段一完整候选仍按原目标集中审查。
