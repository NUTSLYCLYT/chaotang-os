# 能力建设清单

本清单记录最近沉淀到仓库里的 Claude/Codex 协作能力。下载用户可以从这里快速知道“有什么、在哪里、怎么用”。

## 开发效率协议

| 能力 | 文件 | 用途 |
|---|---|---|
| Codex 能力地图 | `docs/codex_capability_map.md` | 说明能做什么、不能做什么、何时人工签字 |
| 朝堂开发执行协议 | `docs/chaotang_execution_protocol.md` | 四种模式：直接做、先审查、开钦天监、只解释 |
| 朝堂部门协同契约 | `docs/chaotang_department_operating_contract.md` | 统一部门输出字段、职责边界、御史总判接入和下一站路由 |
| 朝堂全院回奏流水线契约 | `docs/chaotang_memorial_pipeline_contract.md` / `harness/chaotang_department_protocol/departments.yaml` | 统一“用户下旨 -> 各司报告和附件 -> 部门回奏 -> 军机处审核 -> 丞相建议 -> 用户交付”的可审计链路 |
| 上书房↔蜂群交互契约 | `docs/chaotang_study_swarm_contract_2026-06-10.md` | 大神会审定稿：StudyRunRequest.v2 输入契约 + edict.v2 输出圣旨 + 五机制天才设计（信息素轨=唯一飞轮）+ 最小可发 S1-S5。三铁律：先点亮 Study(S2)再上 dashboard / score 只朝上对账不朝下排名 / 分歧 surface 不 average |
| 后端整体方略（一纲三层） | `docs/chaotang_backend_grand_strategy_2026-06-10.md` | 后端 agent 架构顶层定纲：四套 ontology 收敛为一纲(court治理)三层(横向权威11主agent/纵向交付17蜂群/横切服务)；六部四要素确立(job+人格+权威边界+分歧对)；ManorDelegate 契约消除角色重复；路由前置按 decisionClass 分流(reversible直投/irreversible走court)；落地 T0-T5 接飞轮 S1-S5。两不可逆分叉已拍板：双轨+前台统一六部 / 路由前置分流 |
| 部门输出提交脚本 | `scripts/chaotang_department_submit.py` | 把日常部门文本或安全 POC 报告转成统一 payload 并送入部门协议 |
| 部门 payload 适配器 | `src/chaotang_department_payload.py` | 提供中文部门别名、输出类型推断、安全 POC 报告适配 |
| 部门自动提交 hook | `src/chaotang_department_autosubmit.py` | 在真实 flow/orchestrator 完成后按开关自动提交部门协议，不阻断主流程 |
| 通信编排总图 | `docs/system_communication_topology.md` | 说明前后端、Flow、Skill、ToolRouter、EventBus、蜂群和 harness 的完整通信链路 |
| 通信 smoke 测试 | `tests/test_system_communication_topology.py` | 锁住 HTTP/SSE、Flow 分支、Swarm 分支、session replay 和 release gate |
| 任务启动路由 | `scripts/chaotang_task_protocol.py` | 输入一句任务，输出推荐执行模式 |
| 路由测试 | `tests/test_chaotang_task_protocol.py` | 防止任务分类逻辑回归 |
| **蜂群/衙门升级方案（唯一权威版，新升级发现追加到这份，别开新文档）** | `docs/chaotang_workflow_swarm_upgrade_2026-06-07.md` | 33 flow/21 蜂群/11 衙门全量盘点 + P0-P3 收敛执行清单；2026-07-04 已核对并调和与 `GO_TO_MARKET.md` 的范围冲突 |

## 钦天监决策前置

> 2026-07-04 收敛：钦天监曾经有4份文档共享同一个名字，其中2份（`qintianjian.md` 与
> `chaotang_qintianjian_system.md`）专家配对表逐字重复——是"设计写到精美程度但接线掉队"这个团队级
> 模式在文档层的实例，跟上书房3-4套并行实现、蜂群4层互不认识、宪法C8与代码脱节是同一种病。
> 已合并为1份协议 + 1份产品设计 + 1份纠偏记录，见下表状态列。

