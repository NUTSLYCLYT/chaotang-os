type ThreeAxisOfficeRailsProps = {
  deptCode?: string;
  deptLabel: string;
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: OfficeRailItem[];
  rightItems?: OfficeRailItem[];
  accent?: string;
};

type OfficeRailItem = {
  title: string;
  body: string;
  value?: string;
};

type RailPreset = {
  accent: string;
  leftTitle: string;
  rightTitle: string;
  leftItems: OfficeRailItem[];
  rightItems: OfficeRailItem[];
};

const DEFAULT_LEFT: OfficeRailItem[] = [
  { title: '任务池', body: '今日待办按负责人、截止时间和阻塞原因排队。', value: '待裁' },
  { title: '缺证风险', body: '没有证据、边界和验收口的事项不入主卷。', value: '核验' },
  { title: '下一步动作', body: '用户只看到能立即下旨、补证或归档的动作。', value: '可执行' },
];
const DEFAULT_RIGHT: OfficeRailItem[] = [
  { title: '主管判断', body: '负责人必须先给结论，再列依据和风险。', value: '上呈' },
  { title: '成果验收', body: '每件事都要落到产出物、责任人和通过标准。', value: '门禁' },
  { title: '可归档证据', body: '能复盘、能追责、能下次引用的材料才入史。', value: '入史' },
];

