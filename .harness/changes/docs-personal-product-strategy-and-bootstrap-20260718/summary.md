# 变更摘要：docs-personal-product-strategy-and-bootstrap-20260718

| 字段 | 值 |
| --- | --- |
| Change ID | docs-personal-product-strategy-and-bootstrap-20260718 |
| 类型 | docs |
| 状态 | DRAFT（PROPOSED 战略文档，等待业主定调） |
| Owner | Claude Code（只读产出，不执行） |
| 创建日期 | 20260718 |

## 范围

- 主线：个人产品定位（可托付智能）总战略 + 圣裁台自举三周方案 + 与同日
  Codex 产出的《全域智能服务架构》文档的分层归属裁定。
- 文件：
  - `docs/plans/chaotang-os-personal-product-strategy-2026-07-18.md`（楼书层）
  - `docs/plans/chaotang-os-self-bootstrap-shengcaitai-plan-2026-07-18.md`（工棚层）
  - `docs/plans/chaotang-os-life-agent-service-quality-architecture-2026-07-18.md`
    （结构工程图层，Codex 另一会话产出、业主已批内容；本 change 只登记分层归属，
    未改动其内容——避免与可能仍活跃的 Codex 会话撞车）
- 验证：docs-only，无代码改动；事实性声明经 2026-07-18 stop-review 纠错一轮
  （见下），竞争数据来自 last30days 实测（局限已在文内声明）。

## 业主裁定记录（2026-07-18 上午）

1. **产品方向定调**：个人的可托付智能助手（非企业定位）。
2. **三文档分层**：楼书（定位/原则）→ 结构工程图（运行时架构）→ 工棚（开发自举），
   一房三图各管一层，互相引用，不允许任何一份单独宣称自己是完整产品定义。
3. **开工顺序=牌子A**：先圣裁台（1周）→ 再 M1→M2→M5→M6 主体路线。
   理由：主体要走十几个 Packet，圣裁台把每次审批从手工7步变1键，1周投入全程回本。

## Stop-review 纠错记录（2026-07-18，留痕不删）

初版含以下误导性内容，已逐条修正：

1. **圣裁台准奏按钮与 D6 写者/审者分离的冲突（最严重）**：初版写"准奏=自动生成
   approval envelope"——但 envelope 是独立审查者的裁决产物，业主按钮生成它等于
   一键绕过 D6 要防的事。已改为：按钮只自动化机械部分（SHA/merge形状），且仅在
   独立审查 GO 已存在时可用；缺审查时置灰。
2. persona 名册数量：写了 54，仓内实为 **40**（`skills/personas/`，CLAUDE.md 明载）；
   54 是业主个人 Claude 配置的 roster，非产品组件。两文档均已更正。
3. 锦囊按钮"零模型成本"：错——零的是新增基建成本，每次使用消耗真实模型调用。
4. "PKT-5 接key就活"：低估——需接 `call_fn` 调用点+provider 配置，当前是显式
   degraded 占位。
5. "单用户砍掉C1一半复杂度"：越权——K1 前置硬门（K0C+C1）是蓝图明文，缩窄需
   业主 ADR 改判，不能默认放松。
6. Manus $450M：补注为 Sacra 第三方估算，非官方披露。
7. expert-perspective"接线即可"：该 skill 在业主个人配置非本仓，方法论可移植，
   代码无现成件。

## 治理入口补登

初版两份文档直接写入 `docs/plans/` 未建 change 记录，违反根 AGENTS.md
"项目级实质变更需在 `.harness/changes/` 留痕"——本 change 即补登，
后续同类战略文档一律先建 change 再落盘。
