# CI 摘要：feat-scene-pack-v1-amendment-20260903

## 当前实现状态

Scene Pack V1 scoped authority 已基于当前 `origin/ext-dev@8282247208f3d79a8158aa7dc3138a49b1b919fb`
重新绑定并放行 `SCENE-PACK-V1` 工作包。本次产品实现已在隔离 worktree
`/tmp/chaotang-scene-pack-v1-828224` 重新生成候选，吸收原候选 commit
`2e937cd3b88c1b117a702d8aed4f6fed4e9809d2` 的产品改动，未 push、未 merge、未 deploy。

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/product-authority.mjs --status` | 0 | `STOP / APPROVAL_NOT_SELECTED` | 证明默认产品总闸未被误用为 GO | 本地命令，2026-09-03 |
| `node scripts/execution-authority-scene-pack-v1.mjs --authorize --work-package SCENE-PACK-V1` | 0 | `GO / APPROVED_SCENE_PACK_V1` | Scene Pack V1 scoped 施工授权 | 本地命令，2026-09-03 |
| `node --test scripts/execution-authority-scene-pack-v1.nodetest.mjs` | 0 | PASS | scoped authority 契约测试 | 本地命令，2026-09-03 |
| `node scripts/check_harness.mjs` | 0 | PASS | 根基线、Scene Pack scoped authority 登记 | 提升只读权限，本地命令，2026-09-03 |
| `node scripts/harness-doctor.mjs --check` | 0 | PASS | 根 harness 结构一致；非授权 READY | 提升只读权限，本地命令，2026-09-03 |
| `python3 -m ruff check app/api/scene_packs.py app/scene_packs tests/test_scene_pack_api.py` | 0 | PASS | 后端 Scene Pack API/model/storage/test 静态检查 | `backend/`，2026-09-03 |
| `python3 -m pytest -q tests/test_scene_pack_api.py tests/test_auth_api.py::test_public_health_and_protected_route_source_contract` | 0 | `9 passed` | Scene Pack API、租户隔离、blocked 缺口、认证公共基线 | `backend/`，2026-09-03 |
| `npm run typecheck` | 0 | PASS | 前端类型契约 | `frontend/`，2026-09-03 |
| `npm run lint` | 0 | PASS | 前端 lint | `frontend/`，2026-09-03 |
| `npm run build` | 0 | PASS | Next production build 与新路由生成 | `frontend/`，2026-09-03 |
| `TMPDIR=/tmp npm test` | 0 | `688 passed` | 前端全量 node:test | 提升只读权限，`frontend/`，2026-09-03 |

## Playwright MCP 验收

未向 `frontend/package.json` 引入 Playwright/Cypress 依赖。原候选 commit
`873240917625bb390948b1547f8d44b8055f11c4` 已按 scoped amendment 使用 Codex Playwright
浏览器工具对本地 Next.js + FastAPI 做真实页面验收；本次基于当前 `origin/ext-dev`
重生成候选后，已重跑 harness、后端 targeted 门禁、前端 typecheck/lint/build 和全量
node:test，未重复启动浏览器验收。

| 路径 | 结果 |
| --- | --- |
| 注册临时测试账号并登录 | PASS，进入 `/dadian` |
| `/dadian` 5 个 Scene Pack 卡片 | PASS，显示 LIVE 注册表、4 个 `real_v1`、1 个 `stubbed` |
| `/scene-pack/single-product-export-diagnosis?demo=1` | PASS，提交后显示裁决、风险、缺失项、下一步、证据 |
| 单品出海结果进入 `/junjichu/scene-board` | PASS，看板显示任务卡并可展开详情 |
| `/scene-pack/contract-cashflow-risk?demo=1` | PASS，提交后显示裁决、风险、缺失项、下一步、证据 |
| 合同风控结果进入 `/junjichu/scene-board` | PASS，看板显示任务卡并可展开详情 |
| 缺关键字段 blocked path | PASS，API 返回 `status=blocked`、`riskGrade=high`、明确 `missingItems` |

## 未验证项

- 未执行真实外部市场、企业、法规或客户核验；所有外部信号仍标记为 `model_inference` 或待核。
- 未执行真实发送邮件、报价、签约、付款、群发或对外发布。
- 后端全量 pytest 未在本次重基座候选上执行；本轮以 Scene Pack targeted pytest 覆盖候选变更。
- Playwright MCP 页面验收未在本次重基座候选上重复执行；原候选同一产品链路验收结果保留为参考证据。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 大殿显示 5 个场景入口 | Playwright MCP + `SceneStrategyPanel` | PASS |
| 点击任一场景不 404 | Next build route table + Playwright 前两场景 | PASS_PARTIAL |
| 前两个真实场景 demo 可提交 | Playwright MCP | PASS |
| 结果含裁决、风险、缺失项、下一步、证据 | API 测试 + Playwright MCP | PASS |
| 结果进入军机处看板并可查看详情 | API 测试 + Playwright MCP | PASS |
| 缺字段返回 blocked，不编造结果 | API 测试 + Playwright MCP | PASS |
| 不破坏现有主链和治理规则 | harness、authority、前后端门禁 | PASS |

## 声明状态

- `IMPLEMENTED_CANDIDATE`：产品实现完成并通过本轮重基座门禁，等待 Owner 确认新候选 commit。
