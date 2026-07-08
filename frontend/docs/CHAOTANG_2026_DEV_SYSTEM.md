# 朝堂 OS 2026 开发系统

## 目标

把朝堂 OS 做成一个高效、安全、可验证的开发与产品交付系统。所有工作围绕一个最小闭环推进：

```text
上书房提出事项 -> 军机处分派执行 -> jiqun 蜂群处理 -> 前端展示状态和结果 -> 史馆归档复盘
```

## 组织方式

### 圆桌层

圆桌只做判断，不做长篇发散。每次圆桌必须产出：

- 本轮唯一目标。
- 用户是谁。
- 成功指标。
- 最小可上线成果。
- 不做什么。
- 谁负责验收。

### 大神层

| 角色 | 责任 | 输出 |
|---|---|---|
| PM 大神 | 用户路径、范围收口、优先级 | 任务卡、验收口径 |
| 美术/UX 大神 | 第一屏、视觉层级、交互信任感 | 页面验收清单 |
| 架构大神 | 前后端边界、jiqun 融合、状态机 | 接口契约、链路图 |
| 后端蜂群大神 | jiqun run、任务队列、状态回传 | 可执行任务闭环 |
| QA 大神 | Playwright、harness、移动端、坏图 | pass/fail 报告 |
| 安全大神 | auth、写路径、数据、密钥、上线边界 | release risk report |
| 史馆大神 | 复盘、模板、学习沉淀 | 每日归档 |

### 蜂群层

蜂群只接收已经过圆桌压缩的任务卡。每张任务卡必须有：

- `owner`
- `goal`
- `files`
- `acceptance`
- `commands`
- `rollback`

蜂群在项目里不是“展示页”，而是多智能体执行与编排层。它负责把已经压缩过的目标拆成可执行任务，调度对应 agent 或部门蜂群去跑，汇总回奏、风险、阻塞与归档结果，再把这些结果回流到前台决策链路里。

这里的蜂群描述要始终区分三件事：

- 前台看到的是状态、结果、证据边界和下一步，不是后台编排细节。
- 后台真正执行的是 swarm run、任务队列、状态回传和归档，不是静态介绍。
- 真实数据、fallback 和 demo 必须显式标注，不能把 mock 伪装成 live。

常用的蜂群视图可以理解为四层：

- 蜂群总览：看当前有多少蜂群、谁在线、谁阻塞、谁需要关注。
- 蜂群会话：看一次编排从启动到回奏的完整过程。
- 蜂群成员：看每个 agent 的职责、状态、最近一次产出。
- 蜂群输出：看本轮结果、风险、待确认项和下一步行动。

在路由上，`/swarm` 更偏向用户可见的蜂群状态页，`/jiqun/swarm` 更偏向开发和运维态的编排与会话页；两者语义相近，但不要混成同一个入口。

## 工作流

### 1. Office Hours

用途：把一句话需求压缩成可执行目标。

输出：

- 用户角色。
- 核心场景。
- 成功指标。
- 最小 ship。

### 2. Autoplan

用途：把目标拆成执行计划。

输出：

- 文件边界。
- 任务顺序。
- 验收命令。
- 风险清单。

### 3. Implementation

规则：

- 测试或 harness 先行。
- 一次只改一个闭环。
- 不新增大机制。
- 不碰无关 dirty files。
- 每步都能用命令复核。

### 4. Review

检查：

- 用户路径是否更清楚。
- 链路是否更真。
- 是否引入假绿。
- 是否破坏现有入口。

### 5. QA

发布前统一质量门：

```bash
pnpm run harness:chaotang:gates
```

这条命令会自动执行：

- `pnpm exec tsc --noEmit`
- 启动 3002 dev server，并用 `PLAYWRIGHT_SKIP_WEBSERVER=1` 跑关键 E2E
- `e2e/shangshufang-ux.spec.ts`
- `e2e/gongbu-dev-workbench.spec.ts`
- `e2e/donggong.spec.ts`
- 停止 dev server
- `npm run build`

端口纪律：默认要求 3002 为空，由 harness 自己启动和关闭 dev server。若明确要复用已启动的 3002，可设置：

```bash
CHAOTANG_GATES_REUSE_DEV=1 pnpm run harness:chaotang:gates
```

必须跑：

```bash
pnpm exec tsc --noEmit
npm run build
HARNESS_BASE_URL=http://127.0.0.1:3050 HARNESS_BASE_PATH=/chaotang node scripts/final-release-harness.mjs
HARNESS_BASE_URL=http://127.0.0.1:3050 HARNESS_BASE_PATH=/chaotang node scripts/synthetic-user-harness.mjs
```

固定演示脚本质量门：

```bash
pnpm exec playwright test e2e/gongbu-dev-workbench.spec.ts --grep "跨部门对象护照"
```

这条脚本每次发布前必须用同一经营任务跑通：

- `objectId seed`: `build-chaotang-dev-workbench-mvp`
- 路线：上书房下旨 -> 工部生成任务卡 -> 军机处复核 -> 史馆归档 -> 上书房可召回
- 证据包：同一 objectId、对象护照、军机 auditTrail、史馆建设台账
- 通过标准：任一页面不能换 id、不能丢证据、不能把未归档任务伪装成已归档
- 失败处理：回到对应页面补状态、证据或写路径，不允许只改断言

东宫可借鉴这条脚本，但只作为权责演练：

- 东宫显示同一 objectId 的影子任务，帮助太子学习何时建议、何时上报、何时拦下。
- 东宫不得把演练直接变成执行、功业或称号。
- 御史二审前必须显示 `只演练不执行`，并保留准/驳记录。

### 6. Ship

上线前必须满足：

- final harness `decision=PROD`
- synthetic users `decision=SHIP` 或明确降级原因
- true-chain `requiredDown=0`
- 没有未解释的写路径失败
- 没有密钥输出到日志

## 合成用户测试

合成用户不是市场结论，只是预演。它负责提前发现：

- 用户看不懂。
- 用户不敢点。
- 用户找不到结果。
- 用户不相信 LIVE/DEMO 边界。
- 移动端阅读困难。
- 行业角色无法映射到自己的工作。

第一批 12 类用户：

- 老板
- 运营负责人
- 销售负责人
- 财务负责人
- 法务负责人
- 投资人
- 内容主编
- 客服主管
- 传统企业老板
- AI 新手
- 移动端用户
- 安全/合规负责人

## 质量原则

- 简单：一个入口，一个闭环，一个验收口径。
- 可调试：每个 pass/fail 都能追到 URL 和字段。
- 敢动：对阻塞上线的点直接改。
- 先跑通：真实链路优先于美化。
- 无特殊情况：内部状态不要暴露给普通用户。
- 不写新机制：优先复用 Next、Playwright、jiqun、gstack。

## 当前推荐执行顺序

1. 跑真实 dispatch 写路径。
2. 用合成用户 harness 评估第一屏。
3. PM 收口主导航和入口。
4. UX 重做任务提交和结果阅读层级。
5. 后端补 durable queue 和生产 DB。
6. 安全审查写路径和日志。
7. 史馆沉淀复盘模板。
