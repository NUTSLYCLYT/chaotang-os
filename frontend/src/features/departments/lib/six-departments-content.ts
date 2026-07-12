import { getDepartmentGovernance } from '@/features/departments/lib/department-governance';
import {
  getV1LiubuByCanonicalCode,
  type V1CanonicalDepartmentCode,
} from '@/config/chaotang-v1-modules';

export type SixDepartmentCode =
  | 'finance'
  | 'ops'
  | 'gongbu'
  | 'legal'
  | 'market'
  | 'personnel';

export type DepartmentPanelSection = {
  title: string;
  items: string[];
};

export type SixDepartmentContent = {
  code: SixDepartmentCode;
  name: string;
  titleEn: string;
  accent: string;
  background: string;
  maturity: string;
  bureauCount: number;
  positioning: string;
  bossLine: string;
  statusNote: string;
  capabilities: string[];
  panelSections: DepartmentPanelSection[];
  currentState: string[];
  nextFocus: string;
};

export const SIX_DEPARTMENT_SCROLL_THEME: Record<SixDepartmentCode, { accent: string; accentSoft: string }> = {
  personnel: { accent: '#7B5EA7', accentSoft: '#C7B8F2' },
  finance: { accent: '#C8912F', accentSoft: '#F0C66A' },
  market: { accent: '#C0432C', accentSoft: '#F09A72' },
  ops: { accent: '#3E6E8E', accentSoft: '#86A9F2' },
  legal: { accent: '#2B3A5C', accentSoft: '#6E82C5' },
  gongbu: { accent: '#3E7C6A', accentSoft: '#7FC9A8' },
};

export function getSixDepartmentScrollTheme(code: SixDepartmentCode) {
  return SIX_DEPARTMENT_SCROLL_THEME[code];
}

const FINANCE = getDepartmentGovernance('finance');
const OPS = getDepartmentGovernance('ops');
const GONGBU = getDepartmentGovernance('gongbu');
const LEGAL = getDepartmentGovernance('legal');
const MARKET = getDepartmentGovernance('market');
const PERSONNEL = getDepartmentGovernance('personnel');

