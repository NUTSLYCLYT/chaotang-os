# 决策 0006：前后端基础框架技术栈选型

## Status

Accepted — 2026-07-16（`## 后端`、`## 前端` 章节已于本次交付前两阶段记录；本次
追加 `## 跨端契约` 章节及其 `### Verification（跨端契约）` 小节，未改动
`## 后端`、`## 前端` 两个既有章节）

## Context

仓库处于重建阶段，`frontend/`、`backend/` 此前均无业务代码，也没有已确定的语言、
框架、包管理器或跨端契约。产品任务
`docs/product/tasks/2026-07-16-bootstrap-frontend-backend-foundations.md` 要求
为前后端分别建立最小、可运行、可测试的工程骨架，并在首次技术选型时记录 ADR、
同步 `ARCHITECTURE.md` 与相关 scoped `AGENTS.md`。

`ARCHITECTURE.md` 允许参考 `dev` 分支的 Next.js/React/TypeScript 前端与
Python/FastAPI 后端作为技术栈参考，但要求建立独立、无业务代码的最小骨架，精确
版本和包管理器需经原型验证后确定。

## Decision

按模块交付顺序分域记录：后端先落地（本次），前端与跨端契约由后续模块追加到本
文件对应章节。

## 后端

- 语言/运行时：Python，`requires-python = ">=3.11"`。
- Web 框架：FastAPI（`>=0.111`，宽松范围）+ uvicorn（`>=0.29`，`[standard]` extra）。
- 目录结构：扁平 `backend/app/` 包（`app/main.py` 挂载 FastAPI 实例与
  `GET /health`；`app/health.py` 定义 Pydantic 响应模型并读取
  `pyproject.toml` 中的 `version` 字段），`backend/tests/` 用 pytest 覆盖。不引入
  `dev` 分支的 `src/` 布局、alembic、cli.py 或多环境 docker-compose；这些超出本次
  范围。
- 打包：`hatchling` 作为 build backend（显式声明 `packages = ["app"]`），配合
  `pip install -e ".[dev]"` 做可编辑安装。
- 静态检查：ruff（`select = ["E", "F", "I", "UP", "B"]`）。
- 测试：pytest，`tool.pytest.ini_options` 设置 `pythonpath = ["."]`，即使未完成
  可编辑安装也能从 `backend/` 目录直接运行。
- `GET /health` 契约：`200 OK`，`application/json`，
  `{"status": "ok", "service": "chaotang-os-backend", "version": "<pyproject.toml 中的 version>"}`。

### 包管理器：选择 pip + venv，放弃 uv 原型

Technical Plan 要求优先原型验证 `uv`（`uv sync`/`uv run`，产出真实 `uv.lock`），
若本机或 CI 任一侧安装失败再退回 pip。本次交付在实际执行验证时遇到环境限制：

- 交付会话中 Bash 工具对“执行类”命令（`pip ...`、`uv ...`、`npm ...`、
  `node <script>`、`python -c ...`、`python -m pip/venv/pytest/ruff/uvicorn ...`
  等）统一触发权限审批门禁，且本会话无法获得人工批准；只有诊断性查询命令
  （`python --version`、`node --version`）和只读/文件操作（`git status`、
  `git diff`、`git log`、`ls`、`mkdir`、`rm`）可以执行。
- 因此本次既未能验证 `uv` 是否已安装或可安装，也未能实际执行 `pip install`、
  `pytest`、`ruff check`、`uvicorn` 启动等命令；这不是「`uv` 安装失败」，而是本次
  交付会话的工具权限限制导致两种方案都无法在会话内被执行验证。
- 在两个都无法当场验证的方案之间，选择 pip + 标准库 `venv`：不需要额外安装任何
  第三方二进制（`uv` 需要单独获取），只依赖已确认可用的系统 Python
  （已验证 `python --version` 输出 `Python 3.14.5`，满足 `>=3.11`），因此是更可能
  在具备完整权限的环境中一次性验证通过的选择；且不提交无法真实生成的锁文件
  （`uv.lock` 或 pip 编译产物），避免编造未经验证的依赖版本。
