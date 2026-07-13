# 需求说明

## 背景

8081 health 可达但候选 JWT 被受保护端点拒绝；现有 prod doctor 无法证明运行后端与候选 JWT 身份一致。

## 范围

增加非秘密 key id 契约、loopback protected probe 和 fail-closed 发布子门。

## 非目标

不读取 secret、不重启服务、不改 UI/BFF、不完成 JWT provisioning/rotation、不宣称 PROD。

## 验收标准

RED→GREEN；node/pytest、typecheck/build、三层 doctor 通过；live prod doctor 诚实 STOP 且报告无 token。

## 风险

高风险是 Bearer token 外泄；仅允许 loopback、标识不匹配不探测、报告不携带 token。

## 验证计划

node 聚焦测试、pytest、pnpm typecheck/build、三层 doctor、live prod doctor、diff/secret scan。
