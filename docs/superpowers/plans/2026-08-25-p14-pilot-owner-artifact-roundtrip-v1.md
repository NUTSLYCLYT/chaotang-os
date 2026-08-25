# P14-PILOT Owner Artifact Roundtrip V1 — Governed Plan

> 状态：`DRAFT / NON_AUTHORIZING / PRODUCT_STOP`
>
> Task：`P14-PILOT-OWNER-ARTIFACT-ROUNDTRIP-V1`
>
> 当前授权只覆盖本 plan、同名 task、同名 approval 草案、治理检查和独立复审。

## Contract

- 用户：受邀请、已登录且拥有真实成果的普通用户。
- 行为：查看、下载、确认或退回、刷新、进入史馆找回；跨 Owner 全部拒绝。
- 成果：稳定 digest 的成果包、追加式确认回执、已有 `reply_id` 的史馆入口。
- 闭环：办事。
- 成熟度：`ADVISORY -> VERIFIED`。
- 基线：`82ba658db44d829d6ae7e028dcbac7ecefb4cee7` / `63e8c716f705d559b51169da9d1b80b7db4afccf`。
- 当前 authority：`STOP`；本 plan 不改变该结论。

## Phase 0 — Governance preparation（当前获准阶段）

1. 双读远端 `ext-dev` commit/tree、本地共享工作树、隔离治理 worktree 和所有相关 authority 状态。
2. 只读确认现有事实源：ArtifactStorage、WorkProductEnvelope、report-artifact API、严格前端 DTO、Study 成果组件和 Shiguan
   owner-scoped archive。
3. 冻结 26 条未来最大范围、受保护路径、26-path/524288-candidate-blob-byte 上限、仅固定 loopback/无公网/无外部副作用策略。
4. 编制 task、plan、approval 三份 `DRAFT_NON_AUTHORIZING` 草案。
5. 运行 JSON、duplicate-key、diff、Harness/Doctor、authority fail-closed 与三文件一致性检查。
6. 独立安全/架构复审；修正仅限三份草案。若修正需要四门 schema/consumer 或产品路径，记录阻塞而不越权。
7. 冻结三文件 raw SHA、sorted manifest 和 path-NUL-content-NUL bundle，提交 Owner 精确确认；不创建 commit。

## Phase 1 — G1 activation（未授权）

前置条件：四门 authority 已由独立 work package 机器化，旧 authority 与新 authority 采用 deny-overrides；Owner 已确认本 Packet
的精确 G1 approval；机器对本 Task 返回 `GO`。

1. 从当时重新核验的最新 `origin/ext-dev` 创建唯一干净、隔离候选；若基线移动，只允许本 lineage 一次 re-anchor，且不能扩范围。
2. 校验写入者、worktree、base/tree、允许路径、拒绝路径、数量/字节预算和绝对过期时间。
3. 只允许本地修改和测试；固定 loopback 只限 `http://127.0.0.1:8000` 与 `http://127.0.0.1:3002`，禁止 DNS、非 loopback
   连接和公网；G1 本身不授权 commit，push、pilot、release、deploy 和外部副作用仍为 `STOP`。
4. 在变更前保存精确 RED 和失败输出。不能证明 RED 时停止，不写实现。

## Phase 2 — Backend RED/GREEN（未授权）

1. RED：同 Owner 投影缺少用户闭环所需的 digest、reply/归档状态或来源诚实表达；cross-owner 查看、下载、确认任一语义泄漏即
   RED。
2. RED：篡改成果、缺证、storage unavailable、terminal confirmation 重放、并发刷新或取消请求不能稳定 fail closed。
3. GREEN：保持唯一 ArtifactStorage/WorkProductEnvelope 事实源；只在现有 API 投影中返回所需字段，不复制成果内容、不增加表。
4. GREEN：`artifact_file_sha256` 同时匹配持久化文件摘要、manifest XLSX digest 和下载字节；
   `work_product_content_digest` 单独保留语义摘要。确认回执追加且一次终态；后续 GET 返回相同两类摘要和终态。
5. GREEN：未知和 cross-owner 统一 404/等价拒绝，所有 503/409 文案脱敏。
6. 后端投影分别返回 `source_state`、`confirmation_status`、`archive_status` 与 `real_world_execution_status`；缺 provenance 时
   source 只能 PENDING，本 Packet 的现实执行固定 NOT_TRACKED，禁止跨轴推断。
7. 公开确认回执删除 `actor_ref/owner_user_id`；内部 `OWNER_SCOPE_DENIED` 不出现在 wire，未知与 cross-owner 外部响应完全一致。
8. `reply_id` 只作为已有 Shiguan REPLY 的引用；不存在时返回明确 pending/missing archive 状态，不自动建档。

## Phase 3 — Frontend RED/GREEN（未授权）

