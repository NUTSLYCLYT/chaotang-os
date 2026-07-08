'use client';

import Link from 'next/link';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { ArrowLeft, FileText, ScrollText, Send, ShieldCheck } from 'lucide-react';

import {
  COURT_CONSOLES,
  DEPT_LANDINGS,
  type CourtConsole,
  type DeptLanding,
} from '@/features/landing-merge/court-landing-data';

function cssVars(accent: string, accentSoft = accent) {
  return {
    '--landing-accent': accent,
    '--landing-accent-soft': accentSoft,
  } as CSSProperties;
}

function LandingStyles() {
  return (
    <style>{`
      .landing-noise::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: .035;
        mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      }
      @keyframes landingRise {
        from { opacity: 0; transform: translateY(26px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes landingGlow {
        0%, 100% { opacity: .45; transform: scale(.98); }
        50% { opacity: .88; transform: scale(1.02); }
      }
      .dept-card {
        opacity: 0;
        transform: translateY(34px);
        animation: landingRise .9s cubic-bezier(.19,1,.22,1) forwards;
      }
      .dept-card:hover .dept-qian {
        transform: translateY(-3px) rotate(-2deg);
        text-shadow: 0 0 22px color-mix(in oklab, var(--landing-accent) 60%, transparent);
      }
      .art-purple-ranks { grid-template-columns: 1.05fr .95fr; }
      .art-gold-ledger { grid-template-columns: .82fr 1.18fr; }
      .art-vermilion-rites { grid-template-columns: 1fr 1fr; }
      .art-iron-war { grid-template-columns: 1.2fr .8fr; }
      .art-indigo-law { grid-template-columns: .9fr 1.1fr; }
      .art-jade-works { grid-template-columns: 1fr 1fr; }
      @media (max-width: 980px) {
        .art-purple-ranks,
        .art-gold-ledger,
        .art-vermilion-rites,
        .art-iron-war,
        .art-indigo-law,
        .art-jade-works { grid-template-columns: 1fr; }
      }
      @media (max-width: 1040px) {
        .court-console-grid { grid-template-columns: 1fr; }
        .court-console-side { display: none; }
      }
    `}</style>
  );
}

