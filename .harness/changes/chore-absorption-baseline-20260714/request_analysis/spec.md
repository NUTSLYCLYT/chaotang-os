# 规格说明：chore-absorption-baseline-20260714

## 背景

FULL_COURT campaign 的 BASE 已由 `4f77396` 迁移到 repository/runtime-layout 重构 commit `2a92646`。旧 P0 证据不得直接继承，本 change 在新 integration predecessor `f9b3e88` 上独立重跑 P0。

## 当前事实与证据

| 分类 | 结论 | 证据 | 是否阻塞 |
| --- | --- | --- | --- |
| 已确认 | socketpair capability 正常 | preflight `socketpair_send=1` | 否 |
| 已确认 | 真实 DB 迁到 `backend/var/data/fengqun.db` | 前后 SHA/size/mtime | 否 |
| 已确认 | 前端仍有旧 P0 同一组 7 个失败 | 完整 `pnpm test:node` | 否，红灯基线 |
| 已确认 | 无选择后端全量 pytest 仍未获安全授权 | FROZEN PLAN v2 | 是，禁止 campaign DONE |
| 未知 | canonical/legacy 真实流量曲线 | P2 才建计数器 | 是，禁止物理拆旧链 |

## 数据与安全边界

- 测试只能使用 fixture/临时 DB；真实控制面 DB 只做 `stat` 和 `sha256sum`。
- P0 worktree 中 `backend/data/fengqun.db` 与 `backend/var/data/fengqun.db` 测试前后均不存在。
- 不运行无选择后端全量 pytest，不运行真实 provider、高成本模型或发布命令。
- P0 不运行统一浏览器旅程（FROZEN PLAN v2 铁律 11 明确豁免）。

## 非目标

- 不修 7 个前端基线失败，不补 lint script。
- 不开始 P1，不移植 `c06d66d`。
- 不修改 jiqun_ai、大殿/王座、六部功能或生产运行态。

## 验收

`baseline.md` 完整落盘；三层 doctor、tripwire、代表主链、collect-only、TypeScript 与前端完整 node suite 均在有界时间内给出真实结果；真实 DB 三元不变；diff 仅为本 change 证据。
