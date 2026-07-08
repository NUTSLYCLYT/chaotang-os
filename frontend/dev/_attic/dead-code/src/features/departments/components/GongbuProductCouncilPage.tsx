'use client';

import { startTransition, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Binary,
  Bot,
  ClipboardCheck,
  Compass,
  Landmark,
  Layers3,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
  Waypoints,
} from 'lucide-react';

import { assetUrl } from '@/lib/asset';
import {
  DepartmentPageCanvas,
  DepartmentStage,
} from '@/features/departments/components/DepartmentPageShell';
import {
  DepartmentDetailBlock,
  DepartmentMetricGrid,
  DepartmentQuickLinksBlock,
} from '@/features/departments/components/DepartmentInnerModules';
import {
  DepartmentScrollStage,
  type DepartmentScrollFile,
} from '@/components/chaotang/department/DepartmentScrollStage';
import { CourtStatusBadge } from '@/features/shared/components/court-workflow';

type BureauTone = 'GREEN' | 'YELLOW' | 'RED';

type BureauCard = {
  id: string;
  name: string;
  role: string;
  unresolved: number;
  signal: BureauTone;
  brief: string;
  growthContribution: string;
  secondaryTitle: string;
  secondaryNotes: string[];
  scrollId: string;
};

type ProductObject = {
  id: string;
  name: string;
  issue: string;
  constraints: string[];
  options: string[];
  recommendation: string;
  nextStep: string;
  salesValue: string;
  growthImpact: string;
  modelImpact: string;
};

const ACCENT = '#7FC9A8';
const WAR_ACCENT = '#6BA0FF';
const GROWTH_ACCENT = '#F0C66A';
const BG = '/assets/six-ministries/gongbu-bg.webp';

const BUREAUS: BureauCard[] = [
  {
    id: 'product',
    name: '产品司',
    role: '定义更易成交的产品骨架、定价边界与最终形态',
    unresolved: 3,
    signal: 'YELLOW',
    brief: '当前卡在“报价定义台究竟先给结论还是先给证据”的产品骨架，首屏必须更像成交工作台，而不是说明页。',
    growthContribution: '让兵部拿到可直接推进成交的话术骨架与主卖点顺序。',
    secondaryTitle: '二级材料 · 产品定形口径',
    secondaryNotes: ['报价边界', '最终形态', '二级页：产品定形说明'],
    scrollId: 'growth-proof',
  },
  {
    id: 'engineering',
    name: '技术司',
    role: '约束实现复杂度，确保增长主路径可落地、可维护、可扩展',
    unresolved: 2,
    signal: 'GREEN',
    brief: '左栏选司、中轴卷轴、底部传旨要形成单链路，不能让增长主路径被额外系统拆碎。',
    growthContribution: '避免销售主路径被实现复杂度拖垮，缩短从商机到定稿的时间。',
    secondaryTitle: '二级材料 · 技术约束',
    secondaryNotes: ['复杂度上限', '实现边界', '二级页：技术拆解'],
    scrollId: 'key-interactions',
  },
  {
    id: 'delivery',
    name: '交付司',
    role: '把成交承诺翻译成可履约、可复核、可交接的执行路径',
    unresolved: 2,
    signal: 'YELLOW',
    brief: '任何增长承诺都要回到“唯一下一步”，否则页面会停留在会而不决。',
    growthContribution: '让兵部敢成交，因为成交后的履约可信度被提前写清。',
    secondaryTitle: '二级材料 · 交付秩序',
    secondaryNotes: ['唯一下一步', '履约链路', '二级页：交付说明'],
    scrollId: 'edict-order',
  },
  {
    id: 'supply',
    name: '供应司',
    role: '补足外部素材、证据来源、案例资产与复用供给',
    unresolved: 1,
    signal: 'GREEN',
    brief: '页面视觉可以复用，但真实证据、报价依据、客户案例必须由供应司持续供给。',
    growthContribution: '让兵部拿到可复用的获客素材、案例证据与渠道资产。',
    secondaryTitle: '二级材料 · 证据与素材',
    secondaryNotes: ['案例证据', '渠道素材', '二级页：证据台账'],
    scrollId: 'why-now',
  },
  {
    id: 'manufacturing',
    name: '制造司',
    role: '把单次成交经验沉淀成可复制模板、标准件与规模化交付能力',
    unresolved: 1,
    signal: 'YELLOW',
    brief: '右栏业务对象不能只服务一单生意，必须变成可复制的商业模式组件。',
    growthContribution: '把一次成交升级成可复制打法，支持渠道扩张与客单价提升。',
    secondaryTitle: '二级材料 · 规模化沉淀',
    secondaryNotes: ['标准件', '复制模板', '二级页：规模化清单'],
    scrollId: 'key-pages',
  },
  {
    id: 'quality',
    name: '质量司',
    role: '拦住伪增长、伪完成、伪定稿，守住来源铭牌与回执',
    unresolved: 4,
    signal: 'RED',
    brief: '不能改写中央卷轴正文的意见，不配占首屏；不能证明增长贡献的模块，降级到二级入口。',
    growthContribution: '防止团队把装饰当增长、把感觉当转化、把假完成当商业升级。',
    secondaryTitle: '二级材料 · 质门规则',
    secondaryNotes: ['来源铭牌', '回执留痕', '二级页：质门清单'],
    scrollId: 'risks-gates',
  },
];

