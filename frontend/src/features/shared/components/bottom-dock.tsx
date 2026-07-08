/**
 * 朝堂 OS V2 · BottomDock
 *
 * 部门主 mascot（太医 / 钦天监 / 史官 / 丞相 …）统一底部交互容器。
 * 视觉与 钦天监 (attendant) 同宗：radial 金光 avatar + 金边 glass card。
 * 两态：
 *   - collapsed: 单行 · 头像 + 身份 + 最近一句 + 快选 chips + 输入 · 72-96px 高
 *   - expanded:  向上展开 · 左 focus panel · 右 对话流 · 最高 480px
 */

'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Send,
  MessageSquareQuote,
  X,
} from 'lucide-react';
import type { DepartmentSourceLabel } from '@/components/chaotang/department/DepartmentScrollStage';

export interface DockMessage {
  id?: string;
  role: 'agent' | 'user';
  text: string;
  time: string;
  /** 可选富渲染节点（如户部问责面板）。给定时优先于纯文本 text 渲染；text 仍用于折叠态摘要。 */
  node?: ReactNode;
}

export interface DockQuickPrompt {
  label: string;
  prompt: string;
}

export interface BottomDockProps {
  /** 部门身份 */
  title: string;        // 如 "Imperial Physician · 太医"
  name: string;         // 如 "太医 · 孙思邈堂"
  /** 部门主色 */
  accent: string;
  /** 头像内容：SVG 半身像或 emoji（ReactNode） */
  avatar: ReactNode;
  /** 快选 prompts */
  quickPrompts: string[];
  /** 带短标签的快选 prompts；用于移动端/长 prompt 场景。给定时优先于 quickPrompts。 */
  quickPromptItems?: DockQuickPrompt[];
  /** 历史对话 */
  messages: DockMessage[];
  /** 提示 placeholder */
  placeholder?: string;
  /** 发送按钮文案 */
  sendLabel?: string;
  /** 当前对话/回执来源 */
  sourceLabel?: DepartmentSourceLabel;
  /** 当前焦点响应内容（展开时显示在左侧） */
  focusPanel?: ReactNode;
  /** 收起时的单句摘要（取消息首句或定制） */
  collapsedTeaser?: string;
  /** 发送处理器 */
  onSend: (text: string) => void;
  /** 徽章信息 · 展示在折叠栏右侧（如 "脉象 86"） */
  badges?: { label: string; value: string }[];
  /** 折叠态是否显示 quick prompts */
  showCollapsedQuickPrompts?: boolean;
  /** 初始是否展开（如带着问题跳转进来时直接展开对话） */
  defaultExpanded?: boolean;
  /** 视觉风格：默认或上书房同款 */
  visualStyle?: 'default' | 'imperial';
}

const dockInputStyle: CSSProperties = {
  color: '#F5E9C9',
  caretColor: '#F5E9C9',
};

function sourceLabelCopy(label: DepartmentSourceLabel) {
  if (label === 'LIVE') return '真源';
  if (label === 'FALLBACK') return '降级';
  if (label === 'DEMO') return '演示';
  return '混合';
}

