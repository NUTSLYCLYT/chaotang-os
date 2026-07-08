/**
 * 太医院 · 急救 + 医疗保险 + 其他服务
 */

'use client';

import {
  Siren,
  Heart,
  Flame,
  Droplet,
  Wind,
  Zap,
  PhoneCall,
  Ambulance,
  ShieldCheck,
  FileText,
  Wallet,
  Briefcase,
  Pill,
  Truck,
  HandHelping,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

const EMERGENCY_COLOR = '#F43F5E';
const INSURANCE_COLOR = '#F0C66A';
const SERVICE_COLOR = '#6BA0FF';

interface EmergencyTip {
  id: string;
  icon: LucideIcon;
  scenario: string;
  firstAction: string;
  dosAndDonts: { do: string[]; dont: string[] };
  timing: string;
}

const TIPS: EmergencyTip[] = [
  {
    id: 'cpr',
    icon: Heart,
    scenario: '突发心脏骤停',
    firstAction: '立即拨打 120 + 开始胸外按压',
    timing: '黄金 4 分钟内 CPR 可使生存率提升 2-3 倍',
    dosAndDonts: {
      do: [
        '按压位置：两乳头连线中点',
        '深度 5-6cm，频率 100-120 次/分',
        '如有 AED 立即使用，按语音指示',
        '持续按压直到专业人员接手',
      ],
      dont: [
        '不要停下换人超过 10 秒',
        '不确定是否心跳骤停时仍应按压',
        '不要盲目拍打或摇晃患者',
      ],
    },
  },
  {
    id: 'stroke',
    icon: Zap,
    scenario: '疑似脑卒中',
    firstAction: 'FAST 筛查：Face 面瘫 · Arm 臂软 · Speech 言语 · Time 时间',
    timing: '黄金 3 小时溶栓窗 · 4.5 小时内最佳',
    dosAndDonts: {
      do: [
        '让患者平躺，头偏一侧防误吸',
        '记录起病时刻（对溶栓至关重要）',
        '立即拨打 120，直送卒中中心',
        '保持患者安静、保暖',
      ],
      dont: [
        '不要喂水喂药（可能吞咽障碍）',
        '不要按摩扎针',
        '不要强行扶起或走动',
      ],
    },
  },
  {
    id: 'choke',
    icon: Wind,
    scenario: '异物卡喉窒息',
    firstAction: '海姆立克急救法（Heimlich）立即实施',
    timing: '数秒内必须开始 · 超过 4 分钟脑损伤不可逆',
    dosAndDonts: {
      do: [
        '成人：站于患者身后，双手环抱脐上两指快速向内向上冲击',
        '婴儿：5 次拍背 + 5 次按压胸前，交替',
        '孕妇/肥胖：胸部冲击代替腹部',
        '若患者昏迷，立即 CPR',
      ],
      dont: [
        '不要用手盲抠咽部（可能推深异物）',
        '不要喝水冲下异物',
      ],
    },
  },
  {
    id: 'bleed',
    icon: Droplet,
    scenario: '外伤大出血',
    firstAction: '直接按压止血 · 抬高伤肢',
    timing: '5 分钟内止血可显著降低死亡风险',
    dosAndDonts: {
      do: [
        '用干净布料直接压住伤口',
        '持续按压至少 10 分钟不要松手',
        '如浸透不要揭开，继续加压',
        '肢体大出血可考虑近心端束带（记录时间）',
      ],
      dont: [
        '不要频繁揭开查看',
        '不要用酒精/双氧水直接冲大伤口（刺激）',
        '止血带使用不超过 60 分钟不放松',
      ],
    },
  },
  {
    id: 'burn',
    icon: Flame,
    scenario: '烫伤烧伤',
    firstAction: '立即冷水冲 15-20 分钟（水温 15-25℃）',
    timing: '黄金 30 分钟 · 持续冷疗减少深度损伤',
    dosAndDonts: {
      do: [
        '流动冷水冲患处 15-20 分钟',
        '去除首饰衣物（粘连者剪开）',
        '清洁纱布覆盖',
        '面积 >1% 或深度 II 度以上立即就医',
      ],
      dont: [
        '不要涂牙膏、酱油、冰敷',
        '不要挑破水泡',
        '不要撕脱粘连衣物',
      ],
    },
  },
  {
    id: 'seizure',
    icon: Zap,
    scenario: '癫痫发作',
    firstAction: '保护头部 · 清空周围 · 记录时长',
    timing: '超过 5 分钟需拨打 120',
    dosAndDonts: {
      do: [
        '移开周围硬物，垫软物保护头部',
        '记录发作开始时间',
        '发作结束后侧卧位防误吸',
        '陪伴直到完全清醒',
      ],
      dont: [
        '绝不可强行塞物入口（舌不会被咬掉）',
        '不要按压/束缚肢体',
        '不要给水给药',
      ],
    },
  },
];

interface InsurancePlan {
  id: string;
  name: string;
  type: string;
  coverage: string;
  eligible: string;
  premium: string;
  highlights: string[];
}

const INSURANCE: InsurancePlan[] = [
  {
    id: 'basic',
    name: '城镇职工基本医保',
    type: '基础保障',
    coverage: '住院报销 80-90% · 年度 50 万',
    eligible: '在职参保 · 已缴费 15 年',
    premium: '单位 9% + 个人 2%',
    highlights: ['门诊统筹已开通', '个人账户家庭共济', '异地结算'],
  },
  {
    id: 'serious',
    name: '城乡居民大病保险',
    type: '补充保障',
    coverage: '大病段最高再报 60%',
    eligible: '基本医保参保人',
    premium: '已含在居民医保内',
    highlights: ['封顶线 40 万', '特定罕见病纳入', '自动触发'],
  },
  {
    id: 'commercial',
    name: '商业百万医疗（高端）',
    type: '商业补充',
    coverage: '年度 400 万 · 重疾专项 100 万',
    eligible: '60 岁以下健康告知',
    premium: '¥ 480-1,800 /年',
    highlights: ['外购药可报销', '质子重离子', '绿通直约专家'],
  },
  {
    id: 'critical',
    name: '重疾险（终身型）',
    type: '收入补偿',
    coverage: '一次给付 50-200 万',
    eligible: '等待期 90 天',
    premium: '¥ 5,000-15,000 /年',
    highlights: ['轻中重症多次赔', '豁免保费', '癌症二次赔'],
  },
];

interface ServiceItem {
  id: string;
  icon: LucideIcon;
  name: string;
  body: string;
  action: string;
}

const SERVICES: ServiceItem[] = [
  {
    id: 's1',
    icon: Pill,
    name: '处方续方',
    body: '慢病用药在线续方 · 医保直付 · 药品 30 分钟送达',
    action: '开始续方',
  },
  {
    id: 's2',
    icon: Truck,
    name: '检验上门',
    body: '抽血 · 尿常规 · 便常规 · 家中采样当日送检',
    action: '预约上门',
  },
  {
    id: 's3',
    icon: HandHelping,
    name: '陪诊服务',
    body: '专业陪诊 · 老人/独居/异地就医 · 全程翻译病情',
    action: '预约陪诊',
  },
  {
    id: 's4',
    icon: FileText,
    name: '报告解读',
    body: '体检报告一键上传 · 三甲医生 2h 内解读',
    action: '上传报告',
  },
  {
    id: 's5',
    icon: Briefcase,
    name: '二次诊疗意见',
    body: '复杂病情跨院会诊 · 海外专家 Second Opinion',
    action: '发起会诊',
  },
  {
    id: 's6',
    icon: Wallet,
    name: '医疗花费记账',
    body: '自动聚合就诊/购药/保险理赔 · 年度账单一键导出',
    action: '查看账本',
  },
];

export function EmergencyInsurance() {
  return (
    <div className="space-y-6">
      {/* 急救速拨 */}
      <EmergencyCallBar />

      {/* 急救贴士 */}
      <section>
        <SectionHeader
          icon={Siren}
          color={EMERGENCY_COLOR}
          eyebrow="Emergency Tips · 急救贴士"
          title="6 个最该记住的场景 · 黄金时间窗"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TIPS.map((t) => (
            <EmergencyTipCard key={t.id} tip={t} />
          ))}
        </div>
      </section>

      {/* 医疗保险 */}
      <section>
        <SectionHeader
          icon={ShieldCheck}
          color={INSURANCE_COLOR}
          eyebrow="Medical Insurance · 医疗保险"
          title="基础 + 补充 + 商业三层保障"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {INSURANCE.map((p) => (
            <InsuranceCard key={p.id} plan={p} />
          ))}
        </div>
      </section>

      {/* 其他服务 */}
      <section>
        <SectionHeader
          icon={Briefcase}
          color={SERVICE_COLOR}
          eyebrow="Other Services · 其他医疗服务"
          title="续方 · 上门 · 陪诊 · 报告解读 · 会诊 · 账本"
        />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SERVICES.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ========================================================================== */

function EmergencyCallBar() {
  return (
    <GlassPanel
      tone="elevated"
      padding="lg"
      className="relative overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 0% 50%, rgba(244,63,94,0.18), transparent 55%), radial-gradient(circle at 100% 50%, rgba(244,63,94,0.12), transparent 50%)',
        }}
      />
      <div className="relative grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${EMERGENCY_COLOR}33, ${EMERGENCY_COLOR}0a)`,
              border: `1px solid ${EMERGENCY_COLOR}66`,
              boxShadow: `0 4px 24px ${EMERGENCY_COLOR}44`,
            }}
          >
            <Siren size={24} style={{ color: EMERGENCY_COLOR }} className="animate-pulse" />
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.25em]"
              style={{ color: EMERGENCY_COLOR }}
            >
              Emergency Hotline · 紧急呼叫
            </div>
            <div className="mt-1 text-[16px] font-semibold text-[#F5E9C9]">
              一键直拨急救 · 同步推送当前定位与健康档案
            </div>
          </div>
        </div>
        <EmergencyButton
          number="120"
          label="医疗急救"
          icon={Ambulance}
        />
        <EmergencyButton number="119" label="消防" icon={Flame} />
        <EmergencyButton number="110" label="公安" icon={PhoneCall} />
      </div>
    </GlassPanel>
  );
}

