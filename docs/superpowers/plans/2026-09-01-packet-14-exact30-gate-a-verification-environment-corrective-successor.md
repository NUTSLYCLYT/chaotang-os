# P14 Exact30 Gate A Verification-Environment Corrective Successor Plan

## Status

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

在 `07bf7268ad8384bf55a147fcab7d6cfd483d457d` 上 forward-only 修复 P14 Gate A 的两条确定性验证合同错误，保持 exact30 产品字节、路径、负向测试与安全边界不变。使用唯一 canonical `runtime_lock.py` 和 root-owned offline wheelhouse，不创建第二套测试 runtime、authority 或依赖事实源。

## Frozen Facts

- Base：`07bf7268ad8384bf55a147fcab7d6cfd483d457d`；tree `b97e72ce033c930b7a1aade7703229274dad2909`。
- Old authority：`GO` 但未消费；disposition `ABANDONED_AFTER_VERIFICATION_ENVIRONMENT_CONTRACT_STOP / NO_RETRY / NO_AUTHORITY_INHERITANCE`。
- Donor：exact30 当前未提交字节；bundle `sha256:27c544f37e9549d3a99f66ace498bccd8c3a8d5e2d94ce028773fe48b4be4882`；diff `sha256:6af72651a1da268e32f3c29af6642afcd496f6792eae4bb8817e787fb9da2e18`。
- Product scope：exact30，`30 MODIFY / 0 ADD`，全部 `100644`。
- Protected exact2 与当前主线其他字节不得修改。

## Execution DAG

1. `STOP_EVIDENCE`：复算失效命令，证明 raw backend full 是 pytest user-site 隔离冲突、runtime-lock 缺少必填参数，且原 required/focused/Ruff gate 未隔离用户 site。
2. `DONOR_FREEZE`：只读冻结 exact30 30 文件 raw/blob/mode/bytes、bundle 与 full-index diff。
3. `GOVERNANCE_DRAFT`：新 proposed approval 将全部后端 pytest/Ruff 执行收口到 canonical 三 shard；gate 07/10 仅以隔离标准库证明 required/focused 与 Ruff 覆盖合同，并在 committed child 上绑定 exact30 bundle/diff；其余门与产品范围不放宽。
4. `GOVERNANCE_VERIFY`：strict JSON、duplicate keys、schema、manifest validator、Task contract、Harness、Doctor、canonical/raw/bundle。
5. `INDEPENDENT_REVIEW`：Governance 检查 lineage；Python 检查 shard 覆盖与 runtime-lock；TypeScript 检查前端门不回退；Security 检查依赖来源、环境注入和旧 authority 生命周期。
6. `OWNER_FREEZE`：只在 Owner 精确确认 canonical digest 后物化正式 approval。
7. `APPROVAL_FF_AND_GO_ONCE`：三文件 direct child，普通 fast-forward；authority 前后执行与 gate 00/98 字节等价的固定 URL、隔离 config、local include/sshCommand/insteadOf 拒绝和 `/usr/bin/ssh -F /dev/null` 远端读取；machine authority 只运行一次，任一 transport 失败永久 STOP。
8. `BYTE_REMATERIALIZATION`：新 candidate 只重物化冻结 exact30，不重新开发或继承旧验证身份。
9. `PRECOMMIT_MATRIX`：负向节点、focused、三 shards、frontend、release、Harness/Doctor/authority/V2、四审。
10. `LOCAL_BYTE_FREEZE_CHILD`：只创建本地 `BYTE_DONOR_ONLY / NO_CANDIDATE_ACCEPTANCE` direct child。
11. `COMMITTED_00_98`：运行 manifest 00–98；固定 99 exit 86，不运行 machine verify-candidate、不 push。
12. `GATE_B`：另立 supervisor 与 product acceptance successor，随后真实浏览器、Pilot、可回滚 RC；不生产部署。

## Verification Contract Correction

旧 raw backend-full、required-node 与 focused/Ruff 宿主命令被删除，因为它们没有通过同一闭合来源供应 pytest/Ruff。不得通过 `PYTHONPATH`、用户 site、系统安装或联网补洞。gate 07/10 只读取 candidate test inventory 与 AST/源码合同，证明九个 required nodes、八个 focused 文件属于三 shard 闭合 inventory，且 Ruff 的目标为 snapshot `app/tests`；静态证明不冒充执行证据，真实执行只来自 11–13 的 candidate venv。

替换为三个 canonical runtime-lock shard：

- `/usr/bin/python3 -I app/operations/runtime_lock.py verify-candidate ... --shard-count 3 --shard-index 0 --deadline-seconds 240`
- 同上，`--shard-index 1`
- 同上，`--shard-index 2`

每个 shard 环境固定 `TMPDIR/TEMP/TMP=/tmp`、`PYTHONNOUSERSITE=1`、`PIP_CONFIG_FILE=/dev/null`、`PIP_NO_INDEX=1`、`CI=1`。runtime-lock 使用 `requirements-runtime.lock`、`pyproject.toml`、root-owned `/var/tmp/chaotang-m0-wheelhouse`，在临时工作区构建并安装候选 wheel，关闭 source-root、user-site、host package、网络与第三方 pytest plugin 漂移。三个 shard 共同证明完整 backend 集合；不得删减为单 shard。

## Preserved Matrix

- 九个 required Python negative nodes与五个 runner negative titles逐节点 PASS，零 skip/xfail/todo。
- Backend focused、Ruff、runtime registry production-consumer identity。
- Committed child 的 30 文件 RFC 8785 bundle 与 parent-to-child full-index diff 机械等于冻结 donor；不得仅验证历史 donor 输入。
- Frontend offline install、依赖树前后身份、726+ tests、lint、typecheck、production build。
- Release evidence/build/verify/RC acceptance regressions。
- Harness、hook、Doctor/tests、product-authority regression、V2 check/tests、diff check。
- remote approval 前后双读、exact30/保护路径、donor input 与 test non-relaxation 身份门。

## Stop Conditions

- Remote/base/tree、old authority disposition、donor path set、bundle 或 diff 漂移。
- 第 31 product path、修改 runtime-lock/lock/wheelhouse/Harness/authority/readiness validator。
- 任一 shard 缺失、timeout 被放宽、使用 user site/PYTHONPATH/system install/network。
- 测试选择器、断言、skip/xfail/todo、前端依赖树或终止器 99 被放宽。
- 任一验证失败、machine STOP、独立 P0–P2 或真实外部副作用。

## Rollback

草案和未推送 approval 可直接放弃；不得清理任何 donor。Gate A 本地 child 永不推送。远端一旦普通快进，所有纠正都必须使用新 successor，禁止 rebase、force-push 或历史改写。
