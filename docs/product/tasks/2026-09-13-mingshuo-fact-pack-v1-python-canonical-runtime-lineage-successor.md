# 铭硕 Fact Pack V1 Python Canonical Runtime Lineage Successor

任务 ID：`MINGSHUO-FACT-PACK-V1-PYTHON-CANONICAL-RUNTIME-LINEAGE-SUCCESSOR-20260913`

冻结基线：`origin/ext-dev@6de41450aaced415fecab1da7929aacce33d01e4`；tree：`ac0da0d791d0c0cb00fc7fdcbd888e18ac30cd63`。

本任务是铭硕第一交付闭环的最窄前置：先让需求、缺失资料、证据、限制和报价权限形成一个可复算、可拒绝的唯一 Fact Pack 事实，再允许后续 API、V4、人审、下载和史馆归档接入。它不是完整交付闭环，也不把设计文档或 donor 字节描述成已实现产品。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_EXACT_DIGEST_CONFIRMATION`

## Product Definition

在现有 `MingshuoProjectFactPackV1` 合同上建立 Python canonical evaluator，并让 Node 仅作为固定、本地、无网络的 compatibility relay。Python evaluator 是需求字段、证据引用、采用状态、价格/渠道权限、缺口、阻断原因、canonical JSON 与 digest 的唯一语义事实源；Node 不复制这些业务判断。

历史 `e7ca4dfc8444d1967cafe498956b8a5da02713cc` 及 2026-09-07 exact7/exact8 产品字节只登记为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / REISSUE_REQUIRED`。新候选可在 exact8 内选择性重物化 donor，并必须修正已经确认的来源身份、TOCTOU、输入输出边界、子进程回收和 UTF-8 等缺陷；不得继承旧 raw digest、approval、authority、candidate、验证或审查身份。

`docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json` 是闭合、有序的运行时来源清单，但它不能自我充当信任根。唯一根绑定必须机械来自当前任务的 formal approval Git lineage：固定 formal approval path 的最后修改提交为 approval commit；八条 product paths 的最后修改提交必须全部是同一个 candidate commit；candidate 必须是 approval 的直接单亲子且只修改 exact8；candidate 必须是当前 HEAD 的祖先；工作树中的八个 blob 必须仍等于 candidate tree。任一条件不可确认都 fail-closed。这样即使 manifest 与 source 同时被后续篡改，也不能仅靠彼此一致而通过。

旧 `docs/superpowers/plans/2026-09-07-mingshuo-fact-pack-v1-source-identity-manifest.md` 只属于旧 lineage，不是本 successor 的根绑定。新候选必须先证明沿用旧计划摘要会 fail-closed，再移除对旧计划内容的运行时依赖；这不修改或重写旧计划。relay 随后以稳定文件描述符读取并验证 candidate tree 已绑定的来源，再执行已验证字节；禁止校验后重新按可变路径导入。不得创建第二个 Fact Pack runtime、第二份 schema 或第二套 authority。

`/usr/bin/git` 与 `/usr/bin/python3.12` 是显式受信 OS package boundary，不是 repo 内容。二者必须固定绝对路径、禁止 shell、检查 root owner、regular、non-symlink、single-link、不可 group/world writable；Git 仅在清洗环境下读取本地对象与索引。Python 必须先稳定打开并校验，再通过已打开 FD 对应的 `/proc/self/fd/<n>` 执行，避免“校验路径后重新打开路径”。child 只继承显式环境白名单和必要 FD，不继承 HOME、代理、token、云凭据或调用方自定义 Python 环境。

## Acceptance Criteria

- [ ] future approval commit 是冻结基线的直接单亲子，且只包含 formal approval、Task、Plan 三路径。
- [ ] future product candidate 只修改 manifest 的 exact8，结构为 `5 ADD + 3 MODIFY`，模式全部 `100644`，不得出现第九条路径。
- [ ] Python 对未知顶层/嵌套字段、重复 evidence ID、悬空引用、错误采用状态、来源摘要漂移、失效证据、缺少报价权限和显式结构化 `dangerousOperationalInstructionsPresent=true` 全部 fail-closed；本纯内核不声称识别自然语言危险文本。
- [ ] 无证据的外部事实、认证、参数、价格、交期和市场适用性不得进入可交付主张；缺失项必须进入明确的 `missingItems` 或阻断原因。
- [ ] canonical JSON、evidence 采用顺序、digest 和 golden corpus 在 Python 与 Node 入口间字节一致；Node 不拥有或分叉业务语义。
- [ ] Git lineage 根绑定必须拒绝旧静态计划摘要、错误 approval、非直接单亲 candidate、candidate exact8 之外路径、八路径分属不同提交、candidate 非 HEAD 祖先、工作树/索引/blob 漂移；manifest 与全部 source 同时篡改也不得通过。
- [ ] source provenance 必须拒绝缺失、重复、额外、乱序、路径逃逸、Unicode 混淆、非法 UTF-8、symlink、hardlink、非 regular、模式/字节/SHA 漂移。
- [ ] 受信源码必须用 `O_NOFOLLOW` 和稳定 FD 读取，前后复核 device/inode/link/mode/size/mtime/ctime；实际执行字节必须就是已验证字节。
- [ ] `/usr/bin/git` 与 `/usr/bin/python3.12` 的 OS trust boundary、固定路径、owner/mode/link/version 必须闭合；Python 实际通过已校验 FD 执行，解释器路径替换或 metadata 漂移 fail-closed。
- [ ] stdin、stdout、stderr、执行时间和子进程生命周期有明确上限；child 使用最小环境白名单与受控 cwd，不继承 PATH 注入、HOME、proxy、token、云凭据或 Python 用户配置；异常时 TERM、等待、必要时 KILL，并 close/reap 后返回脱敏错误。
- [ ] `--check` 只使用 synthetic fixture，不访问 IMA、网络、模型、凭据或真实客户数据。
- [ ] 未提交阶段先完成 RED/GREEN、focused、Ruff、Node unit tests、静态来源清单检查和独立 Python/Security byte review；这些证据不得声称 candidate lineage 已通过。
- [ ] 字节冻结后只创建一次 approval 的直接单亲本地 candidate commit；随后才运行需要真实 Git lineage 的 `node scripts/mingshuo-fact-pack.mjs --check`、完整 backend/Harness/authority/V2 矩阵、commit identity 复核、独立 final review 与 machine verify-candidate。全部通过才允许普通 fast-forward；失败则拒绝该 child，不改写提交、不推送，并重新走 corrective successor。

