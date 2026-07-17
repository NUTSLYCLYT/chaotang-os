# 规格说明：refactor-department-router-canonical-consolidation-20260717

## 背景

PKT-2 的真实调用方盘点表明 `route_department_task` 被 Web API、`chancellor_router`、`chancellor/routing_service`、department protocol harness、persona harness 调用；属于活兼容 API，不能直接删除。`shangshufang_loop.DEPARTMENT_RULES` 原为第二份手写关键词表，现改由 canonical taxonomy 投影生成。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 旧路由有真实生产/评测调用方；上书房规则是第二份手写表 | `rg` 调用方盘点；相关 Python/测试 | 只读排查 + 29 tests | 否 |
| 推测 | YAML 扩充后的关键词覆盖既有 golden 行为 | route golden cases | 回归验证 | 否 |
| 未知问题 | 能力审计脚本仍按静态 AST 识别关键词，对动态投影显示误报 | `audit.py` 输出 | 后续独立修复，不混入本包 | 否 |

## 数据流与调用链

YAML `v1_taxonomy.liubu.*.routing_keywords` → `department_identity.runtime_projection` → `shangshufang_loop.DEPARTMENT_RULES`；`chaotang_department_router` 继续读取同一 runtime projection。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| routing_keywords | `departments.yaml` | 上书房、兼容路由、chancellor | SSOT + route golden |

## 范围

关键词唯一事实源投影、canonical 顺序 tie-break、显式部门点名优先；旧 API 只兼容，不退役。

## 非目标

不处理门下省、LLM 路由推荐、反幻觉条款；不删除 `chaotang_department_router.py`。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 主题词冲突 | canonical YAML 顺序作为 tie-break | golden route |
| 显式“请礼部” | 显式部门优先于主题词 | 上书房 API tests |
| 旧调用方 | 保留兼容函数 | rg 盘点 + SSOT tests |

## 风险与回滚边界

回滚 YAML 与上书房投影改动即可；兼容路由文件保持不动，降低生产依赖风险。

## 计划确认记录

- 批准人：
- 批准日期：
- 批准范围：
- 明确未批准：

## 验收标准

三套路由不再各自维护关键词；29 个定向测试通过；旧 API 调用方未删除。

## 验证计划

运行路由/SSOT/上书房定向 pytest、`git diff --check`；全量后端回归待收口阶段执行。
