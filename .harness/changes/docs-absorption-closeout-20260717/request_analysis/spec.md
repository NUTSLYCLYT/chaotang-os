# 规格说明：docs-absorption-closeout-20260717

## 背景

FULL_COURT_V1 absorption P7 负责对 P0 基线做机器可复算的阶段对账，并修复
`test_commit_closeout_check.py` 中依赖已搬迁真实文档的陈旧 fixture。P7 是阶段对账包，
不是 P8/P9 之后的 campaign 终审；本包不得输出 `ABSORPTION_CAMPAIGN_DONE`。

基点固定为已通过 P6 review-v2 并合入远端 ext 的
`f5fa71459f61eb6c2041d30c485e321b1d4c7303`。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 文档查重负例依赖已不存在的 `backend/docs/qintianjian.md`，因此固定返回空列表 | `cd backend && python3 -m pytest -q tests/test_commit_closeout_check.py::test_check_doc_duplicates_flags_overlapping_new_topic`，2026-07-17，1 failed | Backend / RED 实跑 | 是（P7） |
| 已确认事实 | P0 LOC 口径为 tracked production source；基线 `238894` | `.harness/changes/chore-absorption-baseline-20260714/baseline.md` | Project / 复算 | 否 |
| 已确认事实 | P3 只有单进程零值快照，没有 canonical 上升与 legacy 连续归零窗口 | `.harness/changes/refactor-chaotang-endpoint-absorb-20260715/deferred-boundaries.md` | Backend / 文档与指标实现复核 | 是（campaign DONE） |
| 已确认事实 | P8 未开工；P9 只有 P0 前并行 uplift，没有顶层 Packet GO/核销单 | Git first-parent history 与 P7 对账表 | Project / DAG 复核 | 是（campaign DONE） |

## 数据流与调用链

```text
P0 baseline + ext@P6
  -> 固定命令复算 LOC / writer / state-machine / department SSOT
  -> 对照 P2/P3 telemetry 证据
  -> 更新 known-red 与原始归并审查状态
  -> 输出 PARTIAL + 未闭环清单
```

文档查重测试使用独立临时 Git 仓库：创建并 stage fixture 文档 → 将 checker 的 `ROOT`
指向该仓库 → 运行真实 `git ls-files docs` → 验证新主题重叠告警。测试不再依赖主仓某个
历史文件是否仍存在。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| P0 KPI 口径 | `chore-absorption-baseline-20260714/baseline.md` | P7 KPI 表 | 原命令、原分母，不重定义 |
| legacy writer 授权 | `backend/src/legacy_write_tripwire.py` | legacy writer 调用点 | allowlist 只能含两个 pytest ID；默认 fail closed |
| 前端本地裁决可达性 | `frontend/scripts/architecture-import-guard.mjs` | frontend production graph | production import violations 必须为 0 |
| 部门身份 | backend `departments.yaml` + frontend `dept.ts` | 两端派生注册表 | backend grep guard + frontend SSOT/parity tests |
| migration traffic | `migration_telemetry.py` + production event sink | P7 流量曲线 | 没有连续窗口数据时必须标 `NOT_MET` |

## 范围

- 修复 commit-closeout 文档查重测试的仓库资产耦合，保留真实 Git 行为。
- 新增 P7 KPI、Packet 状态、known-red、deferred 与未验证项对账证据。
- 更新 `mainline-absorption-review.md` 的 done/deferred 状态。
- 更新 known-red ledger 中已由 P6/P7 关闭的项目。

## 非目标

- 不修 lawyer RAG、Munger roster、Tianjian contract 或真实 LLM 字面量断言。
- 不执行 P8/P9，不补造生产流量，不删除仍用于 rollback/test 的 legacy writer 定义。
- 不把 test/eval-only 前端规则壳误报为物理删除。
- 不修改生产数据库、部署或服务。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| fixture 文档在主仓被移动/删除 | 查重测试仍稳定验证重叠主题 | 临时 Git 仓库回归 |
| 新文档本身已 tracked | 不告警 | `test_check_doc_duplicates_ignores_already_tracked_files` |
| KPI 目标未达 | 原样标 `NOT_MET`，不得换分母 | `kpi-reconciliation.md` |
| 流量时间序列不存在 | 记录 evidence gap，不以单进程零值冒充归零曲线 | `kpi-reconciliation.md` |
| P8/P9 未 GO | P7 只能申报阶段包 ready，campaign 为 PARTIAL | `packet-status.md` |

## 风险与回滚边界

测试改动只影响 fixture，不改变 checker 的生产规则；可单文件回滚。文档对账是追加式证据，
如复算命令或 SHA 错误必须修正文档并重新走精确 SHA review，禁止静默覆盖历史证据。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-17
- 批准范围：按既定顺序继续 P7；修复 P7 指定 known-red 并完成诚实对账
- 明确未批准：P8/P9 实现、部署、范围外 known-red 修复、campaign DONE 宣告

## 验收标准

1. commit-closeout 目标测试先 RED 后全文件 GREEN，fixture 不依赖主仓真实文档。
2. P0 三类 KPI 和流量证据均有固定命令、数值、判定；未达项明确列出。
3. mainline、known-red、deferred 与 Packet 状态互相一致。
4. backend/frontend/root doctor、相关守门和全量套件结果有落盘证据。
5. 独立 Claude review 只绑定精确实现头；GO 前不得合 ext。

## 验证计划

- `cd backend && python3 -m pytest -q tests/test_commit_closeout_check.py`
- backend legacy writer、department SSOT、golden distillation 定向测试。
- frontend architecture import guard、department SSOT/parity 定向测试。
- P0 LOC 命令、grep/allowlist 事实复核、三层 doctor。
- backend/frontend 全量套件；失败逐项与 known-red ledger 对账。
