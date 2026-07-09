# 朝堂功劳系统 Harness

本 harness 定义朝堂后端第一版功劳、成长和权益检查规则。它不替代商业闭环或部门协议，而是在后续消费这些输出时保证“功劳有证据、权益不越权”。

## 核心规则

- `gongye` 是荣誉账本，不能购买、转让或兑现。
- 任何权益必须能追溯到真实贡献或已通过的任务。
- 计分结果必须保留 case id、owner、证据和下一步。
- 商业计费走平台计费流程，不由功劳系统直接决定。

## 输入

- `rules.yaml`
- `golden_cases/merit_cases.json`

## 入口

```bash
cd backend
python harness/chaotang_merit_system/scripts/run_merit.py
```

## 测试

```bash
cd backend
python -m pytest -q tests/test_chaotang_merit_system.py
```
