# 实现报告 v1

## 改动

- 同源种两种真实登录 cookie，并只向子进程映射 COURT_TOKEN。

## 取舍

- 不在日志或报告中回显凭据。

## 验证

- 401 清零，study-edict PASS。
