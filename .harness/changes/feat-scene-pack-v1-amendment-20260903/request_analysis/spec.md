# 规格说明：feat-scene-pack-v1-amendment-20260903

## 背景

用户要求在 `ext-dev` 落地 “Scene Pack V1 第一批真实场景闭环”，让大殿首页可见 5 个高优先业务场景，并让四个高付费场景形成可真实演示的输入、结构化输出、军机处任务卡和详情查看闭环：

- `single-product-export-diagnosis`：单品出海诊断。
- `b2b-inquiry-conversion`：B2B 询盘成交。
- `contract-cashflow-risk`：合同与回款风控。
- `enterprise-growth-diagnosis`：企业经营增长诊断。

本能力只能复用现有朝堂主链，不得形成第二套 Agent、任务、权限、部门、预算、证据或归档事实源。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 根架构声明唯一业务运行主线为 `Shangshufang confirm -> ChancellorRouteDecision -> OutboxEvent -> department/swarm reports -> CourtReview -> quality/provenance gate -> FinalMemorial -> EmperorDecision -> ShiguanArchive` | `.harness/wiki/architecture.md`，2026-09-03 读取 | Root Owner / Codex | 否 |
| 已确认事实 | 大殿属于冻结边界；本次用户明确点名大殿，因此允许在获批施工后触碰，但必须记录原因和验证 | `.harness/rules/project-boundaries.md`，2026-09-03 读取 | Root Owner / Codex | 否 |
| 已确认事实 | `execution-authority --authorize` 当前返回 `STOP / AMENDMENT_APPROVAL_REQUIRED` | `node scripts/execution-authority.mjs --authorize`，2026-09-03 | Root authority / Codex | 是 |
| 已确认事实 | 当前 checkout 不是 `ext-dev`，本地 `origin/ext-dev` 为 `6a2c4dd8d4cf13ed34d5665deef4307ac2801569` | `git rev-parse`，2026-09-03 | Git evidence / Codex | 是 |
| 用户授权 | 用户批准创建并执行本 amendment 的范围，并后续要求将 B2B 询盘成交升级为真实链路；不授权 push、merge、deploy | 2026-09-03 chat | Product Owner `lyt` | 否 |
| 已确认事实 | B2B 追加要求改变了 amendment 内容，旧 digest `fbc4aa05019dade11cceda17fd61ae75fd8ec8c8656765d91d03dc9a7a4ee0ed` 不再可作为施工授权 | `amendment.md`，2026-09-03 | Product Owner + Codex | 是 |
| 已确认事实 | 企业增长追加要求再次改变 amendment 内容，B2B 扩展 digest `44fd22c41fd73e3b3aba4c2f371b6fd19432a2f297ef1774a3a10fa3459c32a3` 不再可作为施工授权 | `amendment.md`，2026-09-03 | Product Owner + Codex | 是 |
| 未知问题 | 后续产品实现应绑定哪个 exact base：本地 `origin/ext-dev`、本地 `ext-dev`，还是更新后的远端 `origin/ext-dev` | Git 远端未在本轮 fetch；当前网络/外部状态未核验 | Product Owner + Release Owner | 是 |

## 数据流与调用链

Scene Pack V1 只作为现有主链的入口和投影层：

```text
大殿 Scene Pack 入口
  -> Scene Pack Registry
  -> 场景输入 / 附件引用
  -> 现有丞相路由与 flow 组合
  -> 结构化 SceneRun 结果
  -> BoardMission 军机处投影
  -> 用户人工查看 / 手动推进 / 史馆归档引用
```

首批真实场景的能力映射：

| 场景 | 必须复用能力 | 不允许新增 |
| --- | --- | --- |
| `single-product-export-diagnosis` | `flow_product`、`flow_jinyiwei`、`flow_quotation`、`flow_haolong`、丞相裁决、证据链 | 新出海引擎、新 Agent 池、自动外联 |
| `b2b-inquiry-conversion` | `flow_jinyiwei`、`flow_product`、`flow_quotation`、`flow_haolong`、丞相裁决、军机处销售跟进、史馆归档 | 自动发邮件、自动报价承诺、自动联系客户 |
| `contract-cashflow-risk` | 丞相路由、锦衣卫核验、户部回款风险、刑部合规提示、工部交付可行性、史馆归档 | 自动签约、自动修订、自动报价、自动发送 |
| `enterprise-growth-diagnosis` | 丞相、户部、工部、礼部、锦衣卫、军机处、史馆、`flow_product`、`flow_jinyiwei`、`flow_quotation`、`flow_haolong` | 虚假收益承诺、替代交易决策、自动外部执行 |
| 其他 1 个场景 | Scene Pack 统一输入和输出壳、显式 `stubbed` | 假装 LIVE 结论 |

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `ScenePack` | 后端 registry / DB seed | 大殿入口、场景页 | 5 个固定 slug；按 `sortOrder` 或 `sort_order` 排序；stub 场景显式标识 |
| `SceneRun` | 后端场景运行 API | 场景结果页、军机处看板 | 统一输出：`verdict`、`confidence`、`riskGrade`、`opportunityGrade`、`missingItems`、`nextActions`、`evidenceRefs`、`summaryForUser`、`canProceed` |
| `BoardMission` | 后端从 `SceneRun` 自动投影 | 军机处 Scene Pack 看板 | 状态映射：`created->todo`、`running->in_progress`、`blocked->blocked`、`completed->done`、`failed->blocked` |
| 证据引用 | 现有证据链 / user_file / official / company / news / database / model_inference | 结果详情、质量门、史馆引用 | 不得把模型推断升级成外部事实 |

