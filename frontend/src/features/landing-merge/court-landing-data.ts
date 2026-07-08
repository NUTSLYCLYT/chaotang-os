export type DeptSlug = 'libu' | 'hubu' | 'libu_rites' | 'bingbu' | 'xingbu' | 'gongbu';

export type ArtLayout = 'purple-ranks' | 'gold-ledger' | 'vermilion-rites' | 'iron-war' | 'indigo-law' | 'jade-works';

export type DeptLanding = {
  slug: DeptSlug;
  name: string;
  short: string;
  heavenlyOffice: string;
  functionLine: string;
  description: string;
  agents: string[];
  accent: string;
  accentSoft: string;
  layout: ArtLayout;
  manifesto: string;
  files: Array<{
    title: string;
    eyebrow: string;
    body: string;
    metric: string;
  }>;
};

export type CourtSlug = 'index' | 'shangshufang' | DeptSlug | 'jinyiwei' | 'tianyiyuan';

export type CourtConsole = {
  slug: CourtSlug;
  name: string;
  seal: string;
  role: string;
  accent: string;
  summary: string;
  sections: string[];
  memorials: Array<{
    bureau: string;
    title: string;
    status: string;
    body: string;
    link?: string;
  }>;
  counsel: {
    chancellor: string;
    astrologer: string;
    archive: string;
  };
};

export const DEPT_LANDINGS: DeptLanding[] = [
  {
    slug: 'libu',
    name: '吏部',
    short: '吏',
    heavenlyOffice: '天官',
    functionLine: '铨叙 · 人才治理',
    description: '铨选授职，考绩百僚。执掌智能体军团的品级、考功与编制。',
    agents: ['铨选官', '授职吏', '考功郎'],
    accent: '#7B5EA7',
    accentSoft: '#C7B8F2',
    layout: 'purple-ranks',
    manifesto: '先定岗位责任，再定智能体品级；无人负责的事，不准进执行队列。',
    files: [
      { eyebrow: '铨选司', title: '新募 Agent 三员', body: '对候选智能体做能力、可信度、岗位匹配三项核验，拟授兵部斥候、户部主簿、工部百工各一。', metric: '3 员待授' },
      { eyebrow: '考功司', title: '本季军团考绩', body: '以交付证据、回写质量、延期次数和复盘引用率计分，晋 8、黜 2、留任 187。', metric: '197 员在册' },
      { eyebrow: '授职司', title: '关键岗位补位', body: '围绕销售、财务、工程三条真链梳理单点依赖，先补会审入口，再补自动化执行。', metric: '5 岗空缺' },
    ],
  },
  {
    slug: 'hubu',
    name: '户部',
    short: '户',
    heavenlyOffice: '地官',
    functionLine: '度支 · 财政投资',
    description: '钱粮账簿，金流长卷。盯盘度支，司国用之丰啬与盈亏。',
    agents: ['度支使', '盯盘校尉', '钱粮主簿'],
    accent: '#C8912F',
    accentSoft: '#F0C66A',
    layout: 'gold-ledger',
    manifesto: '所有承诺先过现金、毛利、回款和证据边界；没有账本，不准喊增长。',
    files: [
      { eyebrow: '度支司', title: '库银安全线', body: '复核现金余量、付款节奏和最低安全垫；对高额预付款保持人工确认门。', metric: '安全垫 4.8 月' },
      { eyebrow: '钱粮司', title: '预算去向', body: '将新增预算分成可准、补证、暂缓、驳回四类，避免把试验成本伪装成经营投入。', metric: '12 笔待裁' },
      { eyebrow: '盯盘司', title: '压价与利润风险', body: '对清库存、压价获客和回款窗口做联动判断，防止现金流赢了、毛利输掉。', metric: '3 案红线' },
    ],
  },
  {
    slug: 'libu_rites',
    name: '礼部',
    short: '礼',
    heavenlyOffice: '春官',
    functionLine: '典礼 · 品牌文教',
    description: '礼册题跋，司礼颁行。执掌品牌、内容、传播与文教之事。',
    agents: ['太常博士', '司礼官', '鸿胪'],
    accent: '#C0432C',
    accentSoft: '#F09A72',
    layout: 'vermilion-rites',
    manifesto: '对外表达必须可兑现、可核验、可撤回；礼部先守口径，再求声量。',
    files: [
      { eyebrow: '司礼司', title: '品牌主张复核', body: '统一客户、员工、伙伴三套话术，删掉未被交付证据支撑的宏大承诺。', metric: '7 条改写' },
      { eyebrow: '鸿胪司', title: '展会传播案', body: '把产品卖点、法务边界、销售线索回写三件事绑在同一份传播奏折里。', metric: '2 场待发' },
      { eyebrow: '太常司', title: '审美质门', body: '检查视觉层级、标题密度、按钮语义和发布截图，避免页面像说明书而不是朝堂。', metric: '6 项待验' },
    ],
  },
  {
    slug: 'bingbu',
    name: '兵部',
    short: '兵',
    heavenlyOffice: '夏官',
    functionLine: '征伐 · 销售获客',
    description: '舆图斥候，军报如飞。侦商机之信号，拓客于四方。',
    agents: ['斥候', '先锋', '粮草官'],
    accent: '#3E6E8E',
    accentSoft: '#86A9F2',
    layout: 'iron-war',
    manifesto: '战场不是 CRM 表格；先判竞争态势、客户窗口和守价边界，再派先锋。',
    files: [
      { eyebrow: '斥候司', title: '竞品异动', body: '跟踪头号竞品价格、交期、客户动作与公开舆情，筛出真正会影响成交的信号。', metric: '31 条线索' },
      { eyebrow: '先锋司', title: '本周主攻客户', body: '按窗口期、预算、决策人和竞争压力给机会排序，避免平均用力。', metric: '8 案主攻' },
      { eyebrow: '粮草司', title: '资源调度', body: '把销售承诺和工部交付能力对齐，不能先拿订单再让交付背锅。', metric: '3 成余量' },
    ],
  },
  {
    slug: 'xingbu',
    name: '刑部',
    short: '刑',
    heavenlyOffice: '秋官',
    functionLine: '律法 · 法务风控',
    description: '律例爰书，据证而断。司法务、合规、风控与断案之责。',
    agents: ['廷尉', '律博士', '监察御史'],
    accent: '#2B3A5C',
    accentSoft: '#6E82C5',
    layout: 'indigo-law',
    manifesto: '只看证据链、授权链和责任链；高风险承诺必须先过人工确认门。',
    files: [
      { eyebrow: '律法司', title: '合同红线', body: '复核付款、违约、排他、知识产权和客户承诺，缺证条款不得进入自动采纳。', metric: '5 条红线' },
      { eyebrow: '断案司', title: '个保法合规', body: '检查数据出境、告知同意、留痕和授权边界，未备案事项拟驳回补证。', metric: '2 案待断' },
      { eyebrow: '监察司', title: '流程巡查', body: '对六部下旨、会审、确认、归档链路抽查，重点看失败是否诚实暴露。', metric: '0 高危' },
    ],
  },
  {
    slug: 'gongbu',
    name: '工部',
    short: '工',
    heavenlyOffice: '冬官',
    functionLine: '营造 · 工程构建',
    description: '营造图样，百工蓝图。执掌工程、开发、数据管道与构建。',
    agents: ['将作监', '都水监', '百工'],
    accent: '#3E7C6A',
    accentSoft: '#7FC9A8',
    layout: 'jade-works',
    manifesto: '所有设计最后都要变成可运行、可验证、可回滚的工程交付。',
    files: [
      { eyebrow: '将作监', title: '主线构建竣工', body: '完成页面、组件、路由与状态拼装后，必须以 tsc、build、截图证明不是纸面完成。', metric: '4 门待验' },
      { eyebrow: '都水监', title: '数据管道巡检', body: '检查真实源、fallback 标记和回写路径，禁止用本地骨架冒充真实主库。', metric: '1 处延迟' },
      { eyebrow: '百工司', title: '测试覆盖补证', body: '把新增 UI 入口补进 E2E，确保关键按钮、输入框和跨页链接能跑通。', metric: '14 例新增' },
    ],
  },
];

