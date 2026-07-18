# 朝会 Loop 激活蓝图（2026-07-19）

> 目标：把已移植进 ext 的朝会 loop harness（真相库/教训回避/矛盾检测/可信度评分/皇帝单屏）从"上膛未开机"变为**每日自转的信息供应链脊柱**：校真层闸门 + 交付层单屏 + 进化层教训库。
> 性质：**激活工程，不是移植工程**。2026-07-19 勘察结论：`feat/courtos-loop-harness` 的 9 个核心模块内容已全部存在于 ext backend（git 历史不相连，内容已落地），API router 已注册，前端契约已生成；缺的只有：①每日 runner 从未调度、零运行痕迹 ②进化层桥（朝会教训 → evolve lessons）未搭 ③单屏页面消费端未验证。
> 上位约束：`docs/plans/chaotang-os-full-court-loop-plan-2026-07-14.md` 的前置硬门——P0-B 归属漏洞行为门 `backend/tests/test_p0b_cross_user_behavioral.py` 当前仍有 **7 个 xfail = 7 个活漏洞**。本蓝图各步不得新增未设防端点；S4（单屏对外）显式受此门约束。

## 勘察事实底座（执行任何步前不需重查，过期再查）

| 事实 | 证据 |
|---|---|
| 9 模块已在 ext | `backend/src/{court_flywheel,knowledge_vet,signoff_learning,cross_dept_conflict,confidence_tag,truth_ledger}.py` + `backend/scripts/{daily_court_session,generate_bid}.py` + `backend/web/routers/court_session.py` 全部存在，行数≥分支版本 |
| API 已接线 | `backend/web/main.py:222,288` 注册 court_session router |
| 模块有真实调用方 | knowledge_vet←lipu_vet；confidence_tag←chancellor_router；signoff_learning←signoff_gate；truth_ledger←qintianjian_signals/court_doc_builder/pack_rd_check；daily_court_session 调全部 6 模块 |
| 测试已随行 | `backend/tests/` 含 14 个 court/confidence/conflict/bid 测试文件，含 `test_court_session_api_contract.py` |
| 前端契约已生成 | `frontend/src/lib/contracts/court-session.ts`、`backend-api.ts`、`api/chaotang.ts` 引用 court-session |
| **从未运转** | crontab 无 court 条目；`backend/var/` 无 court 产物；repo 内无任何 daily_court_session 调度配置 |
| 进化桥缺失 | evolve.sh 的 `KB=/home/ubuntu/.openclaw/knowledge`，morning 读 `$KB/lessons/<昨日>.md`（**不是** `evolution/lessons/`，两目录并存无 symlink，勿混）；且 `rate` 对当日文件是 `cat >` 整覆盖。朝会教训目前不写入任何 evolve 可见位置 |
| P0-B 门未清 | `grep -c xfail backend/tests/test_p0b_cross_user_behavioral.py` = 7（07-14 时为 12） |

仓库/分支：真身 `/home/ubuntu/Projects/chaotang-os`，工作检出 `/home/ubuntu/Projects/chaotang-ext-certification`（origin 指向真身），分支 `feature-chaotang-ext`。gh 已登录（github），但 origin 是本地路径 → **直连模式**：每步在 ext 上开 `task/court-loop-s<N>` 分支，完成后合回 feature-chaotang-ext，不走 GitHub PR；评审用 repo 惯例的 harness 变更记录（`backend/harness/changes/`）替代。

依赖图：

```
S1 体检 ──→ S2 自转上线 ──┬─→ S3 校真闸实证   （S3 ∥ S4 ∥ S5 可并行）
                          ├─→ S4 皇帝单屏（受 P0-B 门）
                          └─→ S5 进化桥
S3+S4+S5 ──→ S6 收官记录
```

---

## S1 · 体检：证明"能转"（先证明，再调度）

