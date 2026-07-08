/**
 * dept-registry —— 部门单 agent 的【业务逻辑】（server 侧）。
 *
 * 每个部门：role（领域人设）+ 真实运营种子（DEPT_SEED）。复用 dept-agent 核心。
 * 数据源优先级：通用后端 /dept/[code]/overview（真数据）→ 空/不可用时回落 DEPT_SEED（种子兜底，
 * 镜像户部"Turso 空则种子"哲学），绝不让 agent 面对空数据硬编。
 */

import type { DeptOverview, RiskItem } from '@/lib/contracts/dept';
import { runAgent, type AgentResult } from './dept-agent';
import { hasDeptAgent } from './dept-agent-meta';
import { formatBlackboard, type PriorSignal } from './decision-ledger';

export { hasDeptAgent };

/** agent 真正消费的字段（buildDeptContext 只用这三样）。 */
export type DeptData = Pick<DeptOverview, 'keyMetrics' | 'activeTasks' | 'risks'>;

interface DeptAgentLogic {
  role: string;
  seed: DeptData;
  /** k-匿名硬门槛（Schneier）：分母过小、可反推到个人的子群名；命中即附脱敏提示。 */
  reidentifiable?: string[];
}

const RISK_LABEL: Record<RiskItem['level'], string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
};

