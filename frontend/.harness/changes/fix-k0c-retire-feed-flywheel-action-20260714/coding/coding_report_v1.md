# 实现报告 v1

## 改动

- `CourtDocAction`、mock actions 与 adapter allowlist 移除 `feed_flywheel`。
- `ArchiveCard` 删除旧按钮渲染和未使用的 `RefreshCw` import。

## 取舍

- adapter 继续防御性过滤旧服务 payload；不新增临时兼容按钮或 BFF。

## 验证

- 见 CI 摘要：3 Node tests、tsc、production build、doctor 全绿。
