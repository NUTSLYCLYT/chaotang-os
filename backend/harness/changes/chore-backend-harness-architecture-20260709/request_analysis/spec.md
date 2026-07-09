# 需求说明

## 背景

后端已有多个 harness 运行器和测试，但缺少后端本地的架构清单、共享约定、变更记录和自动健康检查。根级 harness 只能粗略确认目录存在，无法判断后端 harness 是否完整。

## 目标

- 建立 `backend/harness/manifest.json` 作为后端 harness 单一清单。
- 新增 `backend/scripts/harness_doctor.py`，检查主 harness、实现包、共享约定和变更记录。
- 补齐缺少 README 的实现包，明确它们与主 harness 的关系。
- 建立 `_shared/` 目录，沉淀公共契约、门禁和观测字段。
- 接入根级 doctor，让项目级验证覆盖后端架构。

## 非目标

- 不重构已有 runner 行为。
- 不新增真实模型调用。
- 不把后端 harness 行为测试扩大到全量测试套件。