const RAIL_PRESETS: Record<string, RailPreset> = {
  finance: {
    accent: '#F0C66A',
    leftTitle: '账册与风险',
    rightTitle: '预算与验收',
    leftItems: [
      { title: '现金流任务', body: '看本周付款、回款和预算占用，先排高压事项。', value: '账期' },
      { title: '报价底线', body: '报价必须带毛利、交付成本和不可退让条件。', value: '底线' },
      { title: '缺证金额', body: '客户规模、合同条款、供应报价缺一项不准拍板。', value: '补证' },
    ],
    rightItems: [
      { title: '户部裁断', body: '值不值得花钱，先看账本再下旨。', value: '准/缓' },
      { title: '资金验收', body: '每笔动作要有预算来源、责任人和回写口。', value: '回写' },
      { title: '入史凭据', body: '报价单、付款凭据、审批轨迹统一归档。', value: '归档' },
    ],
  },
  legal: {
    accent: '#F43F5E',
    leftTitle: '红线与证据',
    rightTitle: '责任与裁断',
    leftItems: [
      { title: '合同红线', body: '付款、股权、违约金和独家承诺先过风险口。', value: '高危' },
      { title: '责任边界', body: '谁承诺、谁签署、谁承担后果必须写清。', value: '定责' },
      { title: '缺证清单', body: '主体资质、历史合同、对方授权不全则退回补证。', value: '补证' },
    ],
    rightItems: [
      { title: '刑部判词', body: '不清楚责任边界，不准静默执行。', value: '准/驳' },
      { title: '法务验收', body: '条款、附件、审批和留痕全部齐备才可归档。', value: '门禁' },
      { title: '风险回奏', body: '高风险事项必须形成可追责的主管结论。', value: '回奏' },
    ],
  },
  libu: {
    accent: '#6FD0D8',
    leftTitle: '传播与审美',
    rightTitle: '发布与验收',
    leftItems: [
      { title: '品牌主张', body: '客户、员工、伙伴能否复述同一句定位。', value: '校准' },
      { title: '视觉门禁', body: '排版、图像、语气和承诺必须同一标准。', value: '会审' },
      { title: '公关风险', body: '未核验事实、过度承诺和敏感表述先拦截。', value: '拦截' },
    ],
    rightItems: [
      { title: '礼部判词', body: '可发布、需改写、禁外发先说清。', value: '裁断' },
      { title: '成稿验收', body: '外发内容必须有目标、证据、渠道和负责人。', value: '验收' },
      { title: '传播归档', body: '素材、口径、版本和复盘指标统一入史。', value: '入史' },
    ],
  },
  market: {
    accent: '#6FD0D8',
    leftTitle: '传播与审美',
    rightTitle: '发布与验收',
    leftItems: [
      { title: '品牌主张', body: '客户、员工、伙伴能否复述同一句定位。', value: '校准' },
      { title: '视觉门禁', body: '排版、图像、语气和承诺必须同一标准。', value: '会审' },
      { title: '公关风险', body: '未核验事实、过度承诺和敏感表述先拦截。', value: '拦截' },
    ],
    rightItems: [
      { title: '礼部判词', body: '可发布、需改写、禁外发先说清。', value: '裁断' },
      { title: '成稿验收', body: '外发内容必须有目标、证据、渠道和负责人。', value: '验收' },
      { title: '传播归档', body: '素材、口径、版本和复盘指标统一入史。', value: '入史' },
    ],
  },
  gongbu: {
    accent: '#3DD68C',
    leftTitle: '营造与门禁',
    rightTitle: '发布与验收',
    leftItems: [
      { title: '构建任务', body: '产品、工程、设计和发布事项按可落地性排队。', value: '营造' },
      { title: '质量阻塞', body: '类型、构建、截图、交互任一失败都不准交付。', value: '阻塞' },
      { title: '验收证据', body: '每个改动必须带命令、截图或 harness 证据。', value: '证据' },
    ],
    rightItems: [
      { title: '工部裁断', body: '不能落地的方案，不算完成。', value: '准造' },
      { title: '发布门禁', body: 'build、harness、视觉截图和回归项全过再发。', value: '门禁' },
      { title: '工程入史', body: '提交、版本、验证报告和缺口一并归档。', value: '归档' },
    ],
  },
  works: {
    accent: '#3DD68C',
    leftTitle: '营造与门禁',
    rightTitle: '发布与验收',
    leftItems: [
      { title: '构建任务', body: '产品、工程、设计和发布事项按可落地性排队。', value: '营造' },
      { title: '质量阻塞', body: '类型、构建、截图、交互任一失败都不准交付。', value: '阻塞' },
      { title: '验收证据', body: '每个改动必须带命令、截图或 harness 证据。', value: '证据' },
    ],
    rightItems: [
      { title: '工部裁断', body: '不能落地的方案，不算完成。', value: '准造' },
      { title: '发布门禁', body: 'build、harness、视觉截图和回归项全过再发。', value: '门禁' },
      { title: '工程入史', body: '提交、版本、验证报告和缺口一并归档。', value: '归档' },
    ],
  },
  ops: {
    accent: '#6BA0FF',
    leftTitle: '战役与阻塞',
    rightTitle: '军令与回奏',
    leftItems: [
      { title: '战役目标', body: '交付目标、资源调度和节奏偏差先排清楚。', value: '作战' },
      { title: '执行阻塞', body: '卡点必须指向负责人、依赖和预计回奏时间。', value: '阻塞' },
      { title: '资源调度', body: '人、时间、预算和外部协同统一看板。', value: '调度' },
    ],
    rightItems: [
      { title: '兵部军令', body: '卡在哪里，谁负责，何时回奏。', value: '军令' },
      { title: '交付验收', body: '阶段产出、质量证据和延期风险一屏可见。', value: '验收' },
      { title: '战报归档', body: '执行记录、复盘结论和下一次调度依据入史。', value: '战报' },
    ],
  },
  personnel: {
    accent: '#B9F6D2',
    leftTitle: '组织与权限',
    rightTitle: '任命与交接',
    leftItems: [
      { title: '岗位任务', body: '谁该做、谁能批、谁负责验收先写清。', value: '定岗' },
      { title: '权限缺口', body: '审批链、账号、数据范围不清则不能推进。', value: '权限' },
      { title: '绩效信号', body: '以产出物、周期和复用率评估组织效率。', value: '绩效' },
    ],
    rightItems: [
      { title: '吏部任命', body: '先定岗位、权限、负责人和交接链路。', value: '任命' },
      { title: '交接验收', body: '交接材料、权限移交和责任边界全部留痕。', value: '交接' },
      { title: '组织入史', body: '任命、撤换、权限变化和复盘统一归档。', value: '入史' },
    ],
  },
  guard: {
    accent: '#FB923C',
    leftTitle: '情报与反证',
    rightTitle: '核验与入旨',
    leftItems: [
      { title: '情报源流', body: '外部信号必须标来源、时间和可信度。', value: '采证' },
      { title: '反证任务', body: '竞品、负面案例和相反证据同步核验。', value: '反证' },
      { title: '风险预警', body: '高危信号先上报，不混入普通摘要。', value: '预警' },
    ],
    rightItems: [
      { title: '锦衣卫断语', body: '未核验，不入圣旨。', value: '断语' },
      { title: '证据验收', body: '来源、截图、链接、时间和责任人齐备。', value: '验收' },
      { title: '情报入史', body: '可复用的外部信号和判断依据归档。', value: '入史' },
    ],
  },
  physician: {
    accent: '#7EC8E3',
    leftTitle: '脉象与异常',
    rightTitle: '处方与复查',
    leftItems: [
      { title: '系统脉案', body: '健康度、错误率、延迟和质量退化集中诊断。', value: '脉案' },
      { title: '异常链路', body: '把症状定位到页面、接口、数据或运行链路。', value: '异常' },
      { title: '复发风险', body: '没有监控、回归和复查计划的修复不算完成。', value: '复查' },
    ],
    rightItems: [
      { title: '太医处方', body: '先验脉象，再开方。', value: '处方' },
      { title: '调养验收', body: '修复必须带复测、观测和退化预警。', value: '验收' },
      { title: '健康归档', body: '脉案、处方、结果和复查时间入史。', value: '入史' },
    ],
  },
  manors: {
    accent: '#7FC9A8',
    leftTitle: '资产与项目',
    rightTitle: '资金与回写',
    leftItems: [
      { title: '资产账', body: '核心资产、客户、供应和知识库先归册。', value: '在盘' },
      { title: '项目账', body: '每个机会必须有负责人、下一步和截止时间。', value: '推进' },
      { title: '负责人', body: '六部蜂群承接前先定主责和验收口。', value: '定责' },
    ],
    rightItems: [
      { title: '资金账', body: '政策资金、预算占用和回款风险统一看。', value: '核账' },
      { title: '风险验收', body: '合同、交付、资金三类风险必须可追踪。', value: '验收' },
      { title: '蜂群回写', body: '执行结果回写庄园，形成经营资产闭环。', value: '回写' },
    ],
  },
  'command-center': {
    accent: '#8AA4FF',
    leftTitle: '会审与阻塞',
    rightTitle: '奏折与裁断',
    leftItems: [
      { title: '当前案', body: '先把用户命令压成一件可会审真案。', value: '立案' },
      { title: '执行阻塞', body: '每个阻塞必须指向依赖、负责人和补证路径。', value: '阻塞' },
      { title: '补证路线', body: '缺材料就派部门补证，不让用户猜下一步。', value: '补证' },
    ],
    rightItems: [
      { title: '主管判断', body: '军机大臣收束分歧，给出准奏、再议或驳回。', value: '裁断' },
      { title: '奏折成稿', body: '结论、证据、风险、后令和质门必须齐全。', value: '成稿' },
      { title: '归档验收', body: 'trace、产物、裁决和执行结果写回史馆。', value: '归档' },
    ],
  },
};