export const SIX_DEPARTMENTS: Record<SixDepartmentCode, SixDepartmentContent> = {
  finance: {
    code: 'finance',
    name: '户部',
    titleEn: 'Revenue Office',
    accent: '#F0C66A',
    background: '/assets/six-ministries/hubu-bg.webp',
    maturity: '真链较完整',
    bureauCount: 2,
    positioning: '把现金流、预算、报价、融资、审计和投资研究变成可追溯的财务奏折。',
    bossLine: '财务决策中台，1.0 先开预算司、出纳司。',
    statusNote: '六部里最接近真财务工作台，已有真实总览、真实项目、付款预览和财报预览。',
    capabilities: [
      '现金安全分析：看现金余量、付款节奏、回款窗口和最低安全垫。',
      '投入回报分析：按 ROI、回收期和机会成本重排预算优先级。',
      '预算纪律判断：区分必须暂停、可放行、要补证和要老板拍板的预算项目。',
      '审计留痕检查：检查凭证、审批链、合同、付款依据和证据缺口。',
      '三本账管理：管理待批账、已准账、退回账。',
      '项目审批与裁决：对预算项目做准奏、退回和风险判断。',
      '付款裁决预览：做只读付款结论预览，不直接执行真实付款。',
      '财报与融资预览：生成财报、融资材料和财务判断预览。',
    ],
    panelSections: [
      {
        title: '左栏 · 库银总览',
        items: [
          '现金安全、投入回报、预算纪律、审计留痕四个入口可直接发问。',
          '显示今日主判断、待裁数量、退回数量和紧急数量。',
          '展示总申请预算、本周已准、现金余量、平均 ROI 等经营指标。',
          '支持预算去向占比、预算/出纳两类奏折队列、户部判词和新增预算审批入口。',
        ],
      },
      {
        title: '中栏 · 户部大账',
        items: [
          '三本账视图：待批账、已准账、退回账。',
          '点击任意项目，右栏自动切换到对应审计裁决。',
          '支持快速准奏和快速退回补证。',
          '按状态和优先级排序，形成“今天先批谁”的操作面。',
        ],
      },
      {
        title: '右栏 · 审计裁决',
        items: [
          '展示项目摘要、状态、优先级、推荐意见和财务指标。',
          '显示奏折质门、各司接办、验收标准和付款裁决预览。',
          '可进一步校验付款决策回执草稿和财报审计预览。',
          '支持军机预算追踪和跨部门流转。',
        ],
      },
      {
        title: '底部与交互',
        items: [
          'HubuBottomDock 常驻，承接所有户部问责、下旨和扩展动作。',
          '选中项目后可围绕该项目继续追问，不需要跳页。',
        ],
      },
    ],
    currentState: [
      '最接近真财务工作台。',
      '以预览和裁决为主，不是自动真实资金执行。',
    ],
    nextFocus: '把付款预览继续推进到“人工确认后真实执行”的闭环。',
  },
  ops: {
    code: 'ops',
    name: '兵部',
    titleEn: 'Operations Office',
    accent: '#6BA0FF',
    background: '/assets/six-ministries/bingbu-bg.webp',
    maturity: '页面与流程较完整',
    bureauCount: 2,
    positioning: '把客户、商机、渠道、竞争和增长漏斗转成可执行的攻防奏折。',
    bossLine: '销售竞争作战台，1.0 先开报价司、线索司。',
    statusNote: '是较完整的竞争分析与战情编排页，强在判断、编排、竞争态势与策略输出。',
    capabilities: [
      '敌军情报看板：看主要竞品、威胁等级和最近动作。',
      '头号对手分析：识别谁最危险、在抢哪些客户。',
      '客户战场分析：按重点客户、渠道、区域和漏斗风险拆战场。',
      '价格攻防判断：分析竞品压价、我方守价边界和换打法条件。',
      '护城河评估：判断产品、交付、客户关系、合规、品牌哪条线能守。',
      '各司接办：动态拉销售、客户、竞情、增长等几司处理。',
      '策略分发：从竞品、客户、渠道、增长维度给出行动建议。',
    ],
    panelSections: [
      {
        title: '左栏 · 敌军情报',
        items: [
          '提供头号对手、客户战场、价格攻防、护城河评估四类入口。',
          '显示本周主攻判断、核心指标、数据源状态和 AI 军情判词。',
          '列出监控中的竞品列表，并支持新增侦察任务。',
        ],
      },
      {
        title: '中栏 · 战场沙盘',
        items: [
          '按战场节点展示销售、市场、渠道等竞争区域。',
          '点击不同战场节点切换当前焦点。',
          '底部战场信息条实时显示当前战场名称与描述。',
          '中屏承担“看全局竞争局势”的作用，不是 CRM 录入页。',
        ],
      },
      {
        title: '右栏 · 攻防策略',
        items: [
          '展示竞品详情、威胁等级、份额、最新动作和关键指标。',
          '根据竞品特征匹配不同战报类型和门禁边界。',
          '动态调度销售司、客户司、竞情司、增长司等出列。',
          '输出推荐战略、SWOT 分析和关联战场路径。',
        ],
      },
      {
        title: '底部与交互',
        items: [
          '通过底部输入框直接向兵部下达“发兵”指令。',
          '支持 URL 同步，方便分享当前竞品与战场上下文。',
        ],
      },
    ],
    currentState: [
      '较完整的竞争分析与战情编排台。',
      'CRM、真实成交链和执行回写尚未完全接入。',
    ],
    nextFocus: '补真实客户、机会、渠道和成交回写。',
  },
  gongbu: {
    code: 'gongbu',
    name: '工部',
    titleEn: 'Works Office',
    accent: '#7FC9A8',
    background: '/assets/six-ministries/gongbu-bg.webp',
    maturity: '工程流水线较完整',
    bureauCount: 1,
    positioning: '把产品、技术、交付、供应链、产能和质量转成可验收的交付奏折。',
    bossLine: '研发交付流水线，1.0 先开产研司。',
    statusNote: '是六部里最像研发执行工作台的一页，强在“任务推进 + 质量门 + 派发建设案”。',
    capabilities: [
      '生成实现：把任务拆成页面、组件、数据适配和最小实现 diff。',
      '测试补证：补 tsc、build、Playwright、截图等验收证据。',
      '阻塞依赖梳理：识别被户部、刑部、军机处或外部材料卡住的事项。',
      '发布门禁检查：检查 build、回滚、端口、史馆归档和不可承诺事项。',
      '六司流水线推进：按产品、技术、交付、供应、制造、质量推进任务。',
      '任务状态展示：展示研发任务、待测试、高风险和质量门信号。',
    ],
    panelSections: [
      {
        title: '左栏 · 工部总览',
        items: [
          '提供生成实现、测试补证、阻塞依赖、发布门禁四类入口。',
          '显示当前卡点面板、工程指标、预算边界和工部六司导航。',
        ],
      },
      {
        title: '中栏 · 研发流水线',
        items: [
          '六列流水线按产品、技术、交付、供应、制造、质量分栏展示任务。',
          '点击任务后右栏质门刷新。',
          '一页看清哪些卡在生成、测试、交付、质量或依赖上。',
        ],
      },
      {
        title: '右栏 · 工部质门',
        items: [
          '围绕选中任务展示质量意见和下一步动作。',
          '给出 CTA、CPO、质门立场和当前信号。',
          '显示预算联动、建设案派发和 Ledger 回执。',
        ],
      },
      {
        title: '底部与交互',
        items: [
          '底部 DecreeInput 以 order 模式对工部下令。',
          '输入框会带着当前任务、质门信号、跨部门会审和 readiness 一起传递。',
        ],
      },
    ],
    currentState: [
      '最像研发执行工作台。',
      '仍偏工程沙盘和流程编排，不是完整真实产线系统。',
    ],
    nextFocus: '补真实任务来源、构建结果和发布回执联动。',
  },
  legal: {
    code: 'legal',
    name: '刑部',
    titleEn: 'Justice Office',
    accent: '#3DD68C',
    background: '/assets/six-ministries/xingbu-bg.webp',
    maturity: '真链较完整',
    bureauCount: 1,
    positioning: '把合同、合规、授权、安全和争议转成有红线的风控奏折。',
    bossLine: '法务风控案件台，1.0 先开合同司。',
    statusNote: '刑部是当前最成熟的真链型页面之一，已具备真实案件总览、流转和法务裁决骨架。',
    capabilities: [
      '合同权益风险排查：检查付款、交付、违约、排他、知识产权和客户承诺。',
      '内控制度风险排查：检查审批权限、授权、印章、数据访问和留痕。',
      '突发事件法务响应：处理客诉、监管问询、劳动争议、供应商违约和舆情升级。',
      '法规趋势监控：跟踪新规、司法口径和行业监管变化。',
      '案件入口与三列案卷管理：管理案件进入、审理和状态流转。',
      'AI 判词与高风险告警：给出法务判词和高风险提醒。',
      '新立案审查：生成新的立案审查草稿。',
    ],
    panelSections: [
      {
        title: '左栏 · 案件入口',
        items: [
          '提供合同权益、内控制度、突发事件、法规趋势四类排查入口。',
          '显示风险指数、今日优先处理法雷、核心指标、数据源状态和刑部判词。',
          '支持直接生成新的立案审查草稿。',
        ],
      },
      {
        title: '中栏 · 三列案卷',
        items: [
          '待审案、审理中、已结/上诉三列案卷管理。',
          '点击案件即可刷新右栏裁决详情。',
          '支持 URL 同步，保留案件选中上下文。',
        ],
      },
      {
        title: '右栏 · 裁决详情',
        items: [
          '展示案件摘要、状态、风险、案号和建议。',
          '查看引用法条、风险与证据、军机裁决追踪和跨部门流转。',
          '高风险事项突出显示人工确认门，提醒老板确认。',
        ],
      },
      {
        title: '底部与交互',
        items: [
          '底部裁断输入可直接向刑部发起裁断请求。',
          '选中案件时，输入会自动带上案号和标题上下文。',
        ],
      },
    ],
    currentState: [
      '当前最成熟的真链型页面之一。',
      '接近“真法务工作台”，但仍不是完整案件管理系统。',
    ],
    nextFocus: '补更完整的案件生命周期与归档追踪。',
  },
  market: {
    code: 'market',
    name: '礼部',
    titleEn: 'Rites Office',
    accent: '#C070D0',
    background: '/assets/six-ministries/libu-rites-bg.webp',
    maturity: '4 真司已接线',
    bureauCount: 4,
    positioning: '把品牌、客户沟通、公关、内容和体验转成稳妥的对外奏折。',
    bossLine: '礼部对外增长本命：关系台账、流量增长、对外承诺可逆、商务公关 4 司先接真引擎，其余 4 司仍是骨架。',
    statusNote: '中栏新增礼部真工作台：关系台账/流量增长/对外承诺可逆/商务公关 4 司可直接算，其余 4 司诚实标待通电。',
    capabilities: [
      '品牌总览：看品牌主张、传播节奏、企业文化和公关门禁。',
      '品牌主张梳理：统一客户、员工、伙伴的核心复述。',
      '宣传战役管理：组织官网、短视频、展会、公关等传播任务。',
      '企业文化表达梳理：对齐内部价值观、外部表达和客户承诺。',
      '公关门禁判断：区分哪些话能公开、哪些素材仍缺法务或事实核验。',
      '传播裁决面板：给单个传播案或战役做裁决、依赖和跨部门流转。',
      '审美与设计确认：检查品牌一致、视觉层级、发布质感和交互可用。',
      '礼部建设六部：给其他部门输出口径、文化表达、宣传素材和发布门禁。',
      '交工部执行：把传播需求转给工部做落地物料。',
      '入史馆归档：把传播案卷和决策结果归档。',
      'Bottom Dock 技能分派：支持礼部总调度、审美确认、舆情处置和技能分派。',
    ],
    panelSections: [
      {
        title: '左栏 · 品牌总览',
        items: [
          '品牌主张、宣传战役、企业文化、公关门禁四类核心卡片。',
          '显示品牌健康、本周声量、线索转化、舆情风险等指标。',
          '提供内容命中率、舆情速览、礼部判词和新建传播战役入口。',
        ],
      },
      {
        title: '中栏 · 传播案卷与品牌工房',
        items: [
          '展示传播稿、审稿单、素材单和礼部批示。',
          '支持交工部执行和入史馆归档。',
          '展示内容支柱、审美与设计确认和礼部建设六部。',
          '战役队列按进行中、待发布、已完成三列管理。',
        ],
      },
      {
        title: '右栏 · 传播裁决',
        items: [
          '展示礼部尚书卡、传播裁决面板和关键指标块。',
          '显示发布边界、依赖、阻塞和建议动作。',
          '明确交工部和归档等跨部门流转路径。',
        ],
      },
      {
        title: '底部与交互',
        items: [
          'LibuBottomDock 常驻，支持礼部总调度、审美确认、舆情处置和技能分派。',
          '选中传播战役后，Dock 会自动带入上下文。',
        ],
      },
    ],
    currentState: [
      '页面能力完整，品牌决策与编排台形态已成。',
      '中栏新增真工作台：关系台账/流量增长/对外承诺可逆/商务公关 4 司为纯函数本地引擎(LOCAL)，数据不出浏览器。',
      '品牌健康、战役、舆情、线索等主业务数据，以及总调度/新媒体运营/场合作战/品牌文化 4 骨架司仍未接真。',
    ],
    nextFocus: '给剩余 4 骨架司接真引擎；补真实战役库、舆情源、CRM/线索回写打通到 4 个已接线司。',
  },
  personnel: {
    code: 'personnel',
    name: '吏部',
    titleEn: 'Personnel Office',
    accent: '#A99CF0',
    background: '/assets/six-ministries/libu-officials-bg.webp',
    maturity: '招聘真链已落地，整体半沙盘',
    bureauCount: 2,
    positioning: '把责任人、组织能力、绩效偏差和干部风险转成可执行的人事奏折。',
    bossLine: '组织招聘干部台，1.0 先开任免司、招聘司。',
    statusNote: '吏部最值钱的是右栏“招聘把关”真链，当前本质是招聘真链已落地 + 组织管理工作台半成型。',
    capabilities: [
      '组织总览：看关键岗位是否稳、谁过载、谁能接班。',
      '关键岗位盘点：识别空缺或单点依赖岗位。',
      '招聘补位建议：判断先招谁、先外包谁、哪些岗位可以暂缓。',
      '过载团队识别：识别哪些团队或岗位被压穿。',
      '继任备份判断：识别关键人离开后是否有人接、知识是否沉淀。',
      '三列岗位视图：区分风险岗位、超载团队、健康岗位。',
      '招聘把关真链：右侧常驻真链入口，输入招聘需求即可启动。',
      '人才裁决钻取：点选岗位后查看岗位的人才裁决详情。',
    ],
    panelSections: [
      {
        title: '左栏 · 组织总览',
        items: [
          '提供关键岗位、招聘补位、过载团队、继任备份四类入口。',
          '显示关键岗位、空缺、超载、健康度等核心指标卡。',
          '展示核心岗满编率、组织风险、吏部判词和启动人才匹配入口。',
        ],
      },
      {
        title: '中栏 · 岗位三列',
        items: [
          '风险岗位、超载团队、健康岗位三列视图。',
          '每个岗位都可点选，点选后右栏切换到人才裁决钻取。',
          '中栏承担组织盘点与风险分类，不是 ATS 招聘管理页。',
        ],
      },
      {
        title: '右栏 · 招聘真链与人才裁决',
        items: [
          '招聘把关真链常驻主入口，不会被选中态替代。',
          'LiveRecruitPanel 承载当前最真实的人才执行链能力。',
          '下半区展示岗位详情、状态、团队和建议，形成真链与沙盘并存。',
        ],
      },
      {
        title: '底部与交互',
        items: [
          'PersonnelBottomDock 常驻，支持组织相关上下文操作。',
          '选中岗位后，底部和右栏围绕该岗位展开判断。',
        ],
      },
    ],
    currentState: [
      '右栏招聘把关真链最有价值。',
      '左栏和中栏多数组织盘点仍偏沙盘示意。',
    ],
    nextFocus: '补真实组织数据源和岗位生命周期管理。',
  },
};

