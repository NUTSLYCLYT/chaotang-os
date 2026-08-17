# 任务：RC1 上线阻断整改 V1

> Task ID：`RC1-RELEASE-BLOCKER-REMEDIATION-V1-20260817`
>
> 本任务只把已通过本地合成验收的产品整理成可复现、可验真、可恢复的 RC1 发布候选；不改变朝堂业务行为，
> 不实施已暂停的 P0 合同分诊，也不触碰生产。

## Status

Draft

## Frozen Identity and Evidence

- Base commit：`c86317302c9fa07cb6f6b976d1631e3907aa7401`
- Base tree：`b4a3c7a3c5a708c60a79d48c6c0151a8a164d0ad`
- Target：`gitee.com/msxn/chaotang-os:ext-dev`
- RC0 的产品、合成数据与浏览器主链在固定候选上已通过；当前阻断不是业务功能，而是依赖、发布、恢复和入口
  合同不满足上线标准。
- 已知阻断：前端生产依赖存在 high advisory；后端容器携带已知脆弱 pip；后端运行依赖未冻结；容器健康版本
  与包元数据漂移；镜像缺 source revision/provenance；当前 Compose/Caddy 公网 80/443 与 ADR 0041 的
  `127.0.0.1:8080 + SSH tunnel` 冲突；缺离线发布包验真和 SQLite 备份/恢复演练工具。
- P0 `P0-CONTRACT-TRIAGE-V1-20260817` 产品实施自本任务开始保持暂停。其旧 approval 只作历史证据；RC1
  landing 后如要恢复，必须以新的远端 `ext-dev` 为 base 重新签发，不得复用旧 GO。

## Product Definition

运维者可在一台无公网业务入口的单机上，使用固定 source commit/tree、固定基础镜像和应用镜像 digest，构建并
验证一个离线 RC1 包；在不向生产主机加载镜像、不改生产、不写现有数据的前提下，能够证明：

1. 包内文件、镜像引用、SBOM/provenance 与 source identity 完整；
2. Caddy 只监听 `127.0.0.1:8080`，应用与数据库不直接暴露；
3. SQLite 与成果文件能备份到新目录、核验并在新空目录完成合成恢复演练；
4. 同一冻结候选仍通过现有 real FastAPI + real Next 合成 HTTP 主链，未改变一旨一回奏、owner 隔离与史馆
   语义。

## Product Subtraction

- Jobs：只交付一个可验真的 RC1 包和一个可恢复的数据快照流程，不新增控制台、发布平台或第二套流水线。
- 张小龙：上线准备不应创造新页面、按钮或概念；失败只给稳定 reason code 与可执行修复，不用“绿色大盘”掩盖
  未验证项。
- 本任务只有一个 builder、一个 verifier、一个 SQLite backup/rehearsal 工具、一个只用于本地验收编排的
  runner 和现有 deployment checker；不建立发布服务、备份服务、制品数据库或自动部署器。

## Contract and Fact Sources

### Approved toolchain policy

未来产品候选不得自行选择基础镜像、scanner、SBOM/provenance producer 或漏洞时效。唯一允许值冻结在本 approval
parent 的下列 closed JSON；`run_rc1_release_acceptance.mjs` 必须用受控 `/usr/bin/git --no-replace-objects show
HEAD^:docs/product/tasks/2026-08-17-rc1-release-blocker-remediation-v1.md` 读取并严格解析本块，并断言工作树副本字节
一致。`deploy/base-images.env` 只能投影这些 image refs，不能成为新的信任根。

