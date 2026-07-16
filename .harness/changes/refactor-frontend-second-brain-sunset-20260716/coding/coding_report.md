# Coding report

- 军机处与上书房改为纯 canonical projector；formal 快照优先，候选/direct/空态不再本地补脑。
- 四个旧决策引擎生产 import 清零；规则知识先蒸馏到 backend golden cases，再标为 test/eval-only。
- 三个无生产调用方的旧 bridge/writer 移入带复核日期的 attic。
- 锦衣卫、工部、刑部与治理侧脑显式降为 `SHADOW/FALLBACK/decision-ineligible`。
- rollout 关闭时只显示无裁决/安全等待，不提供 legacy 回切。
