# 任务：RC1 可信离线 Wheelhouse 验证纠正 V1

> Task ID：`RC1-TRUSTED-OFFLINE-WHEELHOUSE-CORRECTIVE-V1-20260818`

## Status

Draft

## Problem and frozen evidence

`origin/ext-dev` 当前精确位于已落地治理批准
`74a9e198f2bf8104eaaf958052cb6cd6cebf6518`（tree
`ee0dcf48fc3d0e00dd9e3314413587170efc57d2`）。该批准的受控产品席位已按原23条路径重包 RC1，
但仍未形成候选 commit、未 push、未部署。

第一次 installed-wheel 纠正使用当前用户的 `site-packages` 作为 pytest 依赖来源。独立安全审查判定该来源可由
当前用户预置或篡改，不能作为发布门禁的可信依赖；同一审查还要求 child pytest 由操作系统强制断网并收容所有
后代进程。独立代码审查要求父 runner 与 child 都强制使用冻结的 `/usr/bin/python3`，不得仅依赖调用者 PATH。

在只读诊断中，`requirements-runtime.lock` 冻结64个 distribution。本机 pip cache 中只有60个 distribution
存在与 lock 允许 SHA-256 完全一致的 wheel；缺少：

- `anyio==4.10.0`；
- `fastapi==0.116.1`；
- `pygments==2.17.2`；
- `starlette==0.47.3`。

因此不能把现有用户 site 或不完整缓存包装成全绿。本纠正把第三方测试依赖改为一个显式、仓库外、完整、逐字节
受 lock 约束的离线 wheelhouse；wheelhouse 的取得仍是另行授权的外部动作，本治理阶段不下载任何内容。

原23路径来源中冻结的 `requirements-runtime.lock` SHA-256 是
`75a581885501e32fde1bd48292e4eb7d948a5884a9a760e8f5cc9ddfc8f6f838`。按 canonical name 排序、每行精确
`<name>==<version> sha256:<hex>\n` 的64项wheel选择集合 SHA-256 是
`6c54b7899da80b31c0e8660c294d208c2d0bf0cabd5947b4dcafc20cf04d3bd7`；未来候选任一值不同即重新批准，
不得为其provision wheelhouse。

## Product Definition

未来产品候选仍严格是本 manifest 的原23条 `productPaths`。唯一新的实现行为位于既有批准路径
`backend/tests/test_runtime_lock.py`：

1. installed-wheel CLI 必须同时收到精确 shard `1/2` 或 `2/2` 与固定 wheelhouse
   `/var/tmp/chaotang-m0-wheelhouse`；缺失、不同路径、未知参数或额外位置均失败关闭。
2. wheelhouse 必须是仓库外真实目录，目录内恰好64个 regular `.whl`，无子目录、symlink、hardlink、sdist、
   socket/device/FIFO、重复名称/版本或额外文件。
3. `requirements-runtime.lock` 是唯一依赖事实源。runner 只用标准库解析其中64个精确 name/version 与所有允许
   SHA-256；每个 wheel 必须命中对应 entry 的允许 SHA，METADATA name/version 必须一致，64个 entry 必须一一
   覆盖。wheelhouse 中缺少、重复或多出任一 distribution 均失败。
4. runner 以 `O_NOFOLLOW` 等价的安全打开方式把 wheel 复制到权限0700的仓库外临时根；复制前后冻结目录项、
   inode、mode、size 与 SHA-256，拒绝读取中替换、目录漂移和硬链接。后续只使用私有副本。
5. 先以标准库证明已哈希验证的 `packaging` wheel 是兼容的 pure-Python bootstrap，再从其私有副本加载
   `packaging.tags`/wheel filename parser，要求其余63个 wheel 的 filename tag 与 WHEEL `Tag` 均兼容
   `/usr/bin/python3` 当前平台；不得信任 wheelhouse 自带 `.pth`、sitecustomize 或任意预安装模块。
6. 只允许从这64个已复制、已验证、兼容 wheel 构造第三方临时依赖根；可使用固定
   `/usr/bin/python3 -m pip install --isolated --no-index --no-deps --no-cache-dir --target <temp>` 对精确本地绝对
   wheel 列表安装，但禁止依赖解析、索引访问、sdist/build isolation、用户 site 写入或从其他 root 导入。
7. 候选应用 wheel 继续按前一批准在另一个临时 target 中确定性构建和 `--no-deps` 安装；candidate `app` 与
   `chaotang-os-backend` metadata 必须只解析到该 target，第三方依赖只能在其后。
8. M0 manifest 的 `tool: "python3"` 由受保护的 `product-authority.mjs` 固定映射为
   `/usr/bin/python3`；runner 自身还必须比较 `sys.executable` 的真实路径，父/child 任一不是冻结解释器即失败。
9. child 必须通过 root-owned、不可写的 `/usr/bin/unshare` 进入 user、network 与 PID namespace，使用
   `--fork --kill-child --mount-proc`；network namespace 不得有外部路由，直接 socket 出站探针必须失败。超时、
   signal 或 runner 退出时，PID namespace 和进程组两层都必须清除后代，包括 `setsid` 后代。
10. 两个 shard 继续完整、互斥覆盖所有 tracked `backend/tests/**/test_*.py`；工作树字节/状态快照、临时目录清理、
    metadata-only health 与300秒单 shard 上限全部保持。

## Wheelhouse provisioning boundary

本任务不授权下载。approval landed后先完成实现、无需真实wheelhouse的负例/精准测试和预提交独立审查；随后由
Owner按精确parent、23路径和staged patch digest授权形成一个本地单亲candidate commit。该commit只冻结身份，
不表示接受、PASS或push授权。

