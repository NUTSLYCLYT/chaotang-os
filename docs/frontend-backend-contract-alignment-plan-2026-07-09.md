# 前后端业务与接口对齐实施方案

| 字段 | 内容 |
| --- | --- |
| 日期 | 2026-07-09 |
| 范围 | `frontend/` 浏览器体验线与 `backend/` 运行服务线 |
| 目标 | 消除前端业务页面与后端 API 契约不匹配，建立可持续的契约、适配、验证与回滚机制 |
| 非目标 | 不改 UI 层布局/视觉/交互结构，不新增前端 BFF 层，不重写前端页面，不重构后端蜂群运行逻辑，不以 mock 证明真实后端质量 |

## 一、问题判断

当前不匹配不是单个接口 404，而是三类结构性问题叠加：

1. **路径命名空间漂移**
   - 前端同时存在 `/api/court/*`、`/api/chaotang/*`、`/api/shangshufang/*`、`/api/chaotang/dept/*` 等调用形态。
   - 后端实际路由分布在 `backend/web/routers/*.py`，同一业务有时归在不同 prefix 下。
   - `frontend/src/lib/backend-api.ts` 已有路径重写逻辑，说明前端正在用适配层弥合历史路径差异，但规则分散且缺少契约清单约束。

2. **响应信封与字段形状不稳定**
   - 部分后端返回 `{ success, data, error }`，部分返回 `{ ok, ... }` 或直接业务对象。
   - 前端有些地方使用 `backendFetch` 自行解析，有些地方使用 `fetchLocalCourtApi`、`jiqunPost`、`chaotang` client 或直接 `fetch`。
   - 字段命名混用 snake_case 与 camelCase，导致页面层需要临时兜底，长期会形成隐性假绿灯。

3. **业务事实源边界不清**
   - 前端页面需要知道某块 UI 是 LIVE、LIVE_SWARM、MIXED、DEMO 还是 FALLBACK。
   - 后端运行线才拥有真实任务、蜂群、provider、质量门、归档等事实。
   - 一旦前端用本地 mock 或旧 BFF 兜底填满页面，就会出现“看起来有数据，但不能证明真实后端质量”的问题。

## 二、统一原则

1. **后端拥有运行事实，前端拥有展示适配**
   - 后端负责真实任务状态、蜂群运行、部门 overview、质量门、归档与 source label。
   - 前端负责把后端事实适配成页面视图模型，不在页面层编造运行事实。

2. **每个业务页面只认一个事实源入口**
   - 一个页面可以有多个操作端点，但必须有一个主读取端点。
   - 主读取端点负责返回页面首屏所需的最小事实集合。

3. **契约先于实现**
   - 先用 TS contract + Python response model 或测试样例定义字段。
   - 再接后端实现和前端适配。
   - 最后用端到端验证证明“浏览器看到的”与“后端真的返回的”一致。

4. **兼容层集中，不在组件里散落 if**
   - 历史路径兼容只允许集中在 `frontend/src/lib/backend-api.ts` 或专用 adapter。
   - 业务组件只消费稳定的 view model。

5. **UI 层冻结，只修数据契约**
   - 本方案不得改页面布局、视觉样式、组件层级、导航结构、交互动线或文案表达。
   - 允许改动范围仅限 API client、adapter、contract、view model 输入字段、后端端点与测试。
   - 若接口修复必须影响按钮 enabled/disabled 或错误态显示，只能沿用现有 UI 组件和现有状态位，不新建 UI 形态。

6. **不新增前端 BFF 层**
   - 不新增 `frontend/src/app/api/**`、Next route handler、server action 或其他前端服务端代理来承接后端业务。
   - 前端只保留现有 transparent proxy/transport 能力与 client/adapter，不写运行时业务事实、不拼装后端运行结果。
   - 缺失能力必须回到 `backend/` 补真实端点或在既有 `backend-api.ts` 中登记临时路径 alias；alias 必须有 owner、验证命令和退役计划。

## 三、目标契约分层

### 1. Transport 层

统一浏览器到后端的调用入口：