export function ThreeAxisOfficeRails({
  deptCode,
  deptLabel,
  leftTitle,
  rightTitle,
  leftItems,
  rightItems,
  accent,
}: ThreeAxisOfficeRailsProps) {
  // physician 太医院已是真 client（左起居注/右天下医馆都是真面板），不叠装饰 OFFICE RAIL 遮挡边缘真内容。
  if (deptCode === 'physician') return null;

  const preset = deptCode ? RAIL_PRESETS[deptCode] : undefined;
  const resolvedAccent = accent ?? preset?.accent ?? '#F0C66A';
  const resolvedLeftTitle = leftTitle ?? preset?.leftTitle ?? '任务与风险';
  const resolvedRightTitle = rightTitle ?? preset?.rightTitle ?? '主管与验收';
  const resolvedLeftItems = leftItems ?? preset?.leftItems ?? DEFAULT_LEFT;
  const resolvedRightItems = rightItems ?? preset?.rightItems ?? DEFAULT_RIGHT;

  return (
    <>
      <aside
        data-three-axis-panel="left"
        className="pointer-events-none fixed left-4 top-[150px] z-[43] hidden w-[252px] xl:block 2xl:w-[286px]"
        aria-label={`${deptLabel}左侧信息面板`}
      >
        <OfficeRailCard
          label={deptLabel}
          title={resolvedLeftTitle}
          items={resolvedLeftItems}
          accent={resolvedAccent}
          align="left"
        />
      </aside>
      <aside
        data-three-axis-panel="right"
        className="pointer-events-none fixed right-4 top-[150px] z-[43] hidden w-[252px] xl:block 2xl:w-[286px]"
        aria-label={`${deptLabel}右侧信息面板`}
      >
        <OfficeRailCard
          label={deptLabel}
          title={resolvedRightTitle}
          items={resolvedRightItems}
          accent={resolvedAccent}
          align="right"
        />
      </aside>
    </>
  );
}

