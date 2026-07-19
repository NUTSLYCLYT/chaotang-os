# 规格说明：fix-d6-legacy-review-resolution-20260719

## 背景

P19 证明 D6 的标准路径扫描可阻断格式错误的 review-vN，但对
claude-code-review-*.md、independent-review-*.md、review-closure-*.md 等非标准命名完全失明。
文件名白名单会持续漏新变体；任意 prose 关键词扫描又会把历史提及误判成当前裁决。

## 设计

候选树中的 packet review 分两类：

1. 标准 review-vN.md：保持现有按 change ID 取最大数字版本、唯一终态、末行 GO 的规则。
2. `packet_review/` 树内其他 Markdown（含子目录）：统一视为 legacy review，要求显式机器元数据。

Legacy 元数据：

- Legacy-Review-Verdict: PACKET_REVIEW_GO|PACKET_REVIEW_NO_GO|INSUFFICIENT_EVIDENCE
- Legacy-Review-Resolved-By: <标准 review-vN.md 路径>（NO_GO/证据不足至少一条，可重复声明不同目标）

每个解决目标必须存在、是目标 change 的最新数字版本，并且唯一末行终态为 GO。Legacy GO
不得附解决目标。重复、空值、旧版本、缺文件或非 GO 都拒绝。

## 事实源与消费链

candidate tree -> 枚举标准与 legacy review -> 标准 latest GO 校验 -> legacy metadata 校验
-> resolution path 映射到标准 latest GO -> 现有 approval/SHA/digest/DAG 校验 -> allow/stop。

机器元数据是历史非标准文件的兼容层事实源；原审查正文继续作为不可抹除的历史证据。
未来新审查必须使用标准 review-vN.md，不鼓励新增 legacy 格式。

## 当前历史迁移

- merge-p6.../independent-review-opus-20260718.md：
  verdict=NO_GO；resolved-by=P16 review-v2 + P17 review-v1。两个目标均为各自最新标准 GO。
  原审查第三项“scope + writer/reviewer 分离是否接受”属于业主裁决，不由两条技术 GO 冒充覆盖；架构已由业主批准进入 ext，本元数据只声明两项实现 blocker 的机器解决链。
- fix-p4-5.../review-closure-claude.md：
  verdict=GO；无 resolution target。

## 非目标

- 不扫描 packet_review 目录之外的任意 prose。
- 不通过正文关键词推断裁决；正文可能同时描述旧 NO_GO 与新 GO。
- 不把本地 hook 宣称为不可绕过安全边界。
- 不修改 P16/P17/P4.5 的实现与历史结论。
- 不在本包整合 P18。

## 风险与控制

- 元数据伪标：仍由独立 review、SHA/digest/DAG 与 Git 历史约束；本地闸不是安全边界。
- 解决链偷指旧 GO：强制 greatest numeric version。
- 解决链指缺失/非标准路径：必须命中候选 tree 已枚举的标准 review。
- 未来新文件名/子目录：扫描 packet_review 整棵 Markdown 树，不靠名称白名单。

## 批准记录

- 批准人：业主
- 日期：2026-07-19
- 范围：全部收口上传；先清理污染，再加固 D6，再整合 P18。
- 未批准：--no-verify、伪装 required check、夹带并行主工作树内容。

## 验收标准

1. 旧闸对无元数据非标准 NO_GO 的 fixture RED，新闸拒绝。
2. legacy NO_GO 无解决链、目标缺失、目标旧版本均拒绝。
3. legacy NO_GO 指向全部最新标准 GO 时接受；legacy GO 显式元数据时接受。
4. 现有 32 项测试保持，全套扩展为 42 项并通过；覆盖重复/非法 verdict、空/重复目标、GO 带目标与 nested path。
5. 当前真实树两份 legacy review 完成元数据迁移，最终 P20 direct verifier 接受。
6. 三层 doctor、diff check、Claude 固定 SHA 复审与正常 push 全绿。
