# 朝堂 OS

朝堂 OS 是一个多线项目，包含前端体验线、后端蜂群/运行线，以及共享产品文档。

当前工作区的统一入口是：

- 根级：`AGENTS.md`、`.harness/`、`node scripts/harness-doctor.mjs`
- 前端：`frontend/AGENTS.md`、`frontend/.harness/`、`cd frontend && pnpm harness:doctor`
- 后端：`backend/AGENTS.md`、`backend/harness/`、`cd backend && python scripts/harness_doctor.py`

## 项目级护栏

根项目护栏位于 `.harness/`，负责统筹整个仓库。

```text
.harness/
  agents/      根项目负责人和调度地图
  rules/       全项目边界与验证规则
  wiki/        架构与护栏清单
  changes/     根级审计记录
  templates/   根级变更骨架
  manifest/    可机读护栏清单
```

常用命令：

```bash
node scripts/harness-doctor.mjs
node scripts/new-change.mjs chore project-change
```

Packet 独立复核的本地防误操作门需要显式安装：

```bash
node scripts/install-packet-review-hooks.mjs
node scripts/packet-review-pre-push.mjs --status
```

其状态固定为 `LOCAL_FEEDBACK_ONLY`：可被 `git push --no-verify` 或本机 hook 篡改绕过，
不替代外部签名与 Gitee required check。完整协议见
`.harness/wiki/packet-review-local-feedback.md`。

## 主线

| 主线 | 路径 | 职责 |
| --- | --- | --- |
| 前端 | `frontend/` | Next.js 界面、浏览器工作流、发布门禁、视觉证据 |
| 后端 | `backend/` | 蜂群执行、提示词、模型服务、运行流程、后端评测护栏 |
| 文档 | `docs/` | 跨项目产品、实施蓝图与历史状态文档 |

可变后端运行数据统一写入 `backend/var/`（不入 Git）；版本化输入放在 `backend/resources/`，测试样例放在 `backend/tests/fixtures/`。根目录结构由 `node scripts/harness-doctor.mjs` 的 tracked-file 策略检查持续约束。

开始工作前先读 `AGENTS.md`。
