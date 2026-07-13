# 单测计划

## 覆盖范围

- 八个执行文件的旧路径消失与 canonical path 存在。
- system restore/health monitor 的 backend runner 指令。
- 六个 shell 与两个 mjs 的解析语法。

## 命令

- operational source path node test、`bash -n`、`node --check`。

## 未覆盖风险

- 未覆盖 cron 用户环境、通知、真实蜂群和升级状态写入。
- ShellCheck 未安装；只有 shell 解析语法证据。
