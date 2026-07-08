'use client';

/**
 * 穿堂线 CaseSpine（一案穿堂 Phase 0 · v1 · 2026-07-06）
 *
 * 一个真案的跨页全局脊：立案 → 会审 →（预测/裁决/归档/兑现 待接后端）。
 * 张小龙纪律：**只画已经真通的两站**（立案●→会审●），其余四站收成尾部一行灰字"待接后端"，
 * 不画六个半空灰圆点——进度感来自"真的在亮"，不是"占了六个坑"。
 * 后端归档/兑现 HTTP 路由补上后，再把后四站逐个显形。
 *
 * v1 挂军机处（替内部 stepper，铁律3 归一）；上书房/史馆待共享 activeCase 状态后再挂。
 */

const GOLD = '#F0C66A';

/** 已真通的站（v1 只有这两站有真数据）。 */
type LiveStage = 'filed' | 'review';

const LIVE_STATIONS: { key: LiveStage; label: string; en: string }[] = [
  { key: 'filed', label: '立案', en: 'Filed' },
  { key: 'review', label: '会审', en: 'Review' },
];

/** 后端待接的四站（收成尾部灰字，不占圆点）。 */
const PENDING_LABEL = '预测 · 裁决 · 归档 · 兑现';

export function CaseSpine({
  caseId,
  caseTitle,
  stage,
}: {
  caseId: string | null;
  caseTitle?: string | null;
  /** 当前到哪站（v1：无案=null，接案即 review）。 */
  stage: LiveStage | null;
}) {
  const hasCase = Boolean(caseId);

  return (
    <section
      aria-label="穿堂线 · 案子跨页进度"
      className="rounded-2xl border px-5 py-3 backdrop-blur-sm"
      style={{ borderColor: `${GOLD}30`, background: `linear-gradient(135deg, ${GOLD}0e, ${GOLD}04)` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[10px] tracking-[0.18em]" style={{ color: GOLD }}>
            {hasCase ? `案号 ${caseId}` : '穿堂线 · 待接案'}
          </span>
          <p className="display-serif mt-0.5 truncate text-[15px] leading-6 text-[#F5E9C9]">
            {hasCase
              ? caseTitle || '当前真案'
              : '从上书房立一条真案，案子即在此沿立案→会审→…流转'}
          </p>
        </div>
      </div>

      {/* 两站真脊 + 尾部待接灰字 */}
      <ol className="mt-3 flex items-center gap-1.5">
        {LIVE_STATIONS.map((s, i) => {
          // stage 驱动：filed 站在进入 review 后标 done；当前 stage 站为 active。
          const isDone = hasCase && s.key === 'filed' && stage === 'review';
          const isActive = hasCase && s.key === stage;
          const tone = isDone ? '#34D399' : isActive ? GOLD : '#5B6172';
          return (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                style={{ border: `1.5px solid ${tone}`, color: tone, background: isActive ? `${GOLD}1a` : 'transparent' }}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <div className="leading-tight">
                <div className="text-[12.5px] font-semibold" style={{ color: isDone || isActive ? '#F5E9C9' : '#8A8FA0' }}>
                  {s.label}
                </div>
                <div className="font-mono text-[8.5px] uppercase tracking-wider" style={{ color: tone }}>
                  {s.en}
                </div>
              </div>
              {i < LIVE_STATIONS.length - 1 && (
                <div className="mx-1 h-px w-8 rounded" style={{ background: hasCase ? '#34D39955' : '#ffffff14' }} />
              )}
            </li>
          );
        })}
        {/* 后四站：不占圆点，收成一行灰字（张小龙：别画半空进度条） */}
        <div className="ml-2 flex items-center gap-1.5">
          <div className="h-px w-6 rounded" style={{ background: '#ffffff14' }} />
          <span className="text-[10.5px] leading-tight text-[#6A7189]">{PENDING_LABEL} · 待接后端</span>
        </div>
      </ol>
    </section>
  );
}
