# RC1 Trusted Offline Wheelhouse Corrective V1 Plan

## 1. Frozen identity

- Task：`RC1-TRUSTED-OFFLINE-WHEELHOUSE-CORRECTIVE-V1-20260818`。
- Base：`74a9e198f2bf8104eaaf958052cb6cd6cebf6518`。
- Base tree：`ee0dcf48fc3d0e00dd9e3314413587170efc57d2`。
- Approval manifest RFC8785 digest：
  `sha256:85fe4f9edf909aedd7abf30d1aa6b40193b212567f823810c2eebdaa94d10dbc`。
- Target：`refs/heads/ext-dev`。
- Product scope：沿用原RC1精确23路径；唯一新增实现语义仍只在
  `backend/tests/test_runtime_lock.py`。
- Goal：让M0用lock哈希约束的完整离线wheelhouse运行installed-wheel全量测试，同时由OS强制断网和收容后代。

## 2. Dependency graph

```text
exact 3-file approval draft
  → schema/digest/Harness/independent governance review
  → Owner authorizes exact approval commit
  → exact single-parent approval commit on 74a9e198
  → Owner authorizes ordinary FF push
  → origin/ext-dev == new approval
  → M0 authorize GO
  → controlled repackage of exact 23 product paths
  → TDD wheelhouse + interpreter + namespace boundaries
  → focused/mocked negative matrix + pre-commit Code/Python/Security/Release review
  → Owner authorizes exact local candidate commit (identity freeze only)
  → Owner confirms candidate SHA/tree
  → separate provisioning authorization binds candidate SHA/tree + lock SHA + wheel-set digest + target
  → provision exact 64 hashed wheels outside repository, then disable egress
  → two full shards + complete RC1 matrix + final read-only reviews
  → final M0 verify-candidate PASS
  → Owner separately authorizes candidate FF push
```

任何远端漂移、第24路径、wheelhouse下载未授权、lock覆盖不完整、网络可达、用户site导入、namespace不可用、
300秒超时或机器authority STOP都立即停止。

## 3. Governance packet gate

只修改manifest、task和本plan。验证：

1. base/tree/仓库/branch精确；
2. approval paths恰三条，product paths恰23条且与上一批准完全相同；
3. verification IDs、non-goals和paths排序唯一；
4. `tool: python3` 由受保护M0 consumer的 `TOOL_PATHS` 映射为 `/usr/bin/python3`；不扩张authority/schema；
5. manifest strict parse、schema、canonical digest、Harness/self-test与authority regression通过；
6. 独立治理和安全审查无High/Critical。

## 4. TDD implementation

### RED

在 `backend/tests/test_runtime_lock.py` 先增加失败测试：

- 缺失/错误wheelhouse参数；
- wheelhouse symlink、子目录、hardlink、sdist、额外文件、少于/多于64 wheel；
- wheel hash、METADATA name/version、filename tag与WHEEL Tag篡改；
- 同distribution重复、lock entry遗漏、未知distribution；
- 用户site、`.pth`、sitecustomize、worktree package与候选metadata遮蔽；
- 父解释器不是 `/usr/bin/python3` 或 `/usr/bin/unshare` 身份/权限漂移；
- namespace中外部socket可达、无 `--kill-child` 或 `setsid` 后代残留；
- wheelhouse在读取期间替换、目录漂移、复制/安装/pytest/cleanup失败。

### GREEN

1. CLI只接受冻结shard和固定绝对wheelhouse。
2. 标准库解析lock并安全复制wheel，形成name/version/hash的一一闭包。
3. 用已验证pure `packaging` wheel引导兼容tag检查；任何不确定性失败关闭。
4. 把64个精确wheel以`--isolated --no-index --no-deps --no-cache-dir`装入全新临时dependency target。
5. candidate wheel单独构建/安装，保持唯一`app`和distribution metadata事实源。
6. child经 `/usr/bin/unshare --user --map-root-user --net --pid --fork --kill-child --mount-proc`执行；
   `-I -B -S`、无外部route、无user site、candidate target在dependency target之前。
7. 保持shard全集/互斥证明、workspace递归快照、timeout、进程和临时目录清理。

不引入新runner、依赖、配置、CI、数据库、Provider、页面或业务行为。

## 5. Wheelhouse provisioning gate

实现、无需真实wheelhouse的测试和预提交审查完成后，先请求Owner按精确parent、23路径和staged digest授权本地
candidate commit。commit只冻结身份，不表示候选通过。确认candidate SHA/tree后才请求单独provisioning授权；
该授权必须绑定：

- exact candidate SHA/tree/parent；
- `requirements-runtime.lock` SHA-256
  `75a581885501e32fde1bd48292e4eb7d948a5884a9a760e8f5cc9ddfc8f6f838`；
- 64项 `<canonical-name>==<version> sha256:<hex>\n` 排序集合 SHA-256
  `6c54b7899da80b31c0e8660c294d208c2d0bf0cabd5947b4dcafc20cf04d3bd7`；
- 固定目标 `/var/tmp/chaotang-m0-wheelhouse`，要求新建空目录；
- 只读来源origin清单、无凭据、无上传；
- 下载后每wheel立即核对lock hash；
- 最终64 wheel清单和集合digest；
- 完成后关闭网络，再运行M0验证。

失败或缺少任一wheel时不使用用户site补齐，不运行shard，不宣称候选通过。provision后candidate/lock/集合digest任一
变化都会使证据失效；M0不再验证该candidate，必须重新治理，不能amend单亲candidate。

## 6. Verification matrix

1. `/usr/bin/python3 -m pytest -q tests/test_health.py tests/test_runtime_lock.py tests/test_sqlite_backup.py`。
2. `/usr/bin/python3 -I -B tests/test_runtime_lock.py --installed-pytest-shard 1/2 --wheelhouse /var/tmp/chaotang-m0-wheelhouse`。
3. `/usr/bin/python3 -I -B tests/test_runtime_lock.py --installed-pytest-shard 2/2 --wheelhouse /var/tmp/chaotang-m0-wheelhouse`。
4. manifest精确Ruff。
5. deployment checker/tests。
6. release tool tests。
7. product-authority regression。
8. root Harness与self-test。
9. `git diff --check`、精确23路径、无删除/secret/provider/runtime/DB migration扫描。
10. 原RC1另行授权的真实disposable-host、scanner、bundle、backup和连续10轮验收仍须完成。

每次实现字节变化重跑受影响测试；最终候选必须使用同一wheelhouse集合digest。旧候选、旧shard和旧Reviewer结论
不能继承。

## 7. Independent review

- Code：分区、CLI、错误路径、timeout和cleanup。
- Python：wheel/ZIP/METADATA/tag解析、TOCTOU和import isolation。
- Security：供应链hash闭包、user-site拒绝、namespace/no-egress与后代收容。
- Release/Operations：固定路径、provisioning证据、可复现命令和未验证范围真实性。

High/Critical必须修复；Medium修复或由Owner明确接受。修复后重新运行相关矩阵和复审。

## 8. Commit, candidate and deployment boundaries

治理approval commit、approval push、产品candidate commit、candidate push、wheelhouse provisioning、外部验证和部署
均为独立授权。任何方向同意不能替代精确SHA/tree/path/digest授权。该任务不授权部署；用户测试链接只能来自后续
绑定landed SHA的隔离部署。

## 9. Rollback and current gate

当前只存在三份治理草案。未获approval commit授权时不提交；未landed时不修改产品。废止本草案不会改变远端、
旧产品来源工作树或运行环境。
