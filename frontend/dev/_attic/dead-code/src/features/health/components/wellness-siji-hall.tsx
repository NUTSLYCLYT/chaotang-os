'use client';

/**
 * 太医院 · 养生四时堂（2026-06-24 · 养生#1 主英雄位）。
 *
 * 以二十四节气为轴:今日节气 → 养护重点 → 餐饮/睡眠/起居/导引四柱当令建议 + 一段导引(配视频)。
 * 配色随太医院青碧医道主题(ACCENT #83E6BF / #E8FFF5),非帝金,融进本页不违和。
 * 不诊断、不显健康总分;自录指标接真档(useTaiyiDashboard),无真数据诚实「待录」,绝不编造体征。
 */

import { useMemo } from 'react';
import { UtensilsCrossed, Moon, Sunrise, Wind, Play } from 'lucide-react';
import { useTaiyiDashboard } from '@/features/taiyi/hooks/use-taiyi-dashboard';
import { computeSolarTerm } from '@/features/health/lib/solar-terms';

const ACCENT = '#83E6BF'; // 太医院青碧医道
const INK = '#E8FFF5';

interface MetricLite {
  name: string;
  value?: string | number;
  unit?: string;
}

const PILLARS = [
  { key: 'diet', label: '餐饮', icon: UtensilsCrossed },
  { key: 'sleep', label: '睡眠', icon: Moon },
  { key: 'routine', label: '起居', icon: Sunrise },
  { key: 'guidance', label: '导引', icon: Wind },
] as const;

function MyMetric({ label, metric }: { label: string; metric: MetricLite | null }) {
  const has = metric != null && metric.value != null && String(metric.value).trim() !== '';
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-[#7FA896]">{label}</span>
      {has ? (
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: INK }}>
          {metric!.value}
          {metric!.unit ? <span className="ml-0.5 text-[10px] text-[#9FC4B4]">{metric!.unit}</span> : null}
        </span>
      ) : (
        <span className="text-[11px] text-[#5C7A6E]">待录</span>
      )}
    </div>
  );
}

export function WellnessSijiHall({ guidanceVideoHref }: { guidanceVideoHref?: string }) {
  // 安全红线(healthcare-reviewer/schneier):节气 focus/motto 必须只依赖日期,
  // 绝不可掺入 useTaiyiDashboard 的个人指标 —— 一旦个性化(如"你睡眠不足故今日尤需养心"),
  // 就从"节气通用养生"滑成"个人健康判断"= 变相诊断,底部"不诊断"声明即成谎言。保持纯日期函数。
  const term = useMemo(() => computeSolarTerm(new Date()), []);
  const { dashboard } = useTaiyiDashboard();
  const profile = dashboard && dashboard.dataSource !== 'fallback' ? dashboard.profile : null;
  const metrics: MetricLite[] = (profile?.metrics as MetricLite[] | undefined) ?? [];
  const find = (label: string) =>
    metrics.find((m) => m.name?.includes(label) || label.includes(m.name)) ?? null;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: `${ACCENT}30`, background: `linear-gradient(180deg, ${ACCENT}10, ${ACCENT}05)`, boxShadow: `0 0 40px ${ACCENT}0a, inset 0 1px 0 rgba(232,255,245,0.06)` }}
    >
      {/* 节气中枢 */}
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>太医院 · 养生四时堂</div>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span aria-hidden className="text-[22px]" style={{ color: `${ACCENT}b0` }}>☯</span>
          <h2 className="font-serif text-[30px] font-semibold leading-none tracking-[0.08em]" style={{ color: INK }}>
            今日 · {term.name} · {term.focus.split('·')[0]}
          </h2>
        </div>
        <p className="mt-2 mx-auto max-w-[44ch] text-[13px] leading-7 text-[#C7E8DA]">{term.motto}</p>
      </div>

      {/* 四柱当令 */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {PILLARS.map(({ key, label, icon: Icon }) => {
          const isGuidance = key === 'guidance';
          return (
            <div key={key} className="flex flex-col rounded-xl border px-3.5 py-3" style={{ borderColor: `${ACCENT}1f`, background: 'rgba(232,255,245,0.03)' }}>
              <div className="flex items-center gap-1.5">
                <Icon size={14} style={{ color: ACCENT }} />
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#7FA896]">{label}</span>
              </div>
              <p className="mt-2 text-[12.5px] leading-5" style={{ color: INK }}>{term.care[key]}</p>
              {isGuidance && (
                <a
                  href={guidanceVideoHref ?? undefined}
                  aria-disabled={!guidanceVideoHref}
                  className="mt-2 inline-flex items-center gap-1 self-start rounded-full border px-2.5 py-1 text-[11px] transition-all hover:brightness-110"
                  style={
                    guidanceVideoHref
                      ? { borderColor: `${ACCENT}55`, color: ACCENT }
                      : { borderColor: 'rgba(255,255,255,0.10)', color: '#5C7A6E', pointerEvents: 'none' }
                  }
                >
                  <Play size={11} />
                  {guidanceVideoHref ? '看导引' : '导引待接'}
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* 圣躬起居（接真自录,无则待录,绝不编造） */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t pt-3" style={{ borderColor: 'rgba(232,255,245,0.08)' }}>
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#7FA896]">圣躬起居注</span>
        <MyMetric label="睡眠" metric={find('睡眠')} />
        <MyMetric label="饮水" metric={find('饮水')} />
        <MyMetric label="步数" metric={find('步数')} />
        <span className="ml-auto text-[10px] text-[#5C7A6E]">顺时养生 · 不诊断 · 仅养生常识</span>
      </div>
    </div>
  );
}
