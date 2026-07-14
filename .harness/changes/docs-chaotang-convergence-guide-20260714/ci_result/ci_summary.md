# CI summary

| 检查 | 结果 | 证据范围 |
| --- | --- | --- |
| 本地 Markdown 相对链接存在性检查 | PASS / exit 0 | 指导文件全部本地相对链接 |
| `git diff --check`（本轮 tracked 文档） | PASS / exit 0 | docs index、canonical blueprint、Step 0 spec/tasks |
| Markdown 标题与禁用措辞扫描 | PASS / exit 0 | 编号连续；处理深度统一为 D0/D1/D2；无不当 immutable 宣称 |
| `pnpm exec playwright test --help` 参数核验 | PASS / exit 0 | 确认 `--trace`、`--output` 有效且无 `--screenshot` CLI |
| Blueprint 对抗性复核 | GO | 事实源、依赖、安全、黄金资产、冷启动任务和浏览器基线；记录见相邻 single-fact change 的 `review.md` |
| `node scripts/harness-doctor.mjs` | PASS / exit 0 | 最终复跑 `0 errors / 0 warnings`；此前并行占位符阻断已消失 |

- 声明状态：`VERIFIED_COMPLETE`（仅指本 docs change）。文档专项检查、独立复核和根 doctor 全部通过。
- 运行时代码测试：`NOT_APPLICABLE`，本变更不修改业务代码。
- 浏览器 E2E：`NOT_RUN`，本轮只制定 Step 0 浏览器证据任务，没有运行或接管 foreign 3050。
- 部署：`NOT_DEPLOYED`。
