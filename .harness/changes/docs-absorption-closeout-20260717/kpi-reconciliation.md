# P7 KPI 对账（绑定 `f5fa71459f61eb6c2041d30c485e321b1d4c7303`）

所有“前”数值来自
`.harness/changes/chore-absorption-baseline-20260714/baseline.md`。所有“后”数值在
`task/p7-absorption-closeout` 的固定基点复算。定义文件、生产可达性和运行流量分开计数，
避免把“代码还在”“默认不可写”和“线上确实零流量”混为一谈。

## 1. 生产源码 LOC

复算命令：

```bash
git ls-files backend/src backend/web frontend/src \
  | rg '\.(py|ts|tsx|js|jsx|mjs)$' \
  | xargs wc -l \
  | tail -n 1
```

| P0 | P6 ext | 净变化 | 目标 | 判定 |
| ---: | ---: | ---: | ---: | --- |
| 238894 | 240856 | **+1962**（+0.82%） | < 0 | **NOT_MET** |

`git diff --numstat 2a92646..f5fa714 -- backend/src backend/web frontend/src` 按同一扩展名
汇总为 added 6508 / deleted 4546。P6 自身 first-parent 区间
`d7f7436..f5fa714` 为 added 140 / deleted 1413 / net -1273，确实显著收缩，但未抵消此前
Packet 与并行 uplift 的净增长。P7 不改变 P0 分母，也不把新增测试/可靠性实现从生产目录
事后扣除。

## 2. Legacy 写入点

| 口径 | P0 | 当前 | 判定 |
| --- | ---: | ---: | --- |
| `flow_store.py` + `chaotang_store.py` 可调用写函数定义 | 10 | 10 | 物理清零 **NOT_MET** |
| 默认配置下获授权的 production writer ID | 未建 tripwire | 0 | 逻辑单写目标 **MET** |
| 测试 writer ID | 未建 tripwire | 2 | 仅 `pytest-flow-store` / `pytest-chaotang-store` |

机器证据是 `test_runtime_allowlist_contains_only_test_writers` 与
`test_retired_production_writer_ids_fail_closed`。`FENGQUN_LEGACY_WRITE_TRIPWIRE=0` 仍是显式
rollback bypass，因此不能把“默认 production writer 为 0”扩写成“旧写代码已删除”。

## 3. 状态机 / 裁决事实源

P0 五个前端定义文件仍以 deprecated、test/eval-only 形式留在 `frontend/src`，当前合计
1153 LOC（P0 为 1149 LOC，新增 4 行退役声明）。因此按“定义文件”字面口径是 5 → 5，
未物理清零。

生产可达性口径则为：

| 口径 | P0 | 当前 | 判定 |
| --- | ---: | ---: | --- |
| 前端本地裁决引擎 production imports | 活跃（上书房/军机处） | 0 | **MET** |
| 后端裁决 authority + status projection | 多链混用 | 1 条 court-owned canonical 链 | **MET** |

`frontend/scripts/architecture-import-guard.mjs` 的 allowlist 为空，且测试扫描 production
source；正式展示消费 `GET /api/shangshufang/tasks/{task_id}/status` 的 court projection。
这证明“前端不再运行第二状态机”，不证明五个规则壳已物理删除。

## 4. 部门身份事实源

| P0 | 当前 | 目标 | 判定 |
| --- | --- | --- | --- |
| 4 套命名体系、>=7 registry、>=5 映射副本 | backend `departments.yaml` 1 + frontend `dept.ts` 1；其余为派生消费者 | backend 1 + frontend 1 | **MET** |

后端 AST/grep guard 禁止在 `src/`、`web/` 重建完整六部 code set；前端 repo grep guard
禁止 `dept.ts` 外重建身份字典；`dept-yaml-parity.nodetest.ts` 校验两个跨端 SSOT。

## 5. Canonical / legacy 流量曲线

| 时点 | canonical | legacy | 证据质量 |
| --- | --- | --- | --- |
| P0 | `NO_COUNTER_BASELINE` | `NO_COUNTER_BASELINE` | 无计数器 |
| P2/P3 快照 | 三个 canonical stage 均 0.0 | 无连续归零窗口 | 单独进程快照 |
| P7 | 无新的生产观测窗口 | 无新的生产观测窗口 | **INSUFFICIENT_EVIDENCE** |

`migration_telemetry.py` 已提供指标与 production-event sink，但仓库证据没有时间序列、窗口、
采样边界或真实请求量。测试制造的非零计数不能当生产流量。故“canonical 上升、legacy 归零”
目标 **NOT_MET**，P3 daemon 物理删除门继续保持 blocked。

## 6. 阶段结论

已达到：默认 production legacy writer 0、前端本地裁决 production import 0、部门双 SSOT。

未达到：净 LOC 负增长、legacy 写定义物理清零、前端五个 test/eval 定义物理清零、连续
新旧链流量曲线。P7 的诚实结论为 `PARTIAL`；这不阻止 P7 文档包接受独立审查，但阻止
`ABSORPTION_CAMPAIGN_DONE`。
