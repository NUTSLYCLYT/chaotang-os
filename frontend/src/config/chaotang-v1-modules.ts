export type ChaotangPrimaryModuleId =
  | 'dadian'
  | 'shangshufang'
  | 'junjichu'
  | 'liubu'
  | 'zhuanshu'
  | 'shiguan';

export type V1LiubuCode = 'hubu' | 'libu' | 'libu_rites' | 'bingbu' | 'xingbu' | 'gongbu';

export type V1CanonicalDepartmentCode =
  | 'finance'
  | 'personnel'
  | 'market'
  | 'ops'
  | 'legal'
  | 'gongbu';

export type V1OfficeDef = {
  slug: string;
  canonicalSlug: string;
  name: string;
  role: string;
  scope: string;
};

export type V1LiubuDef = {
  code: V1LiubuCode;
  canonicalCode: V1CanonicalDepartmentCode | null;
  name: string;
  href: string | null;
  status: 'active' | 'pending';
  offices: readonly V1OfficeDef[];
};

export const CHAOTANG_V1_PRIMARY_MODULES: Array<{
  id: ChaotangPrimaryModuleId;
  label: string;
  href: string;
}> = [
  { id: 'dadian', label: '大殿', href: '/dadian' },
  { id: 'shangshufang', label: '上书房', href: '/shangshufang' },
  { id: 'junjichu', label: '军机处', href: '/junjichu' },
  { id: 'liubu', label: '六部', href: '/liubu' },
  { id: 'zhuanshu', label: '专署', href: '/zhuanshu' },
  { id: 'shiguan', label: '史馆', href: '/shiguan' },
];

export const CHAOTANG_V1_ZHUANSHU = [
  {
    code: 'jinyiwei',
    name: '锦衣卫',
    href: '/zhuanshu/jinyiwei',
    duty: '外部信号、开源项目、竞品与风险情报',
  },
] as const;

export const CHAOTANG_V1_LIUBU: readonly V1LiubuDef[] = [
  {
    code: 'hubu',
    canonicalCode: 'finance',
    name: '户部',
    href: '/liubu/hubu',
    status: 'active',
    offices: [
      { slug: 'yusuan', canonicalSlug: 'budget', name: '预算司', role: '预算裁决', scope: '预算、预测、费用控制与经营分析。' },
      { slug: 'chuna', canonicalSlug: 'treasury', name: '出纳司', role: '现金与付款', scope: '现金余量、回款、付款、账期与资金安全垫。' },
    ],
  },
  {
    code: 'libu',
    canonicalCode: 'personnel',
    name: '吏部',
    href: '/liubu/libu',
    status: 'active',
    offices: [
      { slug: 'renmian', canonicalSlug: 'appointment', name: '任免司', role: '任免与职级', scope: '职级、任职资格、晋升、调岗与职责匹配。' },
      { slug: 'zhaopin', canonicalSlug: 'talent', name: '招聘司', role: '招聘与选才', scope: '招聘需求、岗位缺口、候选人匹配与面试进度。' },
    ],
  },
  {
    code: 'libu_rites',
    canonicalCode: 'market',
    name: '礼部',
    href: '/liubu/libu_rites',
    status: 'active',
    offices: [],
  },
  {
    code: 'bingbu',
    canonicalCode: 'ops',
    name: '兵部',
    href: '/liubu/bingbu',
    status: 'active',
    offices: [
      { slug: 'baojia', canonicalSlug: 'sales', name: '报价司', role: '报价与商机', scope: '商机推进、客户阶段、报价动作与赢率判断。' },
      { slug: 'xiansuo', canonicalSlug: 'marketing', name: '线索司', role: '线索与投放', scope: '市场活动、线索质量、获客成本与转化路径。' },
    ],
  },
  {
    code: 'xingbu',
    canonicalCode: 'legal',
    name: '刑部',
    href: '/liubu/xingbu',
    status: 'active',
    offices: [
      { slug: 'hetong', canonicalSlug: 'contract-review', name: '合同司', role: '合同门禁', scope: '合同风险、关键条款、缺失条款、模板偏离与修改建议。' },
    ],
  },
  {
    code: 'gongbu',
    canonicalCode: 'gongbu',
    name: '工部',
    href: '/liubu/gongbu',
    status: 'active',
    offices: [
      { slug: 'chan-yan', canonicalSlug: 'solution', name: '产研司', role: '产品与研发', scope: '需求、方案、用户价值、范围边界与优先级。' },
    ],
  },
];

export const V1_DEPARTMENT_ALIASES: Record<string, V1CanonicalDepartmentCode | null> = {
  hubu: 'finance',
  finance: 'finance',
  libu: 'personnel',
  personnel: 'personnel',
  libu_rites: 'market',
  rites: 'market',
  market: 'market',
  bingbu: 'ops',
  ops: 'ops',
  xingbu: 'legal',
  legal: 'legal',
  gongbu: 'gongbu',
  works: 'gongbu',
};

export function getV1LiubuByCode(code: string): V1LiubuDef | undefined {
  return CHAOTANG_V1_LIUBU.find((department) => department.code === code);
}

export function getV1LiubuByCanonicalCode(code: V1CanonicalDepartmentCode): V1LiubuDef | undefined {
  return CHAOTANG_V1_LIUBU.find((department) => department.canonicalCode === code);
}

export function getV1OfficeCanonicalSlug(departmentCode: string, officeSlug: string): string {
  const department = getV1LiubuByCode(departmentCode);
  return department?.offices.find((office) => office.slug === officeSlug || office.canonicalSlug === officeSlug)?.canonicalSlug ?? officeSlug;
}

export function getV1LiubuStaticParams(): Array<{ code: string }> {
  return CHAOTANG_V1_LIUBU.filter((department) => department.status === 'active').map((department) => ({
    code: department.code,
  }));
}

export function getV1OfficeStaticParams(): Array<{ code: string; office: string }> {
  return CHAOTANG_V1_LIUBU.flatMap((department) =>
    department.offices.map((office) => ({
      code: department.code,
      office: office.slug,
    })),
  );
}
