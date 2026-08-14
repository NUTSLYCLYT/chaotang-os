# 户部黄金旨意与富奏折闭环施工蓝图

## 0. 目标与冻结事实

未来目标是在不扩大权限、不增加第二运行时的前提下，让一条户部经营分析旨意按 ADR 0028 自动归档为唯一史馆 `REPLY` 并尝试形成可核验富投影；rich 失败时降级为 text-only `REPLY`。Excel `ArtifactState.PUBLISHED` 只表示归档后本地受控下载可用，不是对外发布；WorkProduct 的人工决策轴在 receipt 前保持 `PENDING` 且 UI 不得称已确认，确认回执与脱敏合成 outcome 作为独立追加记录关联且不改写历史回奏。本蓝图当前只交付治理调查与设计，不授予产品施工权。

冻结事实：

- 目标产品分支基线为 Gitee `ext-dev`；2026-08-15 初始同步点为 `2e6fea337a50c316e748b7e65f03da52905e3394`，吸收验收加固与本治理蓝图后的当前远端点为 `70b25d48c3917ca1ae92725c058d0f0601accc3d`。
- 隔离集成分支已在 `34248ae2df2da7496f63934291e62dc8a5f68fb7` 合并 `2d29614137391c699615c0d84370db42ae217813`，吸收 `5f2a6e9f3e402313ada0f4477795da3e193feec1` 与 `e1c2dd42144e14914f5d0ec3905d26d404695b12` 的 9 个主流程验收/文档文件，不含产品运行代码。
- 现有唯一生产骨架是 46 个 RuntimeSkill；22 个活动能力族的业务成功计数仍为 0。
- 军机处、史馆、锦衣卫、会计 WorkProduct/Confirmation 和六部 Evidence Spine 已存在，应复用而非迁移。
- 当前根工作区 execution-authority v1 按设计永久返回 `STOP`，不能靠 amendment、摘要重钉或聊天确认激活；`ext-dev` 又缺根 `.harness/` 与 `scripts/execution-authority.mjs`。因此独立 successor-authority 治理任务获得精确批准并完成前，所有产品写入均禁止。
- 根分支的受管提交已经定义 `execution-authority.v2` 的 schema/manifest/resolver/CLI，但它只回答 `R0-W00..W09` 包。当前脏树把 manifest 改成 `GO / R0-W06`；W06 批准只覆盖 ArtifactManifest 与 PDF/DOCX/JSON，其 exact base `8feae838...` 不是当前根 HEAD `b20e2c78...` 的祖先，且批准路径依赖未跟踪文件。这个未受信 GO 既不能授权 ext 户部闭环，也不能作为新 authority 的批准证据。
- clean `ext-dev` 的 `frontend/AGENTS.md` 与 ADR 0028 以既有同源 Next BFF 为现行事实源。脏根工作树里观察到的 no-BFF 文字不属于本候选事实，也不能约束或授权本任务；只有未来拟吸收该提案时才需独立治理裁定。
- 根目录当前有大量来源未确认的未提交改动；本蓝图只在隔离 worktree 中工作，不 stash、不 reset、不 clean、不整树复制。

## 1. 大神会审结论

Karpathy 视角：不要再增加 Agent 数量；先让一条可测黄金任务产生结构化评测信号。第一个指标不是“生成了奏折”，而是 evidence coverage、人工修订率、确认率、史馆重放一致性和合成 outcome 完整率。

Bruce Schneier 视角：富内容扩大了 XSS、SSRF、跨 owner、伪证据和状态混淆攻击面。MVP 不接媒体上传、不接外链图片、不接任意 HTML；只接确定性数字、表格和 ChartSpec。这里的 preview 仅指 WorkProduct 的人工决策状态，不改变 artifact 已发布可下载和史馆回奏自动归档的既有时序。

共同决策：先交付最小的 `metric/table/chart` 富奏折，不把“图文并茂”误解为生成图片；证据图和示意图进入后续独立安全包。

## 2. 不变量