export const COURT_CONSOLES: CourtConsole[] = [
  {
    slug: 'index',
    name: '军机处',
    seal: '机',
    role: '跨部批奏 · 一处裁决',
    accent: '#D4A84B',
    summary: '六部并锦衣卫、天医院待裁奏折汇于一台，可总览、可入部、可下旨。',
    sections: ['上书房拟旨', '六部会审', '锦衣卫异动', '天医院体征'],
    counsel: {
      chancellor: '本日待裁 31 折；户部钱粮、刑部合规、工部构建优先裁。',
      astrologer: '气数偏暖，宜进取批红，忌大额承诺无人工确认。',
      archive: '昨日批红十二折，准九、驳二、留中一，均已归史馆。',
    },
    memorials: [
      { bureau: '上书房 · 御前会议', title: '本日军国要务 · 三事待裁', status: '待批红', body: '户部奏钱粮、兵部奏获客、工部奏构建，三事俱毕，恭请圣裁。', link: '/court/shangshufang' },
      { bureau: '吏部 · 文选司', title: '新募 Agent 三员 · 铨选授职', status: '待准', body: '考核已毕，拟授兵部斥候、户部主簿、工部百工各一。', link: '/court/libu' },
      { bureau: '户部 · 度支司', title: '预算十二折 · 钱粮复核', status: '待裁', body: '三笔预算证据不足，二笔触发现金安全线，拟退回补证。', link: '/court/hubu' },
      { bureau: '刑部 · 断案司', title: '个保法合规核查 · 拟驳一案', status: '待断', body: '某案数据出境未备案，证据链不全，拟驳回补证。', link: '/court/xingbu' },
      { bureau: '工部 · 百工司', title: '测试覆盖率与发布质门', status: '待验', body: '构建通过，E2E 二处待修，余皆绿。', link: '/court/gongbu' },
    ],
  },
  {
    slug: 'shangshufang',
    name: '上书房',
    seal: '旨',
    role: '拟旨 · 问策 · 转军机',
    accent: '#D4A84B',
    summary: '承接老板原话，压缩成可路由、可补证、可裁决的旨意。',
    sections: ['老板原话', '丞相拟旨', '缺证检查', '转军机'],
    counsel: {
      chancellor: '先把问题改写成一条可执行旨意，再决定要问哪些部。',
      astrologer: '凡含付款、合同、客户承诺，先标高风险，不许静默采纳。',
      archive: '拟旨后必须能追到 taskId 与 sourceLabel。',
    },
    memorials: [
      { bureau: '御前', title: '老板原话压缩', status: '待拟', body: '把口语需求压成目标、证据、风险、下一步四段。' },
      { bureau: '丞相', title: '缺证列表', status: '待补', body: '识别缺客户、缺合同、缺报价、缺交付边界的事项。' },
      { bureau: '军机', title: '会审路由', status: '待转', body: '按事项性质路由户、兵、刑、工，不把产线流焊死在前端。' },
    ],
  },
  ...DEPT_LANDINGS.map<CourtConsole>((dept) => ({
    slug: dept.slug,
    name: dept.name,
    seal: dept.short,
    role: `${dept.functionLine} · 本部控制台`,
    accent: dept.accent,
    summary: dept.manifesto,
    sections: dept.agents,
    counsel: {
      chancellor: `${dept.name}只裁本部职责，不替其他部伪造结论。`,
      astrologer: '先看证据来源，再看颜色信号；DEMO/FALLBACK 必须明示。',
      archive: `${dept.name}批示后归档到史馆，供下次会审引用。`,
    },
    memorials: dept.files.map((file) => ({
      bureau: `${dept.name} · ${file.eyebrow}`,
      title: file.title,
      status: file.metric,
      body: file.body,
      link: `/depts/${dept.slug}`,
    })),
  })),
  {
    slug: 'jinyiwei',
    name: '锦衣卫',
    seal: '缇',
    role: '情报 · 异动 · 证据',
    accent: '#9B3A4D',
    summary: '暗线只交付可核验情报，不把传闻冒充事实。',
    sections: ['经历史', '镇抚司', '巡检司'],
    counsel: {
      chancellor: '情报只做触发器，不能替代业务裁决。',
      astrologer: '异常信号必须保留来源、时间、可信度和反证入口。',
      archive: '所有异动线索先入证据库，再派刑部或兵部。'
    },
    memorials: [
      { bureau: '经历史', title: '文书档案 · 核查台账勾稽', status: '已归档', body: '本日核查台账勾稽已毕，凭据齐全，归档编号连续。' },
      { bureau: '镇抚司', title: '违规纠偏 · 本日二事', status: '待裁', body: '查得户部对账一处、工部日志一处未合规，证据已取。' },
      { bureau: '巡检司', title: '六部工作流核查', status: '已录', body: '合规六、纠偏二，流程闭环无断点。' },
    ],
  },
  {
    slug: 'tianyiyuan',
    name: '天医院',
    seal: '医',
    role: '系统体征 · 慢病调理',
    accent: '#3E8E9C',
    summary: '只诊系统健康，不作真实医学诊断；用体征灯推动工程修复。',
    sections: ['诊断科', '调理科', '巡诊科'],
    counsel: {
      chancellor: '红灯先止血，黄灯排期，绿灯归档。',
      astrologer: '体征异常要关联日志、接口和用户影响，不要只给感觉。',
      archive: '每次调理必须留症状、处置、复查三段。'
    },
    memorials: [
      { bureau: '诊断科', title: '系统气色巡诊 · 一处虚候', status: '待调', body: 'cron 一路脉象偏虚，延迟尚可控，已开工程处方。' },
      { bureau: '调理科', title: '慢病调理 · 延迟优化复诊', status: '已复', body: 'P95 由 48s 降至 26s，慢病见效，拟继续观察。' },
      { bureau: '巡诊科', title: '全域巡诊 · 系统健康度', status: '已阅', body: '健康度 92，红候零、黄候三，均已开方。' },
    ],
  },
];

export const DEPT_BY_SLUG = Object.fromEntries(DEPT_LANDINGS.map((dept) => [dept.slug, dept])) as Record<DeptSlug, DeptLanding>;
export const COURT_BY_SLUG = Object.fromEntries(COURT_CONSOLES.map((court) => [court.slug, court])) as Record<CourtSlug, CourtConsole>;

export function isDeptSlug(value: string): value is DeptSlug {
  return value in DEPT_BY_SLUG;
}

export function isCourtSlug(value: string): value is CourtSlug {
  return value in COURT_BY_SLUG;
}
