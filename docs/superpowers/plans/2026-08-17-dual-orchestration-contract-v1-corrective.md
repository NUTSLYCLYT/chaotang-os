# Dual Orchestration Contract V1 Corrective Plan

## 1. Frozen Contract

- Task：`DUAL-ORCHESTRATION-CONTRACT-V1-CORRECTIVE-20260817`
- Base/tree：`1648687933058eee8611c4810561173d8fef1e24` /
  `954f274cc3f2da3cccaf2c3d97775df6ae0e6eb8`
- Current deliverable：只创建三份未提交 approval packet 文档；不提交、不推送、不实现产品。
- Future product paths：仅 `backend/app/orchestration/contracts.py` 与
  `backend/tests/test_orchestration_contracts.py`。
- Exit：补齐 strict Python boundary 与 archive-step binding，不改变运行时接线、API 或数据集。

## 2. Why a New Approval Is Required

原 approval `32fd33e71...` 已被远端产品提交 `164868793...` 消费。最终审查候选 `cb9b6ba82...`
与远端候选同父分叉，无法在禁止 force/merge/squash 的前提下快进。不得复用旧聊天批准、旧 manifest
digest 或旧 candidate SHA；必须从当前远端重新建立 approval commit → one-child product candidate。

## 3. Exact Correction

仅补两个已证明缺口：

1. `_FrozenContract.model_config` 启用 `strict=True`；Python 对象入口拒绝隐式 coercion，JSON 入口保持
   Pydantic 的规范 JSON 解码路径。
2. `model_copy` 使用现有字段实例作为重验证输入，避免 strict 模式下把 nested model/Enum dump 成
   Python dict/string 后自我拒绝。
3. 可用 `ExecutionTrace` 的 `REPLY_ARCHIVED.step_id` 必须等于 `RESULT_READY.step_id`。
4. 对以上三点添加行为负测；不修改其他公共合同或 comparison dataset。

## 4. Authority and Single-Writer Sequence

```text
draft packet
  -> Owner confirms manifest digest
  -> exact 3-path approval commit
  -> Owner confirms approval SHA/tree and authorizes FF push
  -> remote ext-dev == approval commit
  -> M0 --authorize GO for exact task
  -> RED tests in exact 2 product paths
  -> minimal GREEN
  -> verification + independent review
  -> exact one-child candidate
  -> M0 --verify-candidate PASS
  -> Owner confirms candidate SHA/tree and authorizes FF push
```

从 approval commit 形成到产品 candidate 落地或作废，只有
`codex/dual-orchestration-corrective-approval-20260817` 可以写本任务。其他双编排窗口保持只读。任一
窗口改变远端 `ext-dev`，立即停止并重新规划，绝不 rebase、merge、squash 或 force。

## 5. RED → GREEN

1. RED：Python bytes/list/dict/string Enum coercion 在远端基线仍被接受；新增测试后必须失败。
2. RED：构造 `REPLY_ARCHIVED.step_id != RESULT_READY.step_id` 的可用 trace；远端基线仍接受，新增测试后
   必须失败。
3. GREEN：只修改 contracts 与同一测试文件，使上述 RED 变绿。
4. Regress：24 comparison cases、Protocol 无框架 import、owner/evidence/checkpoint/replay/唯一 REPLY 等
   既有测试不得变化。

## 6. Proof Matrix

```bash
cd backend && /usr/bin/python3 -m pytest -q \
  tests/test_orchestration_contracts.py \
  tests/test_orchestration_comparison_cases.py
cd backend && /usr/bin/python3 -m ruff check \
  app/orchestration \
  tests/test_orchestration_comparison_cases.py \
  tests/test_orchestration_contracts.py
cd backend && /usr/bin/python3 -m pytest -q
node --test scripts/product-authority.test.mjs
node scripts/check_harness.mjs
```

验证必须离线；测试只可写临时目录。产品候选冻结后再运行 M0 `--verify-candidate`，任何候选字节变化
都使既有验证和 review 失效。

## 7. Stop Conditions

- Owner 尚未确认 manifest digest，或尚未分别授权 approval commit/push。
- `origin/ext-dev` 不再精确等于当前步骤要求的父提交。
- approval commit 不是 base 的精确单亲子，或超出三份 approval 文档。
- 产品 candidate 不是 approval commit 的精确单亲子，或超出两个产品文件。
- strict 校验破坏规范 JSON 入口或 safe copy；archive-step 约束不能用稳定负测证明。
- 任一验证失败、联网、访问真实 Provider/数据库或出现第二写窗口。

## 8. Rollback

当前阶段无 commit/push，删除三份未跟踪草案即可回到远端基线。未来若 corrective candidate 已落地，
只允许另建经批准的 revert；不得改写历史。旧 approval 和产品提交继续作为审计事实保留。

## 9. Current Verdict

`OWNER_DIGEST_CONFIRMED / LOCAL_APPROVAL_COMMIT_AUTHORIZED`。本轮只授权形成三路径本地 approval
commit；不授权 push、产品实施、candidate commit/push、merge、部署或其它外部动作。
