'use client';

/**
 * 刑部通电 · 法律会诊真链面板(2026-07-03)
 *
 * 唯一带命门约束的真链接入:后端 classifyLegalOutput 把产出分两类——定性字段(consult，可读)
 * 与后果性字段(consequentialFields：违约金/独家/诉讼/对外立场，humanConfirmationRequired=true)。
 * 前端在此**禁止**为后果性字段提供任何"一键采纳/确认"按钮，只能只读展示 + 显眼标"需人工/法务
 * 确认"，避免绕开后端已设的顶层单点裁决门(Russell:自动执行授权红线，§13.2#5/§8.7)。
 */
import { useState } from 'react';
import { Loader2, Scale, ShieldAlert } from 'lucide-react';
import { useSwarmDispatchPoll } from '@/features/shared/hooks/use-swarm-dispatch-poll';
import { ACCENT } from '@/features/xingbu/lib/xingbu-roster';

const C = { warm: '#EEDDD6', dim: '#b3a19b', faint: '#8a7a75', border: `${ACCENT}30`, live: '#7FC9A8', amber: '#E5B84D', danger: '#E5847A' };

interface LegalFieldGate {
  field: string;
  body: string;
  humanConfirmationRequired: boolean;
  triggers: string[];
}

interface LegalPollResult {
  status?: string;
  sourceLabel?: string;
  consult?: Record<string, string>;
  consequentialFields?: LegalFieldGate[];
  humanConfirmationRequired?: boolean;
  message?: string;
}

function labelMeta(sourceLabel: string | undefined): { text: string; color: string } {
  if (sourceLabel === 'LIVE_SWARM' || sourceLabel === 'LIVE') return { text: '真 · 后端法务蜂群实算', color: C.live };
  return { text: '降级 · 未验真，不返产出', color: C.amber };
}

export function XingbuLegalSwarmPanel() {
  const [taskInput, setTaskInput] = useState('');
  const { state, dispatch } = useSwarmDispatchPoll<LegalPollResult>(
    '/api/court/dept/xing-bu/legal',
    '/api/court/dept/xing-bu/legal/result',
  );

  const busy = state.phase === 'dispatching' || state.phase === 'polling';
  const canDispatch = taskInput.trim().length >= 4 && !busy;

  return (
    <div className="mt-3 rounded-[16px] border px-4 py-3.5" style={{ borderColor: C.border, background: `linear-gradient(180deg, ${ACCENT}10 0%, rgba(6,8,14,0.92) 100%)` }}>
      <div className="flex items-center gap-2">
        <Scale size={14} style={{ color: ACCENT }} />
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>进阶：派真法务蜂群会诊</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.live}44`, color: C.live, background: `${C.live}12` }}>刑部真链</span>
      </div>
      <p className="mt-1 text-[11.5px]" style={{ color: C.faint }}>
        上面是本地条款扫描；这里真派后端法务蜂群深度会诊。违约金/独家/诉讼等后果性条款只读展示，禁一键采纳。
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void dispatch(taskInput.trim()); }}
          placeholder="如：这份独家供货协议有没有法律风险，重点看违约金和解约条款"
          disabled={busy}
          className="min-w-[260px] flex-1 rounded-[9px] border bg-transparent px-3 py-2 text-[13px] outline-none disabled:opacity-60"
          style={{ borderColor: C.border, color: C.warm }}
        />
        <button
          type="button"
          onClick={() => void dispatch(taskInput.trim())}
          disabled={!canDispatch}
          className="inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition disabled:opacity-45"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #B5786B)`, color: '#1a0d0a' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
          {state.phase === 'dispatching' ? '派发中…' : state.phase === 'polling' ? '蜂群运行中…' : '派法务蜂群'}
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

          {/* 定性字段:可读,无采纳限制 */}
          {state.result.consult && Object.keys(state.result.consult).length > 0 && (
            <ul className="mt-2 space-y-1">
              {Object.entries(state.result.consult).map(([k, v]) => (
                <li key={k} className="flex items-start gap-1.5 text-[11.5px]" style={{ color: C.dim }}>
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: ACCENT }} />
                  <span><strong style={{ color: C.warm }}>{k}</strong>：{v}</span>
                </li>
              ))}
            </ul>
          )}

          {/* 后果性字段:只读展示,禁一键采纳(命门) */}
          {state.result.consequentialFields && state.result.consequentialFields.length > 0 && (
            <div className="mt-3 rounded-[10px] border px-3 py-2.5" style={{ borderColor: `${C.danger}40`, background: `${C.danger}0a` }}>
              <div className="flex items-center gap-1.5">
                <ShieldAlert size={13} style={{ color: C.danger }} />
                <span className="text-[11px] font-semibold" style={{ color: C.danger }}>
                  后果性条款(需人工/法务确认，此处只读，不提供一键采纳)
                </span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {state.result.consequentialFields.map((f) => (
                  <li key={f.field} className="text-[11.5px]" style={{ color: C.dim }}>
                    <strong style={{ color: C.warm }}>{f.field}</strong>：{f.body}
                    {f.triggers.length > 0 && (
                      <span className="ml-1 text-[10px]" style={{ color: C.amber }}>
                        (触发：{f.triggers.join('、')})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
