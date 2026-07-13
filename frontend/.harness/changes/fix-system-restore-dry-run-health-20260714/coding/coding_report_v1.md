# 实现报告 v1

## 改动

- dry-run 的 `wait_healthy` 从无条件成功改为单次 curl 并累计失败。
- courtos-web active 分支也执行端点探测。
- nginx dry-run 失败不再谎称“已重启”。
- 端口 grep 改为匹配真实 `ss` 顺序。

## 取舍

- 不把 unit inactive 直接算失败，兼容当前手动运行的 jiqun。
- 正常恢复模式的 restart 和重试循环不变。

## 验证

- Node 2/2、真实 dry-run、shell syntax 与工程门。