```json
{
  "schemaVersion": "rc1-toolchain-policy.v1",
  "platform": "linux/amd64",
  "archiveLimits": {
    "maxBundleBytes": 34359738368,
    "maxCompressionRatio": 200,
    "maxEntries": 4096,
    "maxEntryBytes": 8589934592,
    "maxJsonBytes": 16777216,
    "maxJsonDepth": 32,
    "maxPathBytes": 512,
    "maxPathDepth": 16
  },
  "databaseRegistry": [
    {"artifactRoot": null, "maxUserVersion": 0, "name": "decree_jobs.sqlite3"},
    {"artifactRoot": null, "maxUserVersion": 5, "name": "jinyiwei.sqlite3"},
    {"artifactRoot": null, "maxUserVersion": 0, "name": "junjichu_cases.sqlite3"},
    {"artifactRoot": null, "maxUserVersion": 0, "name": "qintianjian.sqlite3"},
    {"artifactRoot": "report_artifacts", "maxUserVersion": 0, "name": "report_artifacts.sqlite3"},
    {"artifactRoot": null, "maxUserVersion": 5, "name": "shiguan.sqlite3"}
  ],
  "images": {
    "caddy": {
      "expectedVersion": "2.11.4",
      "reference": "docker.io/library/caddy@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a"
    },
    "grype": {
      "expectedVersion": "0.117.0",
      "reference": "docker.io/anchore/grype@sha256:ab8d929faec38875a45aba74c9651549cd096756d1981773c04375f282e91075"
    },
    "node": {
      "expectedVersion": "24.19.0",
      "reference": "docker.io/library/node@sha256:2a49bdf71e9fd965a58c1703fd9ddd205b34e5782b692a72dd1d248abb0beb43"
    },
    "python": {
      "expectedVersion": "3.12.14",
      "reference": "docker.io/library/python@sha256:356b0d18f9385f4bdcc673af60e1e64c9d1504952e4ec36ee32044c722a6bc4e"
    },
    "syft": {
      "expectedVersion": "1.51.0",
      "reference": "docker.io/anchore/syft@sha256:41f8289664101d6ebab30a97ac8df6b6f86b92d8343285ca90f428e2bc353106"
    }
  },
  "hostTools": {
    "buildkitVersion": "v0.31.1",
    "buildxGitCommit": "a319e5b15052cf6557ceb666eb8ff6e32380b782",
    "buildxVersion": "v0.35.0",
    "dockerClientGitCommit": "8900f1d",
    "dockerClientVersion": "29.6.1",
    "dockerExecutable": "/usr/bin/docker",
    "dockerServerGitCommit": "8ec5ab3",
    "dockerServerVersion": "29.6.1",
    "timeSyncExecutable": "/usr/bin/timedatectl"
  },
  "provenance": {
    "buildkitMode": "max",
    "predicateType": "https://slsa.dev/provenance/v1",
    "sbomFormat": "cyclonedx-json"
  },
  "validationEgress": {
    "anonymousRegistryPullTokensAllowed": true,
    "artifactPublishingAllowed": false,
    "allowedHttpsOrigins": [
      "https://auth.docker.io",
      "https://files.pythonhosted.org",
      "https://production.cloudflare.docker.com",
      "https://pypi.org",
      "https://registry-1.docker.io",
      "https://registry.npmjs.org",
      "https://toolbox-data.anchore.io"
    ],
    "auditRequests": [
      {
        "body": "PACKAGE_NAME_VERSION_PAIRS_FROM_EXACT_PACKAGE_LOCK_ONLY",
        "maxBodyBytes": 4194304,
        "method": "POST",
        "origin": "https://registry.npmjs.org",
        "path": "/-/npm/v1/security/advisories/bulk"
      }
    ],
    "businessDataUploadsAllowed": false,
    "denyAllEnforcedExternally": true,
    "denyProbeRequired": true,
    "dockerDaemonIncluded": true,
    "phase": "POST_M0_AUTHORIZE_PRE_M0_VERIFY_DISPOSABLE_VALIDATION_HOST_ONLY",
    "preexistingOrUserCredentialsAllowed": false,
    "remoteMutationAllowed": false,
    "rulesDigestRequired": true,
    "registryAuthMode": "ANONYMOUS_EPHEMERAL_BEARER_TOKEN_ONLY"
  },
  "vulnerabilityPolicy": {
    "allowedAdvisories": [],
    "databaseMaxAgeHours": 48,
    "databaseMaxFutureSkewSeconds": 300,
    "forbiddenSeverities": ["Critical", "High"],
    "ignoredMatches": 0,
    "timeSource": "HOST_CLOCK_REALTIME_UTC_AFTER_TIMEDATECTL_NTP_SYNC_YES"
  }
}
```

