# RC1 Release Blocker Verification Corrective V1 Plan

## 1. Frozen identity

- Task：`RC1-RELEASE-BLOCKER-VERIFICATION-CORRECTIVE-V1-20260817`
- Base：`639e8186790877898d2883be58fd41894ea45ea3`
- Base tree：`e3c2449dd8b28b09a6694230802df934e6241167`
- Corrective manifest digest：`sha256:fd9a97e71e3a91af6ecde93efec09483b4f8f5cdd78524ff713a76b39102571a`
- Failed local candidate：`dd28a1c133f0c0327086ded8006998d22163f1bd`
- Goal：保持 `/health` installed-metadata-only，同时让 M0 在无网络、仓库外临时安装 wheel 后完成全量后端验证。
- Scope decision：复用原23路径中的 `backend/tests/test_runtime_lock.py`，禁止第24路径。

## 2. Dependency graph

```text
exact 3-file corrective approval
  → Owner confirms manifest digest
  → exact single-parent approval commit on 639e818
  → Owner confirms approval SHA/tree and authorizes FF push
  → origin/ext-dev == corrective approval
  → M0 authorize GO
  → TDD installed-wheel runner inside test_runtime_lock.py
  → controlled repackage of all original 23 RC1 paths
  → focused + two full shards + complete RC1 matrix
  → independently authorized disposable-host 1+10 rounds
  → Code/Python/Security/Release review
  → final M0 verify-candidate PASS / canAcceptProductCandidate=true
  → Owner confirms exact candidate before any FF push
```

远端漂移、路径增至24、运行时 fallback、网络、工作树写入、测试遗漏或机器 authority STOP 均立即停止。

## 3. RED and GREEN

### RED

1. 冻结原始证据：`/usr/bin/python3 -m pytest -q` 为 `4089 passed / 4 skipped / 5 failed`，五个失败均为
   `PackageNotFoundError: chaotang-os-backend`。
2. 在 `test_runtime_lock.py` 增加行为测试，先证明当前没有 installed-wheel CLI。
3. 负例覆盖：未知参数、错误 shard、symlink/temp collision、错误 name/version、wheel 多余/缺失文件、安装命令
   尝试联网或解析依赖、代理继承、shard 重复/遗漏、pytest 非零、超时、清理失败和工作树漂移。

### GREEN

1. 只用 Python 标准库从当前 `app/` 与冻结 name/version 构建合法 wheel；排序、timestamp、mode、METADATA、
   WHEEL 与 RECORD 确定且 closed，不调用 Hatchling 或外网。
2. 只执行 `/usr/bin/python3 -m pip install --isolated --no-index --no-deps --no-cache-dir --target <new-temp>`；
   清除 proxy/index 配置与环境，禁止写 user site，安装后复核 distribution metadata 和 `app` 解析路径均落在
   临时安装根。
3. 父 runner 与 child 都用 `python3 -I -B`；runner 的 CLI 启动路径只使用标准库，第三方 import 延迟到
   pytest 收集路径。child cwd 位于仓库外临时根，环境无 `PYTHONPATH`、proxy/index/PIP 注入。第三方
   dependency roots 只能在确认不含 worktree、`.pth`、`app/`
   或候选 dist-info 后追加；`app` spec/file 与 distribution metadata 必须全部解析到安装 target。
4. 递归发现、排序全部 tracked `tests/**/test_*.py`，按固定 index modulo 2 形成非空 shard；runner 自证两个
   shard 的 union 等于全集且 intersection 为空。
5. child bootstrap 在隔离进程中先导入并锁定临时安装的 `app`，再调用
   `pytest -q --import-mode=importlib <exact shard paths>`；固定 timeout，捕获 exit/signal，始终清理。
6. runner 前后比较 Git tracked/untracked/ignored 状态，并递归哈希 backend app/tests 与构建输入树，确保既有
   ignored 目录内部变化也可见；两个 shard 分别低于 M0 的300秒硬上限；不得通过 `-x`、跳过、mark 排除或
   删除测试缩短时间。

## 4. Verification

- 原健康精准测试和 metadata 缺失负例。
- `python3 -m pytest -q tests/test_health.py tests/test_runtime_lock.py tests/test_sqlite_backup.py`
- `python3 -I -B tests/test_runtime_lock.py --installed-pytest-shard 1/2`
- `python3 -I -B tests/test_runtime_lock.py --installed-pytest-shard 2/2`
- manifest 精确 Ruff 参数。
- deployment checker + 38项既有测试。
- release tools 59项既有测试。
- product-authority 12项与根 Harness 146文件。
- `git diff --check`、精确23路径、parent/tree/digest、禁止网络/secret/provider/DB migration 扫描。
- 独立 Code、Python、Security、Release/Operations review。

所有通过证据必须来自新候选字节；旧 `dd28a1c…` 的专项 GO 只作基线线索。

## 5. GO / STOP

GO：三文件 approval 闭合；23路径不扩张；wheel 构建/安装无网络且只写临时目录；两个 shard 完整覆盖全量；
health 无 fallback；原 RC1 全矩阵、外部1+10轮与独立审查通过；最终 M0
`PASS / canAcceptProductCandidate=true`。

STOP：第24路径、动态测试排除、fake dist-info 而不构建/安装 wheel、读取 pyproject 作为运行时 fallback、用户
site 写入、网络/build isolation/依赖解析、工作树写入、shard 漏测/重复、300秒超时、旧候选证据复用、远端
漂移、authority STOP 或缺少 Owner 精确授权。

## 6. Rollback and current gate

纠正 approval 尚未形成；当前远端仍为原 RC1 approval。若新 approval 未获 Owner 确认，删除本三文件草案即可，
不影响远端或旧本地候选。当前只允许 packet schema/digest、Harness、authority regression 与独立只读治理审查；
不得实现 runner、修改产品候选、commit、push、merge 或部署。
