# 决策 0045：跨平台并行开发模型（多 worktree + 小步合并）

## Status

Accepted — 2026-10-07（owner 侧提出："同事有的在 WSL、有的在 Windows，怎么统一；是否只能最后合并"）

## Context

本仓库的实际开发面同时存在四种差异：操作系统（Windows 原生 / WSL2 Linux）、客户端（Codex / Claude Code）、人（owner 与同事）、以及 AI agent 会话（Orca / WorkBuddy 多路并行）。截至本决策，仓库中同时存在 14 个 worktree、20 个本地分支，说明并行开发**已经在事实上发生**。

但政策是缺位的：`docs/product-collaboration.md` 明确写着"两个客户端不得同时修改同一工作区。需要并行工作时，必须另行决定 worktree、分支和合并"，而这份"另行决定"从未作出；`docs/tooling-compatibility.md` 也声明其不定义并行写入与 worktree 隔离。于是团队没有共享规则可依：既没有人知道能否并行，也没有人知道并行到什么粒度、何时合并。

此前的实际教训已经证明缺口的代价：2026-10-06 因双平台无行尾契约产生了整文件 CRLF↔LF 假差异；2026-10-07 因 worktree 无生命周期规矩，积压到 25 个（含 4 个在 C 盘 Temp）。

必须先纠正一个方向性误解：**平台差异（Windows vs WSL）不构成并行开发的障碍。** 版本控制的内容冲突只由"同一文件被双方修改"产生，与双方使用什么操作系统无关。真正的并行约束是文件级冲突域、工作区隔离与合并节奏。

## Decision

### 1. 并行是默认能力，不是例外

同一仓库允许多人、多客户端、多 agent 同时开发。并行单位固定为 **一个 worktree + 一条短命分支**（一人 / 一任务 / 一 agent 一个），互不共享工作目录。适用于 Windows 与 WSL2 两侧，两侧地位平等。

禁止的做法是"把代码各自改完、最后统一合并"——那是集成地狱（integration hell）：分支存活越久，合并冲突面积越大、语义漂移越远、验证越不可能。本仓库明确采用**小步、频繁、可验证的合并**：分支存活期以小时到 1 天为目标，最长不超过 3 天；每天至少与 `ext-dev` 完成一次集成。

### 2. 权威层与开发层分离

- **权威验证层**：Linux（CI，`.github/workflows/harness.yml`）是唯一裁决者。**本地绿不算绿，CI 绿才算绿。**
- **开发层**：Windows 原生与 WSL2 均可，各自保留惯性环境，互不强迁。平台策略细节见 `docs/platform-strategy.md`。

### 3. 平台差异由契约消除，不靠人记

| 差异 | 消除机制 | 状态 |
|---|---|---|
| 行尾 CRLF/LF | `.gitattributes`（`* text=auto eol=lf`，`.bat/.cmd/.ps1` 豁免） | 已落地 |
| 路径形式（`H:/` vs `/mnt/h/`） | 治理脚本自带归一（`check-worktrees.mjs` 的 `normPath` + `CHAOTANG_WORKTREE_WHITELIST`） | 已落地 |
| 平台专属能力 | 归属清单：NSSM / DPAPI / 便携 PS 脚本仅 Windows；产品验证以 Linux 为准 | 已落地 |

### 4. 真正必须串行的只有"共享核心"

并行度不受平台限制，但受**共享核心文件**限制。以下文件任何时刻只允许一个分支修改，改动需 M0 审批（`product-authority.m0.v1`），天然串行：

- `AGENTS.md`（canonical SHA256 锁定 + 80 行上限）、`scripts/check_harness.mjs`（门禁自身）；
- 跨域契约文件：`docs/product-collaboration.md`、`docs/platform-strategy.md`、`docs/tooling-compatibility.md`；
- 依赖清单与锁文件（`backend/pyproject.toml`、`frontend/package.json`、lock 文件）。

建议的**冲突域切分**（降低冲突概率，非强制）：`backend/app/agents/*` 按司/部目录、`frontend/src/app/*` 按页面、`docs/product/tasks/*` 按任务文件——一任务一文件，天然不冲突。

### 5. 冲突处置

沿用既有铁律（`AGENTS.md`）：推送前 `fetch + merge`（**不 rebase**，保护在途工作），冲突上报 owner，**禁止 force push**。合并后按本 ADR 第 6 节自检。

### 6. 并行任务自检清单

开工前：

- [ ] 在**独立 worktree** 内工作（白名单目录，禁 C 盘；`node scripts/check-worktrees.mjs` 应绿）；
- [ ] 分支名对应任务文件（`docs/product/tasks/*`），任务已获授权；
- [ ] 确认所改文件不在第 4 节"共享核心"清单内，或已取得对应审批。

收尾时：

- [ ] `node scripts/check_harness.mjs` 通过，或明确记录平台相关失败（`docs/product/tasks/*.md` 内）；
- [ ] 与 `ext-dev` 集成并推送双远端（`origin` Gitee + `github`）；
- [ ] **移除本任务 worktree**（`git worktree remove`，脏仓先按 `docs/worktree-governance.md` 抢救）；
- [ ] 平台专属验证在对应平台执行并留证据，不得由另一平台代跑。

## Consequences

正面：并行开发有了成文依据，新人/新 agent 无需再问"能不能同时干"；平台差异被契约消除，不再产生假差异与假告警；小步合并把集成风险摊平到每次提交；worktree 数量由自检清单中的收尾动作自然收敛。

代价与约束：共享核心文件的串行化会在短期内成为瓶颈（这是有意的安全取舍）；每任务一个 worktree 带来磁盘占用（需靠收尾回收纪律维持）；WSL 同事在 `.gitattributes` 生效后首次 touch 文件会出现一次行尾归一 diff，需接受。

未解决：行尾一次性归一（`git add --renormalize .`）仍需团队协同窗口，不属本 ADR 执行范围，另行安排。

## Verification

- `node scripts/check-worktrees.mjs` 返回 exit 0 且全部 worktree 位于白名单；
- `node scripts/check_harness.mjs` 无新增失败项；
- CI（`.github/workflows/harness.yml`）在合并提交上通过——作为并行成果的最终裁决证据；
- `docs/product-collaboration.md` 的"必须另行决定"指向本 ADR，政策缺口闭合。
