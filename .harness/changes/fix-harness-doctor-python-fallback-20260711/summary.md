# 变更摘要：fix-harness-doctor-python-fallback-20260711

| 字段 | 值 |
| --- | --- |
| Change ID | fix-harness-doctor-python-fallback-20260711 |
| 类型 | fix |
| 状态 | DRAFT |
| Owner | Project Agent |
| 创建日期 | 20260711 |

## 范围

- 主线：`node scripts/harness-doctor.mjs`(根级跨线护栏 doctor)委托检查后端 harness 时硬编码调用 `python`，本环境只装了 `python3`(无 `python` 别名)，导致委托直接 ENOENT，误报"delegated backend harness doctor failed"——backend 自己的 `harness_doctor.py` 实际是绿的，只是没被成功调用到。这是三层 doctor(根/前端/后端)里唯一没在这轮 launch-readiness 硬化改动里被跑过的一层，跑了才发现这个环境兼容性缺口。
- 文件：`scripts/harness-doctor.mjs`。
- 验证：`node scripts/harness-doctor.mjs` 从 1 error 变成 0 errors, 0 warnings；`python scripts/harness_doctor.py`(有 python 别名的环境)行为不变，仍是原调用方式，只有 ENOENT 时才退回 `python3`。