| 能力 | 文件 | 用途 | 状态 |
|---|---|---|---|
| 钦天监协议（Claude/Codex对话用，唯一权威版） | `docs/qintianjian.md` | 重大问题先问最多3个关键问题；含触发规则、大神配对、SEALED_BRIEF格式、优缺点 | **真在用**——已合并原`chaotang_qintianjian_system.md`重复内容 |
| 朝堂钦天监系统设计（已合并） | `docs/chaotang_qintianjian_system.md` | 已改为重定向，不再维护 | 已废弃，指向上一行 |
| 钦天监主线纠偏 | `docs/qintianjian_mainline_recovery.md` | 把偏移期设计迁回主线，明确 Web 支线不混入主线 | 治理意图，代码未强制执行（已补标） |
| 钦天监部门产品设计 | `docs/dept_design/qintianjian.md` | 客户可见的"该不该开工"决策护栏功能，星盘印/天象策卡 | **设计定稿，实现冻结**（见`GO_TO_MARKET.md`冷冻区，`flow_forecast`/`/api/forecast/brief`均不存在） |
| 协作规则入口 | `AGENTS.md` | 规定何时触发钦天监、如何收口 | 真在用 |
| SEALED_BRIEF 落地存储 | `src/qintianjian_brief.py`（复用 `truth_ledger`，不新建表/API） | 把钦天监简报写进已有台账，可查 | 2026-07-04 新增，真在用 |
| court_doc 钦天监诚实标注 | `src/court_doc_builder.py` 的 `qintianjian_reviewed` 字段（默认 false） | 部门文书诚实标注是否经过钦天监前置参谋 | 2026-07-04 新增，真在用 |
| 钦天监提醒接入收口检查 | `scripts/commit_closeout_check.py` 调用 `yushi_drift_monitor.scan_content_for_drift` | 提交前自动提醒重大事项未提钦天监（原脚本已存在但未接入日常收口流程，本次补上） | 2026-07-04 接入 |
| 文档主题查重提醒 | `scripts/commit_closeout_check.py` 的 `check_doc_duplicates` | 新建 `docs/*.md` 时提醒是否与已有文档主题重叠，防止钦天监式重复再犯 | 2026-07-04 新增 |
| 钦天监天象策端点 | `src/tianjian_verdict.py` / `POST /api/qintianjian/forecast` | 真实 flow_tianjian（decree_swarm_router 已路由，`config/swarm_orchestrator.yaml` 已注册）→ court_doc(forecast)，逐条依据过锦衣卫`jinyiwei_vet`核实来源可信度 | 2026-07-04 新增，真在用（此前误判为零调用方，实测纠正） |
| Polymarket真实市场查询 | `src/polymarket_lookup.py`（复用已有httpx依赖，零key零注册） | 命中相关预测市场时，把真金白银定价的odds当green证据塞进天象策；查不到诚实返回`[]`，不编造 | 2026-07-04 新增，真在用 |
| 钦天监校准记录(Brier score) | `src/qintianjian_brief.py` 的 `check_outcome()`（复用truth_ledger） | 记录预测的实际结果，算Brier score——唯一能回答"钦天监预测得准不准"的证据 | 2026-07-04 新增；**尚无调用方**——要真攒够几次真实预测+人工回填结果才有意义，现在只是工具就位 |
| 历史参照系+第一性原理对照 | `src/prompts_tianjian.py`（观天象步骤加"历史参照系"、推演步骤加"参照系vs第一性原理对照，分歧不平均"） | 让预测既有outside view(历史类比)又有inside view(根本驱动力推演)，两者矛盾时显式标注分歧 | 2026-07-04 新增；提出时锦衣卫尚无search_fn,同日晚些时候已补上(见下方"锦衣卫真实检索"条),历史参照系目前仍主要靠LLM自身知识+knowledge/docs薄KB，Tavily检索还没接进这条推演链路 |
| 锦衣卫真实检索(Tavily) | `src/jinyiwei_search.py`(`tavily_search`) + `real_department_engines.py`的`adapt_jinyiwei`改用它做`search_fn` | 锦衣卫从"永远诚实返回未获取到情报"变成真的能查——已实测:查"低温电池行业标准GB/T 36276"返回5个真实来源,多源印证判"情报可信"(green) | 2026-07-04 新增;用户提供真实`TAVILY_API_KEY`(已写入`.env`,gitignore保护);只在jinyiwei_intel_swarm关键词窄触发时调用,不接入常任列表,不会像户部/兵部那样被无关任务意外触发 |
| 部门间真实证据互引(L4上书房) | `src/swarm_execution_loop.py`的`_run_departments_cross_referenced` | 锦衣卫(如被选中)先跑,真实核实结果拼进后续部门(刑部/户部/兵部)收到的`confirmed_edict`文本里——从"各部门互相绝缘各判各的"变成"户部判断报价时能看到锦衣卫刚核实的情报";只改执行顺序和文本上下文,不改变各部门真实引擎/规则模板自身逻辑,对外展示顺序不变 | 2026-07-04 新增 |
| 部门间真实证据互引(L3丞相会审) | `src/chaotang_orchestrator.py`的`_fetch_real_engine_doc`/`_format_grounding` | 同一天补上L3——锦衣卫(如在本次会审名单里)真实情报只取一次(避免Tavily重复计费调用),拼进其余大臣的会审prompt;会审各步骤仍并行执行(`depends_on`都是`decree`),互引发生在装配阶段的文本拼接,不影响并行时序 | 2026-07-04 新增,补齐了L4实现时留下的已知缺口;现在L3/L4两条链路的部门互引都是真的,不是只做了一半 |
| 真实引擎调用可见度日志 | `src/real_department_engines.py`的`_call_adapter_observed`(L3/L4两条消费路径统一走这一个入口) | 兵部/刑部/户部/锦衣卫接入常任/易触发关键词后,每次confirm-edict/会审都可能真的打网络/调LLM,但没人有数据回答"到底多频繁、多贵"——先记`eval/real_engine_calls.jsonl`(dept/耗时ms/outcome:hit真产出/empty无产出/error异常),纯观测,写失败不影响主判定流程；已实测:调锦衣卫真实检索耗时2169.9ms | 2026-07-04 新增,直接服务`docs/pending_decisions.md`里"户部/兵部真实调用要不要收窄"这条待决——先给数据再拍板，不是替用户做决定 |
| 知识库真实数据补充 | `knowledge/docs/low_temp_starter_power_spec.md`、`low_temp_charging_risk_analysis.md`、`market_agv_battery_sales_reply.md`（用户H盘技术部/市场部真实资料，人工筛选脱敏后加入，已用`add_directory()`索引进ChromaDB） | 验证`knowledge_pre_retrieval`真的能查到公司自己的真实产品数据，不止行业通用知识；已实测检索到真实条目 | 2026-07-04 新增，测试用小样本；**重要发现**：人事/财务部/项目部找到的候选文件反复撞上"受限/涉密行业相关内容"，其中一份文档自己标注"密级:内部资料,严禁外传"——未采用，这三个部门没加样本，不是遗漏 |
| 刑部/户部接入共享真实引擎注册表 | `src/real_department_engines.py` 新增 `adapt_xingbu`(复用`xingbu_verdict.run_verdict_from_text`)、`adapt_hubu_quotation`(复用`quotation_verdict.run_quotation_verdict`) | 上书房(L4)/丞相会审(L3)现在四部门有真实引擎：兵部/锦衣卫/刑部/户部；工部(需presale_output)、吏部/礼部(压根没有xxx_verdict.py真实引擎,只有prompt)仍未接，是没得接不是没接 | 2026-07-04 新增；**过程中抓到一个设计缺陷**：quotation的QA硬核查是为报价单定制的死板流程,喂无关任务会误判FAIL产出假红灯,已加报价关键词guard(复用`decree_swarm_router.py`的quotation意图词表)，不相关任务直接退回原有规则模板；刑部的`run_verdict_from_text`本身在无关文本上会诚实返回空findings,不需要guard |
| 刑部硬停信号不被真实引擎静默削弱 | `src/swarm_execution_loop.py` 的 `_enforce_xingbu_hard_stop`(股权/独家/付款/签字等关键词强制`requires_human_confirmation=True`) | 真实刑部引擎的抽取prompt只产出red/yellow/green,从不产出black,而契约映射只在level==black时置这个安全信号——真实引擎接入后如果不额外兜底,"涉及不可逆法律责任必须人工确认"这条安全网会静默失效 | 2026-07-04 修复；由`test_high_risk_contract_requires_human_confirmation`测试抓到的真回归，不是测试断言写错 |
| 测试套件网络隔离 | `tests/conftest.py` 的 `_no_network_real_department_engines`(autouse) | 兵部/刑部/户部/锦衣卫四个真实引擎接入常任/易触发关键词后,任务文本偶然命中(如"独家合作"里的"合作"→兵部)就会让本来跟这些部门无关的测试真的打网络、整体挂起；默认给四引擎打"诚实空结果",直接测这几个模块本体的8个文件跳过此fixture | 2026-07-04 新增；排查耗时较长——完整回归从~120s一度变成打真网络挂起，根因分3层(先疑心xingbu/hubu、实为bingbu"合作"关键词误触发)才定位到 |
| libu命名冲突消歧 | `config/swarm_orchestrator.yaml`/`src/decree_swarm_router.py`/`config/jiqun_registry.yaml`的id统一改`libu_personnel` | 跟`court_doc_builder.py`等5+文件里"libu"=礼部消歧；`advisor_protocols.yaml`的"libu"**没改**(key被校验绑定flow文件名,是独立命名空间) | 2026-07-04 修复 |
| 报价红线复核端点 | `src/quotation_verdict.py` / `POST /api/quotation/verdict` | 把quotation自带的QA硬核查(C1-C10,含C7毛利率红线)装配成court_doc,挂户部(hubu)名下;红线FAIL不挂fix(防止compute_light把红灯软成黄灯,过程中被测试抓到的真bug) | 2026-07-04 新增，真在用 |

