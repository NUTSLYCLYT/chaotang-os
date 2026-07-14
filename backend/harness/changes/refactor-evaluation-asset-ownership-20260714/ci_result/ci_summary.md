# CI 验证摘要

## 验证命令

```bash
node backend/harness/deep-research-skill-distillation/evaluators/run-deep-research-harness.mjs
node backend/harness/hubu-investment-swarm-gate/evaluators/run-hubu-investment-gate.mjs
cd backend && python scripts/harness_doctor.py
node scripts/harness-doctor.mjs
```

## 结果

上述命令在本地隔离工作树中通过；运行报告仅写入忽略的 `artifacts/`。
