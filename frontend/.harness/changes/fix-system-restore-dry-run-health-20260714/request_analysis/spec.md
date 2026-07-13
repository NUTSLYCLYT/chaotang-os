# 需求说明

## 背景

dry-run 原本跳过 HTTP 探测，并用逆序 grep 误判 `ss`，造成退出码、绿色总结与端口证据互相矛盾。

## 范围

- dry-run 单次验证必需 HTTP 端点并累计失败。
- 正确识别 `LISTEN ... :port`。
- 新增隔离、无真实服务副作用的 Node 测试。

## 非目标

不重启/接管服务，不改变正常恢复模式，不宣称生产 READY。

## 验收标准

unhealthy fixture exit 非 0；healthy/manual fixture exit 0；两者都不 restart；真实 dry-run 的 HTTP 与端口证据一致。

## 风险

错误地把 systemd inactive 当服务 down，会误伤手动进程；因此最终真相以 HTTP 端点为准，systemd 状态只作提示。

## 验证计划

Node 专项、`bash -n`、实际 `--dry-run`、frontend/root doctor、S1 回归与 diff/security review。
