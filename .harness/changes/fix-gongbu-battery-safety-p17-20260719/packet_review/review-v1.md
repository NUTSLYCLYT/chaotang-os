# P17 独立复审报告 v1：fix-gongbu-battery-safety-p17-20260719

| 字段 | 值 |
| --- | --- |
| Packet ID | P17 |
| Change ID | fix-gongbu-battery-safety-p17-20260719 |
| 复审者 | Claude Code / Opus 4.8（独立复审，不接受 Codex 自报数字） |
| 复审日期 | 2026-07-19 |
| B17（predecessor integration） | `9956a5a9a0a8ad5d8465c637dd8c7b81d08f50f8` |
| H17（reviewed head） | `057ddd2051d9da97e4d5ce6ddc0454cad27df148` |
| R17（本 review commit） | 见文末「R17」节 |

## 工作树声明

- 本次复审全程在隔离 worktree `/home/ubuntu/Projects/.fullcourt-worktrees/p17-gongbu-battery-review` 内进行。
- 未触碰主工作树，未 merge / push / rebase，未删除或清理任何文件。
- 复审期间为做变异测试曾临时把 `backend/src/real_department_engines.py` 换成 B17 版本，
  测试结束后立即还原并以 `git diff --stat` 验证工作树回到 H17 干净状态（无输出）。
- 测试自产未跟踪目录 `backend/knowledge/docs/ima_archived/` 保留未清理，且已排除在 R17 之外。
- H17 已有的实现、测试、summary、spec、tasks、ci 一字未改。

## 一、范围与完整性验证

| 检查项 | 期望 | 实测 | 结论 |
| --- | --- | --- | --- |
| `git rev-parse HEAD` | H17 | `057ddd2051d9da97e4d5ce6ddc0454cad27df148` | PASS |
| `git rev-parse HEAD^` | B17 | `9956a5a9a0a8ad5d8465c637dd8c7b81d08f50f8` | PASS |
| H17 单亲 | 单 parent | `%P` 仅一个 SHA | PASS |
| B..H 路径数 | 恰 6 | 6（2 后端 + 4 根 Harness） | PASS |
| 路径构成 | 2 实现/测试 + 4 Harness | `backend/src/real_department_engines.py`、`backend/tests/test_real_department_engines.py`、`.harness/changes/fix-gongbu-battery-safety-p17-20260719/{summary.md,request_analysis/spec.md,request_analysis/tasks.md,ci_result/ci_summary.md}` | PASS |
| `git diff --check B17..H17` | 无输出 | 无输出 | PASS |
| 无夹带 | 无旧分支 ancestry / 无前端 / 无 DB / 无 Guoli / 无 Census | diff 确认 | PASS |

## 二、原始 HIGH 独立复现与关闭证明

不是只比对常量，而是把 B17 版 `adapt_gongbu` 抽出实跑。

**B17 上复现（fail-open 实证）：**

```
BASE '储能柜爆炸并起火'      → ('P2', 'yellow', [yellow×5])   ← 原始 HIGH，确认复现
BASE '储能柜冒烟'            → ('P0', 'black',  [black,y,y,y,black])
BASE '电池模块温度飙升到90度' → ('P2', 'yellow', [yellow×5])
BASE '储能PACK鼓包变形'       → ('P2', 'yellow', [yellow×5])
BASE 'BMS告警 电池起火'      → ('P2', 'yellow', [yellow×5])
```

根因确认：旧白名单 `("热失控","冒烟","漏液","燃烧")` 不含「爆炸」「起火」，
且未命中即默认 P2/yellow，而 yellow 在 `automation_tier` 落 `auto_proceed_logged`（自动继续）。
即：真实爆炸起火事件会被自动放行并给出「补遥测」建议，而非断电撤离消防。

**H17 上关闭（18 组输入实跑，含 `needs_signoff` 真实调用）：**

