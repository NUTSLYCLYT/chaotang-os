# 变更摘要：merge-p6-department-agent-consolidation-20260717

Packet ID: P6.4

| 字段 | 值 |
| --- | --- |
| Change ID | merge-p6-department-agent-consolidation-20260717 |
| 类型 | docs |
| 状态 | VERIFIED_COMPLETE |
| Owner | Claude Code（复审）+ Project Agent（实现） |
| 创建日期 | 20260717 |

## 范围

本 change 合并三个原本各自独立、但因共享根因修复而无法干净拆分的 Packet：

- **PKT-2** 部门路由关键词收口（`DEPARTMENT_RULES` 改为从 `department_identity.py`
  canonical registry 投影生成；`chaotang_department_router.py` 相关调用面同步调整）。
- **PKT-3** 门下省路由否决关卡（`menxia_veto.py` 新增，接入 `chancellor/
  routing_service.py`）。
- **PKT-5** 丞相 LLM 路由推荐层（`chancellor_llm_recommendation.py` 新增，接入
  `chancellor_router.py`）。

三者无法分别单独 push 的原因：`df21744`（原始提交序列中）一个提交同时修复了
PKT-2 与 PKT-3 共享的同一根因（专署未纳入 canonical 关键词投影，导致锦衣卫路由
被删除且门下省对正确路由错误封驳）——分开 push 会导致 ext 出现已知 NO_GO 的
中间态，与本仓库"不允许缺证据的中间态冒充完成"的纪律冲突。

同批含 P6 测试隔离修复（`conftest.py`/`test_runtime_db_isolation.py`，修复裸
pytest 曾真实写入 `backend/var/data/fengqun.db` 的问题）与 council persona
usage tracker（`council_persona_usage.py`，含多轮 fail-closed 加固）。

- 文件：见本次 push diff（`backend/src/{shangshufang_loop,menxia_veto,
  chancellor_llm_recommendation,chancellor_router,chaotang_department_router,
  department_identity}.py`、对应测试、`departments.yaml`、
  `backend/scripts/council_persona_usage.py`、P6 隔离测试、HANDOFF 附录）。
- 验证：详见 `packet_review/review-v1.md`。
