# P6 范围裁决：事实优先于陈旧计划锚点

基线：`d7f7436fb6a7f257df7b13a4bc703c866602b243`（已包含 P5.1/P5.2 修复与 D6 未决评审终态闸门）。

| 候选 | 实测状态 | 本 Packet 处置 | 下一门 |
| --- | --- | --- | --- |
| 前端 `court-pipeline.ts` + `three-chamber-engine.ts` + `deliberation-console.tsx` | 0 簇外 runtime import、0 页面挂载 | 蒸馏安全语义后移动 dated attic | permanent retired-import guard |
| `backend/src/swarm_orchestrator.py` | CLI、canonical 上书房、platform routes 等仍调用 | 保持原位；不改禁改平台路由族 | 另立 caller migration，迁完后观察 |
| `backend/web/routers/qintian_forecast.py` | 仍挂载；无 14 天遥测；canonical shape 非等价 | 保持原位 | replacement + telemetry + 14 天零调用 |
| `backend/web/routers/forecast_intel_taiyi.py` | `/api/court/intel` 有真实页面消费者；其余无 VERIFIED replacement | 保持原位 | 先迁 consumer/contract，再观察 |
| `backend/config/flow_opc.yaml.bak` | Git 基线/历史均不存在；只在隔离范围外有 ignored 本地副本 | 不触碰、不提交 | 用户另行授权本机文件处置 |

根治理明确：`null`、代码搜索或部分观察不等于零调用；删除/断挂载必须在 replacement
VERIFIED、所有已知调用方迁移且连续完整 14 天调用量为 0 后，通过后续独立变更完成。
因此，本 Packet 不以“仍保留在 Git attic”规避入口 RETIRED 门。

## 审查后续项

`/api/court/dept/gong-bu/feasibility/result` 与 `/api/court/dept/li-bu/recruit/result` 是既有匿名
GET，当前以短 sid 查询内存状态。P6 只收紧四个会登记状态的 POST，不在同包改变读取契约；
后续安全变更需为 result GET 增加认证、任务归属校验和更高熵标识，并补兼容迁移证据。
