# Trade Journal · 蜂群信号闭环

每天 9:15 / 14:55 自动从 stock brief 提取具体 buy/sell/watch 信号到这里。
**用途**：周末复盘——验证 bull/bear/portfolio 的判断是否兑现，建立信号置信度。

| 字段 | 说明 |
|---|---|
| Date | 信号日 |
| Source | pre-market / close-alert |
| Agent | bull / bear / portfolio |
| Signal | 具体操作（含标的、方向、价位/比例） |
| Outcome | T+1 / T+7 实际涨跌（手工填或后续脚本回填）|

---

