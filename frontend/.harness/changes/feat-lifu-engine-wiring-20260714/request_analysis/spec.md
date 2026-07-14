# 需求说明

## 背景

后端已经提供真实礼部引擎：`POST /api/swarm/lipu/compliance-report` 每次运行 `flow_lipu`，聚合 `lipu_vet` 确定性素材回链硬闸、`lipu_review` LLM 软意见，以及可选的 `xhs_monitor` 舆情软意见。礼部前端工作台此前只有浏览器本地 TypeScript 决策模块，没有调用该端点，却有四个办公室被标为 `engine:true`。

## 范围

- 新增礼部合规响应类型、边界校验和 authenticated backend adapter。
- 在 `commitment_gate` 工作台提交任务文本，展示硬闸灯、核查项、两路软意见、缺失覆盖和源标签。
- 后端不可达、非 2xx 或响应形状漂移时展示诚实 `FALLBACK`。
- 只保留实际接后端的 `commitment_gate.engine=true`。
- 更新 `docs/product/PROJECT_PRODUCT.md` 第 7.1 节礼部能力口径。
- 新增 adapter node 回归测试和完整前端 change 记录。

## 非目标

- 不修改礼部后端 engine、flow、prompt、provider 或测试。
- 不传入或构造虚假的 xiaohongshu project 关联；未关联时展示后端缺失覆盖。
- 不把本地报价、关系台账、增长或危机模块声明为后端引擎。
- 不新增 BFF、App Router route handler、server action 或 `src/app/api/**`。
- 不触碰 dadian、其他部门、`scripts/lib/**` 或 dev/ext refs。

## 验收标准

- adapter POST 精确 canonical path，请求至少包含非空 `task_input`。
- 成功响应经过形状校验，顶层及两路意见的 `source_label` 原样传给 UI，不硬编码 LIVE。
- UI 明示硬灯只由确定性门决定，并分别展示三源结果或缺失状态。
- 后端/认证/响应失败不生成报告，唯一降级标签为 `FALLBACK`。
- roster 统计为 `1/8`，只有 `commitment_gate` 为真引擎。
- 指定 TypeScript、node test、frontend doctor 和两组 backend pytest 全部通过。

## 风险

- endpoint 非幂等且会触发真实 LLM 流程，按钮必须显示运行中并阻止重复点击。
- response 没有 Pydantic response model；前端必须在边界校验关键字段，防止把漂移数据当真实判定。
- `project_id` 不传时第三源不会关联，UI 必须展示后端返回的 `missing_coverage`。
- source label 属高风险事实边界，任何本地改写都可能造成 LIVE 误导。

## 验证计划

- `cd frontend && npx --yes tsc --noEmit`
- `cd frontend && npx --yes tsx --test src/features/lifu/api/lifu-compliance.nodetest.ts`
- `cd frontend && node scripts/harness-doctor.mjs`
- `cd backend && python3 -m pytest -q tests/test_lipu_vet.py tests/test_lipu_compliance_report.py`