本 policy 以上述 JSON 通过项目 RFC 8785 canonicalizer 计算的固定 digest 为
`sha256:75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268`。Owner 必须在
approval commit 形成前同时确认 manifest digest 与本 policy digest；任一字节变化均重新计算、重审、重确认。

验收 runner 必须以 exact linux/amd64 manifest digest 运行 Syft/Grype；核对工具自报 version；将 Grype DB 的
`built`、schema/version、archive/content digest 写入 evidence。`built` 必须是严格 RFC 3339 UTC，且满足
`built <= observed_at + 300s` 与 `observed_at - built <= 48h`。`observed_at` 只能在
`/usr/bin/timedatectl show --property=NTPSynchronized --value` 精确返回 `yes` 后取 host UTC clock；命令缺失、时间
逆序/不可解析、DB 过期、任一 image/tool/version/digest 不匹配、报告有 ignored match 或 High/Critical 均 STOP。
产品候选不得新增 waiver 或替换 allowlist；任何工具升级需回到 approval Draft 重签。

### 1. Dependency and image identity

- `frontend/package-lock.json` 是前端生产依赖唯一锁；仅采用清除当前 high/critical 的最小兼容 patch，不升级
  主版本，不改变页面或 API。
- `backend/requirements-runtime.lock` 是本候选经人工复核后冻结的安装闭包，必须同时覆盖当前
  `pyproject.toml` 的 `[project].dependencies` 与 `[build-system].requires`，并固定全部直接/传递版本与 SHA-256
  hashes；本任务不宣称从宽范围输入可复现生成同一 lock。独立验证阶段必须在空环境先以 `--require-hashes`
  安装精确 build requirements，再以 `pip wheel --no-build-isolation --no-deps` 构建本地包；runtime 只安装应用与
  运行依赖，不得携带 build tools，也不得在线解析浮动范围。
- `deploy/base-images.env` 只含上述批准策略按 digest 固定的 Node、Python、Caddy、Syft 与 Grype 镜像；runner
  必须逐字段等值比较 approval-parent policy，不能信任该候选文件自报。Dockerfile 禁止 tag-only `FROM`。
- 前后端最终镜像必须有 OCI source revision/source tree/created 元数据，并以最终 digest 进入 release manifest。
- 后端 runtime 不得保留 pip/setuptools/wheel 安装工具；扫描器缺失或扫描不可达时结论为 UNVERIFIED，而非 PASS。
- `/health.version` 必须来自已安装包元数据并等于构建包版本；不得因容器未复制 `pyproject.toml` 回落为
  `0.0.0`。

### 2. Loopback-only deployment

- 现行且唯一部署合同服从已接受 ADR 0041：Caddy 只发布 `127.0.0.1:8080:8080`，显式关闭自动 HTTPS；
  不绑定域名，不发布 80/443，不直接发布 frontend/backend 端口。
- `scripts/check_deployment.mjs` 必须把上述合同作为硬门，并拒绝域名、TLS、公网 host-port、floating image、
  privileged、root、可写 rootfs、缺 healthcheck、额外数据库或多副本 worker。
- 不修改 systemd、生产 env 或秘密格式；现有 `/opt/chaotang-os/current` 运维入口保持。

### 3. Offline release bundle

- `build_offline_release.mjs` 只接受 clean exact `HEAD` candidate、空输出目录和显式工具/输入；不得读生产目录、
  用户 secrets 或隐式环境变量，不得执行 push/load/deploy。
- bundle 至少包含：closed-schema canonical manifest、manifest digest、digest-pinned `images.env`、Compose/Caddy、
  前后端/Caddy OCI archives、每镜像 SBOM、provenance/source identity 和核验说明。缺任一项失败关闭。
- `verify_offline_release.mjs` 只读验真；拒绝 duplicate JSON keys、未知字段、绝对/穿越/重复/大小写冲突路径、
  symlink/hardlink、缺失或多余文件、digest/size/source/tree/image/SBOM/provenance 不一致及 floating reference。
  读取必须遵守 approval policy 的固定上限：最多 4096 entries、总包 32 GiB、单 entry 8 GiB、压缩比 200、
  JSON 16 MiB/深度 32、路径 512 bytes/16 层；任一上限在分配或展开前失败关闭。它不得调用 `docker load`，
  不得写生产或覆盖目标。
