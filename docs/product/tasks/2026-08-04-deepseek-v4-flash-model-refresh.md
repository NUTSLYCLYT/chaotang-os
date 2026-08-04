# 任务：DeepSeek v4 Flash 模型刷新

> 本任务已阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；本次模型配置与超时验收不改变该业务流。

> **CURRENT AUTHORITATIVE RESULT:** `d9c5ddad6d9fe2132d06effee9a10bff6d71d2327db0823ffd0447d4d6f0a587`; 10/10 consecutive rounds; frontend 82/82; backend 81/81; 120/120 commands exit 0. Only the “Final Acceptance Reset — authoritative 10-file sequence” section is countable. Every earlier `0f1b9a…` / frontend-81 section is **HISTORICAL, SUPERSEDED, INVALID, count zero**.

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-08-04 明确选择 `deepseek-v4-flash`，确认充值后的真实 UI 复验，并授权本任务执行只读 `/models` 可用性探针与十轮离线/只读最终验收。
- 问题：旧模型目录漂移与拟旨客户端超时曾使本地测试出现假绿，必须证明最终配置、客户端契约、后端路由和真实模型目录在同一版本上稳定一致。
- 目标用户：通过 `/study` 使用丞相拟旨的已认证用户。
- 目标：默认模型固定为 `openai/deepseek-v4-flash`，拟旨客户端采用获批超时，相关回归、静态检查、harness、健康/路由和模型目录连续十轮通过，并引用既有真实 UI 成功证据。
- 非目标：不改变 ADR 0028 业务流；不增加模型回退；不重复付费生成；不提交 UI 草稿；不提交、推送、部署或重启服务。

## Acceptance Criteria

- [x] 默认模型和声明模型与获批 DeepSeek v4 目录一致。
- [x] 拟旨客户端默认超时为 120 秒且保留自定义超时覆盖。
- [x] 同一实现指纹完成 10 轮连续完整验收，任一轮全部 12 项退出码为 0。
- [x] 健康值为 `ok`，OpenAPI 包含 `POST /api/v1/chancellor-drafts`，规范化默认模型每轮均存在于供应商 `/models` 响应。
- [x] 已有独立真实 UI 证据显示后端 HTTP 200、一个可见拟旨结果、零错误节点；本任务不重复付费调用。

## Delivery Constraints

- 范围：本任务允许修改 `backend/config/providers.yaml`、`backend/tests/test_deepseek_config.py`、`docs/superpowers/specs/2026-08-04-deepseek-v4-flash-model-refresh-design.md`、`docs/superpowers/plans/2026-08-04-deepseek-v4-flash-model-refresh.md`、本任务文件和 `docs/failures/2026-08-04-deepseek-model-availability-drift.md`。已获批的前端超时修复来自独立任务，本任务只读验收其源码与测试，不扩大写入范围。
- 兼容性：保留现有 DeepSeek 客户端、`openai/` 规范化、拟旨图和 HTTP 契约。
- 风险与限制：工作树包含大量无关改动；本验收只声明列出的 DeepSeek/超时交付物与精确命令，不声明整个脏工作树已验证。`/models` 只能证明目录可用性，真实生成成功另由既有 UI 证据证明。
- 技能计划：`using-superpowers`、`codex-engineering-workflow`、`verification-before-completion`。
- Codex-only：是；未调用 Claude CLI、Claude runner 或 gstack-claude。

## Affected Modules

- 模块：DeepSeek 供应商配置、配置契约测试、拟旨前端客户端超时、产品/失败证据。
- 允许路径：见 Delivery Constraints；本轮仓库实际写入仅本任务文件。
- 依赖模块：现有 FastAPI 健康/OpenAPI、DeepSeek 配置/密钥解析、OpenAI-compatible `/models`、前端 `backendClient`。

## Technical Plan

- 架构边界：只更新供应商配置及其契约；复用现有客户端规范化；前端专用超时不改变后端契约或 ADR 0028。
- 接口与依赖：`load_deepseek_provider_config()`、`normalize_deepseek_model_name()`、`GET /health`、`GET /openapi.json`、供应商 `GET /models`。
- 实施顺序：配置 RED→GREEN；记录失败记忆；完成独立真实 UI 验证；冻结交付指纹；执行十轮完整验收；写入证据。
- 验证计划：下列 12 项构成不可拆分的一轮，连续执行十轮；失败或指纹变化归零。
- 技术风险：供应商目录可随时间变化；模型可列出不等于账户未来持续具备生成额度。

