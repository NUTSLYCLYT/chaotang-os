# 真实样本回归(deming:真样本比造的判例更能暴露"框架有、执行空")

放这里的样本用于**每次改判决逻辑后跑回归**,确认引证/接地/severity 不退步。

- `*.txt` / `*.md`:脱敏合同/协议文本(**不要放真实客户可识别信息**——公司名/人名/金额脱敏)。
- 真实客户原件(如 H 盘 PDF)**只在本地跑**,不进仓(隐私 + 非本仓职责)。

## 跑法
```
python scripts/real_sample_regression.py                     # 跑本目录所有样本(需 LLM 网关)
python scripts/real_sample_regression.py /path/to/real.pdf   # 附加本地真实样本(不入仓)
```
不变量(退步即红):① findings 非空 ② 标 grounded 的判决必有 ≥1 条库内可核引证
③ 未接地判决 headline 必含"需人工"(不冒充权威)。
