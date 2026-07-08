'use client';

/**
 * ChaotangTopNav · 朝堂 OS 全局顶部导航(原 shangshufang demo 的电影感横向导航)
 *
 * 现挂在 (dashboard)/layout.tsx, 9 个部门 dashboard 页面共用同一条顶导。
 *
 * 左:    朝堂 OS 徽记 + 副标
 * 中:    9 部门导航 — Link + usePathname 自动 active 高亮
 * 右:    干支日期 + 通知铃 + 帮助 + 头像/退出
 *
 * 帮助按钮通过 window 自定义事件 'court:open-help' 触发,
 * 让具体页面(如 ShangshufangPage)按需挂载监听打开自己的教学弹窗。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Bell, Brain, Building2, Cpu, HelpCircle, Images, LogOut, ShieldCheck, UserRound } from 'lucide-react';

import { withBasePath } from '@/lib/base-path';

import { CORE_NAV } from '../constants';

const GOLD = '#F0C66A';
function navSlotWidth(label: string): number {
  return label.length >= 3 ? 88 : 74;
}

const ROLE_VIEW_LINKS = [
  { label: '企业家', href: '/shangshufang', icon: Building2, tone: '#F0C66A' },
  { label: 'AI爱好者', href: '/shangshufang?audience=ai_enthusiast', icon: Brain, tone: '#7DD3FC' },
  { label: 'AI极客', href: '/shangshufang?audience=ai_geek', icon: Cpu, tone: '#A7F3D0' },
] as const;

const CAPABILITY_ROWS = [
  {
    label: '真模型',
    status: '可用',
    tone: '#3DD68C',
    detail: '/api/chat 与军机处会审已接 OpenAI-compatible 模型；当前健康项显示 DeepSeek key 已配置。',
  },
  {
    label: '真编排',
    status: '可用',
    tone: '#3DD68C',
    detail: '军机处拆解、部门 fan-out、覆盖率、冲突上呈、台账链路已进入可运行闭环。',
  },
  {
    label: '真数据',
    status: '有边界',
    tone: '#F5A524',
    detail: 'Turso / jiqun 可用时走真实数据；健康页 degraded 时明确按 fallback 展示。',
  },
  {
    label: '演示样板',
    status: '样板',
    tone: '#9AA3C4',
    detail: '庄园、部分部门、情报和档案页仍保留 mock / seed 数据用于路演。',
  },
] as const;

type CapabilityDebtState = 'ready' | 'degraded' | 'down' | 'missing' | 'mock';
type CapabilityDebtKind = 'runtime' | 'database' | 'backend' | 'llm' | 'queue' | 'auth' | 'storage' | 'mock';

interface TrueChainCheck {
  key: string;
  label: string;
  kind: CapabilityDebtKind;
  state: CapabilityDebtState;
  live: boolean;
  detail: string;
  requiredForLive?: boolean;
}

interface TrueChainPayload {
  success: boolean;
  data?: {
    healthLayer?: 'public' | 'authenticated' | 'production';
    releaseTier?: string;
    summary?: {
      ready: number;
      degraded: number;
      down: number;
      mock: number;
      missing: number;
      requiredDown: number;
    };
    checks?: TrueChainCheck[];
    recommendation?: string;
  };
}

const STATE_META: Record<CapabilityDebtState, { label: string; tone: string; rank: number }> = {
  ready: { label: '就绪', tone: '#3DD68C', rank: 5 },
  degraded: { label: '降级', tone: '#F5A524', rank: 3 },
  down: { label: '不可用', tone: '#F43F5E', rank: 1 },
  missing: { label: '缺配置', tone: '#F43F5E', rank: 0 },
  mock: { label: '样板', tone: '#9AA3C4', rank: 4 },
};

const KIND_OWNER: Record<CapabilityDebtKind, string> = {
  runtime: '工部',
  database: '工部/史馆',
  backend: '军机处',
  llm: '钦天监',
  queue: '工部',
  auth: '锦衣卫',
  storage: '史馆',
  mock: '礼部',
};

const KIND_MINISTERS: Record<CapabilityDebtKind, string[]> = {
  runtime: ['工部', '军机处'],
  database: ['工部', '史馆'],
  backend: ['军机处', '工部'],
  llm: ['钦天监', '工部'],
  queue: ['工部', '军机处'],
  auth: ['锦衣卫', '工部'],
  storage: ['史馆', '工部'],
  mock: ['礼部', '工部', '史馆'],
};

const HEALTH_LAYER_LABEL: Record<'public' | 'authenticated' | 'production', string> = {
  public: '公开体检',
  authenticated: '登录体检',
  production: '生产体检',
};

function nextActionForDebt(check: TrueChainCheck): string {
  if (check.requiredForLive && (check.state === 'down' || check.state === 'missing')) {
    return '先补关键依赖，再允许对外宣称全真链路。';
  }
  if (check.state === 'missing') return '补配置或接生产服务。';
  if (check.state === 'down') return '拉起服务并加健康探针。';
  if (check.state === 'mock') return '继续明示演示边界，排期替换真数据。';
  if (check.state === 'degraded') return '保留可用闭环，同时补可靠性。';
  return '保持监控。';
}

function summarizeDetail(detail: string): string {
  return detail.split('；')[0]?.split('. ')[0]?.slice(0, 72) || detail.slice(0, 72);
}

function buildDebtFixHref(check: TrueChainCheck): string {
  const meta = STATE_META[check.state];
  const nextAction = nextActionForDebt(check);
  const summary = summarizeDetail(check.detail);
  const params = new URLSearchParams({
    origin: 'capability-debt',
    source: `能力债务榜 · ${check.key}`,
    suggestion: `把 ${check.label} 从 ${meta.label} 推进到就绪`,
    evidence: [
      `状态：${meta.label}`,
      `责任域：${KIND_OWNER[check.kind]}`,
      `详情：${summary}`,
      `真实链路必需：${check.requiredForLive ? '是' : '否'}`,
    ].join('\n'),
    ministers: KIND_MINISTERS[check.kind].join(','),
    intent: `修复能力债务：${check.label}。当前状态 ${meta.label}；责任域 ${KIND_OWNER[check.kind]}；影响：${summary}；下一步：${nextAction} 请由工部形成修复方案，军机处复核，史馆归档验收证据。`,
  });
  return `/junjichu?${params.toString()}`;
}

/** 圆形团龙徽记 — 盘龙戏珠，帝金描边。中国传统团龙徽章造型。 */
function CourtEmblem() {
  return (
    <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center" aria-hidden>
      <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="emblem-g" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFE9B8" />
            <stop offset="0.5" stopColor="#F0C66A" />
            <stop offset="1" stopColor="#C99A3F" />
          </linearGradient>
          <radialGradient id="emblem-pearl" cx="0.4" cy="0.35" r="0.65">
            <stop stopColor="#FFF7E2" />
            <stop offset="1" stopColor="#E3B259" />
          </radialGradient>
        </defs>

        {/* 龙身 · 粗笔盘成团（无外环） */}
        <path
          d="M44 27 C55 31 56 45 46 51 C36 56 23 54 18 44 C14 36 17 28 26 27"
          stroke="url(#emblem-g)"
          strokeWidth="6.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 龙尾 · 收口 */}
        <path d="M26 27 C30 26 33 29 31 33" stroke="url(#emblem-g)" strokeWidth="4" strokeLinecap="round" />

        {/* 背鳍 / 龙爪 */}
        <path d="M52 33 l4.5 -1.5 M53 46 l4 2 M34 55 l0.5 4.5"
          stroke="url(#emblem-g)" strokeWidth="2.2" strokeLinecap="round" />

        {/* 大龙首 · 朝左张口戏珠 */}
        <path
          d="M44 27 C49 22 49 13 42 10.5 C36 8 29 10 28.5 16 C24 16 21 19 23 23 C20 24 20 28 24 28 C24 31 28 32 31 30 C36 31 41 30 44 27 Z"
          fill="url(#emblem-g)"
        />
        {/* 张口（龙唇分界） */}
        <path d="M23 23 C26 24 30 24 33 22" stroke="#2E2008" strokeWidth="1.6" strokeLinecap="round" />
        {/* 双角 · 后扫 */}
        <path d="M42 10.5 C46 5 53 5 54 10" stroke="url(#emblem-g)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M35 10 C36 4.5 41 3.5 43.5 6.5" stroke="url(#emblem-g)" strokeWidth="1.9" strokeLinecap="round" />
        {/* 飘须 */}
        <path d="M22 25 C16 27 12 25 10 20" stroke="url(#emblem-g)" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M24 28.5 C20 31 17 31 14 29" stroke="url(#emblem-g)" strokeWidth="1.3" strokeLinecap="round" />
        {/* 龙目（大） + 鼻 */}
        <circle cx="38" cy="17" r="2.1" fill="#2E2008" />
        <circle cx="26" cy="21.5" r="1" fill="#2E2008" />

        {/* 火焰宝珠 · 龙戏珠 */}
        <circle cx="10" cy="32" r="3.8" fill="url(#emblem-pearl)" />
      </svg>
    </span>
  );
}

function useCourtClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function dispatchHelpEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('court:open-help'));
}

