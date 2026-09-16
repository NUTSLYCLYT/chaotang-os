# M0 Solo-owner Product Authority Plan

## 1. Contract

- Task：`M0-SOLO-OWNER-PRODUCT-AUTHORITY-20260816`
- Base/tree：`911124eb6f5acdb9896d5c26c2e607ed3a4d30ce` /
  `e16c33dc45eb1d1e19be839fbbd21e0d405cae9c`
- Branch：`codex/m0-solo-owner-product-authority-rebased-20260816`
- Scope：任务文件列出的 13 个 exact paths。
- Exit：M0 consumer 可用但无 approval；`STOP / canExecuteProductWork=false`。

## 2. Trust Boundary

- Owner 是唯一决策 authority；Codex 是 implementer；consumer 只是确定性验证器。
- 当前信任 OS/Gitee Owner，不承诺抵御已控制 Owner 会话、runner 或 Gitee admin 的攻击者。
- Approval digest 确认、候选 SHA/tree 确认和 Git 外部动作是三个独立 Owner 决策点。
- 旧 `execution-authority.ext.v1` 保持不变，作为更强外部信任方案的历史实现和 STOP 观察源。

## 3. TDD Slices

1. RED：缺 consumer；GREEN：closed manifest、canonical digest 与 CLI status。
2. RED：审批提交或远端漂移；GREEN：immutable Git parent/tree/diff 与 Gitee head 检查。
3. RED：产品候选扩权、验证失败或写工作区；GREEN：精确单亲子、shell-free matrix、digest evidence。
4. RED：root manifest 未登记 M0；GREEN：schema/manifest/doctor 只读观察 M0 STOP。
5. RED：Harness 未登记新文件和 approvals policy；GREEN：精确静态核加结构化 approval 扩展点。
6. Reconcile：保留 G1 schema digest 和逐段 symlink 防护；M0 authority observation 复用相同防护并新增负测。
7. Security RED：假 remote resolver、验证期间 HEAD 移动/恢复、控制字符和治理入口 product path；
   GREEN：固定远端解析器、逐命令候选身份检查、closed path 与 protected governance surface。

## 4. CLI Contract

```text
--status                                -> STOP / APPROVAL_NOT_SELECTED / exit 0
--digest --task <exact-id>              -> validated canonical digest / exit 0
--authorize --task <exact-id>           -> GO only at exact remote approval commit
--verify-candidate --task <exact-id>    -> PASS only for exact candidate + verification
unknown/missing/stale/expanded          -> STOP / exit 2 (usage errors exit 64)
```

No CLI command creates manifests, edits files, commits, pushes, merges, signs or logs secrets.

M0 落地后停止新增 Harness 功能；Deferred G2 不阻塞 H1。下一次正常施工必须由独立 H1 approval
commit 精确绑定产品路径和验证矩阵，M0 本身不生成该 approval。

## 5. Verification

```bash
node --test scripts/product-authority.test.mjs
node --test scripts/harness-doctor.test.mjs
node scripts/product-authority.mjs --status
node scripts/harness-doctor.mjs --check
node scripts/harness-doctor.mjs --status
node scripts/harness-doctor.mjs --ready  # expected exit 2
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node --test scripts/execution_authority_ext.test.mjs
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Each frozen round also checks base/remote, exact 13 paths, fingerprint, secret/conflict/CR/trailing whitespace,
M0 status STOP, root NOT_READY and ext authority STOP. Any candidate byte change resets the count to 1/10.

## 6. Review and Handoff

- Main session performs code and security review; no independent reviewer is claimed under current quota.
- Candidate verdict is at most `CONDITIONAL PASS / NO INDEPENDENT REVIEW`.
- Commit and Gitee fast-forward push require separate exact Owner authorization after candidate identity exists.

## 7. Credential-separated receipt-gated v2 additive plan (2026-09-15)

1. 保持 v1 parser/schema/94 个历史 approval 的字节与行为回归；v2 只在 manifest 显式声明时启用。
2. RED：缺失/空/未知 policy、重复 verification ID、tool/args/cwd/source identity 漂移、非法 18-case。
3. GREEN：closed v2 schema 与运行时 validator 将 controller/verifier verification entry 绑定 raw/blob/mode/bytes。
4. RED：缺 receipt、过期、重放、跨 approval、错 remote/digest/FD、case 缺失/重排、直接 CLI 绕过。
5. GREEN：authority 构造 exact approval-source object closure；root-owned broker 以 `SO_PEERCRED`、独立 UID、
   PID/network namespace、sealed FD 与 per-connection systemd cgroup 生成双层 canonical receipt。
6. authority 重建完整 challenge，核验 source manifest、live peer、service invocation，并在回复后确认同一 service
   inactive、同 cgroup empty；same-UID helper/fallback 和 broker GO builder 都不存在。
7. 回归：product-authority focused、broker static、schema、Harness、doctor、hook、V2；focused/backend-full 进程使用
   `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`，不持久修改系统、用户、Git、Python 或 Node 配置。
8. 独立 Governance/Architecture/Code/Security review 任一 P0–P2 即 STOP；exact9 本轮只冻结未提交 candidate
   evidence，不创建 candidate commit、不推送、不安装、不启动服务。installed acceptance 必须另行治理。
