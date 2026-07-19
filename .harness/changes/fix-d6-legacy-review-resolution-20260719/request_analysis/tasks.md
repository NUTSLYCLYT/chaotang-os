# 任务：fix-d6-legacy-review-resolution-20260719

## 任务 1：TDD 建立 legacy review fail-closed

- RED：增加缺元数据、无解决链、缺目标、旧版本目标四类拒绝用例，以及 resolved NO_GO/legacy GO 两类接受用例。
- GREEN：扩展 candidate tree 枚举、legacy metadata parser 与 resolution-to-latest-GO 校验。
- REFACTOR：保持现有标准 review、approval、SHA/digest/DAG 和 installer 逻辑不变。

## 任务 2：迁移当前历史文件

- Opus NO_GO 增加唯一 verdict 与 P16/P17 两条 resolved-by。
- P4.5 closure 增加唯一 GO verdict。
- 原正文、原裁决和 Git 历史不删除、不改写。

## 任务 3：验证、复审、发布

- 运行 42 项 Node suite、三层 doctor、diff check。
- 固定 B/H 交 Claude 只读复审。
- review-only commit 只新增 review-v1.md/approval-v1.json。
- 构造第一父为远端的 no-ff 候选，direct verifier 接受后正常 push。
- push 后重装 managed hook bundle，让后续 P18 使用新 verifier。
