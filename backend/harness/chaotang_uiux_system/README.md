# 朝堂体验契约 Harness

本 harness 定义朝堂 OS 后端输出的第一版可测试体验契约。它不实现呈现层，只验证运行结果是否具备可解释、可导航、可复盘的结构。

## 覆盖对象

- `朝堂气象`：全局状态条，回答系统当前是否稳定。
- `圣门战报`：任务完成后的记忆点报告，包含分数、功劳、历史裁决、归档和下一步。
- `钦天监伴读`：解释当前上下文、风险信号和下一步依据。

## 输入

- `uiux_rules.yaml`
- `golden_cases/uiux_cases.json`

## 入口

```bash
cd backend
python harness/chaotang_uiux_system/scripts/run_uiux.py
```

## 测试

```bash
cd backend
python -m pytest -q tests/test_chaotang_uiux_system.py
```