**上下文简报**：朝会 runner `backend/scripts/daily_court_session.py`（235 行，语法已验证可解析）串起 6 个模块产出当日朝报，router `web/routers/court_session.py` 的 `/court-session/latest` 读最新朝报。但它从未跑过——先手动跑通一次并让测试作证，才有资格上 cron。
**任务**：
1. `cd backend && python -m pytest tests/test_court_flywheel.py tests/test_confidence_tag.py tests/test_cross_dept_conflict.py tests/test_court_session_api_contract.py tests/test_bid_generator.py -x -q` — 全绿为准；红了先修（修不动→本步升级为修复步，蓝图变异协议见尾）。
2. 手动跑 `python scripts/daily_court_session.py`（读脚本头部确认所需 env/LLM 依赖；LiteLLM 走 `:4444`，蜂群路由名 `swarm-*`；`--out` 只许绝对路径——`ROOT / args.out` 对相对路径会静默偏移）。
3. 读取验证以 `pytest tests/test_court_session_api_contract.py` 为主；服务在跑时可选 `curl localhost:<端口>/api/court-session/latest`（注意前缀是 `/api/court-session`）。
**验证命令**：上述 pytest 退出码 0；朝报中**至少 1 个部门状态为 grounded/准奏**（解析状态字段，防"全部门报错仍写出非空文件"的假绿——runner 无条件写 header）；契约测试读到该朝报。
**退出判据**：一份含真实部门产出的朝报 + 测试绿 + latest 可读。产物路径和所需 env 记入本文件附录（S2 直接用）。
**回滚**：只读+产物文件，删产物即回滚。
**模型档**：默认档。

## S2 · 自转上线：每日朝会 cron

**上下文简报**：S1 已证明单次能跑并记录了 env/路径。本机 cron 惯例：走 `/home/ubuntu/bin/cron-run <name> <timeout_min> -- <cmd>` 包装（有告警）；**已知坑：cron PATH 缺 npm-global，脚本内必须显式 export PATH**（历史事故见记忆 feedback_cron_path_npm_global）。四套定时系统并存，主力是 crontab。
**任务**：
1. 写 `backend/scripts/run_daily_court.sh`：export PATH、cd 到 backend、带上 S1 记录的 env、调 daily_court_session.py，stdout/err 追加到 `var/logs/daily_court.log`。
2. crontab 加一行：`30 7 * * * /home/ubuntu/bin/cron-run daily-court 60 -- <脚本绝对路径>`（07:30 只是取"每日早于人醒"；S5 的桥**不**依赖当日时序——evolve morning 读的是昨日文件，真正的不变量是"朝会写入的文件活过次日晨读"，由 S5 的独立文件方案保证）。
3. 失败告警：cron-run 已有兜底；脚本内额外在失败时 `telegram-notify.sh` 一条。
**验证命令**：`bash backend/scripts/run_daily_court.sh` 手动全流程一次成功；次日检查 cron 真实产物 + log。
**退出判据**：连续 2 个自然日 cron 产出朝报（第 2 日为验收日）。
**回滚**：删 crontab 行 + 删脚本。
**模型档**：默认档。

## S3 · 校真闸实证：闸门真的拦，不是装饰（∥ S4、S5）

**上下文简报**：校真层 = knowledge_vet（核真库比对）+ confidence_tag（可信度章）+ cross_dept_conflict（矛盾表面化）。调用链存在≠闸门生效——repo 的老教训："被拒了"≠"因归属被拒"，同理"被标了"≠"标对了"。本步用破坏性实验实证。
**任务**：
1. 读 S2 产出的真实朝报，确认每条部门回奏带可信度章与核真结论；无矛盾日造一条跨部矛盾 fixture 验证矛盾章出现。
2. 前置检查：先确认 S2 真实朝报里各部门可信度**确有差异**（全员同分则实验 (b) 无法区分"闸坏了"和"没信号"，需先修信号粒度）。
3. 两个破坏性实验（repo 惯例，参照 P0-B 门的做法）：(a) 喂一条与核真库冲突的假声明 → 朝报必须标出；(b) 临时下调某部门可信度 → 朝报分级必须变。实验以测试形式留下（`tests/test_court_vet_adversarial.py`），跑完即为回归资产。
3. 结果不符 → 修闸，修完实验必须翻绿。
**验证命令**：新增 adversarial 测试绿；真实朝报含可信度/核真/矛盾三种章的实例证据。
**退出判据**：两个破坏性实验固化为测试且绿。
**回滚**：revert 本步分支。
**模型档**：最强档（闸门语义判断，容易做成假绿）。

