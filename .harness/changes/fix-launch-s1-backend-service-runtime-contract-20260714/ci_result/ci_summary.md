# CI 摘要：fix-launch-s1-backend-service-runtime-contract-20260714

## 命令

- 契约：`node --test scripts/backend-service-runtime-contract.nodetest.mjs scripts/canonical-deploy-paths.nodetest.mjs`
- 实际安装：Python 3.12 临时 venv、`pip install -r requirements.txt`、`pip check`、import smoke
- 前端：typecheck、`NEXT_PUBLIC_API_MODE=real pnpm build`、24 项 production lifecycle/identity/wrapper 回归
- 后端：28 项代表 pytest；`uvx ruff check .`
- 部署：compose config、systemd parser、`pnpm prod:doctor`
- 架构/安全：三层 doctor、secret scan、旧 runner scan、`git diff --check`

## 结果

- RED：1/4 passed、3/4 failed；失败精确对应两类旧 runner 与缺失安装步骤。GREEN：4/4；联合路径契约 10/10。
- 隔离 Python 3.12 venv：requirements 安装、`pip check`、gunicorn/uvicorn/web.main import 全通过，临时目录已删除。
- TypeScript、production build、production 回归 24/24、后端代表 pytest 28/28、compose 与三层 doctor 通过。
- Ruff 全仓基线：FAIL，772 个既有问题；本变更没有修改 Python 源码，不在本闭环批量修复。
- systemd parser 能读取两份 unit，只因 canonical deployment root 尚未实际创建 `.venv/bin/python` 返回非零；安装契约与隔离实证已补齐，真实部署仍未执行。
- `prod:doctor`：预期 STOP，`foreign_prod_3050` 且缺 immutable `builds`。不得据此声明生产 READY。