- 同一 source、lock、base image 和 `SOURCE_DATE_EPOCH` 的 canonical manifest bytes/digest 必须一致；OCI archive
  平台字节若受引擎影响，manifest 必须明确记录引擎/平台并按实际 digest 验证，不虚称跨引擎 byte-identical。
- `run_rc1_release_acceptance.mjs` 是 exact candidate 冻结且 Owner 按 SHA/tree 另行授权后，在 disposable
  validation host 上运行的唯一真实验收编排入口。它必须要求显式 non-default Docker endpoint，拒绝
  `/var/run/docker.sock`、default context、缺少隔离
  生命周期或任何生产挂载；在新临时根中实际构建前后端镜像与 bundle，调用 verifier、固定 digest 的
  SBOM/vulnerability scanner、非 root/read-only/cap-drop/health smoke 和合成 SQLite
  backup→verify→rehearse。每轮输出 closed canonical JSON，并断言容器、端口、进程和临时根回收；不得只读取
  预制 PASS 日志或让应用自身声明 scanner 结果。M0 只运行该 runner 的 mocked/no-daemon/no-network 单元测试，
  不执行真实 runner。真实验证、连续 10 轮与独立审查全部完成后，才运行最终 M0 `--verify-candidate`；其
  `canAcceptProductCandidate=true` 只在这些外部证据已经满足时出现。

### 4. SQLite backup and rehearsal

- `app.operations.sqlite_backup` 只接受显式 source root 和全新空 destination；使用 SQLite backup API 生成一致
  快照，并复制由数据库引用的成果文件。不得直接复制活动中的 WAL/SHM 充当一致备份。
- approval policy 的 `databaseRegistry` 是完整事实源：恰好包含 `decree_jobs.sqlite3`、`jinyiwei.sqlite3`、
  `junjichu_cases.sqlite3`、`qintianjian.sqlite3`、`report_artifacts.sqlite3`、`shiguan.sqlite3` 以及唯一成果目录
  `report_artifacts/`；版本上限分别为 0/5/0/0/0/5。候选不得静默省略、增加或重命名数据库。backup manifest
  冻结数据库 logical name、relative path、size、SHA-256、`PRAGMA user_version`、`integrity_check`、artifact
  relative path/hash 和 source snapshot identity；closed schema，排序固定。
- 拒绝路径逃逸、symlink/hardlink、FIFO/device、目标已存在、未知数据库、未来 schema、digest 篡改、缺/多文件。
- `verify` 全程只读；`rehearse` 只能恢复到新的空目录并重新跑完整 integrity/hash/引用检查，不能覆盖源或提供
  原地生产 restore。
- 停写后的 production cold backup 和真实 restore 仍是另行授权的运维动作；本任务只用脱敏合成数据演练。

## Acceptance Criteria

- [ ] 产品实现完成后先冻结 exact single-child candidate SHA/tree；Owner 仅按该身份另行授权 disposable validation
  host 和 policy 中精确列出的 build-time egress，不因此接受候选或授权 push/deploy；在
  clean checkout 执行 `npm ci` 后，前端 production audit 为 0 high/critical，且 lint/typecheck/test/build 全绿。
- [ ] `test_runtime_lock.py` 证明后端 hashed lock 覆盖 `pyproject.toml` 全部 project/build-system direct
  requirements、每个安装 entry 带 hash，并证明 Dockerfile 只按 hashes 安装 build closure 后使用
  `pip wheel --no-build-isolation --no-deps`；独立阶段在空环境完成 exact lock 安装。runtime 无
  pip/setuptools/wheel/build tools，`/health.version` 等于包版本；应用依赖、基础镜像及最终镜像无未豁免
  high/critical。缺 scanner 或未授权网络即 STOP。
- [ ] Compose/Caddy 只监听 loopback 8080；80/443、域名、自动 TLS、应用直出端口和 floating image 负例全部
  被 checker 拒绝。
