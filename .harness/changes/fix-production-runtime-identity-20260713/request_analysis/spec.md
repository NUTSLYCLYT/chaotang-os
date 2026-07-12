# 规格说明：fix-production-runtime-identity-20260713

## 背景

3050 返回 200 空台账，而 8081 返回 401。调查确认 3050 来自旧工作树；现有门禁只检查端口与健康，不证明运行实例属于当前工作树。

## 范围

增加 production listener cwd 归属门禁，并用当前 HEAD production 实例复测代理和真实业务冒烟。

## 非目标

不修改 UI、后端路由、数据模型或正式 master-only 发布策略。

## 验收标准

外部工作树的 3050 必须 STOP；当前工作树保持既有检查；代理不得改写后端状态和正文。

## 验证计划

先写失败回归测试，再运行 node test、production build、curl 矩阵和浏览器冒烟。
