# 铭硕第一交付 Project + Fact Pack + Runtime Data V1 Successor Plan

任务：`MINGSHUO-FIRST-DELIVERY-PROJECT-FACT-PACK-V1-SUCCESSOR-20260913`

基线：`3b0e4541a76385f348e6196af6983aa2dca2b9eb / 11295a5dbb1b0869855c87e907a98e3dd6e0e179`

## Status

Draft

`DRAFT / NON_AUTHORIZING`

## Product Definition

以主线唯一 Python canonical Fact Pack evaluator 为语义源，原子补齐认证项目、不可变需求/Fact Pack revisions、非授权 draft request 和新 `mingshuo.sqlite3` 的统一 runtime registry/readiness/backup/release identity。项目域只保存自身真值，不复制 Scene Pack、军机处、史馆或会计成果。后继跨包锚点固定为 `tenant_id + owner_user_id + project_id + fact_pack_version + fact_pack_digest`。

原 exact9 会在 `backend/data` 创建未登记数据库，必然触发 closed readiness 并脱离受控备份/Release identity，故在 approval 前改为 exact19。`readiness.py` 与 `sqlite_backup.py` 已从 `RUNTIME_DATA_ENTRIES` 数据驱动，不修改其实现；只扩 registry、相邻测试及 registry digest 的全部可执行 Release consumers。

## Acceptance Criteria

- [ ] exact19 保持 `5 ADD + 14 MODIFY`、全 `100644`，无第二十路径。
- [ ] 四个冻结 endpoint、closed DTO、输入上限和 `201/200/401/404/409/422/503` 错误映射一致。
- [ ] owner/tenant、canonical full-pack bytes/digest、requirements binding、evaluated UTC day、decision/reasons、revision 与 request-key 幂等都由服务端闭合并在读回时复核。
- [ ] 历史 revision 用已存 UTC day 验完整性；创建 draft 使用当前 UTC day 重新评估。证据过期、时钟回拨、旧版本或任何 digest 漂移都无写入。
- [ ] 只有当前已持久化 PASS revision 能产生非授权 draft request；价格、HOLD/BLOCK/STOP、跨租户、悬空引用和并发冲突 fail-closed。
- [ ] `mingshuo.sqlite3` 是唯一 registry 的第八库；readiness、backup/restore/rehearse 和 Release digest consumers/tests 原子接受同一 schema/registry identity。
- [ ] 完整验证与 Governance/Python/Security 三审通过后才可形成 candidate；机器 PASS 且远端未漂移时才可普通快进。

## Delivery Constraints

- 不修改 `backend/app/readiness.py`、`backend/app/operations/sqlite_backup.py`、Scene Pack、WorkProduct/Artifact、会计、军机处、史馆、前端、BFF、Harness、authority 或外部配置。
- 不访问网络、模型、IMA、MCP、真实客户资料、凭据或设备；不生成真实报价、成果文件或生产发布。
- 不把 PASS、draft request、registry backup rehearsal 或测试 fixture 表述为价格批准、成果确认、真实数据灾备、业务成功或完整里程碑。
- 若 runtime lifecycle 无法在 exact19 闭合，立即 STOP，不得创建未登记数据库或第二 registry。

## Affected Modules

- 模块：Mingshuo project/fact-pack persistence、authenticated API、runtime-data registry/readiness/backup/release identity。
- 允许路径：formal approval manifest 的 exact19。

## Technical Plan

1. Governance freeze：严格校验三草案、exact19、输入/错误/API/数据/Release 边界，完成三审并取得 Owner canonical digest 确认。
2. Approval/authority：正式三文件独立提交并普通快进后，只运行一次 product authority。
3. RED/API：认证缺失、tenant/owner/authoritative 字段伪造、非法/重复 JSON、边界、统一 404、响应序列化失败。
4. RED/identity：非最新/不存在/digest 漂移、跨日到期、clock rollback、STOP/BLOCK/HOLD/PRICE、重复 key 不同 payload、并发 race、事务失败和重启读回。
5. RED/lifecycle：第八库未登记、schema/trigger/user-version drift、未知文件、sidecar、备份篡改、恢复身份/幂等/tenant 漂移、registry digest 任一 consumer 分叉。
6. GREEN/contracts：closed Pydantic DTO；只接受 bounded nonauthoritative inputs；服务端构造完整 pack并强制 price authority MISSING、非生产/非发布/知识候选状态。
7. GREEN/canonical：唯一 bytes 为 `json.dumps(... ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode("utf-8")`；唯一 digest 为其 SHA-256；原 client/Node/SQLite/response bytes 均不得参与事实摘要。
8. GREEN/storage：单库、复合 tenant/owner/project key、FK、append-only revision、BEGIN IMMEDIATE、WAL、FULL synchronous、bounded busy timeout、同事务幂等与 rollback。
9. GREEN/lifecycle：以真实 candidate schema生成并冻结 registry schema digest，再机械生成新 registry digest；原子同步 deploy schema、build/verify/RC acceptance 及三份测试。通用 backup/readiness代码保持不变。
10. Pre-commit：focused、runtime lifecycle、release registry、Ruff、Fact Pack regressions、diff、字节冻结与三审。
11. Post-commit：backend-full、完整 Node Release tests、Harness/self-test/doctor/hook、authority regression、V2、最终三审和 machine candidate verification。
12. Land：仅当全部 PASS、exact19 不变、工作树 clean、远端仍为 approval 时普通快进；否则拒绝 child，不 amend、不强推。

## Implementation Report

尚未实施。只读盘点证明通用 S4/V4、会计成果和史馆能力已经存在，但 Fact Pack 没有持久化消费者；同时 `backend/data` 是 closed layout，新库必须进入现有 registry→readiness→backup→release identity 主链。本包只关闭这一最早后端断点，不宣称方案/报价、人审、下载、史馆或 V4 已接通。

## Acceptance Review

Pending governance freeze and Owner exact canonical digest confirmation. 任何 scope expansion、第二 evaluator/registry、机器 STOP、验证失败或审查 P0–P2 都停止。