- 后果：本仓库当前不提交后端依赖锁文件，`pyproject.toml` 中的依赖使用宽松版本
  范围；`backend/AGENTS.md` 记录的是 pip + venv 的 setup/lint/test/run 命令。
- 遗留动作（已完成）：2026-07-16 在具备完整 Bash 权限的环境中实际执行了
  `backend/AGENTS.md` 中的 setup/lint/test/run 命令，`python -m venv .venv`、
  `pip install -e ".[dev]"`、`ruff check .`、`pytest`、
  `uvicorn app.main:app` + `GET /health` 探测全部通过，详见下方 `## Verification`
  章节。是否引入 `uv` 或依赖锁定方案仍是可选的后续优化，非本次阻塞项。

## 前端

- 框架/运行时：Next.js `^16.2.10`（App Router），React `^19.2.7` + react-dom
  `^19.2.7`，TypeScript `^5.9.3`（Technical Plan 要求 `^5`；npm `latest` dist-tag
  已进入 TypeScript 7，但用 `^5.9.3` 的 caret 范围可确保安装/升级都停留在 5.x，
  不会意外跳到 7.x）。
- 目录结构：`frontend/src/app/page.tsx` 为最小入口（Server Component，异步调用
  `fetchHealth()` 并展示健康检查结果），`frontend/src/app/layout.tsx` 为根布局；
  `frontend/src/lib/backendClient.ts` 是唯一对后端发起网络调用的模块，与 UI 完全
  解耦，暴露 `fetchHealth()` / `getBackendBaseUrl()` 两个纯函数式接口。不引入状态
  管理库、UI 组件库、鉴权或路由之外的业务页面；未使用 Tailwind（`create-next-app`
  默认开启，本次显式关闭以保持依赖最小）。
- 包管理器：npm（`npm ci` + 提交 `package-lock.json`）。理由：与后端选型时同样面临
  「单包、无 workspace 需求」的场景，npm 不需要 `corepack enable` 等额外步骤，在
  Windows 开发机与 Ubuntu CI 之间摩擦最小；`package-lock.json` 保证可复现安装。
- 脚手架来源：使用 `npx create-next-app@latest`（`--ts --eslint --app --src-dir
  --use-npm --no-tailwind --empty --disable-git --no-agents-md --skip-install`）
  在仓库外的临时目录生成初始文件后再迁入 `frontend/`，避免在已有 `AGENTS.md`/
  `CLAUDE.md` 的目录中被 CLI 判定为「非空目录」拒绝执行；未采用其 `AGENTS.md` 自动
  生成内容，沿用并扩写本仓库既有的 `frontend/AGENTS.md` 治理文档。
- 跨端调用路径：浏览器 → Next.js 服务端（`page.tsx` 内的异步 Server Component）→
  FastAPI；`backendClient.ts` 中的 `fetch(...)` 使用 `cache: "no-store"`，这既避免
  了 Next.js 数据缓存把某次健康检查结果固化进静态构建产物（`next build` 输出确认
  `/` 路由为 `ƒ`/Dynamic 而非 `○`/Static），也符合「本地开发与 CI 环境中重复运行」
  的验收要求。
- 环境变量：服务端专用 `BACKEND_BASE_URL`（默认 `http://127.0.0.1:8000`，写入
  `frontend/.env.example`），不使用 `NEXT_PUBLIC_` 前缀，避免被打包进浏览器端产物；
  骨架阶段不引入 CORS 配置。
- 失败路径处理：`fetchHealth()` 内部用 `try/catch` + `AbortController` 超时
  （默认 3000ms）包裹网络调用，网络错误、超时、非 200 状态码均返回
  `{ ok: false, error }`，不抛出未捕获异常；页面据此渲染「后端不可用：<error>」。
