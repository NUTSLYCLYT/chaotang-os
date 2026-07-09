@AGENTS.md

# Claude 入口

本文档只做极简启动提示。后端事实源是同目录 `AGENTS.md`、`harness/README.md` 与 `harness/manifest.json`，不维护第二套规则。

## 启动顺序

1. 读取 `AGENTS.md`。
2. 读取 `harness/README.md` 与 `harness/manifest.json`。
3. 按任务读取对应 harness 的 README、运行器、基准样本或测试。
4. 修改后端 harness 文档、清单或脚本后运行 `python scripts/harness_doctor.py`。
5. 项目级改动后，回到根目录运行 `node scripts/harness-doctor.mjs`。

## 当前边界

`backend/` 负责运行服务、flow、agent、prompt、provider、数据源、真实客户样本和后端运行/评测 harness。其他工程线的体验实现、发布体验或构建产物只通过根级清单协调，不在后端入口文档中展开。
