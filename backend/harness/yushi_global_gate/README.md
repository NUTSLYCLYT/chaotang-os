# 御史总判 Global Gate

目标：把朝堂各部门输出统一纳入“风险、收益、证据、自动化权限”判决，避免只靠人工感觉放行。

第一版覆盖五类主线风险：

1. 依赖安全
2. 输出乱数字
3. 客户承诺
4. 自动执行
5. Web/UI 主线偏移

## 运行

```bash
python harness/yushi_global_gate/scripts/run_gate.py
```

默认读取 `golden_cases/global_gate_cases.json`，输出：

- `harness/yushi_global_gate/artifacts/latest.json`
- `harness/yushi_global_gate/artifacts/latest.md`
- `harness/yushi_global_gate/artifacts/ledger.jsonl`

也可以传入单个 JSON：

```bash
python harness/yushi_global_gate/scripts/run_gate.py --input-json case.json
```

## 判决等级

- `green`: 可直接放行。
- `yellow`: 可输出，但必须带条件、证据或人工复核点。
- `red`: 阻断，回到工部/钦天监/业务部门修正。
- `black`: 高危，进入刑部/红蓝对抗/事故流程。

## 判决卡字段

每次判决输出：

- `risk_level`
- `benefit_score`
- `evidence_score`
- `automation_level`
- `decision`
- `conditions`
- `findings`
- `red_team_required`
- `archive_to_shiguan`
- `next_gate`

## 设计原则

御史不是审批官，而是全局收益守门人：低风险自动放行，高风险明确阻断，中风险给出变成可放行的条件，所有结果进史馆形成下一轮规则。