const OBJECTS: ProductObject[] = [
  {
    id: 'object-pricing',
    name: '对象一 · 储能报价定义台',
    issue: '用户进入后不知道先看结论还是先看证据，导致销售推进节奏断裂，兵部难以快速出手。',
    constraints: ['必须保留圣旨式中央卷轴', '不能把未核实的报价伪装成 LIVE 定稿', '底部传旨语义必须与上书房一致'],
    options: ['先给仪表板摘要', '先给产品圣裁 + 对象护照', '先给会审结论后折叠证据'],
    recommendation: '采用“产品圣裁 + 对象护照”双层结构，先给能成交的结论，再给能支撑成交的证据。',
    nextStep: '由产品司锁定首屏顺序，兵部做成交校验，户部复核报价与毛利口径。',
    salesValue: '销售打开页面后能先拿到主卖点、报价边界与成交口径。',
    growthImpact: '缩短从获客到报价的决策时间，提升线索转化率。',
    modelImpact: '把一次性报价流程沉淀成可复制的标准成交台。',
  },
  {
    id: 'object-scroll',
    name: '对象二 · 中央卷轴定形',
    issue: '旧工部页更像说明页，中轴不是工作主角，用户看完仍不知道什么才是最终定义。',
    constraints: ['卷轴位置、开合仪式感必须与上书房一致', '不能退化成普通卡片区', '必须支持左栏驱动章节'],
    options: ['保留固定叠层卷轴', '把卷轴内嵌到中央工作区', '改成普通 Tabs 文档'],
    recommendation: '保留卷轴的宫廷主位，但让外部面板和底部传旨都能驱动它，形成唯一真相源。',
    nextStep: '技术司完善外部选章控制，质量司验证来源铭牌、回执和增长贡献是否闭环。',
    salesValue: '销售与产品面对同一份定稿，减少口径漂移和重复解释。',
    growthImpact: '统一增长话术与产品定义，提升跨渠道转化一致性。',
    modelImpact: '让产品定义从一次性讨论升级成长期复用的商业底稿。',
  },
  {
    id: 'object-council',
    name: '对象三 · 兵部增长校验入口',
    issue: '如果销售校验只是会后补充，产品定义就会偏离真实成交场景，工部也无法判断自己定出来的东西是否真能卖。',
    constraints: ['不再出现“四部会签并列卡”', '兵部必须以增长与销售视角校验，而不是替工部定形', '校验结果必须回流中央卷轴'],
    options: ['平铺所有会审部门', '由兵部主导增长校验台', '直接交军机处裁断'],
    recommendation: '由工部先定产品骨架，再接兵部的销售、获客、渠道、转化校验，其他部门只补约束与证据，不再平铺并列夺权。',
    nextStep: '把兵部销售校验结论写入卷轴“增长贡献”章节，仅保留会真正改变成交效率的意见。',
    salesValue: '工部能更早知道这个产品形态是否便于销售推进、报价表达与客户决策。',
    growthImpact: '让产品定形阶段就接受前线校验，减少后期返工和增长路径偏航。',
    modelImpact: '让工部定形始终围绕可卖性和可复制性，而不是局部页面美化。',
  },
  {
    id: 'object-release',
    name: '对象四 · 定稿入军机处',
    issue: '页面容易停在“看起来完整”，但没有把定稿、补证、复核、归档变成明确动作链。',
    constraints: ['所有主动动作都要有回执、落印、来源铭牌', '不能在前端伪造真实产线承诺', '要保留送军机处复核语义'],
    options: ['页面内部直接归档', '先发起军机处复核', '先回史馆再复核'],
    recommendation: '主路径固定为：定稿 -> 兵部增长校验摘要 -> 军机处复核 -> 史馆归档。',
    nextStep: '交付司把“唯一下一步”绑到传旨上下文，质量司确认增长贡献与执行回执同时落印。',
    salesValue: '销售知道何时可以对外承诺，何时仍需补证，避免误发报价。',
    growthImpact: '减少因流程不清造成的商机流失和转化卡顿。',
    modelImpact: '让每次定稿都能回到史馆复盘，形成商业模式升级素材。',
  },
];

