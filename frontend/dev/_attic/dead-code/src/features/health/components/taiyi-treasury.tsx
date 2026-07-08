'use client';

/**
 * 太医院 · 太医典藏阁（2026-06-24 · 需求#3 · 深层参考层）。
 *
 * 三标签,全只显示/检索/跳转,零自动操作、零诊断:
 *   - 体检档案:自己 + 家人多档(用户录入,无则诚实待录,绝不编体征)。
 *   - 疾病科普:检索式 → 跳权威公开源 + "遵医嘱"声明;绝不结合个人体检生成个性化方案(安全墙)。
 *   - 医疗前沿:公开研究/产业资讯(脑机接口/长寿…),带来源日期,标注采集快照非实时。
 *
 * 安全墙(healthcare-reviewer/schneier):体检数据(个人)与科普/前沿(通用)永不交叉生成"针对你的治疗"。
 */

import { useState } from 'react';
import { FolderHeart, BookText, Telescope, ExternalLink, Search, UserPlus } from 'lucide-react';
import { useTaiyiDashboard } from '@/features/taiyi/hooks/use-taiyi-dashboard';
import { MEDICAL_FRONTIER, FRONTIER_AS_OF } from '@/features/health/lib/medical-frontier';

const ACCENT = '#34D399';
const INK = '#E8FFF5';

type Tab = 'records' | 'kb' | 'frontier';
const TABS: Array<{ key: Tab; label: string; icon: typeof FolderHeart }> = [
  { key: 'records', label: '体检档案', icon: FolderHeart },
  { key: 'kb', label: '疾病科普', icon: BookText },
  { key: 'frontier', label: '医疗前沿', icon: Telescope },
];

// 权威公开医学信息源(跳转检索,非个人诊疗):默沙东大众版(科普权威) + 国家卫健委。
const KB_SOURCES = [
  { label: '默沙东诊疗手册·大众版', base: 'https://www.msdmanuals.cn/home/search?query=' },
  { label: '国家卫生健康委', base: 'https://www.nhc.gov.cn/wjw/index.shtml?q=' },
];

interface MetricLite {
  name: string;
  value?: string | number;
  unit?: string;
}

export function TaiyiTreasury() {
  const [tab, setTab] = useState<Tab>('records');
  const [kb, setKb] = useState('');
  const { dashboard } = useTaiyiDashboard();
  const profile = dashboard && dashboard.dataSource !== 'fallback' ? dashboard.profile : null;
  const metrics: MetricLite[] = (profile?.metrics as MetricLite[] | undefined) ?? [];

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: `${ACCENT}30`, background: `linear-gradient(180deg, ${ACCENT}0a, ${ACCENT}03)` }}>
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => {
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-all"
              style={on ? { borderColor: `${ACCENT}66`, color: ACCENT, background: `${ACCENT}12` } : { borderColor: 'rgba(232,255,245,0.14)', color: '#9FC4B4' }}
            >
              <Icon size={13} /> {label}
            </button>
          );
        })}
        <span className="ml-auto text-[10px] text-[#5C7A6E]">只显信息 · 不诊断 · 不代操作</span>
      </div>

      <div className="mt-4">
        {/* 体检档案:自己 + 家人(诚实待录) */}
        {tab === 'records' && (
          <div className="space-y-3">
            <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${ACCENT}1f`, background: 'rgba(232,255,245,0.03)' }}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#7FA896]">我（{profile?.subjectName ?? '本人'}）· 体检要点</div>
              {metrics.length ? (
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                  {metrics.slice(0, 6).map((m) => (
                    <span key={m.name} className="text-[12.5px]" style={{ color: INK }}>
                      <span className="text-[#7FA896]">{m.name} </span>{m.value ?? '—'}{m.unit ?? ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-[#9FC4B4]">暂无体检记录 · <span className="text-[#BDAA7C]">待录/上传</span>，绝不编造体征。</p>
              )}
            </div>
            {['父亲', '母亲'].map((who) => (
              <div key={who} className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(232,255,245,0.1)' }}>
                <span className="text-[12.5px]" style={{ color: INK }}>家人 · {who}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#BDAA7C]">
                  <UserPlus size={12} /> 待建档（录入其体检记录后显示）
                </span>
              </div>
            ))}
            <p className="text-[10px] text-[#5C7A6E]">档案仅显示你录入的真实数据;不与下方科普/前沿交叉生成任何个人治疗结论。</p>
          </div>
        )}

        {/* 疾病科普:检索式跳权威源,遵医嘱,不个性化 */}
        {tab === 'kb' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: `${ACCENT}30` }}>
              <Search size={14} style={{ color: ACCENT }} />
              <input
                value={kb}
                onChange={(e) => setKb(e.target.value)}
                placeholder="输入病名/症状，查权威科普（如：高血压、糖尿病）"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#5C7A6E]"
                style={{ color: INK }}
              />
            </div>
            {/* 安全墙(healthcare-reviewer/schneier):下方 href 只可由用户输入 kb 构成,
                严禁掺入 profile.metrics 任何体检值 —— 否则"通用科普检索"塌成"据你的体检个性化荐疗"=变相诊疗。 */}
            <div className="flex flex-wrap gap-2">
              {KB_SOURCES.map((s) => (
                <a
                  key={s.label}
                  href={kb.trim() ? `${s.base}${encodeURIComponent(kb.trim())}` : s.base.split('?')[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] transition-all hover:brightness-110"
                  style={{ borderColor: `${ACCENT}33`, color: ACCENT }}
                >
                  去 {s.label} 查 <ExternalLink size={11} />
                </a>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-[#BDAA7C]">
              太医院只引你到权威公开科普，<span className="font-semibold">不替你判断病情、不给个性化治疗方案</span>。具体诊疗请就医、遵医嘱。
            </p>
          </div>
        )}

        {/* 医疗前沿:公开资讯快照 */}
        {tab === 'frontier' && (
          <div className="space-y-2">
            {MEDICAL_FRONTIER.map((f) => (
              <a
                key={f.href}
                href={f.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 rounded-lg border px-3 py-2 transition-all hover:brightness-110"
                style={{ borderColor: `${ACCENT}1f`, background: 'rgba(232,255,245,0.03)' }}
              >
                <span className="mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: `${ACCENT}44`, color: ACCENT }}>{f.topic}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] leading-5" style={{ color: INK }}>{f.title}</span>
                  <span className="block text-[10.5px] text-[#7FA896]">{f.source} · {f.date}</span>
                </span>
                <ExternalLink size={12} className="mt-0.5 shrink-0 text-[#5C7A6E]" />
              </a>
            ))}
            <p className="text-[10px] text-[#5C7A6E]">公开研究/产业资讯快照 · 截至 {FRONTIER_AS_OF} · 非实时、非个人医疗建议 · 点击看原文出处。</p>
          </div>
        )}
      </div>
    </div>
  );
}
