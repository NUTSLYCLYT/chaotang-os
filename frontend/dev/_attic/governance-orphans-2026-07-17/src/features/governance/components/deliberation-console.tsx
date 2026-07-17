/**
 * 朝堂 OS · 三省审议台 · 实时控制台
 *
 * 给陛下三件事：
 *   1. 写一道旨意 + 添几条祖训
 *   2. 一键开三省 → 看中书草稿 / 门下驳议 / 尚书 step
 *   3. 落印归档（成功）或回中书重拟（驳）
 */

'use client';

import { useState } from 'react';
import { Crown, Gavel, ScrollText, ShieldAlert, Stamp, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { toast } from 'sonner';
import { backendFetch } from '@/lib/backend-api';
import type {
  Constitution,
  DeliberationResult,
} from '@/features/governance/lib/three-chamber-engine';

const STORAGE_KEY = 'courtos.governance.constitutions.v1';

const VERDICT_STYLE = {
  准: { color: '#3DD68C', bg: 'rgba(61,214,140,0.1)', border: 'rgba(61,214,140,0.45)', label: '准如所奏' },
  驳: { color: '#F43F5E', bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.45)', label: '驳回再拟' },
  再议: { color: '#F0C66A', bg: 'rgba(240,198,106,0.1)', border: 'rgba(240,198,106,0.45)', label: '搁置再议' },
} as const;

function loadConstitutions(): Constitution[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Constitution[]) : [];
  } catch {
    return [];
  }
}

