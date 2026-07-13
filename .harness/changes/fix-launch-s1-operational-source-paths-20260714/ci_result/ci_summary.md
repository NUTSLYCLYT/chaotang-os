# CI 摘要：fix-launch-s1-operational-source-paths-20260714

## 命令

- `node --test scripts/operational-source-paths.nodetest.mjs scripts/backend-service-runtime-contract.nodetest.mjs scripts/canonical-deploy-paths.nodetest.mjs`
- 六个 shell 的 `bash -n`；两个 mjs 的 `node --check`；shellcheck 探测
- typecheck、production build、24 项 production regression、28 项后端代表 pytest
- compose config、三层 doctor、`system-restore --dry-run`、prod:doctor
- scope/secret/diff scan

## 结果

- RED：0/8；GREEN：8/8；累计部署契约 18/18。
- Shell/Node 语法、typecheck/build、production regression 24/24、backend pytest 28/28、compose、三层 doctor 通过。
- ShellCheck：本机未安装，记录为未覆盖，不伪装通过。
- restore dry-run：命令未执行 restart 且退出 0，但输出自相矛盾——称“全部服务恢复正常”，端口速查同时显示四个端口未监听。下一闭环必须先为诚实健康判定写 RED。
- prod:doctor：预期 STOP，`foreign_prod_3050` 且缺 immutable `builds`。
- 未实际执行 cron/alert/upgrade scripts，避免 Telegram、真实蜂群、日志和状态文件副作用。
