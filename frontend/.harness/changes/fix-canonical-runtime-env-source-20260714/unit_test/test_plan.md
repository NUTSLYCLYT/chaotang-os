# 单测计划

## 覆盖范围

- Next wrapper、release gate、shared LLM env 三个消费者。
- 禁止旧自动来源，要求 canonical override/default。

## 命令

- `node --test scripts/runtime-env-source-contract.nodetest.mjs`

## 未覆盖风险

- 显式外部 override 的文件读取行为沿用既有 parser，未单独模拟秘密文件。
