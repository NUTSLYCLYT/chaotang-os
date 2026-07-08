# 上线就绪总账 — 所有缺陷的唯一去处(放哪)

> 缺陷、状态、修法、顺序都在这。每次改动更新本表。判据:**契约齐 ≠ 能上线**——
> 落库了吗?角色能授吗?真数据验证了吗?未接地会不会冒充权威?前端接了吗?
> 来源:用户旅程走查(储能老板上传真合同→审→准奏→御史放行→归档)+ 真实样本回归(本司真协议)。

## 判据:上线门(每项必须绿)
1. 用户点了算不算数(状态落库)
2. 核心治理动作有没有人能执行(御史授权)
3. 二级页有没有真数据(司档案)
4. 判决可不可信(有据/引证,未接地不冒充权威)
5. 用户进来知不知道干嘛(pending action)
6. 判决在真实客户样本上验证过没有
7. 前端接没接
8. 生产架构下护栏是不是真的(幂等/多实例)

## 缺陷台账

| # | 缺陷 | 严重 | 状态 | 修法 | 提交 |
|---|---|---|---|---|---|
| 洞A | 点了不算数(状态不落库) | 🔴 | ✅已修 | court_state_store 落库,权威态以存储为准 | 8b700d1 |
| 洞B | 御史放行没人能点 | 🔴 | ✅已修 | court_roles 白名单(config 授权,不自助) | 8b700d1 |
| 洞C | 司档案空壳 | 🟠 | ✅已修 | 归档打 dept/si 标签 + records_for_si 读端 | d86c661 |
| E | 进来第一眼不知干嘛 | 🟡 | ✅已修 | pending_action(此刻最该决什么) | 44f4a82 |
| **F** | **未接地判决冒充权威**(rag_hit=False 仍下"可签") | 🔴 | ✅已修 | 接地看引证后,未引证→接地门自动降级"需人工律师复核" | (本批) |
| **G** | **findings 无引证**(和顶级产品最大差距) | 🔴 | ✅已修 | _EXTRACT_SYS 强制 basis 条号 + 禁编造;透传前端;真合同实测引到第621/618条 | (本批) |
| **H** | is_grounded 语义错(查输入含不含法条,应查 findings 有没有据) | 🔴 | ✅已修 | _findings_grounded:接地=红/黄项是否引到条号,不看输入词 | (本批) |
| I | 法条语料薄 + 引证不可核 | 🟠 | ✅已修 | 补第615/617/618条;lawyer_rag.verify_citation 把 AI 引证→库内可核(编造/引错条号被抓) | (本批) |
| J | 真实样本回归缺失 | 🟠 | ✅已修 | tests/real_samples/ 脱敏样本 + scripts/real_sample_regression.py;真合同实跑通过 | (本批) |
| K | 前端没接契约 | 🟡 | ⛔他仓 | chaotang-web-lyt 按 action_contract/si_profile_contract 接(本仓做不了) | — |
| L | 幂等台账单机多进程有竞态(check-then-act 无锁) | 🔴→✅ | ✅已修(单机) | schneier 天才建议:gunicorn/uvicorn 生产默认 workers=cpu*2+1,"单实例"本身已是多进程;claim_idempotent 用文件锁把"读-判断-写"包成原子操作,tests/test_court_idempotency_race.py 16 线程并发实测只放行 1 个。跨机多副本仍需换 Redis/DB(接口不变) | (本批) |
| L2 | 跨机多副本时幂等后端仍是本机文件 | 🟡 | ⏸待架构(已挂护栏) | deming 天才建议:不写文档等人记得,改成可执行门禁——scripts/idempotency_backend_gate.py 读 FENGQUN_DEPLOY_REPLICAS,>1 直接 FAIL,逼部署前先换 Redis/DB 再上多副本 | (本批) |
| M | court_state.json 落盘同样无锁(get_state/set_state) | 🔴→✅ | ✅已修 | karpathy 天才建议:锁已经在(L 修时建的 `_file_lock`,按 path 区分互斥,court_state.json/court_idempotency.json 各自独立),复用增量很小,顺手堵掉——set_state 包进同一把锁。tests/test_court_idempotency_race.py::test_concurrent_set_state_no_lost_writes 20 线程并发实测:修前直接写坏 JSON(JSONDecodeError),修后 20 条记录一条不丢 | (本批) |
| N | 未接地空判决挂绿灯(items 为空时 compute_light 恒 green) | 🔴 | ✅已修 | 用户 H 盘真实扫描件合同(pypdf 抽不出文字)暴露:LLM 收到空文本→0 findings→compute_light([]) 恒 green,即便 gate 已因未接地降级,headline 有"需人工"但 light 红绿灯字段仍是 green——只读 light 的消费方会误判"审过没问题"。build_court_doc 里 gate=pending 时 light 若仍 green 顺带降成 yellow;抽取诊断挪到 scripts/real_sample_regression.py 读取层("疑似扫描件"),不再送 LLM 空转 | e9d233c |

