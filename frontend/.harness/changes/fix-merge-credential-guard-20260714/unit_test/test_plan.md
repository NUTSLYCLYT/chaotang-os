# 单测计划

## 覆盖范围

- incoming 父分支已有凭据样测试夹具，merge 不应重复误报。
- merge 暂存区中新加凭据样文件，必须继续失败。

## 命令

- `node --test frontend/scripts/guard-credential-leak.nodetest.mjs`

## 未覆盖风险

- 未覆盖 octopus merge 的三父实测；实现按 MERGE_HEAD 全行逐父处理。
