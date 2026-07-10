'use client';

/**
 * DecreeInput · 底部 · 御前·下旨
 * 视觉参考史馆「太史馆」底部 Dock（金线 + glass 收纳条），
 * 业务逻辑不变：三模式 问丞相(ask)/发布圣旨(order)/密旨(secret)、状态机、门下省存疑、
 * 计数器。Enter 发送（Shift+Enter 换行）。
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { FileText, Lock, Paperclip, Scroll, X } from 'lucide-react';

import type { DecreeMode, DecreeState } from '../types';
import type { DepartmentSourceLabel } from '@/components/chaotang/department/DepartmentScrollStage';

export type AskTarget = 'chancellor' | 'mentor';

const GOLD = '#F0C66A';
const SECRET = '#E8A38C'; // 密旨态:暖红金(暗底上的機密色)
const MODE_OPTIONS: Array<{
  key: 'order' | 'secret';
  mode: DecreeMode;
  askTarget?: AskTarget;
  label: string;
  icon: 'order' | 'secret';
  title: string;
}> = [
  { key: 'order', mode: 'order', label: '下旨', icon: 'order', title: '下旨 · 先进入拟旨，准奏后才启动后端蜂群' },
  { key: 'secret', mode: 'secret', label: '密旨', icon: 'secret', title: '密旨 · 先生成密旨稿，人工确认后才全朝并奏' },
];

function dispatchImperialActionAccepted() {
  window.dispatchEvent(new CustomEvent('chaotang:imperial-action-accepted'));
  window.dispatchEvent(new CustomEvent('chaotang:scroll-action-seal'));
}

function normalizeSourceLabel(value?: string): DepartmentSourceLabel {
  const text = (value ?? '').toUpperCase();
  if (text.includes('LIVE')) return 'LIVE';
  if (text.includes('FALLBACK')) return 'FALLBACK';
  if (text.includes('DEMO')) return 'DEMO';
  if (text.includes('PRIMARY') || text.includes('真源')) return 'LIVE';
  if (text.includes('降级')) return 'FALLBACK';
  if (text.includes('演示') || text.includes('静态')) return 'DEMO';
  return 'MIXED';
}

interface DecreeContext {
  title: string;
  evidenceLabel: string;
  nextDepartments: string;
  readiness: string;
  sourceLabel?: string;
}

export interface DecreeChatMessage {
  id: string;
  role: 'user' | 'assistant';
  label: string;
  text: string;
  time: string;
}

export interface DecreeAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  knowledgeId?: string;
  contentExcerpt?: string;
  contentChars?: number;
  archiveHref?: string;
  source?: 'ima_knowledge';
}

export function DecreeInput({
  value,
  onChange,
  mode,
  askTarget = 'chancellor',
  onModeChange,
  onAskTargetChange,
  onSend,
  onPolish,
  onClose,
  state,
  message,
  inputRef,
  menxiaRejected,
  menxiaMissingItems,
  onMenxiaAction,
  context,
  showContext = true,
  onInputFocusChange,
  availableModes = ['ask', 'order', 'secret'],
  attachments = [],
  onAddAttachments,
  onRemoveAttachment,
  bottomOffset = 'calc(32px + env(safe-area-inset-bottom))',
  placement = 'fixed',
}: {
  value: string;
  onChange: (v: string) => void;
  mode: DecreeMode;
  askTarget?: AskTarget;
  onModeChange: (m: DecreeMode) => void;
  onAskTargetChange?: (target: AskTarget) => void;
  onSend: (modeOverride?: DecreeMode, targetOverride?: AskTarget) => void;
  onPolish?: () => void;
  onClose?: () => void;
  state: DecreeState;
  message: string | null;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  suggestions?: string[];
  onSuggestionClick?: (s: string) => void;
  menxiaRejected?: boolean;
  menxiaMissingItems?: string[];
  onMenxiaAction?: (action: string) => void;
  advisorItems?: Array<{ label: string; title: string; body: string; onClick?: () => void }>;
  navItems?: Array<{ label: string; hint: string; onClick: () => void }>;
  context?: DecreeContext;
  /** 是否显示「当前裁决对象」上下文卡（上书房按用户要求隐藏，默认显示） */
  showContext?: boolean;
  /** 输入框聚焦态回传；textarea 只保留当前输入，不承载历史。 */
  onInputFocusChange?: (focused: boolean) => void;
  /** 允许展示的模式按钮，默认 ['ask','order','secret']。传 ['order'] 时只显示"旨"按钮。 */
  availableModes?: DecreeMode[];
  /** 用户补证附件。当前仅接收文本材料，上传后作为 IMA 知识库证据上下文。 */
  attachments?: DecreeAttachment[];
  onAddAttachments?: (files: File[]) => void | Promise<void>;
  onRemoveAttachment?: (id: string) => void;
  bottomOffset?: string;
  placement?: 'fixed' | 'slot';
}) {
  const fileInputId = useId();
  const isComposingRef = useRef(false);
  const lastFocusedModeRef = useRef<string | null>(null);
  const polishPulseTimerRef = useRef<number | null>(null);
  const [localValue, setLocalValue] = useState(value);
  const [polishPressed, setPolishPressed] = useState(false);
  const visibleModeOptions = MODE_OPTIONS.filter(m => availableModes.includes(m.mode));
  const singleMode = visibleModeOptions.length === 1;
  const isAsk = mode === 'ask';
  const isOrder = mode === 'order';
  const isSecret = mode === 'secret';
  const isMentorAsk = isAsk && askTarget === 'mentor';
  const inSlot = placement === 'slot';
  const showPolishActive = polishPressed;
  const busy = state === 'consulting';
  const accent = isSecret ? SECRET : GOLD;
  const modeLabel = isSecret
    ? '密旨草案润色'
    : isOrder
      ? '圣旨草案润色'
      : isMentorAsk
        ? '问钦天监'
        : '先问丞相补判断';
  useEffect(() => {
    if (isComposingRef.current) return;
    setLocalValue(value);
  }, [value]);
  useEffect(() => () => {
    if (polishPulseTimerRef.current !== null) window.clearTimeout(polishPulseTimerRef.current);
  }, []);

  const remaining = 2000 - localValue.length;
  const attachmentCount = attachments.length;

  const msgColor = state === 'error' ? '#7A241E' : '#3f2c12';
  const msgBorder =
    state === 'error' ? 'rgba(122,36,30,0.38)' : 'rgba(120,90,40,0.38)';
  const contextTitle = context?.title ?? '今日一号奏折';
  const contextEvidence = context?.evidenceLabel ?? '证据待核';
  const contextDepartments = context?.nextDepartments ?? '丞相先拆，六部承办';
  const contextReadiness = context?.readiness ?? '待裁';
  const hasDraft = localValue.trim().length >= 2;
  const advisorPreview = hasDraft
    ? isMentorAsk
      ? `钦天监预判：先拆下一步与风险边界，必要时再转丞相会审或正式下旨。`
      : `丞相预判：将召 ${contextDepartments}；${contextEvidence}；提交后先进入拟旨，${isOrder || isSecret ? '准奏后' : '会审后'}进入${isOrder ? '军机执行' : isSecret ? '全司密报' : '群臣会审'}。`
    : isMentorAsk
      ? '钦天监：不确定下一步时，先问清目标、证据缺口和可执行动作。'
      : null;
  const modeStatusText = attachmentCount > 0
    ? advisorPreview
      ? `已附补证 ${attachmentCount} 份 · ${advisorPreview}`
      : `已附补证 ${attachmentCount} 份`
    : advisorPreview;
  const handlePrimarySubmit = (modeOverride = mode, targetOverride = askTarget) => {
    const command = (inputRef?.current?.value ?? localValue).trim();
    dispatchImperialActionAccepted();
    window.dispatchEvent(new CustomEvent('shangshufang:decree-submit', {
      detail: { command, mode: modeOverride, askTarget: targetOverride },
    }));
    onSend(modeOverride, targetOverride);
  };
  const handleModeButtonClick = (item: (typeof MODE_OPTIONS)[number]) => {
    const nextAskTarget = item.askTarget ?? 'chancellor';
    setPolishPressed(false);
    lastFocusedModeRef.current = item.key;
    onModeChange(item.mode);
    if (item.mode === 'ask') onAskTargetChange?.(nextAskTarget);
    window.requestAnimationFrame(() => inputRef?.current?.focus());

    const command = (inputRef?.current?.value ?? localValue).trim();
    if (item.mode === 'ask' && command.length >= 2) handlePrimarySubmit(item.mode, nextAskTarget);
  };
  const handlePolishClick = () => {
    setPolishPressed(true);
    if (polishPulseTimerRef.current !== null) window.clearTimeout(polishPulseTimerRef.current);
    polishPulseTimerRef.current = window.setTimeout(() => {
      setPolishPressed(false);
      polishPulseTimerRef.current = null;
    }, 720);
    onPolish?.();
  };
  const isImeCompositionKey = (event: ReactKeyboardEvent<HTMLTextAreaElement>) =>
    isComposingRef.current ||
    event.nativeEvent.isComposing ||
    event.key === 'Process' ||
    event.keyCode === 229;

  return (
    <section
      data-three-axis-decree-input
      className={inSlot ? 'relative z-[1] flex w-full justify-center' : 'fixed inset-x-0 z-[96] flex justify-center px-4'}
      style={inSlot ? {
        boxSizing: 'border-box',
      } : {
        bottom: bottomOffset,
        boxSizing: 'border-box',
        maxHeight: 'min(88vh, 520px)',
      }}
      aria-label="御前对话栏"
    >
      <div
        className={`${inSlot ? 'w-full' : 'w-full max-w-[1180px] rounded-2xl border'} overflow-visible`}
        style={{
          borderColor: inSlot ? 'transparent' : 'rgba(240,198,106,0.30)',
          background:
            inSlot ? 'transparent' : 'linear-gradient(0deg, rgba(10,8,4,0.97) 0%, rgba(14,12,8,0.94) 80%, rgba(14,12,8,0.86) 100%)',
          backdropFilter: inSlot ? 'none' : 'blur(14px)',
          WebkitBackdropFilter: inSlot ? 'none' : 'blur(14px)',
          boxShadow: inSlot ? 'none' : '0 18px 54px rgba(0,0,0,0.44), inset 0 1px 0 rgba(245,233,201,0.06)',
        }}
      >
      {/* 顶部金线（史馆 Dock 同款发光描边） */}
      {!inSlot && <div
        aria-hidden
        className="h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          boxShadow: `0 0 16px ${accent}66`,
        }}
        />}
      <div className={inSlot ? 'relative px-0 py-0' : 'relative px-3 py-2 md:px-4'}>
        {message && (
          <div
            className="absolute bottom-[calc(100%+10px)] left-1/2 z-40 w-[min(720px,calc(100vw-32px))] -translate-x-1/2 rounded-lg border px-3 py-2 text-[11.5px] leading-[1.6]"
            style={{
              color: msgColor,
              background: 'linear-gradient(180deg, rgba(246,233,201,0.98), rgba(234,214,168,0.98))',
              borderColor: msgBorder,
              boxShadow: '0 8px 24px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,248,224,0.58)',
              fontFamily: 'var(--font-serif)',
            }}
            role="status"
          >
            {message}
          </div>
        )}

        {showContext && (
          <div className="mb-2 grid gap-2 rounded-lg border border-[#F0C66A]/18 bg-[#F0C66A]/[0.045] px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.16em] text-[#8F835F]">
                <span className="rounded border border-[#F0C66A]/28 bg-black/18 px-2 py-0.5 text-[#F0C66A]">
                  当前裁决对象
                </span>
                <span>{contextReadiness}</span>
                {context?.sourceLabel && <span className="hidden sm:inline">{context.sourceLabel}</span>}
              </div>
              <div className="mt-1 truncate text-[13px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
                {contextTitle}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10.5px]">
              <span className="rounded-full border border-[#3DD68C]/24 bg-[#3DD68C]/[0.07] px-2 py-1 text-[#B9F6D2]">
                {contextEvidence}
              </span>
              <span className="rounded-full border border-[#6BA0FF]/22 bg-[#6BA0FF]/[0.06] px-2 py-1 text-[#AFC8FF]">
                {contextDepartments}
              </span>
            </div>
          </div>
        )}

        <div className={`${inSlot ? 'mx-auto grid w-full gap-0 lg:items-center' : 'mx-auto grid w-full max-w-[1180px] gap-3 lg:items-end'}`}>
          <div className="min-w-0">
            {/* 身份条：模式说明 + 当前语 + 计数 */}
            {!inSlot && <div className="mb-1.5 flex items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: accent }}>
                    御前下旨
                  </span>
                  <span
                    className="shrink-0 rounded-full border px-2 py-[1px] text-[11px]"
                    style={{ borderColor: `${accent}66`, color: accent, background: `${accent}10` }}
                  >
                    {modeLabel}
                  </span>
                {modeStatusText && (
                  <span className="min-w-0 truncate text-[12px]" style={{ color: '#C6BB9D' }}>
                    {modeStatusText}
                  </span>
                )}
                </div>
              </div>

              <span
                className="hidden shrink-0 text-[11px] sm:inline"
                style={{ color: remaining < 120 ? '#FCA5B8' : '#6A7299' }}
              >
                {localValue.length}/2000
              </span>
            </div>}

            {/* 操作行：模式切换 + 单行输入 + 下旨 */}
            <div className={inSlot ? 'flex items-center gap-1.5' : 'flex flex-col gap-2 md:flex-row md:items-center'}>
              {!singleMode && visibleModeOptions.length > 0 && (
              <div className="order-4 flex shrink-0 flex-wrap items-center gap-1.5 self-start md:self-auto">
                <button
                  type="button"
                  onClick={handlePolishClick}
                  disabled={busy}
                  data-testid="decree-polish-inline"
                  aria-pressed={showPolishActive}
                  className={`${inSlot ? 'h-6 px-2' : 'h-7 px-2.5'} inline-flex items-center justify-center gap-1 rounded-full border text-[11px] font-semibold transition-all duration-200 hover:-translate-y-px hover:brightness-110 disabled:opacity-50`}
                  style={{
                    borderColor: showPolishActive ? `${accent}66` : 'rgba(255,255,255,0.10)',
                    background: showPolishActive ? `${accent}1F` : 'rgba(255,255,255,0.025)',
                    boxShadow: showPolishActive ? `0 0 12px ${accent}22` : 'none',
                    color: showPolishActive ? accent : '#9AA3C4',
                    transform: showPolishActive ? 'translateY(-1px)' : 'translateY(0)',
                  }}
                >
                  <FileText size={11} />
                  润色
                </button>
                {visibleModeOptions.map((item) => {
                  const selected = mode === item.mode && (item.mode !== 'ask' || item.askTarget === askTarget);
                  const active = selected && !showPolishActive;
                  const Icon = item.icon === 'order' ? Scroll : Lock;
                  const tone = item.mode === 'secret' ? SECRET : GOLD;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-testid={`decree-mode-${item.key}`}
                      onClick={() => handleModeButtonClick(item)}
                      aria-label={item.label}
                      aria-pressed={active}
                      title={item.title}
                      className={`${inSlot ? 'h-6 px-2' : 'h-7 px-2.5'} inline-flex items-center justify-center gap-1 rounded-full border text-[11px] font-semibold transition-all duration-200 hover:-translate-y-px hover:brightness-110`}
                      style={{
                        borderColor: active ? `${tone}66` : 'rgba(255,255,255,0.10)',
                        background: active ? `${tone}1F` : 'rgba(255,255,255,0.025)',
                        boxShadow: active ? `0 0 12px ${tone}22` : 'none',
                        color: active ? tone : '#9AA3C4',
                        transform: active ? 'translateY(-1px)' : 'translateY(0)',
                      }}
                    >
                      <Icon size={11} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              )}
              {singleMode && (
                <span
                  className="order-4 shrink-0 rounded-full border px-2.5 py-[3px] text-[11px]"
                  style={{ borderColor: `${GOLD}66`, color: GOLD, background: `${GOLD}10` }}
                >
                  <Scroll size={11} className="inline mr-1" />
                  旨 · 预览
                </span>
              )}

              <label
                htmlFor={fileInputId}
                data-testid="decree-evidence-upload"
                className={`${inSlot ? 'h-8 w-8' : 'h-9 w-9'} inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all hover:brightness-110`}
                style={{
                  borderColor: attachmentCount > 0 ? `${accent}88` : `${accent}44`,
                  background: attachmentCount > 0 ? `${accent}18` : 'rgba(0,0,0,0.32)',
                  color: accent,
                }}
                title="上传补证附件（文本入 IMA 知识库）"
                aria-label="上传补证附件"
                aria-disabled={busy}
              >
                <Paperclip size={14} />
                <input
                  id={fileInputId}
                  data-testid="decree-evidence-upload-input"
                  type="file"
                  multiple
                  accept=".txt,.md,.markdown,.csv,.json,.jsonl,.yaml,.yml,.log,.html,.htm,.xml,text/*,application/json,application/xml,application/yaml,application/x-yaml,application/x-ndjson"
                  disabled={busy}
                  className="sr-only"
                  suppressHydrationWarning
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) void onAddAttachments?.(files);
                    e.currentTarget.value = '';
                  }}
                />
              </label>

              <textarea
                ref={inputRef}
                data-testid="ssf-ask-input"
                value={localValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setLocalValue(nextValue);
                  if (!isComposingRef.current) onChange(nextValue);
                }}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  const nextValue = e.currentTarget.value;
                  isComposingRef.current = false;
                  setLocalValue(nextValue);
                  onChange(nextValue);
                }}
                onFocus={() => onInputFocusChange?.(true)}
                onBlur={() => window.setTimeout(() => onInputFocusChange?.(false), 120)}
                onKeyDown={(e) => {
                  if (isImeCompositionKey(e)) return;
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                rows={1}
                maxLength={2000}
                suppressHydrationWarning
                placeholder={
                  isOrder
                    ? '直接说您的裁决：准、驳回、补证或让谁先办。'
                    : isSecret
                      ? '密旨直发全蜂群：让各司直陈利弊、冲突与风险。'
                      : isMentorAsk
                        ? '问钦天监：下一步该怎么问、先补什么证据、怎样下旨更稳？'
                        : '问丞相：这件事该先准、先驳回，还是先补证？'
                }
                className={`${inSlot ? 'global-edict-chat-input px-3 py-1.5 text-[12px]' : 'px-3.5 py-2 text-[12.5px] rounded-full'} min-w-0 flex-1 resize-none leading-[1.45] text-[#F5E9C9] placeholder:text-[#8F835F] focus:outline-none`}
                style={{
                  ['--chat-accent' as string]: accent,
                  ...(inSlot
                    ? { fontFamily: 'var(--font-serif)' }
                    : {
                        background: 'rgba(0,0,0,0.4)',
                        border: `1px solid ${accent}44`,
                        fontFamily: 'var(--font-serif)',
                        height: '36px',
                      }),
                }}
              />
              {onClose && (
                <button
                  type="button"
                  data-testid="decree-workbench-close"
                  onClick={onClose}
                  className="order-6 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#F0C66A]/20 bg-[#05070D]/75 px-3 text-[11px] text-[#B6AB8C] transition hover:border-[#F0C66A]/42 hover:text-[#F5E9C9]"
                  style={{ backdropFilter: 'blur(12px)', fontFamily: 'var(--font-serif)' }}
                >
                  <X size={12} />
                  收起御前工作台
                </button>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {attachments.slice(0, 5).map((item) => (
                  <span
                    key={item.id}
                    data-testid="decree-attachment-chip"
                    className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px]"
                    style={{
                      borderColor: `${accent}33`,
                      background: `${accent}0D`,
                      color: '#D9C79A',
                    }}
                  >
                    <FileText size={11} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                    {item.knowledgeId && <span className="shrink-0 text-[#B9F6D2]">IMA入库</span>}
                    <span className="shrink-0 text-[#8F835F]">{formatBytes(item.size)}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment?.(item.id)}
                      className="shrink-0 rounded-full p-0.5 transition-all hover:bg-white/10"
                      aria-label={`移除附件 ${item.name}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {attachments.length > 5 && (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10.5px] text-[#8F835F]">
                    +{attachments.length - 5} 份
                  </span>
                )}
              </div>
            )}
          </div>

        </div>

        {menxiaRejected && (
          <div className="mt-2 rounded-xl border p-3 text-[12px]" style={{ borderColor: 'rgba(240,198,106,0.2)', background: 'rgba(240,198,106,0.04)' }}>
            <div style={{ color: '#F0C66A' }} className="mb-2 font-semibold">⚖️ 门下省存疑 · 请陛下定夺</div>
            {menxiaMissingItems && menxiaMissingItems.length > 0 && (
              <div className="mb-2" style={{ color: '#C6BB9D' }}>
                <span className="text-[11px]">史馆情报缺口：</span>
                <ul className="mt-1 space-y-0.5">
                  {menxiaMissingItems.map((item, i) => (
                    <li key={i} style={{ color: '#9AA3C4' }}>· {item}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(['🔍 授权锦衣卫侦查|intel', '✍️ 转翰林人工草拟|manual', '📋 按现有情报降级出稿|downgrade'] as const).map((item) => {
                const [label, action] = item.split('|');
                return (
                  <button key={action} type="button" onClick={() => onMenxiaAction?.(action)}
                    className="rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all hover:brightness-110"
                    style={{ borderColor: 'rgba(240,198,106,0.35)', color: '#F0C66A', background: 'rgba(240,198,106,0.08)' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0B';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function ParchmentDialogMessage({ label, text }: { label: string; text: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[11.5px] leading-[1.65]"
      style={{
        color: '#3f2c12',
        borderColor: 'rgba(120,90,40,0.38)',
        background: 'linear-gradient(180deg, rgba(246,233,201,0.98), rgba(234,214,168,0.98))',
        boxShadow: '0 8px 22px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,248,224,0.6)',
        fontFamily: 'var(--font-serif)',
      }}
      role="status"
    >
      <div className="mb-1 text-[10px] font-semibold tracking-[0.16em]" style={{ color: '#7a4a08' }}>
        {label}
      </div>
      {text}
    </div>
  );
}
