# 规格说明：feat-w08-product-acceptance-harness-20260728

## 背景

W08 需要从“本地可运行”进入“产品验收可证”。本变更建立后端 harness 事实源，用于校验 W08 黄金合同、ContractReviewPack 下载和 Shiguan replay 证据形状。

## 范围

- 既有 `chaotang-true-loop` harness 下的 `product_acceptance` 子入口。
- 1 个 RUNNABLE_MINIMUM 黄金合同。
- validator CLI。
- focused pytest。

## 非目标

- 不新增业务页面或 Agent。
- 不替代真实浏览器验收。
- 不构成 W08 closeout。

## 验收

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
- `python3 backend/scripts/harness_doctor.py`
