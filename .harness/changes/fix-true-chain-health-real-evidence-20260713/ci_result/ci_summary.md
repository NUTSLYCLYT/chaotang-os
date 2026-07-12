# CI 摘要：fix-true-chain-health-real-evidence-20260713

## 命令

- `python3 -m pytest -q tests/test_true_chain_health.py tests/test_contract_alignment_p0.py::test_true_chain_health_contract_returns_evidence_backed_readiness -v`
- `python3 scripts/harness_doctor.py`
- `systemctl --user restart chaotang-api.service`
- `node frontend/scripts/prod-doctor.mjs --json`

## 结果

3 passed；doctor 0 errors；真实端点 ready/LIVE_ENGINE；production doctor 4/4，decision PROD。
