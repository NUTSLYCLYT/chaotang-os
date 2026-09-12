# C01A 回奏导航：Harness 契约修正与后继批准

## Status

Ready

此卡修正前一份 C01A 后继批准任务卡的格式缺陷。Owner 已批准前一批准包的业务目标和 15 个产品路径；但根 Harness 要求每份产品任务卡包含完整的标准章节，而前卡仍标记为“草案”，缺少 8 个章节，导致根 Harness 失败。此修正不改变 C01A 用户结果、产品范围、非目标或验证要求。新的独立批准 manifest 以当前 ext-dev 提交 cb6c35af556038b3a0218ce19db16797d856d788 为基础，取得准确 GO 后才可重放 C01A 产品路径。

## Product Definition

- 目标用户：已确认学习成果、需要进入对应史馆 REPLY 的业务用户。
- 用户结果：确认页读取并链接其已验证的 REPLY；用户可通过同源 BFF 打开 /shiguan?replyId=<reply>，并在深链、手动选档、401、迟到响应与跨 owner 情况下保持正确的私有状态边界。
- 本修正目标：让该已批准范围可通过既有根 Harness 的产品任务格式契约；不放宽或修改检查器。
- 非目标：不变更后端、数据库、部署、ERP、模型调用、P14、生产数据、Authority、Harness 或 C01A 之外的产品族。

## Acceptance Criteria

- [ ] 任务卡具有 Harness 所要求的八个标准章节，node scripts/check_harness.mjs 在当前基础上通过。
- [ ] 新 approval manifest 仅重新批准同一 15 个 C01A 产品路径，基础为 cb6c35af556038b3a0218ce19db16797d856d788 与其 tree。
- [ ] C01A 产品实现保持 15 路径边界；确认页 → 精确 REPLY → 史馆深链链路可用。
- [ ] 无 cookie、伪造 Authorization、未知或跨 owner ID、401 清理、深链与手动选档竞态保持拒绝或安全恢复。
- [ ] 最终候选完成准确机器 --authorize、--verify-candidate、浏览器验收和独立 Review；无未关闭 P1/P2。

## Delivery Constraints

- 该治理提交只可修改新 approval manifest 和本任务卡；不得将产品代码、依赖、构建产物或 Authority/Harness 改动带入。
- 产品候选必须是该批准提交的精确单亲子，且仅修改 manifest 所列 productPaths。
- 机器 GO、候选提交、候选推送、主线接收与部署仍按项目既有独立授权边界执行。
- NEXT_TELEMETRY_DISABLED=1 是已接收的受控前端验证环境；不得把 telemetry 的可选网络收尾当作应用构建失败。
- 本修正不复用旧候选的浏览器证据作为新候选证据。

## Affected Modules

- 模块：C01A 产品任务卡与 Product Authority 批准记录。
- 允许路径：docs/product/tasks/2026-09-12-c01a-reply-navigation-successor.md、.harness/approvals/CT-ENTERPRISE-C01A-REPLY-NAVIGATION-HARNESS-CORRECTIVE-20260912.json。
- 产品后继允许路径：由新 manifest 的固定 15 个 productPaths 唯一决定；本治理提交不修改它们。

## Technical Plan

先在当前 ext-dev 精确基础上提交本任务卡的格式修正和新的 approval manifest；核对提交只含这两条路径，推送后执行准确任务的 --authorize。GO 后从该批准提交建立隔离产品工作区，逐字重放已验证 C01A 源差异，运行前端完整测试、lint、typecheck、受控 build、根 Harness、候选门禁与浏览器验收，并进行独立 Review。候选和推送分别取得所需确认。

## Implementation Report

尚未实施。本文件是修正批准包的草案，供 Owner 审查；没有形成 Git 提交、没有推送，也没有创建或接收产品候选。已定位的唯一阻塞是前卡与既有 Harness 标准章节契约不一致。

## Acceptance Review

- 当前结果：Pending。
- 已有证据：当前基础的前端 C01A 重放在隔离工作区通过 877/877 测试、lint、typecheck 与受控 build；根 Harness 仅因前卡缺失标准章节失败。
- 待验证：修正包的准确两文件提交、根 Harness、机器 GO、最终候选完整门禁、浏览器验收与独立 Review。
- 未通过项：尚未取得本修正批准包的 Owner 摘要确认和机器 GO。