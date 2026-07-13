# 实现报告 v1

## 改动

- `ShangshufangTaskStatusResponse` 增加 `formal_memorial`。
- `latest_memorial` 增加可选 `formal_memorial_id`。

## 取舍

- 后端拥有真实性和来源规范化；前端只声明/消费，不复制质量门。

## 验证

- tsc、contract baseline、frontend doctor。
