# 任务拆解

## 任务 1：canonical runtime env

- 目标：消除自动 sibling repo 环境漂移。
- 输入：三处 env candidate lists。
- 输出：canonical override/default 与回归测试。
- 验收：RED 3/3→GREEN 3/3；type/build/doctor。
- 依赖：monorepo `backend/.env` 或显式 operator override。
