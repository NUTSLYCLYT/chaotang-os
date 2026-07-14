# 实现报告 v1

## 改动

- 新增 `added_lines_against(ref)`，对 staged tree 与指定父节点比较。
- 检测到 `MERGE_HEAD` 时，对各父节点新增行取精确交集。
- 新增临时 Git 仓库级 Node 测试，覆盖放行继承内容与拦截 merge-only 泄露。

## 取舍

- 使用父节点事实而不是凭据值白名单，避免削弱真实密钥检测。
- 不处理 ext 历史空白告警，避免合并提交产生大规模无关重写。

## 验证

- RED：1 failed / 1 passed。
- GREEN：2 passed / 0 failed。
