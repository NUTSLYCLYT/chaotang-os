# 预览 / 部署报告

结论：PASSED

## URL

- `http://127.0.0.1:3002/chaotang/zhuanshu/jinyiwei`
- 最终生产预览核验：`http://127.0.0.1:3060/chaotang/zhuanshu/jinyiwei`

## 检查

- 三栏布局、标题、采证入口、数据状态、能力列表、产业板、右栏证据门和队列已核验。

## 剩余风险

- 本机后端信号列表返回 404、任务接口未登录返回 401；页面因此诚实使用 fallback。正式实时采证仍依赖可用后端、登录态与 Tavily 配置。