- 浏览器侧优先使用 `backendFetch` 或基于它封装的业务 client。
- 禁止新增页面组件内裸 `fetch('/api/...')`，除非该路径是前端本地 route handler 且有明确 owner。
- 所有后端 HTTP JSON 响应统一进入一种可解析信封：

```ts
interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  message?: string | null;
  source_label?: 'LIVE' | 'LIVE_SWARM' | 'MIXED' | 'DEMO' | 'FALLBACK';
  generated_at?: string;
}
```

短期允许旧端点保留原返回，但必须在前端 adapter 处转换成统一信封，不把差异泄露到组件。

### 2. Domain 层

为重点业务建立稳定契约：

| 业务域 | 前端契约位置 | 后端事实源 | 主读取端点建议 |
| --- | --- | --- | --- |
| 上书房 | `frontend/src/lib/contracts/shangshufang.ts` | `backend/web/routers/shangshufang.py` | `GET /api/shangshufang/home` |
| 军机处 | `frontend/src/features/command-center/junjichu/model/types.ts` | 上书房任务、蜂群运行、归档检索 | `GET /api/chaotang/tasks/{id}` + 专用聚合端点 |
| 六部司页 | `frontend/src/lib/contracts/bureau-page-view.ts`、`dept.ts` | `backend/web/routers/dept.py`、部门专线 router | `GET /api/chaotang/dept/{code}/overview` |
| 大殿 | `frontend/src/lib/contracts/dadian.ts` | `backend/web/routers/dadian.py` | `GET /api/court/dadian/feed`、`pulse` |
| 深度复核 | 各部门面板 contract | `quotation.py`、`legal.py`、`hubu.py` 等 | 按部门专线 POST preview/verdict |

### 3. ViewModel 层

页面组件只消费 view model：

- `BureauPageView`
- `JunjichuPageView`
- `ShangshufangHomeView`
- `DadianFeedView`

adapter 负责：

- 字段命名转换。
- 空值与错误态归一。
- source label 显示策略。
- 操作按钮 enabled/disabled 规则。

## 四、实施阶段

### 阶段 0：接口盘点与冻结

目标：先知道前端到底在打哪些接口，后端到底暴露哪些接口。

冻结要求：

- 不改 `frontend/src/app/**` 页面结构。
- 不改 `frontend/src/features/**/components/**` 视觉组件。
- 不改导航、布局、CSS、动画、卡片结构和交互流程。
- 不新增 `frontend/src/app/api/**` BFF route 或任何前端服务端业务代理。
- 只盘点调用路径、响应字段、事实源 owner 和验证命令。

任务：

1. 生成前端 API 调用清单：
   - 扫描 `frontend/src` 下 `backendFetch(`、`fetchLocalCourtApi(`、`jiqunPost(`、`chaotang.`、`fetch(`。
   - 输出字段：调用文件、HTTP 方法、路径、业务域、是否页面首屏依赖、是否写操作。
2. 生成后端路由清单：
   - 扫描 `backend/web/routers/*.py` 的 `APIRouter(prefix=...)` 与装饰器。
   - 输出字段：router、方法、路径、是否鉴权、返回信封、测试文件。
3. 标记四类状态：
   - `MATCHED`：前端调用与后端路由存在，字段契约有测试。
   - `PATH_ALIAS`：前端路径靠重写映射到后端真实路径。
   - `SHAPE_DRIFT`：路径存在但响应字段不稳定。
   - `MISSING_BACKEND`：前端调用无后端事实源。

交付物：

- `docs/api-contract-inventory-2026-07-09.md`
- 一份机器可读清单，建议 `docs/api-contract-inventory-2026-07-09.json`

验收命令：

```powershell
rg -n "backendFetch\\(|fetchLocalCourtApi\\(|jiqunPost\\(|fetch\\(" frontend/src
rg -n "APIRouter\\(|@router\\.(get|post|put|delete|patch)" backend/web/routers
```

### 阶段 1：建立契约源

目标：让每条关键业务链有唯一契约，不再靠页面猜字段。

任务：

1. 对 P0 页面建立契约表：
   - 上书房首页与任务状态。
   - 军机处任务主卷、会审、蜂群、质量门。
   - 六部司页 overview 与深度复核面板。
   - 大殿 feed/pulse/chancellor/decision judgment。
