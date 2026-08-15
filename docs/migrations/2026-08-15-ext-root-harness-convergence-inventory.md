# ext 根 Harness 来源、差异与排除清单

> Snapshot date：2026-08-15 Asia/Shanghai
>
> 状态：READ-ONLY EVIDENCE / NO MIGRATION AUTHORITY
>
> 本文只使用 clean Git objects 和远端 ref 身份。没有从任何相邻 working tree 复制内容。

## 1. 调查问题

1. 用户给出的“三层统一架构”在什么不可变 Git object 中存在？
2. ext 当前基线实际拥有什么、缺什么？
3. 参考根 Harness 中哪些只是治理方法，哪些是旧状态、运行态、信任材料或第二 authority？
4. 如何在不制造伪事实的前提下分阶段建立 ext-native 根协调层？

## 2. 基线

| 字段 | 值 |
| --- | --- |
| repository | gitee.com/msxn/chaotang-os |
| base commit | 2ef0bb4689517b7a05578f18091e841ec37eca2a |
| base tree | 6b1f5335382721d85093095fc1834fef7b000ed0 |
| parent | 017d3d34d0a56257fbbcdbd86cd6f1f6d9d0bcdd |
| branch | codex/ext-root-harness-convergence-20260815 |
| source working tree | 当前独立 clean worktree |
| product authority | false |

## 3. 来源矩阵

| 来源 | SHA | 远端可达 | 根 .harness | 判定 |
| --- | --- | --- | ---: | --- |
| origin/docs/r0-trusted-kernel-amendment-20260720 | 8bb68fb4c58b889551699a06e9468e87db66361d | 是，ls-remote 同 SHA | 789 | 唯一冻结的 REFERENCE_ONLY 来源 |
| 本地同名分支 | b20e2c78b6fa83e49193b810b76c9ca33ff00948 | 否，ahead 7 | 803 | 不采信；仅 Git-object 对照 |
| origin/dev | 2d29614137391c699615c0d84370db42ae217813 | 是 | 0 | 不可作为根 Harness 来源 |
| origin/ext-dev | 017d3d34d0a56257fbbcdbd86cd6f1f6d9d0bcdd | 是 | 0 | 当前产品父基线，无根 Harness |
| 当前治理候选 | 2ef0bb4689517b7a05578f18091e841ec37eca2a | 是 | 0 | 本任务 base，不是迁移来源 |
| origin/master | efaee77627e6e836a63ed0b4016d0e537fca326a | 是 | 15 | 旧骨架，无当前 authority |
| origin/harness-dev | 4e9186b434982c396a8390ef30c9fa0e356f2005 | 是 | 68 | 含未批准 scoped authority，不采信 |
| origin/governance/harness-selective-adoption-20260722 | f4b1d83a8189a928a71487581ba5185982c0cb3b | 是 | 774 | 历史参考，被 8bb 后续覆盖 |
| origin/main | 不存在 | 否 | — | 不存在 |

REFERENCE_ONLY 的精确定义：

- 可以读取 exact Git object；
- 可以引用其方法、blob/tree digest 和反例；
- 不可以继承批准、状态、authority、运行证据或平台强制；
- 不可以整体 merge/cherry-pick/copy；
- 任何目标文件都必须按 ext 当前事实重写并独立批准。

## 4. 来源身份

### 8bb remote tuple

| 对象 | ID |
| --- | --- |
| commit | 8bb68fb4c58b889551699a06e9468e87db66361d |
| parent | 1becdcefd6d91260af03b24ace34be3d9a328bd4 |
| commit tree | d71b15e402abdf347f48e006fb8257d5738e7b34 |
| .harness tree | db8541f13840ea4b397317f0f5982888bcb5e095 |
| common merge base with ext | 7d46de3107e8b055ad77af1389461aba3b172745 |

8bb 不是 ext 的祖先，ext 也不是 8bb 的祖先。共同祖先只证明历史关联，不证明任一后续批准能跨分支继承。

### 核心 blob 清单

