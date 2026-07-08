'use client';

/**
 * ChancellorColumn · 左栏 · 丞相
 * 立像 + 「辅政之臣 · 总揽要务」+ 今日建议列表（点条目 → 让丞相详解）
 * 底部：御前工作台快捷问丞相（→ 聚焦下旨框 · 问丞相模式）
 */

import { CheckCircle2, ChevronRight, CircleDashed, MessageSquareText, ShieldAlert } from 'lucide-react';

import type { ChancellorSuggestion } from '../types';
import { SHANGSHUFANG_ASSETS } from '../constants';
import { GlassPanel, PortraitBanner, PriorityTag } from './atoms';

const GOLD = '#F0C66A';
const MAX_CHANCELLOR_ITEMS = 3;

type ChancellorSeal = {
  label: '可裁' | '待补证' | '代办中';
  hint: string;
  color: string;
};

type ChancellorGate = {
  label: '上圣旨' | '丞相挡驾' | '交军机处';
  hint: string;
  color: string;
};

function approvalLabel(tag: string): string {
  if (/已办|代办|已处理|完成/.test(tag)) return '丞相已办';
  if (/待补|补证|证据不足/.test(tag)) return '待补证';
  if (/待确认|拟旨|待决策|待裁/.test(tag)) return '丞相审批';
  return '丞相汇报';
}

function compactDepartments(ministers?: string[]): string {
  if (!ministers?.length) return '丞相';
  return ministers.slice(0, 2).join(' / ');
}

function chancellorSealFor(s: ChancellorSuggestion): ChancellorSeal {
  const text = `${s.tag} ${s.title} ${s.whyNow ?? ''} ${(s.evidence ?? []).join(' ')}`;
  if (/已办|代办|已处理|完成/.test(text)) {
    return { label: '代办中', hint: '丞相可先办，向老板汇报结果。', color: '#7EC8E3' };
  }
  if (/待补|补证|证据不足|缺证|不完整|failed|失败|blocked|阻塞/.test(text) || (s.evidence?.length ?? 0) === 0) {
    return { label: '待补证', hint: '证据不足，不让老板猜。', color: '#F5A524' };
  }
  return { label: '可裁', hint: '证据和建议已压缩，可进入圣裁。', color: '#3DD68C' };
}

function gateFor(s: ChancellorSuggestion, seal: ChancellorSeal): ChancellorGate {
  const text = `${s.tag} ${s.title} ${s.whyNow ?? ''} ${(s.evidence ?? []).join(' ')}`;
  if (/冲突|会审|跨部门|军机|复核|法务|合同|付款|报价|客户承诺|违约|股权/.test(text)) {
    return { label: '交军机处', hint: '跨部门或高风险事项，先会审再上呈。', color: '#C2553D' };
  }
  if (seal.label === '待补证') {
    return { label: '丞相挡驾', hint: '退回补证，不占老板首屏。', color: '#F5A524' };
  }
  return { label: '上圣旨', hint: '保留在御前，老板可 90 秒内裁决。', color: '#3DD68C' };
}

function libuReviewForSwarm(s: ChancellorSuggestion): {
  label: '可呈报' | '需改写' | '禁外发';
  hint: string;
  color: string;
} | null {
  const source = s.sourceLabel ?? '';
  const text = `${s.tag} ${s.whyNow ?? ''} ${(s.evidence ?? []).join(' ')}`.toLowerCase();
  const isSwarm = /jiqun_ai|蜂群|工部校准/.test(source) || /蜂群/.test(s.tag);
  if (!isSwarm) return null;

  if (/failed|执行失败|blocked|阻塞|发布闸 blocked|synthetic|样本|不完整|待补全/.test(text)) {
    return {
      label: '禁外发',
      hint: '仅可复核/补证/重跑，不得直接作为对外结论。',
      color: '#F43F5E',
    };
  }
  if (/待复核|需复核|证据不足|改写|缺证|release_gate/.test(text)) {
    return {
      label: '需改写',
      hint: '先由礼部压缩成老板语言，再补证或交刑部复核。',
      color: '#F0C66A',
    };
  }
  return {
    label: '可呈报',
    hint: '可进入内部呈报；对外发布仍需版权/承诺复核。',
    color: '#3DD68C',
  };
}

