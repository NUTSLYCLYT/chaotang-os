# 部门飞轮 v1 设计 spec · 2026-06-28

> 目标:让兵部/户部部门从"被动等下旨"变成"定时自动产出待决项 → 喂进上书房 → 丞相自动拟旨"的飞轮。
> 本 spec 经 brainstorming 四个决策门确认,作为 writing-plans 的输入。**未提交**(本机与团队 origin/master 对齐期,按铁律15 不自动 commit)。

## 1. 已确认的设计决策(brainstorming 结论)

| 决策 | 选定 |
|---|---|
| 内容来源 | 对上书房**已有 tasks/旨意做派生加工**(半真,无需外部数据源,现在能跑通管道) |
| 输送形态 | 部门发起**「待决议项」进上书房 → 丞相自动拟旨**,复用主闭环(铁律13) |
| 节奏/防刷屏 | **定时 + 阈值门 + 每轮上限 + 去重**(三道闸) |
| 建设顺序 | **共享飞轮框架 + 户部先跑通,兵部复用** |
| job 位置 | **前端 BFF 定时路由**(铁律13.2.9:分析已有任务=咨询性质、无重资产→前端) |

## 2. 架构与边界

- 新增共享 lib:`src/core/courtos/department-flywheel/`(通用机制)
- 每部一个薄 BFF 路由:`/api/court/<dept>/auto-raise`(POST)
- cron(系统 crontab,沿用现有 4 来源体系)定时 curl 该路由
- 部门只提供 3 个钩子,其余全在共享 lib:
  1. `selectCandidates(tasks)` — 从主库 tasks 筛本部门语义候选
  2. `threshold(task)` — 阈值门:够格才产
  3. `derive(task)` — 用部门引擎派生加工成待决项草案
- 共享 lib 提供:去重(ledger)、每轮上限、写入 tasks 主库、sourceLabel 标记、错误隔离

### 单元边界(可独立测试)
| 单元 | 职责 | 依赖 |
|---|---|---|
| `candidates.ts` | 候选筛选(纯函数) | task 类型 |
| `gate.ts` | 阈值门 + 每轮上限(纯函数) | 部门阈值配置 |
| `dedupe.ts` | ledger 去重(纯函数 + 读写 ledger) | ledger store |
| `raise.ts` | 写待决项进 tasks 主库 + sourceLabel | primary-store, reality-state |
| `run-flywheel.ts` | 编排上述 + 错误隔离 | 上面全部 + 部门钩子 |
| `<dept>/hooks.ts` | 部门三钩子实现 | 部门引擎(hubu-engines 等) |

## 3. 数据流(一条)

```
cron(工作日定时)
 → POST /api/court/hubu/auto-raise
   → listPrimaryTasks() 读主库
   → selectCandidates: 筛户部语义候选(预算/成本/报价/ROI/付款)
   → 逐条 threshold 过闸(金额/ROI缺口/风险 够格才继续)
   → 够格项 derive(): 户部三引擎(hubu-engines) + callLLM(经 AgentHarness) 派生加工 → 待决项草案
   → dedupe: 查 ledger(源task_id + dept + content_hash 已产则跳过)
   → 每轮上限:取最高优先级 1–3 条
   → raise: 写 tasks 主库(发起人=hubu, status=pending, sourceLabel=部门派生)+ 写 ledger
 → 丞相经现有主闭环自动拟旨 → 陛下在上书房拍板
```

## 4. 防刷屏/去重(三道闸,v1 故意调严)

- **阈值门**(v1 极严默认,先严后松不可逆):户部只对「预算/金额 > 50万 **且** ROI 缺口明显 **或** 风险=高」的候选产;兵部(后续)只对「商机价值高 **且** 信号强度足」。宁可一天 0 条。
- **每轮上限**:每部每轮最多 **1–3** 条(v1 默认 **2**),取最高优先级。
- **去重**:ledger 记 `源task_id + dept + content_hash`;同源任务已产不重复发。
- **频率**:v1 工作日 **1 次/天**(初定上午);跑稳后再议加密。

> 这些参数集中在 `<dept>/config.ts`,可调,不散落。

## 5. 诚实标记(防 realdata 漂移,关键)

- 待决项必须带 `sourceLabel` 明确标「**部门自动派生**」(复用 `src/lib/reality/reality-state.ts` SSOT),既不冒充用户真旨意、也不标假 LIVE。
- 上书房 UI 能一眼区分「部门产」vs「人下旨」(发起人字段 + sourceLabel 角标)。
- 派生加工取不到的数字一律留空/标"待核",绝不编(沿用户部已有诚实纪律)。

