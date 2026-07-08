'use client';

import Link from 'next/link';
import type { CSSProperties, PointerEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Activity, CheckCircle2, DatabaseZap, FileSearch, Palette, Radio, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { assetUrl } from '@/lib/asset';
import { withBasePath } from '@/lib/base-path';
import type { DadianFeedResponse, DadianPulseData } from '@/lib/contracts/dadian';
import { heroProofPoints, courtTimeline, sandTableNodes } from '../data/mockDadianData';
import { GoldDivider } from './GoldDivider';

const nodeToneClass = {
  healthy: 'border-[#3DD68C]/42 text-[#3DD68C] shadow-[0_0_22px_rgba(61,214,140,0.16)]',
  warning: 'border-[#F5A524]/44 text-[#F5A524] shadow-[0_0_22px_rgba(245,165,36,0.16)]',
  danger: 'border-[#F43F5E]/48 text-[#F43F5E] shadow-[0_0_22px_rgba(244,63,94,0.18)]',
  processing: 'border-[#F5A524]/44 text-[#F5A524] shadow-[0_0_22px_rgba(245,165,36,0.16)]',
  neutral: 'border-[#C9C0AC]/30 text-[#C9C0AC]',
};

const robeToneClass = {
  healthy: 'from-[#0f4639] via-[#12362f] to-[#071b17]',
  warning: 'from-[#60400c] via-[#3b2b0b] to-[#171004]',
  danger: 'from-[#5c1726] via-[#35101a] to-[#14070c]',
  processing: 'from-[#60400c] via-[#3b2b0b] to-[#171004]',
  neutral: 'from-[#313033] via-[#1d2026] to-[#090b10]',
};

type CourtSceneState = 'idle' | 'decree_cast' | 'risk' | 'archiving' | 'decree_ready';

const sceneLabels: Record<CourtSceneState, string> = {
  idle: '候命',
  decree_cast: '下旨中',
  risk: '风险复核',
  archiving: '史馆归档',
  decree_ready: '待老板裁决',
};

const sceneOrder: CourtSceneState[] = ['idle', 'decree_cast', 'risk', 'archiving', 'decree_ready'];

const sceneDescriptions: Record<CourtSceneState, string> = {
  idle: '群臣列班，等待老板一句话。',
  decree_cast: '圣旨已发，六部依次出列奏报。',
  risk: '朱砂线已触发，刑部与锦衣卫复核责任边界。',
  archiving: '史馆正在收束证据、旧案与会审链路。',
  decree_ready: '奏折已成，等待老板裁决下一步。',
};

const decisionActions = [
  { label: '准奏', icon: CheckCircle2, tone: 'border-[#3DD68C]/42 bg-[#3DD68C]/12 text-[#3DD68C]' },
  { label: '补证', icon: FileSearch, tone: 'border-[#F5A524]/42 bg-[#F5A524]/12 text-[#F5A524]' },
  { label: '复核', icon: RotateCcw, tone: 'border-[#F0C66A]/42 bg-[#F0C66A]/12 text-[#F0C66A]' },
  { label: '驳回', icon: XCircle, tone: 'border-[#F43F5E]/42 bg-[#F43F5E]/12 text-[#F43F5E]' },
];

const directorSteps = [
  { state: 'idle', label: '取数', owner: '丞相', body: '读取大殿 pulse / feed，先判今天最该裁的一件事。' },
  { state: 'decree_cast', label: '出列', owner: '六部', body: '按任务链路轮流出列，只讲风险、证据和下一步。' },
  { state: 'risk', label: '质门', owner: '刑部', body: '朱砂线只在责任边界漂移时触发，不做装饰性告警。' },
  { state: 'archiving', label: '入史', owner: '史馆', body: '旧案与本次证据链汇拢，作为裁决依据。' },
  { state: 'decree_ready', label: '圣裁', owner: '老板', body: '只留下准奏、补证、复核、驳回四个动作。' },
] as const;

async function pulseFetcher(url: string): Promise<DadianPulseData> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`pulse ${res.status}`);
  const json = (await res.json()) as { success: boolean; data: DadianPulseData };
  return json.data;
}

async function feedFetcher(url: string): Promise<DadianFeedResponse> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const json = (await res.json()) as { success: boolean; data: DadianFeedResponse };
  return json.data;
}

