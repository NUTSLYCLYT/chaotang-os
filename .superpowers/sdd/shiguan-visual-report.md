# 第二批：史馆视觉外壳迁移报告

## 完成内容

- 从 `dev` 精确迁入 `frontend/public/assets/shiguan/shiguan.webp`，并由史馆局部 CSS Module 以 `center top / cover no-repeat` 作为背景使用。
- 保留 `ShiguanClient` 既有的同源 BFF 请求、筛选、统计、旧案召回、复盘和 401 跳转逻辑；未修改 `backendClient`、`src/app/api/shiguan/**` 或 `archiveStatus`。
- 将展示层重排为太史馆身份条、桌面三栏/窄屏堆叠：左栏统计和筛选及真实档案索引，中栏卷轴内显示当前选中档案，右栏保留旧案召回与复盘结果。
- 中栏使用现有 `EdictScrollShell`；无档案时明确展示“暂无真实档案”，不引入示例或模拟数据。
- 添加结构、资源和契约保护测试。

## TDD 与验证

- RED：`ShiguanClient.visual.test.ts` 首次因缺少 `shiguan.module.css` 失败。
- GREEN：定向测试通过。
- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test`：114/114 通过。
- `npm run build`：通过。
- `git diff --check`：通过（仅有 Git CRLF 提示，无空白错误）。

## 未解决项 / 注意事项

- 本批不迁移 dev 的 `ShiguanPage`、hooks、view-model、知识库/宣传/旧 retrospective API 或 Tailwind/Lucide 依赖。
- 未触发真实下旨，未提交或推送。
