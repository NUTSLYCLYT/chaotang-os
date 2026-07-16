# 规格说明：fix-p4-5-semantic-freeze-20260716

## 背景

P5 迁移权威归一前，先冻结会被后续拆表和读模型依赖的语义边界，避免把现有字符串、写入点和默认租户假设继续扩散。用户于 2026-07-16 批准按 P4.5a–f 顺序执行。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `EmperorDecision` 有 6 个生产构造点、10 个 action 字面量；迁移 head 为 011 | AST 盘点、`backend/src/db/models.py`、`backend/alembic/versions/`，2026-07-16 | 契约测试 + 代码审查 | 否 |
| 已确认事实 | CourtReview 当前生产构造点基线为 8，不是早期计划中的 7 | P4.5d 独立 AST multiset | 冻结清单 + 架构测试 | 否 |
| 已确认事实 | swarm sections 已含完整部门事实，但旧投影缺少 `department_memorials`，导致 canonical signal 退成 GRAY | `backend/src/shangshufang_loop.py`、前端 canonical read model，2026-07-16 | JSON Schema + API/前端消费者回归 | 否 |
| 已确认事实 | 真实库不得作为迁移试验目标 | `backend/tests/conftest.py` tripwire 与项目边界 | 只读 size/mtime/inode/SHA-256 前后对比 | 否 |
| 已确认事实 | 正式执行事件原先无失败终态；worker 事务边界不支持独立 `reports.failed` 事实 | `backend/docs/adr-2026-07-16-execution-state-semantics.md` | AST 词表守门 + 独立只读审计 | 否 |
| 已确认事实 | 八张产品权威核心表共有 20 个生产 ORM 构造点；线程局部解析会对未知上下文回退默认租户，不能用于 lineage | `test_core_tenant_lineage_contract.py` 与独立只读审计 | AST 精确计数 + 传播测试 | 否 |

## 数据流与调用链

请求/worker 写入真实事件与工件 → 派生执行状态读模型；蜂群输出 → 独立质量门 → CourtReview/正式奏折投影；请求租户上下文 → 8 张核心 lineage 表。P4.5 只做加法冻结，不提前实施 P5 或 FCV1 拆表。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `EmperorDecision.kind` | `src.emperor_decision_kind` + 生产写入口 + DB check | 裁决账本、后续拆表 | 012 回填；未知 action fail closed；非 NULL |
| `execution_state` | 真实事件词表、attempt 与工件 | 后端读模型/前端消费者 | 保留既有 `status` 枚举；全组合末行 quarantine |
| `DepartmentOpinionV1` 投影 | swarm result sections | 奏折读模型 | 完整字段投影，不建立一等对象表 |
| nullable `tenant_id` lineage | 真实请求上下文 | 8 张核心表 | 013 expand-only；无上下文留 NULL 并 quarantine，禁止默认租户掩盖 |

## 范围

P4.5a `kind`；P4.5b execution state；P4.5c quality gate import seam；P4.5d CourtReview 写入基线；P4.5e DepartmentOpinionV1；P4.5f tenant lineage + 013。

## 非目标

不改前端既有 status 枚举；不拆 CourtReview；不建立 DepartmentMemorial 新表；不声称完成租户隔离；不开始 P5；不迁移真实数据库。

另已记录但不在本包修复：`frontend/config/ministry_output_contracts.yaml`/validator 与可执行 `DepartmentOpinionV1` JSON Schema、TS 类型存在既有漂移；本包不把 V1 扩写成 YAML 的另一套模型。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 未知 EmperorDecision action | 写入与 012 升级均 fail closed | 映射单测 + 临时旧库迁移失败测试 |
| 004b 从当前 metadata 预建 `kind` | 012 检测已有列/约束后幂等继续 | 空库 `alembic upgrade head` |
| direct 只有回执、无真实执行工件 | `receipt_only`，不得伪报 completed | P4.5b 六路径 fixture |
| council 只出现部分工件 | 当前 worker 是单事务边界，该组合必须 inconsistent/quarantine，不发明 partial 正常态 | 全组合性质测试 |
| 缺 tenant 上下文 | 留 NULL 并进入 quarantine，不填默认租户 | P4.5f 写入与迁移测试 |
| task/outbox 两个已知 tenant 不一致 | worker 在派单前 fail closed，并留下失败尝试 | P4.5f worker 冲突测试 |
| 013 遇到缺表、NOT NULL 或默认 tenant | 阻断升级，不接受伪兼容 schema | 013 临时库参数化测试 |

## 风险与回滚边界

风险集中在历史 action、attempt 跨代排序和 tenant 伪归属。每步独立提交；代码回滚可 revert 对应微步。012/013 的生产降级属于结构性操作，必须先导出并核验数据；本包只在临时 SQLite 演练。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-16
- 批准范围：修订后的 P4.5a–f 与 D6-L，按序执行
- 明确未批准：真实库迁移、提前开始 P5、默认租户回填、安装生产 hook

## 验收标准

- a–f 每步有 RED→GREEN 和原子提交。
- 012/013 在旧形态临时库与空库全链均通过，未知数据 fail closed。
- 真实库指纹不变；backend/root doctor 通过。
- 全包独立审查 GO 后才允许合入 ext 或进入 P5。

## 验证计划

定向 pytest、AST 架构守门、Alembic 临时 SQLite upgrade/downgrade、空库 upgrade head、真实库只读指纹、两层 doctor；最终执行相关后端回归和独立 packet review。
