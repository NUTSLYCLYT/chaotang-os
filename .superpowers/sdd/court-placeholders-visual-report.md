# 第四批：受保护入口视觉外壳报告

## 完成内容

- `CourtPlaceholderPage` 增加 `dadian`、`junjichu`、`liubu`、`zhuanshu` 四种纯视觉外壳，不引入客户端状态、请求或业务数据。
- 精确从 `dev` 迁入允许资源：大殿舞台、军机处场景与战情室、六部场景；专署使用无数据的暗色密档网格视觉。
- 9 个现有受保护入口按其路由传入对应视觉类型：大殿、军机处/指挥中心、六部及其动态详情、专署/锦衣卫及其动态详情。
- 延续现有标题、说明、路由片段和“功能筹备中”诚实状态；动态参数仍仅经安全编码后显示为路由片段。
- 添加资源/视觉类型/无业务依赖的结构测试。

## TDD 与验证

- RED：新增测试首次因 dev 背景资产尚未迁入失败。
- GREEN：定向测试通过。
- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：116/116 通过。
- `npm run build`：通过。
- `git diff --check`：通过（仅有 Git CRLF 提示，无空白错误）。

## 契约确认

- 未修改 `requireUser`、动态路由参数、认证、会话、BFF 或 API。
- 未添加 mock 案件、统计、人物、消息或任何请求；所有入口继续明确显示“功能筹备中”。
- 未引入 dev 组件、Tailwind、Lucide、旧 hooks/store/API client；未提交或推送。