| Path | Blob/tree | 使用方式 |
| --- | --- | --- |
| AGENTS.md | 21708a9ba83dd29aba6468e27a0dc62b994bce97 | 用户入口文本的来源证明；未来重写合并当前 ext 规则 |
| CLAUDE.md | 3cd8f959355dbdc42eecc9299076925253cd1e2e | 只作极简入口方法参考 |
| .harness/agents/project-owner.md | 8f390fad8281b8db991519455c4a31068e72c022 | REWRITE |
| .harness/rules/project-boundaries.md | 310e7e4367960a3e913c91cb1d2d5086ca3b7130 | REWRITE |
| .harness/rules/project-workflow.md | e43e20b5c299634af70ea988173b58de26d15b8c | REWRITE |
| .harness/wiki/architecture.md | 0ba33df56b06b9a24937dfd028ad733cc4b09c2a | REWRITE |
| .harness/wiki/harness-inventory.md | 3d43a2b5c159c83f5abe48ff0658844fe27571e5 | REWRITE |
| .harness/wiki/verification-matrix.md | ddc0339e6d1d66a885c4fcca58f782ce1334a752 | REWRITE |
| .harness/manifest/project-harness.json | 923093d787a014173f7d10f7551aed50cc59a3c6 | EXCLUDE；硬编码旧事实 |
| .harness/templates/change-template | tree 889f14b3119440f086c17367f3dcb3b8f20bceae | COPY_CANDIDATE，仍需逐文件批准 |
| scripts/new-change.mjs | f24a49249673d4e17d1cac367074498c415a2a66 | 算法参考；目标实现需测试和精确批准 |
| scripts/harness-doctor.mjs | da1f56738affeac0a0ef71bfb8315bb15e23e2bf | EXCLUDE；40+ legacy 依赖 |

本地 b20 的核心 .harness subtree 与 8bb 相同；803−789 的 14 个新增路径全部位于历史 changes。
b20 的 7 个未推送提交还混入 backend、安全和 CLAUDE 变更，因此不能整体采用。

## 5. 当前 ext 事实

### 已存在

- AGENTS.md、CLAUDE.md、ARCHITECTURE.md。
- frontend/AGENTS.md 与 Next.js/npm 工程、same-origin BFF 和测试。
- backend/AGENTS.md 与 FastAPI、RuntimeSkill、史馆、锦衣卫、军机处、会计成果链。
- backend/harness/capability_candidates，共 62 个 tracked paths。
- scripts/check_harness.mjs，当前验证 133 个基线文件。
- .agents/hooks/check-harness.mjs 与 product-flow self-tests。
- execution-authority.ext.v1 的 consumer、三个 schema、vectors、tests、task、plan。

### 当前缺失

| Path/capability | 状态 |
| --- | --- |
| .harness/ | ABSENT |
| scripts/new-change.mjs | ABSENT |
| scripts/harness-doctor.mjs | ABSENT |
| frontend/.harness/ | ABSENT |
| frontend/scripts/harness-doctor.mjs | ABSENT |
| backend/harness/manifest.json | ABSENT |
| backend/scripts/harness_doctor.py | ABSENT |
| 根 change record 落点 | ABSENT |
| Gitee required-check proof | UNVERIFIED |
| product authority | ABSENT |

缺失必须写成 ABSENT/PARTIAL，不能为了符合参考文档而创建虚假的 READY 状态。

## 6. 参考来源目录构成

8bb 的 .harness 共 789 个 tracked paths：

| 子树 | 数量 | 默认判定 |
| --- | ---: | --- |
| changes | 749 | EXCLUDE |
| contracts | 11 | EXCLUDE；逐个重新论证 |
| wiki | 9 | REWRITE/EXCLUDE |
| manifest | 5 | EXCLUDE |
| templates | 4 | COPY_CANDIDATE |
| rules | 3 | REWRITE |
| trust | 2 | EXCLUDE |
| policy | 2 | EXCLUDE |
| agents | 1 | REWRITE |
| baselines | 1 | EXCLUDE |
| runtime | 1 | EXCLUDE |
| rollout-history.jsonl | 1 | EXCLUDE |

