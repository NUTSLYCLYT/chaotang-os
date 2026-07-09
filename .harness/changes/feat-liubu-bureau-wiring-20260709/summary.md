# 变更摘要：feat-liubu-bureau-wiring-20260709

| 字段 | 值 |
| --- | --- |
| Change ID | feat-liubu-bureau-wiring-20260709 |
| 类型 | feat |
| 状态 | DELIVERED |
| Owner | Project Agent |
| 创建日期 | 20260709 |

## 范围

- 主线：六部（户/吏/兵/刑/工）8 个司页面此前因 2026-07-08 前端 BFF 退休而全部 404，
  改接真实后端 dept overview + 已存在但未接线的 `buildBureauPageView`；新增吏部
  任免/招聘后端 REST 端点（此前无出口）；刑部/兵部/户部各挂一个真实"深度复核"面板
  （刑部→`/api/legal/verdict/from-text`，兵部→`/api/quotation/verdict`，户部→
  finance/reporting 与 cashflow 两个 preview 端点）；删除一整套确认零引用的孤儿
  UI 壳组件（department-offices.ts 注册表 + 六部 Workspace/OfficePage 及子组件，
  共 111 个文件）。跨前后端，故按根级 AGENTS.md 补建本记录。

- 文件：
  - 新增：`backend/web/routers/libu.py`、`backend/tests/test_libu_router.py`、
    `frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx`、
    `frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx`、
    `frontend/e2e/liubu-bureau-pages-smoke.spec.ts`、
    `frontend/src/features/xingbu/components/xingbu-legal-swarm-panel.nodetest.ts`
  - 修改：`backend/web/main.py`（注册 libu 路由）、
    `backend/src/quotation_verdict.py`（source_label 不再恒为 LIVE_SWARM）、
    `backend/src/xingbu_verdict.py`（run_verdict_from_text 补 source_label）、
    `backend/src/court_doc_builder.py`（case_id 自动生成加随机后缀防撞车）、
    `frontend/src/features/bureaus/hooks/useBureauPageView.ts`（改真实数据源 +
    overview 按部门共享 SWR key）、
    `frontend/src/features/bureaus/components/BureauPageRouteClient.tsx`（挂三个
    深度复核面板；修正 cashflow 预览占位符 JSON 形状）、
    `frontend/src/features/xingbu/components/xingbu-legal-swarm-panel.tsx`
    （改接真实端点；补类别强制安全门；补 Enter 键校验）、
    `frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx`
    （补 Enter 键校验）
  - 删除：`frontend/src/features/departments/lib/department-offices.ts`
    及六部 `*Workspace`/`*OfficePage` 孤儿组件树（详见 git log，两个独立 commit）

- 验证：
  - 后端：`python3 -m pytest -q`（新增/改动文件相关测试全过，pre-existing 7 个
    与本次改动无关的失败未变化）
  - 前端：`pnpm exec tsc --noEmit`（0 错误）、`pnpm run test:node`（969 个测试，
    962 pass / 7 fail，同一批与本次改动无关的既有失败）
  - 浏览器：`npx playwright test e2e/liubu-bureau-pages-smoke.spec.ts`（10/10 通过，
    真实注册/登录拿签名 token，非假 token），另有交互式脚本验证过刑部本地扫描
    + 深度会诊真实报错回显、兵部/户部深度面板真实调用后端
  - 完整过程与三处对原方案的纠偏记录见
    `docs/liubu-frontend-backend-wiring-plan-2026-07-09.md`

## 已知未完成（诚实标注，非遗漏）

- 8 个司页面的 `BureauAction`（如"补现金流证明"）仍为诚实禁用占位，未接真实触发点——
  需要先建结构化输入表单，属新功能范畴。
- 删孤儿代码时连带失去了几个真实客户端能力的唯一入口（BOM 成本计算器、客户名单
  批量导入、离职经济补偿计算器、利益相关方优先级排序）——底层纯函数库仍保留、有
  测试，但当前无任何页面可达。是否要给这些能力重新建一个 UI 入口，需要业务侧
  决定优先级，本记录先如实标注，不擅自决定重建。
- `GongbuWorkspace`/`LibuWorkspace`/`LifuWorkspace` 更深层子树已确认不可达但未
  逐文件清理（方法已验证可行，见 `docs/liubu-frontend-backend-wiring-plan-2026-07-09.md`）。
