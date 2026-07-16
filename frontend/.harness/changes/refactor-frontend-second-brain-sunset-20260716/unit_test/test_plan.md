# 单测计划

## 覆盖范围

- 两个 canonical projector、rollout parser、production import graph、SHADOW 边界。
- 后端 golden distillation 与 FALLBACK/missing-evidence quality gate。

## 命令

- 前端 P4 定向 `tsx --test`；后端定向 pytest；前后端全量；TypeScript；build；doctor。

## 未覆盖风险

- 全量已登记的 P6/frontend 7 项与 backend 7 项 known-red 不在本 Packet 修复范围。
- 一次 backend 全量额外失败无法在 P4/基线单跑和整文件顺序复现，记录为测试隔离风险。
