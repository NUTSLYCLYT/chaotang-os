# 朝堂 OS 2026-06-05/2026-06-06 收口汇总

本文件汇总 2026-06-05 和 2026-06-06 两天完成的主要工作、可用技巧、上线检查和一键部署入口。目标是让后续用户或 agent 能从这里恢复上下文、部署环境、验证质量，并继续推进。

## 一句话结论

这两天把朝堂从“多蜂群能跑”推进到“有真值、有质量门、有业务闭环、有首屏操作台、有 Golden 审批闸门”的状态。当前最强可展示板块是商机闭环：线索进入、OPC/产品/报价判断、质量门、业务状态卡、客户反馈、史馆归档、Golden 候选、人工晋升/拒绝、Web 首屏操作。

## 2026-06-05 完成事项

- 建立多蜂群真尺子：供应链、招聘、情报、预测、获客、PACK 研发等蜂群开始接入确定性检查器和真值台账。
- 修复关键假阳性：识别 pack_rd 失败主要来自裁判规则问题，而不是蜂群能力本身，修正检查器误判。
- 建立真值回写飞轮：供应链 outcome、客户真值、IMA 电芯测试结局、RAG 禁令等开始沉淀为可复用约束。
- 完成工部代码审查蜂群：四维度审查、PASS/BLOCK、must_not 闭环、并行会审和幂等台账。
- 建立直接命令系统：让用户能更直接地进入执行路径，减少“先解释、再猜要做什么”的摩擦。
- 沉淀质量纲领：强调假 FAIL 和假 PASS 一样危险，检查器必须有来源、验证和可回滚路径。

## 2026-06-06 完成事项

- 新增商业闭环 harness：
  - `lead -> opc -> product -> quotation -> quality_gate -> archive -> report`
  - dry-run 确定性模式
  - real/fast 模式
  - 数字接地、traceability、human signoff、runtime error 检测
- 新增可观测事件：
  - wide event JSONL
  - failure sample JSONL
  - ungrounded numbers
  - run ids、blocks、gate score、latency 等字段
- 新增业务账本：
  - 红黄绿状态
  - owner、next_action、forbidden_actions
  - mark actioned、record feedback、archive case
  - outcome: `no_response / invalid_lead / budget_changed / needs_full_proposal / quoted / won / lost`
- 新增 Golden 候选和审批：
  - failure/business outcome 自动进入 `needs_human_review`
  - 稳定 `candidate_id`
  - promote/reject append-only 审计事件
  - promote 必须人工 reference
- 新增 board review：
  - 9 轴成熟度评分
  - L2/L4 状态判断
  - pending/promoted/rejected Golden 计数
  - 大神评语与下一步构建建议
- 新增 Web 商机闭环首屏：
  - `商机闭环` 顶部入口
  - KPI、业务卡、禁止动作、下一步、Golden 审批
  - 待审候选可在页面内填写 reference/备注并晋升或拒绝
- 新增资源/开始面板相关体验：
  - 登录后资源模式
  - 朝堂默认/混合/用户自有资源策略
  - 开始任务的人类提示和风险预览

## 当前最适合展示的朝堂价值

商机闭环板块最能展示朝堂价值，因为它同时覆盖：

- 对小白用户：一眼看到能不能推进、谁负责、下一步、哪些话不能说。
- 对老板：能看到商机状态、风险阻塞、是否可归档复盘。
- 对工程质量：每次判断有 gate、evidence、must_not、traceability。
- 对持续学习：失败和真实业务 outcome 进入 Golden 候选，但必须人工审批。
- 对上线治理：报价、交期、安全/性能承诺被强制放进人工签字边界。

## 可使用技巧

- 先跑 deterministic harness，再跑真实模型：先用 `--dry-run` 验证合同、账本和质量门，再用 `--real --fast` 试模型。
- 不要直接把失败样本写进正式 Golden：先写入 `commercial_loop_golden_candidates.jsonl`，再人工 promote/reject。
- 小白用户优先看红黄绿和下一步：不要要求用户理解 trace JSON；系统内部保留 wide events。
- 每次报价/交期/安全承诺必须看 `forbidden_actions`：出现禁止动作时，不能对客户承诺。
- 用 `--review-board` 做上线前自检：L4 表示闭环可用，L5 还需要生产观测和 UI 审批完善。
- Git 提交不要 `git add .`：`config/providers.yaml`、`data/*.db`、`scripts/golden_cases/quality_baseline.json` 默认不进功能提交。
- 部署前先跑核心三件套：pytest、py_compile、dashboard/harness dry-run。

