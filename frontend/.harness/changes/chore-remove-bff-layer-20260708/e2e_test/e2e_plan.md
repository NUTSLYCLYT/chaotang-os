# E2E 计划：chore-remove-bff-layer-20260708

## 浏览器路径

- 结构性删除本身不需要浏览器 E2E。
- 后续 E2E 应在外部运行 URL 与 CORS/auth 配置完成后，针对用户工作流执行。

## 命令

- `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-bff-removal-check pnpm build`

