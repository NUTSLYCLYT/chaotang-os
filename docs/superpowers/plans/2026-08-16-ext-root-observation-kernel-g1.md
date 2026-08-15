# ext Root Observation Kernel G1 Plan

## 1. Contract

- Task：`EXT-ROOT-OBSERVATION-KERNEL-G1-20260816`
- Base/tree：`16e9cc38d5e9d003bae49d79f644954c12cba728` /
  `a8cf0bed1184518b42fc2461d5c2c930b8232c4a`
- Scope：任务文件登记的十个 exact paths。
- Exit：`CONDITIONAL PASS / NO INDEPENDENT REVIEW`，产品 authority 仍 STOP。

## 2. RED

1. 先创建 `scripts/harness-doctor.test.mjs`。
2. 证明缺少 doctor 时测试因真实能力缺失失败。
3. 覆盖 duplicate JSON keys、unknown fields、path collision、READY/product impersonation、磁盘漂移、
   authority 投影、CLI 命令面和无 network/write/authorization surface。

## 3. GREEN

1. 创建 closed schema 与 exact manifest。
2. 实现 pure manifest/schema/disk validators 和 ext `--status` 观察。
3. 实现 `--check`、`--status`、`--ready`；任何检查结果都不能产生产品 true。
4. 替换 root `AGENTS.md` 过时事实，创建 Owner 与边界文档。
5. 更新 `scripts/check_harness.mjs` 的 REQUIRED_FILES、literals 和 self-test registration。

## 4. Verification

```bash
node --test scripts/harness-doctor.test.mjs
node scripts/harness-doctor.mjs --check
node scripts/harness-doctor.mjs --status
node scripts/harness-doctor.mjs --ready  # expected exit 2
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
node --test scripts/execution_authority_ext.test.mjs
node scripts/execution_authority_ext.mjs --status
git diff --check
```

每轮还必须断言：HEAD/base 与 remote 不漂移、scope 精确十路径、fingerprint 不变、doctor check/status
非授权、ready exit 2、ext authority STOP/product false。正文或代码变化后从 1/10 重算。

## 5. Review and Handoff

- 使用主会话 code review 与 security review 检查 diff；不虚构 independent reviewer。
- Critical/Important 必须修复后重新验证；Minor 显式记录。
- 候选形成后报告 SHA/tree/diff/fingerprint；commit/push 另行请求 Owner 确认。
