# First Decree Cockpit V1 — Governed TDD Plan

任务：`FIRST-DECREE-COCKPIT-V1-20260826`

基线：`c939bc4dc5f759d52ca86424c725f8ac2baf2d19 / a7ce87107ca4763c448183b1a21b467310a72443`

## Phase 0 — Approval And Authority

1. 正式 approval commit 只包含 approval、Task、Plan 三条治理路径，且是冻结基线的唯一单亲子。
2. approval commit 后工作树必须干净，远端不得漂移。
3. 运行 `node scripts/product-authority.mjs --authorize --task FIRST-DECREE-COCKPIT-V1-20260826`。
4. 只有机器返回 `GO / APPROVED_FOR_ONE_CHILD` 才允许产品写入。

## Phase 1 — RED

1. 在 `studyTaskCockpit.test.ts` 冻结纯投影合同：本地拟旨、待补材料、可下旨、入队、运行、成功、失败、取消和状态不可用。
2. 在现有测试中冻结：无三步仪轨、无帝王风格、无默认旨意；验收卡九类字段完整；任务进度不丢 stage、次数和时间；每个状态只有一个主操作。
3. RED 必须是行为断言失败，不得是依赖、导入、语法或测试环境失败。
4. 保存 RED 的命令、基线 SHA/tree 与失败断言；产品实现前不得把测试改绿。

## Phase 2 — GREEN

1. 新建 `studyTaskCockpit.ts` 作为纯前端 read-model 投影，不成为第二事实源。
2. 移除首次帝王风格仪轨和硬编码默认旨意；空白首屏聚焦丞相与用户目标。
3. 用现有 draft contract 渲染完整验收卡，缺失字段只显示待补充，不推断。
4. 扩展现有提交进度回调，保留公开 job state、stage、计数与时间；不修改 BFF 或 backend。
5. 由 `StudyClient` 统一持有投影所需的已验证状态，并把一个主操作交给工作区。
6. 增加 fail-closed 恢复呈现和 `aria-live`；不引入百分比、ETA 或伪 LIVE 标签。
7. 只做让冻结 RED 转绿的最小 exact11 修改，不顺手重构。

## Phase 3 — Verification

1. 运行 approval manifest 中的 focused tests。
2. 运行 frontend 全量 test、lint、typecheck、build。
3. 运行 exact11 结构检查、product authority regression、root Harness/doctor、V2 convergence 与 regression。
4. 候选字节冻结后，在真实浏览器中通过注入式 synthetic backend/network interception 验证：首次进入、目标输入、拟旨、阻断补充、模拟下旨、API 形状一致的进度、刷新恢复、失败恢复、窄屏和可访问性。禁止请求真实 DeepSeek、公网、生产数据或持久化业务后端。
5. 保存相同 candidate SHA/tree 的测试、构建、浏览器截图、console/network 与路径摘要。

## Phase 4 — Independent Review

1. TypeScript Reviewer 检查类型安全、异步竞态、恢复状态与 owner 隔离。
2. 独立产品体验 Reviewer 检查第一价值时刻、信息层级、主操作唯一性、真实性标签和失败恢复。
3. 任一未关闭 P0-P2 使候选 NO-GO；修复后必须重新冻结 candidate 身份并重跑受影响验证。

## Phase 5 — Candidate Acceptance

1. 产品 candidate 必须是 approval commit 的唯一单亲子，changed paths 精确为 exact11、`2 ADD + 9 MODIFY`、全部 `100644`。
2. 记录 candidate commit/tree、逐路径 blob、patch digest、验证 evidence digest 和工作树 clean 证明。
3. candidate push、试点、发布和部署不在本 Packet 内，必须另行授权。

## Stop Conditions

Authority 非 GO、远端漂移、exact11 扩张、公开 API 缺少所需事实、需要后端/BFF/数据库变更、RED 无法稳定证明、任何验证失败原因不明、跨 owner 数据或来源标签失真时立即 STOP。
