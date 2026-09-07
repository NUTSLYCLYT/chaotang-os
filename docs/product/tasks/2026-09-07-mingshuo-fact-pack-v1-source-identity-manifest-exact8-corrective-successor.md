# 铭硕 Fact Pack V1 Source Identity Manifest exact8 Corrective Successor

任务 ID：`MINGSHUO-FACT-PACK-V1-SOURCE-IDENTITY-MANIFEST-EXACT8-CORRECTIVE-SUCCESSOR-20260907`

冻结基线：`origin/ext-dev@535bae44e349b7cb72730e076dc2a676282c1857`；tree：`cee222858e5b4acdf1e527f9d2beb2fc41eef1dd`。

> 状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_EXACT_DIGEST_CONFIRMATION`。V2 exact7 approval 的一次 product authority 已消费；其未提交字节仅为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`，不得 re-anchor。

## Status

Draft

## Product Definition

本 successor 为 Python canonical Fact Pack 建立可复算的源码信任链：approval commit 内的静态 provenance Markdown 冻结一份 exact8 产品 source manifest 的字节身份；该 manifest 再以闭合、有序、唯一的四记录数组冻结 evaluator、local schema、golden corpus 与 Node relay 的 `path / mode / bytes / rawSha256`。Node 仍只是固定 Python evaluator 的本地 compatibility relay，不拥有业务语义。

Git tree 不保存 uid/gid，因此 repo-controlled source 不要求 uid 0；它们必须固定路径、repo-root containment、regular、non-symlink、single-link、`100644`、精确字节数和 SHA-256。`/usr/bin/python3.12` 必须 root-owned、regular、non-symlink、single-link、不可 group/world writable，且版本精确为 `Python 3.12.3`。

运行时使用 `O_NOFOLLOW` 文件描述符稳定读取，前后复核 inode、device、link count、mode、size、mtime、ctime；Python 只执行 Node 已验证并通过封闭二进制帧传入的 evaluator/schema 字节，不再于校验后按工作树路径导入。候选提交另由 approval 的 `v15-exact8-preimage` 从 Git commit object 独立核验精确状态、模式、字节、raw SHA 与 bundle。

## Acceptance Criteria

- [ ] approval commit 是 `535bae44e…` 的直接单亲子且只包含 formal approval、Task、Plan、静态 provenance 四路径。
- [ ] Owner 确认 canonical digest `sha256:5f6f619e5dbac3fbd13aedfeb159e7f2140201eb6c852c4729d0bbcfa49e84ed`、formal approval 落地且 machine GO 之前，不得把本预映像视为 candidate。
- [ ] future exact8 candidate 只能 byte-for-byte 重物化本任务冻结的八路径；结构精确 `5 ADD + 3 MODIFY`，模式全部 `100644`。
- [ ] approval provenance → source manifest → evaluator/schema/golden/relay 信任链必须闭合；manifest 缺失、重复、额外、乱序、非 canonical JSON、非法 UTF-8、路径逃逸、Unicode confusable path、符号链接、硬链接、模式、字节数或 SHA 漂移均在启动 Python 前返回 redacted `SOURCE_IDENTITY_DRIFT`。
- [ ] evaluator/schema 的实际执行字节必须来自已验证内容，不得存在 check-then-path-import；子进程失败必须 TERM → 等待 → KILL → close/reap 后再返回。
- [ ] Python 继续是唯一 semantic evaluator；Node 不复制 schema、claim/evidence、price、channel、knowledge 或 safety 判定。
- [ ] `--check` 只使用 synthetic fixture；`--evaluate-wire` 在读取时执行 1 MiB 输入上限，输出/stderr/timeout 有界，未知参数失败关闭；无网络、凭据、客户数据、模型或外部执行。
- [ ] `v15-exact8-preimage` 必须从候选 Git commit object 核验八路径精确 `5A + 3M`、全 `100644`、每文件 bytes/raw SHA 及 exact8 bundle `sha256:a2d2884cd6910443f9db165280175c4dd95736bdfbb85ffe172c9da703cd0197`。
- [ ] focused、backend-full、Ruff、Node、Harness/self-test/doctor/hook、`TMPDIR=/tmp` authority regression、V2、diff、十轮同字节矩阵、Governance/Python/Security 三审和 machine verify-candidate 全部通过后，才可申请 candidate commit。

