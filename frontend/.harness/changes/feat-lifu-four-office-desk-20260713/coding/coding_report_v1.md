# 实现报告 v1

## 改动

- 启用礼部 canonical route 并接入 4 司 LOCAL 工作台。
- 多列录入表在手机端改为单列；任一输入变化立即清除旧裁决，避免过期结果继续显示。
- 礼部 E2E 优先使用环境注入 token；无 token 时才在运行时生成一次性账号与随机密码完成真实注册/登录，不在源码中保留固定凭据。

## 取舍

- 工作台继续诚实标记 LOCAL，不冒充 LIVE；未接线司局继续标记待通电。

## 验证

- 礼部 nodetest 37/37，Playwright E2E 6/6，TypeScript 通过，production release gate GREEN。
