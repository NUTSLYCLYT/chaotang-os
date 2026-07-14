# 需求说明

## 背景

全量合并 `feature-chaotang-ext` 到发布候选时，凭据守卫把 incoming 父分支中已经存在并审查过的测试夹具重新判定为本次 merge 泄露，导致无冲突合并无法提交。

## 范围

- 让凭据守卫识别 `MERGE_HEAD`。
- merge 时只检查相对所有父节点都属于新增的精确行。
- 增加真实临时 Git 仓库回归测试。

## 非目标

- 不放宽普通提交的凭据检测。
- 不用 `--no-verify` 绕过守卫。
- 不机械改写 ext 历史里的测试夹具或文档。

## 验收标准

- 父分支已有的凭据样测试夹具不再误报。
- 合并过程中新增的凭据样文本仍被阻断。
- 根、前端和后端 Harness Doctor 继续通过。

## 风险

相同文本若已存在于任一父节点会被视为继承内容；这是 merge 语义所需，普通提交不受影响。

## 验证计划

- `node --test frontend/scripts/guard-credential-leak.nodetest.mjs`
- `bash frontend/scripts/guard-credential-leak.sh`
- `node scripts/harness-doctor.mjs`
