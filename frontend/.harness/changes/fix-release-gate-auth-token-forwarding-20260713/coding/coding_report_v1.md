# 实现报告 v1

## 改动

- `buildAuthToken()` 增加 `HARNESS_AUTH_TOKEN` 回退。
- 新增静态回归测试，防止外层发布 token 再次断链。

## 取舍

- 保留 `JIQUN_AUTH_TOKEN` 与 `FENGQUN_JWT_TOKEN` 的更高优先级，不扩大后端改动。

## 验证

- 单测 1/1；真实契约 5/5；完整发布门 GREEN。