- 测试：使用 Node 内置 `node:test`（`package.json` 设置 `"type": "module"`
  以消除 CommonJS/ESM 混用警告），不引入 Playwright/浏览器自动化。
  `src/lib/backendClient.test.ts` 覆盖：成功路径（本地 `node:http` stub 返回契约
  响应）、失败路径 ×2（指向未监听端口；指向返回非 200 状态码的 stub）、以及
  `getBackendBaseUrl()` 的环境变量读取逻辑。测试文件对被测模块使用相对路径 + 显式
  `.ts` 扩展名导入（如 `./backendClient.ts`），因为 Node 原生运行 `.ts` 时按标准
  ESM 解析规则处理相对导入，不识别 `tsconfig.json` 中的 `@/*` 路径别名（该别名只在
  Next.js/webpack 的 bundler 解析下可用）；因此在 `tsconfig.json` 中额外开启了
  `allowImportingTsExtensions`（`noEmit` 为 `true` 时允许），否则 `tsc --noEmit`
  会对显式 `.ts` 扩展名报 `TS5097`。
- 未提交依赖锁定之外的额外产物：`npm audit` 报告 2 个 moderate 级别漏洞（详见下方
  `## Verification`），本次未 `npm audit fix --force`，因为该命令可能引入破坏性
  版本升级，超出本次「最小骨架」范围；记录为遗留风险，后续模块或依赖升级时应
  重新评估。

## 跨端契约

- 契约文件位置：`docs/contracts/health.schema.json`（根级，既不属于 `frontend/`
  也不属于 `backend/` 的内部实现边界，符合 `ARCHITECTURE.md` 中「根目录拥有跨线
  约定、共享文档」的既有所有权划分）。文件结构：顶层为 `path`（`/health`）、
  `method`（`GET`）、`successStatus`（`200`）三个明确值，加一个 `responseBody`
  字段，其内容本身是一份完整的 JSON Schema 片段（`type`/`properties`/
  `required`/`additionalProperties`/`enum`/`minLength`），描述成功响应体的字段
  与类型约束。
- 格式选择理由（JSON Schema 片段 vs 手写字段列表 vs OpenAPI 全量比对）：
  - 放弃「手写字段列表」（例如纯文本或简单 key-type 映射）：无法表达
    `additionalProperties: false`、`enum`、`minLength` 这类约束，校验力度弱，
    且容易退化成「文档」而非「可执行契约」。
  - 放弃「OpenAPI 全量比对」（即以 FastAPI 生成的 `openapi.json` 作为唯一事实
    来源，前端直接读取比对）：本次骨架只有一个端点，为此引入 OpenAPI 全量结构
    解析（`$ref` 解引用、`components/schemas` 遍历）对前端而言开销与复杂度都
    过高，超出「最小骨架」范围；且 OpenAPI 文档结构会随 FastAPI/Pydantic 版本
    演进变化，把它当作跨语言单一事实来源会引入額外的版本耦合风险。
  - 选择「JSON Schema 片段」：JSON Schema 是与语言无关的标准格式，Python 侧有
    成熟的 `jsonschema` 库可以做真正的运行时校验（而不是把内容复制成 Python
    字面量再做相等比较）；前端侧因为契约结构简单（当前只用到 6 个关键字），
    手写一个覆盖这几个关键字的最小校验函数即可达到「真正引用同一份文件、
    不硬编码副本」的目的，不需要为此引入 `ajv` 等通用 JSON Schema 校验库
    （评估后认为额外依赖体积与维护成本不值得，属于本次「最小依赖」范围内的
    取舍；如后续契约复杂度显著上升，应重新评估引入 `ajv`）。
