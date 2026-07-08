'use client';

import Link from 'next/link';
import { FormEvent, MouseEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Coins,
  Gavel,
  History,
  LogIn,
  Network,
  Rocket,
  ScrollText,
  SearchCheck,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

const DEFAULT_PROMPT = '这个客户该不该降价签？';

const NAV_LINKS = [
  { href: '#pain-points', label: '企业痛点' },
  { href: '#solution', label: '解决方案' },
  { href: '#use-cases', label: '适用场景' },
  { href: '#conversion', label: '预约体验' },
];

const HERO_PAIN_TAGS = ['老板被小事淹没', '部门信息割裂', 'AI 输出不可追责', '增长动作失控'];

const STAGES = [
  { label: '上书房', value: '收问题' },
  { label: '六部', value: '查证据' },
  { label: '军机处', value: '会审' },
  { label: '东宫', value: '代办' },
  { label: '史馆', value: '归档' },
];

const PAIN_POINTS = [
  {
    icon: AlertTriangle,
    pain: '老板每天被小事打断',
    oldWay: '群聊、会议、口头判断来回拉扯，真正该拍板的事被埋住。',
    courtWay: '朝堂 OS 只把高风险、不可逆、要花钱的事项呈到你面前。',
  },
  {
    icon: Network,
    pain: '部门信息割裂',
    oldWay: '销售讲客户、财务讲预算、交付讲排期，没人把矛盾合成一个判断。',
    courtWay: '六部并行回奏，军机处把冲突意见压成一张待裁奏折。',
  },
  {
    icon: ClipboardList,
    pain: 'AI 产出不可追责',
    oldWay: '问一次 AI 得一段文字，来源、假设、风险和下一步都散了。',
    courtWay: '每次判断带证据、风险、后令和史馆归档，方便复盘和复用。',
  },
  {
    icon: Coins,
    pain: '增长动作容易失控',
    oldWay: '降价、投放、供应商承诺一冲动就执行，事后才知道代价。',
    courtWay: '付款、签约、公开承诺、战略转向一律伏候圣裁。',
  },
];

const PROOF_ITEMS = [
  { icon: ScrollText, title: '上书房', body: '把一句问题变成可审、可派、可追踪的奏折。' },
  { icon: Building2, title: '六部', body: '财务、市场、交付、风险、情报同时回奏。' },
  { icon: Gavel, title: '军机处', body: '冲突意见集中到一处，只留下关键准驳。' },
  { icon: History, title: '史馆', body: '每次裁断沉淀为旧案，下次自动引用。' },
];

const METRICS = [
  { label: '核心入口', value: '5 殿' },
  { label: '权责边界', value: '2 轨' },
  { label: '裁断方式', value: '准 / 驳' },
];

const USE_CASES = [
  {
    icon: SearchCheck,
    title: '客户要降价，签不签？',
    owner: '销售 / 财务 / 老板',
    result: '输出条件式报价、毛利红线、回款节点和准驳建议。',
  },
  {
    icon: Rocket,
    title: '是否加大投放？',
    owner: '市场 / 增长',
    result: '同步 ROI、竞品情报、现金流压力和止损条件。',
  },
  {
    icon: UsersRound,
    title: '供应商要独家合作？',
    owner: '采购 / 法务 / 交付',
    result: '识别锁定风险、违约条款、交付窗口和替代方案。',
  },
];

function CourtEmblem() {
  return (
    <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center" aria-hidden>
      <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="welcome-emblem-g" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFE9B8" />
            <stop offset="0.5" stopColor="#F0C66A" />
            <stop offset="1" stopColor="#C99A3F" />
          </linearGradient>
          <radialGradient id="welcome-emblem-pearl" cx="0.4" cy="0.35" r="0.65">
            <stop stopColor="#FFF7E2" />
            <stop offset="1" stopColor="#E3B259" />
          </radialGradient>
        </defs>

        <path
          d="M44 27 C55 31 56 45 46 51 C36 56 23 54 18 44 C14 36 17 28 26 27"
          stroke="url(#welcome-emblem-g)"
          strokeWidth="6.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M26 27 C30 26 33 29 31 33" stroke="url(#welcome-emblem-g)" strokeWidth="4" strokeLinecap="round" />
        <path d="M52 33 l4.5 -1.5 M53 46 l4 2 M34 55 l0.5 4.5" stroke="url(#welcome-emblem-g)" strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M44 27 C49 22 49 13 42 10.5 C36 8 29 10 28.5 16 C24 16 21 19 23 23 C20 24 20 28 24 28 C24 31 28 32 31 30 C36 31 41 30 44 27 Z"
          fill="url(#welcome-emblem-g)"
        />
        <path d="M23 23 C26 24 30 24 33 22" stroke="#2E2008" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M42 10.5 C46 5 53 5 54 10" stroke="url(#welcome-emblem-g)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M35 10 C36 4.5 41 3.5 43.5 6.5" stroke="url(#welcome-emblem-g)" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M22 25 C16 27 12 25 10 20" stroke="url(#welcome-emblem-g)" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M24 28.5 C20 31 17 31 14 29" stroke="url(#welcome-emblem-g)" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="38" cy="17" r="2.1" fill="#2E2008" />
        <circle cx="26" cy="21.5" r="1" fill="#2E2008" />
        <circle cx="10" cy="32" r="3.8" fill="url(#welcome-emblem-pearl)" />
      </svg>
    </span>
  );
}

function buildDemo(question: string) {
  const normalized = question.trim() || DEFAULT_PROMPT;
  const isPricing = /降价|报价|客户|签/.test(normalized);

  if (isPricing) {
    return {
      title: '客户降价签约 · 待裁奏折',
      evidence: ['户部：降价后毛利低于 18%', '礼部：续约概率提升至 72%', '锦衣卫：竞品本周有低价口径'],
      risk: '若无条件降价，会形成长期价格锚点。',
      next: '给条件式报价：换年度预付、案例授权、回款节点。',
    };
  }

  return {
    title: '经营事项 · 待裁奏折',
    evidence: ['上书房：问题已拆成三条判断线', '六部：需补齐预算、客户、风险证据', '军机处：建议先限定 48 小时试行'],
    risk: '信息尚不足，直接执行会放大不确定性。',
    next: '先下小令：补证、设限、回传，再请您准驳。',
  };
}

export function WelcomeGate() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [submittedPrompt, setSubmittedPrompt] = useState(DEFAULT_PROMPT);
  const [isDeparting, setIsDeparting] = useState(false);
  const demo = useMemo(() => buildDemo(submittedPrompt), [submittedPrompt]);

  function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedPrompt(prompt.trim() || DEFAULT_PROMPT);
  }

  function ceremonialNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    if (isDeparting) return;
    setIsDeparting(true);
    window.setTimeout(() => router.push(href), 620);
  }

  return (
    <main className={`welcome-vision-page min-h-screen overflow-x-hidden bg-[#04060E] text-[#EAEEFB] ${isDeparting ? 'is-departing' : ''}`}>
      <section className="relative min-h-[88svh] overflow-hidden border-b border-[#F0C66A]/12">
        <div
          aria-hidden
          className="welcome-vision-bg absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url("${withBasePath('/assets/intro/courtos-vision-hero.png')}")`,
          }}
        />
        <div className="welcome-vision-depth absolute inset-0" aria-hidden />
        <div className="welcome-vision-axis absolute inset-0" aria-hidden>
          <svg className="welcome-lightning-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <defs>
              <filter id="welcome-lightning-warp" x="-80%" y="-20%" width="260%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.018 0.12" numOctaves="2" seed="8" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" />
                <feGaussianBlur stdDeviation="0.45" result="soft" />
                <feMerge>
                  <feMergeNode in="soft" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="welcome-lightning-glow" x="-120%" y="-30%" width="340%" height="160%">
                <feGaussianBlur stdDeviation="9" result="wideGlow" />
                <feGaussianBlur stdDeviation="2.2" result="tightGlow" />
                <feMerge>
                  <feMergeNode in="wideGlow" />
                  <feMergeNode in="tightGlow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g className="welcome-lightning-glow" filter="url(#welcome-lightning-glow)">
              <path d="M508 14 L478 98 L525 166 L492 239 L532 318 L468 402 L515 484 L486 579 L528 674 L472 789 L508 986" />
            </g>
            <g className="welcome-lightning-core" filter="url(#welcome-lightning-warp)">
              <path className="welcome-lightning-main" d="M508 14 L478 98 L525 166 L492 239 L532 318 L468 402 L515 484 L486 579 L528 674 L472 789 L508 986" />
              <path className="welcome-lightning-branch welcome-lightning-branch-a" d="M501 172 L430 218 L396 284 L342 319" />
              <path className="welcome-lightning-branch welcome-lightning-branch-b" d="M517 312 L584 361 L628 433 L700 472" />
              <path className="welcome-lightning-branch welcome-lightning-branch-c" d="M493 506 L429 562 L391 641 L314 694" />
              <path className="welcome-lightning-branch welcome-lightning-branch-d" d="M520 670 L586 722 L651 771" />
              <path className="welcome-lightning-branch welcome-lightning-branch-e" d="M485 756 L438 824 L394 887" />
            </g>
            <path className="welcome-lightning-afterglow" d="M508 14 L478 98 L525 166 L492 239 L532 318 L468 402 L515 484 L486 579 L528 674 L472 789 L508 986" />
          </svg>
        </div>
        <div className="welcome-vision-glass absolute inset-0" aria-hidden />
        <div className="welcome-vision-exit absolute inset-0" aria-hidden />
        <div className="welcome-vision-light absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,230,150,0.34),transparent_23%),radial-gradient(circle_at_18%_34%,rgba(38,160,214,0.26),transparent_27%),radial-gradient(circle_at_82%_28%,rgba(185,56,86,0.24),transparent_25%)] mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,3,10,0.1)_0%,rgba(4,6,14,0.2)_46%,rgba(4,6,14,0.8)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,6,14,0.46)_0%,rgba(4,6,14,0.05)_44%,rgba(4,6,14,0.5)_100%)]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.075]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(240,198,106,1) 1px, transparent 1px), linear-gradient(90deg, rgba(240,198,106,1) 1px, transparent 1px)',
            backgroundSize: '96px 96px',
          }}
        />

        <header className="relative z-10 mx-auto grid w-full max-w-[1220px] grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 md:grid-cols-[auto_1fr_auto] md:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="朝堂 OS 首页">
            <CourtEmblem />
            <span>
              <span className="block text-[15px] font-semibold tracking-[0.12em] text-[#F6EFD8]" style={{ fontFamily: 'var(--font-serif)' }}>
                朝堂 OS
              </span>
              <span className="block text-[10px] tracking-[0.22em] text-[#8F835F]">COURTOS</span>
            </span>
          </Link>

          <nav
            className="col-span-2 order-3 flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/18 p-1 backdrop-blur-md md:col-span-1 md:order-none md:mx-auto md:overflow-visible"
            aria-label="欢迎页导航"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-[12px] font-medium text-[#C6CCE0] transition hover:bg-[#F0C66A]/10 hover:text-[#F0C66A]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <nav className="flex items-center gap-2" aria-label="注册登录入口">
            <Link
              href="/login"
              onClick={(event) => ceremonialNavigate(event, '/login')}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 bg-black/18 px-3 text-[12px] text-[#D8DEEF] backdrop-blur-md transition hover:border-[#F0C66A]/35 hover:text-[#F0C66A]"
            >
              <LogIn size={13} />
              已有账号
            </Link>
            <Link
              href="/register"
              onClick={(event) => ceremonialNavigate(event, '/register')}
              className="hidden h-9 items-center gap-1.5 rounded-full bg-[#F0C66A] px-4 text-[12px] font-semibold text-[#04060E] shadow-[0_0_24px_rgba(240,198,106,0.28)] transition hover:brightness-110 sm:inline-flex"
            >
              创建朝堂
              <ArrowRight size={13} />
            </Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-[1220px] flex-col items-center px-4 pb-8 pt-8 text-center md:px-8 md:pb-12 md:pt-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#F0C66A]/25 bg-black/24 px-3 py-1.5 text-[11px] tracking-[0.18em] text-[#F5D891] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3DD68C] shadow-[0_0_12px_rgba(61,214,140,0.85)]" />
            AI 决策操作系统
          </div>

          <h1 className="mt-5 max-w-[920px] text-[42px] font-black leading-[1.08] text-[#F6EFD8] md:text-[72px]" style={{ fontFamily: 'var(--font-serif)' }}>
            朝堂 OS
          </h1>
          <p className="mt-4 max-w-[840px] text-[22px] font-semibold leading-[1.38] text-[#F2DFAC] md:text-[36px]" style={{ fontFamily: 'var(--font-serif)' }}>
            把你的公司，交给一座会思考的朝堂
          </p>
          <p className="mt-4 max-w-[760px] text-[14px] leading-7 text-[#C6CCE0] md:text-[16px] md:leading-8">
            专为老板决策太慢、部门信息割裂、AI 结果不可追责的企业设计。上书房接问题，六部查证，军机处会审，东宫代办，史馆归档。你只裁断关键事项。
          </p>

          <div className="mt-4 flex max-w-[760px] flex-wrap justify-center gap-2">
            {HERO_PAIN_TAGS.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-black/22 px-3 py-1.5 text-[12px] text-[#D8C799] backdrop-blur-md">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-6 flex w-full max-w-[520px] flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              onClick={(event) => ceremonialNavigate(event, '/register')}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#F0C66A,#D4A84B)] px-6 text-[14px] font-bold text-[#04060E] shadow-[0_0_32px_rgba(240,198,106,0.32)] transition hover:brightness-110"
            >
              创建朝堂
              <ArrowRight size={15} />
            </Link>
            <a
              href="#pain-points"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/14 bg-black/22 px-6 text-[14px] font-semibold text-[#EAEEFB] backdrop-blur-md transition hover:border-[#F0C66A]/35 hover:text-[#F0C66A]"
            >
              先看解决什么痛点
              <ArrowRight size={15} />
            </a>
          </div>

          <div
            id="demo"
            className="mt-7 w-full max-w-[920px] scroll-mt-6 rounded-lg border border-[#F0C66A]/22 bg-[#050711]/78 p-3 text-left shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl md:mt-8 md:p-4"
          >
            <form onSubmit={submitDemo} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" aria-label="试问朝堂">
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">试问朝堂</span>
                <input
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-[13px] text-[#F5E9C9] outline-none transition placeholder:text-[#6A7299] focus:border-[#F0C66A]/45"
                  placeholder={DEFAULT_PROMPT}
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-1.5 self-end rounded-lg border border-[#F0C66A]/35 bg-[#F0C66A]/12 px-4 text-[12px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
              >
                <ScrollText size={14} />
                生成奏折
              </button>
            </form>

            <div className="mt-3 grid gap-3 md:mt-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="hidden rounded-lg border border-white/8 bg-white/[0.025] p-3 md:block">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">朝堂链路</div>
                  <span className="rounded-full border border-[#3DD68C]/25 bg-[#3DD68C]/10 px-2 py-0.5 text-[10px] text-[#B9F6D2]">
                    静态预览
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {STAGES.map((stage) => (
                    <div key={stage.label} className="rounded-md border border-[#6BA0FF]/16 bg-[#6BA0FF]/[0.055] px-2 py-2 text-center">
                      <div className="text-[10px] text-[#8F9CC5]">{stage.label}</div>
                      <div className="mt-1 text-[11px] font-semibold text-[#CFE0FF]">{stage.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-md border border-[#F0C66A]/16 bg-[#F0C66A]/[0.055] px-3 py-2 text-[12px] leading-6 text-[#D8C799]">
                  “{submittedPrompt.trim() || DEFAULT_PROMPT}”
                </div>
              </div>

              <div className="rounded-lg border border-[#F0C66A]/20 bg-[#F0C66A]/[0.05] p-3" aria-live="polite">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">奏折预览</div>
                    <h2 className="mt-1 text-[17px] font-semibold text-[#F6EFD8]" style={{ fontFamily: 'var(--font-serif)' }}>
                      {demo.title}
                    </h2>
                  </div>
                  <span className="rounded-full border border-[#F43F5E]/25 bg-[#F43F5E]/10 px-2.5 py-1 text-[11px] text-[#FCA5A5]">
                    伏候圣裁
                  </span>
                </div>
                <div className="mt-3 hidden gap-2 md:grid md:grid-cols-3">
                  {demo.evidence.map((item) => (
                    <div key={item} className="rounded-md border border-white/8 bg-black/18 px-2.5 py-2 text-[11px] leading-5 text-[#C8D0E7]">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-md border border-[#3DD68C]/18 bg-[#3DD68C]/[0.06] px-3 py-2 text-[12px] leading-6 text-[#C7F0D9] sm:hidden">
                  <span className="mr-2 text-[10px] tracking-[0.18em] text-[#B9F6D2]">下一步</span>
                  {demo.next}
                </div>
                <div className="mt-3 hidden gap-2 sm:grid md:grid-cols-2">
                  <div className="rounded-md border border-[#F43F5E]/18 bg-[#F43F5E]/[0.06] px-3 py-2">
                    <div className="text-[10px] tracking-[0.18em] text-[#FCA5A5]">风险</div>
                    <p className="mt-1 text-[12px] leading-6 text-[#EEC4CA]">{demo.risk}</p>
                  </div>
                  <div className="rounded-md border border-[#3DD68C]/18 bg-[#3DD68C]/[0.06] px-3 py-2">
                    <div className="text-[10px] tracking-[0.18em] text-[#B9F6D2]">下一步</div>
                    <p className="mt-1 text-[12px] leading-6 text-[#C7F0D9]">{demo.next}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pain-points" className="scroll-mt-4 border-b border-white/8 bg-[#04060E] px-4 py-10 md:px-8 md:py-14" aria-label="企业痛点">
        <div className="mx-auto max-w-[1220px]">
          <div className="max-w-[760px]">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#8F835F]">PAIN POINTS</div>
            <h2 className="mt-2 text-[24px] font-semibold text-[#F6EFD8] md:text-[36px]" style={{ fontFamily: 'var(--font-serif)' }}>
              企业不是缺 AI，是缺一套可追责的决策系统
            </h2>
            <p className="mt-3 text-[14px] leading-7 text-[#AEB7D1]">
              朝堂 OS 不把 AI 包装成聊天框，而是把企业每天最耗老板精力的判断，变成可审、可派、可复盘的经营闭环。
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {PAIN_POINTS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.pain} className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-md border border-[#F43F5E]/22 bg-[#F43F5E]/10 text-[#FCA5A5]">
                    <Icon size={17} />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold text-[#F6EFD8]" style={{ fontFamily: 'var(--font-serif)' }}>
                    {item.pain}
                  </h3>
                  <p className="mt-3 text-[12px] leading-6 text-[#AEB7D1]">
                    <span className="mr-1 text-[#FCA5A5]">今天：</span>
                    {item.oldWay}
                  </p>
                  <p className="mt-2 text-[12px] leading-6 text-[#C7F0D9]">
                    <span className="mr-1 text-[#B9F6D2]">朝堂：</span>
                    {item.courtWay}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="solution"
        className="relative scroll-mt-4 border-b border-white/8 bg-[#050711] px-4 py-8 md:px-8 md:py-12"
        aria-label="入朝后第一条闭环"
      >
        <div className="mx-auto grid max-w-[1220px] gap-4 md:grid-cols-[0.95fr_1.05fr] md:items-center">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#8F835F]">FIRST LOOP</div>
            <h2 className="mt-2 text-[24px] font-semibold text-[#F6EFD8] md:text-[34px]" style={{ fontFamily: 'var(--font-serif)' }}>
              从一个问题，到一个可执行裁断
            </h2>
            <p className="mt-3 text-[13px] leading-7 text-[#AEB7D1]">
              用户不用理解复杂系统，先问一件真事：朝堂会自动把它送入上书房、六部、军机处、东宫和史馆。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {METRICS.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/8 bg-white/[0.025] px-4 py-3">
                <div className="text-[11px] text-[#8F95AD]">{item.label}</div>
                <div className="mt-1 text-[18px] font-semibold text-[#F0C66A]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-5 grid max-w-[1220px] gap-2 md:grid-cols-5">
          {STAGES.map((stage, index) => (
            <div key={stage.label} className="rounded-lg border border-[#6BA0FF]/14 bg-[#6BA0FF]/[0.045] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#8F9CC5]">0{index + 1}</span>
                <span className="text-[10px] text-[#F0C66A]">{stage.value}</span>
              </div>
              <div className="mt-2 text-[15px] font-semibold text-[#CFE0FF]" style={{ fontFamily: 'var(--font-serif)' }}>
                {stage.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="use-cases" className="scroll-mt-4 bg-[#04060E] px-4 py-10 md:px-8 md:py-14" aria-label="朝堂能力">
        <div className="mx-auto max-w-[1220px]">
          <div className="grid gap-5 md:grid-cols-[0.82fr_1.18fr] md:items-end">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[#8F835F]">USE CASES</div>
              <h2 className="mt-2 text-[24px] font-semibold text-[#F6EFD8] md:text-[34px]" style={{ fontFamily: 'var(--font-serif)' }}>
                先服务最常见的老板决策
              </h2>
            </div>
            <p className="text-[13px] leading-7 text-[#AEB7D1]">
              教学宣传页的第一任务不是讲概念，而是让客户立刻对号入座：这是不是我每天都在处理的经营难题。
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {USE_CASES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-[#F0C66A]/14 bg-[#F0C66A]/[0.045] p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-md border border-[#F0C66A]/24 bg-[#F0C66A]/10 text-[#F0C66A]">
                    <Icon size={16} />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold text-[#F6EFD8]" style={{ fontFamily: 'var(--font-serif)' }}>
                    {item.title}
                  </h3>
                  <div className="mt-2 text-[11px] text-[#8F95AD]">{item.owner}</div>
                  <p className="mt-3 text-[13px] leading-7 text-[#C6CCE0]">{item.result}</p>
                </article>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {PROOF_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="mt-0 rounded-lg border border-white/8 bg-white/[0.025] p-4 md:mt-6">
                  <span className="grid h-9 w-9 place-items-center rounded-md border border-[#F0C66A]/24 bg-[#F0C66A]/10 text-[#F0C66A]">
                    <Icon size={16} />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold text-[#F6EFD8]" style={{ fontFamily: 'var(--font-serif)' }}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-7 text-[#AEB7D1]">{item.body}</p>
                </article>
              );
            })}
          </div>

          <div
            id="conversion"
            className="mt-8 flex scroll-mt-4 flex-col items-center justify-between gap-4 rounded-lg border border-[#F0C66A]/18 bg-[#F0C66A]/[0.045] px-5 py-5 sm:flex-row"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-md border border-[#3DD68C]/25 bg-[#3DD68C]/10 text-[#B9F6D2]">
                <ShieldCheck size={16} />
              </span>
              <div>
                <div className="text-[15px] font-semibold text-[#F6EFD8]">预约体验，保存你的第一座朝堂</div>
                <div className="mt-1 text-[12px] leading-6 text-[#AEB7D1]">
                  留资入口直接进入注册；已有账号可登录继续。所有按钮都指向真实页面或本页有效区块。
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <a
                href="#demo"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-black/18 px-5 text-[13px] font-semibold text-[#EAEEFB] transition hover:border-[#F0C66A]/35 hover:text-[#F0C66A]"
              >
                再看奏折
                <ScrollText size={15} />
              </a>
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#F0C66A] px-5 text-[13px] font-bold text-[#04060E] transition hover:brightness-110"
              >
                创建朝堂
                <CheckCircle2 size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
