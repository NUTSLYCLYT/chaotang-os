# 任务：feat-menxiasheng-routing-veto-20260717

## 任务 1

- 目标：在丞相路由与军机处派单之间增加结构化门下省审议。
- 前置条件：PKT-2 canonical 部门关键词已收口。
- 输入：丞相 route dict + 原始任务文本。
- 输出：`verdict`、四维 dimensions、reroute_suggestion、veto_reasons、round。
- 涉及文件：`backend/src/menxia_veto.py`、`backend/src/chancellor/routing_service.py`、测试及 change 证据。
- 状态 / 数据变化：封驳路由标记 `humanSignoffRequired`；无数据库 schema 迁移。
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_menxia_veto.py backend/tests/test_chancellor_routing_service.py`（8 passed）。
- 回滚边界：设置 `CHAOTANG_MENXIA_VETO=0` 绕过接入；删除模块恢复旧链路。
- 完成定义：世界杯误路由封驳，合同路由准奏，第三轮边界可测。
