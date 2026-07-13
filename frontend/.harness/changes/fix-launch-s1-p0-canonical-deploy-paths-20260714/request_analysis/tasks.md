# 任务拆解

## 任务 1

- 目标：将本批 P0 部署入口收敛到唯一 monorepo 事实源。
- 输入：当前 tracked 配置、canonical origin 与目录结构。
- 输出：六个配置/文档变更和一个跨线防回归测试。
- 验收：逐文件 RED→GREEN，并完成候选 PR verification-loop。
- 依赖：不依赖生产进程接管；外部信任锚留到 S10。