1. 下旨仍是唯一入口，ADR 0028 不变。
2. 46 个 RuntimeSkill registry 不变；不新增 RuntimeSkill。
3. owner、route、skill、evidence、authority 全由服务端重载。
4. `artifact_published != work_product_confirmation_pending != confirmation_receipt != automatic_reply_archive != external_authorization`。
5. 图表只消费 adopted facts；模型不得写数值真相。
6. 一旨最多一条最终 `REPLY`；史馆只保存 manifest/digest/ref。
7. 本期只用脱敏合成 outcome 验证 append-only 语义，不能回写为运行时当时已知事实，也不能改变 0/22 业务成功计数。
8. 网络、provider、生产数据和外部副作用默认且持续关闭；只允许隔离临时目录中的本地测试数据库/成果写入。
9. 任何解析、权限、引用、digest 或审计失败都失败关闭。
10. 写入步骤串行；只读审查可并行，任何共享路径只允许一个 writer。

状态轴与触发规则：

| 状态轴 | 合法触发 | 允许变化 | 明确不授权 |
| --- | --- | --- | --- |
| 旨意执行 | 服务端已认证 owner + 已批准 route 成功完成 | 终态成功/失败 | 不由前端或模型直接写终态 |
| 史馆回奏 | 旨意执行成功，服务端完成完整性校验 | 自动且幂等地产生唯一 `REPLY` | 不等待人工确认，不因确认再生成或改写 |
| 本地 Artifact 可用性 | 唯一 `REPLY` 已归档且 artifact identity/digest 完整 | `PENDING -> PUBLISHED` 或失败回收；`PUBLISHED` 仅表示 owner-scoped 本地受控下载可用 | 不代表对外发布或人工确认，不授权外部行动 |
| WorkProduct 机器状态 | 确定性门禁 | `NEEDS_DATA/NEEDS_REVIEW/READY_FOR_HUMAN_CONFIRMATION/BLOCKED`，人工确认轴初始为 `PENDING` | artifact 即使 `PUBLISHED` 也不替代人工决定 |
| 人工确认 | 当前 owner 对当前 WorkProduct/digest 追加一次 receipt | `PENDING -> CONFIRMED/REVISION_REQUIRED/ESCALATED` | 不改写 `REPLY`，不触发付款/过账/发布 |
| 合成 outcome | 归档后由测试夹具追加 owner/run/decree/archive 绑定记录 | append-only | 不代表真实业务结果，不晋级 RuntimeSkill |
| 外部行动 | 本期无合法触发 | 始终 `authorized=false` | 付款、过账、通知、发布、生产写入全部禁止 |

## 3. 依赖图

```text
Task 0 治理差距调查与 successor-authority 草案（当前可执行）
  -> 独立用户精确批准 + 独立安全复核 + 新治理任务实现不冲突的 authority（当前未授权）
    -> 新机器权威对不可自授权候选返回 GO
      -> Task 1 closed schema / RED tests（未来另建 Ready 任务）
      -> Task 2 后端确定性投影
          -> Task 3 确认、史馆、outcome
              -> Task 4 类型化 API 投影
                  -> Task 5 前端 closed renderer
                      -> Task 6 浏览器与安全对抗
                          -> Task 7 10 轮验收与 Gitee 收口
```

所有写入步骤串行。Task 2 完成后，可并行进行只读安全审查和前端接口设计审查，但不能并行修改同一工作树。

## 4. 施工包

### Task 0：治理差距调查与 successor-authority 草案

上下文：当前产品逻辑已具备离线可信脊柱，但目标分支缺根级协调 Harness；另一根工作树又有大量未提交改动。直接复制或把聊天确认当成机器授权都会破坏治理。

工作：

