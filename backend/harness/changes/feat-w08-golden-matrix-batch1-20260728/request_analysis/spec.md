# 规格说明：feat-w08-golden-matrix-batch1-20260728

## 背景

W08 需要 36 个黄金合同。Batch 1 将当前 RUNNABLE_MINIMUM 从 1 个 case 扩到 6 个 case，覆盖制造业/B2B 合同审查的第一批核心风险面。

## 范围

- 6 个合成、无客户秘密黄金合同。
- 覆盖 payment、delivery、acceptance、warranty、liability、ip、confidentiality、termination、dispute、compliance。
- Runner 输出 coverage，pytest 固定覆盖面。

## 验收

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
- `python3 backend/scripts/harness_doctor.py`