export function DeptsIndexPage() {
  return (
    <main className="landing-noise relative min-h-screen overflow-hidden bg-[#05060A] text-[#EDE6D4]">
      <LandingStyles />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(212,168,75,.12), transparent 55%), radial-gradient(90% 70% at 50% 120%, rgba(74,130,240,.07), transparent 60%)',
        }}
      />
      <section className="relative z-10 mx-auto max-w-[1180px] px-[6vw] py-[9vh]">
        <header className="mb-[8vh] text-center">
          <div className="section-eyebrow text-[#D4A84B]" style={{ animation: 'landingRise 1s cubic-bezier(.19,1,.22,1) .05s both' }}>
            CHAOTANG · 六 部
          </div>
          <h1
            className="display-serif mt-5 text-[clamp(3rem,9vw,6.4rem)] font-semibold tracking-[0.1em] text-[#F0C66A]"
            style={{ textShadow: '0 0 40px rgba(212,168,75,.3)', animation: 'landingRise 1.1s cubic-bezier(.19,1,.22,1) .18s both' }}
          >
            六 部 分 曹
          </h1>
          <p
            className="mx-auto mt-3 max-w-3xl text-[15px] leading-8 tracking-[0.12em] text-[#9A937F]"
            style={{ animation: 'landingRise 1.1s cubic-bezier(.19,1,.22,1) .32s both' }}
          >
            不是模型的竞赛，是智能体军团的竞赛。一部一色，各司其职。
          </p>
          <div className="mx-auto mt-10 h-14 w-px bg-gradient-to-b from-[#D4A84B] to-transparent" />
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DEPT_LANDINGS.map((dept, index) => (
            <Link
              key={dept.slug}
              href={`/depts/${dept.slug}`}
              className="dept-card group relative isolate min-h-[260px] overflow-hidden border bg-[linear-gradient(158deg,rgba(237,230,212,.05),rgba(237,230,212,.015))] px-6 py-8 text-inherit no-underline transition duration-500 hover:-translate-y-2"
              style={{
                ...cssVars(dept.accent, dept.accentSoft),
                borderColor: `${dept.accent}30`,
                animationDelay: `${0.1 + index * 0.08}s`,
                boxShadow: '0 18px 54px -42px var(--landing-accent)',
              }}
            >
              <span
                aria-hidden
                className="absolute inset-0 -z-10 opacity-0 transition duration-500 group-hover:opacity-100"
                style={{ background: 'radial-gradient(120% 90% at 12% 0%, color-mix(in oklab, var(--landing-accent) 22%, transparent), transparent 60%)' }}
              />
              <div className="dept-qian absolute right-5 top-5 px-1 text-[2.45rem] leading-none transition duration-500 [writing-mode:vertical-rl]" style={{ color: dept.accent }}>
                {dept.name}
              </div>
              <div className="text-[11px] tracking-[0.3em]" style={{ color: dept.accent }}>{dept.heavenlyOffice}</div>
              <h2 className="display-serif mt-3 max-w-[76%] text-[22px] font-semibold text-[#F5E9C9]">{dept.functionLine}</h2>
              <p className="mt-3 max-w-[76%] text-[13px] leading-7 text-[#9A937F]">{dept.description}</p>
              <div className="mt-5 flex max-w-[76%] flex-wrap gap-1.5">
                {dept.agents.map((agent) => (
                  <span key={agent} className="border px-2.5 py-1 text-[11px]" style={{ borderColor: `${dept.accent}52`, color: dept.accentSoft }}>
                    {agent}
                  </span>
                ))}
              </div>
              <span className="mt-6 inline-flex items-center gap-2 border px-4 py-1.5 text-[12px] tracking-[0.16em] transition group-hover:bg-[var(--landing-accent)] group-hover:text-[#05060A]" style={{ borderColor: `${dept.accent}66`, color: dept.accent }}>
                入 部
              </span>
              <span className="absolute bottom-6 left-6 grid h-8 w-8 place-items-center rounded-sm border text-[13px] opacity-70" style={{ borderColor: dept.accent, color: dept.accent }}>
                {dept.short}
              </span>
            </Link>
          ))}
        </div>

        <footer className="mt-[8vh] flex flex-wrap items-center justify-center gap-4 text-center text-[12px] tracking-[0.14em] text-[#9A937F]">
          <span>上书房 决 · 六部 执 · 蜂群 产 · 史馆 记</span>
          <Link href="/court" className="text-[#D4A84B] transition hover:text-[#F0C66A]">去军机处总台</Link>
        </footer>
      </section>
    </main>
  );
}

