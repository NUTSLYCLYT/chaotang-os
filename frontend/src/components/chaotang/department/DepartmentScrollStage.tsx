'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FileText, Maximize2, Minimize2, ScrollText, Stamp } from 'lucide-react';

export type DepartmentScrollTone = 'gold' | 'jade' | 'blue' | 'vermilion' | 'cyan';
export type DepartmentSourceLabel = 'LIVE' | 'MIXED' | 'FALLBACK' | 'DEMO';

export type DepartmentScrollFile = {
  id: string;
  label: string;
  title: string;
  meta?: string;
  body: ReactNode;
  status?: string;
};

export type DepartmentEdict = {
  title: string;
  verdict: string;
  body: ReactNode;
  seal?: string;
};

type DepartmentScrollStageProps = {
  eyebrow: string;
  title: string;
  files: DepartmentScrollFile[];
  edict?: DepartmentEdict;
  tone?: DepartmentScrollTone;
  sourceLabel?: DepartmentSourceLabel;
  showSourceLabel?: boolean;
  defaultFileId?: string;
  activeFileId?: string;
  defaultCollapsed?: boolean;
  openRequest?: number;
  actions?: ReactNode;
};

const TONE_COLOR: Record<DepartmentScrollTone, string> = {
  gold: '#F0C66A',
  jade: '#BFD9BD',
  blue: '#7EC8E3',
  vermilion: '#C98A6E',
  cyan: '#7EC8E3',
};

function compactText(value: string, max = 30) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function inferSourceLabel(status?: string, meta?: string): DepartmentSourceLabel {
  const text = `${status ?? ''} ${meta ?? ''}`.toLowerCase();
  if (text.includes('live') || text.includes('后端已接') || text.includes('已接入') || text.includes('primary')) return 'LIVE';
  if (text.includes('fallback') || text.includes('不可达') || text.includes('降级')) return 'FALLBACK';
  if (text.includes('demo') || text.includes('静态') || text.includes('占位')) return 'DEMO';
  return 'MIXED';
}

function sourceLabelCopy(label: DepartmentSourceLabel) {
  if (label === 'LIVE') return '真源';
  if (label === 'FALLBACK') return '降级';
  if (label === 'DEMO') return '演示';
  return '混合';
}

