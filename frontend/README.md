# 朝堂 OS 前端

本目录是 `chaotang-os/frontend`，只承载朝堂 OS 的前端体验线：页面、组件、浏览器交互、前端发布门禁和前端工程 harness。

整体产品定位、跨前后端架构、商业化、历史总账和跨线交接文档统一放在根目录 `../docs/`；本 README 不复述整体项目方案。

## Harness 入口

```text
.harness/
├── agents/       # Frontend Owner 调度中枢
├── rules/        # 前端工程红线
├── skills/       # 前端变更流程操作手册
├── wiki/         # 前端架构、领域、API 契约和发布事实
├── changes/      # 前端需求审计轨迹
├── templates/    # 前端 change 骨架
└── mcp/          # 外部工具配置索引
```

常用命令：

```bash
pnpm harness:doctor
pnpm harness:new-change feat short-name
```

建议阅读顺序：

1. `AGENTS.md`
2. `.harness/agents/frontend-owner.md`
3. `.harness/rules/product-boundaries.md`
4. `.harness/rules/project-structure.md`
5. `.harness/rules/dev-workflow.md`
6. `docs/HARNESS-USAGE-GUIDE.md`
7. `docs/AUTHORING-GUIDE.md`

## 前端边界

前端线拥有：

- Next.js App Router 页面、组件、布局、导航和浏览器行为。
- 用户可见体验：上书房、军机处、史馆、六部、庄园和 source label 展示。
- 前端发布门禁、Playwright 验证、截图证据和浏览器回归记录。
- `frontend/.harness/` 下的前端规则、skills、wiki、模板和变更记录。

前端线不拥有：

- 外部能力执行和非前端运行事实。
- 未经 API 契约或运行证据支持的“真实能力”声明。
- 非前端实现逻辑和质量规则。

需要表达跨线事实时，只引用根目录 `../docs/`、根 manifest 或明确 API 契约，不在前端文档中展开非前端实现。

## 技术栈

- Next.js 16 App Router
- React 19
- Tailwind 4
- TypeScript 5
- Playwright E2E

## 端口纪律

| 用途 | 端口 | 命令 |
| --- | ---: | --- |
| Dev HMR | 3002 | `pnpm dev` |
| Production | 3050 | `pnpm start` |
| 禁用 | 3001 | 不要绑定 |

公网 nginx upstream 指向 3050。不要用 dev 进程占 3050，也不要改回 3001。

## 本地运行

```bash
pnpm install
pnpm dev
```

访问：

```text
http://localhost:3002/court-briefing
```

生产构建：

```bash
pnpm build
pnpm start
```

## 环境变量

常用：

```bash
NEXT_PUBLIC_API_MODE=real
NEXT_PUBLIC_CHAOTANG_API_URL=http://127.0.0.1:8081
BASE_PATH=/chaotang
```

浏览器代码连接外部 API 时必须使用显式 base URL，不能新增同源 BFF 或隐藏代理。

## 中文字体

朝堂是中文优先界面。生产环境不能依赖宿主机刚好有中文字体。

已做两层兜底：

- `Dockerfile` runtime 安装 `font-noto-cjk`
- `src/app/globals.css` 支持 `public/fonts/Noto*SC*.woff2` 自托管入口

推荐把精简后的 Noto Sans SC / Noto Serif SC woff2 文件放入 `public/fonts/`，文件名见 `public/fonts/README.md`。

## 验证

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm test:e2e
```

视觉类变更需要用 Playwright 截图看核心路由：

- `/court-briefing`
- `/command-center`
- `/overview`
- `/archive`
