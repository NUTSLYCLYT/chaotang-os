# 预览 / 部署报告

结论：NOT_DEPLOYED

## URL

- 未部署；未启动或停止任何服务。

## 检查

- 本地真实 DOWN CLI 通过；live 8081 protected smoke 因 JWT 运行配置不一致返回 401；production 继续保持 STOP。

## 剩余风险

- foreign 3050、immutable build 和外部 trust anchor 仍未完成。
