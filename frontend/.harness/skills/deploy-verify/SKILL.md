---
name: deploy-verify
description: 验证前端发布路径、预览状态和发布证据。
---

# 部署验证 Skill

## 检查项

- `pnpm build` 是否通过。
- `pnpm start` 或预览服务是否能启动。
- 端口是否保持 dev 3002、production 3050。
- 控制台是否有阻断错误。
- 关键路由是否可访问。
- 涉及真实外部 API 数据时，source label 是否诚实。

## 输出

写入 `deployment/preview_report.md`：

- 命令。
- URL。
- 结果。
- 截图或浏览器证据。
- 剩余风险。