## Delivery Constraints

- 本治理阶段只允许三份草案；Owner 精确确认 canonical digest 前，不物化 formal approval、不提交、不推送、不运行 product authority。
- 本 product successor 只允许 exact8；不修改 API、数据库、Scene Pack、WorkProduct、史馆、军机处、认证、租户、前端、BFF、Harness 或 authority。
- 不生成方案/报价、不进行人工确认、下载、归档、外部发布、交易或生产部署；这些属于后续独立纵切包。
- 不读取 IMA、MCP、真实客户资料、凭据、网络或外部模型；不得以系统配置、chmod/chown 或第二 evaluator 绕过来源身份门。若 Git 对象、索引、`/proc/self/fd` 或受信 OS binary boundary 不可用，必须停止，不能退化为仅比较 mutable manifest。
- 远端漂移、机器 STOP、第九路径、第二语义实现、验证失败或任一独立审查 P0–P2 时立即停止对应写入链。

## Affected Modules

- 模块：铭硕 Fact Pack Python canonical evaluator、local schema/golden contract、source provenance、Node compatibility relay。
- 允许路径：`backend/app/mingshuo/__init__.py`；`backend/app/mingshuo/fact_pack.py`；`backend/tests/test_mingshuo_fact_pack.py`；`docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json`；`docs/contracts/mingshuo-project-fact-pack.v1.golden.json`；`docs/contracts/mingshuo-project-fact-pack.v1.md`；`scripts/mingshuo-fact-pack.mjs`；`scripts/mingshuo-fact-pack.test.mjs`。

## Technical Plan

1. 在最新 ext-dev 冻结三文件 successor；只将旧 exact8 作为可审计 donor，不继承身份。
2. approval 落地并取得 machine GO 后，从干净 approval commit 建立唯一候选工作区。
3. 先重现当前缺少 Python canonical runtime 的 RED，以及 unknown/evidence/provenance/lineage/TOCTOU/interpreter/env/resource-boundary 安全 RED。
4. 在 exact8 内选择性吸收 donor 并做最窄纠正：用 formal approval → direct one-child candidate → current blob 的 Git lineage 替换旧静态计划根；使 Python 成为唯一 evaluator，Node 成为受限 relay。
5. 未提交阶段运行 RED/GREEN、focused、Ruff、Node unit、静态来源检查和 byte review，冻结 exact8 raw/blob/mode/bytes/bundle/diff；此阶段不运行或宣称 lineage-bound `--check` 通过。
6. 只创建一次本地直接单亲 candidate commit。提交存在后，运行 lineage-bound `--check`、完整 manifest 矩阵、final review 和 machine verify-candidate；任何失败都拒绝该 child，不 amend、不推送，另立 corrective successor。
7. 只有远端仍精确等于 approval commit且机器 PASS，才允许将该既有精确 candidate commit 普通 fast-forward。
8. 前置 candidate 落地后，另立“Fact Pack → 方案/报价草案 → 人工确认 → 下载 → 史馆归档”的纵切 successor，不复建存储或事实源。

## Implementation Report

当前只读盘点已确认：主线已有 Scene Pack 入口、军机处任务投影、WorkProduct/Artifact 生命周期和史馆不可变归档，但缺少 `backend/app/mingshuo/` Python canonical runtime，也没有将 scene run、Fact Pack、成果版本、确认、下载和归档绑定成一条链。浏览器在当前主线可创建铭硕任务并查看证据摘要，但明确显示“下载成果包 · 未接入”，且现有结果只是规则分析，不是最终报价或投标成果。

历史 donor `e7ca4dfc8…` 包含 exact8 的 `1068 insertions`，但提交自身明确为 evidence、not candidate、not authority；它只能提供实现线索。其旧 identity plan 信任根、解释器 path-reopen 和继承环境不得照搬。治理草案尚未授权产品字节、测试结论或交付完成声明。

## Acceptance Review

`DRAFT_ONLY / PRODUCT_NOT_AUTHORIZED / FIRST_DELIVERY_MILESTONE_NOT_YET_COMPLETE`。本前置只关闭唯一 Fact Pack 语义与来源身份问题；它通过也不等于 UI、方案、报价、确认、下载或归档已完成。后续纵切必须复用 Scene Pack、现有 WorkProduct/Artifact 存储与史馆，不得新增第四主线或第二事实源。
