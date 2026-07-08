/**
 * 太医院 · 医疗资源
 *
 * 专家门诊 + 一键挂号 + 周边医疗 + 相关疾病资源
 */

'use client';

import { useState } from 'react';
import {
  Stethoscope,
  MapPin,
  CalendarCheck,
  Star,
  Hospital,
  Award,
  Video,
  PhoneCall,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { colors } from '@/config/design-tokens';

const HEALTH_ACCENT = colors.success;

interface Expert {
  id: string;
  name: string;
  title: string;
  hospital: string;
  specialty: string;
  rating: number;
  rating_count: number;
  next_slot: string;
  tags: string[];
  fee: string;
  online: boolean;
}

const EXPERTS: Expert[] = [
  {
    id: 'e1',
    name: '吴孟超',
    title: '主任医师 · 教授',
    hospital: '上海东方肝胆外科医院',
    specialty: '肝胆外科 · 肝癌',
    rating: 4.9,
    rating_count: 3421,
    next_slot: '明日 09:00',
    tags: ['三甲', '博导', '院士'],
    fee: '¥ 1,500',
    online: false,
  },
  {
    id: 'e2',
    name: '葛均波',
    title: '主任医师 · 教授',
    hospital: '复旦大学附属中山医院',
    specialty: '心内科 · 冠心病介入',
    rating: 4.9,
    rating_count: 2876,
    next_slot: '周五 14:00',
    tags: ['三甲', '心脏介入', '院士'],
    fee: '¥ 1,200',
    online: true,
  },
  {
    id: 'e3',
    name: '黄晓军',
    title: '主任医师 · 教授',
    hospital: '北京大学人民医院',
    specialty: '血液科 · 造血干细胞移植',
    rating: 4.8,
    rating_count: 1987,
    next_slot: '下周一 10:30',
    tags: ['三甲', '博导'],
    fee: '¥ 1,000',
    online: true,
  },
  {
    id: 'e4',
    name: '林希平',
    title: '副主任医师',
    hospital: '华西医院',
    specialty: '内分泌科 · 糖尿病',
    rating: 4.7,
    rating_count: 842,
    next_slot: '今日 16:30',
    tags: ['三甲', '代谢'],
    fee: '¥ 350',
    online: true,
  },
  {
    id: 'e5',
    name: '赵雅琳',
    title: '主治医师',
    hospital: '北京协和医院',
    specialty: '皮肤科 · 过敏性皮炎',
    rating: 4.8,
    rating_count: 1234,
    next_slot: '明日 11:00',
    tags: ['三甲', '皮肤'],
    fee: '¥ 450',
    online: true,
  },
  {
    id: 'e6',
    name: '陈明远',
    title: '主任医师',
    hospital: '浙江大学医学院附属第一医院',
    specialty: '神经内科 · 脑卒中',
    rating: 4.8,
    rating_count: 1566,
    next_slot: '后日 09:30',
    tags: ['三甲', '脑科'],
    fee: '¥ 800',
    online: false,
  },
];

interface NearbyResource {
  id: string;
  name: string;
  type: '三甲医院' | '社区医院' | '药房' | '康复中心';
  distance: string;
  address: string;
  rating: number;
  highlights: string[];
}

const NEARBY: NearbyResource[] = [
  {
    id: 'r1',
    name: '上海市第一人民医院',
    type: '三甲医院',
    distance: '2.3 km',
    address: '虹口区海宁路 100 号',
    rating: 4.7,
    highlights: ['24h 急诊', '国家级心血管中心', '互联网医院已开通'],
  },
  {
    id: 'r2',
    name: '社区卫生服务中心',
    type: '社区医院',
    distance: '450 m',
    address: '乍浦路 156 号',
    rating: 4.5,
    highlights: ['家庭医生签约', '慢病续方', '中医推拿'],
  },
  {
    id: 'r3',
    name: '国大药房（海伦路店）',
    type: '药房',
    distance: '380 m',
    address: '海伦路 88 号 2F',
    rating: 4.6,
    highlights: ['24h 营业', '处方药医保直付', '送药 30 分钟达'],
  },
  {
    id: 'r4',
    name: '市北康复医院',
    type: '康复中心',
    distance: '3.8 km',
    address: '场中路 2199 号',
    rating: 4.4,
    highlights: ['运动康复', '神经康复', '水疗池'],
  },
];

interface DiseaseGuide {
  id: string;
  disease: string;
  alias?: string;
  relatedOrgans: string;
  summary: string;
  pillars: string[];
  relatedExpertSpecialty: string;
}

const GUIDES: DiseaseGuide[] = [
  {
    id: 'd1',
    disease: '高血压',
    alias: 'Hypertension',
    relatedOrgans: '心、肾、血管',
    summary: '长期血压 ≥ 140/90 mmHg 需干预；每 5 mmHg 降压可降低脑卒中风险 14%。',
    pillars: ['限盐 DASH 饮食', '每周 150min 有氧', '规律服药', '每周在家监测'],
    relatedExpertSpecialty: '心内科',
  },
  {
    id: 'd2',
    disease: '2 型糖尿病',
    alias: 'T2DM',
    relatedOrgans: '胰岛、肝、肾',
    summary: 'HbA1c ≥ 6.5% 或 空腹 ≥ 7.0 mmol/L 确诊；新型 GLP-1 联合治疗正在成为主流。',
    pillars: ['低 GI 饮食', '力量 + 有氧', '血糖 CGM 监测', '每季度 HbA1c'],
    relatedExpertSpecialty: '内分泌科',
  },
  {
    id: 'd3',
    disease: '过敏性鼻炎',
    alias: 'Allergic Rhinitis',
    relatedOrgans: '鼻腔、免疫',
    summary: '季节性 + 常年性两型；鼻用激素 + 抗组胺组合控制症状优于单药。',
    pillars: ['规避过敏原', '鼻用激素', '脱敏治疗', '空气净化'],
    relatedExpertSpecialty: '耳鼻喉科 / 变态反应科',
  },
];

export function MedicalResources() {
  const [view, setView] = useState<'experts' | 'nearby' | 'guides'>('experts');

  return (
    <div className="space-y-5">
      {/* Sub-tab pills */}
      <div className="flex flex-wrap gap-2">
        <SubTab
          active={view === 'experts'}
          icon={Stethoscope}
          label="专家门诊 · 一键挂号"
          count={EXPERTS.length}
          onClick={() => setView('experts')}
        />
        <SubTab
          active={view === 'nearby'}
          icon={MapPin}
          label="周边医疗"
          count={NEARBY.length}
          onClick={() => setView('nearby')}
        />
        <SubTab
          active={view === 'guides'}
          icon={BookOpen}
          label="疾病百科 · 关注疾病"
          count={GUIDES.length}
          onClick={() => setView('guides')}
        />
      </div>

      {view === 'experts' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {EXPERTS.map((e) => (
            <ExpertCard key={e.id} expert={e} />
          ))}
        </div>
      )}

      {view === 'nearby' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {NEARBY.map((n) => (
            <NearbyCard key={n.id} resource={n} />
          ))}
        </div>
      )}

      {view === 'guides' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {GUIDES.map((g) => (
            <GuideCard key={g.id} guide={g} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */

function SubTab({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: typeof Stethoscope;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full px-4 py-2 text-[12px] transition-all"
      style={{
        background: active
          ? `linear-gradient(135deg, ${HEALTH_ACCENT}22, ${HEALTH_ACCENT}06)`
          : 'rgba(255,255,255,0.03)',
        border: active
          ? `1px solid ${HEALTH_ACCENT}66`
          : '1px solid rgba(255,255,255,0.08)',
        color: active ? colors.text : colors.textDim,
        boxShadow: active ? `0 2px 14px ${HEALTH_ACCENT}22` : undefined,
      }}
    >
      <Icon size={13} style={{ color: active ? HEALTH_ACCENT : colors.textDim }} />
      <span className="font-semibold">{label}</span>
      <span
        className="rounded-full px-1.5 py-0.5 font-mono text-[11px]"
        style={{
          background: active ? `${HEALTH_ACCENT}22` : 'rgba(255,255,255,0.05)',
          color: active ? HEALTH_ACCENT : colors.textDim,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function ExpertCard({ expert: e }: { expert: Expert }) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-all"
      style={{
        background: 'linear-gradient(160deg, rgba(52,211,153,0.06), rgba(20,22,30,0.3))',
        ['--expert-hover-border' as string]: `${HEALTH_ACCENT}66`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${HEALTH_ACCENT}66`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar · gold ring */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[20px] font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(240,198,106,0.25), rgba(240,198,106,0.05))',
            border: '1px solid rgba(240,198,106,0.55)',
            color: colors.text,
          }}
        >
          {e.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-[15px] font-semibold" style={{ color: colors.text }}>{e.name}</h4>
            {e.online && (
              <span className="rounded-full border px-1.5 py-0.5 text-[11px]" style={{ borderColor: `${HEALTH_ACCENT}80`, background: `${HEALTH_ACCENT}1a`, color: HEALTH_ACCENT }}>
                线上
              </span>
            )}
          </div>
          <div className="text-[11px]" style={{ color: colors.textDim }}>{e.title}</div>
          <div className="mt-1 text-[11px]" style={{ color: colors.text }}>{e.hospital}</div>
          <div className="mt-1 text-[11px] font-medium" style={{ color: HEALTH_ACCENT }}>
            {e.specialty}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {e.tags.map((t) => (
          <span
            key={t}
            className="rounded-full border px-2 py-0.5 text-[11px]"
            style={{ borderColor: `${colors.goldBright}4d`, background: `${colors.goldBright}14`, color: colors.goldBright }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Rating + slot */}
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-black/20 p-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
            评分
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <Star size={11} style={{ color: colors.goldBright }} fill="currentColor" />
            <span className="font-mono text-[14px] font-bold" style={{ color: colors.text }}>
              {e.rating}
            </span>
            <span className="text-[11px]" style={{ color: colors.textMuted }}>({e.rating_count})</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
            最近号源
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: HEALTH_ACCENT }}>
            <CalendarCheck size={11} />
            {e.next_slot}
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="flex items-center justify-center gap-1 rounded-lg border py-2 text-[11px] font-semibold transition hover:brightness-110"
          style={{
            borderColor: `${HEALTH_ACCENT}66`,
            background: `${HEALTH_ACCENT}1a`,
            color: HEALTH_ACCENT,
          }}
        >
          <CalendarCheck size={11} />
          一键挂号
          <span className="ml-1 font-mono text-[11px] opacity-70">{e.fee}</span>
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-1 rounded-lg border border-white/12 bg-white/[0.04] py-2 text-[11px] transition hover:bg-white/10"
          style={{ color: colors.text }}
        >
          {e.online ? <Video size={11} /> : <PhoneCall size={11} />}
          {e.online ? '视频问诊' : '联系助理'}
        </button>
      </div>
    </div>
  );
}

function NearbyCard({ resource: r }: { resource: NearbyResource }) {
  const typeColor: Record<NearbyResource['type'], string> = {
    三甲医院: colors.danger,
    社区医院: colors.blueBright,
    药房: colors.warning,
    康复中心: colors.gold,
  };
  const color = typeColor[r.type];
  return (
    <div
      className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-all hover:border-white/20"
      style={{ background: `linear-gradient(160deg, ${color}08, rgba(20,22,30,0.3))` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: `${color}1a`,
                border: `1px solid ${color}55`,
              }}
            >
              <Hospital size={15} style={{ color }} />
            </div>
            <div>
              <h4 className="text-[14px] font-semibold" style={{ color: colors.text }}>{r.name}</h4>
              <div className="text-[11px]" style={{ color }}>
                {r.type}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-[11px]">
            <Star size={10} style={{ color: colors.goldBright }} fill="currentColor" />
            <span className="font-mono" style={{ color: colors.text }}>{r.rating}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px]" style={{ color: colors.textDim }}>
            <MapPin size={9} />
            {r.distance}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px]" style={{ color: colors.textDim }}>{r.address}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.highlights.map((h) => (
          <span
            key={h}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px]"
            style={{ color: colors.text }}
          >
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}

function GuideCard({ guide: g }: { guide: DiseaseGuide }) {
  return (
    <div
      className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-all"
      style={{
        background: 'linear-gradient(160deg, rgba(52,211,153,0.06), rgba(20,22,30,0.3))',
      }}
    >
      <div className="flex items-center gap-2">
        <Award size={14} style={{ color: HEALTH_ACCENT }} />
        <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: HEALTH_ACCENT }}>
          关注疾病
        </div>
      </div>
      <h4 className="mt-2 text-[16px] font-semibold" style={{ color: colors.text }}>{g.disease}</h4>
      {g.alias && (
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
          {g.alias}
        </div>
      )}
      <div className="mt-2 text-[11px]" style={{ color: colors.textDim }}>相关：{g.relatedOrgans}</div>
      <p className="mt-2 text-[12px] leading-6" style={{ color: colors.text }}>{g.summary}</p>
      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: colors.goldDeep }}>
          管理四柱
        </div>
        <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
          {g.pillars.map((p) => (
            <li
              key={p}
              className="flex items-center gap-1 rounded-lg border border-white/8 bg-black/15 px-2 py-1 text-[11px]"
              style={{ color: colors.text }}
            >
              <TrendingUp size={9} style={{ color: HEALTH_ACCENT }} />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="mt-3 w-full rounded-lg border py-2 text-[11px] font-semibold transition hover:brightness-110"
        style={{
          borderColor: `${HEALTH_ACCENT}55`,
          background: `${HEALTH_ACCENT}14`,
          color: HEALTH_ACCENT,
        }}
      >
        查 {g.relatedExpertSpecialty} 专家
      </button>
    </div>
  );
}
