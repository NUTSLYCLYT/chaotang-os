# 铭硕第一交付 Project Fact Pack V1 Exact22 Lineage Corrective Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-PROJECT-FACT-PACK-V1-EXACT22-LINEAGE-CORRECTIVE-SUCCESSOR-20260913`

冻结基线：`origin/ext-dev@62827a3676f3714eb5be1948571451835456eb34`；tree：`dac3f0b2e13cd42fe0d4cc222c1f7eba8561e6df`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_EXACT_DIGEST_CONFIRMATION`

## Product Definition

本 forward-only successor 只纠正铭硕第一交付 exact19 与现行 Fact Pack compatibility relay 的谱系矛盾。前序任务 `MINGSHUO-FIRST-DELIVERY-PROJECT-FACT-PACK-V1-SUCCESSOR-20260913` 的 one-child authority 已由 Owner 按 `APPROVAL_SCOPE_LINEAGE_CONTRADICTION` 明确放弃，状态永久为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR`；其未提交 exact19 字节只作为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE` 保留。

业务范围与 exact19 完全相同：复用唯一 Python Fact Pack evaluator，建立认证 owner/tenant 绑定的项目、不可变 requirements/Fact Pack revisions、canonical digest、非授权 draft request，以及 `mingshuo.sqlite3` 的统一 runtime registry/readiness/backup/release identity。新增三条路径只把 source provenance 与 Node relay 的 forward-only approval/candidate identity 更新到本 exact22；它们不增加 endpoint、数据库、业务状态、事实源或 evaluator。

### 唯一 evaluator 与 relay 边界

- `backend/app/mingshuo/fact_pack.py` 是唯一 Fact Pack semantic evaluator。Node relay 只执行固定、已验证的本地 Python source，不解释、复制或修正业务语义。
- relay 只接受本任务的正式 approval、其唯一直接单亲 exact22 candidate，以及该 candidate 的精确 22 路径、`5 ADD + 17 MODIFY`、全部 `100644` 身份。
- source provenance manifest 是唯一 source identity 清单，闭合、有序且无重复地冻结 evaluator、local schema、golden corpus 与 relay 的 `path/mode/bytes/rawSha256`。不得建立第二 manifest、第二 evaluator、第二 registry 或自定义 GO。
- 保留固定 trusted Git/Python、repo-root containment、regular/non-symlink、safe mode、hardlink/TOCTOU、bounded stdin/stdout/stderr/timeout、TERM→KILL→reap 和脱敏 STOP 门禁。Python 必须经固定 `/usr/bin/unshare` 在新的 user+network namespace 内启动；该工具同样验证 root-owned、regular/non-symlink、不可 group/world writable及版本精确 `unshare from util-linux 2.39.3`。namespace 创建失败、存在 host-facing network interface 或无法证明外联被内核拒绝时，必须在 evaluator 启动前 STOP。
- evaluator 进程只继承闭合 allowlist 环境和 stdin/stdout/stderr，不继承代理、云凭据、SSH、token、home 或其他宿主 credential 环境变量/文件描述符。network namespace 中不得挂入宿主网络；即使 provenance-valid evaluator 或其子进程尝试 IPv4、IPv6、DNS 或 socket 外联，也只能失败关闭。

### 原 exact19 业务合同保持不变

- HTTP 仍精确为创建项目、追加 revision、读取 owner-scoped 项目、创建非授权 draft request 四个 endpoint；`201/200/401/404/409/422/503` 映射不放宽。
- tenant、owner、project ID、decision、digest、状态、评估日期、价格权限、生产或业务成功字段只由服务端形成；未知与跨 owner/tenant 统一 `404`。
- full-pack canonical bytes 仍为 Python `json.dumps(... ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":"))` 的 UTF-8 bytes；事实 digest 只取这些完整 bytes 的 SHA-256。
- 只有当前、已持久化、复算一致且按当前 UTC day 仍为 PASS 的 revision 能创建非授权 draft request；价格请求及 HOLD/BLOCK/STOP 不得写入。
- 唯一运行库仍为 `backend/data/mingshuo.sqlite3`；复合 tenant/owner/project 谓词、append-only revision、同事务幂等、`BEGIN IMMEDIATE`、WAL、`synchronous=FULL` 和有界 busy timeout 不变。
- 第八库继续通过唯一 `RUNTIME_DATA_ENTRIES` 进入 readiness、backup/restore 与 Release registry identity；不修改 `readiness.py` 或 `sqlite_backup.py` 产品实现。

## Acceptance Criteria

- [ ] proposed approval、Task、Plan 严格绑定 `62827a3676f3714eb5be1948571451835456eb34 / dac3f0b2e13cd42fe0d4cc222c1f7eba8561e6df`，formal approval 未来只能是该基线的直接单亲三文件子提交。
- [ ] machine GO 后的 product candidate 精确为 22 路径 `5 ADD + 17 MODIFY`，全部 `100644`，不得出现第二十三路径。
- [ ] 前序 exact19 authority 永久 abandoned/unconsumed/no-reanchor；donor 可用于最小、可审查的重物化和缺陷纠正，但不继承 candidate、验证、审查、通过或 authority 身份。
- [ ] relay 的 TASK、APPROVAL、PRODUCT_PATHS 与本 exact22 正式 manifest 字节级一致；旧 exact8 或 exact19 approval、伪造 descendant、split last-touch、额外/缺失路径均 fail-closed。原 exact19 十九路径必须全部由同一 exact22 candidate 重物化和触碰，不得遗漏。
- [ ] source provenance 在最终产品字节确定后机械更新；四条 source record 与 candidate tree blob、工作树 bytes、mode、size、raw SHA 全部一致，任一 stale/tamper/reorder/duplicate/extra identity 都在启动 Python 前 fail-closed。`--check` 必须先完成来源验证，再只从该次已验证的 golden bytes 取得 fixture，禁止验证前读取或二次读取形成 TOCTOU。
- [ ] 固定、受验证的 `/usr/bin/unshare` 必须成功建立无宿主接口的 user+network namespace 后才可启动 evaluator；真实 provenance-valid source 与其子进程分别尝试 IPv4、IPv6 和 DNS 外联必须被内核拒绝。unshare 缺失、版本/身份漂移、namespace 不可用或探测异常时在 evaluator 前返回脱敏 STOP。
- [ ] 测试进程预置代理、云、SSH、token、HOME 与额外文件描述符时，evaluator 仍只能看到闭合环境及三个标准流；任何宿主 credential 环境或 fd 继承都失败关闭。
- [ ] 旧 exact19 的认证、tenant、canonical bytes、UTC 复评估、幂等、并发、rollback、readiness、backup、Release identity 与脱敏错误合同不回退。
- [ ] focused、backend-full、Ruff、runtime lifecycle、Release tests、relay negative/check、Harness/doctor/hook、authority regression、V2 和 diff 全绿；Governance、Python、Security 三审无 P0–P2，machine verify-candidate PASS。

## Delivery Constraints

- 只允许 formal manifest 冻结的 exact22；不修改第二十三路径、`readiness.py`、`sqlite_backup.py`、Scene Pack、WorkProduct、会计、军机处、史馆、前端、BFF、Harness、authority 或外部配置。
- 三条新增路径只服务 source identity 与 lineage 闭合，不扩大 exact19 的 API、数据库、状态或交付能力。
- 不读取客户数据、凭据、IMA、MCP、网络、外部模型或第三方服务；不生成真实报价，不确认、下载、归档、发布、交易或部署。不得以“源码已签名”替代运行时网络隔离。
- 不以 chmod/chown、Git config、环境变量、测试豁免、allowlist 拆分或 descendant 放宽来绕过 source/lineage 门禁。
- 远端漂移、machine STOP、第二 evaluator、第二 registry、source/lineage 校验放宽、产品范围扩大、验证失败或三审 P0–P2 时立即停止。

## Affected Modules

- 模块：铭硕项目与 Fact Pack 持久化、认证 API、runtime data lifecycle、Release registry，以及唯一 Python evaluator 的 source-provenance/Node compatibility relay。
- 允许路径：proposed approval 中精确 22 条 product paths（原 exact19 加 source-provenance manifest、relay 与 relay tests）。

## Technical Plan

1. 正式 approval 三文件独立落地并取得 machine GO 后，在唯一隔离工作区重物化并由同一 candidate 触碰 exact19 donor 的全部十九路径，再加入三条 lineage 路径；donor 缺陷允许在相同 22 路径内最小修正，不要求保持已知矛盾字节，但不得遗漏任一路径。
2. 先以真实 RED 证明旧 exact8/exact19 approval、split last-touch、非直接 child、23rd path、mode/symlink/hardlink、Git/tool/env drift、stale source hash、manifest reorder/duplicate/extra、golden fixture 验证前读取/验证后二次读取以及 relay 策略分叉均失败关闭。
3. 以 provenance-valid synthetic evaluator 及其子进程真实尝试 IPv4、IPv6、DNS/socket 外联；只接受内核 network namespace 拒绝。另测 unshare 缺失/版本/身份/namespace 失败，以及宿主 proxy/cloud/SSH/token/HOME/额外 fd 注入，证明 evaluator 启动前或进程边界 fail-closed。
4. 将 relay 精确改绑新 task/approval/exact22，仍只允许唯一直接单亲 candidate；固定验证 `/usr/bin/unshare` 并以 `--user --map-root-user --net`（或更严格的等价闭合参数）启动 Python；隔离创建失败不得降级直跑。clean unrelated descendant 只在 22 路径 last-touch 全部仍为该唯一 candidate 且其为当前 HEAD 祖先时可验证。
5. 完成 exact19 业务字节和 relay 后，按固定顺序计算最终 `fact_pack.py` 与 relay 的 raw SHA/bytes，原子更新唯一 provenance manifest；再复算四 source records、candidate tree blob 与 working bytes。`--check` 只把 `verifiedSources()` 返回的已验证 golden bytes 交给 fixture parser，不在来源验证前读取，也不重新打开文件。
6. 运行完整矩阵和独立 Governance/Python/Security Review；字节冻结后创建唯一 candidate，重新运行受 commit 身份影响的 relay/lineage 和完整矩阵，最后 machine verify-candidate。
7. 只有 machine PASS、远端仍为 approval、exact22 不变且工作树 clean 时，后续独立授权才可普通 fast-forward；禁止 force-push 或部署。

## Implementation Report

只读诊断已机械证明：当前 relay 仍绑定 `MINGSHUO-FACT-PACK-V1-PYTHON-CANONICAL-RUNTIME-LINEAGE-SUCCESSOR-20260913` 的 exact8。旧 exact19 仅修改该 exact8 集合中的三条路径，因此模拟 direct-child 时稳定返回 `STOP / LINEAGE_LAST_TOUCH_INVALID`；现行 source provenance 对已变化的 `fact_pack.py` 也会产生 stale identity。该结果是 approval scope 与 relay lineage 的合同矛盾，不是放宽门禁的理由。

本治理包尚未物化 formal approval、未运行新 authority、未修改产品路径、未创建 candidate/commit/push，也未部署。proposed JSON 中的 `APPROVED_FOR_ONE_CHILD` 只是正式 manifest schema 的未来固定值，当前三文件仍为非授权治理草案。

## Acceptance Review

Pending strict validation, independent Governance/Python/Security Review and Owner exact canonical digest confirmation. 通过治理冻结只证明 exact22 范围与门禁可安全提交审批，不代表产品已实施、已验证或完成铭硕第一交付闭环。
