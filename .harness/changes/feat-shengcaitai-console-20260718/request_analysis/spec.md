# 规格说明：feat-shengcaitai-console-20260718（PKT-7 圣裁台）

## 背景

业主 2026-07-18 定调个人产品方向（可托付智能）并翻牌裁定牌子A：先建圣裁台（1周），
再进入结构工程图的 M1→M2→M5→M6 主体路线。依据：
- 楼书层 `docs/plans/chaotang-os-personal-product-strategy-2026-07-18.md`
- 工棚层 `docs/plans/chaotang-os-self-bootstrap-shengcaitai-plan-2026-07-18.md`（第1周节）

目标一句话：把 `.harness/changes/` 的 Packet 审批流从手工命令行变成界面操作，
业主（用户001）从此在界面上完成圣裁——产品最小完整环的第一次真实转动
（任务=开发决策本身）。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `.harness/changes/` 每个 change 有 summary/spec/ci_summary/packet_review 结构化文件，可作只读数据源 | 目录实查 2026-07-18 | 已验证 / Claude | 否 |
| 已确认事实 | D6 闸的 approval envelope 是独立审查者裁决产物，schema 在 `.harness/contracts/packet-review-approval.schema.json` | 2026-07-17/18 七次真实 push 实操 | 已验证 / Claude | 否 |
| 已确认事实 | 手工审批链路为7步（review→sha256→envelope→H→R→M→push），2026-07-17/18 手工执行7次 | 会话记录 | 已验证 / Claude | 否 |
| 已确认事实 | frontend 禁止新建 BFF（`src/app/api/**` 零新增），doctor 有阻断检查 | `frontend/AGENTS.md` | 已验证 / Claude | 否 |
| 未知问题 | 前端读 `.harness/changes/` 走后端只读 API 还是构建期文件读取 | 不适用 | Codex 按现有架构惯例定 | 否 |

## 数据流与调用链

```text
.harness/changes/<id>/{summary,spec,ci_summary,packet_review}
  → 只读数据层（后端只读 API 或文件读取，Codex 定）
  → 奏折列表页（change 卡片：状态/类型/日期/摘要/证据链接）
  → 准奏按钮 ──独立审查GO存在──→ 记录圣裁 + 机械自动化（SHA/merge形状/push）
  │            └─缺审查或NO_GO──→ 置灰+显示原因
  → 封驳按钮 → 理由文本框 → 写入 change 记录 + 状态回退
  → 水表：每次准奏/封驳/改后采纳 → append-only 结构化记录
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| change 目录结构 | 既有 harness 约定 | 圣裁台只读 | 不改动既有结构 |
| approval-vN.json | **独立审查者（不变）** | D6 闸 | 圣裁台不生成、不修改 |
| 水表记录 | 圣裁台 | 北极星统计（楼书11节） | `{时间, change_id, 动作, 理由?, 独立审查版本}` append-only |

## 范围

1. 奏折列表页（读 `.harness/changes/`，卡片+证据只读渲染）。
2. 准奏按钮：**D6 写者/审者分离不可被按钮绕过**——envelope 是独立审查者产物，
   按钮不生成它；独立审查 GO 存在时按钮可用（记录圣裁+自动化 SHA/merge形状/push
   等纯机械步骤）；缺审查或 NO_GO 时置灰并显示原因。
3. 封驳按钮：理由文本框（第一周刻意只做这一个字段——业主手工封驳时自然想写什么，
   第二周照着加），写入 change 记录，状态回退。
4. **水表（硬性要求，不可延后）**：每次准奏/封驳/改后采纳落一条 append-only 记录，
   字段见上表。这是"敢直接照办率"北极星的数据源，楼书 11 节明文要求盖楼时埋墙。
5. 挂载现有 frontend（Next.js）一个新页面；禁止新建 BFF。

## 非目标

- 下旨口（第2周 PKT-8）、回执流（第3周 PKT-9）
- 不改 D6 闸任何逻辑；不做多用户/权限；不做视觉美化（用冻结视觉系统最朴素组件）

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| change 缺独立审查 | 准奏置灰+原因 | 验收负向案例 |
| 独立审查为 NO_GO | 准奏置灰+原因 | 单测 |
| change 文件缺失/损坏 | 卡片显示解析错误，不崩页 | 单测 |
| push 失败（D6 拦截等） | 显示闸的原始错误信息，不吞 | 集成验证 |
| 水表写入失败 | 整个动作失败并提示（fail-closed，不允许静默丢记录） | 单测 |

## 风险与回滚边界

纯新增页面+追加式记录文件；删除页面路由与记录文件即回滚，不触碰既有链路。
最大风险：按钮把"机械自动化"做过界侵入裁决——已用边界条款+验收负向案例锁死。

## 计划确认记录

- 批准人：业主
- 批准日期：2026-07-18（翻牌裁定牌子A）
- 批准范围：PKT-7 圣裁台，1周，先于 M 主体路线
- 明确未批准：PKT-8/PKT-9（各自到期单独批）；D6 闸任何改动

## 验收标准

1. 业主在界面上完成一次真实 Packet 的圣裁全流程，不碰命令行。
2. 负向案例：缺独立审查的 change，准奏置灰且显示原因。
3. 水表记录可查且字段完整（覆盖上述两案例）。
4. `pnpm exec tsc --noEmit` + test:node 全绿；`src/app/api/**` 零新增（doctor 通过）。
5. **自用验收（楼书9节硬门）**：业主真实用它裁决至少一个真 Packet 并留痕。

## 验证计划

- RED→GREEN：水表 fail-closed、置灰逻辑、文件损坏容错各先写失败测试
- `pnpm exec tsc --noEmit`、`pnpm test:node`（或对应 nodetest 命令）
- `node scripts/harness-doctor.mjs`
- 浏览器冒烟：列表→点开证据→负向置灰→真实圣裁一次
