# 实现报告 v1

## 改动

- `package-release.mjs` 的 appName 与 INSTALL 标题统一为 Chaotang OS frontend。
- 新增 source contract；根 harness 同步登记旧入口状态和 replacement evidence。

## 取舍

- 不增加 alias tar：无调用遥测时制造双身份会延长分叉；旧身份进入观察表，不直接删除历史资料。

## 验证

- RED 1/1 -> GREEN 1/1；真实 package 产出 3089 entries。