- 在新的干净治理 worktree 中调查并提出唯一 integration base，不使用脏根目录内容，也不在本蓝图中自行裁定。
- 对根 `.harness`、前端 `.harness`、后端 `harness`、execution-authority v1 和共享 Git hook 做来源/digest/所有权清单；把脏根 no-BFF 文字只登记为未采信提案，clean `ext-dev` 的同源 BFF 规则继续是当前事实。
- 只起草独立 successor authority 的 schema/manifest/consumer/change 设计：绑定任务 ID、逐文件允许路径、非目标、风险、rollback、独立用户批准和外部 attestation 要求；草案不是批准证据，不能消费本次“开始长任务”的高层确认。版本/名称必须在治理任务中冻结，禁止与现有 root `execution-authority.v2` 的 identity 冲突。
- 只可复用 root v2 中已独立评审的失效关闭设计思路；禁止复制 W06 manifest、ledger 状态、owner receipt、review digest 或 `approvedScope`，禁止把 R0 包 ID 映射为本任务的隐式授权。
- 设计不可自授权链：候选 request 绑定已存在的 immutable parent/tree/pathspec，由仓库外 signer/required check 或等价独立 trust root 签发 post-commit attestation；禁止同一提交中的 manifest/文档同时批准自身，禁止 `HEAD`、分支名或可移动 ref 充当 commit 字段。
- successor authority 的实现、批准、独立安全审查和平台 trust root 配置必须成为后续独立治理任务；v1 保持原样永久 STOP，现有 root v2 保持 R0 语义而不被扩权。

验证：本阶段只验证草案完整性、v1 仍 STOP、根/前端/后端事实清单、攻击模型（错误 parent/tree/owner、扩大 path、过期批准、脏树、自授权提交、移动 ref）和 `git diff --check`；不得把草案 checker 的通过当作产品 GO。

退出条件：当前阶段仅能产出治理差距清单与 successor-authority 草案，状态保持 `Blocked`。只有后续独立任务取得用户对 exact scope 的明确批准、独立审查通过、平台 trust root 就绪且新 consumer 对已签名候选返回 `GO`，才可另建 Ready 产品任务进入 Task 1。

回滚：revert 独立治理提交即可恢复上一版 STOP；不得删除或覆盖根目录用户改动。

### Task 1：冻结 RichMemorialEnvelope v1

上下文：先冻结 closed schema，避免后端、前端和史馆各自发明结构。

未来候选文件（不是当前授权）：`docs/contracts/rich-memorial-envelope.schema.json`、`scripts/rich_memorial_contract.test.mjs`、`backend/app/rich_memorial/models.py`、`backend/tests/test_rich_memorial_models.py`。新 Ready 任务必须逐项批准这些精确路径。

RED：覆盖未知 block、重复 `block_id`、无 `source_refs` 的事实/图表、任意 HTML、URL/path/tool/owner/tenant 字段走私、非规范 digest、超限文本和乱序版本。

GREEN：canonical block enum 只允许 `heading`、`paragraph`、`fact_callout`、`metric`、`table`、`chart`、`risk`、`conflict`、`missing_evidence`、`decision`、`next_action` 和 `artifact_link`，前后端不得使用别名。

字段规则：

| 类型 | 必填字段 | `source_refs` | 展示辅助 |
| --- | --- | --- | --- |
| 所有 block | `block_id`、`type`、`content_digest`、`sensitivity`、`renderer_version` | 字段必须存在 | 不适用字段必须为 `null`，不能省略后由客户端猜测 |
| `heading` / `paragraph` | 上述字段与 text payload | 可为空 | `caption=null`、`alt_text=null` |
| `fact_callout` / `metric` / `table` | 上述字段与各自 closed payload | 至少 1 个 `adopted_fact` 或 `adopted_evidence` ref | `caption` 按 schema 要求，`alt_text=null` |
| `risk` / `conflict` / `missing_evidence` / `decision` / `next_action` | 上述字段与各自 closed payload | 至少 1 个 typed trusted ref，可为 `adopted_fact`、`adopted_evidence`、`run`、`decree`、`authority` 或 `artifact`；`missing_evidence` 还必须绑定未满足 fact key | `caption` 按 schema 要求，`alt_text=null` |
| `chart` | 上述字段与 `ChartSpec v1` | 至少 1 个 adopted fact ref | 非空 `caption` 与 `alt_text` |
| `artifact_link` | 上述字段与 opaque artifact ref | 至少 1 个 WorkProduct/artifact ref | 非空 `caption`，`alt_text=null` |