function saveConstitutions(list: Constitution[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function DeliberationConsole() {
  const [command, setCommand] = useState('');
  const [constitutions, setConstitutions] = useState<Constitution[]>(() =>
    loadConstitutions(),
  );
  const [newClause, setNewClause] = useState('');
  const [result, setResult] = useState<DeliberationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [upstream, setUpstream] = useState<'live' | 'fallback' | null>(null);

  function pushConstitution() {
    if (newClause.trim().length < 4) {
      toast.error('祖训太短 · 至少 4 字');
      return;
    }
    const next: Constitution[] = [
      ...constitutions,
      {
        id: `c_${Date.now()}`,
        clause: newClause.trim(),
        severity: 'forbidden',
        scope: ['全局'],
        createdAt: new Date().toISOString(),
      },
    ];
    setConstitutions(next);
    saveConstitutions(next);
    setNewClause('');
  }

  function removeConstitution(id: string) {
    const next = constitutions.filter((c) => c.id !== id);
    setConstitutions(next);
    saveConstitutions(next);
  }

  async function deliberate() {
    if (command.trim().length < 5) {
      toast.error('旨意太短 · 至少 5 字');
      return;
    }
    setLoading(true);
    setResult(null);
    setUpstream(null);

    try {
      const res = await backendFetch('/api/governance/deliberate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim(), constitutions }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as DeliberationResult;
      setResult(data);
      setUpstream(res.headers.get('X-Upstream') === 'fallback' ? 'fallback' : 'live');

      // 弹落印动画
      if (data.finalVerdict === '准') {
        window.dispatchEvent(
          new CustomEvent('court:seal-stamp', {
            detail: { verdict: '准', note: '三省齐印' },
          }),
        );
      } else if (data.finalVerdict === '驳') {
        toast.error('门下省驳回', {
          description: data.menxia.violatedConstitutions.join(' / ') || data.menxia.reasoning,
        });
      } else {
        toast.warning('搁置再议', { description: data.menxia.reasoning });
      }
    } catch (err) {
      toast.error('审议失败', {
        description: err instanceof Error ? err.message : 'unknown',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* 左 · 输入区 */}
        <div className="space-y-4 lg:col-span-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">
              <Crown size={12} />
              陛下旨意
            </div>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例：明日全员加班并发奖金..."
              rows={5}
              className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[13px] leading-7 text-[#F5E9C9] placeholder:text-[#6A7299] focus:border-[#F0C66A]/50 focus:outline-none"
            />
            <button
              type="button"
              disabled={loading || command.trim().length < 5}
              onClick={deliberate}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-[#F0C66A]/45 bg-[#F0C66A]/12 py-2.5 text-[13px] font-bold tracking-[0.08em] text-[#F0C66A] transition hover:bg-[#F0C66A]/22 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  三省审议中...
                </>
              ) : (
                <>
                  <Gavel size={13} />
                  发交三省审议
                </>
              )}
            </button>
          </div>

          {/* 祖训 */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F43F5E]">
              <span className="flex items-center gap-2">
                <ShieldAlert size={12} />
                祖训 · {constitutions.length}
              </span>
              <span className="text-[#8A92AC] normal-case tracking-normal">
                门下省据此驳议
              </span>
            </div>

            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newClause}
                onChange={(e) => setNewClause(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && pushConstitution()}
                placeholder="新增一条祖训 · 如「不得强制员工加班」"
                className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-[12px] text-[#F5E9C9] placeholder:text-[#6A7299] focus:border-[#F43F5E]/45 focus:outline-none"
              />
              <button
                type="button"
                onClick={pushConstitution}
                className="rounded-md border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-3 py-1.5 text-[11px] font-semibold text-[#F43F5E] transition hover:bg-[#F43F5E]/20"
              >
                立祖训
              </button>
            </div>

            {constitutions.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {constitutions.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start gap-2 rounded-md border border-[#F43F5E]/20 bg-[#F43F5E]/[0.04] px-3 py-1.5"
                  >
                    <Sparkles size={11} className="mt-1 shrink-0 text-[#F43F5E]" />
                    <span
                      className="flex-1 text-[12px] text-[#E6DBBC]"
                      style={{ fontFamily: '"Noto Serif SC", serif' }}
                    >
                      {c.clause}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeConstitution(c.id)}
                      className="text-[#9AA3C4] hover:text-[#F43F5E]"
                      title="删除"
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 右 · 三省结果 */}
        <div className="lg:col-span-7">
          {!result && !loading && (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-10 text-center"
              style={{ minHeight: 320 }}
            >
              <ScrollText size={32} className="text-[#6A7299]" />
              <div className="text-[13px] text-[#9AA3C4]">
                朝堂三省 · 中书起草 · 门下驳议 · 尚书落地
              </div>
              <div className="text-[11px] text-[#6A7299]">
                左侧填旨意 · 立祖训 · 一键发审
              </div>
            </div>
          )}

          {loading && (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-[#F0C66A]/25 bg-[#F0C66A]/[0.04] p-10 text-center"
              style={{ minHeight: 320 }}
            >
              <Loader2 size={32} className="animate-spin text-[#F0C66A]" />
              <div className="text-[13px] text-[#F0C66A]">三省审议进行中...</div>
              <div className="text-[11px] text-[#8A92AC]">
                中书 → 门下 → 尚书
              </div>
            </div>
          )}

          {result && (
            <DeliberationResultCard result={result} upstream={upstream} />
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function DeliberationResultCard({
  result,
  upstream,
}: {
  result: DeliberationResult;
  upstream: 'live' | 'fallback' | null;
}) {
  const v = VERDICT_STYLE[result.finalVerdict];

  return (
    <div className="space-y-3">
      {/* 总结栏 */}
      <div
        className="flex items-center justify-between rounded-lg border px-4 py-3"
        style={{ borderColor: v.border, background: v.bg }}
      >
        <div className="flex items-center gap-3">
          <Stamp size={18} style={{ color: v.color }} />
          <div>
            <div
              className="text-[18px] font-black tracking-[0.16em]"
              style={{ color: v.color, fontFamily: '"Noto Serif SC", serif' }}
            >
              {result.finalVerdict} · {v.label}
            </div>
            <div className="text-[11px] tracking-[0.2em] text-[#8A92AC]">
              耗时 {result.totalMs}ms · {upstream === 'fallback' ? '上游降级' : '上游 LIVE'}
            </div>
          </div>
        </div>
      </div>

      {/* 中书省 */}
      <ChamberCard
        title="中书省 · 起草"
        accent="#F0C66A"
        body={
          <div>
            <p className="text-[12.5px] leading-7 text-[#E6DBBC]">{result.zhongshu.draft}</p>
            {result.zhongshu.benefits.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#3DD68C]">
                  三利
                </div>
                <ul className="mt-1 space-y-0.5">
                  {result.zhongshu.benefits.map((b, i) => (
                    <li key={i} className="text-[11.5px] text-[#C8CDD8]">
                      · {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.zhongshu.concerns.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#F43F5E]">
                  三虑
                </div>
                <ul className="mt-1 space-y-0.5">
                  {result.zhongshu.concerns.map((c, i) => (
                    <li key={i} className="text-[11.5px] text-[#C8CDD8]">
                      · {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />

      {/* 门下省 */}
      <ChamberCard
        title={`门下省 · 驳议 · ${result.menxia.verdict}`}
        accent={v.color}
        body={
          <div>
            <p
              className="text-[12.5px] leading-7"
              style={{ color: '#E6DBBC', fontFamily: '"Noto Serif SC", serif' }}
            >
              {result.menxia.reasoning}
            </p>
            {result.menxia.violatedConstitutions.length > 0 && (
              <div className="mt-2 rounded-md border border-[#F43F5E]/30 bg-[#F43F5E]/8 px-3 py-2">
                <div className="text-[11px] font-semibold tracking-[0.2em] text-[#F43F5E]">
                  违祖训
                </div>
                <ul className="mt-1 space-y-0.5">
                  {result.menxia.violatedConstitutions.map((c, i) => (
                    <li
                      key={i}
                      className="text-[12px] text-[#F5E9C9]"
                      style={{ fontFamily: '"Noto Serif SC", serif' }}
                    >
                      · {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.menxia.suggestedEdits.length > 0 && (
              <div className="mt-2 text-[11.5px] text-[#9AA3C4]">
                建议：{result.menxia.suggestedEdits.join(' · ')}
              </div>
            )}
          </div>
        }
      />

      {/* 尚书省 */}
      {result.shangshu && (
        <ChamberCard
          title="尚书省 · 落地"
          accent="#3DD68C"
          body={
            <div>
              <div className="flex items-center gap-3 text-[11.5px] text-[#9AA3C4]">
                <span>预计耗时 {Math.round(result.shangshu.etaMs / 60_000)} 分钟</span>
                <span>·</span>
                <span>分派 {result.shangshu.dispatchedTo.length} 部</span>
              </div>
              <ul className="mt-2 space-y-1">
                {result.shangshu.steps.map((step, i) => (
                  <li
                    key={step.id}
                    className="flex items-start gap-2 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2"
                  >
                    <span className="font-mono text-[11px] text-[#F0C66A]">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-[12px] font-semibold text-[#F5E9C9]">
                        {step.dept}
                      </div>
                      <div className="text-[11.5px] text-[#9AA3C4]">{step.action}</div>
                    </div>
                    <span
                      className="rounded-sm border px-1.5 py-0.5 text-[11px]"
                      style={{
                        borderColor:
                          step.blastRadius === 'high'
                            ? 'rgba(244,63,94,0.5)'
                            : step.blastRadius === 'medium'
                              ? 'rgba(240,198,106,0.5)'
                              : 'rgba(61,214,140,0.5)',
                        color:
                          step.blastRadius === 'high'
                            ? '#F43F5E'
                            : step.blastRadius === 'medium'
                              ? '#F0C66A'
                              : '#3DD68C',
                      }}
                    >
                      {step.blastRadius}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      )}
    </div>
  );
}

function ChamberCard({
  title,
  accent,
  body,
}: {
  title: string;
  accent: string;
  body: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{
        borderColor: `${accent}33`,
        background: `linear-gradient(135deg, ${accent}08, transparent)`,
      }}
    >
      <div
        className="text-[11.5px] font-semibold tracking-[0.18em]"
        style={{ color: accent, fontFamily: '"Noto Serif SC", serif' }}
      >
        {title}
      </div>
      <div className="mt-2">{body}</div>
    </div>
  );
}
