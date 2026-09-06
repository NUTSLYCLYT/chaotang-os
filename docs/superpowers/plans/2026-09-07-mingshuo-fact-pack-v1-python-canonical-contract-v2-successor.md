# 铭硕 Fact Pack V1 Python Canonical Contract V2 Plan

任务：`MINGSHUO-FACT-PACK-V1-PYTHON-CANONICAL-CONTRACT-V2-SUCCESSOR-20260907`

## Status

Draft

## Product Definition

让 Python 成为 Fact Pack 的唯一语义 evaluator；Node 是受固定解释器、文件 manifest、资源界限和清退协议约束的本地 compatibility relay。它不是服务端执行器，也不会触及运行时业务链。

## Acceptance Criteria

- [ ] corpus 分离 legacy Node semantic source identity 与 candidate Python identity；每个 expected closed result 经人工审计。
- [ ] schema/evaluator identity manifest、local-only `$ref`、strict parser、recursive redaction 和 resource limits 全部有负向测试。
- [ ] Node 仅 `--check`/`--evaluate-wire`；固定 `/usr/bin/python3.12` 3.12.3，关闭 PATH，超时 TERM→250ms→KILL→reap，无 orphan。
- [ ] 全部 machine matrix、10轮及三审通过。

## Delivery Constraints

- exact7 only；不改服务路由、持久化、系统隔离服务、UI、产品事实源或 release。
- 仅 synthetic fixture；无网络、外部模型、真实客户或凭据。

## Affected Modules

- 模块：backend canonical Fact Pack evaluator and Node compatibility adapter。

- 允许路径：formal manifest 的七条 product paths。

## Technical Plan

1. RED：Python module absent；corpus semantic drift；schema remote ref、raw leakage、source manifest drift、invalid interpreter、resource overflow和orphan failure。
2. GREEN：Python strict evaluator/closed serializer；golden corpus；Node pinned relay and deterministic cleanup.
3. Verify：focused Python → backend-full/Ruff → Node → Harness/self-test/doctor/doctor-tests/hook/authority/V2/diff → 10 identical rounds → three reviews → machine verify.

## Implementation Report

Draft only. It preserves both predecessor drafts as rejected evidence and does not inherit an approval, candidate, validation, review or authority identity.

## Acceptance Review

Pending. Stop if output can contain raw pack content, an evaluator dependency is unbound, Node contains semantic logic, a child survives cleanup, or any matrix gate fails.
