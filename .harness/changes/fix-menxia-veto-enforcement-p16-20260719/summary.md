# 变更摘要：fix-menxia-veto-enforcement-p16-20260719

Packet ID: P16

| 字段 | 值 |
| --- | --- |
| Change ID | fix-menxia-veto-enforcement-p16-20260719 |
| 类型 | fix |
| 状态 | REVIEW_V1_NO_GO_FIXED / REVIEW_V2_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：闭合门下省封驳的执行安全链。合法封驳必须在丞相路由之后、任何部门/蜂群
  派单之前停止，并以 `menxia_veto_pending` 写入唯一真实状态。
- 消费端：REST 状态、canonical SSE、军机处质量门和真实浏览器页面均诚实显示“阻断、
  需人工确认、未生成奏折、未派发执行”，不得伪报成功或系统异常。
- 文件：20 个实现/测试路径 + 本 root change 的 4 个证据文件 + review-v1 NO_GO，
  候选恰好 25 路径。
- 验证：行为 RED、后端聚焦 69 passed、backend 全量 2777 passed / 37 skipped /
  4 warnings / 0 failed、前端契约 18 passed、Playwright 1 passed、TypeScript、
  生产构建、三层 doctor 与 diff check。

## 边界

- 精确基点：`origin/feature-chaotang-ext` =
  `e38b31f901256a565e6b7900dd7f88b28c100dd6`（P15 已发布）。
- 本包只关闭历史 Opus NO_GO 的 Menxia CRITICAL 根因；同一审查中的工部电池关键词
  HIGH 仍是独立阻断项，必须另包修复和复审。
- 不纳入 P17 memorial 历史回填/递归契约校验，也不整体合并本地 78 提交混杂 DAG。
- 当前没有可用的 Menxia override 执行器；本包不伪造“覆盖封驳”按钮。人工放行能力
  需以后端状态机、审计事件和幂等恢复为独立 Packet 实现。

## 候选结果

- `门下省封驳` 专属信号 fail closed；普通 `human_confirmation_required` 不被误当封驳。
- 两条生产入口都只写 `CourtReview(menxia_veto_pending)`，不写 outbox、不启动部门或蜂群。
- 重试同一确认请求幂等返回既有 review，不发生重复写入或唯一键冲突。
- REST memorial 必填字段、`quality_gate.passed=false`、冲突部门空数组和 SSE blocked 语义齐全。
- 当前实际挂载的军机处中心面板新增封驳告示；已撤回旧未挂载面板上的无效修饰。
- Claude review-v1 发现客户端 `department_override` 可绕过封驳并判 NO_GO；v2 已
  改为先用覆盖前丞相路由判职责范围，再应用执行部门约束，并新增纯函数/真实 API 两层回归。
- `review-v1.md` 原文保留作审计；等待独立 Claude Code review-v2，GO 前不得合入或推送 ext。

PACKET_P16_READY_FOR_CLAUDE_REVIEW_V2
