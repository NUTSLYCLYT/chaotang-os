/**
 * 吏部 · 人事决策部编制 6 司花名册（纯函数 · 2026-06-29）
 *
 * 吏部本命=人事决策中台：选才/劳关/薪酬/晋升/制度——确定性合规判断部。
 * 4 个真引擎（选才/劳关/薪酬/铨叙）已接入 libu/lib 真计算；制度司骨架待建。
 * domain 码=personnel(SixDepartmentCode)。诚实标真/骨架，不冒充。
 */

export type LibuOfficeId =
  | 'chief'
  | 'talent_selection'
  | 'labor_relations'
  | 'compensation'
  | 'promotion'
  | 'training'
  | 'org'
  | 'policy';

export interface LibuOfficeRole {
  id: LibuOfficeId;
  name: string;
  role: string;
  duty: string;
  /** 能力/skill 配置（运行态本命方法+数据源）。 */
  skill: string;
  /** 复用的已建件（为空=待建）。 */
  reuses: string[];
  /** 是否已接真引擎（诚实：false=骨架待建）。 */
  engine: boolean;
}

export const LIBU_OFFICE_ORDER: LibuOfficeId[] = [
  'chief',
  'talent_selection',
  'labor_relations',
  'compensation',
  'promotion',
  'training',
  'org',
  'policy',
];

/** 吏部主题色（personnel accent，单一真相源）。 */
export const ACCENT = '#A99CF0';

export const LIBU_ROSTER: Record<LibuOfficeId, LibuOfficeRole> = {
  chief: {
    id: 'chief',
    name: '吏部尚书',
    role: '人事决策总负责',
    duty: '统筹招人/辞退/薪酬/晋升/制度，守人事合规与组织战略对齐；高危人事一票否决',
    skill: '统筹 + 高危人事一票否决（辞退/（降薪/调岗待建））',
    reuses: ['governance/gate'],
    engine: false,
  },
  talent_selection: {
    id: 'talent_selection',
    name: '选才司',
    role: '选才/招聘把关',
    duty: '招人前验证：有无预算 + JD + 90天成功标准；算年成本×1.4社保系数；ROI < 1 则"养不起"',
    skill: '招人三件套：预算/JD/成功标准 + 年成本（月薪×12×1.4）+ ROI',
    reuses: ['hiring-review'],
    engine: true,
  },
  labor_relations: {
    id: 'labor_relations',
    name: '劳关司',
    role: '劳动关系/辞退合规',
    duty: '辞退路径：协商/绩效/违纪；算N/N+1/2N赔偿；挡违法解除雷（PIP未做→违法解除）',
    skill: '中国劳动法：N/N+1/2N + 违法解除判定 + 合法三步路径',
    reuses: ['termination-review'],
    engine: true,
  },
  compensation: {
    id: 'compensation',
    name: '薪酬司',
    role: '薪酬定级/调薪',
    duty: '宽带薪酬（min/中位/max）+ 按经验分位定薪 + 绩效×分位调薪矩阵；让钱流向"绩优且低薪"',
    skill: '市场中位→带宽(±20%) + 分位定薪(25/50/75) + 绩效调薪矩阵(A/B/C)',
    reuses: ['compensation-band'],
    engine: true,
  },
  promotion: {
    id: 'promotion',
    name: '铨叙司',
    role: '晋升/转正评估',
    duty: '转正评价表解析：多维度评分→总分/满分/百分比 → 准予/延续/不予转正；缺评分标缺不替打',
    skill: '多维度评分表解析 + 缺评分标缺（绝不替老板打分）',
    reuses: ['promotion-review'],
    engine: true,
  },
  training: {
    id: 'training',
    name: '培训发展司',
    role: '培训/技能发展',
    duty: '培训前算账:技能gap评估 + 培训计划 + 成效衡量标准;ROI=预期年增量/投入,<1则"不值别砸钱"',
    skill: '培训三件套(gap/计划/成效)+ 培训 ROI(年增量/投入);L&D 技能可与翰林院联动',
    reuses: ['training-review'],
    engine: true,
  },
  org: {
    id: 'org',
    name: '组织编制司',
    role: '定岗定编/增岗决策',
    duty: '增岗前算账:工作量证据 + 重组/挖潜替代 + 编制预算;人力成本占比>50%警戒线,增量ROI<1则缓增',
    skill: '编制健康度(总人力成本/营收)+ 增量ROI + 增岗三质门;守"业务一忙就加人"失控雷',
    reuses: ['org-headcount-review'],
    engine: true,
  },
  policy: {
    id: 'policy',
    name: '制度司',
    role: '人事制度/规章',
    duty: '员工手册/薪酬制度/考勤制度拟定与发布；合规红线审查，需刑部联审',
    skill: '制度拟定（LLM草稿）+ 法律合规审查（刑部联审）',
    reuses: ['policy-declaration'],
    engine: false,
  },
};

/** 已接真引擎的司数 / 总（诚实展示几真几骨架）。 */
export function libuEngineStats(): { real: number; total: number } {
  const all = Object.values(LIBU_ROSTER);
  return { real: all.filter((o) => o.engine).length, total: all.length };
}