## 执行顺序(方案)

**第一批(本轮,判决可信度——和顶级产品差距最大)**
- **F 未接地降级**(schneier 最紧急):未接地判决**先别冒充权威**——light 降级、headline 标"仅供参考,未经法条核验"。小改,先堵。
- **G+H 强制引证接地**:复用已有 lawyer_rag + statutes + 大神判例口径(reference 必带条号),让每条 finding 带条号、无据降"待核";修 is_grounded 语义为"逐条 finding 是否有据"。
- **J 真实样本回归**:本司真协议(脱敏)入 tests/real_samples/ + 回归脚本,每次改判决必跑(deming:真样本比造的判例更能暴露框架自欺)。

**第二批(需持续投入)**
- **I 扩法条语料**:灌民法典合同编 + 电池国标。机制(G)对了后持续灌。

**第三批(依赖外部)**
- **K 前端接**:chaotang-web-lyt(另一个仓,需前端投入)。
- **L2 跨机幂等**:上线架构定了(是否多副本)再决定换 Redis;部署脚本设 `FENGQUN_DEPLOY_REPLICAS`,门禁(scripts/idempotency_backend_gate.py)会在真上多副本前拦停,不用等人记得。

## 原则
- 每修一个洞必**端到端复走 + 真实样本回归**,不信"框架有就行"(洞A/军机处/接地门都栽在"框架有、执行空")。
- 未验证的能力**诚实标注**,不冒充权威(F 就是这条的执行)。

## 附:同款洞(F/N)在 court 旅程之外的全仓扫描

修完 F/N(未接地不冒充权威)后顺手让 Explore agent 扫了一遍全仓,找"空结果默认判安全/健康"这一类模式。
不算本表的上线门(不在储能合同这条用户旅程里),单独记这里,别丢:

- `src/kpi_tracker.py`:窗口内 0 样本时 qa_pass_rate 兜底 1.0、error_rate 兜底 0.0、p95 兜底 0,
  三者都让 `/api/kpi/slo` 显示 "healthy"——仪表盘"健康"可能只是没有任何数据在跑(记录链路断了)。
  已修:0 样本时 status="no_data",且 samples 字段接进响应体。(提交:本批,tests/test_kpi_slo_no_data.py)
- `web/routers/swarm.py`:`_derive_release_gate([])` 以前恒返回 "clear"——session 若在任何 run
  落盘前就崩了(status=failed 但 swarm_runs=[]),读出来 release_gate 却是"clear"。已修:空 runs
  返回 "unknown",不跟"真审过、确认没问题"的 clear 混。(提交:本批,tests/test_swarm_release_gate.py)
- `src/step_assertions.py`:未知断言类型被静默跳过,若一个 step 所有断言类型都识别不了,
  `results=[]` 触发 Python 的 `all([])==True` 空真值,硬性约束门形同虚设。**没有修**——
  `tests/test_step_assertions.py::TestUnknownType::test_skips_unknown` 明确把这个行为断言成"预期",
  可能是刻意的版本兼容设计(旧引擎遇到新断言类型不该硬挡)。这是设计取舍,不是明显疏漏,留给用户判断
  要不要改成"未知类型直接 hard_fail"。
