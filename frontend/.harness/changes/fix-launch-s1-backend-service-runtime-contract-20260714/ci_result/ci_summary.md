# CI 验证摘要

结论：PARTIAL

## 命令

- runtime/path contract node tests、Python 3.12 隔离 venv 安装验证。
- TypeScript、production build、24 项 production regression。
- 28 项 backend pytest、compose、三层 doctor、ruff、secret/diff scan、prod:doctor。

## 结果

- 契约 10/10、隔离 venv、typecheck/build、production regression 24/24、backend pytest 28/28、compose 与 doctor 通过。
- 全仓 ruff 发现 772 个既有问题；本变更零 Python 源码修改，未批量修复。
- systemd parser 仅报告 canonical deployment root 尚无 `.venv/bin/python`；安装步骤和隔离实证已补齐，真实部署未执行。
- prod:doctor 正确 STOP：foreign 3050、无 immutable builds。
