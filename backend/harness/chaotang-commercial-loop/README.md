# 朝堂商机闭环 Harness

本 harness 证明朝堂默认价值路径可被确定性检查：

```text
线索 -> 方案方向 -> 产品需求 -> 报价/风险 -> 复盘归档
```

默认使用 dry-run。只有在 provider、预算、超时和写入路径都明确时，才使用 `--real` 调用真实蜂群 flow。

## 部门块

- `opc`：把线索转成市场/方案方向。
- `product`：把方向转成产品需求和交付风险。
- `quotation`：输出报价、成本和不可逆风险提示。
- `review`：汇总证据、阻塞和下一步。

## 输入

- `contracts/commercial_loop.schema.json`
- `golden_cases/commercial_loop_cases.json`

## 入口

```bash
cd backend
python harness/chaotang-commercial-loop/scripts/run_harness.py --dry-run --all --no-write-ledger
```

## Golden candidate

失败样本可以进入候选账本。只有人工补齐正确参考答案和 must-not list 后，才能晋升为 golden case。

`--promote-golden` 会写入 review event，并追加候选记录。`--review-board` 会读取 business ledger、observability events、failure samples 和 golden candidates，输出整条商业闭环成熟度评审。

## 测试

```bash
cd backend
python -m pytest -q tests/test_commercial_loop_harness.py
```