Owner确认candidate SHA/tree后，才可另行授权一次仓库外wheelhouse provisioning。授权必须同时绑定candidate
SHA/tree、上述lock SHA-256、上述64项wheel选择集合digest和固定目标
`/var/tmp/chaotang-m0-wheelhouse`。该动作只能从批准的只读Python package origin下载lock唯一允许哈希的wheel，
禁止凭据、上传、发布和业务网络；完成后断网，M0只消费本地目录。wheelhouse不是仓库文件、第二lock、产品制品
或可提交内容，不能用手写manifest替代runner对每个wheel的重新计算。provision后若任何产品字节、candidate身份、
lock或集合digest变化，wheelhouse证据立即失效；该candidate判定STOP并重新治理，不得amend或复用旧证据。

## Preserved RC1 contract

- `/health` 只信 installed distribution metadata；不得恢复 `0.0.0` 或运行时读取 `pyproject.toml`。
- 原 RC1 的toolchain、loopback-only、离线bundle、backup/rehearsal、scanner和外部1+10轮合同全部保持。
- productPaths按字节沿用前一批准，恰23条，不增加第24路径。
- M0不使用Docker、不接registry/scanner、不访问业务/provider网络、不读取secret、不push、不deploy。
- P0合同分诊、readiness、六部、庄园和双编排继续暂停。

## Acceptance Criteria

- [ ] approval commit 是 `74a9e198…` 的精确单亲子，且只修改本 manifest 的三份治理文件。
- [ ] productPaths 与前一批准字节级相同、排序固定、恰23条。
- [ ] wheelhouse恰好一一覆盖lock的64个distribution，所有bytes/name/version/tags通过，缺/多/重复/篡改均拒绝。
- [ ] 本地candidate commit先冻结SHA/tree；provisioning授权精确绑定candidate SHA/tree、lock SHA、64项集合digest
  与固定目标，M0验证和push均发生在其后。
- [ ] 用户site、`.pth`、sdist、依赖解析、网络、非冻结解释器、PATH替换、worktree import全部被负例拒绝。
- [ ] network/PID namespace、直接出站拒绝和detached-child清理有自动化证明。
- [ ] 两个installed shard在相同最终候选字节上合计全绿且完整覆盖全量测试，每个低于300秒。
- [ ] focused、Ruff、deployment、release tools、authority、Harness/self-test与原RC1矩阵重新通过。
- [ ] Code、Python、Security、Release/Operations独立审查无High/Critical。
- [ ] 最终单亲候选上 `--verify-candidate` 返回 `PASS / canAcceptProductCandidate=true`；旧证据不得继承。

## Delivery Constraints

- Base：`74a9e198f2bf8104eaaf958052cb6cd6cebf6518`。
- Base tree：`ee0dcf48fc3d0e00dd9e3314413587170efc57d2`。
- Approval manifest RFC8785 digest：
  `sha256:85fe4f9edf909aedd7abf30d1aa6b40193b212567f823810c2eebdaa94d10dbc`。
- 本阶段只允许本 manifest 的三条 `approvalCommitPaths`。
- approval、产品candidate、wheelhouse provisioning、push、外部验证和部署分别需要精确Owner授权；candidate
  commit仅冻结身份，不等于接受。
- 不修改当前脏根目录；不清理、stash、reset、删除或覆盖任何既有工作树。

## Verification

治理阶段运行 schema/strict JSON、RFC8785 digest、根 Harness/self-test、product-authority regression、
`git diff --check`、精确三路径审计与独立治理/安全审查。产品阶段按 manifest 十条命令执行；其中 `tool: python3`
由 M0 consumer 固定执行 `/usr/bin/python3`。

## Affected Modules

- 模块：RC1 runtime-lock、可信离线wheelhouse、installed-wheel双shard验证与M0验证矩阵。
- 允许路径：严格等于approval manifest按字典序冻结的原RC1精确23条 `productPaths`；不得出现第24路径。
- 治理事实源：本task、配套plan与approval manifest。
- 未来产品实现：只在原23路径内重包RC1；本纠正新增语义只属于
  `backend/tests/test_runtime_lock.py`。
- 只读输入：前一RC1批准、旧产品来源工作树、`backend/pyproject.toml`、
  `backend/requirements-runtime.lock`、M0 consumer与approval schema。
- 外部输入：另行授权后才可建立的 `/var/tmp/chaotang-m0-wheelhouse`；它不进入Git。

## Technical Plan

按配套plan执行：先落地三文件approval；再从新远端建立干净产品席位，受控重包23路径，以TDD实现lock闭包、
安全复制、tag验证、冻结解释器和namespace；预提交验证/审查后由Owner授权本地candidate commit；再按该candidate
SHA/tree与冻结lock/集合digest申请wheelhouse provisioning；断网后运行双shard、完整RC1矩阵和最终独立复审。
任一范围或信任边界变化都返回治理阶段重新批准。

## Implementation Report

- 当前实现：未开始；既有产品工作树只作为失败证据和后续逐文件来源。
- 当前治理改动：精确三份staged草案。
- 下载/外部网络：未执行。
- Git/部署动作：未commit、未push、未merge、未部署。

## Acceptance Review

当前结论：`APPROVAL_PACKET_DRAFT / PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED / OWNER_CONFIRMATION_REQUIRED`。
schema、digest、Harness、authority regression和独立治理/安全审查全部通过前，不请求approval commit授权。

## Current handoff

当前只准备三份治理草案。不形成commit、不push、不下载wheel、不修改产品候选、不部署。
