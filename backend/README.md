# 朝堂 OS 后端

本目录是 `chaotang-os/backend`，承载朝堂 OS 的运行服务线：flow engine、agent 编排、prompt、provider 路由、模型调用、API 与后端运行/评测 harness。

当前后端入口以本文件、`AGENTS.md`、`harness/README.md` 和 `harness/manifest.json` 为准。历史 jiqun-flow / PACK 研发蜂群叙事已经降级到 `docs/history-jiqun-pack.md`。

## 项目位置

朝堂 OS 的主流程是：

```text
老板一句真实经营问题
  -> 上书房整理成事项
  -> 丞相给初判和路径
  -> 军机处召集专业视角
  -> 六部 / 诸司给判断和风险
  -> 形成一份奏折
  -> 老板裁决
  -> 史馆留痕
```

后端负责其中的运行事实、专业判断、蜂群执行、provider 调用、质量闸门、证据记录和可复验输出。前端负责浏览器体验、展示、交互和用户可见验证。

## 后端拥有

- flow engine、agent 编排、prompt 和 provider 路由。
- 运行 API、数据源逻辑、真实客户样本、运行记录和质量基线。
- 部门协议、商机闭环、真实闭环、御史全局闸门、法务红队等后端 harness。
- 运行失败、模型错误、证据缺口、人工签字闸和 source label 的后端事实来源。

## 后端不拥有

- Next.js 页面、浏览器交互、前端发布页和前端构建产物。
- 用前端 mock 或静态样例证明后端运行质量。
- 把 DEMO、FALLBACK 或空输出包装成 LIVE 运行结论。
- 本机 provider/API key、临时实验输出、模型评分日志等提交内容。

## 目录导航

| 路径 | 作用 |
| --- | --- |
| `src/` | 后端领域逻辑、flow、蜂群、provider、质量与安全模块。 |
| `web/` | API、schemas、session、安全中间件和 Web 服务层。 |
| `config/` | flow、角色、feature flag 和运行配置样例。 |
| `runtime_prompts/` | 运行时 prompt 资产。 |
| `harness/` | 后端运行/评测 harness 包和清单。 |
| `tests/` | 后端单测、harness 测试和回归检查。 |
| `docs/` | 后端运行服务线文档。 |

## Harness 入口

`harness/manifest.json` 是后端 harness 的唯一清单。新增主 harness、实现包、共享基础设施目录或代表性测试时，必须同步更新这份清单。

常用命令：

```bash
python scripts/harness_doctor.py
python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py
python scripts/commit_closeout_check.py
```

根级工程检查会委托后端 doctor：

```bash
cd ..
node scripts/harness-doctor.mjs
```

## 运行与配置

真实模型、高成本或会写入运行账本的命令，需要先确认 provider、预算、超时和输出路径。

不要把以下内容混进提交，除非用户明确要求：

- `config/providers.yaml`、`.env`、本机 provider/API key 配置。
- `data/`、`memory/`、`events/`、`swarm_sessions/`、`reports/`。
- 临时实验、一次性脚本、下载结果、模型评分日志。

Windows 终端如遇中文 diff 解码问题：

```powershell
$env:PYTHONUTF8='1'; python scripts\commit_closeout_check.py
```

## 历史材料

- `docs/history-jiqun-pack.md`：旧 jiqun-flow / PACK 研发蜂群 README 内容，作为后端能力演进和行业样板历史保留。
- `docs/jiqun_architecture.md`：jiqun 架构历史说明。

当前项目口径以根级 `../AGENTS.md`、`../docs/PROJECT_PRODUCT.md`、后端 `AGENTS.md`、后端 harness manifest 和 doctor 输出为准。
