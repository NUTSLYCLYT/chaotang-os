# Spec

## 目标

新增 `amendmentGovernance.reviewerSuccessorW08D4A`，同时验证旧 G7 链和当前 D4A P/G/A 链；任何一条失败都拒绝授权。

## 不变量

- `reviewerSuccessorW08` 字段、常量和无 profile 参数时的默认语义不变。
- D4A 产品差异严格为已冻结 7 路径。
- G 治理差异严格为本 change 的 4 个文档和 7 个脚本，共 11 路径。
- A 激活差异严格为两个 manifest，加 activation intent、两个 review、两个 owner approval、两个 review input，共 9 路径。
- G 不写 manifest，不生成或伪造 review/owner evidence。
