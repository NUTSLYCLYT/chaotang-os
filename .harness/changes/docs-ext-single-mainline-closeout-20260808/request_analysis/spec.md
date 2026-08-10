# 需求与证据

用户要求把 EXT 收拢为一条可尽快使用的主线并上传 Gitee，同时明确要求分清两个副本、
避免重复开发。

## 已确认事实

- 正式事实源：`/home/ubuntu/Projects/chaotang-os`。
- 正式主线：`feature-chaotang-ext@d36bb797`。
- 旧独立副本：`chaotang-ext-certification@858c9f47`。
- 正式主线相对旧副本有 411 个独有提交。
- Gitee 前驱：`origin/feature-chaotang-ext@8feae838`，本地领先 248 个提交。
- R0-W08 允许重制 S3 校真思想；禁止整支吸收并冻结 daily-court/evolve。
- 旧工部子 worktree 有未提交内容，必须原样保留。

## 可验证目标

1. 旧副本不再被误认为产品主线。
2. S3 对抗测试在旧逻辑上红、修复后绿。
3. 候选仅包含声明路径，无 L0 或用户在制品。
4. 正式主线线性前进并与 Gitee 远端一致。