- [ ] release builder 对冻结候选产生闭合 bundle；独立 verifier 正例通过，篡改、丢失、多余、路径攻击、错误
  source/tree/image/SBOM/provenance 负例全部失败关闭；builder/verifier 不加载、不推送、不部署。
- [ ] 备份工具在合成多数据库/WAL/成果文件 fixture 上完成 backup→verify→new-empty-root rehearse；跨目录、
  symlink/hardlink、并发写一致性、篡改、未知/未来 schema、覆盖目标负例失败关闭。
- [ ] `run_rc1_release_acceptance.test.mjs` 在 M0 只使用 mock/no-daemon/no-network fixture，证明默认宿主 socket、
  default context、缺少隔离生命周期、网络调用和生产路径均失败关闭；真实 runner 不属于 M0 命令矩阵。
- [ ] 在单独授权的 disposable validation host 上，真实 runner 使用显式 non-default Docker endpoint 完成 1 轮临时
  bundle、镜像扫描、容器 smoke 与合成 backup/rehearse；缺工具、证据、清理、隔离或真实执行任一项均非零退出。
- [ ] disposable validation host 使用候选进程之外的受信防火墙/egress proxy 默认拒绝全部出站，仅允许 policy
  冻结的 HTTPS origins；同一限制覆盖 Docker daemon。证据记录规则 digest、启用时间、允许 origin 探针与至少一个
  非允许 origin 的拒绝探针；候选侧 path 检查只作第二层校验，不能替代宿主网络边界。网络请求只能是无用户凭据
  的依赖/镜像读取、匿名短期 registry bearer token，以及 policy 精确冻结的 npm audit POST；该 POST body 只能由
  exact package lock 的 package name/version pairs 生成且不超过 4 MiB。禁止制品发布、远端写入、业务数据上传和
  既有/用户凭据。
- [ ] 原有 Harness、后端全量、clean-install 前端全量、HTTP integration 与既有
  `backend/tests/run_accounting_synthetic_acceptance.py --rounds 1` 全绿；后者启动真实 FastAPI 与 Next、经同源
  BFF 完成合成户部下旨、XLSX 下载/哈希、唯一史馆 REPLY 与跨 owner 404，但不把 fake-wired provider 当真实
  业务 outcome。
- [ ] 冻结同一候选、locks、base images、工具版本和合成 fixture 后完成连续 10 轮发布验收矩阵；任一失败、超时、
  外网业务调用、残留容器/端口/临时目录或候选字节变化均从 1/10 重算。10 轮必须由同一 tracked runner
  `--rounds 10 --evidence-dir <new-empty-dir>` 逐轮生成机器可复算的 JSON 与总 digest；人工文字不计轮次。
- [ ] 独立 Code、Python、Security、Release/Operations review 无 Critical/Important；未验证项不得标成 PASS。
- [ ] 上述外部验证、1+10 轮与独立审查全部通过后，最后运行 manifest 冻结的 8 条 M0 产品验证命令：它们不得
  使用 Docker、依赖 registry/scanner 网络或业务/provider 网络；M0 authority 仅为远端防漂移执行受信只读
  `git ls-remote gitee ext-dev`。后端 focused/full/Ruff、deployment checker/tests、product-authority regression、
  mocked release-tool tests 与 root Harness 全绿，且机器输出 `canAcceptProductCandidate=true`。这才允许把 exact
  candidate 与完整外部证据呈 Owner 接受；仍不自动授权 push 或 deploy。

## Delivery Constraints

### Exact Scope

产品候选路径必须严格等于 manifest `request.productPaths` 的 23 条；不是子集，也不得出现第 24 条。任何新增
文件、修改既有 ADR/AGENTS/Harness/CI、扩大部署拓扑或需要 schema migration 时立即 STOP 并重新批准。

## Non-goals and Safety Boundary