function EmergencyButton({
  number,
  label,
  icon: Icon,
}: {
  number: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl border px-4 py-3 text-left transition-all hover:brightness-110"
      style={{
        borderColor: `${EMERGENCY_COLOR}55`,
        background: `linear-gradient(135deg, ${EMERGENCY_COLOR}1a, ${EMERGENCY_COLOR}04)`,
      }}
    >
      <Icon size={16} style={{ color: EMERGENCY_COLOR }} />
      <div>
        <div className="font-mono text-[16px] font-bold" style={{ color: EMERGENCY_COLOR }}>
          {number}
        </div>
        <div className="text-[10px] text-[#D6CCB0]">{label}</div>
      </div>
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  color,
  eyebrow,
  title,
}: {
  icon: LucideIcon;
  color: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${color}28, ${color}08)`,
          border: `1px solid ${color}55`,
        }}
      >
        <Icon size={17} style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color }}>
          {eyebrow}
        </div>
        <div className="mt-0.5 text-[17px] font-semibold text-[#F5E9C9]">{title}</div>
      </div>
    </div>
  );
}

function EmergencyTipCard({ tip: t }: { tip: EmergencyTip }) {
  const Icon = t.icon;
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `${EMERGENCY_COLOR}33`,
        background: `linear-gradient(160deg, ${EMERGENCY_COLOR}08, rgba(20,22,30,0.4))`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: `${EMERGENCY_COLOR}1a`,
            border: `1px solid ${EMERGENCY_COLOR}55`,
          }}
        >
          <Icon size={15} style={{ color: EMERGENCY_COLOR }} />
        </div>
        <h4 className="text-[14px] font-semibold text-[#F5E9C9]">{t.scenario}</h4>
      </div>
      <div
        className="mt-3 rounded-xl border px-3 py-2"
        style={{
          borderColor: `${EMERGENCY_COLOR}66`,
          background: `${EMERGENCY_COLOR}14`,
        }}
      >
        <div
          className="text-[9px] uppercase tracking-[0.2em]"
          style={{ color: EMERGENCY_COLOR }}
        >
          第一步
        </div>
        <div className="mt-1 text-[12px] font-semibold leading-6 text-[#F5E9C9]">
          {t.firstAction}
        </div>
        <div className="mt-1 text-[10px] text-[#9AA3C4]">{t.timing}</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ color: '#34D399' }}
          >
            要做
          </div>
          <ul className="mt-1 space-y-1">
            {t.dosAndDonts.do.map((d) => (
              <li
                key={d}
                className="flex items-start gap-1 text-[10px] leading-5 text-[#D6CCB0]"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-[#34D399]" />
                {d}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ color: EMERGENCY_COLOR }}
          >
            不要做
          </div>
          <ul className="mt-1 space-y-1">
            {t.dosAndDonts.dont.map((d) => (
              <li
                key={d}
                className="flex items-start gap-1 text-[10px] leading-5 text-[#9AA3C4]"
              >
                <span
                  className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full"
                  style={{ background: EMERGENCY_COLOR }}
                />
                {d}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function InsuranceCard({ plan: p }: { plan: InsurancePlan }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `${INSURANCE_COLOR}33`,
        background: `linear-gradient(160deg, ${INSURANCE_COLOR}08, rgba(20,22,30,0.4))`,
      }}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck size={15} style={{ color: INSURANCE_COLOR }} />
        <span
          className="rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]"
          style={{
            background: `${INSURANCE_COLOR}14`,
            color: INSURANCE_COLOR,
            border: `1px solid ${INSURANCE_COLOR}44`,
          }}
        >
          {p.type}
        </span>
      </div>
      <h4 className="mt-2 text-[15px] font-semibold text-[#F5E9C9]">{p.name}</h4>
      <div className="mt-2 space-y-1">
        <InfoLine label="保障" value={p.coverage} />
        <InfoLine label="资格" value={p.eligible} />
        <InfoLine label="保费" value={p.premium} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.highlights.map((h) => (
          <span
            key={h}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[#C8CDD8]"
          >
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="w-8 shrink-0 text-[#6A7299]">{label}</span>
      <span className="flex-1 text-[#C8CDD8]">{value}</span>
    </div>
  );
}

function ServiceCard({ service: s }: { service: ServiceItem }) {
  const Icon = s.icon;
  return (
    <button
      type="button"
      className="group flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-left transition-all hover:border-white/20"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: `${SERVICE_COLOR}18`,
          border: `1px solid ${SERVICE_COLOR}55`,
        }}
      >
        <Icon size={15} style={{ color: SERVICE_COLOR }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-[#F5E9C9]">{s.name}</h4>
          <ChevronRight size={13} className="text-[#6A7299] transition-transform group-hover:translate-x-0.5" />
        </div>
        <div className="mt-1 text-[11px] leading-6 text-[#9AA3C4]">{s.body}</div>
        <div
          className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px]"
          style={{
            background: `${SERVICE_COLOR}14`,
            color: SERVICE_COLOR,
            border: `1px solid ${SERVICE_COLOR}44`,
          }}
        >
          {s.action}
        </div>
      </div>
    </button>
  );
}
