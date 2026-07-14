# 规格说明：chore-shangshufang-step0-contract-baseline-20260714

## 背景

用户批准十阶段上线路线，并要求只执行 S1。当前 prod:doctor 为 STOP，且上书房正式链存在契约、来源标签和控制面设计分歧。本 change 先建立不改变运行行为的可信基线，为后续独立 worktree 的 S1 实现提供证据。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 3050 是 foreign cwd；prod:doctor STOP | `baseline.md`，2026-07-14 | 进程/doctor 取证 | 是，阻塞发布 |
| 已确认事实 | 四个正式 API 响应未定义 response model | OpenAPI + contract baseline test | pytest | 是，阻塞 S4 |
| 推测 | 持久化控制面可包裹现有蜂群算法 | `adr.md` | S8 故障/容量验证 | 是，阻塞 DAG 扩大 |
| 未知问题 | 生产拓扑、数据规模、tenant 回填、质量门样本 | `baseline.md` | 各阶段 Owner | 是，按 blocks_steps |

## 数据流与调用链

见 `baseline.md` 第 1 节；正式路径为前端上书房 → frontend adapter/proxy → backend shangshufang router → Chancellor → DB/outbox → worker/swarm → status → 前端。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| draft/confirm/status/decision | FastAPI Pydantic/OpenAPI | frontend adapters | Python OpenAPI snapshot + Node path freeze |
| sourceLabel | backend runtime + frontend vocabulary | status/UI | golden cases；已知硬编码 LIVE 漂移 |
| engineTier | 尚未进入正式 API | 未来 status/UI | 候选枚举记录，Step 8 前 BLOCKED |

## 范围

- 契约快照和 direct/council/mixed/422 characterization tests。
- 本机进程、STOP、数据库只读基线。
- 控制面 ADR、威胁基线、旧路径和 READY_FOR_REVIEW 队列。
- 完善 `plans/chaotang-os-launch-blueprint-2026-07-14.md`。
- Step 0 closeout：入口清算、D0/D1/D2 ADR、双黄金资产目录、生产/数据治理 unknowns 和动态 CI 失败基线。

## 非目标

- 不停止 foreign 3050，不修改 deploy/runtime，不修复 API 运行逻辑。
- 不进入 S2–S10，不把测试绿灯声明为生产 READY。
- 不读取或复制客户正文，不修改用户已有脏树文件。
- 不实施 tenant migration、状态机、worker、DAG、质量门或 UI；这些仍按 canonical Step 1–12 领取。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| OpenAPI 响应仍宽松 | 测试冻结为 known gap，不美化成熟度 | snapshot test + baseline |
| prod:doctor STOP | 保持 STOP，不降低门槛 | doctor 原始退出码 2 |
| 当前工作区脏 | 只修改授权文件，不 reset/stash | git status/diff review |
| 无 UI 行为变化 | 仍需冻结当前真实浏览器 happy-path 基线；foreign 3050、非隔离 DB、凭据或环境不满足时必须 BLOCKED | Playwright trace/screenshot + network/console；不得用 Node test 替代 |

## 风险与回滚边界

新增测试和文档可按文件回滚，无运行数据变化。停止旧进程和路径替换必须在后续独立 S1 worktree、有可回滚替代 artifact 后执行。

## 计划确认记录

- 批准人：项目用户
- 批准日期：2026-07-14
- 批准范围：十阶段路线全部采纳，当前只执行 S1 基线；固定 TDD 与 verification-loop
- 明确未批准：不得跳入 S2–S10；不得未经替代 artifact 停止 foreign 3050

## 验收标准

- 后端契约 baseline、golden cases 和前端 adapter path baseline 全绿。
- baseline/ADR/threat/inventory 能区分事实、推测、未知和阻断步骤。
- launch blueprint 反映当前 SHA、S1 进度、十阶段映射和外部信任锚硬门。
- 三层 doctor、相关测试、typecheck、diff review 通过或诚实记录失败。

## 验证计划

- 后端：新契约测试 + 既有上书房 API/路由/outbox 契约测试。
- 前端：新 Node contract test + TypeScript + harness doctor；固定 `3050 + /chaotang`、真实后端和隔离测试身份/DB 的 Playwright happy-path baseline，无法安全运行时保持 BLOCKED。
- 根/后端 doctor、diff check；对抗复审。