```
P0  black  signoff=True  require_human_sign   储能柜爆炸并起火
P0  black  signoff=True  require_human_sign   储能柜冒烟
P0  black  signoff=True  require_human_sign   电池模块温度飙升到90度
P0  black  signoff=True  require_human_sign   储能PACK鼓包变形
P0  black  signoff=True  require_human_sign   BMS告警 电池起火
P1  black  signoff=True  require_human_sign   储能站例行巡检一切正常
P1  black  signoff=True  require_human_sign   储能设备告警但一切正常无异常
P1  black  signoff=True  require_human_sign   PCS通讯中断 / 电池SOC显示异常 / 储能柜有异味
P1  black  signoff=True  require_human_sign   电池包进水 / 绝缘阻值下降 / 单体压差变大 / 风扇不转
P0  black  signoff=True  require_human_sign   电池膨胀力超限
```

**穷举确认「in-scope 必 black」是结构性质、不依赖关键词表：**
对全部 10 个 scope 关键词 × 12 个降级诱导后缀（「一切正常」「误报」「已修复」「低危」「P2」等）
共 120 组组合实跑，**非 black / 非 P0P1 的 in-scope 用例：NONE**。
代码层证实：`light` 两分支硬编码 `"black"`，items[0] 与 items[4] 的 `level` 亦硬编码 `"black"`。
因此关键词表的漏词不会导致 fail-open，只影响 P0/P1 粒度。**原始物理安全 HIGH 已真实关闭。**

## 三、P1/black 是否真落入 `needs_signoff`（而非只改展示文案）

沿真实契约链逐层验证，非仅读文案：

1. `signoff_gate.needs_signoff(doc)` → `automation_tier.tier_for_doc(doc)`。
2. `tier_for_doc` 取 `doc["light"]` 与 `any(item.level == "black")`，
   `decide_auto_action` 中 `light == "black" or has_black` → `REQUIRE_HUMAN_SIGN`。
3. 实跑：上表 18 组 in-scope 输入，`needs_signoff(doc)` 全部返回 `True`。
4. 双重保险：即使 `light` 被下游改写，items 内两个 `black` 仍会独立触发 `has_black`。

注意 `automation_tier` 的 `_IRREVERSIBLE_DEPTS = {"xingbu","hubu","libu"}` 不含 `gongbu`——
但工部走的是 `light=="black"` 这条独立分支，不依赖部门白名单，因此不受影响。已实测确认。

## 四、其他 Gongbu 调用路径是否绕过 `adapt_gongbu` 或降级 P1/black

| 路径 | 追踪结论 |
| --- | --- |
| `get_raw_engine_fn_for_minister("gong_bu")` → `_call_adapter_observed("工部", adapt_gongbu, …)` | 走本包修复；`_MINISTER_CODE_DEPT["gong_bu"] == "工部"`，与 `_ENGINE_CACHE_EXCLUDED_DEPTS` 字面一致，排除生效 |
| `get_real_engine_fn_for_swarm("gongbu_delivery_swarm")` → 同上 → `_court_doc_to_ministry_contract` | 契约保留严重度：`risks[].severity="高"`、`requires_human_confirmation=True`（level==black）、`auto_action=require_human_sign`、`requires_human=True`、`position="驳回"`（`_LIGHT_POSITION` 含 black）。**无降级** |
| `swarm_execution_loop.py:140` | `any(requires_human_confirmation)` → 升级，不降级 |
| `shangshufang_loop.py:314/445/540` | 传播 `human_signoff`，不降级 |
| `honesty_envelope.py:104` | 显式 `from src.signoff_gate import needs_signoff` 作唯一判定来源 |
| `swarm_execution_loop.py:544` `gongbu_delivery_swarm` 规则块 | 仅在真引擎返回 `None`（out-of-scope）时兜底，不覆盖 in-scope 判定 |
| `doc["actions"]`（`isolate_equipment` 等） | 全仓 grep 确认**无任何执行器消费**，是惰性字符串，不存在自动执行旁路 |
| `grep -niE "skip.*signoff\|exempt\|bypass.*sign\|auto_approve\|自动通过"` | 无命中，无部门豁免开关 |

**结论：未发现绕过 `adapt_gongbu` 或把 P1/black 降级的生产调用路径；in-scope 工部判决不存在
「绕过 signoff 且自动执行」的链路。**故不构成裁决规则中的相关 blocker。

## 五、缓存回归：缓存是否真生效 + 工部是否实时重算