export function isSixDepartmentCode(value: string): value is SixDepartmentCode {
  return value in SIX_DEPARTMENTS;
}

export function getSixDepartmentLinks() {
  return [
    { href: '/liubu', label: '回六部' },
    { href: '/junjichu', label: '去军机处' },
    { href: '/shiguan', label: '去史馆' },
  ];
}

export function getDepartmentBureaus(code: SixDepartmentCode) {
  const v1Department = getV1LiubuByCanonicalCode(code as V1CanonicalDepartmentCode);
  if (v1Department && v1Department.offices.length > 0) {
    return v1Department.offices.map((office) => ({
      name: office.name,
      role: office.role,
      scope: office.scope,
    }));
  }

  const governance = {
    finance: FINANCE,
    ops: OPS,
    gongbu: GONGBU,
    legal: LEGAL,
    market: MARKET,
    personnel: PERSONNEL,
  }[code];
  return governance.bureaus;
}

export function getDepartmentBureauSlug(index: number, code?: SixDepartmentCode) {
  if (code) {
    const v1Department = getV1LiubuByCanonicalCode(code as V1CanonicalDepartmentCode);
    const v1Office = v1Department?.offices[index];
    if (v1Office) return v1Office.slug;
  }
  return `bureau-${index + 1}`;
}

export function getDepartmentBureauBySlug(code: SixDepartmentCode, slug: string) {
  const v1Department = getV1LiubuByCanonicalCode(code as V1CanonicalDepartmentCode);
  const v1OfficeIndex = v1Department?.offices.findIndex(
    (office) => office.slug === slug || office.canonicalSlug === slug,
  );
  if (v1OfficeIndex !== undefined && v1OfficeIndex >= 0) {
    return getDepartmentBureaus(code)[v1OfficeIndex];
  }

  const match = /^bureau-(\d+)$/.exec(slug);
  if (!match) return undefined;

  const index = Number(match[1]) - 1;
  return getDepartmentBureaus(code)[index];
}

