# 视觉导演蜂群逐页修正教学手册

> 目标：一个页面一个页面修正产品按钮 UI、产品内容展示和关键艺术效果。每次只修一个页面，留截图、测试和可复用规则。

## 1. 固定工作流

```text
选页 -> 截图 -> 诊断 -> 修按钮 -> 修内容展示 -> 加艺术锚点 -> 浏览器验收 -> 记录教学
```

每页必须回答 5 个问题：

1. 用户进来 3 秒内知道这里能做什么吗？
2. 主按钮是不是明确、可点击、带图标、状态可见？
3. 内容展示是不是按“状态 -> 证据 -> 下一步”组织？
4. 艺术效果有没有服务一个状态，而不是到处装饰？
5. 桌面和移动端有没有溢出、遮挡、误导性完成态？

## 1.1 最终版产品输出标准

朝堂 OS 的最终版页面必须同时满足四个层面：

| 层面 | 标准 | 反例 |
|---|---|---|
| 功能设计 | 每页只有一个主任务，主按钮能推进任务 | 堆入口、堆概念、用户不知道点哪里 |
| 产品理念 | 输出必须按“状态 -> 证据 -> 下一步”呈现 | 只给漂亮总结，不告诉用户下一步 |
| 企业文化 | 严肃、可信、克制、有担当，像正式经营系统 | 游戏化过度、玄学化、把风险说成喜报 |
| 用户体验 | 关键状态一眼可见，按钮统一，错误可恢复 | 完成态误导发布、按钮语法每页不同 |

世界最佳不是“最炫”，而是：

```text
复杂问题进入系统后，用户看到的是清楚的状态、可信的证据、明确的责任和可执行的下一步。
```

## 2. 页面修正模板

```text
页面:
用户任务:
艺术锚点:
张小龙删减:
按钮 UI:
内容展示:
状态/风险:
验收命令:
截图:
结论:
```

## 3. 按钮 UI 标准

1. 主按钮必须有 lucide 图标：启动用 `Play`，刷新用 `RefreshCw`，阻断用 `AlertTriangle`，处理中用 `Loader2`。
2. 按钮文案只写动作，不写解释：`启动编排`、`刷新会话`、`查看详情`。
3. 禁止只有装饰符号的文本按钮，例如 `▶ 启动` 应改为图标 + 文案。
4. 禁用态必须可见：透明度降低，但仍保留按钮尺寸，避免布局跳动。
5. 危险动作和发布阻断必须用红色状态，不用金色伪装成正常流程。

## 4. 内容展示标准

每张业务卡片按这个顺序组织：

```text
标题 / 状态标签
关键数字 / 来源 / 时间
风险或阻断原因
下一步动作
```

不要把“完成数量”当作“可发布”。如果存在 QA fail、发布阻断、权限缺失、数据 fallback，必须直接显示在卡片上。

## 5. 艺术效果标准

艺术预算集中在状态转折点：

| 状态 | 艺术锚点 | 禁止 |
|---|---|---|
| 发布阻断 | 红色门禁、压迫感、不可发布 | 遮挡 issue、只闪红不说原因 |
| 圣旨落印 | 印章、落定、可信度 | 超过 3 秒、阻断继续操作 |
| 史馆归档 | 卷宗入库、经验沉淀 | 纯庆祝、不显示 lesson |
| 运行中 | 脉冲、流动、等待感 | 全页面发光、影响阅读 |

## 6. 第一页样板：`/jiqun/swarm`

用户任务：查看蜂群配置、启动编排、发现运行/阻断会话。

本轮修正：

1. 顶部增加 `刷新会话` 图标按钮和 `命令中心`跳转。
2. KPI 卡加功能图标，降低纯数字仪表盘的冷感。
3. `启动编排` 按钮改为 `Play / Loader2` 状态按钮。
4. `发布阻断` 标签加 `AlertTriangle`，并在卡片里露出下一步。

验收：

```text
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/jiqun-swarm-qa-gate.spec.ts
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/visual-director-jiqun-swarm.spec.ts
pnpm build
```

截图：

```text
dev/artifacts/visual-director/jiqun-swarm-desktop.png
```

## 7. 逐页队列

1. `/jiqun/swarm`：蜂群编排总台。
2. `/jiqun/command-center`：跨蜂群命令中心。
3. `/jiqun/swarm/[session]`：会话详情与 QA 发布门禁。
4. `/gongbu/dev-console`：工部开发台。
5. `/command-center`：军机处作战页。
6. `/scribe` 或 `/shiguan`：史馆归档教学样板。

每修完一页，把“本轮修正”和“验收”追加到本手册。

## 8. 第二页样板：`/jiqun/command-center`

用户任务：快速调度、查看运行中/阻断/完成会话，并从阻断会话进入修复。

本轮修正：

1. 顶部增加 `刷新会话` 图标按钮和 `蜂群总台`返回入口。
2. KPI 卡沿用第一页图标语法，运行、阻断、完成、总会话一眼可扫。
3. `启动` 按钮改为 `Play / Loader2` 状态按钮。
4. `发布阻断` 标签加 `AlertTriangle`，并显示“先处理 QA issue，再复核、审签、归档”的下一步。

验收：

```text
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/visual-director-jiqun-command-center.spec.ts
pnpm build
```

截图：

```text
dev/artifacts/visual-director/jiqun-command-center-desktop.png
```

## 9. 第三页样板：`/jiqun/swarm/[session]`

用户任务：判断一次蜂群会话的输出是否可信、是否可发布、下一步由谁处理。

艺术锚点：详情页是“审判席”，不是日志堆栈。状态、证据、下一步必须压过装饰。

本轮修正：

1. 顶部动作统一为 `刷新会话`、`命令中心`、`重新编排`，全部使用 lucide 图标。
2. 增加四个发布判断摘要：`发布门禁`、`完成进度`、`QA issue`、`触发链路`。
3. QA fail 门禁增加明确下一步：修复 issue、补充复核证据、负责人审签。
4. 每个子蜂群 run 增加“输出结论”，把 QA 阻断与正常复核队列分开显示。
5. 保留事件流和触发链路，作为追溯证据，不把它们伪装成完成态。

验收：

```text
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/visual-director-jiqun-swarm-detail.spec.ts
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/jiqun-swarm-qa-gate.spec.ts
pnpm build
```

截图：

```text
dev/artifacts/visual-director/jiqun-swarm-detail-desktop.png
```
