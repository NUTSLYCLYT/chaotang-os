# 规格说明：refactor-chaotang-endpoint-absorb-20260715

## 背景

P2 已用 tripwire 和观测守门关住 parallel legacy writer。P3 在同一任务分支内按端点
逐步把旧链吸收到 canonical 主链。P3a 先处理风险最低的史官读端点；其旧实现同时读
冻结王座投影与旧复盘存储，事实源分裂，且来源标签被硬编码。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `scribe.py` 同时依赖冻结王座列表与旧复盘读 API | 变更前源码；P3a RED structural test，2026-07-15 | Backend / 已验证 | 否 |
| 已确认事实 | canonical `ShiguanArchive` 保存正式奏折快照、人工裁决、来源与 synthetic 标记；`FinalMemorial` 可为早期空快照补齐正式内容 | `backend/src/db/models.py`、`backend/web/routers/shangshufang.py::_archive_task` | Backend / 已验证 | 否 |
| 已确认事实 | 两表尚无 `tenant_id`，非 default 租户不可安全读取 | 模型定义与 `test_non_default_tenant_cannot_read_unscoped_canonical_archives` | Backend / 已验证 | 否 |
| 未知问题 | P3d 是否满足物理拆除所需观测窗口 | P2 deprecation/canonical 计数待 P3d 汇总 | P3d 门禁 | 是（仅阻塞物理拆除） |

## 数据流与调用链

P3a 旧链：`scribe -> throne memorial projection + legacy retrospective -> response`。

P3a 新链：`scribe -> canonical DB (latest ShiguanArchive per task -> embedded formal
snapshot; missing snapshot -> FinalMemorial) -> same response envelope`。

P3b–P3e 的数据流在各原子检查点开始前补充；不得并行改写。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `GET /api/scribe/lessons` | latest real `ShiguanArchive`，可选 `FinalMemorial` fallback | 史馆页 | 维持 `{success,data:{lessons}}`；正常、空/失败、租户、认证测试 |
| `GET /api/scribe/archive-docs` | 同一 canonical 投影 | CourtDoc adapter / 史馆卡片 | CourtDoc 字段同形；传播 canonical source；不编造 evidence |
| P3b taskDetail/stream | `SwarmRun` / `DecreeExecutionEvent`（待实施） | chaotang 前端 API | 后续原子检查点验证 |

## 范围

- P3a→P3e 五个顺序检查点，共用本 change 与 `task/p3-chaotang-endpoint-absorb` 分支。
- P3a：只改史官两个读端点及其测试/证据。
- P3b：taskDetail 与 stream canonical 投影及最小前端 adapter。
- P3c：manor/direct 等形 dispatch adapter。
- P3d：仅在 P2 计数证据满足时物理拆 daemon；否则只关 feature flag。
- P3e：清空已吸收 writer 白名单并将 legacy 表写路径只读化。

## 非目标

- 不修改冻结的 `backend/web/routers/throne.py`。
- 不裁决庄园产品去留。
- 不在 P3a 创建新的 retrospective/outcome 事实；正式奏折没有内容就诚实返回空。
- 不在 P3e 前合并或宣告顶层 P3 完成。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| synthetic / FALLBACK / DEMO 归档 | 不进入史官真实旧案列表 | canonical tests |
| archive snapshot 缺失 | 同一 canonical DB 中回退 `FinalMemorial`; 仍无内容则跳过 | canonical fallback test |
| 同 task 多次归档 | 只取 `created_at` 最新一条 | duplicate archive test |
| non-default tenant | 因表无 tenant 字段而 fail closed 返回空 | tenant isolation test |
| canonical DB 不可用 | 保持 200 空数组契约并记录 warning | failure contract test |
| 未认证且启用认证 | 401，不进入投影 | auth test |

## 风险与回滚边界

P3a 主要风险是把旧 retrospective 语义误装成 canonical 事实。缓解：仅取正式奏折真实
`lessons`，缺失时取真实 `summary`；裁决 reason 只放 summary；patterns/tags/evidence
保持空。归档端点只展示实际 `ShiguanArchive`，不把未归档/驳回状态臆造成卷宗。

回滚按 P3a 原子 commit；若临时恢复旧读链，必须按 P2 清单的临时恢复程序登记，不能
静默加回 writer 白名单。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-15
- 批准范围：按既定 P3a→P3e 顺序继续执行
- 明确未批准：修改冻结王座；无流量证据物理拆除 P3d；P3e 前合并/宣告完成

## 验收标准

- 每步对应端点正常、失败、权限契约通过。
- 前端调用无 404 / 响应形状漂移，相关 contract audit 通过。
- golden cases 与三层 doctor 通过或与登记基线一致。
- P3a 生产代码不再出现旧复盘存储或冻结王座依赖。
- P3e 后已吸收 writer 白名单清零；整包独立审查 GO 后才允许合并。

## 验证计划

每个检查点执行 TDD RED→GREEN、聚焦 pytest、相邻契约、结构 grep 与 diff review；
P3e 汇总后再执行全量 backend/frontend 测试、API contract audit、三层 doctor 与独立审查。
