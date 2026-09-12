# C01A 回奏导航后继批准包（草案）

**任务 ID：** `CT-ENTERPRISE-C01A-REPLY-NAVIGATION-SUCCESSOR-20260912`

## 目的

在治理候选 `9ee9cf78ecd9514247aefb585d2df98ce5f13ef4` 进入 `ext-dev` 后，以该提交为精确基础重新批准 C01A。修复受控 Next build 中可选 telemetry 的不稳定收尾后，重新接收“从成果确认直达已验证史馆 REPLY”的前端闭环。

## 身份与来源

- 新基础：`9ee9cf78ecd9514247aefb585d2df98ce5f13ef4`
- 新基础 tree：`d98380e51f22bc7e218ebeaf646693d437ba6c5d`
- 旧 C01A 批准父提交：`6c3f7db79623adafa8f4994a2d159a75f2032702`
- 待重放代码来源：`dd7913f9bf944cadc11d09a3c4ffc0e82f001206`
- 来源 tree：`4cc2cb8af94d2ea7ca052a83f10435f0ec9f5232`

旧来源并非新批准后的候选。后继实施必须从新批准提交创建精确单亲子，只重放 manifest 列出的 15 个产品路径；若文件或行为发生变化，重新验证受影响范围。

## 用户结果

已验证成果的确认页面可读取其对应 REPLY，并通过同源 BFF 打开 `/shiguan?replyId=<reply>`。深链、手动选档、401、迟到响应和跨 owner 不会泄露、串档或恢复已清理的私有状态。

## 非目标

不修改后端、数据库、部署、ERP、模型调用、P14、生产数据、Authority、Harness 或 C01A 之外的产品族。

## 机器验证

执行 manifest 中完整前端 build/lint/test/typecheck 与根 Harness。产品候选还须：

1. 在隔离浏览器验证确认页 → 精确 REPLY → 史馆深链链路。
2. 验证无 cookie、伪造 Authorization、未知与跨 owner ID、401 清理、深链竞态和手动选档竞态。
3. 记录候选 SHA/tree、浏览器和控制台证据。
4. 完成独立 Review；无未关闭 P1/P2。
5. 在远端仍是该批准提交时执行准确 `--authorize` 与 `--verify-candidate`。

## 状态

草案仅供 Owner 审查。它不能授权产品实施、创建批准提交、推送、接收主线或部署。