export function PalaceHero() {
  const [selectedName, setSelectedName] = useState(sandTableNodes[0]?.name ?? '');
  const [sceneState, setSceneState] = useState<CourtSceneState>('idle');
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState<number | null>(null);
  const [sceneTraceId, setSceneTraceId] = useState('scene-idle');
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });
  const [decisionReceipt, setDecisionReceipt] = useState<string | null>(null);
  const { data: pulse, error: pulseError } = useSWR<DadianPulseData>(
    withBasePath('/api/court/dadian/pulse'),
    pulseFetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const { data: feedData, error: feedError } = useSWR<DadianFeedResponse>(
    withBasePath('/api/court/dadian/feed'),
    feedFetcher,
    { refreshInterval: 15_000, revalidateOnFocus: false, dedupingInterval: 10_000 },
  );
  const selectedNode = useMemo(
    () => sandTableNodes.find((node) => node.name === selectedName) ?? sandTableNodes[0],
    [selectedName],
  );
  const activeSpeaker = activeSpeakerIndex === null ? null : sandTableNodes[activeSpeakerIndex];
  const isSceneRunning = sceneState === 'decree_cast' || sceneState === 'risk' || sceneState === 'archiving';
  const sceneStepIndex = sceneOrder.indexOf(sceneState);
  const topFeed = feedData?.items?.[0];
  const realSourceReady = pulse?.source === 'real' || feedData?.source === 'real';
  const sourceLabel = pulseError || feedError ? 'API ERROR' : realSourceReady ? 'LIVE' : 'FALLBACK';
  const sourceTone =
    sourceLabel === 'LIVE'
      ? 'border-[#3DD68C]/36 bg-[#3DD68C]/10 text-[#3DD68C]'
      : sourceLabel === 'API ERROR'
        ? 'border-[#F43F5E]/36 bg-[#F43F5E]/10 text-[#F43F5E]'
        : 'border-[#F5A524]/36 bg-[#F5A524]/10 text-[#F5A524]';
  const activeTasks = pulse?.activeTasks ?? 0;
  const pendingDecisions = pulse?.pendingDecisions ?? 0;
  const selectedQuality =
    selectedNode?.tone === 'healthy'
      ? 94
      : selectedNode?.tone === 'processing'
        ? 88
        : selectedNode?.tone === 'warning'
          ? 81
          : selectedNode?.tone === 'danger'
            ? 73
            : 78;
  const heroStyle = {
    backgroundImage: `linear-gradient(180deg, rgba(2,5,13,0.52) 0%, rgba(2,5,13,0.04) 38%, rgba(2,5,13,0.18) 62%, rgba(2,5,13,0.72) 100%), image-set(url(${assetUrl('/assets/dadian/hall-stage-tang-1280.avif')}) type("image/avif"), url(${assetUrl('/assets/dadian/hall-stage-tang.webp?v=2')}) type("image/webp"))`,
    '--court-x': `${pointerOffset.x}px`,
    '--court-y': `${pointerOffset.y}px`,
    '--court-x-soft': `${pointerOffset.x * 0.45}px`,
    '--court-y-soft': `${pointerOffset.y * 0.45}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!sceneTraceId.startsWith('dadian-ui-')) return;

    setSceneState('decree_cast');
    setActiveSpeakerIndex(0);
    const timers = sandTableNodes.map((node, index) => (
      window.setTimeout(() => {
        setSelectedName(node.name);
        setActiveSpeakerIndex(index);
      }, index * 900)
    ));
    const riskTimer = window.setTimeout(() => {
      const riskIndex = sandTableNodes.findIndex((node) => node.tone === 'danger');
      if (riskIndex >= 0) {
        setSelectedName(sandTableNodes[riskIndex].name);
        setActiveSpeakerIndex(riskIndex);
      }
      setSceneState('risk');
    }, sandTableNodes.length * 900 + 300);
    const archiveTimer = window.setTimeout(() => {
      const archiveIndex = sandTableNodes.findIndex((node) => node.name === '史馆');
      if (archiveIndex >= 0) {
        setSelectedName(sandTableNodes[archiveIndex].name);
        setActiveSpeakerIndex(archiveIndex);
      }
      setSceneState('archiving');
    }, sandTableNodes.length * 900 + 1800);
    const doneTimer = window.setTimeout(() => {
      setSceneState('decree_ready');
      setActiveSpeakerIndex(null);
    }, sandTableNodes.length * 900 + 3300);

    return () => {
      [...timers, riskTimer, archiveTimer, doneTimer].forEach(window.clearTimeout);
    };
  }, [sceneTraceId]);

  function castDecree() {
    const traceSeed = Date.now().toString(36).slice(-6);
    setSceneTraceId(`dadian-ui-${traceSeed}`);
    setSceneState('decree_cast');
    setDecisionReceipt(null);
  }

  function recordDecision(action: string) {
    const actionVerb: Record<string, string> = {
      准奏: '已生成准奏回执，等待接入史馆持久化。',
      补证: '已标记补证，建议回上书房补齐证据。',
      复核: '已转军机处复核，保留当前奏折。',
      驳回: '已记录驳回理由入口，禁止静默执行。',
    };
    setDecisionReceipt(actionVerb[action] ?? '裁决已记录。');
  }

  function updatePointerOffset(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 18;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 12;
    setPointerOffset({ x, y });
  }

  return (
    <section
      className={`relative flex min-h-[560px] flex-col items-center justify-between overflow-hidden rounded-[8px] border bg-cover bg-center px-5 py-7 text-center shadow-[inset_0_0_0_1px_rgba(255,233,176,0.07),inset_0_0_90px_rgba(0,0,0,0.24),0_34px_120px_rgba(0,0,0,0.48)] transition duration-700 md:min-h-[680px] md:px-10 md:py-10 ${
        sceneState === 'risk'
          ? 'border-[#F43F5E]/54'
          : sceneState === 'decree_ready'
            ? 'border-[#3DD68C]/48'
            : 'border-[#C59648]/44'
      }`}
      style={heroStyle}
      onPointerMove={updatePointerOffset}
      onPointerLeave={() => setPointerOffset({ x: 0, y: 0 })}
    >
      <div aria-hidden className="absolute inset-0 translate-x-[var(--court-x-soft)] translate-y-[var(--court-y-soft)] bg-[radial-gradient(58%_48%_at_50%_42%,rgba(240,198,106,0.08),rgba(2,5,13,0)_48%,rgba(2,5,13,0.22)_100%)] transition-transform duration-300 motion-reduce:translate-x-0 motion-reduce:translate-y-0" />
      <div aria-hidden className="absolute inset-0 opacity-45 mix-blend-screen">
        <span className="absolute left-[18%] top-0 h-[54%] w-px rotate-[18deg] bg-gradient-to-b from-[#F0C66A]/42 via-[#F0C66A]/10 to-transparent blur-[0.5px]" />
        <span className="absolute left-[47%] top-0 h-[48%] w-px rotate-[-7deg] bg-gradient-to-b from-[#F3EDDF]/28 via-[#F0C66A]/10 to-transparent blur-[0.5px]" />
        <span className="absolute right-[16%] top-0 h-[58%] w-px rotate-[-22deg] bg-gradient-to-b from-[#3DD68C]/24 via-[#F0C66A]/10 to-transparent blur-[0.5px]" />
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-28 translate-x-[var(--court-x)] bg-[linear-gradient(90deg,transparent,rgba(240,198,106,0.08),transparent)] opacity-60 blur-xl transition-transform duration-300 motion-reduce:translate-x-0" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_26px)] opacity-[0.08]" />
      <div aria-hidden className="absolute inset-3 rounded-[6px] border border-[#F0C66A]/12 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.55)]" />
      <div aria-hidden className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/64 to-transparent" />
      <div aria-hidden className="absolute inset-x-8 bottom-8 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/30 to-transparent" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F0C66A]/10 blur-3xl motion-safe:animate-breathe" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(100deg,transparent_0%,rgba(240,198,106,0.16)_42%,transparent_58%)] opacity-60 motion-safe:animate-shimmer" />
      <div aria-hidden className="absolute left-1/2 top-[47%] h-px w-[70%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#F0C66A]/34 to-transparent" />
      <div aria-hidden className="absolute left-1/2 top-[47%] h-[18rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F0C66A]/10" />
      <div
        aria-hidden
        className={`absolute left-[12%] right-[16%] top-[49%] z-[9] h-px origin-left bg-gradient-to-r from-transparent via-[#F0C66A] to-transparent opacity-0 transition duration-500 ${
          sceneState === 'decree_cast' || sceneState === 'archiving' ? 'opacity-80 motion-safe:animate-shimmer' : ''
        }`}
      />
      <div
        aria-hidden
        className={`absolute right-[18%] top-[42%] z-[9] h-[2px] w-[46%] origin-right -rotate-12 bg-gradient-to-r from-transparent via-[#F43F5E] to-[#F43F5E] opacity-0 shadow-[0_0_18px_rgba(244,63,94,0.55)] transition duration-500 ${
          sceneState === 'risk' ? 'opacity-85' : ''
        }`}
      />
      <div
        aria-hidden
        className={`absolute right-[27%] top-[47%] z-[9] h-24 w-24 rounded-full border border-[#3DD68C]/32 opacity-0 transition duration-500 ${
          sceneState === 'archiving' ? 'opacity-70 motion-safe:animate-pulse-glow' : ''
        }`}
      />
      <div
        aria-hidden
        className={`absolute left-1/2 top-[60%] z-[11] h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F0C66A]/45 bg-[radial-gradient(circle_at_50%_42%,rgba(240,198,106,0.9),rgba(134,92,31,0.45)_42%,rgba(2,5,13,0)_70%)] opacity-0 shadow-[0_0_32px_rgba(240,198,106,0.45)] transition duration-500 ${
          isSceneRunning || sceneState === 'decree_ready'
            ? 'scale-100 opacity-80 motion-safe:animate-pulse-glow'
            : 'scale-75'
        }`}
      />
      <div
        aria-hidden
        className={`absolute left-[18%] top-[61%] z-[10] h-px w-[64%] origin-left bg-gradient-to-r from-transparent via-[#F0C66A]/80 to-transparent opacity-0 transition duration-700 ${
          sceneState === 'decree_cast' ? 'opacity-80 motion-safe:animate-shimmer' : ''
        }`}
      />
      <div
        aria-hidden
        className={`absolute bottom-[9.4rem] left-1/2 z-[10] hidden h-[7.5rem] w-px -translate-x-1/2 bg-gradient-to-b from-[#F0C66A]/70 via-[#F0C66A]/16 to-transparent opacity-0 md:block ${
          sceneState === 'decree_ready' ? 'opacity-80 motion-safe:animate-breathe' : ''
        }`}
      />
      <div
        aria-hidden
        className={`absolute inset-x-12 bottom-[6.5rem] z-[9] hidden h-px bg-gradient-to-r from-transparent via-[#3DD68C]/70 to-transparent opacity-0 transition duration-700 md:block ${
          sceneState === 'decree_ready' ? 'opacity-70' : ''
        }`}
      />

      <div className="absolute left-4 top-4 z-20 hidden max-w-[230px] rounded-[7px] border border-[#F0C66A]/32 bg-[#07111b]/72 p-3 text-left shadow-[0_18px_48px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,238,190,0.1)] backdrop-blur-md md:block">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D8B76A]">
          <Palette className="h-3.5 w-3.5" />
          Libu Visual Mandate
        </div>
        <p className="mt-2 text-[12px] leading-5 text-[#F3EDDF]/72">
          世界窗口 · 群臣活体 · 状态即动画
        </p>
      </div>

      <div className="absolute right-4 top-4 z-20 hidden w-[280px] rounded-[7px] border border-[#F0C66A]/28 bg-[#07111b]/72 p-3 text-left shadow-[0_18px_48px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,238,190,0.1)] backdrop-blur-md lg:block">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D8B76A]">
            <Radio className="h-3.5 w-3.5" />
            Live Director
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] ${sourceTone}`}>
            {sourceLabel}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#F3EDDF]/76">
          {topFeed?.title ?? '等待真实朝堂动态；当前展示大殿基准任务。'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[5px] border border-white/10 bg-black/22 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-[0.16em] text-[#8F835F]">Running</p>
            <p className="mt-1 text-[17px] font-semibold text-[#F0C66A]">{activeTasks}</p>
          </div>
          <div className="rounded-[5px] border border-white/10 bg-black/22 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-[0.16em] text-[#8F835F]">Pending</p>
            <p className="mt-1 text-[17px] font-semibold text-[#3DD68C]">{pendingDecisions}</p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 hidden md:block">
        {sandTableNodes.map((node, index) => (
          <button
            type="button"
            key={node.name}
            aria-label={`查看${node.name}奏报：${node.role}，当前${node.status}`}
            onClick={() => setSelectedName(node.name)}
            className={`group pointer-events-auto absolute ${node.positionClass} flex h-28 w-24 -translate-x-1/2 flex-col items-center justify-end text-center transition duration-300 hover:-translate-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F0C66A]/70 ${
              activeSpeakerIndex === index ? '-translate-y-3' : ''
            }`}
            style={{ animationDelay: `${index * 180}ms` }}
          >
            <span
              aria-hidden
              className={`absolute bottom-2 h-16 w-16 rounded-full border border-current opacity-0 blur-sm transition ${
                selectedNode?.name === node.name || activeSpeakerIndex === index
                  ? 'opacity-50 motion-safe:animate-pulse-glow'
                  : 'group-hover:opacity-25'
              }`}
            />
            <span
              className={`absolute -top-8 left-1/2 min-w-32 -translate-x-1/2 rounded-[6px] border bg-[#07111b]/88 px-3 py-2 text-left shadow-[0_16px_40px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,238,190,0.1)] backdrop-blur-md transition duration-300 ${
                selectedNode?.name === node.name || activeSpeakerIndex === index
                  ? 'border-[#F0C66A]/54 opacity-100'
                  : 'border-[#C59648]/36 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
              }`}
            >
              <span className="block whitespace-nowrap text-[11px] leading-4 text-[#F3EDDF]/82">{node.line}</span>
              <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-[#C59648]/36 bg-[#07111b]/88" />
            </span>

            <span className={`relative flex h-24 w-16 origin-bottom flex-col items-center justify-end motion-safe:animate-breathe ${activeSpeakerIndex === index ? 'scale-110 drop-shadow-[0_0_24px_rgba(240,198,106,0.38)]' : ''}`}>
              {activeSpeakerIndex === index && (
                <span className="absolute -top-5 rounded-full border border-[#F0C66A]/38 bg-[#F0C66A]/14 px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] text-[#F0C66A]">
                  出列
                </span>
              )}
              <span className="absolute top-1 h-4 w-8 rounded-t-[3px] border border-[#C59648]/38 bg-[#07111b] shadow-[0_0_18px_rgba(0,0,0,0.55)]" />
              <span className="absolute top-4 h-7 w-7 rounded-full border border-[#C59648]/30 bg-[radial-gradient(circle_at_50%_34%,#d2a35f,#5c341c_72%)] shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
              <span className={`absolute bottom-8 h-9 w-11 rounded-t-[18px] border border-[#C59648]/28 bg-gradient-to-b ${robeToneClass[node.tone]} shadow-[inset_0_1px_0_rgba(255,238,190,0.12),0_16px_30px_rgba(0,0,0,0.5)]`} />
              <span className={`absolute bottom-2 h-12 w-14 rounded-b-[26px] rounded-t-[10px] border border-[#C59648]/22 bg-gradient-to-b ${robeToneClass[node.tone]} shadow-[inset_0_1px_0_rgba(255,238,190,0.08),0_16px_32px_rgba(0,0,0,0.55)]`} />
              <span className={`absolute bottom-0 h-2 w-20 rounded-full bg-current opacity-45 blur-[2px] ${nodeToneClass[node.tone]}`} />
              <span className={`absolute right-0 top-14 h-2 w-2 rounded-full bg-current shadow-[0_0_14px_currentColor] ${nodeToneClass[node.tone]}`} />
            </span>

            <span className={`mt-1 rounded-[5px] border bg-[#07111b]/84 px-2 py-1 backdrop-blur-sm ${nodeToneClass[node.tone]}`}>
              <span className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold tracking-[0.08em] text-[#F3EDDF]">{node.name}</span>
              </span>
              <span className="mt-1 block text-[10px] tracking-[0.12em]">{node.status}</span>
            </span>
          </button>
        ))}
      </div>

      {selectedNode && (
        <aside className="absolute inset-x-4 bottom-[8.8rem] z-20 mx-auto max-w-[min(680px,calc(100%-2rem))] rounded-[7px] border border-[#C59648]/56 bg-[#07111b]/88 p-4 text-left shadow-[0_28px_80px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,238,190,0.12)] backdrop-blur-xl md:inset-x-auto md:left-8 md:top-[17rem] md:bottom-auto md:w-[330px] xl:w-[350px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8F835F]">
                Department Memorial
              </p>
              <h2 className="mt-1 text-[18px] font-semibold tracking-[0.08em] text-[#F0C66A]">
                {selectedNode.name} · {selectedNode.memorialTitle}
              </h2>
            </div>
            <span className={`mt-1 rounded-full border px-2 py-1 text-[10px] ${nodeToneClass[selectedNode.tone]}`}>
              {selectedNode.status}
            </span>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[#F3EDDF]/78">{selectedNode.memorialBody}</p>
          <div className="mt-3 grid gap-2">
            <div className="rounded-[5px] border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-[#F0C66A]">发言质量</p>
                <span className="font-mono text-[13px] text-[#F0C66A]">{selectedQuality}/100</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8A6A2A] via-[#F0C66A] to-[#3DD68C] transition-[width] duration-500"
                  style={{ width: `${selectedQuality}%` }}
                />
              </div>
            </div>
            <div className="rounded-[5px] border border-[#F43F5E]/24 bg-[#F43F5E]/8 px-3 py-2">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#F43F5E]">风险</p>
              <p className="mt-1 text-[12px] leading-5 text-[#F3EDDF]/76">{selectedNode.risk}</p>
            </div>
            <div className="rounded-[5px] border border-[#3DD68C]/22 bg-[#3DD68C]/8 px-3 py-2">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#3DD68C]">建议</p>
              <p className="mt-1 text-[12px] leading-5 text-[#F3EDDF]/76">{selectedNode.counsel}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href={selectedNode.href}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-[6px] border border-[#F0C66A]/42 bg-[#F0C66A]/14 text-[12px] font-semibold tracking-[0.08em] text-[#F0C66A] transition hover:bg-[#F0C66A]/22"
            >
              进入{selectedNode.name}
            </Link>
            <Link
              href="/command-center"
              className="inline-flex h-9 flex-1 items-center justify-center rounded-[6px] border border-white/12 bg-black/20 text-[12px] font-semibold tracking-[0.08em] text-[#F3EDDF]/78 transition hover:border-[#F0C66A]/36 hover:text-[#F0C66A]"
            >
              送军机处
            </Link>
          </div>
        </aside>
      )}

      <div className="relative z-10 max-w-[760px] translate-x-[var(--court-x-soft)] translate-y-[var(--court-y-soft)] pt-2 transition-transform duration-300 motion-reduce:translate-x-0 motion-reduce:translate-y-0">
        <div className="mx-auto inline-flex items-center gap-2 rounded-[5px] border border-[#C59648]/44 bg-[#07111b]/76 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D8B76A] shadow-[inset_0_1px_0_rgba(255,238,190,0.12)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3DD68C] shadow-[0_0_12px_rgba(61,214,140,0.8)]" />
          Chaotang OS · Living Imperial Interface
        </div>
        <h1 className="mt-6 font-serif text-[44px] font-black leading-none tracking-[0.16em] text-[#F2D28A] drop-shadow-[0_16px_36px_rgba(0,0,0,0.75)] md:text-[82px]">
          大殿
        </h1>
        <p className="mt-4 text-[13px] uppercase tracking-[0.32em] text-[#E6CB85]/82 md:text-[15px]">
          企业 AI 内阁系统 · 群臣蜂群指挥中枢
        </p>
        <GoldDivider className="mx-auto mt-6 w-[min(560px,80vw)]" />
        <p className="mx-auto mt-7 max-w-[640px] rounded-[6px] border border-black/20 bg-black/22 px-4 py-3 text-[15px] leading-8 text-[#F3EDDF]/90 shadow-[0_12px_34px_rgba(0,0,0,0.28)] md:text-[17px] md:leading-9">
          一句话下旨，丞相拆解，群臣会审，蜂群执行，结果成奏折，老板一键裁决。
        </p>

        <div className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-4">
          {heroProofPoints.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-[6px] border border-[#C59648]/28 bg-[#07111b]/58 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,238,190,0.08)]">
                <Icon className="mx-auto h-4 w-4 text-[#F0C66A]" />
                <div className="mt-2 text-[11px] tracking-[0.08em] text-[#F3EDDF]/78">{item.label}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
          {sandTableNodes.map((node) => (
            <button
              type="button"
              key={node.name}
              onClick={() => setSelectedName(node.name)}
              className={`rounded-[5px] border bg-[#07111b]/72 px-2 py-2 text-center text-[11px] font-semibold tracking-[0.08em] backdrop-blur-sm ${nodeToneClass[node.tone]}`}
            >
              <span className="block text-[#F3EDDF]">{node.name}</span>
              <span className="mt-1 block text-[9px] font-medium">{node.status}</span>
            </button>
          ))}
        </div>

        <div className="mx-auto mt-4 max-w-[680px] rounded-[7px] border border-[#C59648]/36 bg-[#07111b]/78 p-3 text-left shadow-[0_18px_42px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,238,190,0.08)] backdrop-blur-md">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div aria-live="polite">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8F835F]">
              Decree Action
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[#F3EDDF]/78">
              {activeSpeaker
                ? `${activeSpeaker.name}：${activeSpeaker.line}`
                : `${sceneLabels[sceneState]}：${sceneDescriptions[sceneState]}`}
            </p>
          </div>
          <button
            type="button"
            onClick={castDecree}
            disabled={isSceneRunning}
            className="group relative inline-flex h-10 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-[#F0C66A]/62 bg-[linear-gradient(180deg,rgba(240,198,106,0.92),rgba(168,133,63,0.92))] px-5 text-[13px] font-semibold tracking-[0.08em] text-[#130D04] shadow-[0_14px_36px_rgba(240,198,106,0.18)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-white/28 opacity-0 transition duration-500 group-hover:left-[115%] group-hover:opacity-100" />
            <span className="relative z-10">{isSceneRunning ? '群臣会审中' : sceneState === 'decree_ready' ? '再开一议' : '一键下旨'}</span>
          </button>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {sceneOrder.map((step, index) => (
              <div
                key={step}
                className={`h-1.5 rounded-full transition duration-500 ${
                  index <= sceneStepIndex ? 'bg-[#F0C66A] shadow-[0_0_12px_rgba(240,198,106,0.45)]' : 'bg-white/10'
                }`}
                aria-label={`${sceneLabels[step]}${index <= sceneStepIndex ? '已到达' : '未到达'}`}
              />
            ))}
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-5">
            {directorSteps.map((step, index) => {
              const active = index <= sceneStepIndex;
              return (
                <div
                  key={step.state}
                  className={`rounded-[5px] border px-2 py-2 transition duration-300 ${
                    active
                      ? 'border-[#F0C66A]/38 bg-[#F0C66A]/10 text-[#F3EDDF]'
                      : 'border-white/10 bg-black/18 text-[#F3EDDF]/48'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.14em] text-[#F0C66A]">{step.label}</span>
                    <span className="text-[9px] text-[#8F835F]">{step.owner}</span>
                  </div>
                  <p className="mt-1 hidden text-[10px] leading-4 md:block">{step.body}</p>
                </div>
              );
            })}
          </div>

          {sceneState === 'decree_ready' && (
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {decisionActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    type="button"
                    key={action.label}
                    onClick={() => recordDecision(action.label)}
                    className={`group inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border text-[12px] font-semibold tracking-[0.08em] transition hover:-translate-y-0.5 ${action.tone}`}
                  >
                    <Icon className="h-3.5 w-3.5 transition group-hover:scale-110" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
          {sceneState === 'decree_ready' && (
            <div className="mt-3 flex items-center gap-2 rounded-[5px] border border-[#3DD68C]/24 bg-[#3DD68C]/8 px-3 py-2 text-[11px] leading-5 text-[#D7FBE8]/78">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#3DD68C]" />
              {decisionReceipt ?? '礼部评审：裁决态已收束，老板可在 5 秒内完成下一步。'}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 hidden items-center gap-3 md:flex">
        {courtTimeline.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] transition ${
                index <= Math.min(sceneStepIndex, courtTimeline.length - 1)
                  ? 'border-[#F0C66A]/46 bg-[#F0C66A]/12 text-[#F0C66A]'
                  : 'border-[#F0C66A]/18 bg-black/20 text-[#F3EDDF]/76'
              }`}>
                <Icon className="h-3.5 w-3.5 text-[#F0C66A]" />
                {item.label}
              </div>
              {index < courtTimeline.length - 1 && <span className="h-px w-8 bg-[#F0C66A]/22" />}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-3 left-4 z-30 hidden rounded-[5px] border border-white/10 bg-black/34 px-2 py-1 text-[10px] tracking-[0.08em] text-[#C9C0AC]/62 backdrop-blur-sm md:block">
        <span className="inline-flex items-center gap-1">
          <Activity className="h-3 w-3" />
          UI {sceneState}
        </span>
        <span className="mx-1">·</span>
        {sceneTraceId}
        <span className="mx-1">·</span>
        <span className="inline-flex items-center gap-1">
          <DatabaseZap className="h-3 w-3" />
          source {sourceLabel}
        </span>
        <span className="mx-1">· persisted UI-local</span>
      </div>
    </section>
  );
}