## 7. 可吸收的方法

### REWRITE：只吸收原则

| 方法 | 价值 | 必须删除/改写 |
| --- | --- | --- |
| 三层所有权 | 根协调、前端体验、后端运行互不冒充 | 删除 courto-brain、旧页面、旧 runtime 事实 |
| 证据驱动工作流 | 调查→计划→批准→实施→验证→复核 | authority 改为 ext 当前事实；不写 M0–M10 |
| 根 change record | 跨线事实源、验证、风险可追踪 | 不带旧 change 历史和旧批准 |
| manifest + doctor | 机器验证入口/边界/命令存在性 | manifest 必须 closed，支持 ABSENT/PARTIAL |
| change template | 明确授权、scope、证据、回滚 | 模板不授予 GO；使用 ext task identity |
| new-change generator | 可重复创建固定骨架 | 增加 path/symlink/duplicate/slug 负测 |

### COPY_CANDIDATE

只有四个通用 Markdown template 可能逐文件原样采用。即使字节相同，也必须在未来任务中列出 source
blob、target path 与 expected digest；本清单不授予复制权。

## 8. 必须排除的内容

### 旧 change 与历史证据

- .harness/changes/** 全部 749 路径。
- 其中包含旧 approval、review、CI、browser artifact、log、release 和控制面证据。
- 历史 evidence 绑定另一 commit、分支、task、环境和审批人，复制会漂白为当前事实。

### 旧 execution authority

永不由本收敛计划迁入：

- .harness/manifest/execution-authority.v1.json
- .harness/manifest/execution-authority.v2.json
- .harness/contracts/execution-authority.schema.json
- .harness/contracts/execution-authority-v2.schema.json
- .harness/wiki/execution-authority.md
- .harness/wiki/execution-authority-v2.md
- scripts/execution-authority.mjs
- scripts/execution-authority-v2.mjs
- scripts/lib/execution-authority.mjs
- scripts/lib/execution-authority-v2.mjs
- R0 amendment checker、ledger、owner/review evidence 和 effective base

原因：

- root v1 永久 STOP，绑定 M0–M10；
- root v2 绑定旧 R0 work-package ledger；
- ext consumer 只验收特定治理候选且固定 product=false；
- 三者不能互相继承、改名、映射或合并。

### trust/runtime/rollout/release control-plane

全部 EXCLUDE：

- .harness/trust/**
- .harness/runtime/**
- .harness/policy/control-plane-rollout.json
- .harness/rollout-history.jsonl
- .harness/baselines/**
- task/lease/release/attestation control-plane contracts
- multi-agent lease、resource lock、worktree manager、release、recovery、rollout、test-identity scripts

这些路径包含或引用本地 public trust、外部路径、SQLite/registry、租约、发布证据和 rollout 状态。
即使某个文件为空或只有公钥，也属于另一信任边界，不能作为无害骨架。

### 旧产品与能力事实

全部 EXCLUDE 或 DEFER：

- capability-entry inventory/contracts/wiki；
- knowledge-quality rubric/contracts/evaluator；
- old commercial-loop、true-loop、旧 backend primary harness 清单；
- old Shangshufang/Outbox/FinalMemorial 业务主线；
- courto-brain extraction、Dadian freeze、旧 frontend pnpm/release/prod 命令；
- harness-dev 中各 scoped Hùbù/Shiguan execution authority。

这些内容与 ext 当前 ADR 0028、FastAPI/Next.js/npm、46 RuntimeSkills 和新证据主线不一致。

## 9. Authority 兼容矩阵

| 语义 | ext 当前 | 参考来源 | 收敛规则 |
| --- | --- | --- | --- |
| authority namespace | execution-authority.ext.v1 | root v1/root v2/R0 | 只登记 ext；不迁旧 namespace |
| 当前状态 | STOP | v1 STOP；v2 旧 R0 状态 | 不合并状态 |
| product permission | false 常量 | 不同历史语义 | 继续 false |
| exact task | EXT-GOV-AUTH-V1-20260815 | R0 work packages | 不互认 |
| trust root | 外部缺失 | 仓内 tracked trust/旧外部设计 | 不迁；缺失保持 STOP |
| required check | UNVERIFIED | 本地/旧证据 | 不漂白 |
| workflow | ext workflow 字节受保护 | 不同历史 | 不修改，不作平台 proof |

未来 root manifest 只允许登记：

- authority namespace；
- status command；
- canExecuteProductWork=false；
- 外部激活状态 UNVERIFIED。

它不得保存 grant、attestation、checkpoint receipt、平台 proof 或 active product task。

## 10. 推荐的迁移分类

| 分类 | 定义 | 本轮结果 |
| --- | --- | --- |
| REWRITE | 用 ext 当前事实重新写，参考来源只提供方法 | owner/rules/wiki/manifest/doctor |
| COPY_CANDIDATE | 可能逐文件同字节采用，仍需 future exact approval | 四个 change templates |
| EXCLUDE | 明确永不由本计划迁入 | history/authority/trust/runtime/rollout/old facts |
| DEFER | 未来独立任务重新论证，不继承旧状态 | frontend/backend line Harness、platform enforcement |

## 11. 风险

| 风险 | 触发 | 控制 |
| --- | --- | --- |
| 伪历史连续性 | 复制旧 changes/approval | 全量 EXCLUDE，source ledger 只记 digest |
| 第二执行权威 | 迁入 root v1/v2/scoped authority | 负向 path guard；独立 review |
| 假三层完成 | manifest 把缺失 doctor 写 READY | closed state enum；disk/Git verify |
| 信任漂白 | 复制 public key/空 runtime registry | trust/runtime 全排除 |
| 脏工作区污染 | 从主工作区 cp 文件 | 只允许 git show exact SHA；diff source digest |
| 命令漂移 | 复制 pnpm/旧 backend doctor | 从当前 package/AGENTS 发现命令 |
| 产品越权 | root doctor 全绿后直接施工 | product=false；独立 product authority |
| 平台假绿 | workflow 代替 required check | 外部 PLATFORM proof 必需 |

## 12. 新鲜验证记录

| 命令 | 结果 |
| --- | --- |
| git rev-parse HEAD | 2ef0bb4689517b7a05578f18091e841ec37eca2a |
| git rev-parse HEAD^{tree} | 6b1f5335382721d85093095fc1834fef7b000ed0 |
| git rev-parse 8bb...^{tree} | d71b15e402abdf347f48e006fb8257d5738e7b34 |
| git rev-parse 8bb...:.harness | db8541f13840ea4b397317f0f5982888bcb5e095 |
| node scripts/check_harness.mjs | PASS，133 个基线文件 |
| execution_authority_ext --status | STOP，exit 0 |
| execution_authority_ext --authorize | STOP/TRUST_ROOT_UNAVAILABLE，exit 2 |
| test -d .harness | exit 1，缺失 |
| test -d frontend/.harness | exit 1，缺失 |
| test -f backend/harness/manifest.json | exit 1，缺失 |
| 两个 ancestry 检查 | 均 exit 1 |

## 13. 当前结论

1. 根 Harness 有可吸收的治理方法，但没有可安全整体迁移的目录。
2. 8bb 是唯一可冻结的远端参考来源，不是 authority 或 merge base。
3. ext 必须新建自己的 BOOTSTRAP_OBSERVE 协调内核，先诚实登记 ABSENT/PARTIAL。
4. frontend/backend Harness 必须分别建设并验收，之后才能由 root doctor 委托。
5. 根三层收敛完成后，产品 authority 仍然缺失；户部施工仍是 STOP。

Verdict：CONDITIONAL PASS 仅适用于来源冻结与蓝图；实际迁移 NOT STARTED / BLOCKED。