const WORKBENCH_STEPS = [
  { code: '01', label: '工部定骨架', note: '卷轴先收口，先定什么能卖。' },
  { code: '02', label: '兵部做校验', note: '销售、获客、渠道、转化逐项过。' },
  { code: '03', label: '质量司落印', note: '来源铭牌、回执、禁令一起生效。' },
  { code: '04', label: '军机处复核', note: '送审后归档，不留口径漂移。' },
];

const TEACHING_NOTES = [
  '左栏只放短摘要，长规则收进二级展开，不占首屏。',
  '中轴是唯一真相源，只有能改正文的意见才算有效。',
  '右栏只承接业务对象、问题、方案、动作，不做附件堆叠。',
];

const SIGNAL_STYLE: Record<BureauTone, { color: string; border: string; bg: string; label: string }> = {
  GREEN: { color: '#B9F6D2', border: 'rgba(61,214,140,0.32)', bg: 'rgba(61,214,140,0.10)', label: '可推进' },
  YELLOW: { color: '#F0C66A', border: 'rgba(240,198,106,0.34)', bg: 'rgba(240,198,106,0.08)', label: '待补证' },
  RED: { color: '#FCA5B8', border: 'rgba(244,63,94,0.34)', bg: 'rgba(244,63,94,0.08)', label: '质门拦截' },
};

function accentPanel() {
  return {
    borderColor: `${ACCENT}24`,
    background:
      'linear-gradient(180deg, rgba(127,201,168,0.15) 0%, rgba(4,10,18,0.94) 100%)',
  };
}

function ToneField({
  title,
  body,
  tone,
  icon: Icon,
}: {
  title: string;
  body: string;
  tone: string;
  icon: typeof Binary;
}) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: `${tone}24`, background: `${tone}08` }}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: tone }}>
        <Icon size={12} />
        {title}
      </div>
      <div className="mt-1.5 text-[11px] leading-5 text-[#C8CDD8]">{body}</div>
    </div>
  );
}

