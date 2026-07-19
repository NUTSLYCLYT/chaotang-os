# 变更摘要：docs-absorption-ledger-20260718

| 字段 | 值 |
| --- | --- |
| Change ID | docs-absorption-ledger-20260718 |
| 类型 | docs |
| 状态 | DRAFT / OWNER_APPROVAL_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260718 |

## 范围

- 主线：骨架外创意大盘登记入库（22 项六档裁决），支撑「主线 A 优先、拉动式吸收」策略。
- 文件：`absorption-ledger.md`（台账本体）、`protocol-qintianjian-signoff.md`（③ 档吸收）、`template-red-blue-adversarial.md`（③ 档吸收）、本 change 四件套。
- 验证：`node scripts/harness-doctor.mjs`；台账内本机来源逐一核实（分支/仓/文件存在性），远端来源标 UNVERIFIED-REMOTE。

## 边界

- docs-only：不改任何前端/后端实现、测试、rules 结构。
- 台账是登记不是合入承诺；①/② 档任何合入走独立 packet（B/H/R 复审门禁）。
- UNVERIFIED-REMOTE 项在 checkout 核实 SHA 前冻结，不进 packet。
- council（#12）裁决为 FEDERATE：不合入，保持并行产品互链。

## 决策记录

- 业主 2026-07-18 批准：吸收节奏牌 A（主线优先）+ 大神会审全部建议
  （Bezos「永不吸收损失」裁决列、段永平 council 联邦制、KILL 敢标）。