## Implementation Report

- 改动摘要：默认模型为 `openai/deepseek-v4-flash`，声明模型为 Flash/Pro；拟旨默认超时为 120 秒；失败记忆、设计和计划已记录边界。
- 自审：确认未输出密钥、session ID、原始提示词或生成内容；未重复生成、未提交草稿、未重启、未暂存或提交。
- 实际使用的 skill：`using-superpowers`、`codex-engineering-workflow`、`verification-before-completion`。
- 未运行项与原因：未重复真实拟旨生成，因为 Task 3 已有一次独立审查后的成功证据，且本任务明确禁止重复付费调用。
- 剩余风险：`git diff --check` 每轮仅有既有 LF→CRLF 工作副本警告，无空白错误；供应商未来目录/额度变化仍需新的授权证据。

### 完整验收命令（每轮顺序完全相同）

```powershell
backend\.venv\Scripts\python.exe -m pytest -q backend\tests\test_deepseek_config.py backend\tests\test_deepseek_client.py backend\tests\test_chancellor_drafts_api.py backend\tests\test_chancellor_draft_graph.py backend\tests\test_chancellor_draft_instructions_loader.py backend\tests\test_chancellor_draft_authority.py backend\tests\test_decree_draft_gate.py
Set-Location frontend; node --test src/lib/backendClient.test.ts; Set-Location ..
Set-Location frontend; npm.cmd run typecheck; Set-Location ..
Set-Location frontend; npm.cmd run lint; Set-Location ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
backend\.venv\Scripts\python.exe -c "import json,urllib.request; d=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=10)); assert d.get('status')=='ok',d; print('health_status=ok')"
backend\.venv\Scripts\python.exe -c "import json,urllib.request; d=json.load(urllib.request.urlopen('http://127.0.0.1:8000/openapi.json',timeout=10)); p='/api/v1/chancellor-drafts'; assert p in d.get('paths',{}),p; assert 'post' in d['paths'][p]; print('draft_route_present=true')"
Set-Location backend; .\.venv\Scripts\python.exe -c "from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config; from app.langgraph_runtime.deepseek_client import normalize_deepseek_model_name; from app.langgraph_runtime.deepseek_env import resolve_deepseek_api_key_with_dotenv_fallback; from openai import OpenAI; cfg=load_deepseek_provider_config(); model=normalize_deepseek_model_name(cfg.default_model); key=resolve_deepseek_api_key_with_dotenv_fallback(cfg); ids={item.id for item in OpenAI(base_url=cfg.base_url,api_key=key,max_retries=0,timeout=30.0).models.list().data}; assert model in ids; print(f'advertised_model_count={len(ids)}'); print(f'configured_model_available={str(model in ids).lower()}')"; Set-Location ..
```

模型探针只调用 `/models`，密钥仅在进程内解析，从未输出；未调用 Chat Completions。

### HISTORICAL / SUPERSEDED / INVALID 指纹 — count zero

> 本节及其后续旧十轮、旧 Acceptance Review、旧七文件审计仅保留历史审计用途；不得作为当前验收证据，正式计数为零。

- SHA-256 聚合指纹：`0f1b9a314571545c8f5ed2acf17018e9a783116026c8f93603efa6b1cdefa19b`
- 覆盖：`backend/config/providers.yaml`、`backend/tests/test_deepseek_config.py`、`frontend/src/lib/backendClient.ts`、`frontend/src/lib/backendClient.test.ts`、设计、计划、失败记忆。
- 本任务文档与 `.superpowers/sdd/deepseek-v4-flash-task-4-report.md` 是验收完成后写入的证据载体，不属于可执行交付物指纹。

### HISTORICAL / SUPERSEDED / INVALID 十轮记录 — count zero

每轮均为：后端 **81 passed / 0 failed**（另有 1 个第三方 warning）；前端 `backendClient` **81 passed / 0 failed**；12 项退出码依次全部为 `0`；`health_status=ok`；`draft_route_present=true`；`advertised_model_count=2`；`configured_model_available=true`；指纹均为上述 SHA-256。