function buildScrollFiles(): DepartmentScrollFile[] {
  return [
    {
      id: 'imperial-verdict',
      label: '产品圣裁',
      title: '工部产品圣裁 · 先定形，再接销售校验',
      meta: '御批 · 工部写最终产品形态，再接兵部的销售、获客、转化与渠道校验',
      status: 'LIVE_PRODUCT_DRAFT',
      body: (
        <div className="space-y-3">
          <p>工部今日要定的不是页面装饰，而是 <strong>为了成交与交付服务的产品最终形态</strong>。中央卷轴即产品定稿正文，任何左栏职责、右栏业务对象、兵部校验意见，只有在能改写正文某一段时才算有效。</p>
          <p>这页的主角仍然是工部。兵部在此页承担的是前线销售校验职责，用来判断这套产品形态是否更容易成交、是否更利于获客转化，而不是取代工部定形。</p>
        </div>
      ),
    },
    {
      id: 'why-now',
      label: '为何做',
      title: '为何此刻必须重做工部首页',
      meta: '问题源头 · 旧表达在谈产品，却没有把增长放到主位',
      status: 'MIXED',
      body: (
        <div className="space-y-3">
          <p>旧工部页同时像说明页、质门页和旧研发看板，用户难以判断哪一处才代表最终产品形态，更看不出它如何服务销售增长。</p>
          <p>因此本页必须承接更硬的职责：<strong>把产品定形与销售校验焊在一起</strong>。工部负责定形，兵部负责校验可卖性，其他部门只作为支援系统提供约束、预算、情报和信任包装。</p>
        </div>
      ),
    },
    {
      id: 'for-whom',
      label: '为谁做',
      title: '为谁做 · 只服务需要拍板成交的人',
      meta: '用户对象 · 工部主官、产品负责人、兵部校验官与最终裁决者',
      status: 'MIXED',
      body: (
        <div className="space-y-3">
          <p>首要用户不是普通访客，而是 <strong>需要定义产品、判断是否真能卖、决定是否进入成交动作</strong> 的负责人。</p>
          <p>他们进入首屏必须一眼回答四件事：当前在定什么产品、卡在哪、兵部会如何校验销售与渠道、下一步是补证、定稿还是送军机处复核。</p>
        </div>
      ),
    },
    {
      id: 'no-go',
      label: '不做什么',
      title: '不做什么 · 不再做平均主义部门叙事',
      meta: '禁令 · 不做说明站、不做平权并列墙、不做增长失焦的后台卡片',
      status: 'RED_GATE',
      body: (
        <div className="space-y-3">
          <p>禁止把页面做成漫长 PRD、普通 dashboard、平铺四部会签墙，或任何“每个部门都很重要”的平均主义结构。</p>
          <p><strong>工部必须明确自己是产品定形台；兵部在此页只承担销售校验接口；其他部门如果说不清增长贡献，就降级到二级层。</strong></p>
        </div>
      ),
    },
    {
      id: 'final-form',
      label: '最终形态',
      title: '最终形态 · 工部产品定义与交付定形台',
      meta: '形态定义 · 左侧六司与兵部增长校验，中轴丹书铁券，右侧业务对象与增长贡献工作台',
      status: 'GREEN_SHAPE',
      body: (
        <div className="space-y-3">
          <p>页面采用标准三轴：<strong>左侧六司与增长支援面板，中轴产品丹书铁券，右侧业务对象 / 问题 / 方案 / 增长贡献工作台</strong>。</p>
          <p>中轴永远是主角；左栏只负责说明“谁在服务增长目标”，右栏负责把业务对象的成交价值、增长影响、商业模式意义讲透。</p>
        </div>
      ),
    },
    {
      id: 'growth-proof',
      label: '增长贡献',
      title: '增长贡献 · 这是首页硬门槛，不是说明文字',
      meta: '北极星 · 任何模块若不能证明提升销售增长，就不配占主位',
      status: 'GROWTH_GATE',
      body: (
        <div className="space-y-3">
          <p>本页新增的统一判断维度是 <strong>增长贡献</strong>。每个模块都必须回答：它如何帮助获客、转化、成交效率、客单价、复购、渠道扩张或商业模式升级。</p>
          <p>若一个面板无法清楚证明自己推动销售增长，它就自动降级到二级入口，不得占据首页主叙事位。这条门槛由工部主案维护，兵部提供前线校验，质量司负责落印。</p>
        </div>
      ),
    },
    {
      id: 'key-pages',
      label: '关键对象',
      title: '关键对象 · 不是抽象概念，而是增长工作台',
      meta: '对象护照 · 报价定义台、卷轴定形、兵部增长校验、定稿复核',
      status: 'MIXED',
      body: (
        <div className="space-y-3">
          <p>本页不直接堆全部详情，而是围绕几个高价值对象展开：报价定义台、中央卷轴定形、兵部增长校验入口、定稿入军机处。</p>
          <p>每个对象都必须带有 <strong>问题、约束、候选方案、推荐动作、对销售的价值、对增长的影响、对商业模式升级的意义、唯一下一步</strong>。</p>
        </div>
      ),
    },
    {
      id: 'key-interactions',
      label: '关键交互',
      title: '关键交互 · 左栏、销售校验、传旨都必须改写正文',
      meta: '交互纪律 · 选司、销售校验、下旨都必须回流中央卷轴',
      status: 'GREEN',
      body: (
        <div className="space-y-3">
          <p>点击左栏任何一司，中央卷轴必须切到对应章节；点击“兵部增长校验入口”，中央卷轴必须切到校验章节，而不是弹出第二套系统。</p>
          <p>底部传旨的主动作用统一承接为：<strong>下旨、补证、发起兵部销售校验、送军机处复核、定稿归档</strong>，并且都要有来源铭牌、落印与回执。</p>
        </div>
      ),
    },
    {
      id: 'council-opinions',
      label: '兵部校验',
      title: '兵部增长校验 · 只保留能改变成交效率的意见',
      meta: '校验链路 · 工部定骨架，兵部校验销售与增长可行性，其他部门提供约束而非夺权',
      status: 'OPS_LED',
      body: (
        <div className="space-y-3">
          <p>本轮校验由 <strong>兵部从销售、获客、渠道、转化四个前线维度提出校验</strong>。礼部负责信任包装，户部负责 ROI 与毛利，锦衣卫负责客户画像与市场情报，其他部门只提供约束与证据。</p>
          <p>兵部校验摘要只留下五类信息：更容易卖什么、哪个渠道先打、哪些承诺不能说、哪类证据还缺、唯一下一步是什么。其余不能改写正文的意见，不允许进入首屏。</p>
        </div>
      ),
    },
    {
      id: 'risks-gates',
      label: '风险与禁令',
      title: '风险与禁令 · 页面精美不代表增长成立',
      meta: '质门铁律 · 不准把装饰冒充增长，不准把讨论冒充成交能力',
      status: 'RED',
      body: (
        <div className="space-y-3">
          <p>高风险红线包括：把普通说明页包装成增长工作台、把右栏当附件仓、把兵部写成普通会审方、把前端结果冒充真实交付承诺。</p>
          <p>任何设计如果不能让销售更快判断、让增长更可复制、让商业模式更清楚，就算再漂亮也必须退回。<strong>礼制感服务决策，不服务装饰。</strong></p>
        </div>
      ),
    },
    {
      id: 'edict-order',
      label: '后令',
      title: '后令 · 定稿之后怎么走',
      meta: '执行路径 · 定稿 -> 兵部增长校验摘要 -> 军机复核 -> 史馆归档',
      status: 'NEXT_ACTION',
      body: (
        <div className="space-y-3">
          <p>产品丹书铁券定稿后，不直接算完工。标准路径是：<strong>定稿正文成立 {'->'} 兵部增长校验摘要形成 {'->'} 军机处复核 {'->'} 史馆归档</strong>。</p>
          <p>交付司负责把唯一下一步写回动作链路，质量司负责确认所有主动动作都留下回执、来源与增长贡献落印，避免“只是看起来完成”。</p>
        </div>
      ),
    },
  ];
}