`test_gongbu_severity_bypasses_stale_engine_cache` 的设计经审查是可信的，而非自证：

1. **先证前提**：写入「兵部」陈旧条目并调用 `_call_adapter_observed("兵部", …)`，
   断言 `control.get("_stale_probe")` 为真——若缓存未生效，此断言先失败，测试不会假绿。
2. **再证修复**：写入「工部」陈旧 P2 条目，断言 `_call_adapter_observed("工部", …)`
   **不含** `_stale_probe` 且 `risk_level == "P0"`、`light == "black"`。
3. **pytest cache guard 处理正确**：`monkeypatch.setenv("SWARM_ENGINE_CACHE","1")` +
   `monkeypatch.delenv("PYTEST_CURRENT_TEST")` 绕开测试期关缓存的守卫，teardown 自动还原。
4. **命名接线独立验证**：`canonical_name("gongbu") == "工部"`、
   `_ENGINE_CACHE_EXCLUDED_DEPTS == ("锦衣卫","工部")`、
   `_SWARM_ID_DEPT["gongbu_delivery_swarm"] == "工部"`、`_MINISTER_CODE_DEPT["gong_bu"] == "工部"`
   —— 排除项字面与真实调用点一致，不存在「排除写了但永不命中」。
5. **代价评估**：`adapt_gongbu` 是纯确定性函数、无外呼，排除缓存无性能代价，只有收益。

## 六、测试质量：变异测试（新测试是否能在坏实现上 RED）

不接受自报 RED，独立复跑：把 `backend/src/real_department_engines.py` 临时换成 B17 版本，
保留 H17 测试文件运行 `-k gongbu`：

```
8 failed, 3 passed, 45 deselected in 3.90s
FAILED test_adapt_gongbu_explosion_fire_is_p0_black
FAILED test_adapt_gongbu_hazard_phrasings_not_silently_downgraded
FAILED test_gongbu_severity_bypasses_stale_engine_cache
FAILED test_adapt_gongbu_unconfirmed_incident_escalates_not_silent_p2
FAILED test_adapt_gongbu_unconfirmed_incident_requires_human_signoff
FAILED test_adapt_gongbu_never_auto_downgrades_to_p2
FAILED test_adapt_gongbu_real_problem_with_benign_phrase_not_downgraded
FAILED test_adapt_gongbu_anomaly_context_escalates_not_downgraded
```

8 个新增测试全部在坏实现上 RED，与 Codex 自报一致，且我方独立复现。随后还原并验证工作树干净。

测试质量评估：
- **非仅查常量**：`test_..._requires_human_signoff` 直接 `from src.signoff_gate import needs_signoff`
  并断言 `is True`，钉住的是下游真实消费语义，不是展示字段。
- **非自证式**：cache 测试带兵部对照前提断言；变异测试证明全部有杀伤力。
- 既有冒烟测试 `test_adapt_gongbu_storage_incident_returns_five_stage_court_doc` 未被改动，
  仍断言 P0/black 且通过，说明修复未靠放宽旧断言换绿。
- 少量冗余断言（先 `== "P1"` 再 `!= "P2"`）无害，属可读性冗余。

## 七、court_doc 契约兼容性

| 字段 | B17 | H17 | 兼容性结论 |
| --- | --- | --- | --- |
| `risk_level` | `"P0"` / `"P2"` | `"P0"` / `"P1"` | 值域变化：`P2` 不再产生，新增 `P1`。全仓未发现对 gongbu `P2` 做分支的消费者 |
| `light` | `"black"` / `"yellow"` | 恒 `"black"` | `_LIGHT_POSITION` 含 `black`→「驳回」，无 KeyError；下游按严重度升档 |
| `items[].level` | 混合 | `[black, yellow, yellow, yellow, black]` | 阶段名、数量、顺序、`evidence_ref` 全部不变 |
| 其他键 | — | 键集合完全不变（`doc_type/dept/case_id/headline/shielded/items/unknown_gaps/adversarial/actions/provenance/source_label/signed/seal`） | 无结构不兼容 |

行为差异（非崩溃）：普通储能任务的 `position` 由「补证」变「驳回」、并进入必须人签档。
这正是本包已披露的安全取舍，全量 2785 测试无一因此失败。