## Delivery Constraints

- 本轮只生成隔离预映像与治理草案；不运行 authority、不创建 candidate commit、不 push、不部署。
- 不改 API、数据库、Scene Pack、WorkProduct、史馆、军机处、认证、租户、前端、BFF、Harness、authority、系统解释器或系统配置。
- 不读取 IMA、MCP、真实客户资料、凭据、网络或外部模型；不发布、不报价、不确认、不下载、不归档。
- 不以 chown、chmod、Git config、系统安装、第二 evaluator 或第二事实源规避身份门。
- provenance Markdown 的自身 raw identity 由正式 approval 的 `v15` 绑定；不得把其自身摘要或四治理文件 bundle 写回成员而制造自哈希递归。四治理文件 bundle 仅在外部验收回报中冻结。

## Affected Modules

- 模块：Mingshuo Fact Pack Python canonical evaluator、local schema/golden contract、source provenance manifest、Node compatibility relay。
- 允许路径：`backend/app/mingshuo/__init__.py`；`backend/app/mingshuo/fact_pack.py`；`backend/tests/test_mingshuo_fact_pack.py`；`docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json`；`docs/contracts/mingshuo-project-fact-pack.v1.golden.json`；`docs/contracts/mingshuo-project-fact-pack.v1.md`；`scripts/mingshuo-fact-pack.mjs`；`scripts/mingshuo-fact-pack.test.mjs`。

## Technical Plan

1. 四文件治理包经 strict JSON、closed schema、Harness 与三审后，Owner 精确确认 canonical digest。
2. formal approval 以四路径直接单亲提交落地；machine authority 返回 GO 后创建唯一干净 exact8 candidate。
3. 按本预映像清单 byte-for-byte 重物化八路径，重新证明 source identity RED→GREEN、TOCTOU/资源边界与语义回归。
4. 完整矩阵、三审、`v15` 与 machine verify-candidate PASS 后再申请最小直接单亲 candidate commit与普通 fast-forward。

## Implementation Report

只在被忽略的隔离 clone 中形成预映像。初始 RED 为 Node `1 passed / 4 failed`：旧 relay 因 repo 文件 uid 非 0 返回 STOP，且 source manifest/provenance 缺失。第一轮 GREEN 为 Node `5/5`、Python `4/4`；donor 自带 20 项 Ruff 问题仅通过 formatter 机械纠正。

独立审查随后发现无界 stdin、校验后路径导入、hardlink、子进程回收、非法 UTF-8 与 machine candidate 字节绑定缺口。最窄纠偏后 Node `6/6`、Python focused `4/4`、exact Python Ruff、Node syntax 与 `git diff --check` 均 PASS；旧预映像及其摘要全部作废。

最终 exact8 预映像 bundle：`sha256:a2d2884cd6910443f9db165280175c4dd95736bdfbb85ffe172c9da703cd0197`。Proposed approval raw SHA-256：`sha256:5f7d306b544bf3cc158356919b628f2d36c8364329cc929f5d5befafe4edbbb3`；RFC 8785 canonical digest：`sha256:5f6f619e5dbac3fbd13aedfeb159e7f2140201eb6c852c4729d0bbcfa49e84ed`。

## Acceptance Review

`DRAFT_ONLY / PRODUCT_NOT_AUTHORIZED / PREIMAGE_NOT_CANDIDATE`。出现远端漂移、approval/provenance 不一致、第五来源、第二语义实现、raw field 泄漏、范围扩大、机器 STOP、验证失败或任一独立审查 P0–P2 时立即停止。