## 6. 错误处理

- **幂等**:整个 job 靠 ledger 幂等,重跑不重复发。
- **单项隔离**:某候选 LLM 失败 → 跳过该条 + 记日志,不中断整轮。
- **写入原子**:待决项 + ledger 同步写;写入失败该条回滚,不留半条。
- **cron PATH**:crontab 调用必须 `export PATH` 带 `~/.npm-global/bin`(踩过的坑,否则 subprocess 静默挂)。

## 7. 测试(铁律4:写 tasks 主库属高危,双门)

- **纯函数 nodetest**:candidates / gate / dedupe / 上限
- **回归断言**(铁律4 必需):「自动待决项可被 briefing 读出 + 来源可区分 + 不污染人工任务统计/KPI」
- **E2E**:手动触发 auto-raise → 待决项进 tasks → 可被 `/api/court/shangshufang/briefing` 读出 → 丞相能拟旨
- **独立会审**:本批写 tasks 主库,提交前过 code-reviewer/expert-panel(铁律4,禁自审自夸)
- **上线后端到端截图验证(GSTACK,仅此一次)**:飞轮挂上 cron 跑通后,用 GSTACK 无头浏览器开上书房,截图证明「部门自动产的待决项真出现在队列 + 来源角标=部门派生 + 丞相真拟了旨」。这是唯一用到 GSTACK 的点;飞轮无新 UI,其余阶段不套浏览器 QA harness。

## 8. 上线顺序(增量)

1. 共享 flywheel lib + 纯函数测试
2. 户部三钩子(复用 hubu-engines)+ `/api/court/hubu/auto-raise`
3. **手动"立即跑一次"端点**验证整条链(户部→上书房→丞相)绿
4. 挂 system crontab(PATH 带 npm-global,工作日 1 次)
5. 户部跑稳、阈值手感校准后 → 兵部填三钩子复用同一 lib(兵部已有 bingbu-cro 骨架 + 后端 4 flow 可接)

## 9. YAGNI / 明确不做(v1)

- 不接外部 CRM/ERP/金蝶(那是"接真数据源"另一条线)
- 不做兵部前端面板(报价/获客/售后 UI)——飞轮只产待决项进上书房,不依赖部门自有面板
- 不做事件驱动(纯定时 v1)
- 不放宽阈值追"每天有内容"(先严)

## 10. 风险与判断

- **真正的成败在阈值门手感**,不在代码:门太松→淹没上书房(比没有更糟);门太紧→空转。v1 默认极严,先建信任再放宽。
- 半真内容(派生加工)上线即影响陛下决策视野 → sourceLabel 诚实标记是底线,不可省。

## 11. 工作日 09:30 跑户部飞轮（系统 crontab）

脚本位置: `scripts/flywheel/run-hubu-flywheel.sh`

### 如何手动跑一次

```bash
# 本地开发环境(dev :3002)
curl -s --noproxy 127.0.0.1,localhost -X POST http://127.0.0.1:3002/chaotang/api/court/hubu/auto-raise | head -c 400

# 生产环境(prod :3050)
curl -s --noproxy 127.0.0.1,localhost -X POST http://127.0.0.1:3050/chaotang/api/court/hubu/auto-raise | head -c 400
```

预期返回: `FlywheelRunResult` JSON(raised 数组,可能 0 条若无够格任务——符合"先严"预期)

### 如何挂 crontab

```bash
# 编辑 crontab（工作日 09:30 跑户部飞轮）
crontab -e
```

添加以下行:

```
30 9 * * 1-5 /home/ubuntu/workspace/frontend/chaotang-web-lyt/scripts/flywheel/run-hubu-flywheel.sh
```

说明:
- `30 9` — 上午 09:30
- `* * 1-5` — 每月每日,仅周一至周五(1-5 = Mon-Fri)
- 脚本路径须用绝对路径(上述为标准布局路径)
- 脚本内已设置 `export PATH` 包含 `~/.npm-global/bin`,避免 cron 环境缺依赖

### 如何验证 cron 已注册

```bash
# 列出当前用户的 crontab
crontab -l | grep hubu-flywheel
```

### 日志查看

飞轮执行日志累积在 `~/.gstack/flywheel-hubu.log`,可实时监控:

```bash
tail -f ~/.gstack/flywheel-hubu.log
```
