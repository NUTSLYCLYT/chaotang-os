# 需求说明

## 背景

朝堂 OS 的后端已拥有 CourtReview/FinalMemorial 事实源，但军机处与上书房仍能从前端本地
规则、关键词和聚合器生成结论，形成“第二大脑”。P4 要让前端只负责展示后端裁决。

## 范围

- 军机处投影 `task/review/formal_memorial/execution_status`。
- 上书房正式奏折、候选、直接回执、等待态的 canonical 展示。
- 生产 import 守门、旧引擎 test/eval-only 标记、无生产调用 writer 搬入 attic。
- `NEXT_PUBLIC_COURTOS_CANONICAL_PROJECTION` 安全 rollout。

## 非目标

- 不重写后端平台路由，不部署，不把后端蜂群逻辑搬进前端 harness。
- 不把 mock 当后端质量证明，不在 rollout 关闭时恢复旧前端引擎。

## 验收标准

- 正式快照优先于候选；候选、缺证、空态和未知均不伪装成正式通过。
- 四个旧引擎没有生产 import；后端 golden case 固化可保留/必须删除能力。
- 定向测试、类型检查、生产构建、浏览器烟测、三层 doctor 通过。
- 真实数据库验证前后 SHA-256 一致。

## 风险

军机处复杂展示、上书房轮询、source label、正式/候选竞态、旧 eval 依赖及 feature flag。

## 验证计划

- `pnpm exec tsx --test <P4 nodetest files>`
- `pnpm test:node`、`pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real pnpm build`
- `python3 -m pytest -q tests/test_frontend_second_brain_distillation.py`
- 三层 doctor、Playwright CLI 浏览器核验、`sha256sum backend/var/data/fengqun.db`