`ChartSpec v1` 冻结 `schema_version`、chart kind、series、dimension keys、unit、timezone、rounding mode 和 adopted fact refs；数值使用十进制定点字符串，时区为 UTC，舍入为 half-even。`content_digest` 是 RFC 8785 canonical JSON 的 UTF-8 SHA-256。历史读取必须保留 versioned schema decoder/renderer，不能只存 renderer version 后用最新代码重新解释旧块。

新增 tracked canonicalization vectors，覆盖 Unicode composed/decomposed 原始 code points、对象键排序、数组顺序、显式 `null`、十进制定点、UTC 时间和空/多字节字符串；RFC 8785 路径禁止实现层自行做 NFC/NFD 归一化，向量必须证明原 code points 被保留且规范字符串不同时 digest 也不同。Node 与 Python 分别读取同一向量并独立算出每项固定 SHA-256；只做 schema 校验或单语言 round-trip 不算 digest 一致性证据。

验证：Node JSON Schema contract、Python Pydantic round-trip、Node/Python 交叉 canonical digest vectors、旧 text-only fixture 和攻击用例。

回滚：schema v1 尚未对外启用时可整体 revert；一旦史馆保存 v1，只能新增版本，不能原地改义。

### Task 2：户部确定性富奏折投影

上下文：复用 `resolve_six_ministry_decision`、Accounting WorkProduct 和 adopted evidence；新模块只投影，不持有事实。

未来候选文件（不是当前授权）：`backend/app/rich_memorial/__init__.py`、`backend/app/rich_memorial/compiler.py`、`backend/app/rich_memorial/models.py`、`backend/app/agents/runtime_skills/six_ministry_evidence_service.py`、`backend/tests/test_rich_memorial_compiler.py`、`backend/tests/test_rich_memorial_models.py`。若只读调用链勘察证明还需其他文件，必须先更新新 Ready 任务和 successor-authority pathspec，不能用通配扩权。

RED：模型文本中的假金额不能进入 metric；缺证/冲突/过期必须成为 `missing_evidence` 或 `conflict`；同输入必须生成同 manifest digest；跨 owner 和不同 run 必须拒绝；rich schema/digest 故障不得吞掉核心 text-only 回奏，也不得保存部分 blocks 或在重试时生成第二条 `REPLY`。

GREEN：实现 deterministic `RichMemorialCompiler`，从受信 accounting evaluation 生成 summary、metric、table、ChartSpec、risk、decision、next action 与 Excel artifact link；不生成图片、不访问网络、不写外部系统。rich compiler/schema/digest 失败时丢弃全部 rich blocks，核心成功旨意仍自动归档 text-only `REPLY`，返回/审计稳定 `rich_projection_status=DEGRADED` 与 `RICH_PROJECTION_INVALID`，同一 idempotency key 重放同一 `REPLY`，不得事后静默回填历史 rich 内容。身份、路由、Evidence 或 archive 完整性失败继续沿用既有核心失败语义并在归档前终止。

验证：确定性快照、属性测试、owner/run/decree 绑定、无网络/无 provider 探针、同输入同 digest、输入改变 digest 改变，以及 rich-only 降级仍恰好一条 text-only `REPLY` 的幂等重试测试。

回滚：投影器位于独立模块，API 未接线前可 revert；不修改原始会计成果和 Evidence。

### Task 3：自动史馆归档、独立成果确认与合成 outcome

上下文：现有 WorkProduct/Confirmation 已把机器状态和人工决策分离；史馆只收最终档案。Rich manifest 是该唯一 `REPLY` 的官方不可变展示快照，不是另一套可变事实库。

未来候选文件（不是当前授权）：`backend/app/shiguan/models.py`、`backend/app/shiguan/storage.py`、`backend/app/shiguan/migration.py`、`backend/app/shiguan/archive_decree.py`、`backend/app/accounting_reports/storage.py`、`backend/tests/test_shiguan_models.py`、`backend/tests/test_shiguan_storage.py`、`backend/tests/test_shiguan_archive_decree.py`、`backend/tests/test_accounting_work_product_storage.py`。先做只读 schema/call-site 勘察；不需要修改的文件必须从最终 pathspec 删除。

RED：成功旨意因未确认而不归档、确认生成第二条 REPLY 或改写原 REPLY、旧 receipt 重放、manifest 篡改、跨 owner recall、outcome 更新/删除、outcome 反向改变历史结论均失败。