2. 每个契约写清：
   - path、method、request body、response data。
   - source label 取值。
   - 空态、错误态、鉴权失败态。
   - 页面依赖字段与后端 owner。
3. 前端 TS contract 与后端测试样例保持同名字段。

交付物：

- 更新 `frontend/src/lib/contracts/*`
- 新增或更新 `backend/tests/test_*_api.py`
- 更新 `frontend/.harness/wiki/api-contracts.md` 或根级文档索引

验收命令：

```powershell
cd frontend; pnpm exec tsc --noEmit
cd backend; python -m pytest -q tests/test_dadian_api.py tests/test_libu_router.py tests/test_shangshufang_loop_api.py
```

### 阶段 2：收敛前端访问层

目标：把分散 API 调用收口到业务 client 和 adapter。

UI 边界：

- 不移动、不重命名、不重写现有页面组件。
- 不改变首屏信息架构。
- 不新增展示卡片或替换视觉容器。
- adapter 输出必须适配现有组件需要的字段，而不是要求组件迁就后端字段。

BFF 边界：

- 不新增 Next API route、route handler、server action 来补后端缺口。
- 不把后端聚合逻辑搬到 `frontend/`。
- 不在前端服务端代码中写入运行事实、质量门、蜂群结果或归档逻辑。
- 如果现有前端 route handler 已承担历史代理职责，只允许作为透明转发保留；新业务契约必须落在 `backend/`。

任务：

1. 保留 `frontend/src/lib/backend-api.ts` 作为唯一 transport 层。
2. 为每个业务域提供 client：
   - `frontend/src/features/shangshufang/api/*`
   - `frontend/src/features/command-center/junjichu/api/*`
   - `frontend/src/features/bureaus/api/*`
   - `frontend/src/features/dadian/api/*`
3. 页面组件禁止直接解析后端 envelope。
4. `toBackendApiPath` 中的历史 alias 加注 owner、计划删除日期和对应后端真实端点。

重点修复点：

- `/api/court/shangshufang/*` 与 `/api/shangshufang/*` 的别名关系必须集中在 `toBackendApiPath`，不要在页面层混用。
- `/api/court/hubu/overview`、`/api/court/bingbu/overview`、`/api/court/libu/promo` 这类历史路径要么明确退役，要么保留映射和测试。
- 部门页面统一走 `GET /api/chaotang/dept/{code}/overview`，深度面板再走各部门写端点。

验收命令：

```powershell
rg -n "fetch\\(" frontend/src/features frontend/src/app
rg -n "/api/court/shangshufang|/api/shangshufang|/api/chaotang/dept" frontend/src
cd frontend; pnpm exec tsc --noEmit
```

### 阶段 3：补齐后端聚合与兼容端点

目标：前端首屏不再需要拼多个不稳定端点才能显示完整业务态。

任务：

1. 后端为 P0 页面提供聚合读取端点：
   - 军机处：任务身份、路由理由、召集部门、质量门、蜂群运行、归档建议。
   - 六部司页：部门 overview、司 metadata、可执行动作、深度面板入口能力。
2. 保持已有细粒度写端点：
   - 报价复核、法律复核、财务 preview、现金流 preview 等写操作仍由部门专线 owner 维护。
3. 为历史路径提供明确 301 式兼容或 envelope 错误：
   - 不存在的路径返回结构化错误，不让前端无限 spinner。
4. 每个端点补测试：
   - 200 成功。
   - 401 鉴权。
   - 404 业务对象不存在。
   - source label 不伪装 LIVE。

禁止事项：

- 不用前端 BFF 聚合多个后端端点来替代后端聚合端点。
- 不在前端 route handler 中生成 fallback 业务数据。
- 不通过新建 `/api/court/*` 前端本地路由掩盖后端缺口。

验收命令：

```powershell
cd backend; python -m pytest -q tests/test_dadian_api.py tests/test_libu_router.py tests/test_shangshufang_loop_api.py
cd backend; python scripts/harness_doctor.py
```

### 阶段 4：浏览器级闭环验证

目标：后端 dry-run 不替代浏览器体验，前端 mock 不替代后端质量。