## 八、Harness 文档诚实性

逐条核对，**未发现夸大**：

- `summary.md` 明确写「P1 信号是否被所有未来派单入口消费属于后续端到端治理；本包以现有
  `signoff_gate.needs_signoff()` 的真实消费契约作回归证明」——**未宣称所有未来派单入口已闭环**。
- `spec.md` 「非目标」明列「不宣称完成所有派单入口的 P1 执行闭环」；未知问题表把该项标为
  「后续端到端包 / 否；本包不扩线」。
- 成本披露诚实：`summary.md` 与 `spec.md` 均写明 P1/black 增加人工复核量，
  「是物理安全 fail-safe 的明确成本，不伪装成零成本优化」。
- `ci_result/ci_summary.md` 「未验证项」主动披露：未验证真实生产部署、未执行 Claude/D6、
  当前环境无 Ruff 且未计为通过；声明状态为 `VERIFIED_PARTIAL` 而非 VERIFIED。
- 回滚边界诚实：「物理安全修复禁止无审查回滚」「未演练」。

## 九、独立实跑结果（全部由本复审者亲自执行）

| 命令 | 期望（Codex 声明） | 实测 | 结论 |
| --- | --- | --- | --- |
| `pytest -q backend/tests/test_real_department_engines.py -k gongbu -p no:randomly` | 11 passed | `11 passed, 45 deselected in 3.59s` | 一致 |
| `pytest -q test_real_department_engines.py test_signoff_gate.py test_automation_tier.py -p no:randomly` | 70 passed | `70 passed in 3.95s` | 一致 |
| `pytest -q backend/tests -p no:randomly` | 2785 passed / 37 skipped / 4 warnings / 0 failed | `2785 passed, 37 skipped, 4 warnings in 255.97s`，exit 0 | 一致 |
| `python3 backend/scripts/harness_doctor.py` | 0/0 | `backend-harness-doctor: 0 errors, 0 warning(s)`，exit 0 | 一致 |
| `node frontend/scripts/harness-doctor.mjs` | 0/0 | `harness-doctor: 0 errors, 0 warning(s)`，exit 0 | 一致 |
| `node scripts/harness-doctor.mjs` | 0/0 | `project-harness-doctor: 0 errors, 0 warning(s)`，exit 0 | 一致 |
| `git diff --check B17..H17` | 无输出 | 无输出 | 一致 |
| 变异测试（新测试 × B17 实现） | 8 failed / 3 passed | `8 failed, 3 passed` | 一致 |

4 条 warning 与声明相符且非本包引入：2 条 FastAPI Duplicate Operation ID
（`scribe_lessons` / `manor_stream`，来自 `governance_compat.py`），
2 条 OpenClaw fallback UserWarning（`test_openclaw_ready.py` 有意触发的兜底路径）。
**无任何不一致，未需要调查偏差，也未对 CI 文档做任何迁就性修改。**

## 十、Findings

无 CRITICAL / HIGH / MEDIUM。原始物理安全 HIGH 已真实关闭（见第二、三节）。

### LOW-1：危险信号仍是字符级子串匹配，存在 P0→P1 的粒度假阴性

`_GONGBU_P0_HAZARD_SIGNALS` 是字面子串表，以下真实物理安全措辞不命中任一信号，
落 P1 而非 P0，因而拿到的是「严重度未确认，保守处置」文案，而**不是**
「现场断电+撤离+消防待命」这句最强指令：

- `储能电池冒白气并有异味`（热失控排气前兆，「白气」不含「漏气/排气/胀气」）
- `储能柜电解液渗出`（「渗出」不含「漏液」）
- `储能柜温度升到90度`（无「高温/超温/飙/骤」字面）

影响限定：这三类仍为 `light="black"`、`needs_signoff=True`、`require_human_sign`，
且 P1 文案已明写「确认前不得径直下发维修或远程复位」，人始终在环内。
差异只在给签字人的处置措辞强度，**不构成 fail-open，不构成自动放行**。
故判 LOW 而非阻断项。建议后续包用「储能 scope 内一律给出断电/撤离/消防的兜底指令，
P0 仅用于加重而非解锁」来消除该粒度差。