| 轮次 | UTC 开始时间 | 连续计数 | 后端耗时摘要 | 整轮耗时 | 结果 |
| ---: | --- | ---: | --- | ---: | --- |
| 1 | 2026-08-04T09:34:07.5231401Z | 1 | 81 passed, 1 warning in 5.99s | 32.788s | PASS |
| 2 | 2026-08-04T09:34:40.5129627Z | 2 | 81 passed, 1 warning in 5.83s | 33.897s | PASS |
| 3 | 2026-08-04T09:35:14.4786818Z | 3 | 81 passed, 1 warning in 6.14s | 34.222s | PASS |
| 4 | 2026-08-04T09:35:48.7300873Z | 4 | 81 passed, 1 warning in 7.22s | 35.017s | PASS |
| 5 | 2026-08-04T09:36:23.7806585Z | 5 | 81 passed, 1 warning in 4.84s | 29.721s | PASS |
| 6 | 2026-08-04T09:36:53.5272040Z | 6 | 81 passed, 1 warning in 5.10s | 35.075s | PASS |
| 7 | 2026-08-04T09:37:28.6337564Z | 7 | 81 passed, 1 warning in 4.23s | 27.470s | PASS |
| 8 | 2026-08-04T09:37:56.1292480Z | 8 | 81 passed, 1 warning in 4.09s | 24.834s | PASS |
| 9 | 2026-08-04T09:38:20.9845534Z | 9 | 81 passed, 1 warning in 4.89s | 23.490s | PASS |
| 10 | 2026-08-04T09:38:44.4938777Z | 10 | 81 passed, 1 warning in 3.94s | 22.016s | PASS |

## Acceptance Review

> **HISTORICAL / SUPERSEDED / INVALID — count zero.** 本节是旧 `0f1b9a…` / frontend-81 验收回顾；当前权威验收见后文 `d9c5…` / frontend-82 重置序列。

- 历史验收结果：**SUPERSEDED / INVALID；count zero**（旧文本曾记录 Passed，但已被实质测试/工作流变化废止）。
- 历史验收证据：旧同一指纹曾记录 10 轮、每轮 12/12 命令退出 0、后端 81/81、前端 81/81；这些轮次当前不可计数。Task 3 的独立真实 UI 成功证据仍有效，但当前正式验收只由后文 `d9c5…` / frontend-82 重置序列计数。
- 当前用途：仅作历史审计，不表达当前通过状态。

### HISTORICAL / SUPERSEDED / INVALID 七文件指纹审计复现附录 — count zero

以下七个文件和值仅复现已废止的历史版本；该聚合与轮次 **INVALID，count zero**：

| 顺序 | 文件 | SHA-256 |
| ---: | --- | --- |
| 1 | `backend/config/providers.yaml` | `82614f8a05931ec1dd10ed62cdb1a98396e08c1971ff483f3dd9559849ff4a1e` |
| 2 | `backend/tests/test_deepseek_config.py` | `2725daa6909c21010773ac20b0006bff049bacc04a110926b25ee6c708531f92` |
| 3 | `frontend/src/lib/backendClient.ts` | `7d9049bd6a780ce7beaf0ed81641794c0d3d056ee8a928ac698f41a8519115d1` |
| 4 | `frontend/src/lib/backendClient.test.ts` | `c1dcb1358d662a74a12a957ec1f71f10e9f9573d4d955eef92a31e391e5178d9` |
| 5 | `docs/superpowers/specs/2026-08-04-deepseek-v4-flash-model-refresh-design.md` | `8961bb7ca6cbb433838efc151af74727fbad003c8e574b3cabb07c0cbb14173b` |
| 6 | `docs/superpowers/plans/2026-08-04-deepseek-v4-flash-model-refresh.md` | `2b2bd233207530454d2b35b706b7a67a954be928d6f42d97bd598bb1c8800501` |
| 7 | `docs/failures/2026-08-04-deepseek-model-availability-drift.md` | `1815c52783dc08e16e95078169b61a52b85d798805b206226921f284499c07c0` |

聚合输入逐字节定义为：每行是相对路径、一个 ASCII TAB (`0x09`) 和对应小写十六进制文件哈希；七行严格按表中顺序排列，以单个 LF (`0x0a`) 连接，最后一行末尾没有 LF；整段文本使用 UTF-8 无 BOM 编码。该 802 字节输入再做 SHA-256，得到接受聚合值 `0f1b9a314571545c8f5ed2acf17018e9a783116026c8f93603efa6b1cdefa19b`。

