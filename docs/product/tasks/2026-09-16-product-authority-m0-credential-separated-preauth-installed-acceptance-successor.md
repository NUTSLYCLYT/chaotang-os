# Product Authority M0 Credential-Separated Preauthorization Installed Acceptance Successor

Task ID: `PRODUCT-AUTHORITY-M0-CREDENTIAL-SEPARATED-PREAUTH-INSTALLED-ACCEPTANCE-SUCCESSOR-20260916`

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

`origin/ext-dev@4b5115f233c84dbb69f4864b278b96fdf05a3027` 已落地 credential-separated
preauthorization exact9，但仓库实现不等于主机安装验收。当前主机仍安装旧
`0b323e26584069019662aa723d30fd763424954c` 字节，installation manifest digest 为
`sha256:fc247ebffa3c766ac2f2bee986e46dbfb1c5465b9618164c12f037a8dc1740c5`，缺少
`node-preauthorization-v1` gate profile；socket 为 `inactive / disabled`。因此新 v2 approval 必须继续
fail-closed，不能复用旧安装、旧 installed-acceptance 结论或旧 exact4 身份。

本 successor 只冻结安装验收测试和管理员执行合同。未来仓库候选仅为两份现有测试文件：它们增加真实
root-owned broker preauthorization、实际 `product-authority.m0.v1 --authorize`、专用 controller 身份、
per-connection systemd/cgroup 收口及回滚负向验收。exact9 的 authority、broker、socket 和 service unit
均为不可变安装输入，不在本 successor 中修改。管理员安装、服务启动和真实验收必须在 exact2 候选落地、
profile/orchestrator/installation manifest 身份另行冻结且 Owner 明确批准后执行。

用户价值是把“源码测试已通过”和“真实主机可安全运行”分开证明：只有真实 dedicated controller 请求能够
经 broker 完成 sealed-FD/root-FD、18-case、nonce/TTL、receipt 和 service cleanup 全链，并且验收结束后所有
unit 停止且 disabled，后续 Mingshuo exact10 才能安全使用新 preauthorization gate。

## Acceptance Criteria

- [ ] Approval commit 只包含本 Task、Packet、Plan 三条新增治理路径，全部 `100644`。
- [ ] Future candidate 精确修改 `scripts/product-authority.test.mjs` 与
  `scripts/reference/test_chaotang_product_verifier_broker.py`，不得出现第三条路径。
- [ ] `scripts/product-authority.mjs`、broker、socket unit、service unit及 exact9 其余路径逐 blob 保持
  `4b5115f2…` 主线身份，不得在本 successor 中修补产品代码。
- [ ] Node 测试新增显式 installed-preauthorization acceptance 入口，使用临时本地 bare remote和合成 v2
  approval，必须运行真实 `product-authority.m0.v1 --authorize`，不得调用内部 GO builder冒充闭环。
- [ ] Python installed acceptance 新增 preauthorization request/receipt、controller/verifier真实执行、FD3/FD4/FD6、
  FD5不可见、host repo/credential FD不可见及 18-case 完整顺序证明。
- [ ] Exact2 落地后必须冻结其 candidate commit/tree，以及两份 candidate test 的 Git blob、`100644` mode、
  bytes 与 raw SHA-256；未知、占位或来自未提交工作树的身份不得进入验收。
- [ ] Installation manifest v1 必须包含唯一 `INSTALLED_ACCEPTANCE_TEST` 记录，并用既有closed字段精确绑定
  Git blob、mode、bytes与raw SHA；它不编码exact2 commit/tree。独立冻结的预安装证据必须证明
  `exact2 commit/tree:path → 同一blob`，每次验收前同时复核该映射、manifest记录与打开文件；旧exact9/旧安装
  测试字节必须拒绝。
- [ ] `scripts/product-authority.test.mjs` 不安装到系统路径，只能从与 frozen exact2 commit/tree 精确一致的只读
  Git 物化目录执行；运行前逐项复核其 blob/mode/bytes/raw SHA，目录漂移或脏状态必须拒绝。
- [ ] 普通UID、错误 primary UID/GID、仅 supplementary group、stale manifest、错 profile、错 unit、错
  InvocationID/cgroup、旧receipt跨nonce/request复用、TTL过期、跨approval/remote/source复用全部 fail-closed。
- [ ] controller/verifier 的 setsid、double-fork、关闭FD3保留FD6、leader提前退出、fork storm，以及 caller
  SIGKILL、socket close、read stall、outer timeout和reply write failure均不得留下存活后代或FD6 holder。
- [ ] 每条accepted connection绑定唯一service unit、InvocationID、cgroup path/inode；authority只在同一service
  inactive且同一cgroup empty后才允许GO。
- [ ] 安装前冻结 `node-preauthorization-v1`、privileged runtime profile、installation manifest、root orchestrator
  的完整bytes/digest/provenance，并冻结 exact2 `INSTALLED_ACCEPTANCE_TEST` 记录；占位符、旧profile或旧测试
  identity不得进入安装。
- [ ] 非生产 installed acceptance 结束后，socket、所有template instance和acceptance unit必须
  `inactive / disabled`，runtime目录、cgroup和FD6 holder均为空；失败也必须执行同一回滚。
- [ ] 完整静态矩阵及 Governance、Architecture、Code、Security Review 必须全部
  `GO / P0=0 / P1=0 / P2=0`；真实安装验收必须另行授权，不能由草案或静态测试冒充。

## Delivery Constraints

- 本轮只创建三份治理草案；不运行 product authority，不修改产品或测试，不提交、不推送、不安装、不启动服务。
- Future exact2 只补验收测试，不降低 exact9 authority/broker/unit 合同；发现真实修复需要产品第三路径或unit变化时
  立即 STOP，另立最窄 corrective successor。