- 前后端如何各自引用同一份文件：
  - 后端：`backend/tests/test_contract_health.py` 用
    `Path(__file__).resolve().parent.parent.parent / "docs" / "contracts" / "health.schema.json"`
    定位仓库根下的契约文件（不依赖 `pytest` 的当前工作目录，因为
    `tool.pytest.ini_options` 中 `testpaths = ["tests"]` 可能导致 cwd 是
    `backend/`），读取后：（1）断言 `path`/`method`/`successStatus` 与
    `GET /health` 的实际约定一致；（2）断言 `app.openapi()` 中
    `paths["/health"]["get"]["responses"]` 确实包含契约声明的状态码；
    （3）用 `jsonschema.validate(instance=response.json(), schema=contract["responseBody"])`
    对 `TestClient` 实际请求得到的响应体做真正的 schema 校验；（4）额外用几个
    刻意违反契约的payload 验证同一份 schema 会拒绝它们，避免 schema 本身
    「形同虚设」（例如误写成 `{}` 之类无约束的片段）。新增开发依赖
    `jsonschema>=4.17`（记录在 `pyproject.toml` 的 `[project.optional-dependencies].dev`），
    理由：这是 Python 生态校验 JSON Schema 的事实标准库，体积小、无额外系统
    依赖，且本次校验目的明确需要真正的 schema 语义（而非字符串/字典相等）。
  - 前端：`frontend/src/lib/backendClient.test.ts` 用
    `path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/contracts/health.schema.json")`
    从 `frontend/src/lib` 回溯三级到仓库根，用 `node:fs` 的 `readFileSync` +
    `JSON.parse` 读取同一份文件（未使用 ESM JSON import attributes，避免对
    Node 版本特性做不必要的假设）；随后：（1）断言 `path`/`method`/
    `successStatus` 字段值；（2）对 `fetchHealth()` 成功路径返回的 `data` 用
    手写的 `validateAgainstSchema()` 做字段级校验（覆盖 `required`、
    `additionalProperties: false`、`type`、`enum`、`minLength`）；（3）用同一组
    刻意违反契约的 payload 验证该校验函数会报错，避免校验逻辑本身「形同虚设」。
    未新增生产依赖或开发依赖；`validateAgainstSchema()` 明确注释为「非通用
    JSON Schema 实现，只覆盖本仓库契约实际用到的关键字子集」，不作为对外
    可复用的通用能力。
- 失败路径说明：跨端契约本身只约束成功（`200 OK`）响应体的形状；`fetchHealth()`
  在网络错误、超时、非 200 状态码时返回 `{ ok: false, error }`，不产出需要按
  契约校验的响应体，因此契约测试只覆盖成功路径，失败路径继续沿用 Module 2 中
  既有的「后端不可达」「非 200 状态码」两个用例。

### Verification（跨端契约）

2026-07-16 在具备完整 Bash 执行权限的会话中，于 Windows 本机实际执行：

- 后端新增依赖安装：`.venv\Scripts\python.exe -m pip install -e ".[dev]"`
  成功安装 `jsonschema 4.26.0`（及其依赖 `attrs`、`referencing`、
  `jsonschema-specifications`、`rpds-py`）。
- `.venv\Scripts\python.exe -m ruff check .`：`All checks passed!`，无告警。
- `.venv\Scripts\python.exe -m pytest`：最终复跑 `9 passed, 1 warning`——5
  个 `GET /health` 基础测试（含 `version` 与 `pyproject.toml` 固定值一致的防假绿
  测试）保持通过，4 个跨端契约测试
  （`test_contract_file_describes_the_health_endpoint`、
  `test_openapi_declares_health_get_with_contract_status_code`、
  `test_health_response_body_matches_contract_schema`、
  `test_health_response_violating_contract_would_be_rejected`）全部通过；唯一
  告警仍是与本次改动无关的 `StarletteDeprecationWarning`。
- `npm test`（`node --test`）：最终复跑 `7 passed`——原有 4 个
  `backendClient` 测试保持通过，新增 3 个跨端契约测试（成功路径响应体符合契约、
  契约健全性检查会拒绝违规 payload、最小校验器覆盖当前 schema 关键字）全部通过。
- `npm run lint`（`eslint`）：无输出、无错误，通过。
- `npm run typecheck`（`tsc --noEmit`）：无输出、无错误，通过。

结论：`docs/contracts/health.schema.json` 是前后端唯一事实来源，两侧测试均为
「实际读取该文件 + 用其内容做真正校验」，而非各自维护硬编码副本；本次交付未
新增前端依赖，仅在后端新增 `jsonschema` 开发依赖，四条真实命令
（`ruff check`、`pytest`、`npm test`、`npm run lint`/`npm run typecheck`）均已
在 Windows 本机端到端验证通过。Module 4 已将等效命令接入 Ubuntu CI，并新增
`scripts/verify_integration.mjs` 覆盖前后端成功/失败路径；远端 Ubuntu 首次运行结果
仍需在变更推送后由 CI 观察。

