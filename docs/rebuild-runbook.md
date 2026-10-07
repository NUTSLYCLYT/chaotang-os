# 朝堂OS 换机重建手册（Rebuild Runbook）

> 目的：任何一台新电脑，从远端 clone 到门禁全绿，一步不缺。
> 原则：**不做"拷贝迁移"，只做"远端重建"**。代码真源在 git 远端，本手册是唯一合法的"迁移"方式。
> 验证基线：2026-10-07 实测于 ext-dev `31d4b5bd`。

## 0. 前置条件

| 依赖 | 版本要求 | 用途 |
|---|---|---|
| git | ≥2.40 | clone / worktree |
| Node.js | ≥22 | 门禁脚本（`scripts/*.mjs`）、前端构建 |
| Python | ≥3.11 | 后端 FastAPI + LangGraph |
| 包管理 | npm（前端）/ pip 或 uv（后端） | 装依赖 |

## 1. 克隆（双远端任选）

```bash
# GitHub（公网可达，公开仓库，无需授权）
git clone -b ext-dev https://github.com/NUTSLYCLYT/chaotang-os.git

# 或 Gitee（国内网络更快；需 SSH key）
git clone -b ext-dev git@gitee.com:msxn/chaotang-os.git
```

克隆后建议补挂第二远端做双备份：

```bash
cd chaotang-os
git remote add github https://github.com/NUTSLYCLYT/chaotang-os.git   # 若从 Gitee 克隆
git remote add origin  git@gitee.com:msxn/chaotang-os.git             # 若从 GitHub 克隆
```

## 2. 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows；Linux/macOS 用 source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
# 验证：curl http://127.0.0.1:8000/health
```

## 3. 前端

```bash
cd frontend
npm install
npm run dev                   # 开发；生产用 npm run build && npm start
```

## 4. 秘钥配置（不在仓库内，需手工）

Agent 链路（丞相三部 graph 等）需要 DeepSeek API Key。仓库不保存任何秘钥（正确做法），
在新机器上自行配置环境变量或 `.env`（python-dotenv 已在依赖内）：

```
DEEPSEEK_API_KEY=<你的key>
```

## 5. 治理门禁验证（重建完成的判定标准）

```bash
git config core.hooksPath .githooks   # 每台机器一次性：启用仓内 pre-push 门禁钩子
node scripts/check_harness.mjs       # 治理门禁，必须全绿
node scripts/check-worktrees.mjs     # worktree 白名单合规，exit 0
```

两条全绿 = 重建完成。任何一条红，停止操作并按 AGENTS.md 治理流程上报，不得带病作业。
钩子说明：`.githooks/pre-push` 在每次 push 前强制跑门禁（环境受限时可设 `CHAOTANG_SKIP_PREPUSH=1` 逃生阀，须留痕）。

## 6. 不随仓库走的资产清单（按需单独搬运）

| 资产 | 位置（本机） | 说明 |
|---|---|---|
| `PORTABLE-PATHS.json` 路径真源 | `H:\ChaotangPortable\` | 便携启动体系配置，仓库外独立维护 |
| worktree 抢救备份 | `H:\ChaotangBackups\worktree-rescue-20261007\` | 历史 worktree 的 patch + untracked |
| 预重建分支 bundle | `H:\ChaotangBackups\branch-archive-20261007\` | 46 支 7-8 月旧分支全量备份（见 docs/branch-cleanup-20261007.md） |
| Staging 归档 | `H:\ChaotangBackups\staging-archive-20261007\` | 228 项历史测试产物（同盘可逆搬移） |
| 六部 Agent / DeepSeek 预设 | `H:\ChaotangPortable\` | 便携运行时资产 |

## 7. 日常纪律（代替"每天迁移"）

- 当天工作当天 `commit + push`（双远端：`origin` Gitee + `github`）。
- 会话收尾跑 `node scripts/check-worktrees.mjs`。
- 永远不建第二个"需人工同步"的副本——要副本就 clone，要备份就 push。