GREEN：旨意成功时服务端重载当前 rich manifest/digest 并原子写入唯一 REPLY 与 refs；快照保存足以重放的 text fallback、closed block payload、引用类型/摘要/时间和 artifact 元数据/digest，但不复制 artifact 二进制或外部源正文。成果确认另行重载 WorkProduct 并追加 receipt，不阻塞也不改写 REPLY；本期 outcome 只使用脱敏合成 fixture，在独立 append-only 记录中绑定 archive/run/decree，不授予任何外部动作、自动晋级或业务成功计数。

历史可用性语义：跨 owner 查询继续返回不泄露存在性的 404；同 owner 的 artifact/evidence ref 后续不可读时，archive 仍以 200 重放已存 text/block 快照，并把该 ref 标为 `UNAVAILABLE`，显示原 digest/as-of 与“来源当前不可用”，不重新推导事实；已存 manifest/block digest 校验不一致时返回脱敏 500 `ARCHIVE_INTEGRITY_FAILED`，绝不渲染未验证内容。

验证：事务/幂等/崩溃恢复、唯一约束、跨 owner、ref 删除/权限变化、same-owner 降级重放、digest 腐坏、versioned renderer 和不可变负测。

回滚：保持旧 `REPLY` 读取兼容。若只读勘察证明必须新增表/字段，新 Ready 任务必须把精确 migration 文件、升级/降级策略和备份验证逐项列入授权；回滚代码不删除历史数据。

### Task 4：严格 API 投影

上下文：OpenAPI/Pydantic 是跨语言事实源，前端不能维护第二套宽松真相。

未来候选文件（不是当前授权）：`backend/app/api/decrees.py`、`backend/app/api/report_artifacts.py`、`backend/app/api/shiguan.py`、`backend/tests/test_decrees_api.py`、`backend/tests/test_report_artifacts_api.py`、`backend/tests/test_shiguan_api.py`。前端继续遵循 clean `ext-dev` 的既有同源 BFF；如需修改现有 Route Handler 或 transport，必须在新 Ready 任务中逐文件列出并重新批准，不得用通配扩权。

工作：

- 在既有旨意/成果/史馆接口上增加可选 rich manifest projection，不新增业务入口。
- 请求端不接受 owner、tenant、authority、URL、path、HTML 或 tool 字段。
- 冻结稳定错误：未认证、越权、未确认、digest 冲突、schema 不支持、archive 不存在和内部失败。

验证：OpenAPI snapshot、exact-key parser、401/403/404/409/422/500、跨 owner 与错误脱敏。

回滚：可关闭可选投影并保留 text-only；不得留下前端伪造 fallback。

### Task 5：上书房与史馆 closed renderer

上下文：前端只渲染服务端已验证的 blocks；老回奏继续沿用现有显示。

未来候选文件（不是当前授权）：新建 `frontend/src/features/study-visual/RichMemorialRenderer.tsx` 与同名测试、`frontend/src/features/study-visual/DevStudyWorkspace.tsx`、新建 `frontend/src/features/shiguan-visual/RichMemorialArchive.tsx` 与同名测试、`frontend/src/features/shiguan-visual/ShiguanArchiveDetail.tsx`、`frontend/src/lib/backendClient.ts` 和 `frontend/src/lib/backendClient.test.ts`。只读设计后必须在新 Ready 任务中逐文件收紧。

RED：未知 block、恶意文本、重复 ID、缺 alt/caption、跨 archive stale response、确认竞态和移动端溢出。

GREEN：实现 closed renderer、确定性 ChartSpec renderer、来源抽屉、风险/缺证显著标签、打印样式和键盘/屏幕阅读器语义；不使用 `dangerouslySetInnerHTML`，不加载远程图片。

