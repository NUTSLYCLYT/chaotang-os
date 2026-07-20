# 任务：docs-r0-trusted-kernel-amendment-20260720

## 任务 1：全局事实审计

- 目标：识别唯一主线、真实红灯、用户金链和未完成分支价值。
- 前置：只读；不接受历史分支自报 PASS。
- 输出：后端、前端、分支三路审计结论。
- 状态：DONE。

## 任务 2：修正案正文

- 目标：将 22 条 REQ 与旧 M0–M10 重排为 W00–W09 纵切价值流。
- 前置：G0 分支本地 exact-head verified；v1 authority STOP。
- 输出：`amendment.md`。
- 状态/数据变化：仅文档，无 runtime 或数据库变化。
- 回滚：revert 文档提交。
- 完成定义：22/22 唯一映射、第一 golden slice、依赖/RED/证据/回滚齐全。

## 任务 3：静态验证与 Claude Code 审查

- 目标：证明修正案完整、无越权、可被 Codex 逐包执行。
- TDD：先证明 validator module 缺失时测试 RED；审查后再次以失败测试证明 CLI 未绑定 digest、可改道输入、语义反转与跨表漂移问题，再实现 GREEN。
- 验证：22/22 REQ、9/9 退出门、11/11 旧 M 处置、跨表 Owner、CLI 0/1/64/66、fail-closed 控制、root doctor、authority STOP、diff check、三路 exact-H 只读 review。
- 状态：IN_PROGRESS_EXACT_H_REVIEW_PENDING。

## 任务 4：G0 合入后的重钉与批准

- 前置：G0 hosted PR 合入 `feature-chaotang-ext`。
- 目标：rebase 到新 EXT exact SHA，重算 amendment digest，填写具名 Owner，获得用户对 W01 的 exact 批准。
- 明确限制：本任务完成前不得实现 v2 或产品 runtime。
- 状态：BLOCKED_EXTERNAL_G0_MERGE。

## 任务 5：未来逐包施工

- 顺序：W01 → W02 → (W03, W04) → W05 → W06 → W07 → W08 → W09。
- 每包：独立 change、独立分支、RED/GREEN、exact-H review、hosted PR、merge 后复验。
- 状态：NOT_AUTHORIZED。
