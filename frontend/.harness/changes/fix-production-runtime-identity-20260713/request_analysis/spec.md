# 需求说明

## 背景

旧工作树的 3050 静默返回前端 BFF 空数据，现有 prod-doctor 却没有校验监听进程归属。

## 范围

监听进程 cwd 不等于当前 checkout 时返回 `foreign_prod_3050` 并 STOP。

## 非目标

不修改 UI、后端契约或正式部署源规则。

## 验收标准

foreign/same/missing 三分支测试通过，且真实旧进程被 STOP、当前进程通过端口门。

## 风险

受限系统无法读取 `/proc/<pid>/cwd` 会 fail-closed；发布门禁宁可停止，不可假绿。

## 验证计划

node test、production build、prod-doctor、curl 代理矩阵、Playwright 登录。