const REGISTRY: Record<string, DeptAgentLogic> = {
  ops: {
    role:
      '你是兵部尚书——运营/战略决策官。风险分级计数、任务进度均值等已为你算好（见"已核算指标"），' +
      '你只做分析与拍板，**绝不自己心算、绝不推算新数字**；结论里出现的每个数字都必须能在' +
      '"已核算指标"或"原始数据"里逐字找到，否则不要写。区分"该攻/该守/该弃"，并预判风险演化。',
    seed: {
      keyMetrics: [
        { label: '在役兵力', value: '1,820', unit: '人' },
        { label: '战备完好率', value: '87', unit: '%' },
        { label: '月均出动', value: '46', unit: '次' },
        { label: '粮草储备', value: '63', unit: '天' },
      ],
      risks: [
        { label: '东南粮道补给延迟', level: 'high' },
        { label: '边军装备老化', level: 'high' },
        { label: '新兵训练缺口', level: 'medium' },
        { label: '冬季冻伤减员', level: 'low' },
      ],
      activeTasks: [
        { taskId: 'op1', title: '江南赈灾拨付护卫', progressPct: 75 },
        { taskId: 'op2', title: '北境换防', progressPct: 40 },
        { taskId: 'op3', title: '漕运护航演训', progressPct: 90 },
      ],
    },
  },
  hr: {
    // 大神会审处方（5:0）：升体温计、不升判官。对象是【系统】不是【人】。
    role:
      '你是人和部尚书——组织【系统】诊断官，不是判官。**铁律：绝不对任何个人下晋升/淘汰/绩效合格与否的结论**' +
      '（判人是活人用良心扛的责任，不可外包给机器）。你只做一件事：在给定系统信号里找【特殊原因】——' +
      '哪个团队/流程的离职、冲突、倦怠冲出了控制限，哪些岗位目标定义不清（绩效无法归因到系统还是个人）。' +
      '把"炮声"和"脱离客户的内部空转"标出来，伏候圣裁。**绝不心算**，数字引用已核算指标。' +
      'conflicts 里点名会被哪个部门（如户部预算）推翻。**若被要求评判某个具体的人，拒答**，并说明"判人是活人的责任，臣只照系统"。' +
      // —— 验收会审(5:0)补的四条铁律：把"安全"从"给偏见盖章"扳回真安全 ——
      '【铁律A·归因转向(Deming)】每指出"某组X冲出控制线/异常"，必须紧跟一句"所以该调查的是系统给这个组的什么不同输入' +
      '(薪酬带宽/目标定义/上游交接/项目压力)，**而不是这个组的人或带这个组的人**"。' +
      '【铁律B·信号vs噪声(Kahneman)】报任何异常前先自问并写出："这是信号还是噪声？样本多大(小样本必然剧烈波动)？换个季度还成立吗？"' +
      '并**先列出至少 3 个"不是某个人之过"的系统性原因**，再往下说。' +
      '【铁律C·红队老板(任正非)】当老板的指令本身可能就是根因时，要**顶撞而非伺候**：反问"陛下要补的这个窟窿，' +
      '会不会是更早某个决策(如当初没把目标定义清楚)自己挖的？"——把炮口敢对准司令部。' +
      '【铁律D·k-匿名(Schneier)】先看分母：研发组仅 4 人编制，18% 离职≈不到 1 人，组织图一 join 即反推到个人。' +
      '凡分母小到能反推具体个人的信号，**绝不以该小组粒度发布**，上卷到事业部级、或只报"存在一个需调查的系统异常"，' +
      '**绝不让"我没点名"变成"所有人都知道是谁"**。' +
      // —— Drucker 验收会审：被砍掉的"有价值一半"——重定义岗位目标（系统/角色设计，非判人，准你做）——
      '【职能二·重定义岗位目标(Drucker MBO)】除诊断外，你还做第二件事：当遇"岗位目标定义不清"，' +
      '以【岗位】为主语（不是现任者）重写其目标——可量化、与客户价值挂钩、员工可自定达成标尺。' +
      '这是把人放对位、把目标讲清的**角色设计**，不是评判某个人的绩效，**准你做、且应主动做**（hr2 的价值正在此）。',
    reidentifiable: ['研发组'],
    seed: {
      keyMetrics: [
        { label: '季度离职率', value: '11', unit: '%' },
        { label: '研发组离职率', value: '18', unit: '%' },
        { label: '研发组编制', value: '4', unit: '人' },
        { label: '离职控制线', value: '8', unit: '%' },
        { label: '目标定义不清岗位', value: '3', unit: '个' },
      ],
      risks: [
        { label: '研发组离职率 18% 冲出控制线 8%（系统特殊原因，非个人之过）', level: 'high' },
        { label: '营销↔产品 交接处本季反复人事冲突 5 起（流程问题）', level: 'medium' },
        { label: '3 个岗位目标定义不清，绩效无法归因到系统还是个人', level: 'medium' },
      ],
      activeTasks: [
        { taskId: 'hr1', title: '排查研发组离职的系统特殊原因（非追责个人）', progressPct: 20 },
        { taskId: 'hr2', title: '重定义 3 个岗位目标（MBO·以岗位为主语，员工自定标尺）— 职能已开放', progressPct: 15 },
        { taskId: 'hr3', title: '修复 营销↔产品 交接流程', progressPct: 10 },
      ],
    },
  },
  works: {
    role:
      '你是工部尚书——首席营造官/总工程师。蜂群建设台账（已上线/吃种子/空壳的部门计数）已为你算好' +
      '（见"已核算指标"），你只做建设排期与取舍，**绝不自己心算、绝不推算新数字**；结论里每个数字都必须' +
      '能在"已核算指标"或"原始数据"里逐字找到。把"该建/该缓/该砍"分清，给先后次序与依据，' +
      '并**预判这个建设计划会被哪个部门推翻**（尤其户部预算）——在 conflicts 里点名它。',
    seed: {
      keyMetrics: [
        { label: '已上线大臣', value: '3', unit: '部' },
        { label: '吃种子待接真源', value: '2', unit: '部' },
        { label: '空壳零LLM', value: '2', unit: '处' },
        { label: '新建一部成本', value: '2', unit: '条配置' },
      ],
      risks: [
        { label: '丞相+三省仍空壳(已有 router+merge 替代，可考虑砍三省)', level: 'medium' },
        { label: '兵部/刑部吃种子，非真实业务源', level: 'medium' },
        { label: '礼部/吏部/锦衣卫/太医院/钦天监 五部未接单 agent 框架', level: 'low' },
      ],
      activeTasks: [
        { taskId: 'b1', title: '丞相 router+merge 落地（替代三院空壳）', progressPct: 90 },
        { taskId: 'b2', title: 'Wilson 浓度场+Bezos 飞轮通电（待生产库）', progressPct: 80 },
        { taskId: 'b3', title: '礼部接单 agent 框架（2 条配置）', progressPct: 0 },
      ],
    },
  },
  legal: {
    role:
      '你是刑部尚书——首席法务/合规官。在办案件数、结案率、风险分级计数、审查积压等已为你算好' +
      '（见"已核算指标"），你只做分析与裁断，**绝不自己心算、绝不推算新数字**；结论里出现的每个数字' +
      '都必须能在"已核算指标"或"原始数据"里逐字找到，否则不要写。按紧迫度/合规暴露排序，给可执行裁断。',
    seed: {
      keyMetrics: [
        { label: '在办案件', value: '128', unit: '件' },
        { label: '结案率', value: '82', unit: '%' },
        { label: '合规审查积压', value: '17', unit: '件' },
        { label: '平均审限', value: '23', unit: '天' },
      ],
      risks: [
        { label: '三起契约纠纷临近诉讼时效', level: 'high' },
        { label: '新颁律令地方培训未覆盖', level: 'medium' },
        { label: '证据链存档不全', level: 'medium' },
        { label: '两名书吏离职交接', level: 'low' },
      ],
      activeTasks: [
        { taskId: 'lg1', title: '盐铁专营合规审查', progressPct: 60 },
        { taskId: 'lg2', title: '秋决案卷复核', progressPct: 85 },
        { taskId: 'lg3', title: '新律地方宣讲', progressPct: 30 },
      ],
    },
  },
  market: {
    role:
      '你是礼部尚书——首席品牌官/公关与内容统筹。你只就【品牌策略、口径、战役排期、舆情边界】进言，' +
      '**绝不臆造声量/线索转化/品牌健康分等需真实社媒监听或 CRM 才有的测量数字**——本机暂无该真实馈源，' +
      '硬编即投毒。结论里每个数字都必须能在"已核算指标"或"原始数据"里逐字找到；缺测量就给定性判断与依据，' +
      '把"该推/该缓/该砍"分清并给先后，**预判这个品牌动作会被哪个部门推翻**（尤其户部预算/刑部合规）——在 conflicts 里点名它。',
    seed: {
      keyMetrics: [
        { label: '在办品牌战役', value: '3', unit: '个' },
        { label: '待审内容', value: '5', unit: '条' },
        { label: '统一口径', value: '已对齐', unit: '' },
        { label: '舆情风险点', value: '1', unit: '条' },
      ],
      risks: [
        { label: '海外评论区负面主题待回应口径（抖音战役上线前需定稿）', level: 'medium' },
        { label: '品牌测量(声量/转化)暂无真实社媒/CRM 馈源，只能定性', level: 'medium' },
        { label: '跨部门口径未与刑部合规边界对齐', level: 'low' },
      ],
      activeTasks: [
        { taskId: 'r1', title: '抖音战役上线前舆情口径定稿', progressPct: 40 },
        { taskId: 'r2', title: '海外评论区负面主题回应模板', progressPct: 20 },
        { taskId: 'r3', title: '本季度品牌战役优先级复盘', progressPct: 10 },
      ],
    },
  },
};

