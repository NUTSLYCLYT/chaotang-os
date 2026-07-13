# 后端文档

本目录只保存后端运行服务线文档。

## 可以放这里

- flow、agent、prompt、provider、API、数据源和运行服务说明。
- 后端 harness、评测、质量基线、安全闸门和运行依赖。
- 后端协议、合同、接口行为和后端测试报告。
- 已降级的后端能力历史文档，例如 `history-jiqun-pack.md`。

## 不放这里

- 不属于后端运行服务线的路线、总账、历史吸收方案或体验实现细节。

这些内容统一迁到根目录 `../docs/`。

## 当前文档

| 文档 | 说明 |
| --- | --- |
| `quality_doctrine.md` | 蜂群质量铁律（7 轮大神会审沉淀）：裁判权归代码、回归门不挂自评、尺子必须先刻真刻度等原则。 |
| `runtime_dependency_inventory.md` | 运行依赖清单：当前主线依赖但不能进 git 的外部运行资产。 |
| `commit_closeout_template.md` | 提交收口检查模板（5 项）。 |
| `architecture/court_pipeline_layering.md` | 朝堂管线四层分工（执行/参谋/闸/脸）+ 复杂度分档说明。 |
| `architecture/eval_validity.md` | 大神判分效度底账：信度与效度的诚实边界说明。 |
| `architecture/execution_primitive_map.md` | 执行原语映射：各单位对应系统/LLM/agent/工作流/蜂群的选择依据。 |

## 历史存档

| 文档 | 说明 |
| --- | --- |
| `history-jiqun-pack.md` | 旧 `backend/README.md` 中的 jiqun-flow / PACK 研发蜂群叙事，仅作后端能力演进史和行业样板参考。 |
