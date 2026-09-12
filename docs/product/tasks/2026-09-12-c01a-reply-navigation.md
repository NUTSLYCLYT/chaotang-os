# 任务：C01A 从成果精确取回对应回奏

## Status

Ready

2026-09-12，施工拟议基线 ext-dev@d90e829d595cd3aa3c1a91c13a5569ee67551aac，tree f827505613d0c6987f13b33fdee3e3339aeffed4。属于 C01 的首个增量，不代表 P14 或 C01 全部完成；未获得 exact task GO。

> 2026-09-12 最新核对：B1 已接收至远端 ext-dev，SHA 为 d90e829d595cd3aa3c1a91c13a5569ee67551aac。本任务改以该提交为拟议基线，旧 0cfc865ce 仅为历史证据。Owner 已明确批准本次 C01A 摘要及两文件批准提交/条件快进推送；实际施工仍须 exact task GO。

## Product Definition

- 用户授权按顺序推进准备和验证；当前文档将下一步收敛为可审阅的小范围行为变更。
- 目标：已登录 owner 从已有成果进入对应 REPLY，并在刷新后仍看到该回奏。
- 已有基础：后端同 owner 单档案 GET 已验证 200，跨 owner 404；backendClient 已解析成果 replyId。
- 当前缺口：StudyArtifactLinks 的 snapshot 丢弃 replyId；StudyArtifactConfirmation 无回奏入口；史馆 controller 只选当前列表内档案；单档案读取 BFF 不存在。
- 非目标：P14 五字段完整投影、确认回执隐私变更、文件摘要接口扩展、账务计算、ERP、模型、数据库迁移、另一套归档。

## Acceptance Criteria

- [ ] 成果仅使用真实返回的 replyId，编码后访问同源单档案 BFF，核验返回 id 相同且 type 为 REPLY。
- [ ] 成功核验后能进入对应回奏；不依赖该回奏出现在前 100 条列表中。
- [ ] 直接访问深链、刷新仍能精确取回；列表加载不能覆盖深链选择。
- [ ] null replyId、404、503、401、错误 id/type 分别呈现适当状态，不显示虚假归档成功；401 沿用登录处理。
- [ ] 跨 owner 与未知档案在 BFF 返回相同 status/body 的通用 404，不透传后端 detail；非法、空白及不符合既有 ID 编码契约的值返回 400。浏览器传入的 Authorization 不得替代服务端读取的 courtos_session cookie；有效 ID 必须仅编码一次。
- [ ] 连续点击、导航变化、组件卸载及旧请求晚返回不覆盖当前选择。
- [ ] 现有成果确认与下载行为回归通过。
- [ ] 深链目标成功读取后经统一选档流程加载 B1 结果账；保留分页、更正链、结果未知重试、切档迟到响应隔离和401清理行为。目标不在前100条档案内也必须可用。
- [ ] 真实浏览器完成成果入口、取回、刷新和负例；取得截图与控制台证据。

## Delivery Constraints

- 仅前端候选范围；不修改 AGENTS、ADR、authority、运行库或后端业务逻辑。
- 技能计划：项目 codex-engineering-workflow；浏览器可用时 chrome-devtools。实质变更后独立 TypeScript 审查，身份转发相关逻辑独立安全审查。
- Codex-only：是。
- 施工前仍需项目 exact task 批准；本清单是审阅草案，不是机器 manifest。

## Affected Modules

- 模块：成果链接、同源档案读取、史馆深链选择。
- 允许路径：以下为拟议 exact 范围，当前不授权代码写入。实际 RED 若证明需要额外文件，应先修订合同，不能静默扩大。

MODIFY：

1. frontend/src/lib/backendClient.ts
2. frontend/src/lib/backendClient.test.ts
3. frontend/src/features/study-visual/StudyArtifactLinks.ts
4. frontend/src/features/study-visual/StudyArtifactLinks.test.ts
5. frontend/src/features/study-visual/StudyArtifactConfirmation.tsx
6. frontend/src/features/study-visual/StudyArtifactConfirmation.test.ts
7. frontend/src/app/shiguan/ShiguanClient.tsx
8. frontend/src/app/shiguan/ShiguanClient.visual.test.ts
9. frontend/src/app/shiguan/shiguanController.ts
10. frontend/src/app/shiguan/shiguanController.test.ts
11. frontend/src/app/shiguan/shiguanPayload.ts
12. frontend/src/app/shiguan/shiguanPayload.test.ts

ADD：

13. frontend/src/app/api/shiguan/archives/[id]/handler.ts
14. frontend/src/app/api/shiguan/archives/[id]/route.ts
15. frontend/src/app/api/shiguan/archives/[id]/route.test.ts

## Technical Plan

1. 在现有 server-only backendClient 增加单档案读取，复用解析与错误处理，验证 id/type。新增 BFF 只转发当前登录用户凭据。
2. 成果 snapshot 保留 replyId，增加查看关联回奏与缺失/不可用提示；不从 HTTP 200 推断完整业务成功。
3. 采用 /shiguan?replyId=<encoded-id> 深链，controller 增加独立目标请求与竞态保护。目标档案可以加入现有内存列表供既有视图展示，不持久化第二份业务档案。读取成功后复用现有 selectArchive 的结果账初始化与切档处理；不得直接改 selectedArchiveId 而绕过 B1 生命周期。
4. 补充解析、BFF、控制器及组件回归，重新构建并完成浏览器验收。
5. 回滚仅撤销该前端变更，不需要迁移或清理用户数据。

## Implementation Report

仅完成代码核对与范围草案，未修改产品代码。当前前端隔离 build 已通过，但浏览器 RED 尚未完成：启动 loopback Next 服务遭自动审批拒绝。不能据此宣称 UI 闭环成功。

相关证据：chaotang-c01-build-sample-2026-09-12.md、chaotang-c01-isolated-env-2026-09-12.md。

## Acceptance Review

产品验收 Pending。2026-09-12 独立规划审查通过其前端独立实现方向与路径范围；一项 P1 安全验收定义已补入（404 等价、ID 边界、Cookie 凭据事实源），尚待实现和测试验证。前端现有基线 143 项通过，成果相关 BFF 35 项通过、史馆列表 BFF 1 项通过；均不证明新增深链行为已实现。本任务不解决完整 P14 合同，也不能替代 C01 十轮和真实业务验收。后续五字段和公开确认回执字段边界仍须独立处理。


### B1 接收后的验证

已在 d90e829d 的隔离源码快照执行9个前端测试文件：173 passed、0 failed，包括 B1 Outcome 客户端、面板与史馆工作区回归。复用此前隔离依赖；不是新增C01A功能验收。


### Owner 本次授权

Owner 明确确认 sha256:ca3cadaba775aaf1241636fbdd1894dead8bbfc49764e60945f5ed66c8b7e6c4，并授权远端仍为 d90e829d595cd3aa3c1a91c13a5569ee67551aac 时创建、快进推送仅任务合同与manifest两文件的独立批准提交。取得GO后实施15文件；产品候选提交、接收、部署另行授权。
