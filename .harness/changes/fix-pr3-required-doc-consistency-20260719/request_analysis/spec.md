# 规格说明：fix-pr3-required-doc-consistency-20260719

## 背景

Gitee PR !3 已合入 `feature-chaotang-ext`。合入后的产品冻结文档仍有三项必须修复的一致性问题：R0 数据边界允许“明确授权测试材料”但其他事实源把真实客户材料首次准入放在 R1；R0 质量门使用未定义的“P0/P1 风险”且没有统计分母；PRD 把 5/3/1/1 的最后一项写成“outcome 或证言”，弱于产品宪法和融合决策记录的客户证言门。

本 change 只修订权威文档和审计记录，不声明相应 schema、scorer、埋点或运行门已经实现。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | R0 旧表述允许“明确授权测试材料”，但同一 PRD/宪法规定真实合同从 R1 才可进入 | `ef9b5974` 下 `PROJECT_PRODUCT.md:245`、PRD `2.3/8.1/11` | 基线逐行核对，Project Agent，2026-07-19 | 是，数据准入门不可判定 |
| 已确认事实 | “P0/P1 风险”未定义，且与 release-severity P0/P1、运营 P1 告警共用命名 | `ef9b5974` 下 PRD `8.1/8.2/8.3/10.2` | 关键词与契约核对，Project Agent，2026-07-19 | 是，质量门不可复算 |
| 已确认事实 | 5/3/1/1 最后一项在 PRD 为“outcome 或证言”，产品宪法为客户证言 | `ef9b5974` 下 PRD `8.3`、`PROJECT_PRODUCT.md:261-273` | 权威关系比对，Project Agent，2026-07-19 | 是，R2 商业入口可被放宽 |
| 已确认事实 | 仓内通用 `riskLevel` 已使用 `critical/high/medium/low` | `frontend/src/lib/contracts/xingbu.ts`、`frontend/src/lib/contracts/schemas.ts` | 只读代码检索，Project Agent，2026-07-19 | 否；本 change 仅冻结产品语义 |
| 未知问题 | 运行时 scorer、cohort 事件字典和审计字段尚未按新文档实现 | 后续 M0–M10 amendment / 工程 change | Product + Eng + Legal + Analytics | 阻塞 R0/R1 实现通过，不阻塞本文档修复 |

## 数据流与调用链

```text
PROJECT_PRODUCT 产品边界
  → R0/R1 PRD 精确阶段门与统计公式
  → M0–M10 amendment / schema / scorer / cohort ledger（后续实现）
  → release evidence 按冻结口径判定 GO / NO_DATA / NO-GO
```

本 change 不触碰任务运行链、客户数据、模型调用或 release 状态。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| R0 数据准入 | 产品宪法 + R0/R1 PRD `2.3/8.1/10.1` | 数据、Legal、R0 评测与发布门 | 仅合成或不可重新识别的合法去标识材料；授权不覆盖禁入边界 |
| 合同 `riskLevel` 与质量公式 | R0/R1 PRD `8.0` | API/schema amendment、黄金集 scorer、质量报告 | 固定四级枚举、一对一匹配、明确分子分母；无分母为 `NO_DATA` |
| R1 cohort 5/3/1/1 | R0/R1 PRD `8.3.1` | 产品分析、销售、财务、R2 release evidence | 同一 cohort；5 的子集；完成/复用/付款/证言证据可审计 |

## 范围

- 修订 `docs/product/PROJECT_PRODUCT.md` 与 R0/R1 PRD 的当前产品事实。
- 对齐产品融合决策记录和收敛指南中的派生表述。
- 新增本根级 change，记录基线、边界、验证与回滚。

## 非目标

- 不修改 `frontend/`、`backend/`、API、schema、scorer、黄金集或 CI 实现。
- 不接收或处理任何真实客户材料，不创建 cohort 运行数据。
- 不宣称 R0/R1/R2 已通过，不发布或部署。
- 不重写不可变 `source_inputs/` 或历史 change 的当时证据。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 材料只有客户授权但仍可重新识别 | R0 禁入；按真实客户材料等待 R1 门 | PRD `2.3/8.1` 关键词断言 |
| 风险指标分母为 0 或标签/scorer 未冻结 | 输出 `NO_DATA`，不得通过 | PRD `8.0` 公式与冲突扫描 |
| 同一客户多 tenant、内部代跑或重试 | 同一实际购买组织只计一次；代跑/重试不计复用 | PRD `8.3.1` 表格 |
| 只有私有 outcome、没有公开使用授权的证言 | 第四个“1”不通过 | PRD `8.3.1` 表格与反例文本 |

## 风险与回滚边界

- 风险：文档门槛先于运行 schema，可能被误报为已实现；所有声明保持 documents-only，运行结果继续为 `NO_DATA`。
- 风险：同义文本继续漂移；PRD 明确拥有精确统计口径，宪法与决策记录只引用该口径。
- 回滚：普通 revert 本 change 提交；不得回写或重算 PR !3 的历史证据，不删除客户或运行数据。

## 计划确认记录

- 批准人：项目业主（用户）
- 批准日期：2026-07-19
- 批准范围：修复 `feature-chaotang-ext` 上述 3 项必须修复的 PR 问题。
- 明确未批准：运行时代码、生产数据、部署、绕过后续工程/法律/发布门。

## 验收标准

- R0 只允许合成或经合法性复核且不可重新识别的去标识材料，授权但可识别的客户材料明确禁入。
- 合同风险固定为 `critical/high/medium/low`；release P0/P1 与运营 P1 不得混用；召回、precision、macro-F1 分母和 `NO_DATA` 行为明确。
- 5/3/1/1 使用同一 R1 cohort，明确完成、主动复用、已清算付款和书面授权公开客户证言的正反例与证据引用。
- 相关当前文档无冲突残留，相对链接有效，根级 harness doctor 通过。

## 验证计划

- `git diff --check`
- Node Markdown 围栏与相对链接检查
- 关键词正反断言和权威口径扫描
- `node scripts/harness-doctor.mjs`
- documents-only 相关代表 pytest；不运行真实 provider/high-cost harness