不改业务行为、ADR 0028、Direct/LangGraph 编排、数据库 schema、业务 provider/runtime network policy、页面、
浏览器自动化框架、生产数据、真实密钥、线上服务、域名/TLS、公网入口或 CI/Harness。M0 的 8 条产品验证命令
不使用 Docker 或非受信网络；仅 M0 authority 可为远端防漂移执行受信只读 `git ls-remote gitee ext-dev`。候选
外部验证的 build-time egress 仅限 approval policy 的 HTTPS origins 与冻结的 request contract；允许无用户凭据的
读取、匿名短期 registry bearer token，以及只包含 exact lock 中 package name/version pairs 的受限 npm audit
POST。禁止制品发布、远端写入、业务数据上传、既有/用户凭据和业务/provider 请求，并须由候选之外的宿主
防火墙/egress proxy 对进程与 Docker daemon 共同执行 deny-all，且需 Owner 单独授权。不自动
push/load/deploy/restore，不建立第二发布或备份系统，不实施 P0 合同分诊。

## Affected Modules

- 模块：依赖与容器身份、单机部署、离线发布交付、SQLite 合成备份/核验/恢复演练。
- 允许路径：严格等于 approval manifest `request.productPaths` 的 23 条；产品实现阶段不得修改产品任务文件，
  不得调用其他角色扩大写入范围。
- 依赖与容器：前后端 Dockerfile、前端 lockfile、后端 hashed runtime lock、基础镜像 digest 清单。
- 单机部署：现有 Compose/Caddy 与 deployment checker；不增加拓扑或第二入口。
- 发布交付：一个本地离线 bundle builder、一个只读 verifier 和 closed release manifest。
- 数据恢复：一个 SQLite backup/verify/rehearse 模块及其合成测试；不新增数据库或 writer。
- 明确不受影响：业务 API、页面、史馆/锦衣卫、Direct/LangGraph、ADR、Harness、CI、生产环境和真实数据。

## Proof Commands

先由 Owner 对 exact candidate SHA/tree 单独授权 disposable validation host/egress。冻结 RC1 必须记录但不写入
仓库：宿主 egress 规则 digest/allow+deny probes、npm audit 请求体摘要/字节数、匿名 registry auth mode、
Docker/BuildKit、Node/npm/Python 与 scanner 版本，
base/final image digest，SBOM/provenance digest，bundle digest，合成 backup digest，合成 HTTP 主链摘要，以及 runner
1+10 轮每轮 exit/count/清理状态与总 digest。上述证据与独立审查通过后，最后运行 approval manifest 的 8 条
无 Docker、无依赖 registry/scanner/业务网络产品命令；M0 authority 的受信只读 `git ls-remote gitee ext-dev`
只用于前后防漂移。最终 M0 `canAcceptProductCandidate=true` 才允许呈 Owner 接受，但不等于已接受、已授权 push
或生产可部署。

## Technical Plan

按照“依赖与镜像身份 → loopback 部署 → SQLite 合成恢复 → 离线包验真 → 全量/合成 HTTP/10轮 → 独立审查”
的单写者顺序实施。完整 RED/GREEN、失败条件、回滚与计划变更协议见
`docs/superpowers/plans/2026-08-17-rc1-release-blocker-remediation-v1.md`。

## Implementation Report

- 当前交付：三份未提交 RC1 approval packet 草案。
- 当前产品实现：未开始；23 条产品路径均未修改。
- 当前外部动作：未 commit、未 push、未 merge、未部署、未迁移、未注入密钥。
- P0 产品实施：已暂停；不会与本 RC1 候选并行写。

## Acceptance Review

当前结论：`APPROVAL_PACKET_DRAFT / RC1_REMEDIATION_NOT_STARTED / PRODUCTION_UNTOUCHED`。

Owner 后续需同时确认 manifest canonical digest
`sha256:3024888e48e42bf2993bffe28416542575d8f683b3ac2dd8d54ac9695578a55a` 与 toolchain-policy digest
`sha256:75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268`，
才可授权形成三文件单亲 approval commit；该 commit 的 SHA/tree 还需第二次确认后才可普通快进推送。推送后仅当
远端精确等于 approval commit 且 M0 `--authorize` 返回 GO，才可开始 23 路径产品候选；候选完成后须按本文顺序先做
外部验证和独立审查，最后才运行 M0 `--verify-candidate`。当前“批准准备”不是实现、提交、推送或部署权。
