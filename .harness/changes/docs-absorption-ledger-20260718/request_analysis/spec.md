# 规格说明：docs-absorption-ledger-20260718

## 背景

四路挖掘发现约 22 项创意/半成品活在 ext 骨架外（Gitee jiqun-port 分支、
本仓未落地分支、openclaw 侧、家目录散档、CourtOS-Brain 日报）。业主要求
「全部吸收」；与已定策略「主线 A 优先、拉动式吸收」存在张力。解法：吸收
拆为**登记入库**（全量、零风险）与**接线合入**（按主线拉、走 packet 门禁）
两义，本包只做前者 + ③ 档文档级吸收。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 本仓存在 PKT/翰林/普查/Alembic 未落地分支 | `git branch -a` 命中 task/p5-* task/p8-* task/p9-* task/resource-census-p0 等，2026-07-18 | Claude 本机核实 | 否 |
| 已确认事实 | 家目录散档存在 | `ls`：`~/CHAOTANG_钦天监_待裁台账.md`、`~/legal-agent`（git 仓）、`~/chaotang-landing`（git 仓）、`~/battery-rd-os`（git 仓）、`~/CourtOS-Brain`，2026-07-18 | Claude 本机核实 | 否 |
| 推测 | Gitee jiqun-port 10 分支与 openclaw 22 项内容如挖掘报告所述 | 本机不可达，无法核实 | 标 UNVERIFIED-REMOTE，合入前 checkout 核 SHA | 否（登记不阻塞；合入阻塞） |
| 未知问题 | 远端分支实际内容与描述的偏差幅度 | 不适用 | ①/② 档 packet 开工时首步核实 | 是，阻断对应 packet，不阻断本包 |

## 数据流与调用链

无运行态数据流。文档链：挖掘报告 → 本机核实 → 台账六档裁决 → ①/② 档
后续 packet 引用台账行作为立项依据。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 台账行格式（档位/裁决列/核实状态） | `absorption-ledger.md` | 后续 packet 立项、业主决策 | 六档定义见台账头部 |
| 钦天监签字协议 | 原档 `~/CHAOTANG_钦天监_待裁台账.md`（已直读） | 未来 `.harness/rules/` 不可逆动作登记 | 本包只吸收通用形态 |
| 红蓝对抗模板 | `~/legal-agent` README（已直读） | 部门 Agent 架构（PKT 系列） | 本包只吸收模式 |

## 范围

- 新增 `absorption-ledger.md`：22 项六档裁决（PULL-NOW / PULL-NEXT /
  DOC-ONLY / QUEUE / DEFER-KILL / FEDERATE），每项带「永不吸收主线损失
  什么」裁决列与核实状态。
- 新增 ③ 档吸收文档两份：`protocol-qintianjian-signoff.md`、
  `template-red-blue-adversarial.md`。
- 本 change 四件套。

## 非目标

- 不合入任何 ①/② 档代码；不动 `.harness/rules/`、前端、后端。
- 不搬运 openclaw 具体待裁项；不激活任何 cron/timer。
- 不宣称远端来源已核实。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 远端来源核不到 | 对应项冻结在台账，不进 packet | UNVERIFIED-REMOTE 标注 + 台账核实状态说明 |
| 裁决列填不出损失 | 自动降 ⑤ 档 | #13 #15 已按此规则降档 |
| 台账与既有 deferred 记录重叠 | 台账为新入口，不改写既有 deferred 文档 | diff 只含本 change 目录 |

## 风险与回滚边界

主要风险：远端描述失真导致 ①/② 档立项错误——由「合入前 checkout 核 SHA」
门禁控制。回滚：整目录删除即回滚；docs-only，无代码、无运行态变化。

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-18
- 批准范围：吸收节奏牌 A（主线优先）+ 大神会审全部建议（Bezos 裁决列、
  段永平 council 联邦制）；docs-only 快批线。
- 明确未批准：任何 ①/② 档代码合入、rules 结构变更、未经复审推送 ext。

## 验收标准

1. 台账 22 项每项有档位 + 裁决列 + 核实状态，本机来源逐一实证。
2. 两份 ③ 档文档忠实于原始来源（原档/源仓已直读）。
3. `node scripts/harness-doctor.mjs` 0 errors。
4. diff 只含本 change 目录内文件。

## 验证计划

本机来源核实 → 台账成文 → ③ 档吸收 → harness doctor → diff 复核 →
业主审批后 commit。
