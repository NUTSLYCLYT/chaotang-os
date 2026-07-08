'use client';

/**
 * 军机处案子流水线 stepper(2026-06-29 · 案子主脊 · 见 docs/JUNJICHU-CASE-PIPELINE-DESIGN.md)。
 *
 * 把军机处从"面板堆砌"给一条脊:一个案子走过 4 关 —— 立项 → 会审 → 封询 → 盖章。
 * 纯展示:关位由调用方从 task 状态推导(不依赖 LiteLLM);诚实标源贯穿(LIVE/MIXED/FALLBACK)。
 * 附加式:挂军机处主视图顶部,不动现有面板。第一步只立脊,后续各关再接现有原语(会审/封驳/盖章)。
 */

export type CaseStage = 1 | 2 | 3 | 4; // 1=立项 2=会审 3=封询 4=盖章

const STAGES: { stage: CaseStage; label: string; en: string }[] = [
  { stage: 1, label: '立项', en: 'Filed' },
  { stage: 2, label: '会审', en: 'Review' },
  { stage: 3, label: '封询', en: 'Consult' },
  { stage: 4, label: '盖章', en: 'Sealed' },
];

const GOLD = '#F0C66A';

function sourceStyle(label: string): { text: string; color: string } | null {
  if (label === 'LIVE' || label === 'LIVE_SWARM') return { text: '真 · LIVE', color: '#34D399' };
  if (label === 'MIXED') return { text: '半真 · MIXED', color: GOLD };
  if (label === 'FALLBACK') return { text: '离线兜底 · FALLBACK', color: '#F5A524' };
  if (label === 'DEMO') return { text: '演示 · DEMO', color: '#9AA3C4' };
  return null; // 无明确来源 → 不显徽章(不假标),案子头已显待接案/案号
}

interface Props {
  caseId?: string | null;     // 案号(无=未立案)
  caseTitle?: string | null;  // 案由
  currentStage: CaseStage;    // 当前到第几关(调用方从 task 状态推导)
  sourceLabel?: string;       // 诚实标源
}

export function JunjichuCaseStepper({ caseId, caseTitle, currentStage, sourceLabel }: Props) {
  const src = sourceLabel ? sourceStyle(sourceLabel) : null;
  return (
    <section
      aria-label="案子流水线"
      className="rounded-2xl border px-5 py-3.5 backdrop-blur-sm"
      style={{ borderColor: `${GOLD}30`, background: `linear-gradient(135deg, ${GOLD}0e, ${GOLD}04)` }}
    >
      {/* 案子头:案号 + 案由 + 标源 */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[10px] tracking-[0.18em]" style={{ color: GOLD }}>
            {caseId ? `案号 ${caseId}` : '军机处 · 待接案'}
          </span>
          <p className="display-serif mt-0.5 truncate text-[15px] leading-6 text-[#F5E9C9]">
            {caseTitle || '从上书房下旨或工部建设案立案后,案子在此走完 立项→会审→封询→盖章'}
          </p>
        </div>
        {src && (
          <span className="shrink-0 rounded border px-2 py-0.5 font-mono text-[10px]" style={{ borderColor: `${src.color}55`, color: src.color }}>
            {src.text}
          </span>
        )}
      </div>

      {/* 4 关 stepper */}
      <ol className="mt-3 flex items-center gap-1.5">
        {STAGES.map((s, i) => {
          const done = caseId ? s.stage < currentStage : false;
          const active = caseId ? s.stage === currentStage : false;
          const tone = done ? '#34D399' : active ? GOLD : '#5B6172';
          return (
            <li key={s.stage} className="flex flex-1 items-center gap-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                  style={{ border: `1.5px solid ${tone}`, color: tone, background: active ? `${GOLD}1a` : 'transparent' }}
                >
                  {done ? '✓' : s.stage}
                </span>
                <div className="leading-tight">
                  <div className="text-[12.5px] font-semibold" style={{ color: active || done ? '#F5E9C9' : '#8A8FA0' }}>{s.label}</div>
                  <div className="font-mono text-[8.5px] uppercase tracking-wider" style={{ color: tone }}>{s.en}</div>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="h-px flex-1 rounded" style={{ background: s.stage < currentStage && caseId ? '#34D39955' : '#ffffff14' }} />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
