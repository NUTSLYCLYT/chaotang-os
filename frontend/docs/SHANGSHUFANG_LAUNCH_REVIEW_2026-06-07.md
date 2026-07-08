# 上书房上线评审 2026-06-07

## 1. 上线目标

把上书房作为朝堂 OS 的正式入口上线：用户打开后能看到今日最重要决策，理解证据和下一站，并能把它转成正式下旨输入，进入军机处/执行/归档闭环。

## 2. 大神讨论结论

| 顾问 | 结论 | 本轮采纳 |
|---|---|---|
| 张小龙 | 上书房不能变成多入口工具箱，首屏只回答“现在该做什么”。 | 保留今日御案为主路径，补“上线状态”，让用户少猜。 |
| Chaotang Product System | 上书房是 operating loop 第一站，必须接到下一部门。 | 首屏继续突出证据、下一站、按此下旨。 |
| 视觉导演 | 宫廷隐喻要服务责任，不做空装饰。 | 把“上线状态”放入御案卡，不另起华丽模块。 |
| Deming | 上线要有可复验标准。 | 增加 Playwright 路径和截图。 |

## 3. 成熟度评分

| 轴 | 分数 | 判断 |
|---|---:|---|
| Product job | 4 | 今日御案和下旨主路径清楚。 |
| Evidence grounding | 4 | 奏折显示证据数量与来源模式。 |
| Workflow power | 4 | 可从御案转正式下旨，后续接军机处。 |
| State machine | 3 | loading/error/consulting 有，补证/阻断还可继续加强。 |
| Advisor quality | 4 | 丞相、钦天监、今日建议具备角色分工。 |
| Toolchain | 3 | 有 API、SSE、Playwright，生产监控仍需补。 |
| UI clarity | 4 | 首屏现在能回答“是否可下旨”。 |
| Learning loop | 3 | 史馆反哺已有入口，尚未完全自动影响次日排序。 |
| Safety/governance | 3 | 证据不足会提示，但高风险发布门禁还需更强。 |

当前等级：L3 Evidence-backed，接近 L4 Closed-loop。

## 4. 本轮上线修正

1. 今日御案新增 `上线状态`：`可下旨 / 待补证 / 演练态`。
2. 底部下旨区新增模式解释：`先问丞相补判断 / 正式下旨进执行 / 密旨直发全蜂群`。
3. 底部下旨区新增字数状态，降低长文本不可控风险。
4. Playwright 增加“按此下旨 -> 输入框预填 -> 下旨模式”的上线路径。

## 5. 验收

```text
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/shangshufang-ux.spec.ts
pnpm build
```

截图：

```text
dev/artifacts/visual-director/shangshufang-launch-desktop.png
```

## 5.1 通信完整性复验

大神复验范围：上书房、工部、军机处、史馆、翰林炼 Skill。

通过命令：

```text
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/shangshufang-ux.spec.ts e2e/gongbu-dev-workbench.spec.ts e2e/hanlin-skill-forge.spec.ts --workers=1
pnpm build
```

通过结果：

1. 上书房首屏能显示今日御案、证据、下一站、上线状态。
2. `按此下旨` 会承接当前可见御案，不偷换成其它建议。
3. 工部开发台能把建设任务写入 build ledger。
4. 军机处能读取同一条 build ledger，并迁移到 `军机复核中`。
5. 史馆能消费同一条 build ledger，显示独立审计与旧案教训。
6. 未登录状态不能迁移 build ledger，也不能读取独立审计。
7. 翰林炼 Skill 页面能展示 `采证 -> 学习 -> 炼 Skill -> 评测 -> 入史`，并标注 `不是个人投资建议`。
8. 工部、军机处、史馆能显示同一 `objectId` 对象护照，归档后下一责任人切换为 `上书房召回`。

复验发现：

1. 本地 `node_modules/next` 曾处于 ignored/未链接状态，导致 `pnpm dev` 找不到 `next`；已用现有 `.ignored_next` 恢复为真实目录。
2. 多 worker 并发会放大 dev server 与慢 API 的测试噪声；上线通信验收固定用 `--workers=1`，避免把环境压测误判为内容通信失败。

## 6. 上线前仍需关注

1. 生产环境 `/api/court/shangshufang/briefing` 必须返回真实数据或清楚标注 fallback。
2. 高风险圣旨如果 `quality_gate` 未通过，必须禁止误导性“完成/可发布”表达。
3. 史馆反哺上书房排序仍是下一阶段 L4 闭环重点。