验证：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`，以及组件可访问性/竞态测试。

回滚：feature projection 为空时自动使用现有 text-only；不得用 mock 状态宣称 LIVE。

### Task 6：真实浏览器与安全对抗

上下文：后端 dry-run 不能证明用户体验，组件测试也不能证明跨端身份和归档。

场景：登录、下旨、轮询、富奏折、确认、史馆召回；另测另一 owner、刷新/重放、重复提交、超时、后端失败、空数据、移动端和键盘。

安全攻击：XSS、SSRF、路径穿越、恶意协议、巨型 payload、字段走私、manifest/digest 篡改、陈旧 receipt、越权 artifact、日志凭据扫描和外部副作用探针。

验证：由 `playwright` 驱动本地真实 Next + FastAPI；后端使用脱敏合成数据和 fake provider。正式环境必须由独立于应用/runner 的 CI 或宿主级 network namespace、firewall 或受管 sandbox 强制 egress-deny，只允许 loopback，并记录策略身份、规则摘要 digest 与验证退出码；仅由 wrapper 声称未观察到外连不算证明。平台无法提供该 trust boundary 时标记 `UNVERIFIED`，产品不得 PASS。截图只证明视觉，数据库/API/ledger 证明后端事实。

退出条件：所有正向/负向场景 PASS；浏览器、API、数据库和审计证据绑定同一 candidate SHA 与 build identity。

### Task 7：独立复核、10 轮与 Gitee 收口

正式命令矩阵必须在 Task 6 结束后冻结到新的 tracked baseline 文件，记录命令、cwd、超时、expected exit、精确测试计数和证据字段。Linux 从仓库根执行 `export CHAOTANG_ACCEPTANCE_PYTHON="$PWD/backend/.venv/bin/python"`，Windows 指向本工作树 `backend/.venv/Scripts/python.exe`；`test -x "$CHAOTANG_ACCEPTANCE_PYTHON"` 失败即 STOP，不能借用相邻 worktree 的环境。

preflight 必须记录 `"$CHAOTANG_ACCEPTANCE_PYTHON" --version`、`node --version`、`npm --version`、`sha256sum backend/pyproject.toml frontend/package-lock.json`、candidate commit/tree、`git status --porcelain=v1` 和 successor attestation verify 命令/退出码。工作树有非白名单改动、lock hash 漂移或 successor authority 验证失败时不得开始轮次。

| 范围 | 冻结命令 | 预期 |
| --- | --- | --- |
| 后端静态 | `cd backend && "$CHAOTANG_ACCEPTANCE_PYTHON" -m ruff check --no-cache .`、`"$CHAOTANG_ACCEPTANCE_PYTHON" -m compileall -q app tests` | exit 0 |
| 后端全量 | `cd backend && "$CHAOTANG_ACCEPTANCE_PYTHON" -u -m pytest -p no:cacheprovider -o faulthandler_timeout=30 -q` | exit 0；精确 passed/skipped 计数等于 Task 6 冻结值且不低于预备基线 4006/4 |
| 前端 | `cd frontend && npm run lint && npm run typecheck && npm test && npm run build` | 每项 exit 0；精确测试/页面计数等于 Task 6 冻结值 |
| Integration | `node scripts/verify_integration.mjs`、`node --test scripts/verify_integration.test.mjs` | exit 0，精确断言计数冻结 |
| Migration | `node --test scripts/check_migration_completeness.test.mjs`、`node scripts/check_migration_completeness.mjs` | exit 0，精确条目数冻结 |
| Harness | `node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`、`node .agents/hooks/check-harness.mjs --self-test`、`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test` | exit 0；预备基线 133/167/3/25 只能增长或经独立解释更新 |
| 浏览器/安全 | 未来 tracked `node scripts/run_hubu_rich_memorial_browser_acceptance.mjs` 及其 self-test | exact candidate/build；正反例计数冻结；本地 synthetic 服务全部回收 |
| 差异 | `git diff --check --`、`git diff --cached --check --`、candidate fingerprint before/after | exit 0，指纹完全一致 |

每轮由未来 tracked browser/acceptance wrapper 使用 `mktemp -d` 创建唯一 evidence/runtime 根，向服务传入显式路径，不使用仓库 `var/` 或相邻工作树状态；wrapper 必须申请 OS 临时端口、拒绝保护端口、登记所有子进程，并在结束后断言端口无监听者、子进程均退出、临时数据库只位于该根。

开始前必须逐项显式清除以下 provider/observability 环境变量：

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `LANGCHAIN_API_KEY`
- `LANGSMITH_API_KEY`
- `LANGCHAIN_TRACING_V2`
- `LANGSMITH_TRACING`
- `DEEPSEEK_API_KEY`
- `JINYIWEI_EXTERNAL_NETWORK_ENABLED`

独立宿主/CI egress-deny 必须只允许 loopback，side-effect probe 另证明无生产连接串、无外部 adapter 调用。wrapper 的伪网络调用只验证应用护栏 fail-closed，不能替代宿主网络策略。tracked self-test 还必须注入端口占用、残留进程和清理失败。单条命令上限 30 分钟，单轮上限 40 分钟，10 轮总预算 6 小时；超时、残留进程、端口泄漏或无法回收临时状态均计 FAIL。

原始证据写入忽略目录 `.superpowers/sdd/hubu-rich-memorial-final/<candidate-fingerprint>/round-01..10/`，每轮 JSON 必含 candidate commit/tree/fingerprint、frontend BUILD_ID、工具版本、lockfile hash、命令、cwd、临时目录路径 hash、实际端口、环境变量名及值的 hash（不得存 secret）、start/end、exit code、passed/skipped 计数、进程/端口/egress 清理结果和 artifact/manifest digest。缺一字段整轮无效。

10 轮结束后不能修改已验证候选 C。另建只含受管摘要的证据包装提交 A（父提交精确为 C），在任务 Implementation Report 分栏记录“被测候选 C”和“证据包装 A”，并记录 C 的 10 个 round JSON SHA-256、聚合摘要、命令计数和原始 ignored 证据路径；A 只能证明父提交 C，不得自称自身已跑 10 轮或授予 C 权限。推送后同时用 `git ls-remote` 和对象父链核对 A/C；若任何产品/配置文件在 C 后变化，必须形成新候选并从第 1 轮重跑。

工作：

- Standards/Spec/Security 三轨独立只读复核；P0/P1 必须为 0，P2 要么修复要么显式接受并记录。
- 冻结 candidate tree、tracked/untracked candidate fingerprint、前端 BUILD_ID 和命令矩阵。
- 每轮运行后端 Ruff/full pytest/compileall、前端 lint/typecheck/test/build、integration、migration、Harness/self-tests、专项安全/浏览器/无副作用检查与 diff check。
- 同一候选连续 10 轮；失败或实质变化后归零。
- 只 stage 白名单文件，运行冲突标记/凭据泄露/暂存区 whitespace 检查；非强推上传 Gitee，并用 `git ls-remote` 核对 exact SHA。

验收包：逐条 Acceptance Criteria、命令/退出码/计数、10 轮日志索引、浏览器证据、远端 SHA、未验证范围、回滚方式、评分和最终 `PASS / CONDITIONAL PASS / FAIL`。

## 5. 计划变更协议

- 拆分：某 Task 超过一个可独立回滚纵切时拆分，不扩大原允许路径。
- 插入：只允许为已观察失败增加根因修复或安全门；必须更新依赖图和验收命令。
- 跳过：只有证明该能力已由当前 exact candidate 满足并有新鲜证据时允许；不能用历史报告代替。
- 终止：权威回到 STOP、发现生产数据/凭据、无法隔离并行 writer、或需要外部副作用时立即终止产品施工并保留证据。
- 重新批准：ADR、事实源、身份模型、archive 语义、允许路径或外部状态范围变化时，必须重新获得用户和机器权威批准。

## 6. 明日上午验收口径

如果机器权威仍为 STOP，合格交付只能是：Gitee 同步、主流程验收精华吸收、治理差距清单、successor-authority 设计草案和本蓝图，结论必须是 `CONDITIONAL PASS`，不得称产品闭环完成。

只有未来 successor implementation task 获得与本任务 exact scope 绑定的独立权威后，完整满足其 Task 1–7、真实浏览器和同一候选 10/10 连续全绿，才允许对“户部黄金旨意与富奏折闭环”给出 `PASS`；本蓝图自身永远不能把当前 `Blocked` 提升为产品 PASS。