## 提交收口与脏码分拣

| 能力 | 文件 | 用途 |
|---|---|---|
| 收口检查脚本 | `scripts/commit_closeout_check.py` | 分拣可提交文件、运行产物、环境漂移、质量基线 |
| 御史偏移监控 | `scripts/yushi_drift_monitor.py` | 检查 Web/UI 支线、运行产物、环境漂移、重大事项未开钦天监 |
| 御史监控测试 | `tests/test_yushi_drift_monitor.py` | 防止主线偏移检查规则回归 |
| 御史总判 harness | `harness/yushi_global_gate/` | 统一判定输出风险、收益、证据、自动化权限和红蓝对抗触发 |
| 御史总判测试 | `tests/test_yushi_global_gate.py` | 锁住依赖安全、乱数字、客户承诺、自动执行、Web/UI 偏移五类首版门禁 |
| 部门协同协议 harness | `harness/chaotang_department_protocol/` | 校验各部门统一输出契约，调用御史总判，并路由下一站 |
| 部门协同协议测试 | `tests/test_chaotang_department_protocol.py` | 防止部门职责、契约字段、下一站路由和御史接入回归 |
| 收口脚本测试 | `tests/test_commit_closeout_check.py` | 锁住 provider/db/quality baseline 分类 |
| 收口模板 | `docs/commit_closeout_template.md` | 每次任务最终回答的 5 项模板 |
| ignore 规则 | `.gitignore` | 避免生成配置等混入提交 |