可执行复现命令：

```powershell
$ErrorActionPreference = 'Stop'
$paths = @(
  'backend/config/providers.yaml',
  'backend/tests/test_deepseek_config.py',
  'frontend/src/lib/backendClient.ts',
  'frontend/src/lib/backendClient.test.ts',
  'docs/superpowers/specs/2026-08-04-deepseek-v4-flash-model-refresh-design.md',
  'docs/superpowers/plans/2026-08-04-deepseek-v4-flash-model-refresh.md',
  'docs/failures/2026-08-04-deepseek-model-availability-drift.md'
)
$lines = foreach ($path in $paths) {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
  "$path`t$hash"
}
$payload = $lines -join "`n"
$bytes = [Text.UTF8Encoding]::new($false).GetBytes($payload)
$sha = [Security.Cryptography.SHA256]::Create()
try {
  $aggregate = -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
} finally {
  $sha.Dispose()
}
$lines
"PAYLOAD_BYTE_COUNT=$($bytes.Length)"
"PAYLOAD_ENDS_WITH_LF=$($bytes[-1] -eq 10)"
"AGGREGATE=$aggregate"
if ($aggregate -ne '0f1b9a314571545c8f5ed2acf17018e9a783116026c8f93603efa6b1cdefa19b') {
  throw 'Accepted aggregate did not reproduce'
}
```

## Final Acceptance Reset — authoritative 10-file sequence

The earlier seven-file fingerprint `0f1b9a314571545c8f5ed2acf17018e9a783116026c8f93603efa6b1cdefa19b` and all ten rounds recorded against it are **superseded, invalid, and count as zero**. A new frontend override test changed the test set from 81 to 82, and review required the three executed harness scripts to enter the immutable fingerprint. Both are material test/workflow changes, so formal counting restarted at round 1.

The exact 12-command acceptance sequence above was then run ten consecutive times without modification. Before round 1 and before/after every round, the following ordered ten-file fingerprint was recomputed. Every observation returned `d9c5ddad6d9fe2132d06effee9a10bff6d71d2327db0823ffd0447d4d6f0a587`.

| Order | File | Accepted file SHA-256 |
| ---: | --- | --- |
| 1 | `backend/config/providers.yaml` | `82614f8a05931ec1dd10ed62cdb1a98396e08c1971ff483f3dd9559849ff4a1e` |
| 2 | `backend/tests/test_deepseek_config.py` | `2725daa6909c21010773ac20b0006bff049bacc04a110926b25ee6c708531f92` |
| 3 | `frontend/src/lib/backendClient.ts` | `7d9049bd6a780ce7beaf0ed81641794c0d3d056ee8a928ac698f41a8519115d1` |
| 4 | `frontend/src/lib/backendClient.test.ts` | `780a9ea2eb9c4a1268fe32b508501370ab6f5b4d46c00507b9bbd80deadde908` |
| 5 | `docs/superpowers/specs/2026-08-04-deepseek-v4-flash-model-refresh-design.md` | `8961bb7ca6cbb433838efc151af74727fbad003c8e574b3cabb07c0cbb14173b` |
| 6 | `docs/superpowers/plans/2026-08-04-deepseek-v4-flash-model-refresh.md` | `2b2bd233207530454d2b35b706b7a67a954be928d6f42d97bd598bb1c8800501` |
| 7 | `docs/failures/2026-08-04-deepseek-model-availability-drift.md` | `1815c52783dc08e16e95078169b61a52b85d798805b206226921f284499c07c0` |
| 8 | `scripts/check_harness.mjs` | `455a7d826bc428554742418dbf9ca018d8dc5add6afa8a6aef47df6aeab71296` |
| 9 | `.agents/hooks/check-harness.mjs` | `90996f95f1eada0b27d6bbc28210b085b7ae588d07e4b967b767b3c003e26f89` |
| 10 | `.agents/skills/product-flow/scripts/run-claude-delivery.mjs` | `66a534a58388e273232625557a604ac0ebd992cb6879ce86a206e02bddb5f0e0` |

The byte algorithm is unchanged: each line is relative path + ASCII TAB (`0x09`) + lowercase file SHA-256, lines are joined in the listed order by one LF (`0x0a`), there is no trailing LF, and the text is encoded as UTF-8 without BOM. SHA-256 of that exact 1,115-byte payload is the final aggregate above.

```powershell
$ErrorActionPreference = 'Stop'
$paths = @(
  'backend/config/providers.yaml',
  'backend/tests/test_deepseek_config.py',
  'frontend/src/lib/backendClient.ts',
  'frontend/src/lib/backendClient.test.ts',
  'docs/superpowers/specs/2026-08-04-deepseek-v4-flash-model-refresh-design.md',
  'docs/superpowers/plans/2026-08-04-deepseek-v4-flash-model-refresh.md',
  'docs/failures/2026-08-04-deepseek-model-availability-drift.md',
  'scripts/check_harness.mjs',
  '.agents/hooks/check-harness.mjs',
  '.agents/skills/product-flow/scripts/run-claude-delivery.mjs'
)
$lines = foreach ($path in $paths) {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
  "$path`t$hash"
}
$bytes = [Text.UTF8Encoding]::new($false).GetBytes(($lines -join "`n"))
$sha = [Security.Cryptography.SHA256]::Create()
try { $aggregate = -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) }
finally { $sha.Dispose() }
"PAYLOAD_BYTE_COUNT=$($bytes.Length)"
"PAYLOAD_ENDS_WITH_LF=$($bytes[-1] -eq 10)"
"AGGREGATE=$aggregate"
if ($aggregate -ne 'd9c5ddad6d9fe2132d06effee9a10bff6d71d2327db0823ffd0447d4d6f0a587') {
  throw 'Accepted aggregate did not reproduce'
}
```

### Authoritative reset round record

Every row has the same fingerprint, all 12 command exit codes equal to 0, backend 81 passed / 0 failed / 1 third-party warning, frontend 82 tests / 82 passed / 0 failed, health `ok`, POST draft route present, two advertised provider models, and configured model available.

| Round | UTC start | Consecutive count | Backend summary | Frontend summary | Elapsed | Result |
| ---: | --- | ---: | --- | --- | ---: | --- |
| 1 | 2026-08-04T09:53:15.2575925Z | 1 | 81 passed, 1 warning in 9.84s | 82/82, 0 failed | 38.526s | PASS |
| 2 | 2026-08-04T09:53:54.0685714Z | 2 | 81 passed, 1 warning in 8.51s | 82/82, 0 failed | 35.132s | PASS |
| 3 | 2026-08-04T09:54:29.2624856Z | 3 | 81 passed, 1 warning in 5.63s | 82/82, 0 failed | 33.368s | PASS |
| 4 | 2026-08-04T09:55:02.6744566Z | 4 | 81 passed, 1 warning in 5.25s | 82/82, 0 failed | 34.608s | PASS |
| 5 | 2026-08-04T09:55:37.3257600Z | 5 | 81 passed, 1 warning in 5.96s | 82/82, 0 failed | 33.796s | PASS |
| 6 | 2026-08-04T09:56:11.1688019Z | 6 | 81 passed, 1 warning in 11.46s | 82/82, 0 failed | 43.321s | PASS |
| 7 | 2026-08-04T09:56:54.5431861Z | 7 | 81 passed, 1 warning in 5.61s | 82/82, 0 failed | 32.029s | PASS |
| 8 | 2026-08-04T09:57:26.6217361Z | 8 | 81 passed, 1 warning in 7.30s | 82/82, 0 failed | 33.310s | PASS |
| 9 | 2026-08-04T09:57:59.9702782Z | 9 | 81 passed, 1 warning in 5.02s | 82/82, 0 failed | 32.664s | PASS |
| 10 | 2026-08-04T09:58:32.7148211Z | 10 | 81 passed, 1 warning in 6.69s | 82/82, 0 failed | 33.022s | PASS |

Authoritative totals: **10/10 rounds PASS; 120/120 command executions exit 0; 810 backend tests passed; 820 frontend tests passed; 1,630 test passes total**. No generation or UI call was repeated. The independently reviewed real UI success evidence in Task 3 remains the live-path evidence. Acceptance Review remains **Passed**, based only on this reset sequence plus that prior real evidence.