export function DeptArtPage({ dept }: { dept: DeptLanding }) {
  const layoutClass = `art-${dept.layout}`;
  const variantCopy = useMemo(() => {
    switch (dept.layout) {
      case 'purple-ranks':
        return ['品级簿', '任官轴', '考功牌'];
      case 'gold-ledger':
        return ['库银线', '预算册', '回款窗'];
      case 'vermilion-rites':
        return ['典礼册', '口径门', '审美签'];
      case 'iron-war':
        return ['战场图', '斥候报', '守价线'];
      case 'indigo-law':
        return ['证据链', '授权链', '责任链'];
      case 'jade-works':
        return ['蓝图', '质门', '回滚案'];
    }
  }, [dept.layout]);

  return (
    <main className="landing-noise relative min-h-screen overflow-hidden bg-[#05060A] text-[#EDE6D4]" style={cssVars(dept.accent, dept.accentSoft)}>
      <LandingStyles />
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(90% 62% at 18% 4%, ${dept.accent}2a, transparent 56%), radial-gradient(80% 70% at 86% 110%, ${dept.accentSoft}18, transparent 62%)` }} />
      <section className="relative z-10 mx-auto flex min-h-screen max-w-[1320px] flex-col px-[5vw] py-8">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/depts" className="inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] text-[#C8CDD8] transition hover:text-[#F5E9C9]" style={{ borderColor: `${dept.accent}44` }}>
            <ArrowLeft size={14} /> 六部堂
          </Link>
          <Link href={`/court/${dept.slug}`} className="inline-flex items-center gap-2 border px-3 py-1.5 text-[12px]" style={{ borderColor: `${dept.accent}55`, color: dept.accentSoft }}>
            入本部控制台
          </Link>
        </nav>

        <div className={`grid flex-1 items-center gap-8 ${layoutClass}`}>
          <section className="relative py-12">
            <div className="section-eyebrow" style={{ color: dept.accent }}>{dept.heavenlyOffice} · {dept.name}</div>
            <h1 className="display-serif mt-4 text-[clamp(4rem,11vw,8rem)] font-semibold leading-none tracking-[0.12em]" style={{ color: dept.accentSoft, textShadow: `0 0 42px ${dept.accent}55` }}>
              {dept.name}
            </h1>
            <p className="mt-6 max-w-xl text-[18px] leading-10 text-[#F5E9C9]">{dept.functionLine}</p>
            <p className="mt-4 max-w-xl text-[14px] leading-8 text-[#AFA68E]">{dept.manifesto}</p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {variantCopy.map((item) => (
                <div key={item} className="border px-3 py-4 text-center" style={{ borderColor: `${dept.accent}40`, background: `${dept.accent}10` }}>
                  <div className="text-[22px] font-semibold" style={{ color: dept.accentSoft }}>{dept.short}</div>
                  <div className="mt-1 text-[11px] tracking-[0.12em] text-[#AFA68E]">{item}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="relative">
            <div className="mx-auto max-w-[680px]">
              <div className="h-4 rounded-full" style={{ background: `linear-gradient(90deg, #8A6A2A, ${dept.accent}, #8A6A2A)`, boxShadow: `0 0 22px ${dept.accent}55` }} />
              <div className="border-x px-5 py-5" style={{ borderColor: `${dept.accent}42`, background: 'linear-gradient(180deg, rgba(237,230,212,.07), rgba(237,230,212,.025))' }}>
                <div className="mb-4 flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: `${dept.accent}25` }}>
                  <div>
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: dept.accent }}>{dept.name} · 艺术卷轴</div>
                    <h2 className="display-serif mt-2 text-[26px] font-semibold text-[#F5E9C9]">本部案卷</h2>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-sm border text-[24px]" style={{ borderColor: dept.accent, color: dept.accent }}>
                    {dept.short}
                  </div>
                </div>
                <div className="space-y-4">
                  {dept.files.map((file, index) => (
                    <article key={file.title} className="relative overflow-hidden border px-4 py-4" style={{ borderColor: `${dept.accent}32`, background: index % 2 ? `${dept.accent}0b` : 'rgba(5,6,10,.34)' }}>
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 flex-none place-items-center rounded-sm border text-[13px]" style={{ borderColor: dept.accent, color: dept.accent }}>
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] tracking-[0.16em]" style={{ color: dept.accent }}>{file.eyebrow}</div>
                          <h3 className="mt-1 text-[17px] font-semibold text-[#F5E9C9]">{file.title}</h3>
                          <p className="mt-2 text-[13px] leading-7 text-[#BEB59D]">{file.body}</p>
                        </div>
                        <span className="hidden border px-2.5 py-1 text-[11px] sm:inline-flex" style={{ borderColor: `${dept.accent}44`, color: dept.accentSoft }}>
                          {file.metric}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="h-4 rounded-full" style={{ background: `linear-gradient(90deg, #8A6A2A, ${dept.accent}, #8A6A2A)`, boxShadow: `0 0 22px ${dept.accent}55` }} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export function CourtConsolePage({ court }: { court: CourtConsole }) {
  const [toast, setToast] = useState('');
  const [draft, setDraft] = useState('');
  const nav = COURT_CONSOLES.filter((item) => item.slug !== 'index');

  function judge(label: string, title: string) {
    setToast(`已${label}：${title}`);
    window.setTimeout(() => setToast(''), 1800);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    setToast(`已下旨：${draft.trim()} → 转${court.name}拟办`);
    setDraft('');
    window.setTimeout(() => setToast(''), 2200);
  }

  return (
    <main className="landing-noise relative h-screen overflow-hidden bg-[#05060A] text-[#EDE6D4]" style={cssVars(court.accent)}>
      <LandingStyles />
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% -10%, ${court.accent}22, transparent 55%)` }} />
      <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto]">
        <nav className="flex items-center gap-5 border-b px-5 py-3 backdrop-blur" style={{ borderColor: `${court.accent}38`, background: 'rgba(5,6,10,.72)' }}>
          <Link href="/depts" className="display-serif text-[24px] font-semibold text-[#F0C66A] no-underline">朝堂</Link>
          <div className="ml-auto flex flex-wrap justify-end gap-1 text-[12px] tracking-[0.1em]">
            <Link href="/court" className="px-2.5 py-1 transition hover:text-[#F0C66A]" style={{ color: court.slug === 'index' ? '#05060A' : '#9A937F', background: court.slug === 'index' ? court.accent : 'transparent' }}>军机处</Link>
            {nav.map((item) => (
              <Link key={item.slug} href={`/court/${item.slug}`} className="px-2.5 py-1 transition hover:text-[#F0C66A]" style={{ color: court.slug === item.slug ? '#05060A' : '#9A937F', background: court.slug === item.slug ? court.accent : 'transparent' }}>
                {item.name}
              </Link>
            ))}
          </div>
        </nav>

        <section className="court-console-grid grid min-h-0 grid-cols-[288px_1fr_320px]">
          <aside className="court-console-side overflow-y-auto border-r px-4 py-5" style={{ borderColor: `${court.accent}25` }}>
            <div className="section-eyebrow" style={{ color: court.accent }}>{court.name} · 待裁</div>
            <div className="mt-4 border p-4 text-[13px] leading-7 text-[#AFA68E]" style={{ borderColor: `${court.accent}25`, background: 'rgba(237,230,212,.035)' }}>
              <b style={{ color: court.accent }}>{court.name}</b><br />
              {court.summary}
            </div>
            <div className="mt-5 space-y-2">
              {court.sections.map((section, index) => (
                <div key={section} className="border-l-2 px-3 py-2 text-[13px]" style={{ borderColor: court.accent, background: `${court.accent}${index === 0 ? '20' : '10'}` }}>
                  <div className="font-semibold text-[#F5E9C9]">{section}</div>
                  <small className="text-[11px] tracking-[0.12em] text-[#8F835F]">司局入口</small>
                </div>
              ))}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto px-[4vw] py-7">
            <div className="mx-auto max-w-[860px]">
              <div className="h-3 rounded-full" style={{ background: `linear-gradient(90deg,#8A6A2A,${court.accent},#8A6A2A)`, boxShadow: `0 0 18px ${court.accent}55` }} />
              <header className="py-6 text-center">
                <h1 className="display-serif text-[44px] font-semibold tracking-[0.12em]" style={{ color: court.accent, textShadow: `0 0 28px ${court.accent}55` }}>{court.name}</h1>
                <div className="mt-2 text-[12px] tracking-[0.32em] text-[#9A937F]">{court.role}</div>
              </header>
              <div className="space-y-4">
                {court.memorials.map((memorial) => (
                  <article key={`${memorial.bureau}-${memorial.title}`} className="relative overflow-hidden border bg-[linear-gradient(158deg,rgba(237,230,212,.055),rgba(237,230,212,.015))]" style={{ borderColor: `${court.accent}42` }}>
                    <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: `${court.accent}25` }}>
                      <div className="grid h-8 w-8 flex-none place-items-center rounded-sm border text-[14px]" style={{ borderColor: court.accent, color: court.accent }}>{court.seal}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px]" style={{ color: court.accent }}>{memorial.bureau}</div>
                        <h2 className="truncate text-[17px] font-semibold text-[#F5E9C9]">{memorial.title}</h2>
                      </div>
                      <span className="border px-2.5 py-1 text-[11px]" style={{ borderColor: `${court.accent}44`, color: court.accent }}>{memorial.status}</span>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-[14px] leading-8 text-[#D8CFB4]">{memorial.body}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3" style={{ borderColor: `${court.accent}20` }}>
                      <button type="button" onClick={() => judge('准奏', memorial.title)} className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-[#05060A]" style={{ background: `linear-gradient(120deg, ${court.accent}, #8A6A2A)` }}>
                        <ShieldCheck size={14} /> 准奏
                      </button>
                      <button type="button" onClick={() => judge('驳回', memorial.title)} className="border px-4 py-2 text-[12px] text-[#F09A72]" style={{ borderColor: '#C0432C' }}>
                        驳回
                      </button>
                      <button type="button" onClick={() => judge('裁决', memorial.title)} className="border px-4 py-2 text-[12px]" style={{ borderColor: `${court.accent}55`, color: court.accent }}>
                        裁决
                      </button>
                      {memorial.link ? (
                        <Link href={memorial.link} className="ml-auto inline-flex items-center gap-1.5 border px-3 py-2 text-[12px] text-[#AFA68E]" style={{ borderColor: `${court.accent}28` }}>
                          <FileText size={14} /> 入本司
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-5 h-3 rounded-full" style={{ background: `linear-gradient(90deg,#8A6A2A,${court.accent},#8A6A2A)`, boxShadow: `0 0 18px ${court.accent}55` }} />
            </div>
          </section>

          <aside className="court-console-side overflow-y-auto border-l px-4 py-5" style={{ borderColor: `${court.accent}25` }}>
            <div className="section-eyebrow" style={{ color: court.accent }}>缓急 · 排班</div>
            <RightNote icon={<ScrollText size={15} />} title="丞相 总议" body={court.counsel.chancellor} accent={court.accent} />
            <RightNote icon={<ShieldCheck size={15} />} title="钦天监 研判" body={court.counsel.astrologer} accent="#86A9F2" />
            <RightNote icon={<FileText size={15} />} title="史馆 留痕" body={court.counsel.archive} accent={court.accent} />
          </aside>
        </section>

        <form onSubmit={submit} className="flex items-center gap-3 border-t px-5 py-3 backdrop-blur" style={{ borderColor: `${court.accent}40`, background: 'rgba(5,6,10,.82)' }}>
          <div className="display-serif text-[21px]" style={{ color: court.accent }}>{court.seal}</div>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="老板下旨"
            placeholder={`老板下旨 / ${court.name}拟办...`}
            className="min-w-0 flex-1 border bg-[rgba(237,230,212,.05)] px-4 py-3 text-[14px] text-[#EDE6D4] outline-none"
            style={{ borderColor: `${court.accent}42` }}
          />
          <button type="submit" className="inline-flex items-center gap-2 px-5 py-3 text-[13px] font-semibold tracking-[0.14em] text-[#05060A]" style={{ background: 'linear-gradient(120deg,#F0C66A,#8A6A2A)' }}>
            <Send size={15} /> 下旨
          </button>
        </form>
      </div>
      {toast ? (
        <div className="fixed bottom-[88px] left-1/2 z-50 -translate-x-1/2 border px-5 py-3 text-[13px] text-[#F5E9C9] shadow-2xl" style={{ borderColor: court.accent, background: 'rgba(5,6,10,.96)' }}>
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function RightNote({ icon, title, body, accent }: { icon: ReactNode; title: string; body: string; accent: string }) {
  return (
    <div className="mt-4 border p-4" style={{ borderColor: `${accent}32`, background: 'linear-gradient(160deg,rgba(237,230,212,.04),transparent)' }}>
      <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.12em]" style={{ color: accent }}>
        {icon}
        {title}
      </div>
      <p className="mt-2 text-[13px] leading-7 text-[#D8CFB4]">{body}</p>
    </div>
  );
}