function useCapabilityDebt(enabled: boolean) {
  const [payload, setPayload] = useState<TrueChainPayload['data'] | null>(null);
  const [failed, setFailed] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window !== 'undefined' && !window.localStorage.getItem('courtos.auth')) {
      setSkipped(true);
      return;
    }
    const controller = new AbortController();
    setSkipped(false);
    fetch(withBasePath('/api/court/true-chain-health'), {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`true-chain ${res.status}`))))
      .then((json: TrueChainPayload) => {
        setPayload(json.success ? json.data ?? null : null);
        setFailed(!json.success);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setPayload(null);
        setFailed(true);
      });
    return () => controller.abort();
  }, [enabled]);

  return useMemo(() => {
    const checks = payload?.checks ?? [];
    const debts = checks
      .filter((check) => check.state !== 'ready')
      .sort((a, b) => {
        const requiredDelta = Number(Boolean(b.requiredForLive)) - Number(Boolean(a.requiredForLive));
        if (requiredDelta !== 0) return requiredDelta;
        return STATE_META[a.state].rank - STATE_META[b.state].rank;
      })
      .slice(0, 5);
    return { payload, debts, failed, skipped };
  }, [failed, payload, skipped]);
}

export function ChaotangTopNav({
  onLogout,
  loggingOut,
  notifyCount = 2,
  onOpenResources,
}: {
  /** 可选 · 点退出按钮时调用。不传则不渲染退出按钮。 */
  onLogout?: () => void;
  /** 可选 · 退出中态置灰按钮。 */
  loggingOut?: boolean;
  notifyCount?: number;
  /** 可选 · 打开当前页资源面板。 */
  onOpenResources?: () => void;
}) {
  const clock = useCourtClock();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [capabilityOpen, setCapabilityOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const { payload: capabilityDebt, debts, failed: capabilityDebtFailed, skipped: capabilityDebtSkipped } = useCapabilityDebt(capabilityOpen);
  const summary = capabilityDebt?.summary;
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const prefetchRoute = useCallback((href: string) => {
    if (href === pathname || prefetchedRoutesRef.current.has(href)) return;
    prefetchedRoutesRef.current.add(href);

    const run = () => router.prefetch(href);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1000 });
      return;
    }
    setTimeout(run, 120);
  }, [pathname, router]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (userMenuRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [userMenuOpen]);

  return (
    <header
      data-three-axis-topnav
      className="relative z-[220] flex h-16 flex-shrink-0 items-center gap-4 px-4 md:px-6"
      style={{
        background: 'linear-gradient(180deg, rgba(6,9,20,0.92) 0%, rgba(6,9,20,0.78) 100%)',
        borderBottom: `1px solid ${GOLD}22`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* 左 · 徽记 + 名号 */}
      <Link
        href="/shangshufang"
        prefetch={false}
        onFocus={() => prefetchRoute('/shangshufang')}
        onMouseEnter={() => prefetchRoute('/shangshufang')}
        className="flex w-[148px] flex-shrink-0 items-center gap-2.5 sm:w-[190px]"
        aria-label="返回上书房"
      >
        <CourtEmblem />
        <div className="flex flex-col leading-none">
          <span
            className="text-[15px] font-bold tracking-[0.08em]"
            style={{
              fontFamily: 'var(--font-serif)',
              background: 'linear-gradient(180deg,#FFE9B8,#D8B35A)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            朝堂 OS
          </span>
          <span className="mt-1 hidden text-[9.5px] font-medium tracking-[0.08em] text-[#B6AB8C] sm:block">
            上值朝 · AI 智能办公
          </span>
        </div>
      </Link>

      {/* 中 · 部门导航 (Link + usePathname 自感知 active) */}
      <nav className="hidden flex-1 items-center justify-center gap-1.5 lg:flex" aria-label="部门导航">
        {CORE_NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch={false}
              onFocus={() => prefetchRoute(item.href)}
              onMouseEnter={() => prefetchRoute(item.href)}
              aria-current={active ? 'page' : undefined}
              className="group relative flex h-8 flex-shrink-0 items-center justify-center text-[14px] font-medium transition-colors"
              style={{
                width: navSlotWidth(item.label),
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.01em',
                color: active ? GOLD : '#C6CEE6',
              }}
            >
              <span className="transition-colors group-hover:text-[#F0C66A]">{item.label}</span>
              {active && (
                <span
                  className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}` }}
                  aria-hidden
                />
              )}
            </Link>
          );
        })}

      </nav>

      {/* 右 · 日期 + 通知 + 帮助 + 退出 + 头像 */}
      <div className="ml-auto flex w-[176px] flex-shrink-0 items-center justify-end gap-3 sm:w-[214px] md:w-[330px] xl:w-[590px]">
        <div className="hidden items-center gap-1.5 whitespace-nowrap leading-tight xl:flex">
          <span className="text-[11px] tracking-[0.08em] text-[#C6CEE6]">甲申年 · 五月初八</span>
          <span className="text-[11px] text-[#8F835F]">{clock || '辰时'}</span>
        </div>

        <div className="group relative hidden md:block">
          <button
            type="button"
            onClick={() => {
              setCapabilityOpen((open) => !open);
            }}
            aria-haspopup="dialog"
            aria-expanded={capabilityOpen}
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[11px] text-[#C6CEE6] transition hover:border-[#3DD68C]/45 hover:text-[#B9F6D2]"
            aria-label="查看真能力与演示边界"
          >
            <ShieldCheck size={14} />
            <span className="whitespace-nowrap">能力边界</span>
          </button>
          {capabilityOpen ? createPortal(
          <div
            className="fixed right-4 top-14 max-h-[76vh] w-[410px] overflow-auto rounded-xl p-3 opacity-100 shadow-2xl transition duration-150"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              zIndex: 2147483647,
              pointerEvents: 'auto',
              background: 'linear-gradient(180deg, rgba(10,14,28,0.98), rgba(6,9,20,0.98))',
              border: '1px solid rgba(240,198,106,0.28)',
              boxShadow: '0 18px 70px rgba(0,0,0,0.55)',
            }}
            role="dialog"
            aria-label="真能力与演示边界"
          >
            <div>
              <div className="text-[12px] font-semibold tracking-[0.12em] text-[#F0C66A]">
                真能力 / 演示边界
              </div>
              <p className="mt-1 text-[11px] leading-5 text-[#9AA3C4]">
                演示时优先走真实链路；降级和样板必须明示，不伪装成真实能力。
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              {CAPABILITY_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border p-2.5"
                  style={{
                    borderColor: `${row.tone}33`,
                    background: `${row.tone}0F`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-[#EAEEFB]">{row.label}</span>
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                      style={{ color: row.tone, border: `1px solid ${row.tone}55` }}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-[#C6CEE6]">{row.detail}</p>
                </div>
              ))}
            </div>
            <div
              className="mt-3 rounded-xl border p-3"
              style={{
                borderColor: 'rgba(245,165,36,0.25)',
                background: 'rgba(245,165,36,0.06)',
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[12px] font-semibold tracking-[0.12em] text-[#F5A524]">
                      能力债务榜
                    </div>
                    {capabilityDebt?.healthLayer ? (
                      <span className="rounded border border-[#F5A524]/25 bg-[#F5A524]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#F5D891]">
                        {HEALTH_LAYER_LABEL[capabilityDebt.healthLayer]}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-[#9AA3C4]">
                    只列未就绪项：缺口、责任域、下一步都要可见，不能藏在日志里。
                  </p>
                  {capabilityDebt?.releaseTier ? (
                    <p className="mt-1 text-[10px] leading-4 text-[#6A7299]">
                      tier: {capabilityDebt.releaseTier}
                    </p>
                  ) : null}
                </div>
                {summary ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-right font-mono text-[10px] text-[#C6CEE6]">
                    <div>不可用 {summary.down}</div>
                    <div>缺配置 {summary.missing}</div>
                    <div>阻断 {summary.requiredDown}</div>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2" aria-label="能力债务列表">
                {debts.length > 0 ? (
                  debts.map((check) => {
                    const meta = STATE_META[check.state];
                    return (
                      <div
                        key={check.key}
                        className="rounded-lg border p-2.5"
                        style={{ borderColor: `${meta.tone}33`, background: `${meta.tone}0D` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-[#EAEEFB]">{check.label}</span>
                          <span
                            className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                            style={{ color: meta.tone, border: `1px solid ${meta.tone}55` }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[#C6CEE6]">
                            责任 {KIND_OWNER[check.kind]}
                          </span>
                          {check.requiredForLive ? (
                            <span className="rounded border border-[#F43F5E]/30 bg-[#F43F5E]/10 px-1.5 py-0.5 text-[#FDA4AF]">
                              真实链路必需
                            </span>
                          ) : (
                            <span className="rounded border border-[#6A7299]/30 bg-white/[0.02] px-1.5 py-0.5 text-[#9AA3C4]">
                              非阻断
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-[#C6CEE6]">{summarizeDetail(check.detail)}</p>
                        <p className="mt-1 text-[11px] leading-5 text-[#F5D891]">
                          下一步：{nextActionForDebt(check)}
                        </p>
                        <Link
                          href={buildDebtFixHref(check)}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const href = buildDebtFixHref(check);
                            setCapabilityOpen(false);
                            router.push(href);
                          }}
                          onMouseDown={(event) => event.stopPropagation()}
                          className="mt-2 inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-[10px] font-semibold leading-none text-[#9FC1FF] transition hover:border-[#9FC1FF]/55 hover:bg-[#6BA0FF]/10"
                          style={{
                            borderColor: 'rgba(107,160,255,0.28)',
                            background: 'rgba(107,160,255,0.07)',
                          }}
                        >
                          <span className="truncate">生成修复任务</span>
                          <ArrowUpRight size={12} aria-hidden />
                        </Link>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-[#3DD68C]/25 bg-[#3DD68C]/[0.06] p-2.5 text-[11px] leading-5 text-[#B9F6D2]">
                    {capabilityDebtSkipped
                      ? '登录后读取实时能力债务；未读取前只按真演边界展示，不对外宣称全真链路。'
                      : capabilityDebtFailed
                        ? '能力债务探针暂不可读；按未确认处理，不对外宣称全真链路。'
                        : '当前未发现未就绪项。'}
                  </div>
                )}
              </div>
              {capabilityDebt?.recommendation ? (
                <p className="mt-2 text-[11px] leading-5 text-[#C6CEE6]">{capabilityDebt.recommendation}</p>
              ) : null}
            </div>
            <Link
              href="/junjichu"
              className="mt-3 flex h-8 items-center justify-center rounded-md border text-[11px] font-semibold"
              style={{
                borderColor: 'rgba(240,198,106,0.35)',
                color: '#F0C66A',
                background: 'rgba(240,198,106,0.08)',
              }}
            >
              去军机处跑真闭环
            </Link>
          </div>
          , document.body) : null}
        </div>

        <div className="hidden items-center gap-1 xl:flex">
          {ROLE_VIEW_LINKS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onFocus={() => prefetchRoute(item.href)}
                onMouseEnter={() => prefetchRoute(item.href)}
                aria-current={active ? 'page' : undefined}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition"
                style={{
                  borderColor: active ? `${item.tone}66` : 'rgba(255,255,255,0.10)',
                  background: active ? `${item.tone}12` : 'rgba(255,255,255,0.03)',
                  color: active ? item.tone : '#C6CEE6',
                }}
              >
                <Icon size={13} aria-hidden />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={dispatchHelpEvent}
          className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#C6CEE6] transition hover:border-[#F0C66A]/45 hover:text-[#F0C66A]"
          aria-label={`通知 · ${notifyCount} 条未读`}
        >
          <Bell size={15} />
          {notifyCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
              style={{ background: '#E03E54', boxShadow: '0 0 6px rgba(224,62,84,0.6)' }}
            >
              {notifyCount > 9 ? '9+' : notifyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={dispatchHelpEvent}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#C6CEE6] transition hover:border-[#F0C66A]/45 hover:text-[#F0C66A]"
          aria-label="帮助 · 钦天监导师"
          title="钦天监导师"
        >
          <HelpCircle size={15} />
        </button>

        {onOpenResources ? (
          <button
            type="button"
            onClick={onOpenResources}
            className="flex h-8 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[#C6CEE6] transition hover:border-[#F0C66A]/45 hover:text-[#F0C66A]"
            aria-label="朝堂资源阁"
            title="朝堂资源阁"
          >
            <Images size={15} />
            <span className="hidden text-[11px] font-semibold md:inline">资源</span>
          </button>
        ) : null}

        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            title={loggingOut ? '退出中…' : '退出'}
            aria-label="退出"
            className="hidden"
          >
            <LogOut size={15} />
          </button>
        ) : (
          <span className="hidden h-8 w-8 flex-shrink-0 md:block" aria-hidden />
        )}

        {/* 头像 · 皇上 */}
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(240,198,106,0.28), rgba(138,106,42,0.12))',
            border: `1px solid ${GOLD}66`,
            color: '#F5E9C9',
            fontFamily: 'var(--font-serif)',
          }}
          title="皇上"
          aria-label="皇上"
        >
          皇
        </span>
        <div ref={userMenuRef} className="relative -ml-11 h-8 w-8 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setCapabilityOpen(false);
              setUserMenuOpen((open) => !open);
            }}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-label="用户菜单"
            title="用户菜单"
            className="absolute inset-0 rounded-full transition hover:shadow-[0_0_18px_rgba(240,198,106,0.22)]"
          />
          {userMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-xl py-1"
              style={{
                background: 'linear-gradient(180deg, rgba(10,14,28,0.98), rgba(8,11,22,0.98))',
                border: `1px solid ${GOLD}33`,
                boxShadow: '0 18px 56px rgba(0,0,0,0.45)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full border text-[#F0C66A]"
                  style={{ borderColor: `${GOLD}40`, background: 'rgba(240,198,106,0.08)' }}
                  aria-hidden
                >
                  <UserRound size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-[#F5E9C9]">
                    皇上
                  </span>
                  <span className="block text-[10px] font-medium tracking-[0.06em] text-[#B6AB8C]">朝堂账户</span>
                </span>
              </div>
              {onLogout ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] text-[#FDA4AF] transition hover:bg-[#F43F5E]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut size={14} aria-hidden />
                  <span>{loggingOut ? '退出中...' : '退出登录'}</span>
                </button>
              ) : (
                <div className="px-3 py-2.5 text-[12px] text-[#8F835F]">当前页面未接入退出</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
