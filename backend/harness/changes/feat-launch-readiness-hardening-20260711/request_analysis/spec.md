# 需求说明

## 背景

见 `summary.md`。核心矛盾：本轮审计工具(端点覆盖率归一化比对)证明有效，但只存在于这次对话的临时脚本里，不会在下一次有人问"后端有没有功能前端没接"时自动复用；密旨的产品状态(是否要接入真实调度)已经被诚实标注但没有被"登记"为一个待决策事项，容易在后续开发中被遗忘或被下一个人重新调查一遍。

## 范围

- 把本轮 Python 审计脚本(FastAPI `app.routes` 内省 + 路径归一化 + 前端字符串扫描交叉比对)迁移为 `backend/scripts/check-endpoint-coverage.py`，输出结构化 JSON(供前端契约漂移脚本复用同一份 openapi 导出),纳入 `harness_doctor.py` 的检查项之一。
- `chaotang_department_protocol` harness 文档补一节，说明工部真实引擎的双输入契约(`presale_output` + `task_input`)与自由文本下旨天然打不满，属于结构性限制。
- 在 `court_compat.py::orchestrate_all` 函数体加一条指向本 change 记录的注释，说明这是密旨当前唯一真实调用路径，等待产品决策。

## 非目标

- 不实现密旨到真实调度的接入(产品决策未定)。
- 不改动已验证可用的真实部门引擎。

## 验收标准

- `python scripts/check-endpoint-coverage.py` 可重复运行，且给出与本轮人工审计一致的结果(5 个真实无前端调用点，且能明确标注哪些是诚实空桩、哪些是已被替代的 legacy)。
- `harness_doctor.py` 把这个脚本纳入检查流程后仍然全绿。
- `chaotang_department_protocol` 文档里能看到工部双输入限制的说明，且现有 `test_chaotang_department_protocol.py` 不受影响。

## 风险

- 覆盖率脚本如果和前端契约漂移脚本各自维护一份 openapi 解析逻辑，容易出现"两边结果不一致"的新漂移源——需要约定由后端导出一份 `openapi.json` 静态文件，前端脚本只读这份文件，不自己另外请求或解析。

## 验证计划

- `python scripts/harness_doctor.py`
- `python scripts/check-endpoint-coverage.py`
- `python -m pytest -q tests/test_chaotang_department_protocol.py`
