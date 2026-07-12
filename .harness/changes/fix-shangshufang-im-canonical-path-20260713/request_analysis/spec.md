# 规格说明：fix-shangshufang-im-canonical-path-20260713

## 背景

真实 production 浏览器请求 `/api/court/shangshufang/im` 返回 404，后端 canonical contract 为 `/api/shangshufang/im`。

## 范围

仅修正 IM URL 与对应 E2E 拦截路径，补回归测试。

## 非目标

不修改 UI、后端路由、蜂群执行或归档逻辑。

## 验收标准

真实浏览器 IM GET/POST 全部 200，控制台无错误。

## 验证计划

TDD node test、tsc、build、production Playwright 真链。
