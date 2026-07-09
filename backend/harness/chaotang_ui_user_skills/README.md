# 体验用户技能实现包

`chaotang_ui_user_skills` 检查用户在朝堂体验层中能否完成关键技能路径，例如查看部门状态、识别阻塞、进入证据和理解下一步。

它是后端 harness 的实现包，只验证运行结果是否具备支撑这些技能的结构化信息。

## 验证

```bash
cd backend
python -m pytest -q tests/test_chaotang_ui_page.py
```
