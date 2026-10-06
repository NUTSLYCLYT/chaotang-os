# 双平台开发策略（Windows / WSL2）

> 状态：2026-10-07 由 owner 侧提出并落地（对应问题："有的同事在 WSL、有的在 Windows，怎么统一"）
> 结论一句话：**统一"契约"，不统一"操作系统"。Linux 是唯一裁决者，Windows 与 WSL2 是平等的开发端。**

## 1. 为什么不做"全员同系统"

强行统一操作系统是**成本最高、收益最低**的选项：

- 迁 WSL：同事已在 WSL 且该环境与既有文档基线一致，回迁 Windows 纯属浪费；而 Windows 侧的便携启动体系、NSSM 服务化、PowerShell 运维脚本无法在 WSL 内等价运行。
- 迁 Windows：WSL 侧的路径/权限模型已产出过大量验证资产，且 Linux 是 CI 的实际运行环境，砍掉它等于砍掉权威验证平台。
- 历史教训：本仓库 2026-10-06 因 Windows 与 WSL 双端并存、无行尾契约，产生了整文件 CRLF↔LF 翻转噪音（AGENTS.md 显示 69 行"删除"实为换行符噪音）。

因此策略是**分层**：权威层唯一，开发层开放，靠契约层保证等价。

## 2. 三层模型

| 层 | 定义 | 现状 |
|---|---|---|
| **L1 权威验证层** | **Linux（GitHub Actions，ubuntu-latest）**。门禁与产品验证的最终裁决者 | ✅ 已存在：`.github/workflows/harness.yml`（Node 24 / Python 3.12） |
| **L2 开发平台层** | 各人保留惯性平台：Windows 原生 或 WSL2 Linux 文件系统 | ✅ 现状即为双平台 |
| **L3 契约层** | 让双平台产出**等价**的机制 | ⚠️ 本轮补齐（见下） |

## 3. L3 契约（本轮落地）

1. **行尾契约**：新增 `.gitattributes`，文本文件一律 `text=auto eol=lf`，二进制与 `.bat/.cmd/.ps1` 显式豁免。
   消灭 CRLF/LF 噪音这一类"看似改动、实则换行符"的假差异。
2. **路径契约**：治理脚本不得硬编码单平台路径。`scripts/check-worktrees.mjs` 白名单支持
   `CHAOTANG_WORKTREE_WHITELIST` 环境变量覆盖，且自动把 WSL 的 `/mnt/<盘>/` 归一为 `<盘>:/`。
3. **平台敏感操作清单**（见第 4 节）：明确哪些动作只能在哪个平台做，避免"这边绿了那边红"。

## 4. 平台归属清单（不可跨平台代跑）

| 操作 | 归属平台 | 理由 |
|---|---|---|
| `node scripts/check_harness.mjs` 等治理门禁 | **两平台均可**，但**结论以 CI 为准** | 脚本已跨平台；本地结果仅供参考 |
| 产品后端/前端功能验证 | **以 Linux(CI) 为准** | L1 权威层 |
| Windows 专属：NSSM 服务化、便携启动脚本（`Start-Portable-Fusion.ps1`）、DPAPI 凭据域 | **仅 Windows** | 依赖 Windows API |
| Windows 路径/进程语义测试（`run_accounting_synthetic_acceptance.py` 的 Job Object/WinDLL 分支） | **仅 Windows**，Linux 侧自动跳过 | 代码已按 `process.platform`/内核分支区分 |

## 5. 铁律

1. **本地绿不算绿，CI 绿才算绿。** 任一端"仅本地通过"不得宣称任务完成。
2. **平台相关的失败必须写进任务文件**（`docs/product/tasks/*.md`），不得静默忽略。
3. **禁止在另一个平台"手工补做"平台专属验证**，只能改由对应平台执行并留证据。
4. 共享文件（`AGENTS.md`、`docs/*`、`scripts/*`）改动后，两平台都要能读到同一份语义。

## 6. 落地步骤（owner 拍板后执行）

- [x] 新增 `.gitattributes`（行尾契约）
- [x] `check-worktrees.mjs` 路径可移植化（环境变量 + `/mnt/` 归一）
- [x] 本文件入库，纠正 `docs/tooling-compatibility.md` 中"主工作区仅位于 WSL2"的过时表述
- [ ] **行尾一次性归一**（团队协同窗口，需全员知晓后统一执行）：
      `git add --renormalize . && git commit -m "chore: normalize line endings per .gitattributes"`
- [ ] WSL 同事在新克隆上验证：`node scripts/check_harness.mjs && node scripts/check-worktrees.mjs`

## 7. 与既有文档的关系

- `docs/tooling-compatibility.md`：定义 **Codex / Claude Code 客户端**兼容基线（仍然有效），
  其"支持环境"一节已按本策略修正为双平台。
- 本文件：定义 **人 + 平台** 的开发策略，是前者的上位约束。
- `docs/worktree-governance.md`：worktree 生命周期规矩，两平台同等适用。