## 商业闭环安全护栏

| 能力 | 文件 | 用途 |
|---|---|---|
| 商业闭环 harness | `harness/chaotang-commercial-loop/` | 快速评估商机是否进入完整蜂群深跑 |
| 数字护栏 | `harness/chaotang-commercial-loop/scripts/run_harness.py` | 禁止乱补市场价格、认证周期、交付周期等数字 |
| harness 测试 | `tests/test_commercial_loop_harness.py` | 防止乱数字、乱承诺、标准号误判 |
| 兵部自动销售获客蜂群 | `config/flow_bingbu_sales_acquisition.yaml` / `src/prompts_bingbu_sales.py` | 自动准备线索战卡、客户档案草稿、资料包、触达审批单和语音方案；外部触达必须人工签字 |
| 获客同意门 golden cases | `harness/chaotang-commercial-loop/golden_cases/contact_consent_gate_cases.json` / `harness/chaotang-commercial-loop/scripts/run_contact_consent_gate.py` / `GET /api/commercial-loop/contact-consent-gate` / `tests/test_bingbu_sales_acquisition_flow.py` | 锁住官网表单、公开联系方式、评论区软线索、明确拒绝、已有客户服务五类场景，防止自动加人、自动发资料、自动外呼；审批台只消费 gate passed 的 draft-only 草稿 |
| 兵部触达审批队列 | `src/bingbu_sales_ops.py` / `POST /api/commercial-loop/contact-consent-gate/materialize` / `POST /api/commercial-loop/outreach-approvals/{approval_id}/approve` / `tests/test_bingbu_sales_ops.py` | 把同意门结果落成可审计审批队列；批准后只生成 draft execution plan，真实邮件/私信/语音渠道仍需二次适配器审批 |
| 兵部销售工具资源库 | `harness/bingbu-sales-toolkit/` / `GET /api/commercial-loop/sales-toolkit` / `skills/chaotang_departments/bingbu_sales_acquisition/SKILL.md` / `tests/test_bingbu_sales_toolkit.py` | 收录并评分 LiveKit Agents、Pipecat、Vocode、whisper.cpp、Piper、HeyGen、MuseTalk、Wav2Lip、Crawl4AI；第一波只推荐 LiveKit/Pipecat，数字人先保留在披露/肖像权/水印/人工审批门之后 |
| 兵部销售作战系统 | `config/bingbu_sales_operating_system.yaml` / `src/bingbu_sales_operating_system.py` / `GET /api/commercial-loop/sales-operating-system` / `docs/bingbu_sales_operating_system.md` | 定义销售团队立即可执行的角色分工、日流程、交互入口、审批顺序、语音/数字人策略、KPI 和永久红线 |
| 功业系统 harness | `harness/chaotang_merit_system/` | 经钦天监/御史边界约束，把任务结果、功业、称号、部门成长和可购买权益分账，防止花钱买分/买官 |
| 功业系统测试 | `tests/test_chaotang_merit_system.py` | 锁住功业不可购买、朝币/赏银边界、御史驳回清零、平台计费提示 |

