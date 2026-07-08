'use client';

/**
 * 吏部通电 · 招聘真链面板(2026-07-03)
 *
 * 之前只有本地启发式(reviewHiring，纯规则打分)。这里加"进阶：派真人才蜂群"入口——
 * 真派 jiqun libu 蜂群，出招聘方案/画像/面试题(咨询性，不碰发 offer/定薪，见路由头注释)。
 * 视觉/协议参照工部 GongbuPackSizingPanel(工部第一条真接线的既有写法)，不发明新样式。
 */
import { useState } from 'react';
import { Loader2, Users2 } from 'lucide-react';
import { useSwarmDispatchPoll } from '@/features/shared/hooks/use-swarm-dispatch-poll';
import { ACCENT } from '@/features/libu/lib/libu-roster';

const C = { warm: '#F5E9C9', dim: '#a7a190', faint: '#5f5a48', border: `${ACCENT}30`, live: '#7FC9A8', amber: '#E5B84D', danger: '#E5847A' };

interface RecruitVerdict {
  verdict: string;
  disposition: string;
  mustResolve: string[];
}

interface RecruitPollResult {
  status?: string;
  sourceLabel?: string;
  data?: unknown;
  verdict?: RecruitVerdict | null;
  qualityScore?: number | null;
  message?: string;
}

function labelMeta(sourceLabel: string | undefined): { text: string; color: string } {
  if (sourceLabel === 'LIVE_SWARM' || sourceLabel === 'LIVE') return { text: '真 · 后端人才蜂群实算', color: C.live };
  return { text: '降级 · 未验真，不返产出', color: C.amber };
}

export function LibuRecruitSwarmPanel() {
  const [taskInput, setTaskInput] = useState('');
  const { state, dispatch } = useSwarmDispatchPoll<RecruitPollResult>(
    '/api/court/dept/li-bu/recruit',
    '/api/court/dept/li-bu/recruit/result',
  );

  const busy = state.phase === 'dispatching' || state.phase === 'polling';
  const canDispatch = taskInput.trim().length >= 4 && !busy;

  return (
    <div className="mt-3 rounded-[16px] border px-4 py-3.5" style={{ borderColor: C.border, background: `linear-gradient(180deg, ${ACCENT}10 0%, rgba(6,8,14,0.92) 100%)` }}>
      <div className="flex items-center gap-2">
        <Users2 size={14} style={{ color: ACCENT }} />
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>进阶：派真人才蜂群深度方案</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.live}44`, color: C.live, background: `${C.live}12` }}>吏部真链</span>
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: C.faint }}>
        上面是本地启发式三件套审查；这里真派后端人才蜂群，出完整招聘方案/画像/面试题(咨询性，不碰发 offer/定薪)。
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void dispatch(taskInput.trim()); }}
          placeholder="如：招一名Java后端工程师，月薪1.5万，负责储能BMS后台"
          disabled={busy}
          className="min-w-[260px] flex-1 rounded-[9px] border bg-transparent px-3 py-2 text-[13px] outline-none disabled:opacity-60"
          style={{ borderColor: C.border, color: C.warm }}
        />
        <button
          type="button"
          onClick={() => void dispatch(taskInput.trim())}
          disabled={!canDispatch}
          className="inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-45"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #C9A86B)`, color: '#1a1408' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Users2 size={14} />}
          {state.phase === 'dispatching' ? '派发中…' : state.phase === 'polling' ? '蜂群运行中…' : '派人才蜂群'}
        </button>
      </div>

      {state.phase === 'error' && (
        <p className="mt-3 text-[12.5px]" style={{ color: C.danger }}>{state.message}</p>
      )}

      {state.phase === 'done' && (
        <div className="mt-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
          {(() => {
            const meta = labelMeta(state.result.sourceLabel);
            return (
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} />
                <span className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.text}</span>
              </div>
            );
          })()}
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: C.dim }}>
            {state.result.message || '后端未返回摘要。'}
          </p>
          {state.result.verdict && (
            <p className="mt-2 text-[13px] font-semibold" style={{ color: C.warm }}>
              裁断：{state.result.verdict.verdict}
              {state.result.verdict.mustResolve.length > 0 && (
                <span className="ml-2 text-[11px] font-normal" style={{ color: C.amber }}>
                  待补：{state.result.verdict.mustResolve.join('、')}
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
