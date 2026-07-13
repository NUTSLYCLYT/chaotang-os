# 实现报告 v1

## 改动

- compose backend context 从退役相邻仓改为 monorepo `../backend`。
- 两份前端部署 unit 与一份后端 unit 改用 canonical checkout。
- 恢复手册改为一次克隆 `chaotang-os`；env 标题去除旧产品名。
- 新增六项静态路径契约测试。

## 取舍

- 只修改路径，不统一 uvicorn/gunicorn、user/system service 或 restart 策略，避免扩大行为风险。
- 保留 legal-agent 为明确标注的外部依赖。

## 验证

- RED：`node --test scripts/canonical-deploy-paths.nodetest.mjs`，0/6 passed。
- GREEN：相同命令，6/6 passed。
- 完整证据见 `ci_result/ci_summary.md`。