## 锦衣卫开源天眼

| 能力 | 文件 | 用途 |
|---|---|---|
| 开源天眼 harness | `harness/open_source_watch/` | 把 GitHub Trending、GitHub Search、deps.dev、史馆观察清单里的候选项目转成主线采用建议 |
| 候选项目清单 | `harness/open_source_watch/candidates.json` | 记录 repo、license、活跃度、风险、朝堂适配部门 |
| 观察源配置 | `harness/open_source_watch/sources.yaml` | 定义锦衣卫、钦天监、工部、御史、史馆在开源吸收流程中的职责 |
| 评分脚本 | `harness/open_source_watch/scripts/score_repos.py` | 离线输出 adopt / poc / watch / reject / must_not，以及部门路由和下一步动作 |
| 安全 POC 配置 | `harness/open_source_watch/security_tools.json` | 配置 OSV-Scanner 与 OpenSSF Scorecard 的安装来源、版本检查、POC 命令和证据来源 |
| 安全工具安装器 | `harness/open_source_watch/scripts/install_security_tools.py` | 从 GitHub latest release 下载安装到本地 harness tools 目录并校验 sha256 digest |
| 安全 POC 脚本 | `harness/open_source_watch/scripts/run_security_poc.py` | 检查工具是否安装，必要时运行本地依赖扫描和远程仓库安全评分 |
| harness 测试 | `tests/test_open_source_watch.py` / `tests/test_open_source_security_poc.py` / `tests/test_open_source_security_install.py` | 防止高星 UI 热点、未知许可证、废弃项目绕过主线和御史检查 |

## OPC 与质量底线

| 能力 | 文件 | 用途 |
|---|---|---|
| OPC 安全底线 | `src/flow_engine.py` | 当输出触发安全底线时，生成可用保底输出 |
| run metadata | `src/step_log.py` | 把安全底线等元数据持久化 |
| OPC prompt 规则 | `runtime_prompts/opc_leader/AGENTS.md` 等 | 强化不可逆风险、报价、交付边界 |
| flow 校验 | `scripts/validate_flows.py` | 校验 flow、prompt、质量基线 |

## 史馆入口

| 能力 | 文件 | 用途 |
|---|---|---|
| 史馆总入口 | `docs/shiguan/README.md` | 下载用户从这里看能力建设档案 |
| 用户快速上手 | `docs/shiguan/user_quickstart.md` | 告诉新用户怎么发令、怎么收口 |
| 能力建设清单 | `docs/shiguan/capability_manifest.md` | 汇总所有能力文件和用途 |
| 资源装载策略 | `docs/shiguan/resource_profile_policy.md` | 登录后默认朝堂资源，同时允许用户选择自有/混合资源 |
| 真实任务示例 | `docs/shiguan/examples.md` | 用 5 个任务演示完整闭环 |

## 登录后资源配置

| 能力 | 文件 | 用途 |
|---|---|---|
| 资源策略核心 | `src/resource_profile.py` | 定义 `chaotang_default` / `hybrid` / `user_own` |
| 资源配置 API | `web/routers/resources.py` | `GET/POST /api/resources/profile` |
| 资源配置 schema | `web/schemas/resources.py` | 校验资源模式更新请求 |
| API 注册 | `web/main.py` | 把 resources router 接入 FastAPI |
| 资源配置测试 | `tests/test_resource_profile.py` | 验证默认朝堂资源、混合切换、非法模式拒绝 |

## 下一步建议

1. 把 `python scripts/commit_closeout_check.py --staged-only` 接成 pre-commit hook。
2. 给 `scripts/chaotang_task_protocol.py` 增加更多朝堂场景样例。
3. 把每次重大会审产物写入 `docs/shiguan/` 或史馆 annals。
4. 给前端补资源选择 UI：朝堂默认 / 混合模式 / 只用我的资源。
