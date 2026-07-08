/**
 * 户部 · 班底配置（一引擎多班底 · 可定制 · 2026-06-27）
 *
 * 演进：
 *   1) 一台引擎(分诊→办公→圣裁→缺证/风险/人工门→批复)完全复用；班底只是「哪些岗位 + 深度 + 文书」。
 *   2) 大公司 = 小公司基础 6 岗 +「再增加几个岗位」(融合，非两套并行)。成长公司原地升级、不迁移。
 *   3) 用户可自己增减岗位：预设(lite/pro)只是**起点模板**，老板能从岗位目录加岗/减岗，或加自定义岗。
 *
 * 纪律：
 *   - 铁律2(SSOT)：`backendQuestionTypes` 一律引 `HubuFinanceQuestionType` 真枚举，禁平行 map。
 *   - 铁律9：本文件只做前端展示/路由分诊；真办公执行在后端 jiqun，不在此。
 *   - 张小龙：默认(lite 预设)开箱即用，**定制是可选不强迫**——别让小老板上来就面对配置题。
 *   - 不可变(coding-style)：增减岗位的 helper 一律返回新对象，不就地改。
 *   - guardianSkill 指向已装的 `~/.claude/skills/<id>`（开发态会审镜片，见 AGENTS.md §12.1）。
 *
 * ⚠️ 已知缺口(诚实标注)：后端 `HubuFinanceQuestionType` 为大公司而建，**没有"税务"类**——
 *   而税务是 <1000万 老板的杀手功能。`tax` 岗暂以 frontendTopics 承载，待后端补 `税务申报与筹划` 类再接。
 */
import type { HubuFinanceQuestionType } from '@/core/courtos/hubu/hubu-types';

export type HubuRosterId = 'lite' | 'pro' | 'custom';

export interface HubuStaffRole {
  /** 岗位 id（前端稳定键；自定义岗以 `custom:<slug>` 命名） */
  id: string;
  /** 朝堂/展示名 */
  nameCn: string;
  /** 对标真实公司岗位（让老板秒懂这是谁） */
  realJobTitle: string;
  /** 一句话职责（白话，面向小老板） */
  duties: string;
  /** 该岗负责的小老板真实话题（展示用，白话） */
  frontendTopics: string[];
  /** 映射到后端 SSOT 问题类型（分诊用；无匹配则空 + note 说明） */
  backendQuestionTypes: HubuFinanceQuestionType[];
  /** 守护大神 skill id（开发态会审镜片，AGENTS.md §12.1） */
  guardianSkill: string;
  /** 守护大神一句镜片（产品里可展开看，专业可解释） */
  guardianLens: string;
  /** 主色（复用冻结帝金系，不新造色） */
  accent: string;
  /** 是否用户自定义岗（区分目录岗 vs 老板手加岗） */
  custom?: boolean;
  /** 缺口/TODO 标注（诚实，禁静默） */
  note?: string;
}

export interface HubuRoster {
  id: HubuRosterId;
  label: string;
  /** 目标客户营收段（定位锚） */
  revenueBand: string;
  staff: HubuStaffRole[];
}

const GOLD = '#F0C66A';
const GOLD_SOFT = '#ebcb7b';

/* ==========================================================================
   岗位目录（CATALOG）：所有可选的预定义财务岗位。用户加岗从这里挑。
   ========================================================================== */

