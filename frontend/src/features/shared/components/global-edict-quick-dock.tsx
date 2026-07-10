'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Send, Telescope, X } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { assetUrl } from '@/lib/asset';
import { withBasePath } from '@/lib/base-path';
import { SHANGSHUFANG_ASSETS } from '@/features/shangshufang/constants';
import { useDockChat } from '@/lib/hooks/use-dock-chat';
import { useGlobalEdictDockSidePanels, useGlobalEdictDockSlot } from './global-edict-dock-slot';
import { IntelBriefPanel } from './intel-brief-panel';

type AdvisorTarget = 'chancellor' | 'qintian';

type ShangshufangDecreeSubmitDetail = {
  command?: unknown;
  mode?: unknown;
  askTarget?: unknown;
};

type DockDecreeDispatchDetail = {
  command: string;
  source: AdvisorTarget;
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

const TARGET_META: Record<AdvisorTarget, {
  title: string;
  subtitle: string;
  placeholder: string;
  accent: string;
  portrait: string;
  portraitPosition: string;
}> = {
  chancellor: {
    title: '问丞相',
    subtitle: '先压判断与缺证',
    placeholder: '继续问丞相：判断、缺证、下一步...',
    accent: '#F0C66A',
    portrait: SHANGSHUFANG_ASSETS.portraitChancellor,
    portraitPosition: 'center top',
  },
  qintian: {
    title: '问钦天监',
    subtitle: '先看时机与风险',
    placeholder: '继续问钦天监：时机、风险、下一步...',
    accent: '#7EC8E3',
    portrait: SHANGSHUFANG_ASSETS.portraitWang,
    portraitPosition: 'center top',
  },
};

const ROUTE_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /^\/court-briefing(?:\/|$)/, label: '上书房' },
  { match: /^\/overview(?:\/|$)/, label: '大殿' },
  { match: /^\/command-center(?:\/|$)/, label: '军机处' },
  { match: /^\/departments(?:\/|$)/, label: '六部' },
  { match: /^\/manors(?:\/|$)/, label: '庄园蜂群' },
  { match: /^\/archive(?:\/|$)/, label: '史馆' },
  { match: /^\/shiguan(?:\/|$)/, label: '太史馆' },
  { match: /^\/intel(?:\/|$)/, label: '锦衣卫' },
  { match: /^\/forecast(?:\/|$)/, label: '钦天监' },
  { match: /^\/reports(?:\/|$)/, label: '战报库' },
  { match: /^\/scribe(?:\/|$)/, label: '复盘台' },
  { match: /^\/governance(?:\/|$)/, label: '三省审议台' },
  { match: /^\/grand-council(?:\/|$)/, label: '三省合议' },
  { match: /^\/hanlin(?:\/|$)/, label: '翰林院' },
  { match: /^\/health(?:\/|$)/, label: '太医院' },
  { match: /^\/libu(?:\/|$)/, label: '御书房' },
  { match: /^\/settings(?:\/|$)/, label: '设置中心' },
  { match: /^\/tasks(?:\/|$)/, label: '任务台' },
  { match: /^\/task(?:\/|$)/, label: '任务详情' },
  { match: /^\/more(?:\/|$)/, label: '更多功能' },
];

function routeLabel(pathname: string) {
  return ROUTE_LABELS.find((item) => item.match.test(pathname))?.label ?? pathname;
}

const CHAT_HISTORY: Record<AdvisorTarget, ChatMessage[]> = {
  chancellor: [
    {
      id: 'chancellor-brief',
      role: 'assistant',
      text: '先收束判断：当前页只记录已形成的会审脉络，实时追问请回上书房正式下旨。',
      time: '留痕',
    },
    {
      id: 'chancellor-evidence',
      role: 'assistant',
      text: '最近关注：缺证、下一步、是否需要转军机处会审。',
      time: '归档',
    },
  ],
  qintian: [
    {
      id: 'qintian-window',
      role: 'assistant',
      text: '钦天监只展示既有风险记录；此处不再直接发起实时预测。',
      time: '留痕',
    },
    {
      id: 'qintian-risk',
      role: 'assistant',
      text: '最近关注：时机窗口、外部扰动、不可逆动作前的缓冲证据。',
      time: '归档',
    },
  ],
};

