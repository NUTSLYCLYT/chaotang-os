# 朝堂 OS 后端 Agent 入口

本文档是 `chaotang-os/backend` 的后端 agent 入口。

## 当前定位

`backend/` 是朝堂 OS 的运行服务线，负责：

- flow engine、agent 编排、prompt、provider 路由和模型调用。
- 真实客户样本、运行记录、质量基线、API 与数据源逻辑。
- 后端运行/评测 harness：`harness/`。
- commercial-loop、legal-redteam、department protocol、yushi global gate 等可靠性闸门。

`backend/` 不负责其他工程线的体验实现、发布体验或构建产物。涉及跨线归属时，只记录根级协调结论，不把对应实现细节写入后端 harness。

## 启动顺序

1. 先读根入口 `../AGENTS.md`，确认本轮任务确实属于后端线。
2. 查看 `harness/README.md` 与 `harness/manifest.json`。
3. 修改后端 harness 前，确认目标目录是主 harness、实现包还是共享约定。
4. 后端 harness 架构变更需要在 `harness/changes/` 下创建或更新 change 记录。
5. 修改后端 harness、入口文档或清单后，运行 `python scripts/harness_doctor.py`。
6. 跨项目级变更还要回到根目录运行 `node scripts/harness-doctor.mjs`。

## Harness 分层

| 层级 | 路径 | 职责 |
| --- | --- | --- |
| 根级协调 | `../.harness/` | 项目 manifest、跨线边界、根级 doctor |
| 后端运行/评测 harness | `harness/` | 后端 manifest、共享契约、基准样本、运行器、门禁 |

`harness/manifest.json` 是后端 harness 的唯一清单。新增主 harness、实现包、共享基础设施目录或代表性测试时，必须同步更新这份清单。

## 常用命令

```bash
python scripts/harness_doctor.py
python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py
python scripts/commit_closeout_check.py
```

Windows 终端如遇中文 diff 解码问题，使用：

```powershell
$env:PYTHONUTF8='1'; python scripts\commit_closeout_check.py
```

## 提交边界

不要把以下内容混进功能提交，除非用户明确要求：

- `config/providers.yaml`、`.env`、本机 provider/API key 配置。
- `data/`、`memory/`、`events/`、`swarm_sessions/`、`reports/`。
- 临时实验、一次性脚本、下载结果、模型评分日志。
- 根级清单归属到其他工程线的体验实现或构建产物。

## 收口

最终说明需要列出：

1. 本轮目标。
2. 应提交文件。
3. 不应提交文件。
4. 实际验证命令。
5. 回滚方式。