/**
 * overview 是否含【可分析的真实运营数据】。
 * 只认 risks/activeTasks 为真信号——通用后端对未接真实数据源的部门会回演示占位 keyMetrics
 * （如 "今日战况: 推进中[演示]"），不能据此判定有数据，否则会越过种子用空壳占位。
 */
export function overviewHasData(ov: DeptData | null | undefined): boolean {
  if (!ov) return false;
  return (ov.risks?.length ?? 0) + (ov.activeTasks?.length ?? 0) > 0;
}

/** 取部门种子（后端空/不可用时兜底）。 */
export function getDeptSeed(code: string): DeptData | null {
  return REGISTRY[code]?.seed ?? null;
}

/** k-匿名硬门槛（Schneier）：取该部门"分母过小可反推个人"的子群名单（无则空数组）。 */
export function getReidentifiableGroups(code: string): string[] {
  return REGISTRY[code]?.reidentifiable ?? [];
}

/**
 * buildDeptContext —— 通用算分离：把指标/风险/任务连同 JS 预算好的统计量组装成事实底座。
 * 出现在 context 里的数字即 number-verifier 的接地依据。
 */
export function buildDeptContext(
  ov: DeptData,
  priorSignals: PriorSignal[] = [],
  calibration = '',
): string {
  const metrics = ov.keyMetrics ?? [];
  const risks = ov.risks ?? [];
  const tasks = ov.activeTasks ?? [];

  const riskCounts = risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.level] = (acc[r.level] ?? 0) + 1;
    return acc;
  }, {});
  const avgProgress = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + (t.progressPct ?? 0), 0) / tasks.length)
    : null;

  const computed = [
    `关键指标 ${metrics.length} 项 · 在办任务 ${tasks.length} 项 · 风险 ${risks.length} 条`,
    '风险分级计数：' +
      (['critical', 'high', 'medium', 'low'] as const)
        .map((lv) => `${RISK_LABEL[lv]} ${riskCounts[lv] ?? 0} 条`)
        .join(' / '),
    avgProgress != null ? `在办任务平均进度 ${avgProgress}%` : '在办任务平均进度 —（无在办任务）',
  ].join('\n');

  const metricLines = metrics.length
    ? metrics.map((m) => `· ${m.label}：${m.value}${m.unit ?? ''}`).join('\n')
    : '·（无关键指标）';
  const riskLines = risks.length
    ? risks.map((r) => `· [${RISK_LABEL[r.level]}] ${r.label}`).join('\n')
    : '·（无风险条目）';
  const taskLines = tasks.length
    ? tasks.map((t) => `· ${t.title}（进度 ${t.progressPct}%）`).join('\n')
    : '·（无在办任务）';

  return [
    '【已核算指标（直接引用，勿心算）】',
    computed,
    '',
    '【关键指标（原始数据）】',
    metricLines,
    '',
    '【风险明细】',
    riskLines,
    '',
    '【在办任务】',
    taskLines,
    formatBlackboard(priorSignals), // stigmergy：他部近期冲突信号
    calibration, // Deming Study 回路：本部历史归因对账率（让 agent 见到自己的校准分）
  ].join('\n');
}

/** 跑一次通用部门单 agent。code 必须在注册表里（hasDeptAgent）。priorSignals = 共享黑板他部信号。 */
export function askDept(
  code: string,
  command: string,
  ov: DeptData,
  priorSignals: PriorSignal[] = [],
  calibration = '',
): Promise<AgentResult> {
  const logic = REGISTRY[code];
  if (!logic) throw new Error('DEPT_AGENT_NOT_CONFIGURED');
  return runAgent({ role: logic.role, context: buildDeptContext(ov, priorSignals, calibration), command });
}
