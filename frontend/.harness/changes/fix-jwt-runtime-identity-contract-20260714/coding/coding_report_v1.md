# 实现报告 v1

## 改动

- 新增纯 JWT identity 分类器和 node 测试。
- prod doctor 读取后端公开 auth metadata，预检后才调用受保护 GET。
- 部署 env example 与 release operations 记录非秘密配置契约。

## 取舍

- key id 是人工轮换标识，不是 secret 哈希。
- probe token 只从外部环境临时注入，doctor 不现签生产 token。

## 验证

- 见 `ci_result/ci_summary.md`。
