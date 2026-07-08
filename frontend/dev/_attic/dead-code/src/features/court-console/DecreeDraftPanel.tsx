'use client';

/**
 * 拟旨面板 · 快捷下旨
 *
 * 流程：
 *   1. 陛下输入命令文本 → 点击"拟旨"
 *   2. chaotang.decreeDraft(text) → 返回 recommendedCategories
 *   3. 陛下勾选分类（多选）或开启"全朝会审"
 *   4. 点击"下旨" → chaotang.decreeDispatch → 跳转 /command-center?task=...
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GlassPanel } from '@/components/GlassPanel';
import { chaotang } from '@/lib/api/chaotang';
import { AGENT_META } from '@/lib/contracts/agent';
import type { AgentCode } from '@/lib/contracts/agent';
import type { DecreeDraft, RecommendedCategory, CategorySelection } from '@/lib/contracts/decree';

/* --------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

function getAgentName(code: string): string {
  return AGENT_META[code as AgentCode]?.nameCn ?? code;
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return '#3DD68C';
  if (c >= 0.6) return '#F0C66A';
  return '#F43F5E';
}

/* --------------------------------------------------------------------------
 * Main component
 * -------------------------------------------------------------------------- */

export function DecreeDraftPanel() {
  const router = useRouter();

  const [command, setCommand] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<DecreeDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [councilAll, setCouncilAll] = useState(false);

  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── 拟旨 ── */
  const handleDraft = async () => {
    const cmd = command.trim();
    if (!cmd) return;

    setDrafting(true);
    setDraftError(null);
    setDraft(null);
    setSelected(new Set());
    setCouncilAll(false);
    setDispatchError(null);

    try {
      const result = await chaotang.decreeDraft(cmd);
      setDraft(result);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : '拟旨失败，请稍后再试');
    } finally {
      setDrafting(false);
    }
  };

  /* ── 分类切换 ── */
  const toggleCategory = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── 下旨 ── */
  const handleDispatch = async () => {
    if (!draft) return;
    if (!councilAll && selected.size === 0) return;

    setDispatching(true);
    setDispatchError(null);

    try {
      const selectedCategories: CategorySelection[] = (
        draft.recommendedCategories.filter((cat: RecommendedCategory) => selected.has(cat.id))
      ).map((cat: RecommendedCategory) => ({
        taskType: cat.taskType,
        ministers: cat.ministers,
        groups: cat.groups,
        label: cat.label,
      }));

      const result = await chaotang.decreeDispatch({
        rawCommand: command.trim(),
        intent: draft.intent,
        selectedCategories,
        councilAll,
      });

      router.push(`/command-center?task=${encodeURIComponent(result.taskId)}`);
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : '下旨失败，请稍后再试');
    } finally {
      setDispatching(false);
    }
  };

  const canDispatch = !!draft && (councilAll || selected.size > 0) && !dispatching;

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      {/* Header */}
      <div className="mb-4">
        <p className="section-eyebrow">Quick Decree · 快捷下旨</p>
        <h2 className="section-title gold-text mt-1 text-[18px]">拟旨 · 选分类 · 下旨</h2>
        <p
          className="mt-1 text-[11.5px] leading-5"
          style={{ color: '#9AA3C4' }}
        >
          输入旨意，AI 拟稿并推荐召集哪些部门执行；陛下确认后即可发出诏令。
        </p>
      </div>

      {/* 输入区 */}
      <div className="space-y-3">
        <textarea
          ref={textareaRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleDraft();
            }
          }}
          placeholder="请输入旨意，例如：分析 NVIDIA 当前估值，给出投资建议…"
          rows={3}
          className="w-full resize-none rounded-lg px-3 py-2.5 text-[13px] leading-relaxed outline-none transition-colors"
          style={{
            background: 'rgba(10,14,30,0.6)',
            border: '1px solid rgba(240,198,106,0.25)',
            color: '#EAEEFB',
            fontFamily: 'var(--font-sans)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(240,198,106,0.55)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(240,198,106,0.25)';
          }}
          disabled={drafting || dispatching}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px]" style={{ color: '#484F72' }}>
            ⌘ + ↵ 快速拟旨
          </p>
          <button
            type="button"
            onClick={() => void handleDraft()}
            disabled={!command.trim() || drafting || dispatching}
            className="rounded-lg px-5 py-2 text-[13px] font-bold tracking-[0.1em] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #D4A84B 0%, #F0C66A 100%)',
              color: '#0a0704',
              fontFamily: 'var(--font-serif)',
              boxShadow: '0 0 0 1px rgba(240,198,106,0.4), 0 4px 16px rgba(240,198,106,0.2)',
            }}
          >
            {drafting ? '拟旨中…' : '拟旨'}
          </button>
        </div>
      </div>

      {/* Draft error */}
      {draftError && (
        <div
          className="mt-3 rounded-lg px-3 py-2.5 text-[12px]"
          style={{
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.3)',
            color: '#F43F5E',
          }}
        >
          拟旨出错：{draftError}
        </div>
      )}

      {/* Drafting skeleton */}
      {drafting && (
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg"
              style={{ background: 'rgba(240,198,106,0.05)' }}
            />
          ))}
        </div>
      )}

      {/* Draft result */}
      {draft && !drafting && (
        <div className="mt-4 space-y-4">
          {/* 草旨预览 */}
          {draft.draft && (
            <div
              className="rounded-lg px-4 py-3 text-[12.5px] leading-relaxed italic"
              style={{
                background: 'rgba(240,198,106,0.04)',
                border: '1px solid rgba(240,198,106,0.18)',
                color: '#C8CDD8',
                fontFamily: 'var(--font-serif)',
              }}
            >
              <span className="not-italic text-[10px] uppercase tracking-[0.2em] block mb-1.5" style={{ color: '#8f835f' }}>
                草旨
              </span>
              {draft.draft}
            </div>
          )}

          {/* 分类选择 */}
          {draft.recommendedCategories.length > 0 && (
            <div>
              <p
                className="mb-2.5 text-[11px] uppercase tracking-[0.2em]"
                style={{ color: '#8f835f' }}
              >
                推荐分类 · 请选择执行路线
              </p>
              <div className="space-y-2.5">
                {draft.recommendedCategories.map((cat: RecommendedCategory) => {
                  const isSelected = selected.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full text-left rounded-xl px-4 py-3 transition-all"
                      style={{
                        background: isSelected
                          ? 'rgba(240,198,106,0.10)'
                          : 'rgba(10,14,30,0.5)',
                        border: `1px solid ${isSelected ? 'rgba(240,198,106,0.5)' : 'rgba(240,198,106,0.15)'}`,
                        boxShadow: isSelected ? '0 0 12px rgba(240,198,106,0.12)' : 'none',
                      }}
                      disabled={dispatching}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Label + confidence */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[13px] font-semibold"
                              style={{
                                color: isSelected ? '#F0C66A' : '#EAEEFB',
                                fontFamily: 'var(--font-serif)',
                              }}
                            >
                              {cat.label}
                            </span>
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                              style={{
                                background: `${confidenceColor(cat.confidence)}18`,
                                color: confidenceColor(cat.confidence),
                              }}
                            >
                              {Math.round(cat.confidence * 100)}%
                            </span>
                          </div>

                          {/* Description */}
                          <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: '#9AA3C4' }}>
                            {cat.description}
                          </p>

                          {/* Ministers chips */}
                          {cat.ministers && cat.ministers.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span
                                className="text-[9px] uppercase tracking-[0.15em] self-center"
                                style={{ color: '#6A7299' }}
                              >
                                拟召
                              </span>
                              {cat.ministers.map((code) => (
                                <span
                                  key={code}
                                  className="rounded-full px-2 py-0.5 text-[10px]"
                                  style={{
                                    background: 'rgba(107,160,255,0.12)',
                                    border: '1px solid rgba(107,160,255,0.3)',
                                    color: '#6BA0FF',
                                  }}
                                >
                                  {getAgentName(code)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Groups */}
                          {cat.groups && cat.groups.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span
                                className="text-[9px] uppercase tracking-[0.15em] self-center"
                                style={{ color: '#6A7299' }}
                              >
                                涉组
                              </span>
                              {cat.groups.map((g) => (
                                <span
                                  key={g}
                                  className="rounded-full px-2 py-0.5 text-[10px]"
                                  style={{
                                    background: 'rgba(167,139,250,0.10)',
                                    border: '1px solid rgba(167,139,250,0.25)',
                                    color: '#A78BFA',
                                  }}
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* KB Citations */}
                          {cat.citations && cat.citations.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {cat.citations.slice(0, 2).map((cit, idx) => (
                                <div
                                  key={idx}
                                  className="rounded px-2 py-1.5 text-[10.5px] leading-relaxed"
                                  style={{
                                    background: 'rgba(61,214,140,0.04)',
                                    border: '1px solid rgba(61,214,140,0.12)',
                                    color: '#9AA3C4',
                                  }}
                                >
                                  <span style={{ color: '#3DD68C' }}>[{cit.source}]</span>{' '}
                                  {cit.snippet}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Checkbox indicator */}
                        <div
                          className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center mt-0.5"
                          style={{
                            background: isSelected
                              ? 'rgba(240,198,106,0.9)'
                              : 'rgba(10,14,30,0.8)',
                            border: `1.5px solid ${isSelected ? '#F0C66A' : 'rgba(240,198,106,0.3)'}`,
                          }}
                        >
                          {isSelected && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path
                                d="M1 3.5L3.8 6.5L9 1"
                                stroke="#0a0704"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 全朝会审 toggle */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition-all"
            style={{
              background: councilAll ? 'rgba(107,160,255,0.08)' : 'rgba(10,14,30,0.4)',
              border: `1px solid ${councilAll ? 'rgba(107,160,255,0.4)' : 'rgba(107,160,255,0.15)'}`,
            }}
            onClick={() => setCouncilAll((v) => !v)}
            role="checkbox"
            aria-checked={councilAll}
          >
            <div>
              <p className="text-[13px] font-semibold" style={{ color: councilAll ? '#6BA0FF' : '#EAEEFB' }}>
                全朝会审
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#6A7299' }}>
                召集全体臣工共同议决，适用于重大国事
              </p>
            </div>
            <div
              className="h-5 w-9 rounded-full transition-all relative flex-shrink-0"
              style={{
                background: councilAll ? 'rgba(107,160,255,0.7)' : 'rgba(26,33,66,0.8)',
                border: `1px solid ${councilAll ? 'rgba(107,160,255,0.8)' : 'rgba(26,33,66,0.9)'}`,
              }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
                style={{
                  background: councilAll ? '#6BA0FF' : '#484F72',
                  left: councilAll ? 'calc(100% - 1.1rem)' : '2px',
                }}
              />
            </div>
          </div>

          {/* Dispatch error */}
          {dispatchError && (
            <div
              className="rounded-lg px-3 py-2.5 text-[12px]"
              style={{
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.3)',
                color: '#F43F5E',
              }}
            >
              下旨出错：{dispatchError}
            </div>
          )}

          {/* 下旨 button */}
          <button
            type="button"
            onClick={() => void handleDispatch()}
            disabled={!canDispatch}
            className="w-full rounded-xl py-3 text-[15px] font-black tracking-[0.15em] transition-all hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
            style={{
              background: canDispatch
                ? 'linear-gradient(135deg, #D4A84B 0%, #F0C66A 50%, #8A6A2A 100%)'
                : 'rgba(26,33,66,0.6)',
              color: canDispatch ? '#0a0704' : '#484F72',
              fontFamily: 'var(--font-serif)',
              boxShadow: canDispatch ? '0 0 0 1px rgba(240,198,106,0.5), 0 8px 24px rgba(240,198,106,0.25)' : 'none',
            }}
          >
            {dispatching ? '下旨传达中…' : '下旨'}
          </button>

          {!councilAll && selected.size === 0 && (
            <p className="text-center text-[11px]" style={{ color: '#484F72' }}>
              请选择至少一个分类，或开启"全朝会审"
            </p>
          )}
        </div>
      )}
    </GlassPanel>
  );
}