### LOW-2：安全方向的假阳性代价（已披露，记录不阻断）

子串匹配会把「储能柜防火门检查」「储能柜消防系统年检」这类含「火」「防」字样的
纯例行任务判成 P0/black。方向偏保守，与本包声明的取舍一致，`spec.md` 已披露。
连同 P1 默认档，普通储能咨询的人工确认量会实质上升——这是已知代价，不是零成本优化。

### LOW-3：缓存回归测试写入真实 DirectCache 存储而非 `tmp_path`

`test_gongbu_severity_bypasses_stale_engine_cache` 通过 `DirectCache().set(...)`
写入真实运行时缓存目录（`backend/var/direct_cache`，TTL 24h）。
已核实：该目录被 `.gitignore:77 backend/var/` 覆盖，不污染工作树；
两个 key 均为唯一探针（`__cache_probe__` / 具体 hazard 文本），全量 2785 测试未见串扰。
仅为卫生建议，不阻断。

## 十一、范围外问题（只记录，未修复）

### OUT-1：`_GONGBU_SCOPE_KEYWORDS` 覆盖不足导致的 scope 假阴性（先于 B17 存在）

`adapt_gongbu` 的 scope 门未变更（不在 B..H diff 内）。以下真实电池安全任务因不含
任一 scope 关键词而返回 `None`，退回 `swarm_execution_loop.py:544` 的规则兜底
（该兜底 `requires_human_confirmation=False`，会自动继续）：

- `模组端子松动打火`
- `电芯析锂`
- `光伏逆变器起火`

**已在 B17 上逐条实跑验证行为完全相同（同样返回 `None`）**，即：此为先于本包存在的缺口，
P17 既未引入也未加重。按裁决规则，本包的 in-scope 判决不绕过 signoff，
该 scope 缺口不属于「本包相关 blocker」。建议列入后续物理安全包，扩充
scope 关键词（电芯/模组/电解液/储能舱等）并同样采用 fail-safe 兜底。

### OUT-2：`automation_tier._IRREVERSIBLE_DEPTS` 未含 `gongbu`

工部当前靠 `light=="black"` 触发人签，而非部门天然不可逆白名单。本包内此路径已验证有效，
但若未来有人把工部 light 降回 yellow，人签会一并失效。属韧性建议，非本包缺陷。

## 十二、残余风险

1. **P0/P1 粒度残余**（LOW-1）：极端措辞下最强处置文案可能缺席，但人签闸门始终在。
2. **端到端未闭环**：P1 信号在真实生产部署、所有派单入口上的消费尚未端到端验证。
   本包对此已诚实声明为非目标，本复审据此不将其计入本包完成度，也不据此判 NO_GO
   ——因为已验证现有 in-scope 生产调用链**不存在**绕过 signoff 的自动执行路径。
3. **人工复核负荷上升**（LOW-2）：属已披露的安全取舍，需业务侧承接。
4. **Ruff 未安装**：本环境同样确认 `python3 -m ruff` 不可用，与 CI 文档声明一致，
   静态检查这一轴无证据，双方均未把它计为通过。

## 十三、SHA 记录

| 标记 | 完整 SHA |
| --- | --- |
| B17（predecessor integration） | `9956a5a9a0a8ad5d8465c637dd8c7b81d08f50f8` |
| H17（reviewed head） | `057ddd2051d9da97e4d5ce6ddc0454cad27df148` |
| R17（本 review commit，单亲，parent 精确为 H17） | 提交后由 `git rev-parse HEAD` 记录；`git diff --name-status H17..R17` 恰为本目录两个新增文件 |

## 十四、裁决

- CRITICAL：0
- HIGH：0
- MEDIUM：0
- LOW：3（LOW-1 / LOW-2 / LOW-3，记录不阻断）
- 范围外：2（OUT-1 / OUT-2，均先于 B17 存在，只记录不修复）
- 原始物理安全 HIGH：已在 H17 上真实关闭，并经变异测试与 18 组行为实跑双重证明。

依裁决规则，无 CRITICAL/HIGH/MEDIUM 且原始 HIGH 已真实关闭，判定通过。

PACKET_REVIEW_GO