## S4 · 皇帝单屏：交付层收口（∥ S3、S5；受 P0-B 门）

**上下文简报**：前端已有 court-session 契约与 API client（`frontend/src/lib/contracts/court-session.ts`），但页面消费端未验证。07-14 方案的 P0-B 行为门还剩 7 个 xfail，其中含列表泄露类端点——单屏是"读全朝廷裁决"的高权页面，归属/鉴权必须实证。
**任务**：
1. 查 frontend 是否已有单屏页面路由；无则建最小页面：今日裁决列表 + 可信度标注 + 待签台账区（≤1 屏，奏折制版式遵循 landing 仓设计宪法可后补，本步不做视觉打磨）。
2. **门检**：`/api/court-session/latest` 已带 `Depends(get_current_user)` 但**设计上就是全朝廷视图**（非按用户行归属数据）——P0-B 归属 probe 对它是范畴错误，不适用。本步门检改为三断言：端点有鉴权、在文档中显式标注"全局只读 by design"、不新增任何按 id 取用户数据的端点。
3. `pnpm build` 绿 + 页面真渲染一份 S2 朝报截图存证。
**验证命令**：鉴权断言测试绿（未登录 401）；前端 build 绿；截图存在。
**退出判据**：单屏页面渲染真实朝报，端点鉴权+全局语义有文档与测试实证。
**回滚**：revert 本步分支；页面未挂导航前对用户不可见。
**模型档**：默认档。

## S5 · 进化桥：朝会教训 → evolve 晨报（∥ S3、S4）

**上下文简报**：闭环点睛，但有两个已实证的坑：① evolve 的 `KB=/home/ubuntu/.openclaw/knowledge`，morning 读 `$KB/lessons/<昨日>.md`——**不是** `evolution/lessons/`；② `evolve rate`（含 07-19 新加的 24h 自动 5/10 兜底）对当日文件是 `cat >` **整覆盖**，任何"追加进同一文件"的方案都会被吃掉。因此桥用**独立文件**：朝会写 `$KB/lessons/court-<today>.md`，evolve 侧 morning 的 LAST_LESSON 块加一行也 grep court 文件——这是对 evolve.sh 的一处**显式获准的只读侧小改**（见不变量 3 例外条款）。
另一个坑：runner 目前只调 `recall_lessons`（回放旧教训进 prompt），**不产新教训**——`record_signoff`（写入方）未接。教训源必须先造出来。
**任务**：
1. 教训源：daily_court_session 里从当日朝报的矛盾章/核真结论派生教训条目（或接通 record_signoff），形成当日教训摘要。
2. 桥写入：摘要写 `~/.openclaw/knowledge/lessons/court-<today>.md`，含 `## 学到` 节；空教训日不写文件。
3. evolve.sh morning 的 LAST_LESSON 块加一行：`$KB/lessons/court-${YESTERDAY}.md` 存在则一并纳入"昨日要点"。仅此一行，不动其余逻辑。
4. 测试：造假朝报含矛盾 → 断言 court 文件出现教训行；无教训 → 断言文件不创建。**外加一次真实链路断言**：真实朝会跑出非合成教训至少一次（防"合成 fixture 绿、真链路永远空"）。
**验证命令**：测试绿；真实链路一次：朝会跑完 → 次日晨报 TG 消息"昨日要点"含朝会教训。
**退出判据**：晨报真实携带朝会教训一次。
**回滚**：删 `$KB/lessons/court-*.md`（一条 glob）+ revert evolve.sh 那一行 + revert 本步分支。
**模型档**：默认档。