export function GongbuProductCouncilPage() {
  const files = buildScrollFiles();
  const [activeFileId, setActiveFileId] = useState<string>('imperial-verdict');
  const [openRequest, setOpenRequest] = useState(0);

  const quickLinks = [
    { href: '/departments', label: '回六部大殿', color: ACCENT, icon: Landmark },
    { href: '/command-center', label: '送军机处复核', color: GROWTH_ACCENT, icon: Swords },
    { href: '/archive', label: '去史馆归档', color: WAR_ACCENT, icon: ClipboardCheck },
  ];

  const focusScroll = (fileId: string) => {
    startTransition(() => {
      setActiveFileId(fileId);
      setOpenRequest((count) => count + 1);
    });
  };

  const focusObjectChapter = (index: number) => {
    const fileId = index === 0 ? 'growth-proof' : index === 1 ? 'key-interactions' : index === 2 ? 'council-opinions' : 'edict-order';
    focusScroll(fileId);
  };

  return (
    <DepartmentPageCanvas
      ariaLabel="工部产品定义与交付定形台"
      bgSrc={assetUrl(BG)}
      bgAlt="工部"
      imageClassName="object-cover opacity-100"
      overlayClassName="bg-transparent"
    >
      <DepartmentStage hasLiveStrip={false} className="overflow-y-auto xl:overflow-hidden">
        <div className="mx-auto grid min-h-full max-w-[1680px] grid-cols-1 gap-4 xl:h-full xl:grid-cols-[330px_minmax(0,1fr)_330px]">
      <section
            aria-label="工部六司与兵部增长校验面板"
            className="order-2 overflow-y-auto rounded-[24px] border px-5 pt-5 pb-[228px] shadow-[0_18px_56px_rgba(0,0,0,0.34)] xl:order-1"
            style={accentPanel()}
          >
            <Link
              href="/departments"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-[#C8CDD8] transition hover:text-[#F5E9C9]"
              style={{ borderColor: `${ACCENT}30` }}
            >
              <ArrowLeft size={14} />
              返回六部大殿
            </Link>

            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                Works Office · Product Definition Hall
              </div>
              <h1 className="display-serif mt-2 text-[32px] font-semibold text-[#F5E9C9]">
                工部 · 产品定义与交付定形台
              </h1>
              <p className="mt-3 text-[13px] leading-7 text-[#C8CDD8]">
                工部负责把产品骨架、技术边界、交付约束和质量门禁写成丹书铁券；兵部在此页只承担前线销售校验职责，帮助工部判断这套定形是否真能卖、真能转化。
              </p>
            </div>

              <div className="mt-5">
                <DepartmentMetricGrid
                  columns={2}
                  items={[
                  { label: '前线校验', value: '兵部会审', sub: '销售与渠道校验', color: GROWTH_ACCENT },
                  { label: '工部六司', value: String(BUREAUS.length), unit: '司', color: ACCENT },
                  { label: '在审对象', value: String(OBJECTS.length), unit: '项', color: ACCENT },
                  { label: '硬门槛', value: '增长贡献', sub: '不达标降级', color: WAR_ACCENT },
                ]}
              />
            </div>

            <div className="mt-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.20em] text-[#8F835F]">工部六司</div>
                <CourtStatusBadge mode="MIXED" label="工部主案" />
              </div>
              {BUREAUS.map((bureau) => {
                const signal = SIGNAL_STYLE[bureau.signal];
                return (
                  <div
                    key={bureau.id}
                    className="rounded-[16px] border px-4 py-3"
                    style={{ borderColor: `${ACCENT}20`, background: 'rgba(5,7,13,0.56)' }}
                  >
                    <button
                      type="button"
                      onClick={() => focusScroll(bureau.scrollId)}
                      className="w-full text-left transition hover:-translate-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-[#F5E9C9]">{bureau.name}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
                            {bureau.role}
                          </div>
                        </div>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                          style={{ color: signal.color, borderColor: signal.border, background: signal.bg }}
                        >
                          {signal.label}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] leading-5 text-[#C8CDD8]">{bureau.brief}</div>
                      <div className="mt-2 rounded-xl border px-3 py-2 text-[11px] leading-5 text-[#DCD3B4]" style={{ borderColor: `${GROWTH_ACCENT}20`, background: 'rgba(240,198,106,0.08)' }}>
                        增长贡献：{bureau.growthContribution}
                      </div>
                      <div className="mt-2 text-[10px] text-[#8F98B8]">
                        未决问题 {bureau.unresolved} · 点击直达卷轴章节
                      </div>
                    </button>
                    <details className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: `${ACCENT}16`, background: 'rgba(7,11,18,0.4)' }}>
                      <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                        {bureau.secondaryTitle}
                      </summary>
                      <div className="mt-2 space-y-1.5 text-[11px] leading-5 text-[#C8CDD8]">
                        {bureau.secondaryNotes.map((note) => (
                          <div key={note} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: `${ACCENT}16`, background: `${ACCENT}06` }}>
                            {note}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <DepartmentDetailBlock title="产品部指挥兵部会审" icon={Swords} accent={WAR_ACCENT}>
                <div className="space-y-3 text-[12px] leading-6 text-[#D5D9E6]">
                  <div className="rounded-xl border px-3 py-2" style={{ borderColor: `${WAR_ACCENT}24` }}>
                    由产品部发起，兵部组织销售、获客、渠道与转化校验；礼部、户部、锦衣卫等相关部门只补约束，不在首屏并列夺权。
                  </div>
                  <details className="rounded-xl border px-3 py-2" style={{ borderColor: `${WAR_ACCENT}20`, background: 'rgba(6,10,18,0.52)' }}>
                    <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.16em]" style={{ color: WAR_ACCENT }}>
                      长说明收口到二级展开
                    </summary>
                    <div className="mt-2 space-y-1.5 text-[11px] leading-5 text-[#C8CDD8]">
                      <div>会审结果只有在能改写中央卷轴正文时才有效。</div>
                      <div>兵部负责拉起相关部门，工部负责把结果并回最终形态。</div>
                    </div>
                  </details>
                  <button
                    type="button"
                    onClick={() => focusScroll('council-opinions')}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                    style={{ borderColor: `${WAR_ACCENT}38`, color: WAR_ACCENT, background: `${WAR_ACCENT}12` }}
                  >
                    <Compass size={12} />
                    查看兵部会审入卷
                  </button>
                </div>
              </DepartmentDetailBlock>
            </div>
          </section>

          <section
            aria-label="工部产品丹书铁券"
            className="order-1 relative min-h-0 overflow-hidden rounded-[24px] border px-4 pt-4 pb-[228px] shadow-[0_18px_56px_rgba(0,0,0,0.34)] xl:order-2"
            style={accentPanel()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.20em] text-[#8F835F]">中央卷轴</div>
                <div className="mt-1 text-[22px] font-semibold text-[#F5E9C9]">产品丹书铁券 · 最终定形正文</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CourtStatusBadge mode="LIVE" label="工部定形" />
                <CourtStatusBadge mode="MIXED" label="兵部销售校验" />
              </div>
            </div>

            <DepartmentScrollStage
              eyebrow="工部主案 · 产品定形与销售校验"
              title="工部产品丹书铁券"
              files={files}
              tone="jade"
              activeFileId={activeFileId}
              openRequest={openRequest}
              defaultFileId="imperial-verdict"
              defaultCollapsed
              sourceLabel="LIVE"
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => focusScroll('council-opinions')}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:brightness-105"
                    style={{ borderColor: `${WAR_ACCENT}55`, color: '#5b3410', background: `${WAR_ACCENT}1A` }}
                  >
                    <Swords size={12} />
                    发起兵部销售校验
                  </button>
                  <button
                    type="button"
                    onClick={() => focusScroll('growth-proof')}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:brightness-105"
                    style={{ borderColor: 'rgba(240,198,106,0.42)', color: '#5b3410', background: 'rgba(240,198,106,0.12)' }}
                  >
                    <Compass size={12} />
                    查看增长硬门槛
                  </button>
                  <Link
                    href="/command-center?from=gongbu-product-council"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:brightness-105"
                    style={{ borderColor: 'rgba(127,201,168,0.42)', color: '#21543c', background: 'rgba(127,201,168,0.12)' }}
                  >
                    <ClipboardCheck size={12} />
                    送军机处复核
                  </Link>
                </>
              }
            />
          </section>

          <section
            aria-label="业务列表与方案工作台"
            className="order-3 overflow-y-auto rounded-[24px] border px-5 pt-5 pb-[228px] shadow-[0_18px_56px_rgba(0,0,0,0.34)]"
            style={accentPanel()}
          >
            <DepartmentQuickLinksBlock
              title="主动动作"
              icon={Waypoints}
              accent={ACCENT}
              items={quickLinks}
            />

            <DepartmentDetailBlock title="项目进展" icon={Waypoints} accent={ACCENT}>
              <div className="space-y-2">
                {WORKBENCH_STEPS.map((step, index) => (
                  <div
                    key={step.code}
                    className="rounded-xl border px-3 py-2"
                    style={{ borderColor: `${ACCENT}16`, background: index === 0 ? 'rgba(127,201,168,0.08)' : 'rgba(5,7,13,0.48)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                        {step.code}
                      </div>
                      <span className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: `${ACCENT}24`, color: ACCENT }}>
                        {index === 0 ? '当前' : '后续'}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] font-semibold text-[#F5E9C9]">{step.label}</div>
                    <div className="mt-1 text-[11px] leading-5 text-[#C8CDD8]">{step.note}</div>
                  </div>
                ))}
              </div>
            </DepartmentDetailBlock>

            <div className="mt-4">
              <DepartmentDetailBlock title="工部教学资料" icon={Layers3} accent={GROWTH_ACCENT}>
                <div className="space-y-2 text-[11px] leading-5 text-[#D5D9E6]">
                  {TEACHING_NOTES.map((note) => (
                    <div key={note} className="rounded-xl border px-3 py-2" style={{ borderColor: `${GROWTH_ACCENT}16`, background: 'rgba(240,198,106,0.06)' }}>
                      {note}
                    </div>
                  ))}
                  <div className="rounded-xl border px-3 py-2 text-[#F4D88A]" style={{ borderColor: `${GROWTH_ACCENT}20`, background: 'rgba(240,198,106,0.08)' }}>
                    增长贡献是硬门槛，不能改写中央卷轴的意见自动降级。
                  </div>
                </div>
              </DepartmentDetailBlock>
            </div>

            <div className="mt-4 space-y-3">
              {OBJECTS.map((item, index) => (
                <div
                  key={item.id}
                  aria-label={`业务对象 ${item.name}`}
                  className="rounded-[18px] border px-4 py-3"
                  style={{ borderColor: `${ACCENT}20`, background: 'rgba(5,7,13,0.58)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#F5E9C9]">{item.name}</div>
                      <div className="mt-1 text-[11px] leading-5 text-[#C8CDD8]">{item.issue}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => focusObjectChapter(index)}
                      className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                      style={{ borderColor: `${ACCENT}30`, color: ACCENT, background: `${ACCENT}10` }}
                    >
                      看对应卷轴
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <ToneField icon={Binary} title="硬约束" body={item.constraints.join('；')} tone={WAR_ACCENT} />
                    <ToneField icon={PackageSearch} title="候选方案" body={item.options.join(' / ')} tone={GROWTH_ACCENT} />
                    <ToneField icon={Sparkles} title="推荐方案" body={item.recommendation} tone={ACCENT} />
                    <ToneField icon={ShieldCheck} title="推荐动作" body={item.nextStep} tone="#B9F6D2" />
                  </div>

                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: `${GROWTH_ACCENT}20`, background: 'rgba(240,198,106,0.06)' }}>
                      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: GROWTH_ACCENT }}>对销售的价值</div>
                      <div className="mt-1 text-[11px] leading-5 text-[#DCD3B4]">{item.salesValue}</div>
                    </div>
                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: `${WAR_ACCENT}20`, background: 'rgba(107,160,255,0.06)' }}>
                      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: WAR_ACCENT }}>对增长的影响</div>
                      <div className="mt-1 text-[11px] leading-5 text-[#D5D9E6]">{item.growthImpact}</div>
                    </div>
                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: `rgba(218,183,255,0.24)`, background: 'rgba(218,183,255,0.06)' }}>
                      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#DAB7FF' }}>商业模式升级</div>
                      <div className="mt-1 text-[11px] leading-5 text-[#E1D3F6]">{item.modelImpact}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[18px] border px-4 py-4" style={{ borderColor: `${WAR_ACCENT}24`, background: 'rgba(6,10,18,0.72)' }}>
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: WAR_ACCENT }}>
                <Bot size={14} />
                产品会审纪律
              </div>
              <div className="mt-2 space-y-2 text-[11px] leading-5 text-[#C8CDD8]">
                <div>1. 工部写主案，兵部从销售与渠道视角校验，其他部门只给约束，不抢中央定稿位。</div>
                <div>2. 任何校验意见，如果不能提升成交效率或改写卷轴正文某一段，就不允许进入首屏。</div>
                <div>3. 右栏所有对象都必须写出增长贡献与唯一下一步，不能停留在泛化建议。</div>
              </div>
            </div>
          </section>
        </div>
      </DepartmentStage>

    </DepartmentPageCanvas>
  );
}