## 一键本地部署

```bash
bash scripts/bootstrap_chaotang.sh
```

脚本会：

1. 创建 `.venv`。
2. 安装 `requirements-core.txt`、`requirements-optional.txt` 和 `requirements-test.txt`。
3. 如缺少 `config/providers.yaml`，创建本地占位配置提醒用户补 key。
4. 跑商机闭环核心测试。
5. 启动 Web 到 `http://127.0.0.1:${FENGQUN_WEB_PORT:-8081}`。

Web UI 的 Golden 晋升默认写入
`harness/chaotang-commercial-loop/artifacts/commercial_loop_promoted_cases.json`，
不会直接改仓库内置的正式 golden cases。生产环境可用
`FENGQUN_COMMERCIAL_*` 指定持久化路径。Docker compose 默认把这些路径放到
`/app/data` volume。

常用环境变量：

```bash
export FENGQUN_WEB_PORT=8081
export FENGQUN_AUTH=true
export FENGQUN_COMMERCIAL_BUSINESS_LEDGER="$PWD/harness/chaotang-commercial-loop/artifacts/commercial_loop_business.jsonl"
export FENGQUN_COMMERCIAL_GOLDEN_CANDIDATES="$PWD/harness/chaotang-commercial-loop/artifacts/commercial_loop_golden_candidates.jsonl"
export FENGQUN_COMMERCIAL_EVENTS="$PWD/harness/chaotang-commercial-loop/artifacts/commercial_loop_events.jsonl"
export FENGQUN_COMMERCIAL_FAILURES="$PWD/harness/chaotang-commercial-loop/artifacts/commercial_loop_failures.jsonl"
export FENGQUN_COMMERCIAL_GOLDEN_CASES="$PWD/harness/chaotang-commercial-loop/artifacts/commercial_loop_promoted_cases.json"
export FENGQUN_JWT_SECRET="$(python - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
)"
export DEEPSEEK_API_KEY="..."
export OPENAI_API_KEY="..."
export ZHIPU_API_KEY="..."
export DASHSCOPE_API_KEY="..."
```

## 核心验证命令

```bash
pytest -q tests/test_commercial_loop_dashboard_api.py tests/test_web_index_resource_profile.py tests/test_commercial_loop_harness.py
python -m py_compile web/routers/commercial_loop.py web/main.py harness/chaotang-commercial-loop/scripts/run_harness.py
python harness/chaotang-commercial-loop/scripts/run_harness.py --dry-run --case-id cold_storage_100mwh --blocks opc
python harness/chaotang-commercial-loop/scripts/run_harness.py --review-board
python scripts/commit_closeout_check.py
```

## Gitee 推送前检查

```bash
git status --short
python scripts/commit_closeout_check.py
python scripts/commit_closeout_check.py --staged-only
git add docs/CHAOTANG_2026_06_05_06_CLOSEOUT.md scripts/bootstrap_chaotang.sh README.md
git add web/routers/commercial_loop.py web/index.html tests/test_commercial_loop_dashboard_api.py tests/test_web_index_resource_profile.py
git commit -m "feat: close out Chaotang commercial loop deployment"
git push origin feat/hubu-deterministic-core
```

不要提交：

- `config/providers.yaml`
- `data/fengqun.db`
- `scripts/golden_cases/quality_baseline.json`

## 大神会审结论

- 张小龙：继续减少解释，把“下一步”做成默认动作；审批不能像调试工具。
- Charity Majors：上线前必须能按 case、owner、model、gate reason、candidate_id 切长尾。
- Deming：不要用分数惩罚人；用 outcome 和 Golden 审批改系统。
- Harness optimizer：每个蜂群都要有 golden cases、deterministic checks、failure samples、human signoff 和 regression logs。

## 下一步建议

1. 把商机闭环 dashboard 的审批事件写入统一 observability event。
2. 接入 Sentry 或生产日志后端，记录 UI 审批成功/失败、耗时、reviewer。
3. 做一个真实客户商机样本，从线索到归档完整跑一遍。
4. 把 `scripts/bootstrap_chaotang.sh` 扩展到 Docker 和 systemd 两种部署模式。