export function ChancellorColumn({
  suggestions,
  onSelect,
  onQuickAsk,
  onMizhi,
  activeId,
  showQuickAsk = true,
  flush = false,
  emptyHint = '暂无今日要务。下旨后形成的蜂群会话会回到这里。',
}: {
  suggestions: ChancellorSuggestion[];
  onSelect: (s: ChancellorSuggestion) => void;
  onQuickAsk: () => void;
  onMizhi?: (text: string, source: 'chancellor') => void;
  activeId?: string;
  showQuickAsk?: boolean;
  emptyHint?: string;
  flush?: boolean;
}) {
  const visibleSuggestions = suggestions.slice(0, MAX_CHANCELLOR_ITEMS);
  const hiddenCount = Math.max(suggestions.length - visibleSuggestions.length, 0);
  return (
    <GlassPanel accent={GOLD} className={flush ? 'h-full border-y-0' : 'h-full'} flush={flush}>
      {!flush && <PortraitBanner
        portrait={SHANGSHUFANG_ASSETS.portraitChancellor}
        name="丞相"
        duty="辅政之臣 · 总揽要务"
        objectPosition="center top"
        accent={GOLD}
      />}

      {!flush && <div
        className="mx-4 mb-1 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}40, transparent)` }}
        aria-hidden
      />}

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        <div className="mb-1 flex items-center gap-2 px-1">
          <span className="text-[8px] text-[#8A6A2A]" aria-hidden>◆</span>
          <span className="text-[10px] font-medium tracking-[0.08em] text-[#B6AB8C]">丞相判断 · 今日最需要处理的三件事</span>
          <span className="h-px flex-1 bg-gradient-to-r from-[#F0C66A]/25 to-transparent" aria-hidden />
        </div>
        {visibleSuggestions.length === 0 ? (
          <div className="rounded-lg border border-[#F0C66A]/12 bg-[#F0C66A]/[0.025] px-3 py-4 text-[11px] leading-[1.7] text-[#9AA3C4]">
            {emptyHint}
          </div>
        ) : visibleSuggestions.map((s, index) => {
          const featured = s.id === activeId;
          const primary = index === 0;
          const libuReview = libuReviewForSwarm(s);
          const seal = chancellorSealFor(s);
          const gate = gateFor(s, seal);
          return (
            <button
              key={s.id}
              type="button"
              data-testid="chancellor-visible-item"
              onClick={() => onSelect(s)}
              aria-current={featured ? 'true' : undefined}
              className={`group relative flex w-full items-start gap-2 rounded-lg border text-left transition-all ${
                featured
                  ? 'border-[#F0C66A]/32 bg-[#F0C66A]/[0.065]'
                  : 'border-transparent hover:border-[#F0C66A]/20 hover:bg-[#F0C66A]/[0.04]'
              } ${primary ? 'px-3 py-2.5' : 'px-2.5 py-[7px]'}`}
              style={{
                background: featured
                  ? undefined
                  : primary
                    ? 'linear-gradient(180deg, rgba(240,198,106,0.035), rgba(5,7,13,0.08))'
                    : undefined,
              }}
            >
              {featured && (
                <span
                  className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r"
                  style={{ background: '#F0C66A', boxShadow: '0 0 6px rgba(240,198,106,0.6)' }}
                  aria-hidden
                />
              )}
              <div className="flex shrink-0 flex-col items-center gap-1">
                <PriorityTag priority={s.priority} />
                {primary && (
                  <span className="[writing-mode:vertical-rl] text-[8px] font-bold tracking-[0.18em] text-[#8F835F]" style={{ fontFamily: 'var(--font-serif)' }}>
                    首札
                  </span>
                )}
              </div>
              <span className="min-w-0 flex-1">
                {primary && libuReview && (
                  <span
                    className="mb-1 inline-flex max-w-full items-center rounded-md border px-2 py-0.5"
                    style={{
                      borderColor: `${libuReview.color}38`,
                      background: `linear-gradient(90deg, ${libuReview.color}14, rgba(5,7,13,0.12))`,
                    }}
                  >
                    <span
                      className="shrink-0 rounded border px-1.5 py-0.5 text-[8.5px] font-semibold tracking-[0.08em]"
                      style={{
                        borderColor: `${libuReview.color}55`,
                        color: libuReview.color,
                        background: `${libuReview.color}12`,
                      }}
                    >
                      礼部审稿 · {libuReview.label}
                    </span>
                  </span>
                )}
                <span
                  className={`block transition-colors ${primary ? 'text-[13px] leading-[1.45]' : 'text-[11.5px] leading-[1.35]'} ${featured ? 'text-[#F5E9C9]' : 'text-[#EAEEFB] group-hover:text-[#F5E9C9]'}`}
                  style={{
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 700,
                    letterSpacing: primary ? '0.035em' : '0.015em',
                  }}
                >
                  {s.title}
                </span>
                <span className={`mt-1 flex min-w-0 items-center gap-1.5 ${primary ? 'flex-wrap' : 'overflow-hidden'}`}>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold"
                    title={seal.hint}
                    style={{ borderColor: `${seal.color}46`, background: `${seal.color}12`, color: seal.color }}
                  >
                    {seal.label === '可裁' ? <CheckCircle2 size={10} /> : seal.label === '待补证' ? <ShieldAlert size={10} /> : <CircleDashed size={10} />}
                    {seal.label}
                  </span>
                  <span
                    className="min-w-0 truncate rounded border px-1.5 py-0.5 text-[9px]"
                    title={gate.hint}
                    style={{ borderColor: `${gate.color}36`, background: `${gate.color}0F`, color: gate.color }}
                  >
                    {primary ? `${gate.label} · ${gate.hint}` : gate.label}
                  </span>
                </span>
                {primary && (
                  <>
                    <span className="mt-1 flex flex-wrap items-center gap-1 text-[9px] tracking-[0.06em]">
                      <span className="rounded border border-[#F0C66A]/16 bg-[#F0C66A]/[0.045] px-1.5 py-0.5 text-[#D9C79A]">
                        {compactDepartments(s.recommendedMinisters)}
                      </span>
                      <span className="rounded border border-[#3DD68C]/18 bg-[#3DD68C]/[0.055] px-1.5 py-0.5 text-[#B9F6D2]">
                        {approvalLabel(s.tag)}
                      </span>
                    </span>
                    {s.whyNow && (
                      <span className="mt-1 block truncate text-[9.5px] leading-[1.45] text-[#8F98B8]">
                        {s.whyNow}
                      </span>
                    )}
                  </>
                )}
              </span>
              {onMizhi && (
                <span
                  role="button"
                  aria-label={`密旨：${s.title}`}
                  onClick={(e) => { e.stopPropagation(); onMizhi(s.title, 'chancellor'); }}
                  className="flex-shrink-0 cursor-pointer rounded px-1 py-0.5 text-[8px] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: '#C0392B', border: '1px solid rgba(192,57,43,0.4)', fontFamily: 'var(--font-serif)' }}
                >
                  密
                </span>
              )}
              <ChevronRight size={14} className={`flex-shrink-0 transition-colors ${featured ? 'text-[#F0C66A]' : 'text-[#5a5340] group-hover:text-[#F0C66A]'}`} />
            </button>
          );
        })}
        {hiddenCount > 0 && (
          <div className="px-1 pt-1 text-[9px] tracking-[0.08em] text-[#6A7299]">
            另 {hiddenCount} 件已入丞相后台，不占御前首屏。
          </div>
        )}
      </div>

      {showQuickAsk && <ChancellorAssistantDecisionButton onClick={onQuickAsk} className="m-3 mt-1" />}
    </GlassPanel>
  );
}

export function ChancellorAssistantDecisionButton({
  onClick,
  active = false,
  className = '',
  testId,
}: {
  onClick: () => void;
  active?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all hover:border-[#F0C66A]/40 hover:bg-[#F0C66A]/[0.07] ${
        active ? 'border-[#F0C66A]/48 bg-[#F0C66A]/[0.09]' : 'border-[#F0C66A]/18 bg-[#F0C66A]/[0.035]'
      } ${className}`}
    >
      <MessageSquareText size={14} className="flex-shrink-0 text-[#F0C66A]/80" />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium tracking-[0.08em] text-[#B6AB8C]">问丞相</span>
        <span className="block truncate text-[11.5px] text-[#C6BB9D]">
          打开御前 IM，先请丞相判断一事
        </span>
      </span>
      <ChevronRight size={13} className="flex-shrink-0 text-[#5a5340] transition-colors group-hover:text-[#F0C66A]" />
    </button>
  );
}
