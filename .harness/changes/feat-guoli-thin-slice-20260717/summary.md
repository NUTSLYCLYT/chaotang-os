# 变更摘要：feat-guoli-thin-slice-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | feat-guoli-thin-slice-20260717 |
| 类型 | feat |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：后端国力真实读模型 → 前端类型化 adapter → 既有六部总览单卡投影。
- 文件：`backend/web/routers/guoli.py`、`frontend/src/features/guoli/**`、六部页面及行为测试。
- 验证：P8 专属后端/node/typecheck/build/doctor/真实浏览器 API-UI 对照均通过；P3 遗留旧调用已按用户授权修复，统一累计 smoke 2/2 通过，详见 `p8-cumulative-smoke-blocker.md`。