- 安装来源必须分层闭合：authority、broker、socket与service unit只来自 landed exact9
  `4b5115f2…` 的不可变 Git blobs；`INSTALLED_ACCEPTANCE_TEST` 只来自未来 landed exact2 candidate 的不可变
  Git blob。不得从脏工作树、历史 donor、旧 exact9 测试或已安装旧文件取字节。
- 保持 `product-authority.m0.v1` 为唯一 GO/STOP 决策者；broker、测试、orchestrator、Harness和systemd均不得产生授权。
- 不读取、复制或输出凭据；不访问客户数据；不执行真实渠道、交易、付费或生产动作。
- 不修改系统/用户持久配置，不 force-push，不删除旧安装备份；后续管理员动作必须可回滚并在验收后停止所有unit。

## Affected Modules

- 模块：Product Authority M0 credential-separated preauthorization 的非生产 installed acceptance 与回滚证明。
- 允许路径：`scripts/product-authority.test.mjs`；`scripts/reference/test_chaotang_product_verifier_broker.py`。
- 不可变安装输入：`scripts/product-authority.mjs`、`scripts/reference/chaotang-product-verifier-broker.py`、
  `deploy/systemd/chaotang-product-verifier.socket`、`deploy/systemd/chaotang-product-verifier@.service`。
- 系统目标（仅后续管理员授权）：`/etc/chaotang-product-verifier`、`/opt/chaotang-product-verifier`、
  `/var/lib/chaotang-product-verifier`、`/etc/systemd/system/chaotang-product-verifier*` 与对应 `/run` runtime。

## Technical Plan

1. Exact2先形成真实RED：当前五项installed acceptance不覆盖preauthorization，当前主机旧manifest/profile必须拒绝。
2. 在两份测试内增加shell-free、closed、合成数据验收入口；Node真实CLI使用临时bare remote的`insteadOf`仅限测试进程，
   不修改用户或仓库持久配置；Python通过真实socket验证broker、身份、namespace、cgroup和后代清理。
3. GREEN后运行focused、完整exact9回归、Harness/doctor/hook/V2、`git diff --check`及四项独立审查，只冻结候选证据。
4. 另行确认candidate commit/普通快进。候选落地后先冻结 exact2 commit/tree 以及 installed acceptance test 的
   blob/mode/bytes/raw SHA及`tree:path → blob`映射；管理员再在隔离预映像目录从该 blob 物化测试，并生成、
   独立复算两个runtime profile、含唯一 `INSTALLED_ACCEPTANCE_TEST` 文件身份记录的 installation manifest 和root
   orchestrator；manifest v1不承载exact2 commit/tree，Owner/Admin须分别确认外部冻结映射与manifest身份后
   才允许备份旧安装并进行非生产安装。
5. 真实验收必须同时覆盖legacy candidate-verification与新preauthorization，并记录closed inner/outer receipt、唯一
   per-connection service identity、pre/post unit状态、cgroup/FD清理，以及旧receipt不可跨nonce/request复用和TTL过期拒绝。
   本 successor 不引入nonce消费目录、lease或持久replay ledger，也不宣称同一请求具有服务端一次性消费语义。
6. 无论PASS/FAIL都停止、disable并reset-failed相关unit；复核无进程、socket、runtime或cgroup残留。失败则恢复备份，
   保留证据并以forward-only successor纠正，禁止改写历史。

## Implementation Report

只读基线确认：实时远端和治理工作区均为
`4b5115f233c84dbb69f4864b278b96fdf05a3027 / 31ecdb147d3367634399f91635700debef4b13c6`。
exact9 bundle为`sha256:c49e96ab242c8eeb399671cf855aa70ca77252839e076e9b703a4e2595f299df`，
candidate evidence为`sha256:e201a72f8fa33d82254dc090de1c289fb8c6e0efc7eba75bbca16b8e350256fa`。

当前宿主socket为inactive/disabled。仓库socket raw为
`sha256:d6e51d369089612ce30cfdb099cac797ad3bd2457f4c264e4e6c4e6c50cfd060`，已安装socket相同；
但仓库service raw为`sha256:4533218ea486ce563c589a83897924e3d0ebb3b5e3a5d2eb07bba21a629c97b6`，
已安装service仍为`sha256:cbcf2e4a2d5bc383f0be24130fa236f37e9f50d964d469442c08472b68ce3120`；
仓库broker/test分别为`sha256:4e6d7d9b4ab4935cb2482ddcf7671c9f83ece297bb59994b451141d3661da10a`与
`sha256:95daaef0107cb36da72510802285f10098b4fe103b601983d1c7dd33defe7e6b`，已安装仍为旧
`sha256:aaade3e10195732b90f0b6dd359e7f907b1aeb9cfb1dad73190ba590c0216b0c`与
`sha256:26ba77251c3f66c49b22624aeebe394111f22473462b670f80880c7ba84e6185`。

因此当前结论只能是`STALE_INSTALL / FAIL_CLOSED / NO_INSTALLED_ACCEPTANCE`。本轮未修改测试或系统，未运行
authority，未安装、启动、提交或推送。

## Acceptance Review

本治理草案只证明下一步边界完整：exact2测试闭包、exact2测试可执行物身份、不可变exact9运行时安装输入、
profile/manifest/orchestrator冻结点、
管理员权限点、真实验收矩阵和失败回滚。它不批准 exact2、安装或服务启动，也不声称当前主机可执行v2 approval。

远端漂移、第三候选路径、产品或unit修改需求、旧v1回归、exact2测试commit/tree/blob身份或
profile/manifest/orchestrator身份未冻结、使用旧测试或旧安装、
非专用controller、任何凭据暴露、残留进程/cgroup/FD6、关键验证失败或独立审查P0–P2均立即STOP。