1. RED：普通用户看不到 digest/来源/史馆回写结论，或刷新后回退；史馆不能按 `reply_id` 选择对应档案。
2. 严格 DTO 拒绝未知、缺失或畸形字段；不得从 HTTP 200、自身缓存或静态 fixture 推断 LIVE。
3. 成果卡只突出一个当前主动作；确认理由必填，按钮具备 44×44 有效交互区和可见焦点。
4. 成功确认后分别显示文件 SHA、语义摘要、来源、确认、归档和现实执行状态；存在可靠 `reply_id` 时显示“在史馆查看”，
   否则显示“暂未获得完整回写”。
5. 新增的 owner-scoped 单档案 BFF 只转发现有 FastAPI `GET /api/v1/shiguan/archives/{id}`；
   `/shiguan?archiveId=<reply_id>` 先精确读取并验证 `id == reply_id && type == REPLY`，再选择目标。未知、cross-owner、错误类型
   不泄露存在性，并提供返回/重试；不得依赖最新 100 条列表命中。
6. 请求使用 no-store、可取消和代际保护；迟到响应不能覆盖较新结果。
7. Study 确认区按钮和史馆入口具备至少 44×44 有效交互区、键盘焦点和非颜色状态表达；只修改获准的既有 CSS path。

## Phase 4 — Verification（未授权）

依次执行，任何失败先诊断根因，不放宽门：

1. 从冻结 `base..candidate` Git objects 运行 NUL-safe name-status（rename detection off），拒绝 delete/rename/symlink/submodule；
   对每条 ADD/MODIFY 路径读取 candidate blob size 求和并对照 26-path/524288-byte 上限。工作树 diff/numstat 不能作最终证明。
2. RED 证明：测试在基线因目标缺失失败，在最小实现后通过。
3. Backend 专项：四个成果/确认测试文件；再运行受影响 accounting/report-artifact 回归。
4. Frontend 专项：report-artifact handlers、backendClient、Study confirmation/links、Shiguan client/controller tests。
5. 前后端严格契约、TypeScript、frontend build。
6. owner A 正链；owner B 对查看、下载、确认和史馆深链四个负例；未知 ID 对照。
7. 缺证、超时、模型失败、Fallback、刷新竞态、取消请求、重复确认、digest 篡改和史馆缺失。
8. 在固定 `127.0.0.1:8000/3002` 启动真实前后端，使用真实浏览器完成登录→成果→下载→确认→刷新→史馆→返回；检查
   控制台和关键截图。禁止 DNS、非 loopback 与公网连接。
9. 独立 Python、TypeScript、权限/安全复审，无未关闭 P0–P2。
10. 冻结 pre-commit tree、exact path list、逐文件 raw SHA、patch digest、test/browser evidence digest 和 bundle digest；此时停止，
    不创建 commit。

浏览器工具或本地运行依赖不存在时必须写“未验证”，本 Packet 不完成；不得引入依赖或公共网络绕过。

## Phase 5 — Local candidate commit materialization（未授权）

1. Owner 必须另行确认 pre-commit tree、base、exact paths、patch 和 evidence digest，并只授权一次本地 commit。
2. Integrator 只能物化与冻结 pre-commit tree 完全相同的单亲 commit；tree 漂移或 scope 漂移立即 STOP。
3. 从 `base..candidate` Git objects 重跑 path/status、blob bytes、raw manifest、patch 和 evidence 绑定；candidate 必须 clean。
4. 本地 commit 授权不包含 push、merge、pilot、release、deploy 或外部动作。

## Phase 6 — G2 request（未授权）

1. Integrator 停止写入并冻结唯一候选；候选必须 clean，所有证据绑定同一 candidate identity。
2. 独立 Reviewer 从 Git object 和原始证据重算 identity，不信候选自报。
3. Owner 精确确认 G2 摘要后，才可请求邀请制试点；当前三文件不能授权 G2。
4. G2 仍禁止公共访问、支付、交易、删除、对外发送、正式发布和部署。

## Stop Conditions

- 任一 machine authority 为 STOP，或四门仍未机器化；
- 需要第 27 条产品路径、除三个固定 BFF 文件外的 ADD、任何 DELETE/rename、数据库迁移、auth/tenant 变更、新后端 API
  namespace 或第二事实源；
- owner、digest、来源、确认或 archive identity 不能由后端持久化事实证明；
- 试图把确认、归档或现实执行状态合并，或把 DEMO/FALLBACK 漂白为 LIVE；
- 需要 DNS、非固定 loopback 或公网、生产数据、secret、外部动作、未经 Phase 5 独立精确 materialization grant 的 commit、
  push、pilot、release 或 deploy；
- 稳定 lineage、predecessor digest、reanchor record、可信 authority 时间、事件序号或
  `lastQualifyingEvidenceAt/kind/digest` 缺失；同一 lineage 请求第二次 re-anchor；重复 evidence digest 试图刷新时钟；或 24 小时
  没有新的合格证据；
- 独立复审存在未关闭 P0–P2。

## Rollback

- 当前草案：放弃三条未提交治理文件。
- 未来候选：放弃未提交隔离候选并保留 RED/验证证据，不触碰共享 worktree。
- 未来试点：吊销另行批准的邀请 grant，停止本地服务，保留审计；不得回写 PASS。