function SourcePlaque({ label, accent }: { label: DepartmentSourceLabel; accent: string }) {
  const live = label === 'LIVE';
  return (
    <span
      data-three-axis-source-plaque={label}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
      style={{
        borderColor: live ? 'rgba(32,120,68,0.30)' : 'rgba(122,74,8,0.24)',
        background: live ? 'rgba(32,120,68,0.075)' : 'rgba(122,74,8,0.055)',
        color: live ? '#1f6e3f' : '#7a4a08',
        boxShadow: `inset 0 1px 0 rgba(255,250,235,0.22), 0 0 18px ${accent}18`,
      }}
      title={`来源铭牌：${label}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: live ? '#207844' : '#7a4a08' }} />
      {label}
      <span className="font-serif text-[10px] tracking-[0.10em]">{sourceLabelCopy(label)}</span>
    </span>
  );
}

function CentralActionSeal({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      data-three-axis-scroll-action-seal
      aria-hidden
      className="animate-fade-in-up pointer-events-none absolute left-1/2 top-1/2 z-[24] grid h-[112px] w-[112px] -translate-x-1/2 -translate-y-1/2 rotate-[-13deg] place-items-center rounded-[10px] border text-[22px] font-black leading-[1.08] tracking-[0.18em] text-[#7A241E]/46"
      style={{
        borderColor: 'rgba(122,36,30,0.28)',
        background: 'radial-gradient(circle at 50% 50%, rgba(122,36,30,0.13), rgba(122,36,30,0.035) 58%, transparent 72%)',
        boxShadow: '0 0 0 1px rgba(122,36,30,0.14), 0 18px 38px rgba(122,36,30,0.10)',
        fontFamily: '"STKaiti", "KaiTi", var(--font-serif)',
      }}
    >
      御案<br />已承
    </span>
  );
}

function UnfurlRitualSeal({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <>
      <span
        data-three-axis-scroll-ritual-light
        aria-hidden
        className="department-scroll-ritual-light pointer-events-none absolute inset-y-0 left-0 z-[9] w-[34%]"
      />
      <span
        data-three-axis-scroll-ritual-seal
        aria-hidden
        className="department-scroll-ritual-seal pointer-events-none absolute left-1/2 top-[42%] z-[25] grid h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] place-items-center rounded-[8px] border text-[21px] font-black leading-[1.05] tracking-[0.16em] text-[#7A241E]/42"
        style={{
          borderColor: 'rgba(122,36,30,0.28)',
          background: 'radial-gradient(circle at 50% 50%, rgba(122,36,30,0.12), rgba(122,36,30,0.035) 62%, transparent 74%)',
          boxShadow: '0 0 0 1px rgba(122,36,30,0.14), 0 18px 38px rgba(122,36,30,0.10)',
          fontFamily: '"STKaiti", "KaiTi", var(--font-serif)',
        }}
      >
        开卷<br />奉览
      </span>
    </>
  );
}

function ScrollStateButton({
  icon,
  label,
  onClick,
  marker,
  accent,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  marker?: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(marker ? { [marker]: true } : {})}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:brightness-105"
      style={{
        borderColor: `${accent}66`,
        background: `${accent}18`,
        color: '#5b3410',
        boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.28)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

type ManuscriptVoice = 'edict' | 'memorial' | 'casefile';

function inferManuscriptVoice(kind: 'file' | 'edict', label: string, title: string): ManuscriptVoice {
  if (kind === 'edict') return 'edict';
  const text = `${label} ${title}`;
  if (/奏|折|呈|汇报|批示/.test(text)) return 'memorial';
  return 'casefile';
}

function manuscriptVoiceCopy(voice: ManuscriptVoice) {
  if (voice === 'edict') return '圣旨';
  if (voice === 'memorial') return '奏折';
  return '案卷';
}

function manuscriptVoiceOrnament(voice: ManuscriptVoice) {
  if (voice === 'edict') return '奉天承运';
  if (voice === 'memorial') return '臣谨奏闻';
  return '据实可核';
}

function manuscriptVoiceSideCopy(voice: ManuscriptVoice) {
  if (voice === 'edict') return { left: '朱批圣裁', right: '奉旨照办' };
  if (voice === 'memorial') return { left: '臣奏有据', right: '批注可复' };
  return { left: '案牍可核', right: '据实办理' };
}

function ScrollManuscript({
  kind,
  title,
  label,
  meta,
  status,
  accent,
  children,
}: {
  kind: 'file' | 'edict';
  title: string;
  label: string;
  meta?: string;
  status?: string;
  accent: string;
  children: ReactNode;
}) {
  const sealText = kind === 'edict' ? '旨' : '案';
  const voice = inferManuscriptVoice(kind, label, title);
  const voiceSideCopy = manuscriptVoiceSideCopy(voice);
  const titleSizeClass = voice === 'edict'
    ? 'text-[27px] md:text-[36px]'
    : voice === 'memorial'
      ? 'text-[25px] md:text-[32px]'
      : 'text-[23px] md:text-[30px]';
  const bodyVoiceClass = voice === 'edict'
    ? 'department-manuscript-body--edict'
    : voice === 'memorial'
      ? 'department-manuscript-body--memorial'
      : 'department-manuscript-body--casefile';

  return (
    <article
      data-three-axis-scroll-layout={kind}
      data-three-axis-manuscript-voice={voice}
      data-three-axis-manuscript-detail="paper"
      className="relative min-h-full overflow-hidden rounded-[10px] border px-4 py-4 md:px-5 md:py-5"
      style={{
        borderColor: 'rgba(122,74,8,0.20)',
        background:
          'linear-gradient(180deg, rgba(255,251,235,0.78), rgba(255,241,199,0.58)), radial-gradient(circle at 100% 0%, rgba(122,36,30,0.10), transparent 30%), repeating-linear-gradient(90deg, rgba(122,74,8,0.050) 0 1px, transparent 1px 18px)',
        boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.42), 0 18px 42px rgba(94,55,16,0.10)',
      }}
    >
      <span aria-hidden data-three-axis-manuscript-detail="silk-edge" className="pointer-events-none absolute inset-x-4 top-2 h-px bg-gradient-to-r from-transparent via-[#7a4a08]/24 to-transparent" />
      <span aria-hidden data-three-axis-manuscript-detail="silk-edge" className="pointer-events-none absolute inset-x-4 bottom-2 h-px bg-gradient-to-r from-transparent via-[#7a4a08]/20 to-transparent" />
      <span
        aria-hidden
        data-three-axis-manuscript-detail="vermilion-corner"
        className="pointer-events-none absolute left-5 top-5 h-10 w-10 border-l border-t border-[#7A241E]/22"
      />
      <span
        aria-hidden
        data-three-axis-manuscript-detail="vermilion-corner"
        className="pointer-events-none absolute right-5 top-5 h-10 w-10 border-r border-t border-[#7A241E]/18"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-5 left-[54px] hidden w-px md:block"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(122,74,8,0.24), transparent)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-5 right-[86px] hidden w-px md:block"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(122,36,30,0.16), transparent)' }}
      />
      <span
        aria-hidden
        data-three-axis-manuscript-detail="seal"
        className="pointer-events-none absolute right-6 bottom-5 grid h-[78px] w-[78px] rotate-[-13deg] place-items-center rounded-[7px] border text-[34px] font-black opacity-55"
        style={{
          borderColor: 'rgba(122,36,30,0.20)',
          color: 'rgba(122,36,30,0.17)',
          fontFamily: '"STKaiti", "KaiTi", var(--font-serif)',
        }}
      >
        {sealText}
      </span>
      <span
        aria-hidden
        data-three-axis-manuscript-detail="voice-ornament"
        className="pointer-events-none absolute left-1/2 top-6 hidden -translate-x-1/2 select-none font-serif text-[11px] font-black tracking-[0.38em] text-[#7A241E]/25 md:block"
        style={{ fontFamily: '"STKaiti", "KaiTi", var(--font-serif)' }}
      >
        {manuscriptVoiceOrnament(voice)}
      </span>
      <span
        aria-hidden
        data-three-axis-manuscript-detail="text-ruling"
        className="pointer-events-none absolute inset-x-[76px] top-[154px] hidden h-[3px] rounded-full md:block"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(122,36,30,0.20), rgba(122,74,8,0.30), rgba(122,36,30,0.20), transparent)',
        }}
      />
      <span
        aria-hidden
        data-three-axis-manuscript-detail="text-ruling"
        className="pointer-events-none absolute inset-x-[76px] top-[164px] hidden h-[3px] rounded-full md:block"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,250,235,0.28), rgba(122,36,30,0.10), rgba(255,250,235,0.28), transparent)',
        }}
      />
      <div className="relative grid gap-4 md:grid-cols-[32px_minmax(0,1fr)_74px]">
        <aside
          data-three-axis-manuscript-detail="marginalia"
          className="hidden items-center justify-start border-y border-[#7a4a08]/18 py-2 text-center font-serif text-[12px] font-black leading-[1.4] text-[#7A241E]/45 md:flex"
          style={{ writingMode: 'vertical-rl' }}
          aria-hidden
        >
          {voiceSideCopy.left}
        </aside>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-three-axis-manuscript-detail="title-cartouche"
              className="rounded-sm border border-[#7A241E]/14 bg-[#7A241E]/[0.045] px-2 py-1 text-[10px] font-black tracking-[0.20em] text-[#6f3f08]"
              style={{ fontFamily: '"STKaiti", "KaiTi", var(--font-serif)' }}
            >
              <span data-three-axis-manuscript-detail="voice-badge" className="mr-1 text-[#7A241E]/62">
                {manuscriptVoiceCopy(voice)}
              </span>
              {label}
            </span>
            {status && (
              <span className="rounded-full border border-[#7a4a08]/24 bg-[#7a4a08]/[0.055] px-2.5 py-1 text-[11px] font-bold text-[#7a4a08]">
                {compactText(status, 12)}
              </span>
            )}
          </div>
          <h3
            data-three-axis-manuscript-detail="title-calligraphy"
            className={`mt-3 max-w-[680px] break-words font-serif font-black leading-[1.20] text-[#1d1004] ${titleSizeClass}`}
            style={{
              fontFamily: '"STKaiti", "KaiTi", var(--font-serif)',
              letterSpacing: voice === 'edict' ? (title.length <= 10 ? '0.10em' : '0.045em') : title.length <= 10 ? '0.045em' : '0.01em',
              textShadow: '0 1px 0 rgba(255,250,235,0.55), 0 12px 30px rgba(92,48,12,0.13)',
            }}
          >
            {title}
          </h3>
          {meta && (
            <p
              data-three-axis-manuscript-detail="subtitle-rhythm"
              className="mt-2 max-w-[640px] border-l border-[#7A241E]/18 pl-3 text-[12px] font-black leading-5 text-[#5b3410]"
              style={{ fontFamily: '"STKaiti", "KaiTi", var(--font-serif)' }}
            >
              {meta}
            </p>
          )}
          <div
            data-three-axis-manuscript-detail="body-rhythm"
            className={`department-manuscript-body ${bodyVoiceClass} mt-6 max-w-[690px] text-[14px] font-semibold leading-[2.05] text-[#2a1807] md:text-[15px]`}
            style={{
              fontFamily: 'var(--font-serif)',
              textWrap: 'pretty',
              letterSpacing: '0.015em',
            }}
          >
            {children}
          </div>
        </div>
        <aside className="hidden min-h-[180px] flex-col items-center justify-between gap-3 rounded-[8px] border border-[#7a4a08]/16 bg-[#7a4a08]/[0.045] px-2 py-3 text-center md:flex">
          <span
            className="text-[10px] font-black leading-[1.5] text-[#7A241E]/62"
            style={{ writingMode: 'vertical-rl', fontFamily: '"STKaiti", "KaiTi", var(--font-serif)' }}
          >
            {voiceSideCopy.right}
          </span>
          <span
            className="h-10 w-px"
            style={{ background: `linear-gradient(180deg, transparent, ${accent}99, transparent)` }}
            aria-hidden
          />
          <span className="rounded border border-[#7A241E]/20 px-1.5 py-1 text-[10px] font-black text-[#7A241E]/62">
            {sealText}
          </span>
        </aside>
      </div>
    </article>
  );
}

export function DepartmentScrollStage({
  eyebrow,
  title,
  files,
  edict,
  tone = 'gold',
  sourceLabel,
  showSourceLabel = true,
  defaultFileId,
  activeFileId,
  defaultCollapsed = false,
  openRequest = 0,
  actions,
}: DepartmentScrollStageProps) {
  const accent = TONE_COLOR[tone];
  const [scrollState, setScrollState] = useState<'collapsed' | 'preview' | 'expanded'>(
    defaultCollapsed ? 'collapsed' : 'expanded',
  );
  const [mode, setMode] = useState<'file' | 'edict'>('file');
  const [activeId, setActiveId] = useState(defaultFileId ?? files[0]?.id ?? 'empty');
  const [actionSeal, setActionSeal] = useState(0);
  const [ritualSeal, setRitualSeal] = useState(0);
  const ritualTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFile = useMemo(
    () => files.find((file) => file.id === activeId) ?? files[0],
    [activeId, files],
  );
  const showingEdict = mode === 'edict' && edict;
  const resolvedSourceLabel = sourceLabel ?? inferSourceLabel(
    showingEdict ? edict?.seal : activeFile?.status,
    showingEdict ? edict?.verdict : activeFile?.meta,
  );
  const collapsedSummary = showingEdict
    ? edict.verdict
    : activeFile?.meta ?? '先看任务、证据、主管汇报和下一步动作';

  const collapsedTitle = showingEdict ? edict.title : activeFile?.title ?? title;
  const collapsedStatus = showingEdict ? edict.seal ?? '圣旨' : activeFile?.status ?? '待阅';
  const collapsedMeta = `${compactText(collapsedStatus, 12)} · ${resolvedSourceLabel} · ${files.length} 卷宗`;

  const openWithRitual = useCallback(() => {
    setScrollState('expanded');
    setRitualSeal(Date.now());
    if (ritualTimeoutRef.current) clearTimeout(ritualTimeoutRef.current);
    ritualTimeoutRef.current = setTimeout(() => setRitualSeal(0), 1180);
  }, []);

  useEffect(() => {
    if (openRequest > 0) openWithRitual();
  }, [openRequest, openWithRitual]);

  useEffect(() => {
    if (!activeFileId) return;
    const matched = files.find((file) => file.id === activeFileId);
    if (!matched) return;
    setActiveId(matched.id);
    setMode('file');
  }, [activeFileId, files]);

  useEffect(() => {
    const openScroll = () => openWithRitual();
    window.addEventListener('chaotang:open-department-scroll', openScroll);
    return () => window.removeEventListener('chaotang:open-department-scroll', openScroll);
  }, [openWithRitual]);

  useEffect(() => {
    const markAccepted = () => {
      setActionSeal(Date.now());
      window.setTimeout(() => setActionSeal(0), 2100);
    };
    window.addEventListener('chaotang:imperial-action-accepted', markAccepted);
    window.addEventListener('chaotang:scroll-action-seal', markAccepted);
    return () => {
      window.removeEventListener('chaotang:imperial-action-accepted', markAccepted);
      window.removeEventListener('chaotang:scroll-action-seal', markAccepted);
    };
  }, []);

  useEffect(() => () => {
    if (ritualTimeoutRef.current) clearTimeout(ritualTimeoutRef.current);
  }, []);

  if (scrollState === 'collapsed') {
    return (
      <button
        type="button"
        onClick={openWithRitual}
        data-three-axis-scroll
        data-three-axis-ornament="rolled-scroll"
        data-chaotang-scroll-state="collapsed"
        data-chaotang-department-scroll-open
        className="group relative z-[70] mx-auto grid h-[68px] w-full max-w-[980px] grid-cols-[34px_minmax(0,1fr)_34px] items-center overflow-visible px-2 text-left transition duration-[260ms] hover:-translate-y-0.5 md:h-[78px] md:grid-cols-[52px_minmax(0,1fr)_52px] md:px-8"
        style={{
          filter: 'drop-shadow(0 30px 54px rgba(0,0,0,0.54))',
        }}
        aria-label="展开部门卷轴"
      >
        <span
          aria-hidden
          data-three-axis-scroll-artifact="floating-shadow"
          className="absolute left-1/2 top-1/2 h-16 w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${accent}44, rgba(185,246,210,0.08) 44%, transparent 72%)`,
          }}
        />
        {(['left', 'right'] as const).map((side) => (
          <span
            key={side}
            aria-hidden
            className={`relative z-20 flex h-[68px] items-center justify-center md:h-[78px] ${side === 'left' ? 'order-1' : 'order-3'}`}
          >
            <span
              data-three-axis-scroll-artifact="gold-roller"
              className="absolute h-[54px] w-[22px] overflow-hidden rounded-full md:h-[66px] md:w-[28px]"
              style={{
                background:
                  'linear-gradient(90deg, #2b1a07 0%, #8a6426 22%, #f0c66a 48%, #6f4a16 78%, #1a1005 100%), repeating-linear-gradient(0deg, rgba(255,250,210,0.26) 0 2px, transparent 2px 10px)',
                boxShadow: 'inset 0 0 12px rgba(255,242,184,0.32), 0 20px 42px rgba(0,0,0,0.52)',
              }}
            >
              <span aria-hidden className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-white/34" />
            </span>
            <span
              data-three-axis-scroll-artifact="jade-cap"
              className="absolute top-1/2 h-[30px] w-[30px] -translate-y-1/2 rounded-full md:h-[38px] md:w-[38px]"
              style={{
                background: 'radial-gradient(circle at 35% 28%, #f5fff0 0%, #bfd9bd 24%, #7d9f7f 56%, #263629 100%)',
                boxShadow: 'inset -8px -10px 18px rgba(11,28,18,0.42), 0 0 34px rgba(213,239,206,0.24)',
              }}
            />
          </span>
        ))}
        <span
          data-three-axis-scroll-artifact="paper-body"
          className="relative order-2 z-10 mx-[-12px] flex h-[52px] min-w-0 items-center overflow-hidden rounded-full border px-5 md:mx-[-18px] md:h-[58px] md:px-8"
          style={{
            borderColor: 'rgba(140,92,36,0.58)',
            background:
              'radial-gradient(ellipse at 50% 18%, rgba(255,249,226,0.99), rgba(239,211,151,0.96) 58%, rgba(194,137,58,0.95) 100%), repeating-linear-gradient(90deg, rgba(120,74,22,0.12) 0 1px, transparent 1px 16px), repeating-linear-gradient(0deg, rgba(255,250,232,0.18) 0 1px, transparent 1px 12px)',
            boxShadow:
              'inset 0 1px 0 rgba(255,250,232,0.82), inset 0 -18px 30px rgba(110,64,18,0.20), 0 30px 72px rgba(0,0,0,0.56)',
          }}
        >
          <span aria-hidden data-three-axis-scroll-artifact="silk-binding" className="absolute inset-y-3 left-5 w-[3px] rounded-full bg-[#7A241E]/22" />
          <span aria-hidden data-three-axis-scroll-artifact="silk-binding" className="absolute inset-y-3 right-5 w-[3px] rounded-full bg-[#7A241E]/18" />
          <span
            aria-hidden
            data-three-axis-scroll-artifact="paper-thickness"
            className="pointer-events-none absolute inset-x-8 bottom-2 h-[10px] rounded-full blur-[1px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(98,52,12,0.24), rgba(255,250,232,0.18), rgba(98,52,12,0.24), transparent)',
            }}
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 grid h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 rotate-[-14deg] place-items-center rounded-full border text-[18px] font-black opacity-80 md:h-[58px] md:w-[58px]"
            style={{ borderColor: 'rgba(122,36,30,0.20)', color: 'rgba(122,36,30,0.18)', fontFamily: 'var(--font-serif)' }}
          >
            文
          </span>
          <CentralActionSeal active={actionSeal > 0} />
          <span className="relative z-10 min-w-0 flex-1 text-center">
            <span className="sr-only">
              {eyebrow}
            </span>
            <span
              className="mx-auto block max-w-[610px] truncate text-center font-serif text-[15px] font-black leading-none text-[#211406] md:text-[18px]"
              style={{
                fontFamily: '"LiSu", "STLiti", "STKaiti", "KaiTi", var(--font-serif)',
                letterSpacing: collapsedTitle.length <= 8 ? '0.08em' : 0,
                textShadow: '0 1px 0 rgba(255,250,232,0.58), 0 8px 18px rgba(80,45,12,0.14)',
              }}
            >
              {collapsedTitle}
            </span>
            <span
              data-three-axis-scroll-summary
              className="mx-auto mt-1 block max-w-[620px] truncate text-center text-[10px] font-bold leading-4 text-[#5b3410]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {collapsedMeta}
            </span>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold transition group-hover:bg-[#7a4a08]/10 md:px-3 md:py-1" style={{ borderColor: 'rgba(122,74,8,0.24)', color: '#7a4a08', background: 'rgba(122,74,8,0.06)', fontFamily: 'var(--font-serif)' }}>
              展开
              <Maximize2 size={12} />
            </span>
          </span>
        </span>
      </button>
    );
  }

  if (scrollState === 'preview') {
    return (
      <section
        data-three-axis-scroll
        data-three-axis-ornament="preview-scroll"
        data-chaotang-scroll-state="preview"
        data-chaotang-scroll-preview
        className="relative z-[70] mx-auto flex min-h-[292px] w-full max-w-[900px] flex-col overflow-hidden rounded-[18px] border px-5 py-5 md:px-8"
        style={{
          borderColor: `${accent}58`,
          background:
            'radial-gradient(ellipse at 50% -18%, rgba(255,242,184,0.98), rgba(226,181,95,0.92) 48%, rgba(151,93,35,0.92) 100%)',
          boxShadow:
            '0 30px 84px rgba(0,0,0,0.54), inset 0 1px 0 rgba(255,250,235,0.62), inset 0 -24px 42px rgba(92,48,12,0.16)',
        }}
        aria-label="部门卷轴半展摘要"
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-25" style={{ background: 'repeating-linear-gradient(90deg, rgba(122,74,8,0.13) 0 1px, transparent 1px 20px)' }} />
        <span aria-hidden className="pointer-events-none absolute inset-x-10 top-3 h-2 rounded-full bg-gradient-to-r from-transparent via-[#7A241E]/18 to-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-x-10 bottom-3 h-2 rounded-full bg-gradient-to-r from-transparent via-[#7A241E]/14 to-transparent" />
        <div className="relative z-10 flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: 'rgba(122,74,8,0.22)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.24em]" style={{ color: '#7a4a08' }}>
              <ScrollText size={13} />
              {eyebrow} · 半展摘要
            </div>
            <h2 className="mt-1 break-words font-serif text-[25px] font-black leading-tight text-[#211406] md:text-[32px]">
              {showingEdict ? edict.title : activeFile?.title ?? title}
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {showSourceLabel && (
              <SourcePlaque label={resolvedSourceLabel} accent={accent} />
            )}
            <ScrollStateButton
              icon={<Maximize2 size={12} />}
              label="全展"
              onClick={openWithRitual}
              marker="data-chaotang-department-scroll-expand"
              accent={accent}
            />
            <ScrollStateButton
              icon={<Minimize2 size={12} />}
              label="收卷"
              onClick={() => setScrollState('collapsed')}
              marker="data-chaotang-department-scroll-collapse"
              accent={accent}
            />
          </div>
        </div>
        <div className="relative z-10 mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div
            className="rounded-[12px] border px-4 py-4"
            style={{
              borderColor: 'rgba(122,74,8,0.24)',
              background: 'linear-gradient(180deg, rgba(255,248,224,0.60), rgba(255,241,199,0.40))',
              boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.34)',
            }}
          >
            <div className="text-[10px] font-black tracking-[0.22em] text-[#7A241E]/62">
              {showingEdict ? edict.seal ?? '主管批示' : activeFile?.label ?? '案卷'}
            </div>
            <p className="mt-2 text-[13px] font-semibold leading-7 text-[#4a2a0b]" style={{ fontFamily: 'var(--font-serif)' }}>
              {collapsedSummary}
            </p>
            <p className="mt-3 text-[12px] font-semibold leading-6 text-[#6f4a16]">
              半展只保留摘要、来源、主案名；需要批复、核证或处理正文时再全展，不让卷轴常态压住宫室背景。
            </p>
          </div>
          <aside
            className="hidden rounded-[12px] border px-3 py-4 text-center md:block"
            style={{
              borderColor: 'rgba(122,36,30,0.18)',
              background: 'rgba(122,74,8,0.055)',
            }}
          >
            <div className="mx-auto grid h-[74px] w-[74px] rotate-[-10deg] place-items-center rounded-[8px] border text-[18px] font-black leading-[1.1] tracking-[0.16em] text-[#7A241E]/48" style={{ borderColor: 'rgba(122,36,30,0.24)', fontFamily: '"STKaiti", "KaiTi", var(--font-serif)' }}>
              半展<br />候旨
            </div>
            <div className="mt-4 text-[11px] font-bold leading-6 text-[#6f4a16]">
              摘要可扫读<br />正文可全展<br />背景可呼吸
            </div>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section
      data-three-axis-scroll
      data-three-axis-ornament="unfurled-scroll"
      data-three-axis-ritual="imperial-unfurl"
      data-chaotang-scroll-state="expanded"
      className="relative z-[70] flex max-h-[calc(100vh-128px)] min-h-[520px] flex-col overflow-hidden rounded-[18px] border"
      style={{
        borderColor: `${accent}54`,
        background:
          'radial-gradient(ellipse at 50% -18%, #fff1c7 0%, #e9c477 42%, #b9792f 100%)',
        boxShadow:
          '0 30px 90px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,250,235,0.68), inset 0 -28px 54px rgba(96,52,12,0.14)',
      }}
      aria-label="部门中央卷轴"
    >
      <style>{`
        @keyframes department-scroll-unfurl {
          0% { clip-path: inset(48% 0 48% 0 round 18px); opacity: .62; transform: scaleY(.88); filter: saturate(.88) brightness(.94); }
          62% { clip-path: inset(0 0 0 0 round 18px); opacity: 1; transform: scaleY(1.012); filter: saturate(1.03) brightness(1.03); }
          100% { clip-path: inset(0 0 0 0 round 18px); opacity: 1; transform: scaleY(1); filter: saturate(1) brightness(1); }
        }
        @keyframes department-row-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes department-ritual-light {
          0% { opacity: 0; transform: translateX(-42%) skewX(-12deg); }
          24% { opacity: .9; }
          100% { opacity: 0; transform: translateX(236%) skewX(-12deg); }
        }
        @keyframes department-ritual-seal {
          0% { opacity: 0; transform: translate(-50%, -74%) rotate(-18deg) scale(1.24); filter: blur(4px); }
          38% { opacity: .82; transform: translate(-50%, -50%) rotate(-12deg) scale(.96); filter: blur(0); }
          72% { opacity: .72; transform: translate(-50%, -50%) rotate(-12deg) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -46%) rotate(-12deg) scale(1.04); }
        }
        .department-scroll-ritual-light {
          background: linear-gradient(90deg, transparent, rgba(255,250,226,.34), rgba(240,198,106,.16), transparent);
          mix-blend-mode: screen;
          filter: blur(1.5px);
          animation: department-ritual-light 980ms cubic-bezier(.16,1,.3,1) both;
        }
        .department-scroll-ritual-seal {
          animation: department-ritual-seal 1120ms cubic-bezier(.16,1,.3,1) both;
        }
        .department-manuscript-body p {
          margin: 0 0 0.82em;
          text-indent: 1.72em;
        }
        .department-manuscript-body p:last-child {
          margin-bottom: 0;
        }
        .department-manuscript-body strong,
        .department-manuscript-body b {
          color: #7A241E;
          font-weight: 900;
          text-decoration: underline;
          text-decoration-color: rgba(122,36,30,.20);
          text-underline-offset: 4px;
        }
        .department-manuscript-body ul,
        .department-manuscript-body ol {
          margin: .5em 0 .15em;
          padding-left: 0;
          list-style: none;
        }
        .department-manuscript-body li {
          position: relative;
          margin: .38em 0;
          padding-left: 1.45em;
        }
        .department-manuscript-body li::before {
          content: '朱';
          position: absolute;
          left: 0;
          top: .08em;
          display: grid;
          width: 1.05em;
          height: 1.05em;
          place-items: center;
          border: 1px solid rgba(122,36,30,.22);
          border-radius: 3px;
          color: rgba(122,36,30,.62);
          font-family: "STKaiti", "KaiTi", var(--font-serif);
          font-size: .68em;
          font-weight: 900;
          line-height: 1;
          transform: rotate(-6deg);
        }
        .department-manuscript-body [data-compact],
        .department-manuscript-body small {
          color: #6f4a16;
          font-size: .86em;
          font-weight: 800;
        }
        .department-manuscript-body--edict {
          max-width: 640px;
          margin-left: auto;
          margin-right: auto;
          text-align: center;
          font-size: 1.03em;
          line-height: 2.18;
          letter-spacing: .035em;
        }
        .department-manuscript-body--edict p {
          text-indent: 0;
          margin-bottom: 1em;
        }
        .department-manuscript-body--memorial {
          max-width: 700px;
          line-height: 2.08;
          letter-spacing: .018em;
        }
        .department-manuscript-body--memorial p {
          border-left: 1px solid rgba(122,36,30,.12);
          padding-left: 1.1em;
          text-indent: 1.1em;
        }
        .department-manuscript-body--casefile {
          display: grid;
          gap: .28em;
          line-height: 1.92;
          letter-spacing: .01em;
        }
        .department-manuscript-body--casefile p {
          margin-bottom: .36em;
          text-indent: 1.36em;
        }
        @media (prefers-reduced-motion: reduce) {
          .department-scroll-paper,
          .department-scroll-row,
          .department-scroll-ritual-light,
          .department-scroll-ritual-seal { animation: none !important; clip-path: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.18]"
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(100,52,10,0.18) 0 1px, transparent 1px 22px), repeating-linear-gradient(0deg, rgba(255,250,232,0.22) 0 1px, transparent 1px 34px)',
          maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
        }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-x-7 top-3 z-10 h-px bg-gradient-to-r from-transparent via-[#fff2bf]/70 to-transparent" />
      <span aria-hidden className="pointer-events-none absolute inset-x-7 bottom-3 z-10 h-px bg-gradient-to-r from-transparent via-[#7a4a08]/32 to-transparent" />
      <span
        aria-hidden
        data-three-axis-manuscript-detail="outer-silk"
        className="pointer-events-none absolute inset-x-12 top-0 z-[8] h-3 rounded-b-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(122,36,30,0.16), rgba(255,242,184,0.34), rgba(122,36,30,0.16), transparent)' }}
      />
      <span
        aria-hidden
        data-three-axis-manuscript-detail="outer-silk"
        className="pointer-events-none absolute inset-x-12 bottom-0 z-[8] h-3 rounded-t-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(122,36,30,0.12), rgba(92,48,12,0.24), rgba(122,36,30,0.12), transparent)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-[46%] -translate-x-1/2 opacity-55"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,250,230,0.30), transparent)',
          mixBlendMode: 'soft-light',
        }}
      />
      <span aria-hidden className="absolute left-4 top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-[#7a4a08]/30 to-transparent" />
      <span aria-hidden className="absolute right-4 top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-[#7a4a08]/30 to-transparent" />
      <span aria-hidden className="absolute left-1/2 top-1/2 h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 rotate-[-14deg] rounded-full border border-[#7A241E]/20" />
      <span
        aria-hidden
        className="pointer-events-none absolute left-8 top-16 bottom-16 z-[2] hidden w-7 items-center justify-center border-y border-[#7a4a08]/18 text-center font-serif text-[13px] font-black leading-[1.45] text-[#7A241E]/24 md:flex"
        style={{ writingMode: 'vertical-rl' }}
      >
        奏牍有据
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-8 top-16 bottom-16 z-[2] hidden w-7 items-center justify-center border-y border-[#7a4a08]/18 text-center font-serif text-[13px] font-black leading-[1.45] text-[#7A241E]/24 md:flex"
        style={{ writingMode: 'vertical-rl' }}
      >
        圣裁有章
      </span>
      <UnfurlRitualSeal active={ritualSeal > 0} />
      <CentralActionSeal active={actionSeal > 0} />
      <div className="department-scroll-paper relative flex min-h-0 flex-1 flex-col px-4 py-4 md:px-7 md:py-6" style={{ animation: 'department-scroll-unfurl 520ms cubic-bezier(0.22,1,0.3,1) both' }}>
        <header className="relative z-10 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between" style={{ borderColor: 'rgba(122,74,8,0.22)' }}>
          <span aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-[#7A241E]/26 to-transparent" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.24em]" style={{ color: '#7a4a08' }}>
              <ScrollText size={13} />
              {eyebrow}
            </div>
            <h2 className="mt-1 font-serif text-[26px] font-black leading-tight text-[#211406] md:text-[34px]">
              {showingEdict ? edict.title : title}
            </h2>
            <p className="mt-1 text-[12px] font-semibold text-[#6f4a16]">
              {showingEdict ? edict.verdict : activeFile?.meta ?? '部门文件 · 可展开处理'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {showSourceLabel && (
              <SourcePlaque label={resolvedSourceLabel} accent={accent} />
            )}
            <ScrollStateButton
              icon={<Minimize2 size={12} />}
              label="半展"
              onClick={() => setScrollState('preview')}
              marker="data-chaotang-department-scroll-preview-control"
              accent={accent}
            />
            {edict && (
              <button
                type="button"
                onClick={() => setMode((current) => (current === 'edict' ? 'file' : 'edict'))}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:brightness-105"
                style={{ borderColor: `${accent}66`, background: `${accent}1A`, color: '#5b3410' }}
              >
                {mode === 'edict' ? <FileText size={12} /> : <Stamp size={12} />}
                {mode === 'edict' ? '看文件' : '切圣旨'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setScrollState('collapsed')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#7a4a08]/28 bg-[#7a4a08]/[0.06] px-3 py-1.5 text-[11px] font-bold text-[#7a4a08] transition hover:bg-[#7a4a08]/[0.10]"
            >
              <Minimize2 size={12} />
              收卷
            </button>
          </div>
        </header>

        {!showingEdict && files.length > 1 && (
          <nav className="relative z-10 mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="部门文件">
            {files.map((file) => {
              const active = file.id === activeFile?.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    setActiveId(file.id);
                    setMode('file');
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition"
                  style={{
                    borderColor: active ? `${accent}88` : 'rgba(122,74,8,0.22)',
                    background: active ? `${accent}24` : 'rgba(122,74,8,0.045)',
                    color: active ? '#321d08' : '#7a4a08',
                  }}
                >
                  <FileText size={12} />
                  {file.label}
                  {file.status && <span className="text-[10px] opacity-70">{file.status}</span>}
                </button>
              );
            })}
          </nav>
        )}

        <div
          className="department-scroll-row relative z-10 mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border px-4 py-4 md:px-5 md:py-5"
          style={{
            borderColor: 'rgba(122,74,8,0.28)',
            background:
              'linear-gradient(180deg, rgba(255,248,224,0.62), rgba(255,241,199,0.44)), radial-gradient(circle at 8% 10%, rgba(122,36,30,0.08), transparent 22%), repeating-linear-gradient(90deg, rgba(122,74,8,0.045) 0 1px, transparent 1px 26px), repeating-linear-gradient(0deg, rgba(255,250,232,0.12) 0 1px, transparent 1px 18px)',
            color: '#2e2410',
            boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.34), inset 0 0 42px rgba(122,74,8,0.08), 0 18px 42px rgba(94,55,16,0.10)',
            animation: 'department-row-in 420ms ease-out 120ms both',
          }}
        >
          {showingEdict ? (
            <ScrollManuscript
              kind="edict"
              title={edict.title}
              label={edict.seal ?? '主管批示'}
              meta={edict.verdict}
              accent={accent}
            >
              {edict.body}
            </ScrollManuscript>
          ) : activeFile ? (
            <ScrollManuscript
              kind="file"
              title={activeFile.title}
              label={activeFile.label}
              meta={activeFile.meta}
              status={activeFile.status}
              accent={accent}
            >
              {activeFile.body}
            </ScrollManuscript>
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] font-semibold text-[#7a4a08]">
              暂无部门文件
            </div>
          )}
        </div>

        {actions && (
          <footer className="relative z-10 mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3" style={{ borderColor: 'rgba(122,74,8,0.18)' }}>
            {actions}
          </footer>
        )}

      </div>
    </section>
  );
}
