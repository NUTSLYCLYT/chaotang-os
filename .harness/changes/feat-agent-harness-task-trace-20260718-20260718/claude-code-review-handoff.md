# Claude Code 独立审查交接单

## 审查对象

M1「统一 TaskEnvelope / TraceContext」，提交 `b87113e`。

## 必审文件

- `backend/src/contracts/task_trace.py`
- `backend/tests/test_task_trace_contracts.py`
- `request_analysis/spec.md`
- `ci_result/ci_summary.md`

## 审查问题

1. `TaskEnvelopeV1` 是否具备稳定、最小且可序列化的任务字段？
2. `TraceContext` 是否正确表达 trace/span/parent span，并拒绝空标识？
3. `from_legacy()` 是否只做兼容转换，不吞掉未知字段或改变业务语义？
4. Pydantic 版本用法是否与项目一致，是否存在 Python 版本兼容风险？
5. 是否有越界接入、数据库变更、路由行为变化或发布承诺？
6. 测试是否覆盖成功、非法身份和旧式输入三类行为？

## 必跑命令

```bash
python3 -m pytest -q backend/tests/test_task_trace_contracts.py
python3 backend/scripts/harness_doctor.py
node scripts/harness-doctor.mjs
git diff --check
```

## 输出格式

结论：`GO` / `GO_WITH_ACTIONS` / `NO_GO`

证据：逐项列出文件、测试和命令结果；问题标注 HIGH/MEDIUM/LOW。

阻塞项：没有则写“无”。

进入 M1-B 的前置条件：明确说明是否允许把契约接入真实路由。

只读审查，不修改文件，不提交代码。
