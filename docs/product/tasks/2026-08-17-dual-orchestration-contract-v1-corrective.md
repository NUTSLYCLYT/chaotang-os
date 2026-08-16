# 任务：双编排公共合同 V1 最小纠偏

> Task ID：`DUAL-ORCHESTRATION-CONTRACT-V1-CORRECTIVE-20260817`
>
> 本任务遵守 ADR 0028；不改变下旨入口、单部/多部串行办理、锦衣卫证据边界或一旨一条
> `REPLY`。本文件和配套 manifest/plan 是待确认草案，不能自行产生产品执行权。

## Status

Ready

## Product Definition

- 远端事实：`ext-dev` 已落地 `1648687933058eee8611c4810561173d8fef1e24`，tree 为
  `954f274cc3f2da3cccaf2c3d97775df6ae0e6eb8`。该提交是旧 approval commit
  `32fd33e71f0f73117552c4d23bc3df649afea0c9` 的单亲产品提交，已消费原 one-child approval。
- 根因：两个工作窗口同时围绕同一 approval 形成候选；远端先落地的候选与最终审查通过的本地候选
  `cb9b6ba8220d82d4b5e419d24fbc5d9fa3cebde5` 同父分叉，导致后者不能普通快进推送。
- 已证实缺口：远端候选相对最终审查候选只少两个文件中的保护逻辑与测试：Python 合同边界未全局
  启用 strict validation；`REPLY_ARCHIVED.step_id` 未绑定最终 `RESULT_READY.step_id`。
- 目标：在不改变公共合同范围和运行时接线的前提下，补齐这两个失败关闭不变量，并用最小负测防止
  回归。
- 当前获批动作：Owner 于 2026-08-17 只批准创建本 corrective approval packet；未批准提交、推送
  或产品实现。

## Acceptance Criteria

- [ ] `_FrozenContract` 的 Python 对象入口启用全局严格校验，拒绝 bytes→str、list→tuple、dict→
  nested model、字符串→Enum 等隐式转换；规范 JSON 入口仍可由 `model_validate_json` 正常解析。
- [ ] `model_copy(update=...)` 从现有 frozen 字段实例重建并重新校验，不能因 `model_dump` 把 Enum/
  nested model 降成 strict 模式无法接受的 Python 字典或字符串。
- [ ] 可用终态的唯一 `REPLY_ARCHIVED` 事件必须与唯一 `RESULT_READY` 事件使用同一 `step_id`；错误步骤
  归档必须稳定失败关闭。
- [ ] 新增负测分别证明 Python coercion 被拒、规范 JSON 被接受、错误 archive step 被拒。
- [ ] 原有 24 例数据集、公共 engine Protocol、唯一 REPLY、证据绑定、owner/checkpoint/replay/终态约束
  均保持不变。
- [ ] 现有 API、worker、丞相图、RuntimeSkill、史馆和 composition root 不导入或实例化公共引擎；
  本任务不接 Direct/LangGraph adapter。
- [ ] 专项 pytest、ruff、全量后端 pytest、M0 authority 回归与根 Harness 全部通过。

## Delivery Constraints

- Base：`1648687933058eee8611c4810561173d8fef1e24`
- Base tree：`954f274cc3f2da3cccaf2c3d97775df6ae0e6eb8`
- 产品范围严格限于：
  1. `backend/app/orchestration/contracts.py`
  2. `backend/tests/test_orchestration_contracts.py`
- Approval packet 范围严格限于：
  1. `.harness/approvals/DUAL-ORCHESTRATION-CONTRACT-V1-CORRECTIVE-20260817.json`
  2. `docs/product/tasks/2026-08-17-dual-orchestration-contract-v1-corrective.md`
  3. `docs/superpowers/plans/2026-08-17-dual-orchestration-contract-v1-corrective.md`
- 单写者：从 approval commit 形成到产品 candidate 推送完成或作废期间，仅
  `codex/dual-orchestration-corrective-approval-20260817` 对本任务拥有写权；所有其他双编排工作窗口
  必须保持只读。任何远端漂移立即作废当前 approval，不做 rebase、merge、squash 或 force。
- 外部副作用：禁止网络、Provider、生产数据库、部署、发布和外部消息；Gitee Git 动作必须逐次获得
  Owner 对精确 SHA/tree 的单独批准。
- 回滚：未来产品候选必须是新的 approval commit 的精确单亲子；回滚该单一 corrective candidate
  即恢复到当前远端行为，approval commit 只保留审计事实。

## Affected Modules

- 模块：Orchestration frozen contracts 与对应合同测试。
- 允许路径：`backend/app/orchestration/contracts.py`、
  `backend/tests/test_orchestration_contracts.py`。
- 依赖模块：现有 `backend.app.orchestration` 公共合同、Pydantic 与 ADR 0028；不新增依赖。
- 非目标：不改 `engine.py`、comparison dataset、其他测试、Harness、authority、任务模板、ADR、API、
  前端、数据库、史馆或 Provider。

## Technical Plan

1. RED：补 Python coercion 与 archive-step mismatch 负测，在远端基线确认按预期失败。
2. GREEN：给 `_FrozenContract` 增加 strict validation；让安全 copy 使用现有字段实例；增加 archive
   step 一致性校验。
3. 回归：运行 manifest 固定的五条命令；任何失败、产品路径扩大或远端漂移立即 STOP。
4. Review：对精确候选做 Python/合同/安全只读审查；修复导致候选字节变化时重新完整验证。
5. Acceptance：M0 `--verify-candidate` 通过后，只报告 candidate SHA/tree；未经 Owner 二次确认不推送。

## Implementation Report

- 当前交付：仅 corrective approval packet 草案。
- 当前产品实现：未开始。
- 当前 Git 外部动作：未执行。
- 草案验证：manifest closed-schema PASS；canonical digest 为
  `sha256:d3858b9b0f544a34117ce230c84ffc89a2fca58eead2fa1f6c578606c67cdf9f`；根 Harness
  `146` 项 PASS；Harness self-test `174` 项 PASS；doctor `--check` PASS；M0 authority 回归
  `12/12` PASS。
- 失败关闭：草案仍未提交且工作树有三份未跟踪文档，M0 `--authorize` 按设计返回
  `STOP / WORKTREE_DIRTY`，未产生产品执行权。
- 剩余风险：其他窗口若继续写同一主线会再次使 approval 失效；单写者窗口必须持续到候选落地。

## Acceptance Review

- 当前结论：`OWNER_DIGEST_CONFIRMED / LOCAL_APPROVAL_COMMIT_AUTHORIZED`。
- 尚未授权：approval push、产品实现、candidate commit/push、merge、部署。
- 本轮授权：允许以冻结 base 为唯一父提交，形成仅含三份 approval 文档的本地 commit；禁止推送。
- 下一门：形成 commit 后，Owner 确认精确 approval SHA/tree，并单独授权普通快进推送。
