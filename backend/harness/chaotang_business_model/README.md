# 朝堂商业模式 Harness

本 harness 把朝堂 OS 的商业设计转成可复验的确定性检查，确保信任模型、用户价值、收入路径和投资叙事保持一致。

## 输入

- `business_model.yaml`
- `golden_cases/business_model_cases.json`

## 入口

```bash
cd backend
python harness/chaotang_business_model/scripts/run_business_model.py
```

## 检查重点

- 用户问题是否真实。
- 产品价值是否能被验证。
- 收入路径是否与用户信任模型冲突。
- 风险是否明确归因。
- 输出是否给出下一步行动。

## 测试

```bash
cd backend
python -m pytest -q tests/test_chaotang_business_model.py
```