function OfficeRailCard({
  label,
  title,
  items,
  accent,
  align,
}: {
  label: string;
  title: string;
  items: OfficeRailItem[];
  accent: string;
  align: 'left' | 'right';
}) {
  return (
    <div
      data-three-axis-ornament="lacquer-rail"
      className="relative overflow-hidden rounded-[8px] border px-3 py-3 shadow-[0_22px_70px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,250,232,0.07)] backdrop-blur-xl"
      style={{
        borderColor: `${accent}38`,
        background:
          'linear-gradient(180deg, rgba(10,10,16,0.86), rgba(5,7,13,0.70) 52%, rgba(6,5,7,0.82)), radial-gradient(circle at 50% -12%, rgba(240,198,106,0.12), transparent 44%)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 18px), repeating-linear-gradient(0deg, rgba(240,198,106,0.06) 0 1px, transparent 1px 28px)',
          maskImage: 'linear-gradient(180deg, transparent, black 14%, black 86%, transparent)',
        }}
      />
      <span aria-hidden className="absolute left-2 top-3 bottom-3 w-px" style={{ background: `linear-gradient(180deg, transparent, ${accent}55, transparent)` }} />
      <span aria-hidden className="absolute right-2 top-3 bottom-3 w-px" style={{ background: `linear-gradient(180deg, transparent, ${accent}40, transparent)` }} />
      <span
        aria-hidden
        className="absolute inset-x-4 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}99, transparent)` }}
      />
      <div className="relative">
        <div className={`text-[9px] font-bold uppercase tracking-[0.20em] ${align === 'right' ? 'text-right' : ''}`} style={{ color: accent }}>
          {label} · OFFICE RAIL
        </div>
        <div className={`mt-1 flex items-end gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
          <span
            aria-hidden
            className="mb-1 h-6 w-[3px] rounded-full"
            style={{ background: `linear-gradient(180deg, ${accent}, rgba(240,198,106,0.12))` }}
          />
          <span className="font-serif text-[16px] font-black leading-tight text-[#F5E9C9]">
            {title}
          </span>
        </div>
      </div>
      <div className="relative mt-3 space-y-2">
        {items.slice(0, 3).map((item, index) => (
          <div
            key={item.title}
            data-three-axis-panel-item
            className={`group relative overflow-hidden rounded-[8px] border px-2.5 py-2 transition duration-300 hover:-translate-y-0.5 ${align === 'right' ? 'text-right' : ''}`}
            style={{
              borderColor: 'rgba(240,198,106,0.14)',
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025)), radial-gradient(circle at 0% 0%, rgba(240,198,106,0.08), transparent 42%)',
              boxShadow: 'inset 0 1px 0 rgba(255,250,232,0.05)',
            }}
          >
            <span aria-hidden className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded border font-mono text-[10px] font-bold"
                style={{ color: accent, borderColor: `${accent}30`, background: `${accent}10` }}
              >
                0{index + 1}
              </span>
              {item.value && (
                <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-[#8F835F]">
                  {item.value}
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-[#F5E9C9]">{item.title}</div>
            <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#9AA3C4]">{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