/** 基础 6 岗：所有公司都有，小老板真养不起的六件事。 */
const BASE_STAFF: Record<string, HubuStaffRole> = {
  cashier: {
    id: 'cashier',
    nameCn: '出纳',
    realJobTitle: '出纳 / 现金管家',
    duties: '管每一笔钱的进出、对账、现金日记，盯现金够不够付',
    frontendTopics: ['现金够不够付', '客户货款催收', '这笔款付不付', '收付对账'],
    backendQuestionTypes: ['现金流判断', '回款与账期判断', '采购付款判断', '其他财务问题'],
    guardianSkill: 'taiichi-ohno-perspective',
    guardianLens: '少府·大野耐一：现场零差错对账，每一笔钱进出都要对得上。',
    accent: GOLD_SOFT,
  },
  accountant: {
    id: 'accountant',
    nameCn: '会计',
    realJobTitle: '会计 / 做账',
    duties: '记账、月结、算成本毛利、经营复盘——替代代账黑箱，实时透明',
    frontendTopics: ['这个月赚了多少', '成本毛利分析', '报价划不划算', '月度账本'],
    backendQuestionTypes: ['经营复盘', '成本毛利分析', '报价审查', '招聘/组织成本判断'],
    guardianSkill: 'dalio-perspective',
    guardianLens: '尚书令·达利欧：口径一致，把账做成能复盘的系统，而非月底一张糊涂表。',
    accent: GOLD,
  },
  tax: {
    id: 'tax',
    nameCn: '税务',
    realJobTitle: '税务 / 报税筹划',
    duties: '报税、税负测算、合法省税、盯稽查风险——代账绝不主动做的事',
    frontendTopics: ['这个月交多少税', '怎么合法省税', '发票合规', '稽查风险'],
    backendQuestionTypes: ['异常风险审计', '合同财务条款审查'],
    guardianSkill: 'schneier-perspective',
    guardianLens: '司天监·Schneier：合规是红线，合法节税是本分，盯住稽查的尾部风险。',
    accent: GOLD_SOFT,
    note: '⚠️ 后端无专属「税务」问题类——杀手功能暂以 frontendTopics 承载，待后端补 `税务申报与筹划` 类再接。',
  },
  financing: {
    id: 'financing',
    nameCn: '融资',
    realJobTitle: '融资 / 借贷顾问',
    duties: '这笔经营贷划不划算、哪个融资方案好、还款能力够不够',
    frontendTopics: ['这笔贷款划不划算', '融资方案比较', '还款能力', '利率/费用拆解'],
    backendQuestionTypes: ['融资/借款判断'],
    guardianSkill: 'howard-marks-perspective',
    guardianLens: '户部·马克斯：周期定位、风险=永久损失，借贵了/借错了是会要命的负风险。',
    accent: GOLD,
  },
  investment: {
    id: 'investment',
    nameCn: '投资',
    realJobTitle: '投资 / 评审',
    duties: '这个新项目/设备/理财投不投、回报多少、可不可逆',
    frontendTopics: ['这个项目投不投', '买设备划不划算', '闲钱怎么放', '回收期与回报'],
    backendQuestionTypes: ['投资评审'],
    guardianSkill: 'jeff-bezos-perspective',
    guardianLens: '大司徒·贝索斯：先问这是单向门还是双向门，再从客户价值反推回报。',
    accent: GOLD_SOFT,
  },
  budget: {
    id: 'budget',
    nameCn: '预算',
    realJobTitle: '预算 / 度支',
    duties: '这笔钱该不该花、几件事先做哪件、年度预算怎么分',
    frontendTopics: ['这笔钱该不该花', '优先批哪个', '年度预算分配', '超支预警'],
    backendQuestionTypes: ['预算审批'],
    guardianSkill: 'howard-marks-perspective',
    guardianLens: '户部·马克斯：第二层思维——别只问能不能花，问风险有没有被回报补偿。',
    accent: GOLD,
  },
};

/** 专业增量岗：小公司折叠在基础岗里、大公司才独立分工的角色。用户加岗的主要来源。 */
const PRO_EXTRA_STAFF: Record<string, HubuStaffRole> = {
  cfo_chief: {
    id: 'cfo_chief',
    nameCn: '财务总监',
    realJobTitle: 'CFO / 财务总监',
    duties: '总揽全局、跨岗合议、最终圣裁（小公司里这就是老板自己）',
    frontendTopics: ['财务总裁决', '跨岗合议', '战略财务'],
    backendQuestionTypes: [],
    guardianSkill: 'jeff-bezos-perspective',
    guardianLens: '大司徒·贝索斯：客户反向 + 单向门/双向门判断。',
    accent: GOLD,
  },
  cost_pricing: {
    id: 'cost_pricing',
    nameCn: '成本',
    realJobTitle: '成本会计 / 定价',
    duties: '报价审查、成本核算、毛利与定价（小公司里并入会计）',
    frontendTopics: ['报价审查', '成本核算', '定价策略'],
    backendQuestionTypes: ['报价审查', '采购付款判断'],
    guardianSkill: 'jeff-bezos-perspective',
    guardianLens: '贝索斯：从客户价值反推定价，不是成本加成。',
    accent: GOLD_SOFT,
  },
  audit_control: {
    id: 'audit_control',
    nameCn: '内审',
    realJobTitle: '内审 / 合规',
    duties: '内部审计、合规、合同财务条款、舞弊防范（小公司里并入税务）',
    frontendTopics: ['异常审计', '合规审查', '合同条款'],
    backendQuestionTypes: ['异常风险审计', '合同财务条款审查'],
    guardianSkill: 'taleb-perspective',
    guardianLens: '太史令·塔勒布：盯尾部风险，skin in the game。',
    accent: GOLD_SOFT,
  },
  treasury: {
    id: 'treasury',
    nameCn: '财资',
    realJobTitle: '资金管理 / Treasury',
    duties: '大额资金调度、投融资组合、流动性与汇率（小公司里并入出纳+融资）',
    frontendTopics: ['资金调度', '流动性管理', '汇率敞口'],
    backendQuestionTypes: [],
    guardianSkill: 'howard-marks-perspective',
    guardianLens: '马克斯：周期定位、风险=永久损失。',
    accent: GOLD,
  },
};