任务：

1. Playwright 覆盖 P0 路径：
   - 登录。
   - 上书房下旨。
   - 军机处任务主卷加载。
   - 六部司页打开。
   - 深度复核面板发起一次真实后端调用。
   - 大殿 feed/pulse 认证访问。
2. 每个测试断言：
   - 页面无 404/500。
   - 关键 source label 可见。
   - 关键 action 在无事实源时 disabled。
   - 后端错误可见且不伪装成功。
3. 保存截图和 trace 到前端 harness 变更记录。

验收命令：

```powershell
cd frontend; pnpm exec tsc --noEmit
cd frontend; npx playwright test e2e/liubu-bureau-pages-smoke.spec.ts
cd frontend; pnpm test:e2e
```

## 五、优先级清单

### P0：立即处理

1. **接口清单自动化**
   - 没有清单就无法判断缺口。
   - 先生成 `MATCHED / PATH_ALIAS / SHAPE_DRIFT / MISSING_BACKEND`。

2. **统一信封适配**
   - 页面层不直接处理多种后端返回。
   - 先在前端 adapter 统一，不强迫一次性改完后端所有旧端点。

3. **P0 页面契约**
   - 上书房、军机处、六部司页、大殿。
   - 每个页面确认一个主读取端点。

4. **路径 alias 收敛**
   - `toBackendApiPath` 现有 alias 必须补测试。
   - 新 alias 需要 owner 和退役计划。

### P1：两轮迭代内处理

1. 后端新增页面聚合端点，减少前端拼装。
2. 为所有写操作建立 request/response schema。
3. Playwright 增加真实后端调用断言。
4. 删除页面层临时兜底 mock。

### P2：稳定化

1. 生成 OpenAPI JSON 并在 CI 中 diff。
2. 从 Python response model 生成 TS 类型或至少生成契约快照。
3. 建立契约破坏检查：后端字段删除或类型变化必须让前端 contract test 失败。

## 六、验证矩阵

| 声明 | 验证方式 | 负责人 |
| --- | --- | --- |
| 前端路径都能找到 owner | API 调用清单 + owner 字段 | 前端 |
| 后端路由真实存在 | router 清单 + pytest | 后端 |
| 响应字段匹配页面契约 | TS contract + pytest fixture | 前后端共同 |
| 登录态与 401 行为正确 | 后端鉴权测试 + Playwright 未登录探测 | 后端主责，前端验证 |
| source label 不造假 | 后端测试断言 + 页面可见文案 | 后端主责，前端展示 |
| 浏览器体验可用 | Playwright 登录后真实路径 | 前端 |

## 七、回滚方案

1. 文档与契约变更可直接回滚对应 commit。
2. 前端 adapter 变更出现问题时：
   - 保留 transport 层。
   - 回滚具体业务 client，不回滚全局鉴权刷新逻辑。
3. 后端端点变更出现问题时：
   - 先恢复旧响应字段。
   - 新字段保持向后兼容，不删除旧字段。
4. 聚合端点上线失败时：
   - 页面继续使用现有细粒度端点。
   - 明确显示 `MIXED` 或错误态，不退回 DEMO 填充。
   - 不用新增前端 BFF 作为回滚方案。

## 八、执行顺序建议

1. 第一天：生成接口清单，标记 P0 缺口。
2. 第二天：补 P0 契约和后端 pytest。
3. 第三天：收敛前端访问层，页面只吃 view model。
4. 第四天：补后端聚合端点或兼容 alias。
5. 第五天：Playwright 全链路验证，清理临时 mock 和死路径。

## 九、当前注意事项

当前工作区存在 Windows 本地权限异常目录，`frontend/src/features/*/components` 与部分 `hooks` 目录可能出现 `Access is denied`。这会影响本地扫描、restore 和测试运行。正式实施前应先清理这些异常目录，确保 Git 工作区能完整检出 `HEAD`。

建议先处理：

```powershell
git status --short --branch
icacls frontend\src\features\bingbu\components
icacls frontend\src\features\hubu\components
```

若普通用户无法接管，需要管理员权限、重启后删除异常目录，或重新 clone 到干净工作区。
