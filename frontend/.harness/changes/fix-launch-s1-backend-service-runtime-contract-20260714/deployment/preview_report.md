# 预览 / 部署报告

结论：PARTIAL

## URL

- N/A；未启动 preview，未接管 3050/8081。

## 检查

- 两份 8081 unit runner 契约一致。
- Python 3.12 临时隔离 venv 实际安装 requirements、pip check 与 import smoke 通过，随后删除。
- systemd parser 能解析 unit，但 canonical 部署根尚未实际安装 `.venv`。

## 剩余风险

- 真实 `.env`、数据库、provider、日志目录和 systemd 权限尚未在目标机验证。
- foreign 3050 与 immutable build 身份仍阻塞生产 READY。
