# 需求说明

## 背景

用户要求锦衣卫页面采用项目统一三栏布局，并让左右栏展示后端定义的真实数据与已实现功能。

## 范围

- 左栏接入真实采证端点，展示主库、真实信号、公开来源、预警及后端实装能力。
- 中栏保留产业情报板与世界地图。
- 右栏展示选中信号的来源硬门；发起采证后展示后端 court_doc、逐条可信度裁决与归档编号。
- 移除未接线的“生成证据包”和 FALLBACK 派发入口。

## 非目标

- 不新增后端接口或伪造实时数据。
- 不把 fallback fixture 标记为真实来源。
- 不实现后端尚未提供的正式情报列表或正式六部派发链。

## 验收标准

- 页面在桌面端呈现左、中、右三栏。
- 左栏调用 `/api/intel/brief`，无真实来源时展示明确空态。
- 右栏可渲染 LIVE_SEARCH / CALLER_FINDINGS / FALLBACK 核验结果。
- 类型检查、构建和后端锦衣卫测试通过。

## 风险

后端未启动、未登录或未配置 Tavily 时，实时采证会失败或返回 FALLBACK；页面必须显示错误/空态而非假结果。

## 验证计划

运行 TypeScript、Next.js production build、锦衣卫 agent/endpoint/vet 测试、frontend harness doctor 和 Playwright 页面核验。