const DOCK_BACKGROUND = 'linear-gradient(180deg, rgba(7,9,16,0.94), rgba(4,6,12,0.90))';
const DOCK_TARGETS: AdvisorTarget[] = ['chancellor', 'qintian'];
const DRAWER_CLOSE_MS = 420;

function AdvisorPortrait({
  meta,
  icon,
  size = 'sm',
  variant = 'framed',
}: {
  meta: (typeof TARGET_META)[AdvisorTarget];
  icon?: ReactNode;
  size?: 'sm' | 'lg';
  variant?: 'framed' | 'plain';
}) {
  const large = size === 'lg';
  const framed = variant === 'framed';

  return (
    <span
      className={`relative shrink-0 overflow-hidden rounded-[10px] ${
        framed ? 'border' : ''
      } ${
        large ? 'h-14 w-12' : 'h-12 w-11'
      }`}
      style={{
        borderColor: framed ? `${meta.accent}55` : 'transparent',
        background: `radial-gradient(circle at 50% 10%, ${meta.accent}22, rgba(5,7,13,0.92) 72%)`,
        boxShadow: framed
          ? `0 0 ${large ? 24 : 18}px ${meta.accent}22, inset 0 1px 0 rgba(255,255,255,0.10)`
          : `0 0 ${large ? 20 : 14}px ${meta.accent}18`,
      }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetUrl(meta.portrait)}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
        style={{ objectPosition: meta.portraitPosition }}
      />
      <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_42%,rgba(0,0,0,0.48)_100%)]" />
      {icon ? (
        <span
          className={`absolute bottom-0.5 right-0.5 grid h-4 w-4 place-items-center rounded-[5px] bg-[#05070D]/90 ${
            framed ? 'border' : ''
          }`}
          style={{ borderColor: framed ? `${meta.accent}44` : 'transparent', color: meta.accent }}
        >
          {icon}
        </span>
      ) : null}
    </span>
  );
}

function EmperorAvatar({ accent }: { accent: string }) {
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center border text-[9px] font-semibold"
      style={{
        borderColor: `${accent}55`,
        background: `linear-gradient(145deg, ${accent}24, rgba(5,7,13,0.92))`,
        color: '#F5E9C9',
        boxShadow: `0 0 16px ${accent}20, inset 0 1px 0 rgba(255,255,255,0.08)`,
        fontFamily: 'var(--font-serif)',
      }}
      aria-hidden
    >
      朕
    </span>
  );
}

