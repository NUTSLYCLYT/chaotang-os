# 变更摘要：fix-gongbu-component-scope-p18-20260719

| 字段 | 值 |
| --- | --- |
| Change ID | fix-gongbu-component-scope-p18-20260719 |
| 类型 | fix |
| 状态 | READY_FOR_CLAUDE_REVIEW_V8 |
| Owner | Codex / Claude Code independent reviewer |
| 创建日期 | 20260719 |

Packet ID: P18

## 范围

- 主线：关闭 P17 Claude 记录的工部 scope 旁路，确保物理组件/危险任务在 direct、蜂群路由、
  六部路由和 fallback 四条路径都不能无人签继续。
- 最终基线：`cfc2e88db875139ddb8745ecd1e65033c46f4f6b`（包含 P17、P19 证据清理、
  P20 D6 历史审查治理及期间已发布变更）；P18 已逐提交重放，两个重叠文件经三方融合。
- 实现：共享 `is_gongbu_safety_scope()`；物理硬件词进入 canonical YAML；工部 fallback
  在真实引擎无结论时强制 `复核 + requires_human_confirmation=true`。
- 首轮审查：H18=`c67f6d8` 的 Claude v1 报告虽写 GO，但同时列出 F1=HIGH：单字危险
  信号把防火墙、聚焦、烧钱、爆款等普通业务语言伪造成储能消防指令；另有 F2=MEDIUM：
  canonical 未覆盖控制柜爆燃。HIGH 与 GO 自相矛盾，治理上按实质 NO_GO 停止 D6。
- v2 回修：危险信号只在明确物理领域内做 P0/P1 分档；`模组/单体` 仅在与端子、电压、
  析锂等物理上下文共现时入域；canonical 增加控制柜、配电柜、端子并移除歧义裸词。
- 第二轮审查：Claude v2 正确判 `PACKET_REVIEW_NO_GO`，F1=HIGH 证明全文任意共现仍会把
  “单体服务短路/前端模组包体膨胀”伪造成消防指令；F2=MEDIUM 证明路由与执行的文本口径
  不一致，`known_facts/unknown_gaps` 中的事故可能在 fallback 无人签继续。
- v3 回修：删除全文任意共现，改用 `模组端子/单体电压` 等有限连续物理短语；新增统一
  `_edict_context_text()`，让路由、真实引擎、规则与 hard-stop 共同读取原问题、精炼旨意、
  原始命令、决策类型、已知事实、未知缺口、风险旗标和审查计划。
- 第三轮审查：Claude v3 判 `PACKET_REVIEW_NO_GO`，F1=HIGH 证明外部 `review_plan` 仅进入
  route，未沿主循环传给部门执行，仍可“强制参审后自动准奏”；另记 CI 声明陈旧 LOW。
- v4 回修：`review_plan` 成为 `run_department_swarm` 的显式可选输入，由主循环沿锦衣卫先行、
  串行、并行与异常重试路径原样传递，并同时供 real/rule/live/hard-stop 消费。
- 第四轮审查：Claude v4 判 `PACKET_REVIEW_NO_GO`：F1/F2=HIGH，分别实证 `PACK/PCS`
  无 token 边界造成 package/backpack/小写 pcs 伪报，以及内嵌 review_plan 被空外参遮蔽；
  F3=MEDIUM 指出已 black 的 court_doc 被重复叠加混合契约。
- v5 回修：中文范围词继续子串匹配；BMS/PCS/PACK 改为区分大小写的 ASCII token 边界；
  `_edict_context_text()` 同时吸收内嵌与外部 review plan；hard-stop 原生识别 black court_doc。
- 第五轮审查：Claude v5 判 `PACKET_REVIEW_NO_GO`，F1=HIGH：显式 `department_ids`
  覆盖会重建部门清单，删除路由强制追加的工部；串行入口默认指定部门，生产可达。
- v6 回修：`department_ids` 仅是调用偏好，不是安全豁免。物理安全 scope 在 override 后
  无条件补入工部，并同步进入 selected_swarms、swarm_tasks 与真实 task_runs。
- v7 重放：不改变 P18 行为范围，只把 v6 净补丁重放到最新远端并保留远端工部
  fail-safe；净差仍为原定 10 个 P18 路径。
- 第七轮审查：Claude v7 判 `INSUFFICIENT_EVIDENCE`，并给出 F1=MEDIUM：把
  BMS/PCS/PACK 一律设为大小写敏感会漏掉现场常见的小写 `bms`/`pack`，相对基线
  形成 fail-open；后端 doctor 因审查命令权限不足未能亲跑。
- v8 回修：BMS/PACK 使用忽略大小写的 ASCII token 边界，PCS 继续大小写敏感以隔离
  `100 pcs`；新增小写 BMS/PACK 正例，package/backpack/packet 等负例保持全绿。
- 验证：历次安全边界 13 passed；最新五模块聚焦 104 passed；后端全量
  2825 passed / 37 skipped / 4 warnings / 0 failed。

## 边界

- 不把旧本地分支合入，不改前端、数据库、provider 或 P17 审查证据。
- Claude v1 的矛盾 GO 与 Claude v2/v3/v4/v5 的 NO_GO 均仅保留在隔离本地历史，不进入候选
  lineage，也不作为 approval。
- 已确认物理范围仍偏 fail-safe；领域外的单字危险字符不得生成储能消防内容。后续不得恢复
  “引擎无结论就自动准奏”，也不得用告警泛滥冒充安全。

PACKET_P18_READY_FOR_CLAUDE_REVIEW_V8
