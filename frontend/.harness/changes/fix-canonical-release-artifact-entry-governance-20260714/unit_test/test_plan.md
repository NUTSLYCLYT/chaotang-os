# 单测计划

## 覆盖范围

- 旧 appName、标题和旧字符串消失；canonical identity 存在。
- 根清算表、统一事件和删除资格门。

## 命令

- `node --test scripts/package-release-identity.nodetest.mjs`
- `cd .. && node --test scripts/capability-entry-governance.nodetest.mjs`

## 未覆盖风险

- 外部部署消费者没有可靠遥测；不得据此删除旧入口。
