# 任务：docs-mainline-a-truth-audit-20260719

## 任务 1：九环节真实度审计

- 目标：主线 A 链条逐环节三态标注（真实/降级/假数据）。
- 前置条件：P14 GO（前端环节已复审）；业主批准审计包。
- 输入：`ShangshufangPage.tsx`、`shangshufang.py`、`finance_intel_loop_contract.py`、`jinyiwei_search.py` 源码直读。
- 输出：`truth-audit.md` 九环节表 + 资产盘点 + PKT-A1~A3 整改排序。
- 涉及文件：本 change 目录内新增。
- 状态 / 数据变化：无，只读。
- 验证命令与证据：全部结论带 file:line；`rg` 交叉验证无隐藏取证路径。
- 回滚边界：删目录。
- 完成定义：验收标准 1–4 达成，发现的 HIGH 未被顺手修复。

## 后续（不在本包）

- PKT-A1：EDGAR 真取证 + CIK 全量 + sourceLabel 三态诚实标（捆绑包）。
- PKT-A2：户部实算（companyfacts 喂 compute_finance_metrics + 真实 quality_score）。
- PKT-A3：事故日回测夹具进黄金样例（台账 #3）。
- 上线内测（牌 A）。
