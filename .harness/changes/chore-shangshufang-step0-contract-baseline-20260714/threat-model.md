# 上书房 → 蜂群威胁基线

状态：Step 0 范围级威胁模型；后续每个高风险子 change 仍需增量复审。

## 资产与信任边界

| 资产 | 边界 | 主要风险 |
| --- | --- | --- |
| 用户问题、附件、合同与身份 | 浏览器 → API → DB/provider | 跨租户读取、PII/商业秘密泄露 |
| 路由、计划、节点结果、圣裁 | LLM 不可信输出 → 确定性控制面 | prompt injection、伪造证据、越权动作 |
| provider/tool credentials | worker → 外部服务 | 日志泄密、SSRF、恶意工具调用 |
| outbox、事件、归档 | web/worker/DB | 重放、乱序、重复效果、篡改审计 |
| 发布身份与运行证据 | worktree/build/runtime | foreign process、脏构建、伪 LIVE |

## 攻击/失败路径与必须缓解

| 路径 | 当前状态 | 后续必须缓解 | blocks_steps |
| --- | --- | --- | --- |
| 猜测 task_id 读取/裁决他人对象 | 已确认 P0 风险 | scoped repository、tenant/user 复合约束、负向授权矩阵 | Launch S5 |
| 附件或网页中的间接 prompt injection | 未系统验证 | 内容与指令分离、tool capability allowlist、引用追踪 | Launch S8 |
| 模型诱导调用高风险工具 | 未形成统一政策 | 参数 schema、最小权限、高风险 human approval | Launch S8 |
| URL/tool 触发 SSRF 或任意 egress | 未系统验证 | scheme/host allowlist、DNS/IP 校验、网络 egress policy | Launch S8 |
| provider 成功后 worker 崩溃导致重复效果 | 当前无 effect receipt/reconciliation | at-least-once、幂等键、receipt、人工对账 | Launch S8 |
| secret/合同全文进入日志或 fixture | 规则存在，缺全链验证 | 结构化脱敏、敏感字段 denylist、日志负向测试 | Launch S8/S10 |
| sourceLabel 硬编码 LIVE | 已确认 | 单一读模型、来源传播、浏览器证据 | Launch S4/S6 |
| decision/deepen 并发或越过状态前置条件 | 已确认 | 状态机 CAS、actor/tenant、人工确认 | Launch S4/S6 |
| foreign 3050 被误认为本次发布 | 已确认本机存在 | immutable manifest、PID/cwd/digest gate | Launch S1/S3 |

## 攻击者能力假设

- 普通认证用户可构造任意 HTTP 请求、枚举 ID、重复/并发提交。
- 用户附件和抓取网页内容完全不可信，可能包含针对 LLM 或工具的指令。
- provider、网络或 worker 可能超时、重复、乱序或在任意提交点崩溃。
- 不假设数据库管理员、宿主机 root 或签名 authority 已被攻破；这些属于后续基础设施威胁模型。

## Step 0 安全结论

当前系统不具备公开生产安全条件。最高优先级是对象级授权和 tenant 迁移；在 Step 1 完成前，不允许真实多租户客户数据进入该链路。
