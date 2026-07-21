# Claude Code Exact-H Independent Review — R0-W01 execution-authority v2

| Identity | Value |
| --- | --- |
| Base B | `48ea569a6c4cdc40bdd1b0070e990e7637da39a7` |
| Candidate H | `e467254cb0345b1989d33461ccc5511cba37a743` |
| Tree | `3da9bf1d846026b1bf72daba4e622af30d42ff88` |
| Canonical binary diff SHA-256 | `183fca4234522407408b2597cf05e4c1c8a257e1ef607c3c29ad6792b930e1c0` |
| Scope | 10 files changed (6 new, 4 modified), execution-authority v2 stack |
| Reviewer | Claude Code, Sonnet, read-only, independent (non-implementer) session |

## Verdict

| Lane | Verdict | Unresolved HIGH | Unresolved MEDIUM |
| --- | --- | ---: | ---: |
| Authority (v1 freeze, amendment scope) | GO | 0 | 0 |
| Correctness (resolver logic, tests, doctor) | GO | 0 | 2 |
| Git-Evidence (identity, digests, atomicity) | GO | 0 | 0 |

Combined verdict: **GO**（0 HIGH / 2 MEDIUM，均判定不阻塞合并）。

## Independent verification (all commands re-run fresh by the reviewer, not trusted from implementer claims)

| Command | Result |
| --- | --- |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 26 pass / 0 fail |
| `node --test scripts/r0-amendment-check.nodetest.mjs` | 10 pass / 0 fail |
| `node --test scripts/execution-authority.nodetest.mjs` | 9 pass / 0 fail (v1 回归) |
| `node scripts/execution-authority-v2.mjs --check` | `VALID_STRUCTURE`, exit 0 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W01` | `GO`, exit 0 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W02` | `STOP/BLOCKED_DEPENDENCY`, exit 2 |
| `node scripts/harness-doctor.mjs` | 0 errors / 0 warnings |
| `git diff --stat B..H -- <5 v1 frozen paths>` | 空输出，v1 零改动确认 |

## Findings

**MEDIUM-1**：`REVIEW_NOT_GO` 和 `MULTIPLE_ACTIVE_WORK_PACKAGES` 两个 reason code 在
`resolveExecutionAuthorityV2` 里是死代码——对应条件已经被 `validateExecutionAuthorityV2Manifest`
更早拦截，短路成 `INVALID_EXECUTION_AUTHORITY`，这两个具名 reason 永远不会被真正返回。不是安全
绕过（fail-closed 结论不变），但 wiki 的 reason code 枚举表把它们记成"会出现"的独立结果会误导未来
按 reason 分支的自动化。修复:要么去掉 resolver 里的冗余判断+从枚举表删除,要么把对应检查从
manifest 校验层挪到 resolver 层让专属 reason 真正触发。

**MEDIUM-2**：`execution-authority-v2.mjs` 的 `readPinnedAuthorityFile` 和
`amendment-governance.mjs` 的 `verifyAmendmentApprovalEvidenceFiles`/`safeRepositoryPath` 重复
实现了几乎一样的逐段 symlink 安全读取逻辑。两份实现各自正确,但未来对其中一份做安全修复容易漏改
另一份。建议 W02 之前抽成共享 helper。

两条均判定**不阻塞本次合并**,记录为 R0-W02 packet 前置技术债。

## Non-authorization statement

本审查只确认 H 的实现质量和 fail-closed 行为,不批准 R0-W02–R0-W09 runtime、真实客户数据或上线。
这是对已获批 W01 range 内实现工作的复核,不是新的范围批准。