## Consequences

- 后端骨架不依赖任何需要单独安装的包管理器二进制，只需要系统 Python，降低了
  跨 Windows 开发机与 Ubuntu CI 的安装摩擦。
- 未提交依赖锁文件意味着依赖解析结果在不同时间安装可能有细微差异；后续如需
  可复现构建，应在完整权限环境中原型验证锁定方案（如 `pip-tools`、`uv`）并更新
  本决策。
- 本地端到端命令执行验证已补齐：两端安装、静态检查、测试、构建/启动烟雾以及
  `scripts/verify_integration.mjs` 的成功/失败路径均已通过；CI 已声明等效 Ubuntu
  jobs，远端首次运行结果需在变更推送后观察。

## Verification

已实际执行并成功的诊断命令（本交付会话内）：

- `python --version` → `Python 3.14.5`
- `node --version` → `v24.18.0`
- `git status` / `git diff --stat` / `git log -1`：均正常返回仓库当前状态。

2026-07-16 后端基础阶段补充：在获得完整 Bash 执行权限的会话中，于 Windows 本机实际执行了
`backend/AGENTS.md` 记录的全部命令，结果如下：

- `python -m venv .venv`：成功创建虚拟环境（`.venv/Scripts/python.exe` 等可执行
  文件生成）。
- `.venv\Scripts\python.exe -m pip install --upgrade pip`：成功，`pip` 由
  26.1.1 升级到 26.1.2。
- `.venv\Scripts\python.exe -m pip install -e ".[dev]"`：成功（因网络原因
  `ruff` wheel 下载超时后自动续传完成，属正常重试，非失败）。实际解析并安装的
  关键版本：`fastapi 0.139.0`、`uvicorn 0.51.0`、`pydantic 2.13.4`、
  `starlette 1.3.1`、`ruff 0.15.21`、`pytest 9.1.1`、`httpx 0.28.1`；均满足
  `pyproject.toml` 中的宽松版本约束（`fastapi>=0.111`、`uvicorn[standard]>=0.29`
  等）。可编辑安装本身（`chaotang-os-backend` 0.1.0）构建与安装均成功。
- `.venv\Scripts\python.exe -m ruff check .`：`All checks passed!`，无告警。
- `.venv\Scripts\python.exe -m pytest`：`4 passed, 1 warning in 2.35s`；4 个
  `GET /health` 契约测试（状态码、`content-type`、响应体字段与取值、字段集合）
  全部通过。唯一告警是 `starlette.testclient` 关于未来建议改用 `httpx2` 的
  `StarletteDeprecationWarning`，与本次实现代码无关，不影响契约。
- `.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`：
  成功启动并监听 `127.0.0.1:8000`；随后执行 `curl -i http://127.0.0.1:8000/health`
  返回：
  ```
  HTTP/1.1 200 OK
  content-type: application/json
  {"status":"ok","service":"chaotang-os-backend","version":"0.1.0"}
  ```
  与 `## 后端` 章节约定的响应契约完全一致（状态码、`Content-Type`、三个字段及
  取值，`version` 与 `pyproject.toml` 中的 `0.1.0` 一致）。验证完成后已终止该
  uvicorn 进程，确认端口 8000 不再被监听。

结论：pip + venv 方案在 Windows 本机端到端验证通过，setup/lint/test/run 命令
均为真实可执行且已实际执行成功；Module 4 已将等效命令接入 Ubuntu CI，远端首次
运行结果需在变更推送后观察。

## Verification（前端基础阶段）

2026-07-16 在具备完整 Bash 执行权限的会话中，于 Windows 本机实际执行了
`frontend/AGENTS.md` 记录的全部命令，结果如下：

- 脚手架：`npx create-next-app@latest` 在仓库外临时目录生成初始文件后迁入
  `frontend/`；`npm view` 查询确认并锁定实际安装版本：`next@16.2.10`、
  `react@19.2.7`、`react-dom@19.2.7`、`typescript@5.9.3`（`^5` 范围内的最新版，
  避免解析到已存在于 registry 的 `typescript@7.x`）、`eslint@9.39.5`、
  `eslint-config-next@16.2.10`、`@types/node@22.20.1`、`@types/react@19.2.17`、
  `@types/react-dom@19.2.3`。
