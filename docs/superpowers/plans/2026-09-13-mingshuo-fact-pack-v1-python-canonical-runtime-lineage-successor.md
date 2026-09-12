# 铭硕 Fact Pack V1 Python Canonical Runtime Lineage Successor Plan

任务：`MINGSHUO-FACT-PACK-V1-PYTHON-CANONICAL-RUNTIME-LINEAGE-SUCCESSOR-20260913`

基线：`6de41450aaced415fecab1da7929aacce33d01e4 / ac0da0d791d0c0cb00fc7fdcbd888e18ac30cd63`

## Status

Draft

`DRAFT / NON_AUTHORIZING`

## Product Definition

本计划只交付铭硕 Fact Pack 的 Python canonical runtime 前置。Python 负责全部语义和 canonical digest；Node 只在固定来源身份、安全进程边界内转发。唯一来源信任根是 formal approval → direct one-child candidate → current blob 的 Git lineage，不是可与源码共同改写的 manifest 自证，也不继承旧静态 identity plan。旧 exact7/exact8 是 donor，不是可恢复候选。前置完成后才设计 API、V4、人审、下载和史馆纵切。

## Acceptance Criteria

- [ ] exact8 路径闭合为 `5 ADD + 3 MODIFY`，无第九路径。
- [ ] Python/Node 对相同 fixture 返回相同 canonical JSON、状态、阻断原因和 digest。
- [ ] evidence、价格权限、Git lineage、来源身份、解释器 FD、清洗环境、输入输出边界和子进程生命周期的负向矩阵全部 fail-closed。
- [ ] pre-commit RED/GREEN、focused/unit/static checks 与 byte review 全绿后只创建一次本地 candidate；post-commit lineage-bound `--check`、完整回归、final review 和 machine candidate verification 全绿后才允许普通快进。

## Delivery Constraints

- 不接 API、数据库、前端、Scene Pack、WorkProduct、史馆或外部系统。
- 不读取真实客户数据，不发布、不交易、不部署生产。
- 不继承 donor 的 authority、候选、验证、审查或 raw-byte 身份。
- 不修改 Harness、authority、系统解释器或持久配置；固定 `/usr/bin/git` 与 `/usr/bin/python3.12` 是受信 OS package boundary，不可用时停止。
- 本纯内核只消费结构化 `dangerousOperationalInstructionsPresent`；不声称做自然语言危险文本识别。

## Affected Modules

- 模块：Fact Pack Python evaluator、schema/golden、source provenance 和 Node relay。
- 允许路径：formal approval manifest 中精确八条 product paths。

## Technical Plan

1. Governance freeze：strict JSON、duplicate-key、schema、manifest、Task contract、精确路径/模式/diff、Harness 和三审。
2. Authority：formal approval 成为最新 ext-dev 的直接单亲子后，只运行一次 product authority。
3. RED：缺少 Python runtime；unknown fields；dangling/duplicate/stale evidence；无价格权限；结构化危险标志；旧计划摘要；approval/candidate lineage 漂移；manifest+source 同时篡改；path/symlink/hardlink/mode/UTF-8；解释器替换；PATH/HOME/proxy/token/Python env 泄漏；TOCTOU；超限输入输出和超时。
4. GREEN：以 donor 为线索在 exact8 内实现/纠正 Python canonical evaluator；以 formal approval path 的 Git history 机械定位 approval 与 direct one-child candidate，绑定当前 blobs；闭合 provenance；通过稳定 FD 执行已校验 source 与 interpreter；使用固定 binary、无 shell、最小 env、受控 cwd 和有界 relay。
5. Pre-commit verify：Python focused/Ruff、Node unit、静态 provenance、diff 与 byte review；冻结 raw/blob/mode/bytes/bundle/diff，但不宣称 Git lineage 已验证。
6. Commit once：只创建一个 approval 的直接单亲本地 candidate commit，不创建 throwaway commit，不 amend、不重写。
7. Post-commit verify：运行 lineage-bound Node `--check`、backend-full、Harness/self-test/doctor/hook、`TMPDIR=/tmp TEMP=/tmp TMP=/tmp` authority regression、V2、commit identity、final Governance/Python/Security Review 和 machine verify-candidate。
8. Land：全部 PASS 且远端仍为 approval commit时，才允许将同一个已验证 candidate 普通快进；任一失败则标记 rejected child 并重新签发 corrective successor。

## Implementation Report

尚未实施。本计划来源于当前主线浏览器闭环和代码盘点：入口与任务投影已存在，可信 Fact Pack runtime 缺失。历史 donor 仅用于减少重复劳动；任何吸收后的字节都必须在新基线重新形成 RED/GREEN、完整验证和独立审查。

## Acceptance Review

Pending governance freeze and Owner exact canonical digest confirmation. 远端漂移、机器 STOP、范围扩大、第二语义实现、验证失败或审查 P0–P2 时停止。
