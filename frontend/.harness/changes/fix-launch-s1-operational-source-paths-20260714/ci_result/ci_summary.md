# CI 验证摘要

结论：PARTIAL

## 命令

- 三组部署契约、Shell/Node 语法、type/build、production regression、backend pytest。
- compose、三层 doctor、restore dry-run、prod:doctor、scope/secret/diff scan。

## 结果

- 路径 GREEN 8/8；累计契约 18/18；type/build、24 项 production regression、28 项 backend pytest、compose/doctor 通过。
- ShellCheck 未安装；`bash -n` 和 `node --check` 通过。
- restore dry-run 没有重启服务，但错误地同时输出“全部正常”和四端口未监听；状态保持 PARTIAL。
- prod:doctor 正确 STOP：foreign 3050、无 immutable builds。