function AdvisorChatAvatar({ meta }: { meta: (typeof TARGET_META)[AdvisorTarget] }) {
  return (
    <span
      className="relative h-6 w-6 shrink-0 overflow-hidden border"
      style={{
        borderColor: `${meta.accent}44`,
        background: `radial-gradient(circle at 50% 10%, ${meta.accent}20, rgba(5,7,13,0.92) 72%)`,
        boxShadow: `0 0 12px ${meta.accent}18, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetUrl(meta.portrait)}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
        style={{ objectPosition: meta.portraitPosition }}
      />
    </span>
  );
}

function stripStreamingCaret(text: string) {
  return text.replace(/(?:▌|鈻\?)$/u, '');
}

function FooterTypewriterText({
  text,
  enabled,
}: {
  text: string;
  enabled: boolean;
}) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState('');
  const shownRef = useRef(shown);
  const targetRef = useRef(stripStreamingCaret(text));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    const targetText = stripStreamingCaret(text);

    if (!mounted) return;

    if (!enabled || reduce) {
      targetRef.current = targetText;
      shownRef.current = targetText;
      setShown(targetText);
      return;
    }

    targetRef.current = targetText;
    if (!targetText.startsWith(shownRef.current) || shownRef.current.length > targetText.length) {
      shownRef.current = '';
      setShown('');
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelled) return;
      const target = targetRef.current;
      const current = shownRef.current;
      if (current.length >= target.length) return;

      const remaining = target.length - current.length;
      const next = target.slice(0, current.length + 1);
      shownRef.current = next;
      setShown(next);
      timer = setTimeout(tick, remaining > 48 ? 12 : 24);
    };

    timer = setTimeout(tick, shownRef.current ? 12 : 80);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, reduce, text, mounted]);

  // Before hydration: render full text so server & client first paint match
  if (!mounted) {
    return <span>{stripStreamingCaret(text)}</span>;
  }

  return (
    <span>
      {shown}
      {enabled && !reduce && shown.length < targetRef.current.length ? (
        <span
          className="ml-[1px] inline-block h-[1em] w-px animate-pulse align-middle"
          style={{ background: 'currentColor' }}
          aria-hidden
        />
      ) : null}
    </span>
  );
}

function AdvisorDecreeButton({
  meta,
  draft,
  onDraftChange,
  onSendDraft,
  disabled,
  onDispatch,
}: {
  meta: (typeof TARGET_META)[AdvisorTarget];
  draft: string;
  onDraftChange: (value: string) => void;
  onSendDraft: () => void;
  disabled: boolean;
  onDispatch: () => void;
}) {
  const hasDraft = draft.trim().length > 0;
  const handleSubmit = () => {
    if (hasDraft) {
      onSendDraft();
      return;
    }
    onDispatch();
  };

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 border-t px-3 py-2"
      style={{ borderColor: 'rgba(240,198,106,0.30)' }}
    >
      <input
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (hasDraft) onSendDraft();
          }
        }}
        className="global-edict-chat-input min-w-0 flex-1 px-3 py-1.5 text-[12px] leading-[1.45] text-[#F5E9C9] placeholder:text-[#8F835F] focus:outline-none"
        style={{
          ['--chat-accent' as string]: meta.accent,
          fontFamily: 'var(--font-serif)',
        }}
        placeholder={meta.placeholder}
        maxLength={1200}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={handleSubmit}
        className="grid h-9 w-9 shrink-0 place-items-center border text-[#F0C66A] transition hover:bg-[#F0C66A]/10 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: 'rgba(240,198,106,0.34)' }}
        aria-label={hasDraft ? `发送给${meta.title.replace('问', '')}` : `${meta.title}下旨`}
        title={hasDraft ? '发送' : disabled ? '暂无可下旨内容' : '下旨调用蜂群'}
      >
        <Send size={14} />
      </button>
    </div>
  );
}

export function GlobalEdictQuickDock() {
  const pathname = usePathname() ?? '/';
  const pageLabel = routeLabel(pathname);
  const centerSlot = useGlobalEdictDockSlot();
  const sidePanels = useGlobalEdictDockSidePanels();
  const chancellorChat = useDockChat('丞相在此，可即时追问判断、缺证与下一步。', '/api/shangshufang/chancellor-chat');
  const qintianChat = useDockChat('钦天监在此，可即时推演时机、风险与变局。', '/api/qintian/chat');
  // 锦衣卫情报徽标(2026-07-04)：只信真实turso来源，fallback/demo数据不计入角标，
  // 避免把演示数据伪装成"有N条新情报"(sourceLabel铁律)。
  const { data: intelMeta } = useSWR<{ meta?: { total?: number; source?: string } }>(
    withBasePath('/api/court/intel/signals?limit=20'),
    (url: string) => fetch(url).then((res) => res.json()),
    { refreshInterval: 60_000 },
  );
  const realIntelCount = intelMeta?.meta?.source === 'turso' ? (intelMeta.meta.total ?? 0) : 0;
  const [intelPanelOpen, setIntelPanelOpen] = useState(false);
  // 抽屉默认关闭(合体2026-07-06)：常驻三栏后左右栏已在主 grid 常驻，点「问丞相/问钦天监」或选中奏折
  // 追问才弹边缘 popover、不遮挡常驻列；也修此前硬编码 true 把非上书房页正文挤成窄缝(e2e focus-shell)。
  const [openTargets, setOpenTargets] = useState<Record<AdvisorTarget, boolean>>({
    chancellor: false,
    qintian: false,
  });
  const [closingTargets, setClosingTargets] = useState<Record<AdvisorTarget, boolean>>({
    chancellor: false,
    qintian: false,
  });
  const [chatDrafts, setChatDrafts] = useState<Record<AdvisorTarget, string>>({
    chancellor: '',
    qintian: '',
  });
  const [drawerBounds, setDrawerBounds] = useState<{ top: number; height: number } | null>(null);
  const chatScrollRefs = useRef<Partial<Record<AdvisorTarget, HTMLDivElement | null>>>({});

  const renderedTargets = useMemo(
    () => DOCK_TARGETS.filter((item) => openTargets[item] || closingTargets[item]),
    [closingTargets, openTargets],
  );
  const notifyTargetOpen = (nextTarget: AdvisorTarget) => {
    if (nextTarget === 'chancellor') {
      sidePanels.onOpenChancellor?.();
      return;
    }
    sidePanels.onOpenQintian?.();
  };

  const openTarget = (nextTarget: AdvisorTarget) => {
    const nextOpen = !openTargets[nextTarget];
    setOpenTargets((current) => ({ ...current, [nextTarget]: nextOpen }));

    if (nextOpen) {
      setClosingTargets((closing) => ({ ...closing, [nextTarget]: false }));
      window.setTimeout(() => notifyTargetOpen(nextTarget), 0);
      return;
    }

    setClosingTargets((closing) => ({ ...closing, [nextTarget]: true }));
    window.setTimeout(() => {
      setClosingTargets((closing) => ({ ...closing, [nextTarget]: false }));
    }, DRAWER_CLOSE_MS);
  };

  const closeDrawer = (drawerTarget: AdvisorTarget) => {
    setOpenTargets((current) => {
      if (!current[drawerTarget]) return current;
      setClosingTargets((closing) => ({ ...closing, [drawerTarget]: true }));
      window.setTimeout(() => {
        setClosingTargets((closing) => ({ ...closing, [drawerTarget]: false }));
      }, DRAWER_CLOSE_MS);
      return { ...current, [drawerTarget]: false };
    });
  };

  const chatForTarget = (drawerTarget: AdvisorTarget) => (
    drawerTarget === 'qintian' ? qintianChat : chancellorChat
  );

  const messagesForTarget = (drawerTarget: AdvisorTarget) => {
    const chat = chatForTarget(drawerTarget);
    if (chat.messages.length > 0) return chat.messages;
    return CHAT_HISTORY[drawerTarget];
  };

  useEffect(() => {
    const handleDecreeSubmit = (event: Event) => {
      const detail = (event as CustomEvent<ShangshufangDecreeSubmitDetail>).detail;
      if (detail?.mode !== 'ask') return;
      const command = typeof detail.command === 'string' ? detail.command.trim() : '';
      if (!command) return;
      const target: AdvisorTarget = detail.askTarget === 'mentor' ? 'qintian' : 'chancellor';
      chatForTarget(target).appendUserMessage(command);
      setOpenTargets((current) => ({ ...current, [target]: true }));
      setClosingTargets((current) => ({ ...current, [target]: false }));
    };

    window.addEventListener('shangshufang:decree-submit', handleDecreeSubmit);
    return () => window.removeEventListener('shangshufang:decree-submit', handleDecreeSubmit);
  }, [chancellorChat, qintianChat]);

  const lastUserMessageForTarget = (drawerTarget: AdvisorTarget) => (
    [...messagesForTarget(drawerTarget)].reverse().find((item) => item.role === 'user')?.text.trim() || null
  );

  const dispatchLastMessageAsDecree = (drawerTarget: AdvisorTarget) => {
    const command = lastUserMessageForTarget(drawerTarget);
    if (!command) return;
    window.dispatchEvent(new CustomEvent<DockDecreeDispatchDetail>('shangshufang:dock-decree-dispatch', {
      detail: { command, source: drawerTarget },
    }));
  };

  const sendDockChat = (drawerTarget: AdvisorTarget) => {
    const text = chatDrafts[drawerTarget].trim();
    if (!text) return;
    setChatDrafts((current) => ({ ...current, [drawerTarget]: '' }));
    void chatForTarget(drawerTarget).handleSend(text);
  };

  const renderDrawer = (drawerTarget: AdvisorTarget) => {
    const activeMeta = TARGET_META[drawerTarget];
    const activePanel = sidePanels[drawerTarget];
    const activeMessages = messagesForTarget(drawerTarget);
    const closing = closingTargets[drawerTarget] && !openTargets[drawerTarget];
    const isRight = drawerTarget === 'qintian';
    const handleIcon = isRight ? <ChevronRight size={14} /> : <ChevronLeft size={14} />;
    const drawerAnimationName = drawerTarget === 'qintian'
      ? closing ? 'footerDrawerToRight' : 'footerDrawerFromRight'
      : closing ? 'footerDrawerToLeft' : 'footerDrawerFromLeft';

    return (
      <section
        key={drawerTarget}
        role="dialog"
        aria-label={`${activeMeta.title} 聊天记录`}
        className="fixed z-[220] m-0 flex w-[var(--dock-side-width)] max-w-[100vw] flex-col overflow-visible"
        style={{
          ...(drawerTarget === 'qintian' ? { right: 0 } : { left: 0 }),
          ...(drawerBounds
            ? { top: drawerBounds.top, height: drawerBounds.height }
            : { top: 64, bottom: 'calc(64px + env(safe-area-inset-bottom))' }),
          animation: `${drawerAnimationName} ${closing ? DRAWER_CLOSE_MS : 720}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
          borderColor: 'rgba(240,198,106,0.30)',
          borderStyle: 'solid',
          borderWidth: 0,
          borderLeftWidth: drawerTarget === 'qintian' ? 1 : 0,
          borderRightWidth: drawerTarget === 'qintian' ? 0 : 1,
          background: DOCK_BACKGROUND,
          boxShadow: '0 -18px 54px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <button
          type="button"
          onClick={() => closeDrawer(drawerTarget)}
          className={`absolute top-1/2 z-[226] hidden h-9 w-8 -translate-y-1/2 items-center justify-center border shadow-[0_10px_28px_rgba(0,0,0,0.34)] transition hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F0C66A]/50 md:inline-flex ${
            isRight ? 'left-[-32px] border-r-0' : 'right-[-32px] border-l-0'
          }`}
          style={{
            borderColor: `${activeMeta.accent}55`,
            color: activeMeta.accent,
            background: `linear-gradient(180deg, ${activeMeta.accent}1f, rgba(5,7,13,0.94))`,
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
          aria-label={`收起${activeMeta.title}面板`}
        >
          {handleIcon}
        </button>

        {!activePanel && <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5" style={{ borderColor: 'rgba(240,198,106,0.30)' }}>
          <div className="flex min-w-0 items-center gap-3">
            <AdvisorPortrait meta={activeMeta} size="lg" />
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.18em]" style={{ color: activeMeta.accent }}>
                聊天记录 · {pageLabel}
              </div>
              <h2 className="mt-0.5 truncate text-[14px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
                {activeMeta.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => closeDrawer(drawerTarget)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[#C8CDD8] transition hover:bg-white/[0.06]"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            aria-label="关闭对话"
          >
            <X size={14} />
          </button>
        </div>}

        {activePanel ? (
          <div className="min-h-0 flex-[2_1_0%] overflow-hidden [&>section]:!rounded-none [&>section]:[border-radius:0]">
            {activePanel}
          </div>
        ) : null}

        <div
          className={`${activePanel ? 'flex-[1_1_0%]' : 'flex-1'} flex min-h-0 flex-col border-t`}
          style={{ borderColor: 'rgba(240,198,106,0.30)' }}
        >
          <div
            ref={(node) => { chatScrollRefs.current[drawerTarget] = node; }}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2"
          >
            {activeMessages.map((item, index) => {
              const fromUser = item.role === 'user';
              const shouldTypewrite =
                drawerTarget === 'chancellor' && !fromUser && index === activeMessages.length - 1;
              return (
                <div
                  key={item.id ?? `${item.role}-${item.time}-${index}`}
                  className={`flex items-start gap-2 ${fromUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {fromUser ? (
                    <EmperorAvatar accent={activeMeta.accent} />
                  ) : (
                    <AdvisorChatAvatar meta={activeMeta} />
                  )}
                  <div
                    className={`max-w-[calc(100%-38px)] border px-2.5 py-1.5 ${
                      fromUser ? 'rounded-l-md rounded-br-md' : 'rounded-r-md rounded-bl-md'
                    }`}
                    style={{
                      borderColor: fromUser ? 'rgba(240,198,106,0.28)' : 'rgba(240,198,106,0.18)',
                      background: fromUser ? 'rgba(240,198,106,0.10)' : 'rgba(255,255,255,0.035)',
                      color: '#E7DFC8',
                    }}
                  >
                    <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[9px] text-[#9AA3C4]">
                      <span className="font-semibold text-[#F0C66A]">{fromUser ? '陛下' : activeMeta.title.replace('问', '')}</span>
                      <span className="font-mono">{item.time}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-[11px] leading-[1.55]" style={{ fontFamily: 'var(--font-serif)' }}>
                      <FooterTypewriterText text={item.text} enabled={shouldTypewrite} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <AdvisorDecreeButton
            meta={activeMeta}
            draft={chatDrafts[drawerTarget]}
            onDraftChange={(nextValue) => {
              setChatDrafts((current) => ({ ...current, [drawerTarget]: nextValue }));
            }}
            onSendDraft={() => sendDockChat(drawerTarget)}
            disabled={!chatDrafts[drawerTarget].trim() && !lastUserMessageForTarget(drawerTarget)}
            onDispatch={() => dispatchLastMessageAsDecree(drawerTarget)}
          />
        </div>
      </section>
    );
  };

  const renderSideToggle = (drawerTarget: AdvisorTarget) => {
    const meta = TARGET_META[drawerTarget];
    const active = openTargets[drawerTarget];
    const closing = closingTargets[drawerTarget] && !active;
    if (active || closing) return null;
    const isRight = drawerTarget === 'qintian';
    const icon = isRight ? <ChevronLeft size={14} /> : <ChevronRight size={14} />;
    const edgeStyle = isRight
      ? { right: 0 }
      : { left: 0 };

    return (
      <button
        key={`${drawerTarget}-side-toggle`}
        type="button"
        onClick={() => openTarget(drawerTarget)}
        className={`fixed z-[225] hidden h-9 w-8 items-center justify-center border shadow-[0_10px_28px_rgba(0,0,0,0.34)] transition hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F0C66A]/50 md:inline-flex ${
          isRight ? 'flex-row-reverse border-r-0' : 'border-l-0'
        }`}
        style={{
          ...edgeStyle,
          top: drawerBounds ? drawerBounds.top + drawerBounds.height / 2 : '50%',
          transform: 'translateY(-50%)',
          borderColor: active ? `${meta.accent}55` : 'rgba(240,198,106,0.30)',
          color: active ? meta.accent : '#F5E9C9',
          background: active
            ? `linear-gradient(180deg, ${meta.accent}1f, rgba(5,7,13,0.94))`
            : DOCK_BACKGROUND,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
        aria-pressed={active}
        aria-label={`${active ? '收起' : '拉起'}${meta.title}面板`}
      >
        {icon}
      </button>
    );
  };

  const dockButtons = useMemo(() => ([
    { target: 'chancellor' as const, icon: <MessageSquare size={13} /> },
    { target: 'qintian' as const, icon: <Telescope size={13} /> },
  ]), []);

  useEffect(() => {
    const measureMain = () => {
      const main = document.querySelector<HTMLElement>('[data-layout-region="content"]');
      if (!main) {
        setDrawerBounds(null);
        return;
      }
      const rect = main.getBoundingClientRect();
      setDrawerBounds({
        top: Math.max(0, rect.top),
        height: Math.max(0, rect.height + 1),
      });
    };

    measureMain();
    window.addEventListener('resize', measureMain);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureMain) : null;
    const shellRegions = document.querySelectorAll<HTMLElement>(
      '[data-app-layout="header-content-footer"], [data-layout-region="header"], [data-layout-region="content"], [data-layout-region="footer"]',
    );
    shellRegions.forEach((element) => observer?.observe(element));

    return () => {
      window.removeEventListener('resize', measureMain);
      observer?.disconnect();
    };
  }, [renderedTargets.length]);

  useEffect(() => {
    renderedTargets.forEach((drawerTarget) => {
      const node = chatScrollRefs.current[drawerTarget];
      node?.scrollTo({
        top: node.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [chancellorChat.messages, qintianChat.messages, renderedTargets]);

  return (
    <div
      data-testid="edict-quick-dock"
      className="relative z-[215] [--dock-side-width:44vw] sm:[--dock-side-width:260px] lg:[--dock-side-width:300px]"
    >
      {renderedTargets.map(renderDrawer)}
      {DOCK_TARGETS.map(renderSideToggle)}
      {!openTargets.chancellor && !openTargets.qintian ? (
        <button
          type="button"
          data-testid="rails-toggle"
          onClick={() => {
            if (!openTargets.chancellor) openTarget('chancellor');
            if (!openTargets.qintian) openTarget('qintian');
          }}
          className="absolute -top-8 left-1/2 z-20 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] text-[#F5E9C9] transition hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F0C66A]/50"
          style={{ borderColor: 'rgba(240,198,106,0.30)', background: DOCK_BACKGROUND }}
        >
          展开辅政
        </button>
      ) : null}
      {intelPanelOpen ? (
        <div className="absolute bottom-full right-2 z-30 mb-2">
          <IntelBriefPanel onClose={() => setIntelPanelOpen(false)} />
        </div>
      ) : null}

      <div
        className="relative grid w-full grid-cols-[var(--dock-side-width)_minmax(0,1fr)_var(--dock-side-width)] items-center gap-0 border-x-0 border-b-0 border-t px-0 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2"
        style={{
          borderColor: 'rgba(240,198,106,0.30)',
          background: DOCK_BACKGROUND,
          boxShadow: '0 -18px 54px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(18px)',
        }}
      >
        {dockButtons.map((item) => {
          const meta = TARGET_META[item.target];
          const active = openTargets[item.target];
          return (
            <Fragment key={item.target}>
            <button
              type="button"
              onClick={() => openTarget(item.target)}
              className={`group relative z-10 inline-flex w-full min-w-0 appearance-none items-center gap-3 border-0 bg-transparent py-1.5 text-left transition-all hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F0C66A]/50 sm:h-12 ${
                item.target === 'qintian'
                  ? 'justify-self-stretch pl-2 pr-3 sm:flex-row-reverse sm:pl-4 sm:pr-6 sm:text-right lg:pr-10'
                  : 'justify-self-stretch pl-3 pr-2 sm:pl-6 sm:pr-4 lg:pl-10'
              }`}
              aria-pressed={active}
              aria-label={`${active ? '收起' : '展开'}${meta.title}面板`}
            >
              <span className="relative inline-flex shrink-0">
                <AdvisorPortrait meta={meta} icon={item.icon} variant="plain" />
                {item.target === 'qintian' && realIntelCount > 0 ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIntelPanelOpen((v) => !v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        setIntelPanelOpen((v) => !v);
                      }
                    }}
                    className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 cursor-pointer items-center justify-center rounded-full px-1 text-[9px] font-bold text-black"
                    style={{ background: '#F0C66A' }}
                    aria-label={`查看${realIntelCount}条锦衣卫新情报`}
                  >
                    {realIntelCount}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0">
                <span
                  className="block truncate text-[11.5px] font-semibold tracking-[0.08em] transition-colors"
                  style={{ color: active ? meta.accent : '#F5E9C9', fontFamily: 'var(--font-serif)' }}
                >
                  {meta.title}
                </span>
                <span className="hidden truncate text-[10px] text-[#8F835F] md:block">
                  {meta.subtitle}
                </span>
              </span>
            </button>
            {item.target === 'chancellor' ? (
              <div className="relative z-10 min-w-0 justify-self-center w-full max-w-[1180px]">
                {centerSlot}
              </div>
            ) : null}
            </Fragment>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes footerDrawerFromLeft {
          from { opacity: 0; transform: translateX(-100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes footerDrawerFromRight {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes footerDrawerToLeft {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 1; transform: translateX(-100%); }
        }
        @keyframes footerDrawerToRight {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 1; transform: translateX(100%); }
        }
        .global-edict-chat-input {
          height: 32px;
          border: 1px solid rgba(240, 198, 106, 0.16);
          border-radius: 0;
          outline: none !important;
          background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(0,0,0,0.16));
          box-shadow: inset 0 1px 0 rgba(245,233,201,0.035);
          transition:
            border-color 180ms ease,
            box-shadow 180ms ease,
            background 180ms ease;
        }
        .global-edict-chat-input:hover {
          border-color: rgba(240, 198, 106, 0.24);
          background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(0,0,0,0.18));
        }
        .global-edict-chat-input:focus,
        .global-edict-chat-input:focus-visible {
          border-color: color-mix(in srgb, var(--chat-accent) 52%, transparent) !important;
          outline: none !important;
          box-shadow:
            inset 0 1px 0 rgba(245,233,201,0.08),
            0 0 0 1px color-mix(in srgb, var(--chat-accent) 14%, transparent),
            0 0 14px color-mix(in srgb, var(--chat-accent) 14%, transparent) !important;
          background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(0,0,0,0.22));
        }
      `}</style>
    </div>
  );
}