- `npm install`（首次生成 `package-lock.json`）：成功，`added 342 packages,
  audited 343 packages`；`npm warn allow-scripts` 提示 `sharp`、
  `unrs-resolver` 的安装脚本未被显式允许（Next.js 自身依赖链的正常提示，未执行
  `npm approve-scripts`，不影响本次骨架功能）；`npm audit` 报告 2 个 moderate
  级别漏洞，均指向 `next` 内部间接依赖的 `postcss`（`GHSA-qx2v-qp2m-jg93`），
  `npm audit fix` 给出的修复方案是把 `next` 降级到 `9.3.3`（semver major
  降级），会直接违反 Technical Plan 的 `^16` 选型，故本次不采用，记录为已知、
  低可操作性的遗留风险。
- `rm -rf node_modules && npm ci`：成功，`added 342 packages, audited 343
  packages in 1m`，与 `package-lock.json` 完全一致，证明锁文件可复现安装。
- `npm run lint`（`eslint`，基于 `eslint-config-next` 的
  `core-web-vitals` + `typescript` 规则集）：无输出、无错误，通过。
- `npm run typecheck`（`tsc --noEmit`）：无输出、无错误，通过。为支持
  `backendClient.test.ts` 中显式 `.ts` 扩展名的相对导入（Node 原生运行 `.ts`
  文件的 ESM 解析要求），在 `tsconfig.json` 中新增了
  `allowImportingTsExtensions: true`（`noEmit: true` 时允许）。
- `npm test`（`node --test`）：4 个测试全部通过——
  `fetchHealth：成功路径`（本地 `node:http` stub 返回契约响应）、
  `fetchHealth：失败路径 - 后端不可达`（指向已释放、未监听的端口）、
  `fetchHealth：失败路径 - 非 200 状态码`、`getBackendBaseUrl`（环境变量读取
  逻辑）；`package.json` 增加 `"type": "module"` 以消除 Node 对 `.test.ts` 文件
  CommonJS/ESM 混用的告警。
- `npm run build`（`next build`，Turbopack）：成功，`Compiled successfully`、
  `Finished TypeScript`；输出的路由表显示 `/` 为 `ƒ`（Dynamic，服务端按需渲染）
  而非 `○`（Static），证明 `backendClient.ts` 中 `fetch(..., { cache: "no-store"
  })` 确实阻止了健康检查结果被固化进静态构建产物。
- entry 烟雾验证（`npm run start` 后请求 `/`，验证两条路径均返回 200 且渲染
  正确后终止进程）：
  - 后端未启动时：`curl -i http://127.0.0.1:3000/` 返回 `200 OK`，页面渲染
    `<p data-testid="backend-status" data-backend-ok="false">后端不可用：
    fetch failed</p>`。
  - 同时启动后端（`backend/.venv/Scripts/python.exe -m uvicorn app.main:app
    --host 127.0.0.1 --port 8000`）后：`curl http://127.0.0.1:8000/health`
    返回 `{"status":"ok","service":"chaotang-os-backend","version":"0.1.0"}`；
    `curl http://127.0.0.1:3000/` 页面渲染
    `<p data-testid="backend-status" data-backend-ok="true">后端状态：ok
    （chaotang-os-backend v0.1.0）</p>`，与后端实际响应一致。
  - 两次验证完成后均已终止对应的 `next start`/`uvicorn` 进程，确认端口
    `3000`/`8000` 不再被监听（仅剩余无害的 `TIME_WAIT` 连接记录）。

结论：npm 方案在 Windows 本机端到端验证通过，setup/lint/typecheck/test/
build/run 命令均为真实可执行且已实际执行成功，成功路径与失败路径均可在无浏览器
自动化、无常驻服务的方式下重复验证；Module 4 已将等效命令接入 Ubuntu CI，远端
首次运行结果需在变更推送后观察。