## S6 · 收官：harness 变更记录 + 上位方案对账

**上下文简报**：repo 治理惯例——变更须在 `backend/harness/changes/` 留记录；07-14 全朝廷闭环方案是上位架构文档，本蓝图落地后需在其中标注朝会链路状态，防止两份文档漂移（用户军规：主动暴露矛盾）。
**任务**：
1. `backend/harness/changes/feat-court-loop-activation-20260719/` 变更记录：动机、S1–S5 证据锚点（测试名/产物路径/截图）、遗留项（P0-B 剩余 xfail 数、单屏视觉打磨、generate_bid 未纳入本轮）。
2. 在 07-14 方案文件头部加一行状态注记指向本蓝图。
3. 各 task 分支合回 feature-chaotang-ext（合并前 `python scripts/validate_flows.py` L1 绿）。
**验证命令**：L1 绿；变更记录存在；git log 可见各步合并。
**退出判据**：ext 上朝会链路 = 每日自转 + 三章实证 + 单屏 + 进化桥，全部有据。
**回滚**：逐步 revert。
**模型档**：默认档。

---

## 不变量（每步合并前自查）

1. `python scripts/validate_flows.py` 退出码 0（L1 结构门，零成本）。
2. 不新增无归属 probe 的端点（P0-B 表面积棘轮不许涨）。
3. 不动 evolve.sh 已有逻辑。**唯一获准例外（S5）**：morning 的 LAST_LESSON 块加一行读 `court-<昨日>.md`；超出此范围的 evolve.sh 改动先停下报告。
4. 每步产物有路径可指，无"应该可以"式验收（缺证率军规）。

## 蓝图变异协议

- **拆步**：任一步实际 >1 PR 量 → 拆 `S<N>a/b`，依赖边继承。
- **插步**：S1 测试红且修复非平凡 → 插 `S1.5 修复步`，S2 依赖改挂 S1.5。
- **弃步**：S4 若 P0-B 补洞工作量失控 → 单屏降级为"本机 curl 可读"，页面挂导航延后，其余步不受影响。
- 变异须在本文件尾部追加一行审计记录（日期/动作/原因）。

## 审计记录

- 2026-07-19 · 对抗性评审（最强档）11 findings：2 CRITICAL（S5 桥路径错指 evolution/lessons；rate cat> 覆盖吃掉追加）+ 2 HIGH（S1 非空文件假绿；S5 教训源为空）+ 7 M/L，已全部修入本版。评审同时核对事实底座 4 项抽查通过。

## 附录（S1 已回填 2026-07-19）

- 朝报产物路径：`backend/var/reports/court_session/今日朝报-<YYYY-MM-DD>.md`
- runner 所需 env：`backend/.env`（从真身 `~/Projects/chaotang-os/backend/.env` 复制，含 LITELLM_PROXY_KEY；.env 已在 .gitignore）。LLM 网关 `127.0.0.1:4444`（无 key 探活返回 401 = 活着，勿误判假红）
- RAG 前置：新检出必须先 `python scripts/seed_sqlite_vec_knowledge.py`（sqlite-vec 库是运行产物不入 git，S1 时 count=0 灌成 13）
- `--out` 只许绝对路径；curl 端点前缀 `/api/court-session`
- S1 证据：37 passed 2 skipped；2/2 部 submitted 且核真✅有据；可信度章/矛盾章在真朝报出现
- S3 线索：confidence_tag 会给标题序号和数字中缝盖章（如 `### 1[一手].`、`42288[待核·无源]-2022`）——粒度噪声，S3 需处理