/** 全部可选岗位目录（基础 6 + 专业增量 4 = 10）。用户加岗的候选池。 */
export const HUBU_STAFF_CATALOG: Record<string, HubuStaffRole> = {
  ...BASE_STAFF,
  ...PRO_EXTRA_STAFF,
};

/** 目录列表形式（给"加岗"选择器 UI 用）。 */
export const HUBU_STAFF_CATALOG_LIST: HubuStaffRole[] = Object.values(HUBU_STAFF_CATALOG);

/* ==========================================================================
   预设模板（PRESETS）：用户定制的起点，不是终点。
   ========================================================================== */

/** 小公司轻班底起点：基础 6 岗。 */
export const LITE_PRESET_IDS = ['cashier', 'accountant', 'tax', 'financing', 'investment', 'budget'] as const;

/** 大公司专业班底起点：增量岗在前(CFO 居首) + 基础 6 岗兜底。 */
export const PRO_PRESET_IDS = ['cfo_chief', 'cost_pricing', 'audit_control', 'treasury', ...LITE_PRESET_IDS] as const;

function resolveRoster(meta: Omit<HubuRoster, 'staff'>, staffIds: readonly string[]): HubuRoster {
  const staff = staffIds.map((id) => HUBU_STAFF_CATALOG[id]).filter((s): s is HubuStaffRole => Boolean(s));
  return { ...meta, staff };
}

export const HUBU_LITE_ROSTER: HubuRoster = resolveRoster(
  { id: 'lite', label: '轻班底 · 小微企业', revenueBand: '年收入 < 1000万' },
  LITE_PRESET_IDS,
);

export const HUBU_PRO_ROSTER: HubuRoster = resolveRoster(
  { id: 'pro', label: '专业班底 · 大公司 CFO 办公厅', revenueBand: '有专职财务部 / 营收 > 1亿' },
  PRO_PRESET_IDS,
);

export const HUBU_PRESETS: Record<'lite' | 'pro', HubuRoster> = {
  lite: HUBU_LITE_ROSTER,
  pro: HUBU_PRO_ROSTER,
};

/** v1 默认班底：小微企业轻班底。 */
export const DEFAULT_HUBU_ROSTER: HubuRosterId = 'lite';

export function getHubuPreset(id: 'lite' | 'pro' = 'lite'): HubuRoster {
  return HUBU_PRESETS[id];
}

/* ==========================================================================
   用户自定义：从预设起点，增/减岗位（全部不可变，返回新对象）。
   持久化(localStorage / 后端偏好)由调用方负责；本文件只管纯函数变换。
   ========================================================================== */

/** 加一个目录里的岗位（已在则原样返回；目录无此 id 则原样返回，不静默造岗）。 */
export function addStaffById(roster: HubuRoster, staffId: string): HubuRoster {
  if (roster.staff.some((s) => s.id === staffId)) return roster;
  const role = HUBU_STAFF_CATALOG[staffId];
  if (!role) return roster;
  return { ...roster, id: 'custom', label: '自定义班底', staff: [...roster.staff, role] };
}

/** 加一个老板自创的岗位（自定义角色；标 custom=true）。 */
export function addCustomStaff(roster: HubuRoster, role: HubuStaffRole): HubuRoster {
  if (roster.staff.some((s) => s.id === role.id)) return roster;
  return { ...roster, id: 'custom', label: '自定义班底', staff: [...roster.staff, { ...role, custom: true }] };
}

/** 减一个岗位（不存在则原样返回）。 */
export function removeStaffById(roster: HubuRoster, staffId: string): HubuRoster {
  if (!roster.staff.some((s) => s.id === staffId)) return roster;
  return { ...roster, id: 'custom', label: '自定义班底', staff: roster.staff.filter((s) => s.id !== staffId) };
}

/** 当前可加岗位（目录里尚未在班底中的）。给"加岗"选择器用。 */
export function availableToAdd(roster: HubuRoster): HubuStaffRole[] {
  const have = new Set(roster.staff.map((s) => s.id));
  return HUBU_STAFF_CATALOG_LIST.filter((s) => !have.has(s.id));
}

/** 按后端问题类型分诊到对应岗位（找不到回 undefined，由调用方兜底，禁静默冒充）。 */
export function staffForQuestionType(
  roster: HubuRoster,
  questionType: HubuFinanceQuestionType,
): HubuStaffRole | undefined {
  return roster.staff.find((s) => s.backendQuestionTypes.includes(questionType));
}
