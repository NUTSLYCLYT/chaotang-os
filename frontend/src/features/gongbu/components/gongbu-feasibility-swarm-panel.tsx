'use client';

/**
 * 工部通电 · PACK可行性会诊真链面板(2026-07-03)
 *
 * 与既有 GongbuPackSizingPanel(/api/court/gongbu/pack-sizing，同步单次POST)是两码事——
 * 这条走"点火拿trace_id→轮询/result"两段式协议，且**报价/成本/供应商/交期已被后端剥离**
 * (命门 stripProductionFields，§13.2#9)，只回定性可行性 + 锁字段名。禁编造数字，
 * 锁字段只能提示"已剥离，转后端军机处确认"。
 */
import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useSwarmDispatchPoll } from '@/features/shared/hooks/use-swarm-dispatch-poll';

const C = { warm: '#EAF3EE', dim: '#a7b3ac', faint: '#7a8a82', border: '#22402f', gong: '#7FC9A8', blue: '#4A82F0', amber: '#E5B84D', danger: '#E5847A' };

interface FeasibilityPollResult {
  status?: string;
  sourceLabel?: string;
  consult?: Record<string, unknown>;
  lockedProductionFields?: string[];
  qualityScore?: number | null;
  message?: string;
}

function labelMeta(sourceLabel: string | undefined): { text: string; color: string } {
  if (sourceLabel === 'LIVE_SWARM' || sourceLabel === 'LIVE') return { text: '真 · 后端 PACK 蜂群实算(已剥离产线资产)', color: C.gong };
  return { text: '降级 · 未验真，不返产出', color: C.amber };
}

export function GongbuFeasibilitySwarmPanel() {
  const [taskInput, setTaskInput] = useState('');
  const { state, dispatch } = useSwarmDispatchPoll<FeasibilityPollResult>(
    '/api/court/dept/gong-bu/feasibility',
    '/api/court/dept/gong-bu/feasibility/result',
  );

  const busy = state.phase === 'dispatching' || state.phase === 'polling';
  const canDispatch = taskInput.trim().length >= 4 && !busy;

  return (
    <div className="mt-3 rounded-[16px] border px-4 py-3.5" style={{ borderColor: `${C.gong}30`, background: `linear-gradient(180deg, ${C.gong}0c 0%, rgba(6,8,14,0.92) 100%)` }}>
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} style={{ color: C.gong }} />
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>PACK可行性会诊 · 定性版(报价/交期已剥离)</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.gong}44`, color: C.gong, background: `${C.gong}12` }}>工部真链</span>
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: C.faint }}>
        真派 jiqun pack_rd 蜂群会诊；成本/供应商/交期属产线资产，后端已剥离，只回定性可行性判断。
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void dispatch(taskInput.trim()); }}
          placeholder="如：60V 32Ah 三轮车电池包，-20℃低温启动，循环≥1500，是否可行"
          disabled={busy}
          className="min-w-[260px] flex-1 rounded-[9px] border bg-transparent px-3 py-2 text-[13px] outline-none disabled:opacity-60"
          style={{ borderColor: C.border, color: C.warm }}
        />
        <button
          type="button"
          onClick={() => void dispatch(taskInput.trim())}
          disabled={!canDispatch}
          className="inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-45"
          style={{ background: `linear-gradient(135deg, ${C.gong}, #4FA986)`, color: '#06110b' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {state.phase === 'dispatching' ? '派发中…' : state.phase === 'polling' ? '蜂群运行中…' : '派可行性会诊'}
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
          {state.result.consult && Object.keys(state.result.consult).length > 0 && (
            <ul className="mt-2 space-y-1">
              {Object.entries(state.result.consult).map(([k, v]) => (
                <li key={k} className="flex items-start gap-1.5 text-[11.5px]" style={{ color: C.dim }}>
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: C.blue }} />
                  <span><strong style={{ color: C.warm }}>{k}</strong>：{String(v)}</span>
                </li>
              ))}
            </ul>
          )}
          {state.result.lockedProductionFields && state.result.lockedProductionFields.length > 0 && (
            <p className="mt-2 text-[11px]" style={{ color: C.amber }}>
              已剥离(转后端军机处确认，不在此展示数字)：{state.result.lockedProductionFields.join('、')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
