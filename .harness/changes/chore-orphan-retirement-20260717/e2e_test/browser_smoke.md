# P6 浏览器冒烟记录

日期：2026-07-17。

按照 Playwright CLI 工作流先完成前置检查：`npx` 与 wrapper 均可用。随后检查项目规定的唯一端口：

| 端口 | 既有服务工作树 | 状态 |
| ---: | --- | --- |
| 3002 | `/home/ubuntu/Projects/chaotang-os/frontend` | 自 2026-07-16 持续运行 |
| 3050 | `/home/ubuntu/workspace/frontend/chaotang-master-wt` | 自 2026-07-14 持续运行 |

两个服务都不来自 P6 隔离工作树。项目规则禁止使用其他端口；本轮也未获授权停止或替换用户既有服务。因此没有把现有页面截图冒充本分支证据，也没有执行会影响共享服务的重启。

替代证据：

- production build 通过，route manifest 成功生成；
- `getV1LiubuStaticParams()` 明确排除 pending 礼部；
- 动态六部路由对非 active 部门执行 `notFound()`；
- 对应 node 回归与全量 1041 个测试全部通过。

后续若端口释放，应在 P6 精确提交上启动 3050 production build，并用 Playwright CLI 验证：`/liubu/libu_rites` 不可进入工作台、active 六部路由仍正常、控制台无新增错误。