候选 API：

| 方法 | 路由 | 说明 |
| --- | --- | --- |
| `GET` | `/api/court/scene-packs` | 返回 5 个场景入口，含 `canExecute` 与 `exampleHint` |
| `GET` | `/api/court/scene-packs/:slug` | 返回场景定义、输入字段说明和演示样例 |
| `POST` | `/api/court/scene-runs` | 创建运行，入参 `packSlug`、`inputs`、`attachments`，返回结构化结果和 `runId` |
| `GET` | `/api/court/scene-runs/:runId` | 返回运行详情和关联 `missionId` |
| `GET` | `/api/court/military-office/missions` | 支持 `stage`、`risk_grade`、`pack_slug` 筛选 |
| `PATCH` | `/api/court/military-office/missions/:missionId` | 手动更新 `stage`、`nextMilestone`、`owner`、`pinned` |

## 范围

- 数据层：新增或扩展 `scene_packs`、`scene_runs`、`board_missions`；如现有任务/案卷表可承载，优先复用并以 migration 证明不重复事实源。
- 后端：提供最小 API，四个真实场景调用现有 flow 组合，一个场景返回显式 demo/stub 结构。
- 前端：大殿 5 卡片、共用场景执行页、军机处 Scene Pack 看板和任务详情。
- 演示数据：电池/PACK/储能单品出海样例、B2B 询盘样例、B2B 合同付款风控样例、企业经营增长诊断样例，必须 `demo=true`。
- 验收：Playwright 覆盖大殿入口、四个场景提交、结果展示、军机处任务生成和详情查看。

## 非目标

- 不新增 LangGraph/flow 编排替代品。
- 不新增 Agent 框架、能力池、部门事实源或独立项目账本。
- 不绕过上书房确认、丞相路由、军机处案卷、部门执行、证据、质量门、用户裁决和史馆归档主链。
- 不自动签约、付款、报价、群发、邮件发送、CRM 写入、外部发布或 deploy。
- 不将 demo/stub 结果显示为 LIVE。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 关键输入缺失 | 返回 `status=blocked`、`riskGrade=high`、明确 `missingItems`，不生成最终签约/报价/市场结论 | API 测试 + Playwright blocked path |
| 场景为 stub | 返回结构一致结果，显式 `implementationStatus=stubbed` 和 `demo=true` | API 测试 + UI 标签 |
| 合规/签约/报价动作 | 只显示“需人工确认”，不得自动执行外部动作 | 文案快照 + 负向测试 |
| 军机处任务更新 | 仅手动状态流转，不触发外部发送、发布、付款或签署 | API PATCH 测试 |
| 证据不足 | 使用 `sourceType=model_inference` 或 `missingItems`，不得伪造官方来源 | 结构化契约测试 |

## 风险与回滚边界

- Authority 风险：当前机器 authority 仍 `STOP`，本 amendment 不能单独授权产品 runtime。
- Base 风险：当前 checkout 不是 `ext-dev`，后续实现必须切到 Product Owner 指定 exact base。
- 数据风险：新增表需要迁移与回滚脚本；如果现有案卷/任务模型足以承载，应优先扩展投影而非重复账本。
- 前端风险：大殿冻结边界被触碰，必须留下本 change 记录和浏览器证据。
- 回滚：产品实现包应可通过回滚单一 commit 删除 Scene Pack API、页面和 migration；已创建 demo 数据必须可重建。

## 计划确认记录

- 批准人：`lyt`
- 批准日期：2026-09-03
- 批准范围：创建并执行 “场景入口 + 军机处看板最小闭环” amendment；后续追加 B2B 询盘成交与企业经营增长诊断真实链路；目标代码范围包括后端模型/API、前端大殿入口、场景页、军机处看板、B2B Pack V1、企业经营增长诊断 Pack V1 和最小 Playwright 验收。
- 明确未批准：push、merge、deploy、自动签约、自动付款、自动报价、自动群发、自动对外发布。
- 机器状态：`execution-authority.v1` 仍返回 `STOP`，因此产品代码实现需等待 authority 绑定或后续明确治理包。

## 验收标准

1. 大殿首页显示 5 个 Scene Pack 卡片，且“立即开局”“查看示例”可用。
2. `single-product-export-diagnosis` 可提交 demo 输入并返回结构化诊断。
3. `b2b-inquiry-conversion` 可提交 demo 输入并返回询盘成交作战卡、推荐回复和跟进计划。
4. `contract-cashflow-risk` 可提交 demo 输入并返回结构化风控结论。
5. `enterprise-growth-diagnosis` 可提交 demo 输入并返回经营增长行动包、今日唯一行动和 30/60/90 天路线。
6. 四个真实场景运行后自动生成军机处任务卡。
7. 任务详情可查看一句话裁决、风险等级、缺失项、下一步行动和证据来源。
8. 一个占位场景保持入口和统一占位结果，不报错、不挂起、不混淆 LIVE/demo。
9. 缺字段时返回 blocked，并列出清晰 `missingItems`。
10. Playwright 最小路径覆盖四个真实场景从入口到看板详情。

## 验证计划

- `node scripts/execution-authority.mjs --authorize`
- `node scripts/harness-doctor.mjs`
- `cd backend && python scripts/harness_doctor.py`
- `cd backend && python -m pytest -q tests/test_scene_pack_routes.py`
- `cd frontend && pnpm harness:doctor`
- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm build`
- `cd frontend && pnpm test:e2e -- scene-pack-v1`
