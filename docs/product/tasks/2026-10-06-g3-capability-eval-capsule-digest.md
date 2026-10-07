# G3 能力评测胶囊摘要修复

## Status

Ready

## Product Definition

- 用户确认：2026-10-06，当前对话明确批准继续 G3 能力评测，允许修改相关评测代码与测试，不允许 push/deploy。
- 问题：6 个离线能力胶囊的 `capsule.json` 与 `capsule.lock.json` 未绑定当前磁盘评测对象，导致 checked-in capsule 验证出现 `artifact_digest_mismatch`。
- 目标：仅重建 6 个胶囊的内容摘要与锁文件，使其与当前已提交评测对象一致，并保留候选零权限、离线和不可晋升边界。
- 非目标：不修改评测算法、业务运行时、UI、权限、ADR、Harness、模型配置、数据库、部署、外部网络或 Git 远端状态。

## Acceptance Criteria

- [ ] `scripts/capability_capsule.test.mjs` 全部通过，6 个候选和隔离胶囊均通过摘要与锁文件校验。
- [ ] `scripts/capability_eval.test.mjs` 全部通过。
- [ ] Python 离线 runner 对当前 38 个 case 返回 `total=38`、`passed=38`、`unverifiable=0`。
- [ ] Node 评测继续保持 `authorizesPromotion=false`、`promotionDecision=not-authorized` 和无网络策略。
- [ ] 最终候选只修改下列 12 个胶囊元数据文件，不带入其他工作区改动。

## Delivery Constraints

- 范围：仅 6 个能力胶囊的 `capsule.json` 与 `capsule.lock.json`。
- 兼容性：保持当前评测对象内容、authority manifest、候选生命周期和零权限边界不变。
- 风险与限制：本机项目 `.venv` 不含 Python 解释器；验证使用已配置的 Codex Python runtime，不安装依赖，不读取密钥，不调用模型或外网。
- 技能计划：`codex-engineering-workflow`、`verification-before-completion`；不使用 Claude 或外部 Agent runner。
- Codex-only：是。

## Affected Modules

- 模块：capability candidate capsule metadata and content-addressed lockfiles。
- 允许路径：由对应 approval manifest 精确列出的 12 个 `capsule.json` / `capsule.lock.json`。
- 依赖模块：现有 `scripts/capability_capsule.mjs`、`scripts/repair_capsule_digests.mjs` 和已提交 evaluations.json。

## Technical Plan

1. 先在当前 HEAD 上确认 capsule 测试 RED 和 Python/Node 评测基线。
2. 使用仓库既有官方 digest/lock builder，只更新摘要和锁文件，不修改 objects 内容。
3. 运行 capsule、Node evaluation 和 Python 38-case 离线验证。
4. 检查 diff 只包含 12 条批准路径，再报告候选身份；不 push/deploy。

## Implementation Report

### 治理说明（先于交付内容）

- 本报告由 WorkBuddy 于 2026-10-07 按 owner"灭红灯"授权补录；内容全部来自仓内可查事实
  （提交、审批 manifest、评测对象 provenance），无推测。
- 对应审批：`.harness/approvals/CT-G3-CAPABILITY-EVAL-CAPSULE-DIGEST-20261006.json`（校验 VALID）。

### 交付内容（仓内事实）

- `b1c55f63` feat(eval): T03 capability eval actuals 38/38 green + judgement skip semantics
  —— 38 个评测 case 全绿，落地 judgement skip 语义。
- `7b3cbb4b` fix: rebuild candidate capsule locks after eval actuals
  —— 重建候选胶囊 `capsule.json` / `capsule.lock.json` 内容摘要，解决
  `artifact_digest_mismatch`（本任务的核心目标）。
- 治理记录：`bd887b4d` governance: approve G3 capability capsule digest repair。
- 评测对象 provenance（各 `evaluations.json`）："8/15 评测体系种子" 吸收 38 个黄金 case
  （`absorbedBy: wb-eval-seed/absorb-38-golden-cases`，来源 commit `92007a2d`），
  5 个候选（decision-quality-gate / hubu-financial-grounding / hubu-payment-three-gates /
  libu-responsibility-authority-chain / rites-war-truthfulness）+ rites-message-quality-gate
  objects，均含 `synthetic: true`、`network: false`、实际值 provenance（fill_eval_actuals,
  court-agent-v9, deepseek-flash, temperature 0）。

### 验证证据（记录于 manifest verification 与提交说明）

- Python 离线 runner：`total=38 passed=38`（judged complete via eval_runner，simulator 交叉核对 0 mismatch）。
- Node 评测保持 `authorizesPromotion=false`、`promotionDecision=not-authorized`、无网络策略
  （候选零权限、离线、不可晋升边界未破坏）。
- 本机沙箱限制说明：WorkBuddy 沙箱内 spawnSync git 受限（EBUSY），Python/Node 运行时
  验证无法在此环境复跑；上述数据以提交与 manifest 记录为准，owner 环境可复验：
  `python backend/harness/capability_candidates/eval_runner.py --all --json` 与
  `node scripts/capability_capsule.test.mjs`。

## Acceptance Review

Pending。
