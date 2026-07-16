# 变更摘要：refactor-frontend-second-brain-sunset-20260716

| 字段 | 值 |
| --- | --- |
| Change ID | refactor-frontend-second-brain-sunset-20260716 |
| 类型 | refactor |
| 状态 | P4a_P4b_P4c_VERIFIED / CLOSEOUT_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260716 |

## 范围

- 主线：FULL_COURT_V1 absorption P4，严格按 P4a 军机处 → P4b 上书房 →
  P4c 规则蒸馏后退役；三步共用本 change 与任务分支。
- 事实源：既有 court-owned `GET /api/shangshufang/tasks/{task_id}/status` 的
  `task/review/formal_memorial/execution_status` 与 swarm-runs；前端只做格式化、分组和
  视觉映射，不再产生六部意见、御史结论、综合报告或圣裁。
- 文件：军机处/上书房投影与测试、生产 import 守门、后端 golden cases、四个本地引擎
  的 deprecated/test-only 边界，以及本 change 证据。若现有读模型确实缺字段，只允许
  扩展 court-owned projection；平台路由族保持冻结。
- 验证：每步 RED→GREEN；生产 import/sourceLabel 守门；前后端相邻与全量套件；三层
  doctor；上书房下旨→军机处看状态→圣裁浏览器冒烟；数据库前后指纹一致。
- 基线：`feature-chaotang-ext@188fb3d`；worktree
  `~/Projects/.fullcourt-worktrees/p4-frontend-second-brain-sunset`；真实数据库 SHA-256
  `10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2`，三层 doctor 0/0。
- P4a：RED 为 projector module 缺失（1 suite failed）及军机处四项受限 import
  （1 failed / 4 passed；扩展 marker 后 2 failed / 4 passed）；GREEN 为 projector 4、
  import/marker guard 6、军机处相邻合计 20、case orchestrator 3，tsc 0，frontend doctor 0/0。
- P4b：RED 为 projector module 缺失、上书房四项受限 import、旧 MVP 反向断言各 1
  failed；GREEN 为 projector 6、import guard 12、MVP 4、上书房相邻 30，tsc 0。
  正式快照优先于候选；direct 回执、候选阻断与空态分别诚实展示；终态空读继续有限重试。
- P4c：蒸馏 RED 3 failed / 1 passed（schema/dataset 缺失），资产入库后发现并修复
  `FALLBACK + missing_evidence` 仍可过 quality gate，扩展相邻集通过；退役 import RED
  为 1 failed / 5 passed、精确列出 6 个生产 import，GREEN 为 allowlist 清零且 bridge/guard
  16 passed。侧脑诚实降级 RED 4 failed，GREEN 4，连同相邻共 21 passed；tsc/doctor 全绿。
- P4c 保留策略：四引擎只标 deprecated、供 test/eval；三个无生产调用方的 writer/bridge
  搬入 `dev/_attic/frontend-second-brain-2026-07-16/`，恢复须新 change 重审，复核日 2026-08-16。
