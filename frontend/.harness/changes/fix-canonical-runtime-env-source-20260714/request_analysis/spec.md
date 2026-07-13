# 需求说明

## 背景

三个前端运行消费者仍自动猜测旧 sibling backend `.env`，可导致当前 monorepo 静默使用旧仓 secrets/config。

## 范围

自动来源只保留 `../backend/.env`；新增 `CHAOTANG_BACKEND_ENV_FILE`；旧 override 仅显式兼容。

## 非目标

不读取/修改 secret 内容，不删除兼容变量，不处理历史文案与其他旧路径。

## 验收标准

三消费者契约 3/3，S1 回归、TypeScript、real-mode build 和 doctor 通过。

## 风险

外部部署可能依赖旧显式变量，因此保留变量但删除自动路径猜测。

## 验证计划

Node contracts、tsc/build、doctor、prod doctor、diff/security。