function DockSourcePlaque({ label, accent }: { label: DepartmentSourceLabel; accent: string }) {
  const live = label === 'LIVE';
  const warning = label === 'FALLBACK' || label === 'DEMO';
  return (
    <span
      data-three-axis-source-plaque={label}
      data-three-axis-dock-source-plaque
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
      style={{
        borderColor: live ? 'rgba(185,246,210,0.30)' : warning ? 'rgba(252,165,184,0.34)' : `${accent}44`,
        background: live ? 'rgba(61,214,140,0.08)' : warning ? 'rgba(122,36,30,0.20)' : `${accent}12`,
        color: live ? '#B9F6D2' : warning ? '#FCA5B8' : accent,
        boxShadow: `inset 0 1px 0 rgba(245,233,201,0.08), 0 0 18px ${accent}1f`,
      }}
      title={`传旨台来源：${label}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: live ? '#B9F6D2' : warning ? '#FCA5B8' : accent }} />
      {label}
      <span className="font-serif text-[10px] tracking-[0.08em]">{sourceLabelCopy(label)}</span>
    </span>
  );
}

function dispatchImperialActionAccepted() {
  window.dispatchEvent(new CustomEvent('chaotang:imperial-action-accepted'));
}

export function BottomDock({
  title,
  name,
  accent,
  avatar,
  quickPrompts,
  quickPromptItems,
  messages,
  focusPanel,
  onSend,
  placeholder = '请陛下问...',
  sendLabel = '发送',
  sourceLabel = 'MIXED',
  collapsedTeaser,
  badges = [],
  showCollapsedQuickPrompts = true,
  defaultExpanded = false,
  visualStyle = 'default',
}: BottomDockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [input, setInput] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const last = messages[messages.length - 1];
  const promptItems =
    quickPromptItems ??
    quickPrompts.map((prompt) => ({
      label: prompt,
      prompt,
    }));
  const primaryAction = promptItems[0];
  const imperialStyle = visualStyle === 'imperial';
  const teaser =
    collapsedTeaser ??
    (last?.text.length && last.text.length > 72
      ? last.text.slice(0, 72) + '…'
      : last?.text ?? '');

  useEffect(() => {
    if (expanded) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, expanded]);

  const handleSend = () => {
    if (!input.trim()) return;
    // #5 诚实进行态:不再乐观盖"已接旨"完成态红印(铁律4 高视觉权重的定论信号不能盖在可能失败的动作上)。
    // 此处仅标"正在呈递…"，真实受理/未达由下方回奏消息(会审卡/未达)定型。
    setReceipt(`正在呈递「${input.trim().slice(0, 18)}」…`);
    dispatchImperialActionAccepted();
    onSend(input.trim());
    setInput('');
  };
  const handlePrimaryAction = (item: DockQuickPrompt) => {
    setReceipt(`正在呈递：${item.label}…`);
    dispatchImperialActionAccepted();
    onSend(item.prompt);
  };

  return (
    <>
      {/* 底部 Dock */}
      <div
        data-three-axis-decree-input
        className={`fixed inset-x-0 z-40 transition-all ${imperialStyle ? 'overflow-x-hidden overflow-y-visible' : ''}`}
        style={{
          background:
            'linear-gradient(0deg, rgba(10,8,4,0.97) 0%, rgba(14,12,8,0.94) 80%, rgba(14,12,8,0) 100%)',
          backdropFilter: imperialStyle ? 'blur(14px)' : undefined,
          WebkitBackdropFilter: imperialStyle ? 'blur(14px)' : undefined,
          bottom: imperialStyle ? 'calc(24px + env(safe-area-inset-bottom))' : 0,
          boxShadow: imperialStyle ? '0 -18px 70px rgba(0,0,0,0.58), inset 0 1px 0 rgba(245,233,201,0.06)' : undefined,
          paddingBottom: imperialStyle ? 'env(safe-area-inset-bottom)' : undefined,
        }}
      >
        {/* 顶部金线 */}
        <div
          aria-hidden
          className="h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            boxShadow: `0 0 16px ${accent}66`,
          }}
        />
        {receipt && (
          <div
            data-three-axis-action-receipt
            className="animate-fade-in-up mx-auto mt-2 flex max-w-[1600px] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[11px] font-semibold"
            style={{
              borderColor: `${accent}44`,
              background: `linear-gradient(90deg, rgba(122,36,30,0.24), ${accent}16 42%, rgba(0,0,0,0.18))`,
              color: '#F5E9C9',
              boxShadow: '0 8px 26px rgba(0,0,0,0.24), inset 0 1px 0 rgba(245,233,201,0.08)',
            }}
            role="status"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                data-three-axis-action-seal
                aria-hidden
                className="animate-pulse-glow grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border text-[10px] font-black leading-[1.05] tracking-[0.12em]"
                style={{
                  borderColor: `${accent}88`,
                  background: `linear-gradient(145deg, ${accent}33, ${accent}14)`,
                  color: accent,
                  fontFamily: 'var(--font-serif)',
                }}
              >
                呈递
              </span>
              <span className="min-w-0 truncate">{receipt}</span>
              <DockSourcePlaque label={sourceLabel} accent={accent} />
            </div>
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#C6BB9D]"
            >
              知道了
            </button>
          </div>
        )}

        {/* 展开面板 */}
        {expanded && (
          <div
            className="border-b px-4 py-4 backdrop-blur-xl"
            style={{
              borderColor: `${accent}33`,
              background: `radial-gradient(circle at 20% 0%, ${accent}0d, transparent 55%), rgba(14,12,8,0.95)`,
            }}
          >
            <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-[1fr_420px]">
              {/* 左 · Focus panel */}
              <div
                className="max-h-[380px] overflow-y-auto rounded-2xl border p-3"
                style={{
                  borderColor: `${accent}33`,
                  background: 'rgba(0,0,0,0.3)',
                }}
              >
                {focusPanel ?? (
                  <div className="flex h-full items-center justify-center text-[11px] text-[#9AA3C4]">
                    选中焦点即在此展示详情
                  </div>
                )}
              </div>

              {/* 右 · 对话流 */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
              <div
                    className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: accent }}
                  >
                    <MessageSquareQuote size={11} />
                    对话 · Conversation
                    <DockSourcePlaque label={sourceLabel} accent={accent} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="rounded-full border px-2 py-0.5 text-[11px] transition hover:brightness-110"
                    style={{
                      borderColor: 'rgba(255,255,255,0.12)',
                      color: '#9AA3C4',
                    }}
                  >
                    <X size={11} className="inline" /> 收起
                  </button>
                </div>
                <div
                  ref={scrollRef}
                  className="mt-2 flex-1 space-y-2 overflow-y-auto rounded-xl border p-3"
                  style={{
                    maxHeight: '320px',
                    borderColor: `${accent}22`,
                    background: 'rgba(0,0,0,0.3)',
                  }}
                >
                  {messages.map((m, i) => (
                    <MessageRow key={m.id ?? `${m.role}-${m.time}-${i}`} m={m} accent={accent} />
                  ))}
                </div>
                <div
                  className="mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2"
                  style={{
                    borderColor: `${accent}33`,
                    background: 'rgba(0,0,0,0.3)',
                  }}
                >
                  {primaryAction && (
                    <button
                      type="button"
                      data-three-axis-primary-action
                      onClick={() => handlePrimaryAction(primaryAction)}
                      title={primaryAction.prompt}
                      className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition hover:brightness-110"
                      style={{
                        borderColor: `${accent}55`,
                        background: `${accent}14`,
                        color: accent,
                      }}
                    >
                      {primaryAction.label}
                    </button>
                  )}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    suppressHydrationWarning
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSend();
                    }}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-[12px] outline-none"
                    style={dockInputStyle}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: accent,
                      color: '#0b0e18',
                    }}
                  >
                    <Send size={11} />
                    {sendLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 折叠条（始终显示） */}
        <div
          className="backdrop-blur-xl"
          style={{
            background: imperialStyle ? 'rgba(14,12,8,0.88)' : 'rgba(14,12,8,0.85)',
          }}
        >
          <div className={`mx-auto flex items-center gap-3 px-4 ${imperialStyle ? 'max-w-[1920px] py-2.5 lg:px-8' : 'max-w-[1600px] py-3'}`}>
            {/* 头像 · radial gold */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full transition-transform hover:scale-105"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${accent}aa, ${accent}22 60%, rgba(10,8,4,0.9))`,
                boxShadow: `0 0 16px ${accent}55, inset 0 1px 0 ${accent}55`,
                border: `1px solid ${accent}88`,
              }}
              aria-label={expanded ? '收起对话' : '展开对话'}
            >
              {avatar}
            </button>

            {/* 身份 + 当前语 */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: accent }}
                >
                  {title}
                </span>
                <DockSourcePlaque label={sourceLabel} accent={accent} />
                <span
                  className="rounded-md border px-2 py-[1px] text-[11px] font-medium"
                  style={{
                    borderColor: `${accent}66`,
                    color: accent,
                    background: `${accent}10`,
                  }}
                >
                  {name}
                </span>
              </div>
              <div
                className={`truncate ${imperialStyle ? 'mt-0 text-[12px]' : 'mt-0.5 text-[13px]'}`}
                style={{ color: '#F5E9C9' }}
              >
                {teaser}
              </div>
            </div>

            {/* 徽章 */}
            {badges.length > 0 && (
              <div className="hidden items-center gap-2 md:flex">
                {badges.map((b) => (
                  <div
                    key={b.label}
                    className="flex flex-col items-center rounded-xl border px-3 py-1"
                    style={{
                      borderColor: `${accent}44`,
                      background: `${accent}0d`,
                    }}
                  >
                    <span
                      className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: accent }}
                    >
                      {b.label}
                    </span>
                    <span
                      className="font-mono text-[14px] font-bold"
                      style={{ color: '#F5E9C9' }}
                    >
                      {b.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 输入框 */}
            <div
              className={`${expanded ? 'hidden' : 'hidden md:flex'} flex-1 items-center gap-2 rounded-lg border px-3 ${imperialStyle ? 'py-2' : 'py-1.5'}`}
              style={{
                borderColor: `${accent}44`,
                background: imperialStyle ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.4)',
                maxWidth: imperialStyle ? '420px' : '360px',
              }}
            >
              {primaryAction && (
                <button
                  type="button"
                  data-three-axis-primary-action
                  onClick={() => handlePrimaryAction(primaryAction)}
                  title={primaryAction.prompt}
                  className="shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-bold transition hover:brightness-110"
                  style={{
                    borderColor: `${accent}55`,
                    background: `${accent}14`,
                    color: accent,
                  }}
                >
                  {primaryAction.label}
                </button>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                suppressHydrationWarning
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-[12px] outline-none"
                style={dockInputStyle}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: accent,
                  color: '#0b0e18',
                }}
              >
                <Send size={11} />
                {sendLabel}
              </button>
            </div>

            {/* 展开/折叠 */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition"
              style={{
                borderColor: `${accent}66`,
                background: `${accent}14`,
                color: accent,
              }}
              aria-label={expanded ? '收起' : '展开'}
            >
              {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          </div>

          {/* Quick prompts */}
          {promptItems.length > 0 && (expanded || showCollapsedQuickPrompts) && (
            <div
              className={`mx-auto overflow-x-auto px-4 ${imperialStyle ? 'max-w-[1920px] pb-2 lg:px-8' : 'max-w-[1600px] pb-3'} ${expanded ? 'hidden md:block' : ''}`}
            >
              <div className="flex gap-1.5 whitespace-nowrap">
                {promptItems.map((item) => (
                  <button
                    key={item.prompt}
                    type="button"
                    onClick={() => handlePrimaryAction(item)}
                    title={item.prompt}
                    className="rounded-md border px-3 py-1 text-[11px] transition hover:brightness-110"
                    style={{
                      borderColor: 'rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.03)',
                      color: '#C8CDD8',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ========================================================================== */

function MessageRow({ m, accent }: { m: DockMessage; accent: string }) {
  const isUser = m.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{
          background: isUser
            ? 'rgba(107,160,255,0.2)'
            : `radial-gradient(circle at 30% 30%, ${accent}aa, ${accent}33)`,
          border: isUser ? '1px solid rgba(107,160,255,0.55)' : `1px solid ${accent}88`,
          color: isUser ? '#6BA0FF' : '#F5E9C9',
        }}
      >
        {isUser ? '陛' : '奉'}
      </div>
      <div
        className="max-w-[85%] rounded-xl border px-3 py-2 text-[11px] leading-6"
        style={{
          background: isUser ? 'rgba(107,160,255,0.08)' : `${accent}0d`,
          borderColor: isUser ? 'rgba(107,160,255,0.25)' : `${accent}33`,
          color: '#D6CCB0',
        }}
      >
        {m.node ?? m.text}
        <div className="mt-1 text-right text-[11px] text-[#6A7299]">{m.time}</div>
      </div>
    </div>
  );
}

/** 推荐：页面 main 内容的 bottom padding（避免被 Dock 遮挡） */
export const DOCK_BOTTOM_PADDING = 'pb-[128px]'; // 折叠态高度 + 余量
