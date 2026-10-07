# 多台电脑协同开发手册（Windows / WSL2）

> 配套：`docs/rebuild-runbook.md`（首次装机器）、`docs/platform-strategy.md`（平台策略）、
> `docs/decisions/0045-cross-platform-parallel-development.md`（并行模型）、`docs/worktree-governance.md`（worktree 规矩）。
> 本文件回答一个问题：**几台电脑、两种系统，日常到底怎么干活、怎么同步。**

## 0. 一句话原理

**远端仓库是唯一同步枢纽；每台电脑是它的"克隆"，不是它的"拷贝"。
永远不要在两台电脑之间互拷文件，所有同步都经由 `push` / `pull`。**

## 1. 每台电脑只做一次的事

```bash
# 1) 选一个本地盘（Windows 选 H:，WSL 选 ext4 内的 ~/work，切勿放 /mnt/h）
git clone -b ext-dev https://github.com/NUTSLYCLYT/chaotang-os.git   # 或 Gitee

# 2) 挂第二个远端做双备份
git remote add github https://github.com/NUTSLYCLYT/chaotang-os.git  # 若从 Gitee 克隆
git remote add origin git@gitee.com:msxn/chaotang-os.git             # 若从 GitHub 克隆

# 3) 装本机依赖（每台机器各自装，绝不共享）
cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -e ".[dev]"
cd ../frontend && npm install

# 4) 配秘钥（不在仓库内，每台机器各自配一次）
#    backend 依赖 DEEPSEEK_API_KEY（环境变量或 .env）
```

## 2. 每天开工（3 条命令）

```bash
git fetch origin && git status          # 看远端有没有新东西、本地是否干净
git merge --ff-only origin/ext-dev      # 主分支落后就快进（无冲突）
node scripts/check-worktrees.mjs        # 确认 worktree 卫生（应为 exit 0）
```

## 3. 干活（一任务一 worktree 一分支）

```bash
git worktree add ../wt-<任务名> -b <任务分支名> ext-dev
cd ../wt-<任务名>                       # 在该 worktree 内开发，不碰别人
# ... 开发 ...
node scripts/check_harness.mjs          # 本地自检（本地绿只是参考）
git add -A && git commit -m "<type>: <摘要>"
```

## 4. 收尾（每天至少一次，越频繁越好）

```bash
git fetch origin
git merge origin/ext-dev                # 先合主干（不 rebase、不 force push）
node scripts/check_harness.mjs          # 合并后复检
git push origin <任务分支>              # 推 Gitee（主）
git push github <任务分支>              # 推 GitHub（镜像）
# 合并进 ext-dev 后：
cd ../../chaotang-os-ext-dev-20260925 && git worktree remove ../wt-<任务名>
```

## 5. 换电脑继续干（关键动作）

在另一台电脑上：

```bash
git fetch origin
git checkout ext-dev && git merge --ff-only origin/ext-dev   # 拿到最新
git worktree add ../wt-<任务名> <任务分支>                    # 若该分支已在远端
```

**规则：同一时间只在一台电脑上改同一个分支。** 想在两台同时干，就用两个不同分支/worktree。

## 6. 什么能"跨平台共享"，什么绝对不能

| 类别 | 内容 | 结论 |
|---|---|---|
| ✅ 可共享 | 源码、文档、ADR、`.gitattributes`、配置模板（`.env.example`） | 经 git 同步 |
| ❌ 禁止共享 | `node_modules/`、`.venv/`、`.next/`、`__pycache__/`、构建产物 | 各机器各自安装（已在 `.gitignore`） |
| ❌ 禁止共享 | `.env` 秘钥、凭据 | 各自本地配置，永不入库 |
| ❌ 禁止共享 | `PORTABLE-PATHS.json`、本地备份目录 | 仓库外资产，另行搬运 |

**原因（硬技术事实）**：`node_modules` 里的原生模块（`.node` 二进制）与 Python venv 都是
**平台特定**的——Windows 编译的在 WSL 里跑不起来，反之亦然。共享必崩，重装必对。

## 7. WSL 与 Windows 的实际差异（影响 + 处置）

| 差异 | Windows | WSL2 | 影响 | 处置 |
|---|---|---|---|---|
| 文件系统 | NTFS（`H:`） | ext4（`~/`）；`/mnt/h` 是跨系统访问 | **`/mnt` 下大量小文件 I/O 慢数倍**（npm install、git status 都拖） | WSL 用户把仓库克隆到 ext4（`~/work`），别放 `/mnt/h` |
| 路径写法 | `H:\ChaotangSource\x` | `/mnt/h/ChaotangSource/x` | 脚本硬编码路径会两边不一致 | 已由 `normPath` + `CHAOTANG_WORKTREE_WHITELIST` 归一 |
| 行尾 | 默认 CRLF | 默认 LF | 整文件假 diff（曾发生） | 已由 `.gitattributes` 统一 LF |
| 大小写 | 不敏感 | 敏感 | Windows 能跑、Linux 挂 | 由 CI 抓；本地别偷懒 |
| 执行位 | 无概念 | 有 | 同上 | 同上 |
| 系统能力 | DPAPI、NSSM、Win API、PowerShell | 无 | 平台专属操作会失败 | 见 `platform-strategy.md` 归属清单 |
| 虚拟化 | 无 | 开启 Hyper-V 平台 | 与反作弊（ACE）冲突 | owner 侧不启用 WSL |

## 8. 常见故障对照

| 症状 | 原因 | 处理 |
|---|---|---|
| 同一文件显示整篇改动，`-w` 后差异为零 | 行尾被本地编辑器改写 | 已由 `.gitattributes` 收敛；勿用 `--no-verify` 绕过 |
| `wsl` 下 `check-worktrees` 报"越界" | 路径为 `/mnt/...` 且白名单未覆盖 | 已支持 `/mnt` 归一；必要时设 `CHAOTANG_WORKTREE_WHITELIST` |
| Windows 上 `node` 起不了 git 子进程 | 沙箱/环境限制 | 脚本有文件系统兜底通道；换会话复验 |
| `npm install` / `pip install` 极慢 | 仓库在 `/mnt/h`（WSL 跨系统 I/O） | 迁到 ext4 或改用 Windows 原生 |
| 另一台机器 git 说落后 | 忘了推送 | `git push origin` + `git push github` |
