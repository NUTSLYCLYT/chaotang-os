# 第二批：史馆视觉外壳迁移

## 目标

将当前 `/shiguan` 的真实档案、统计、召回和复盘业务放入 dev 太史馆的纯视觉外壳。

## 允许修改

- `frontend/src/app/shiguan/**`
- `frontend/src/components/chaotang/**`（仅新增可复用纯视觉组件时）
- `frontend/public/assets/shiguan/shiguan.webp`
- 对应测试

## 必须满足

1. 从 `dev:frontend/public/assets/shiguan/shiguan.webp` 精确迁入背景资源，局部 CSS Module 使用它作为 `center top / cover no-repeat` 背景；不得引入其他未清单资源。
2. 保留 `ShiguanClient` 当前所有 BFF 请求、状态、筛选、统计、召回和复盘行为与 `data-testid`；不得修改 `backendClient`、任何 `src/app/api/shiguan/**` 或 `archiveStatus` 契约。
3. 页面采用深蓝黑金、顶层“太史馆”身份条、桌面三栏/窄屏堆叠：左栏承载当前统计和筛选，中栏承载当前档案列表与选中详情，右栏承载当前旧案召回与复盘。若现有 JSX 结构需要最小重排，可重排但不得删改真实字段、按钮和表单。
4. 中栏采用当前 `EdictScrollShell` 或等效局部纯视觉卷轴承载案卷；空态必须诚实说明无真实档案，不能使用 dev 示例数据。
5. 不复制 dev 的 hooks、view-model、知识库/宣传/复盘 API、Tailwind、lucide 或任何模拟档案。浏览器仍只走当前同源 BFF；`/shiguan` 仍由服务端 `requireUser('/shiguan')` 保护。
6. 先写结构/资源/契约测试并确认 RED，再实现 GREEN；运行定向测试、lint、typecheck、test、build，不得提交或推送。

## 报告

写入 `.superpowers/sdd/shiguan-visual-report.md`，包含修改、验证和未解决项。
