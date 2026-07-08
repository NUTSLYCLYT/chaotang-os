'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import useSWR from 'swr';
import {
  Archive,
  CheckCircle2,
  FileSearch,
  Gavel,
  Landmark,
  MessageSquareText,
  Radio,
  RotateCcw,
  Send,
  ScrollText,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { assetUrl } from '@/lib/asset';
import { withBasePath } from '@/lib/base-path';
import type { DadianFeedResponse, DadianPulseData } from '@/lib/contracts/dadian';
import { sandTableNodes } from '../data/mockDadianData';

type StageState = 'ready' | 'decree' | 'council' | 'risk' | 'archive' | 'verdict';
type MinisterReply =
  | {
      status: 'answered';
      source: 'DEPT_API';
      answer: string;
      evidence: string[];
      conflicts?: string;
      confidence?: number;
      model?: string;
      reasoning?: string;
    }
  | {
      status: 'unavailable' | 'error';
      source: 'UNAVAILABLE' | 'ERROR';
      answer: string;
      evidence: string[];
    };

const stageOrder: StageState[] = ['ready', 'decree', 'council', 'risk', 'archive', 'verdict'];

const stageCopy: Record<StageState, { label: string; line: string }> = {
  ready: { label: '御前候旨', line: '户部统筹资源，工部营造体验，丞相验收世界级标准。' },
  decree: { label: '圣旨生成', line: '一句话化为圣旨编号，进入丞相拆解。' },
  council: { label: '六部会审', line: '席位依次点亮，只保留证据、风险和下一步。' },
  risk: { label: '朱砂质门', line: '刑部触发责任边界，阻止未经确认的对外承诺。' },
  archive: { label: '史馆成卷', line: '旧案、证据、分歧和建议被收束为奏折依据。' },
  verdict: { label: '御案待裁', line: '奏折已呈上，只剩准奏、补证、复核、驳回。' },
};

const verdictActions = [
  { label: '准奏', icon: CheckCircle2, className: 'border-[#3DD68C]/50 bg-[#3DD68C]/12 text-[#3DD68C]' },
  { label: '补证', icon: FileSearch, className: 'border-[#F5A524]/50 bg-[#F5A524]/12 text-[#F5A524]' },
  { label: '复核', icon: RotateCcw, className: 'border-[#F0C66A]/50 bg-[#F0C66A]/12 text-[#F0C66A]' },
  { label: '驳回', icon: XCircle, className: 'border-[#F43F5E]/50 bg-[#F43F5E]/12 text-[#F43F5E]' },
];

const teamMarks = [
  { label: '户部统筹', body: '预算与 ROI 先定边界' },
  { label: '工部营造', body: '交互与性能同步验收' },
  { label: '丞相验收', body: '是否达到世界级产品瞬间' },
];

const ministerPortraits = [
  {
    name: '户部',
    deptCode: 'hubu',
    title: '尚书 · 钱谷司',
    image: '/heroes/character-roster/v5-manors-su-qin.webp',
    x: '-470px',
    y: '82px',
    scale: 0.9,
  },
  {
    name: '兵部',
    deptCode: 'ops',
    title: '大司马 · 战情司',
    image: '/heroes/character-roster/bingbu-sun-wu.webp',
    x: '-306px',
    y: '18px',
    scale: 0.78,
  },
  {
    name: '工部',
    deptCode: 'works',
    title: '营造监 · 质量司',
    image: '/heroes/character-roster/v5-command-center-zhuge-liang.webp',
    x: '-122px',
    y: '-20px',
    scale: 0.7,
  },
  {
    name: '刑部',
    deptCode: 'legal',
    title: '大理卿 · 质门司',
    image: '/heroes/character-roster/unused-bao-zheng.webp',
    x: '122px',
    y: '-16px',
    scale: 0.7,
  },
  {
    name: '礼部',
    deptCode: null,
    title: '行人司 · 对外司',
    image: '/heroes/character-roster/manors-su-qin.webp',
    x: '306px',
    y: '20px',
    scale: 0.78,
  },
  {
    name: '史馆',
    deptCode: null,
    title: '太史令 · 归档司',
    image: '/heroes/character-roster/archive-di-renjie.webp',
    x: '470px',
    y: '84px',
    scale: 0.9,
  },
];

const dustPoints = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 17) % 84)}%`,
  top: `${16 + ((index * 23) % 58)}%`,
  delay: `${(index % 6) * 0.7}s`,
  size: `${2 + (index % 3)}px`,
}));

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

function parseMaybeJsonAnswer(answer: string): {
  answer: string;
  evidence?: string[];
  conflicts?: string;
  confidence?: number;
  reasoning?: string;
} {
  const fenced = answer.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? answer;
  try {
    const parsed = JSON.parse(candidate) as {
      answer?: unknown;
      evidence?: unknown;
      conflicts?: unknown;
      confidence?: unknown;
      reasoning?: unknown;
    };
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : answer,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter((item): item is string => typeof item === 'string') : undefined,
      conflicts: typeof parsed.conflicts === 'string' ? parsed.conflicts : undefined,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
    };
  } catch {
    return { answer };
  }
}

export function WorldCourtStage() {
  const [stage, setStage] = useState<StageState>('ready');
  const [activeSeat, setActiveSeat] = useState(0);
  const [selectedSeat, setSelectedSeat] = useState(2);
  const [traceId, setTraceId] = useState('awaiting-decree');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [ministerQuestion, setMinisterQuestion] = useState('这件事现在最大的风险是什么？');
  const [ministerReply, setMinisterReply] = useState<MinisterReply | null>(null);
  const [ministerAsking, setMinisterAsking] = useState(false);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

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

  const sourceLabel = pulseError || feedError ? 'API ERROR' : pulse?.source === 'real' || feedData?.source === 'real' ? 'LIVE' : 'FALLBACK';
  const latestTitle = feedData?.items?.[0]?.title ?? '等待真实朝堂动态，当前显示世界级视觉验收任务。';
  const taskId = useMemo(() => {
    const fromFeed = feedData?.items?.[0]?.taskId;
    if (fromFeed) return fromFeed;
    return traceId === 'awaiting-decree' ? 'CT-VISUAL-READY' : `CT-${traceId.toUpperCase()}`;
  }, [feedData?.items, traceId]);

  const stageIndex = stageOrder.indexOf(stage);
  const activeNode = sandTableNodes[activeSeat % sandTableNodes.length];
  const selectedNode = sandTableNodes[selectedSeat % sandTableNodes.length];
  const isRunning = stage !== 'ready' && stage !== 'verdict';

  useEffect(() => {
    if (traceId === 'awaiting-decree') return;

    const timers = [
      window.setTimeout(() => setStage('decree'), 120),
      window.setTimeout(() => setStage('council'), 1050),
      window.setTimeout(() => setStage('risk'), 3100),
      window.setTimeout(() => setStage('archive'), 4700),
      window.setTimeout(() => setStage('verdict'), 6400),
    ];
    const seatTimers = sandTableNodes.map((_, index) => (
      window.setTimeout(() => setActiveSeat(index), 1150 + index * 430)
    ));

    return () => {
      [...timers, ...seatTimers].forEach(window.clearTimeout);
    };
  }, [traceId]);

  function castDecree() {
    const seed = Date.now().toString(36).slice(-7);
    setTraceId(`ui-${seed}`);
    setStage('decree');
    setActiveSeat(0);
    setReceipt(null);
  }

  function recordVerdict(label: string) {
    const map: Record<string, string> = {
      准奏: '准奏回执已生成；下一步应写入史馆并触发执行队列。',
      补证: '补证令已生成；下一步回上书房补齐证据。',
      复核: '复核令已生成；下一步转军机处二次会审。',
      驳回: '驳回记录已生成；禁止静默执行。',
    };
    setReceipt(map[label] ?? '裁决已记录。');
  }

  function summonMinister(index: number) {
    setActiveSeat(index);
    setSelectedSeat(index);
    setMinisterReply(null);
  }

  async function askMinister() {
    const portrait = ministerPortraits[selectedSeat % ministerPortraits.length];
    const command = ministerQuestion.trim();
    if (!portrait.deptCode) {
      setMinisterReply({
        status: 'unavailable',
        source: 'UNAVAILABLE',
        answer: `${selectedNode.name}尚未接入真实部门单 agent。本次只保留奏折、风险和建议，不生成假回奏。`,
        evidence: ['delivery_gate: department_agent_not_configured'],
      });
      return;
    }
    if (command.length < 5) {
      setMinisterReply({
        status: 'error',
        source: 'ERROR',
        answer: '追问过短，请把要裁的问题说清楚。',
        evidence: ['client_validation: command_min_length_5'],
      });
      return;
    }

    setMinisterAsking(true);
    setMinisterReply(null);
    try {
      const endpoint = portrait.deptCode === 'hubu'
        ? withBasePath('/api/court/hubu/ask')
        : withBasePath(`/api/court/dept/${encodeURIComponent(portrait.deptCode)}/ask`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ command }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        answer?: unknown;
        evidence?: unknown;
        conflicts?: unknown;
        confidence?: unknown;
        model?: unknown;
        error?: unknown;
      };
      if (!response.ok || !payload.ok) {
        const message = typeof payload.error === 'string' ? payload.error : `部门 API 返回 ${response.status}`;
        setMinisterReply({
          status: 'error',
          source: 'ERROR',
          answer: `${selectedNode.name}真实回奏不可用：${message}`,
          evidence: [`http_status:${response.status}`],
        });
        return;
      }

      const answerText = typeof payload.answer === 'string' ? payload.answer : '部门已回奏，但未返回有效正文。';
      const parsedAnswer = parseMaybeJsonAnswer(answerText);
      const responseEvidence = Array.isArray(payload.evidence) ? payload.evidence.filter((item): item is string => typeof item === 'string') : [];
      setMinisterReply({
        status: 'answered',
        source: 'DEPT_API',
        answer: parsedAnswer.answer,
        evidence: (parsedAnswer.evidence ?? responseEvidence).slice(0, 4),
        conflicts: parsedAnswer.conflicts ?? (typeof payload.conflicts === 'string' ? payload.conflicts : undefined),
        confidence: parsedAnswer.confidence ?? (typeof payload.confidence === 'number' ? payload.confidence : undefined),
        model: typeof payload.model === 'string' ? payload.model : undefined,
        reasoning: parsedAnswer.reasoning,
      });
    } catch (error) {
      setMinisterReply({
        status: 'error',
        source: 'ERROR',
        answer: `${selectedNode.name}真实回奏请求失败：${error instanceof Error ? error.message : String(error)}`,
        evidence: ['network_error'],
      });
    } finally {
      setMinisterAsking(false);
    }
  }

  function updatePointer(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 24,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 16,
    });
  }

  return (
    <section
      className="court-world-stage relative min-h-[calc(100vh-92px)] overflow-hidden rounded-[8px] border border-[#C59648]/38 bg-[#02050d] shadow-[0_34px_120px_rgba(0,0,0,0.56),inset_0_0_0_1px_rgba(255,238,190,0.08)]"
      data-stage={stage}
      style={{
        '--stage-x': `${pointer.x}px`,
        '--stage-y': `${pointer.y}px`,
        '--stage-x-soft': `${pointer.x * 0.42}px`,
        '--stage-y-soft': `${pointer.y * 0.42}px`,
      } as CSSProperties}
      onPointerMove={updatePointer}
      onPointerLeave={() => setPointer({ x: 0, y: 0 })}
    >
      <div
        aria-hidden
        className="stage-bg-far absolute inset-0 scale-[1.03] bg-cover bg-center opacity-95 saturate-[1.08]"
        style={{
          backgroundImage: `image-set(url(${assetUrl('/assets/dadian/hall-stage-tang-1280.avif')}) type("image/avif"), url(${assetUrl('/assets/dadian/hall-stage-tang.webp?v=2')}) type("image/webp"))`,
        }}
      />
      <div aria-hidden className="stage-bg-near absolute inset-0 bg-[radial-gradient(50%_34%_at_50%_56%,rgba(240,198,106,0.10),transparent_58%)]" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(58%_42%_at_50%_38%,rgba(240,198,106,0.08),rgba(2,5,13,0.12)_42%,rgba(2,5,13,0.82)_100%)]" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,5,13,0.9),rgba(2,5,13,0.16)_28%,rgba(2,5,13,0.12)_70%,rgba(2,5,13,0.88))]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#02050d]/92 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#02050d] via-[#02050d]/64 to-transparent" />
      <div aria-hidden className="temple-column temple-column-left absolute inset-y-0 left-0 z-[4] hidden w-[18%] md:block" />
      <div aria-hidden className="temple-column temple-column-right absolute inset-y-0 right-0 z-[4] hidden w-[18%] md:block" />
      <div aria-hidden className="perspective-floor absolute bottom-[14%] left-1/2 z-[5] hidden h-[34%] w-[86%] -translate-x-1/2 md:block" />
      <div aria-hidden className="absolute inset-0 opacity-45">
        {dustPoints.map((point) => (
          <span
            key={point.id}
            className="stage-dust absolute rounded-full bg-[#F0C66A]/45"
            style={{ left: point.left, top: point.top, width: point.size, height: point.size, animationDelay: point.delay }}
          />
        ))}
      </div>
      <div aria-hidden className="absolute left-1/2 top-[41%] h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F0C66A]/12 bg-[#F0C66A]/8 blur-[1px] motion-safe:animate-breathe" />
      <div aria-hidden className={`absolute left-1/2 top-[44%] h-px w-[72%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#F0C66A]/80 to-transparent transition duration-700 ${isRunning ? 'opacity-100 motion-safe:animate-shimmer' : 'opacity-35'}`} />
      <div aria-hidden className={`absolute right-[18%] top-[45%] h-[2px] w-[46%] -rotate-12 bg-gradient-to-r from-transparent via-[#F43F5E] to-[#F43F5E] opacity-0 shadow-[0_0_28px_rgba(244,63,94,0.6)] transition duration-500 ${stage === 'risk' ? 'opacity-90' : ''}`} />
      <div aria-hidden className={`absolute bottom-[16%] left-1/2 h-24 w-[64%] -translate-x-1/2 rounded-[50%] border border-[#3DD68C]/0 transition duration-700 ${stage === 'archive' || stage === 'verdict' ? 'border-[#3DD68C]/24 shadow-[0_0_40px_rgba(61,214,140,0.18)]' : ''}`} />
      <div aria-hidden className="dispatch-beam absolute left-1/2 top-[57%] z-[9] h-[3px] w-[38%] origin-left -translate-y-1/2 bg-gradient-to-r from-[#F0C66A] via-[#F0C66A]/70 to-transparent shadow-[0_0_24px_rgba(240,198,106,0.8)]" />
      <div aria-hidden className="council-ring absolute left-1/2 top-[48%] z-[8] h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F0C66A]/0" />
      <div aria-hidden className="archive-thread absolute bottom-[24%] left-[28%] right-[28%] z-[9] h-px bg-gradient-to-r from-transparent via-[#3DD68C] to-transparent shadow-[0_0_22px_rgba(61,214,140,0.6)]" />
      <div aria-hidden className="risk-seal absolute right-[17%] top-[35%] z-[24] hidden h-28 w-28 rotate-[-13deg] items-center justify-center rounded-full border-2 border-[#F43F5E]/72 bg-[#2a0710]/64 text-[15px] font-black tracking-[0.28em] text-[#F43F5E] shadow-[0_0_36px_rgba(244,63,94,0.46)] backdrop-blur-sm md:flex">
        质门
      </div>

      <header className="relative z-20 flex items-center justify-between gap-3 px-5 py-4 md:px-7">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#D8B76A]">Chaotang OS · World Model</p>
          <h1 className="mt-2 font-serif text-[36px] font-black tracking-[0.2em] text-[#F2D28A] drop-shadow-[0_16px_36px_rgba(0,0,0,0.75)] md:text-[64px]">
            大殿
          </h1>
        </div>
        <div className="hidden min-w-[280px] rounded-[7px] border border-[#F0C66A]/28 bg-[#07111b]/72 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,238,190,0.1)] backdrop-blur-md md:block">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D8B76A]">
              <Radio className="h-3.5 w-3.5" />
              丞相验收
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] ${sourceLabel === 'LIVE' ? 'border-[#3DD68C]/36 bg-[#3DD68C]/10 text-[#3DD68C]' : 'border-[#F5A524]/36 bg-[#F5A524]/10 text-[#F5A524]'}`}>
              {sourceLabel}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#F3EDDF]/76">{latestTitle}</p>
          <p className="mt-2 font-mono text-[11px] text-[#C9C0AC]/64">{taskId}</p>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[600px] max-w-[1280px] flex-col items-center justify-end px-4 pb-5 pt-4 md:min-h-[calc(100vh-220px)] md:px-8 md:pb-8">
        <CourtMinisterLayer
          activeSeat={activeSeat}
          selectedSeat={selectedSeat}
          stage={stage}
          onSeatIntent={setActiveSeat}
          onSeatSelect={summonMinister}
        />
        <MinisterAudiencePanel
          node={selectedNode}
          portrait={ministerPortraits[selectedSeat % ministerPortraits.length]}
          question={ministerQuestion}
          reply={ministerReply}
          isAsking={ministerAsking}
          onQuestionChange={setMinisterQuestion}
          onAsk={askMinister}
        />
        <CouncilVoiceReport
          activeNode={activeNode}
          selectedNode={selectedNode}
          stage={stage}
          sourceLabel={sourceLabel}
        />

        <div className="stage-caption relative mb-6 flex w-full max-w-[860px] flex-col items-center text-center md:mb-8">
          <div className="rounded-[6px] border border-[#F0C66A]/34 bg-[#07111b]/62 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#D8B76A] shadow-[inset_0_1px_0_rgba(255,238,190,0.1)] backdrop-blur-md">
            {stageCopy[stage].label}
          </div>
          <p className="mt-4 max-w-[720px] text-[17px] leading-9 text-[#F3EDDF]/88 md:text-[21px]">
            {stageCopy[stage].line}
          </p>
        </div>

        <div className="relative w-full max-w-[980px]">
          <div aria-hidden className="absolute -inset-x-12 bottom-3 h-28 rounded-[50%] bg-[#F0C66A]/10 blur-2xl" />
          <div aria-hidden className="throne-foreground absolute -bottom-9 left-1/2 z-[-1] h-28 w-[92%] -translate-x-1/2 rounded-t-[100%] border-t border-[#F0C66A]/28 bg-[radial-gradient(62%_72%_at_50%_0%,rgba(240,198,106,0.22),rgba(8,5,3,0.92)_58%,rgba(0,0,0,0)_100%)]" />
          <div className="imperial-desk relative overflow-hidden rounded-t-[18px] border border-[#C59648]/40 bg-[linear-gradient(180deg,rgba(37,24,11,0.88),rgba(8,9,12,0.94))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.64),inset_0_1px_0_rgba(255,238,190,0.14)] backdrop-blur-md md:p-5">
            <div aria-hidden className="seal-impact absolute right-[21%] top-[28%] z-20 hidden h-24 w-24 -rotate-12 items-center justify-center rounded-full border-2 border-[#F43F5E]/72 bg-[#2d0610]/72 text-[14px] font-black tracking-[0.22em] text-[#F43F5E] shadow-[0_0_40px_rgba(244,63,94,0.5)] md:flex">
              玉玺
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-end">
              <div className="decree-scroll rounded-[8px] border border-[#F0C66A]/26 bg-[#F5DFA6]/8 p-4 shadow-[inset_0_1px_0_rgba(255,238,190,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D8B76A]">
                    <ScrollText className="h-4 w-4" />
                    一句话下旨
                  </span>
                  <span className="font-mono text-[10px] text-[#C9C0AC]/60">{traceId}</span>
                </div>
                <p className="mt-3 text-left font-serif text-[20px] font-semibold leading-8 tracking-[0.08em] text-[#F2D28A] md:text-[25px]">
                  请丞相召集户部、工部、刑部、礼部、史馆，把大殿首屏做到世界级产品瞬间。
                </p>
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {teamMarks.map((mark) => (
                    <div key={mark.label} className="rounded-[6px] border border-white/10 bg-black/24 px-3 py-2 text-left">
                      <p className="text-[11px] font-semibold tracking-[0.14em] text-[#F0C66A]">{mark.label}</p>
                      <p className="mt-1 text-[11px] leading-4 text-[#F3EDDF]/62">{mark.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={castDecree}
                  disabled={isRunning}
                  className="group relative inline-flex min-h-14 items-center justify-center overflow-hidden rounded-[8px] border border-[#F0C66A]/70 bg-[linear-gradient(180deg,rgba(240,198,106,0.96),rgba(166,124,47,0.96))] px-6 text-[15px] font-black tracking-[0.16em] text-[#130D04] shadow-[0_18px_58px_rgba(240,198,106,0.26),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-white/28 opacity-0 transition duration-500 group-hover:left-[115%] group-hover:opacity-100" />
                  <Gavel className="relative z-10 mr-2 h-4 w-4" />
                  <span className="relative z-10">{isRunning ? '朝堂运转中' : stage === 'verdict' ? '再下一旨' : '下旨'}</span>
                </button>
                <div className="grid grid-cols-6 gap-1.5">
                  {stageOrder.map((item, index) => (
                    <div
                      key={item}
                      className={`h-2 rounded-full transition duration-500 ${
                        index <= stageIndex ? 'bg-[#F0C66A] shadow-[0_0_14px_rgba(240,198,106,0.45)]' : 'bg-white/12'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {stage === 'verdict' && (
              <div className="mt-4 rounded-[8px] border border-[#F0C66A]/28 bg-[#07111b]/66 p-3">
                <div className="grid gap-2 md:grid-cols-4">
                  {verdictActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        type="button"
                        key={action.label}
                        onClick={() => recordVerdict(action.label)}
                        className={`inline-flex h-10 items-center justify-center gap-2 rounded-[7px] border text-[13px] font-semibold tracking-[0.1em] transition hover:-translate-y-0.5 ${action.className}`}
                      >
                        <Icon className="h-4 w-4" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-[#3DD68C]/24 bg-[#3DD68C]/8 px-3 py-2 text-[12px] leading-5 text-[#D7FBE8]/80">
                  <Sparkles className="h-4 w-4 shrink-0 text-[#3DD68C]" />
                  {receipt ?? '丞相验收：世界级首屏必须把一个复杂系统压缩成一个可裁决动作。'}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 w-full md:hidden">
          <MinisterAudiencePanel
            node={selectedNode}
            portrait={ministerPortraits[selectedSeat % ministerPortraits.length]}
            question={ministerQuestion}
            reply={ministerReply}
            isAsking={ministerAsking}
            onQuestionChange={setMinisterQuestion}
            onAsk={askMinister}
            compact
          />
        </div>

        <div className="mt-5 grid w-full max-w-[980px] gap-2 md:grid-cols-4">
          <StageChip active={stageIndex >= 1} icon={<Gavel className="h-3.5 w-3.5" />} label="丞相拆解" />
          <StageChip active={stageIndex >= 2} icon={<Landmark className="h-3.5 w-3.5" />} label="六部会审" />
          <StageChip active={stageIndex >= 3} icon={<ShieldAlert className="h-3.5 w-3.5" />} label="朱砂质门" />
          <StageChip active={stageIndex >= 4} icon={<Archive className="h-3.5 w-3.5" />} label="史馆成卷" />
        </div>
      </div>
      <style jsx global>{`
        .court-world-stage {
          perspective: 1200px;
        }

        .stage-bg-far {
          transform: translate3d(var(--stage-x-soft), var(--stage-y-soft), 0) scale(1.04);
          transition: transform 280ms ease-out;
        }

        .stage-bg-near {
          transform: translate3d(var(--stage-x), var(--stage-y), 0);
          transition: transform 280ms ease-out;
        }

        .temple-column {
          opacity: 0.82;
          filter: drop-shadow(0 0 28px rgba(0, 0, 0, 0.8));
          transform: translate3d(calc(var(--stage-x) * -0.38), calc(var(--stage-y) * -0.22), 0);
          transition: transform 280ms ease-out;
        }

        .temple-column-left {
          background:
            radial-gradient(38% 78% at 74% 50%, rgba(240, 198, 106, 0.28), transparent 62%),
            linear-gradient(90deg, rgba(0, 0, 0, 0.88), rgba(70, 34, 13, 0.56) 54%, rgba(0, 0, 0, 0));
        }

        .temple-column-right {
          background:
            radial-gradient(38% 78% at 26% 50%, rgba(240, 198, 106, 0.28), transparent 62%),
            linear-gradient(270deg, rgba(0, 0, 0, 0.88), rgba(70, 34, 13, 0.56) 54%, rgba(0, 0, 0, 0));
        }

        .perspective-floor {
          transform: translateX(-50%) rotateX(64deg);
          transform-origin: 50% 100%;
          background:
            linear-gradient(90deg, transparent 0 14%, rgba(240, 198, 106, 0.18) 14.4% 14.8%, transparent 15.2% 31%, rgba(240, 198, 106, 0.14) 31.4% 31.8%, transparent 32.2% 49%, rgba(240, 198, 106, 0.2) 49.4% 50.2%, transparent 50.6% 68%, rgba(240, 198, 106, 0.14) 68.4% 68.8%, transparent 69.2% 85%, rgba(240, 198, 106, 0.18) 85.4% 85.8%, transparent 86.2%),
            repeating-linear-gradient(0deg, rgba(240, 198, 106, 0.2) 0 1px, transparent 1px 38px);
          mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.92), rgba(0, 0, 0, 0.28) 58%, transparent);
          opacity: 0.58;
        }

        .stage-dust {
          filter: blur(0.5px);
          animation: dustFloat 7s ease-in-out infinite;
        }

        .dispatch-beam,
        .archive-thread,
        .seal-impact,
        .risk-seal,
        .council-ring {
          opacity: 0;
          pointer-events: none;
        }

        .court-world-stage[data-stage='decree'] .imperial-desk {
          animation: deskPulse 900ms ease-out both;
        }

        .court-world-stage[data-stage='decree'] .decree-scroll {
          animation: scrollAwaken 980ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .court-world-stage[data-stage='decree'] .seal-impact {
          opacity: 1;
          animation: sealDrop 920ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .court-world-stage[data-stage='council'] .dispatch-beam,
        .court-world-stage[data-stage='risk'] .dispatch-beam,
        .court-world-stage[data-stage='archive'] .dispatch-beam {
          opacity: 1;
          animation: beamTravel 1500ms ease-in-out infinite;
        }

        .court-world-stage[data-stage='council'] .council-ring,
        .court-world-stage[data-stage='risk'] .council-ring,
        .court-world-stage[data-stage='archive'] .council-ring,
        .court-world-stage[data-stage='verdict'] .council-ring {
          animation: councilPulse 1600ms ease-out infinite;
        }

        .court-world-stage[data-stage='risk'] .risk-seal {
          opacity: 1;
          animation: riskGate 680ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .court-world-stage[data-stage='archive'] .archive-thread,
        .court-world-stage[data-stage='verdict'] .archive-thread {
          opacity: 1;
          animation: archiveFlow 1800ms ease-in-out infinite;
        }

        .court-world-stage[data-stage='verdict'] .imperial-desk {
          animation: verdictReturn 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .stage-caption {
          animation: captionIn 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .minister-court {
          perspective: 1000px;
          transform-style: preserve-3d;
        }

        .minister-seat {
          --lift: 0px;
          left: 50%;
          top: 43%;
          width: 126px;
          transform: translate3d(calc(-50% + var(--seat-x)), calc(var(--seat-y) + var(--lift)), 0) scale(var(--seat-scale));
          transform-origin: 50% 100%;
        }

        .minister-seat[data-active='true'] {
          --lift: -18px;
          z-index: 28;
          filter: drop-shadow(0 0 30px rgba(240, 198, 106, 0.34));
        }

        .minister-seat[data-active='true'] .minister-aura {
          opacity: 1;
          transform: scale(1);
        }

        .minister-seat[data-active='true'] .minister-speech {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .minister-seat[data-active='true'] .minister-portrait {
          border-color: rgba(240, 198, 106, 0.78);
          filter: saturate(1.16) brightness(1.08);
        }

        .minister-seat[data-selected='true'] .minister-portrait {
          box-shadow: 0 0 0 2px rgba(240, 198, 106, 0.5), 0 24px 52px rgba(0, 0, 0, 0.62);
        }

        .minister-seat * {
          pointer-events: none;
        }

        .minister-portrait {
          clip-path: polygon(50% 0, 92% 18%, 96% 72%, 50% 100%, 4% 72%, 8% 18%);
          animation: ministerBreathe 4.6s ease-in-out infinite;
          animation-delay: var(--seat-delay);
        }

        .minister-reflection {
          transform: rotateX(68deg) scaleY(0.42);
          transform-origin: 50% 0;
          mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.54), transparent);
        }

        .minister-audience-panel {
          animation: audiencePanelIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .council-voice-bar {
          animation: audiencePanelIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .voice-wave span {
          animation: voiceWave 980ms ease-in-out infinite;
          animation-delay: calc(var(--wave-index) * 110ms);
        }

        .minister-audience-panel:not(.minister-audience-mobile) {
          max-height: min(500px, calc(100vh - 260px));
          overflow-y: auto;
          scrollbar-color: rgba(240, 198, 106, 0.42) rgba(255, 255, 255, 0.06);
          scrollbar-width: thin;
        }

        .court-world-stage[data-stage='decree'] .minister-audience-panel:not(.minister-audience-mobile),
        .court-world-stage[data-stage='council'] .minister-audience-panel:not(.minister-audience-mobile),
        .court-world-stage[data-stage='risk'] .minister-audience-panel:not(.minister-audience-mobile),
        .court-world-stage[data-stage='archive'] .minister-audience-panel:not(.minister-audience-mobile),
        .court-world-stage[data-stage='verdict'] .minister-audience-panel:not(.minister-audience-mobile) {
          pointer-events: none;
          opacity: 0.22;
          filter: saturate(0.7) blur(0.2px);
        }

        @keyframes dustFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.16;
          }
          50% {
            transform: translate3d(10px, -18px, 0);
            opacity: 0.58;
          }
        }

        @keyframes deskPulse {
          0% {
            transform: translateY(0) scale(1);
            box-shadow: 0 30px 90px rgba(0, 0, 0, 0.64), inset 0 1px 0 rgba(255, 238, 190, 0.14);
          }
          45% {
            transform: translateY(-5px) scale(1.01);
            box-shadow: 0 38px 110px rgba(240, 198, 106, 0.18), inset 0 1px 0 rgba(255, 238, 190, 0.22);
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }

        @keyframes scrollAwaken {
          0% {
            clip-path: inset(0 48% 0 48%);
            filter: brightness(0.8);
          }
          100% {
            clip-path: inset(0 0 0 0);
            filter: brightness(1.08);
          }
        }

        @keyframes sealDrop {
          0% {
            transform: translate3d(18px, -46px, 0) rotate(-24deg) scale(1.7);
            opacity: 0;
          }
          44% {
            transform: translate3d(0, 0, 0) rotate(-12deg) scale(1);
            opacity: 1;
          }
          56% {
            transform: translate3d(0, 0, 0) rotate(-12deg) scale(0.92);
          }
          100% {
            transform: translate3d(0, 0, 0) rotate(-12deg) scale(1);
            opacity: 0;
          }
        }

        @keyframes beamTravel {
          0% {
            transform: translateX(-50%) scaleX(0.08);
            opacity: 0;
          }
          28% {
            opacity: 1;
          }
          100% {
            transform: translateX(-50%) scaleX(1);
            opacity: 0;
          }
        }

        @keyframes councilPulse {
          0% {
            transform: translate(-50%, -50%) scale(0.74);
            border-color: rgba(240, 198, 106, 0.34);
            opacity: 0.1;
          }
          55% {
            opacity: 0.72;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.12);
            border-color: rgba(240, 198, 106, 0);
            opacity: 0;
          }
        }

        @keyframes riskGate {
          0% {
            transform: translate3d(28px, -28px, 0) rotate(-22deg) scale(1.45);
            opacity: 0;
          }
          62% {
            transform: translate3d(0, 0, 0) rotate(-13deg) scale(0.96);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 0, 0) rotate(-13deg) scale(1);
            opacity: 1;
          }
        }

        @keyframes archiveFlow {
          0%,
          100% {
            transform: scaleX(0.2);
            opacity: 0.2;
          }
          50% {
            transform: scaleX(1);
            opacity: 0.82;
          }
        }

        @keyframes verdictReturn {
          0% {
            transform: translateY(22px) scale(0.98);
            filter: brightness(0.82);
          }
          100% {
            transform: translateY(0) scale(1);
            filter: brightness(1.08);
          }
        }

        @keyframes captionIn {
          0% {
            transform: translateY(10px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes ministerBreathe {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-4px) scale(1.018);
          }
        }

        @keyframes ministerAnswer {
          0% {
            opacity: 0.42;
            filter: blur(1px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
          }
        }

        @keyframes audiencePanelIn {
          0% {
            transform: translate3d(18px, 10px, 0);
            opacity: 0;
            filter: blur(6px);
          }
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 1;
            filter: blur(0);
          }
        }

        @keyframes voiceWave {
          0%,
          100% {
            transform: scaleY(0.34);
            opacity: 0.36;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .stage-dust,
          .dispatch-beam,
          .archive-thread,
          .seal-impact,
          .risk-seal,
          .council-ring,
          .minister-seat,
          .minister-audience-panel,
          .imperial-desk,
          .decree-scroll,
          .stage-caption {
            animation: none !important;
          }

          .voice-wave span {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function CouncilVoiceReport({
  activeNode,
  selectedNode,
  stage,
  sourceLabel,
}: {
  activeNode: (typeof sandTableNodes)[number];
  selectedNode: (typeof sandTableNodes)[number];
  stage: StageState;
  sourceLabel: string;
}) {
  const speaker = stage === 'ready' ? selectedNode : activeNode;
  const reportLine =
    stage === 'ready'
      ? selectedNode.counsel
      : stage === 'verdict'
        ? `${selectedNode.name}已候旨：${selectedNode.counsel}`
        : `${activeNode.name}出列汇报：${activeNode.line}`;

  return (
    <section
      className="council-voice-bar relative z-20 mb-5 hidden w-full max-w-[780px] rounded-[8px] border border-[#F0C66A]/26 bg-[#07111b]/72 px-4 py-3 shadow-[0_22px_70px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,238,190,0.08)] backdrop-blur-md md:block"
      aria-label="朝会语音汇报"
    >
      <div className="flex items-center gap-3">
        <div className="voice-wave flex h-10 w-12 shrink-0 items-center justify-center gap-1 rounded-[6px] border border-[#F0C66A]/24 bg-[#F0C66A]/8">
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className="h-6 w-1 rounded-full bg-[#F0C66A]"
              style={{ '--wave-index': index } as CSSProperties}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D8B76A]">
              朝会语音汇报
            </span>
            <span className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/8 px-2 py-0.5 text-[10px] text-[#F0C66A]">
              {speaker.name} · {speaker.status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#C9C0AC]/72">
              {sourceLabel}
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] leading-6 text-[#F3EDDF]/86">{reportLine}</p>
        </div>
        <div className="hidden shrink-0 text-right lg:block">
          <div className="text-[10px] tracking-[0.18em] text-[#C9C0AC]/58">NEXT</div>
          <div className="mt-1 max-w-[170px] truncate text-[11px] text-[#D8B76A]">{selectedNode.memorialTitle}</div>
        </div>
      </div>
    </section>
  );
}

function CourtMinisterLayer({
  activeSeat,
  selectedSeat,
  stage,
  onSeatIntent,
  onSeatSelect,
}: {
  activeSeat: number;
  selectedSeat: number;
  stage: StageState;
  onSeatIntent: (index: number) => void;
  onSeatSelect: (index: number) => void;
}) {
  return (
    <div className="minister-court pointer-events-none absolute inset-x-0 top-[15%] z-[14] hidden h-[470px] md:block">
      {sandTableNodes.map((node, index) => {
        const portrait = ministerPortraits[index];
        const active = activeSeat === index;
        const selected = selectedSeat === index;
        const muted = !active && stage !== 'verdict';

        return (
          <button
            type="button"
            key={node.name}
            onMouseEnter={() => onSeatIntent(index)}
            onFocus={() => onSeatIntent(index)}
            onClick={() => onSeatSelect(index)}
            className="minister-seat pointer-events-auto absolute flex flex-col items-center text-center outline-none transition duration-500"
            data-active={active}
            data-selected={selected}
            style={{
              '--seat-x': portrait.x,
              '--seat-y': portrait.y,
              '--seat-scale': portrait.scale,
              '--seat-delay': `${index * 0.22}s`,
            } as CSSProperties}
          >
            <span className="minister-speech pointer-events-none absolute -top-20 left-1/2 w-[210px] -translate-x-1/2 translate-y-3 scale-95 rounded-[7px] border border-[#F0C66A]/36 bg-[#07111b]/82 px-3 py-2 text-left opacity-0 shadow-[0_18px_46px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,238,190,0.1)] backdrop-blur-md transition duration-500">
              <span className="block text-[10px] font-semibold tracking-[0.18em] text-[#D8B76A]">{portrait.title}</span>
              <span className="mt-1 block text-[12px] leading-5 text-[#F3EDDF]/88">{active ? node.line : node.role}</span>
            </span>
            <span className="minister-aura pointer-events-none absolute top-10 h-28 w-28 rounded-full bg-[#F0C66A]/22 opacity-0 blur-2xl transition duration-500" />
            <span className={`minister-portrait pointer-events-none relative z-10 block h-[138px] w-[112px] overflow-hidden border bg-[#050912] shadow-[0_24px_48px_rgba(0,0,0,0.58)] transition duration-500 ${muted ? 'border-[#C59648]/28 opacity-78 grayscale-[0.18]' : 'border-[#F0C66A]/58 opacity-100'}`}>
              <img src={assetUrl(portrait.image)} alt="" className="pointer-events-none h-full w-full object-cover" />
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,238,190,0.10),transparent_42%,rgba(0,0,0,0.32))]" />
            </span>
            <span className="pointer-events-none mt-2 rounded-full border border-[#F0C66A]/28 bg-black/42 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#F2D28A] shadow-[0_12px_24px_rgba(0,0,0,0.42)] backdrop-blur-sm">
              {node.name}
            </span>
            <span aria-hidden className="minister-reflection pointer-events-none absolute top-[150px] h-14 w-24 rounded-[50%] bg-[#F0C66A]/16 blur-sm" />
          </button>
        );
      })}
    </div>
  );
}

function MinisterAudiencePanel({
  node,
  portrait,
  question,
  reply,
  isAsking,
  onQuestionChange,
  onAsk,
  compact = false,
}: {
  node: (typeof sandTableNodes)[number];
  portrait: (typeof ministerPortraits)[number];
  question: string;
  reply: MinisterReply | null;
  isAsking: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  compact?: boolean;
}) {
  const shellClass = compact
    ? 'minister-audience-panel minister-audience-mobile relative z-20 rounded-[8px] border border-[#F0C66A]/30 bg-[#07111b]/86 p-4 shadow-[0_22px_54px_rgba(0,0,0,0.52)] backdrop-blur-md'
    : 'minister-audience-panel absolute left-6 top-[22%] z-[34] hidden w-[330px] rounded-[8px] border border-[#F0C66A]/34 bg-[#07111b]/84 p-4 shadow-[0_28px_76px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,238,190,0.1)] backdrop-blur-xl md:block';

  return (
    <aside className={shellClass} aria-label={`${node.name}奏折`}>
      <div className="flex items-start gap-3">
        <div className="h-16 w-14 shrink-0 overflow-hidden rounded-[7px] border border-[#F0C66A]/36 bg-black/30">
          <img src={assetUrl(portrait.image)} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D8B76A]">御前召见 · {portrait.title}</p>
          <h2 className="mt-1 font-serif text-[22px] font-semibold tracking-[0.16em] text-[#F2D28A]">{node.name}</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#F3EDDF]/68">{node.role} · {node.status}</p>
        </div>
      </div>

      <div className="mt-4 rounded-[7px] border border-[#F0C66A]/18 bg-[#F5DFA6]/7 p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-[#D8B76A]">
          <ScrollText className="h-3.5 w-3.5" />
          奏折
        </div>
        <p className="mt-2 font-serif text-[16px] font-semibold leading-7 tracking-[0.08em] text-[#F2D28A]">{node.memorialTitle}</p>
        <p className="mt-2 text-[12px] leading-6 text-[#F3EDDF]/72">{node.memorialBody}</p>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="rounded-[7px] border border-[#F43F5E]/28 bg-[#F43F5E]/9 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-[#FF8A9A]">
            <ShieldAlert className="h-3.5 w-3.5" />
            风险
          </div>
          <p className="mt-1 text-[12px] leading-5 text-[#FFE2E7]/74">{node.risk}</p>
        </div>
        <div className="rounded-[7px] border border-[#3DD68C]/24 bg-[#3DD68C]/8 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-[#7DE6AD]">
            <Sparkles className="h-3.5 w-3.5" />
            建议
          </div>
          <p className="mt-1 text-[12px] leading-5 text-[#D7FBE8]/76">{node.counsel}</p>
        </div>
      </div>

      <div className="mt-3 rounded-[7px] border border-white/10 bg-black/24 p-2">
        <label className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-[#D8B76A]">
          <MessageSquareText className="h-3.5 w-3.5" />
          追问
        </label>
        <textarea
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          rows={compact ? 2 : 3}
          suppressHydrationWarning
          className="mt-2 w-full resize-none rounded-[6px] border border-[#F0C66A]/18 bg-[#02050d]/74 px-3 py-2 text-[12px] leading-5 text-[#F3EDDF] outline-none transition placeholder:text-[#C9C0AC]/34 focus:border-[#F0C66A]/52 focus:ring-2 focus:ring-[#F0C66A]/12"
          placeholder={`追问${node.name}...`}
        />
        <button
          type="button"
          onClick={onAsk}
          disabled={isAsking}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[7px] border border-[#F0C66A]/52 bg-[#F0C66A]/12 text-[12px] font-semibold tracking-[0.16em] text-[#F0C66A] transition hover:-translate-y-0.5 hover:bg-[#F0C66A]/18 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" />
          {isAsking ? '请旨问询中' : '追问此臣'}
        </button>
        {reply && (
          <div
            className={`mt-2 rounded-[6px] border px-3 py-2 text-[12px] leading-5 ${
              reply.status === 'answered'
                ? 'border-[#3DD68C]/24 bg-[#3DD68C]/8 text-[#D7FBE8]/82'
                : reply.status === 'unavailable'
                  ? 'border-[#F5A524]/28 bg-[#F5A524]/8 text-[#FFE8B5]/82'
                  : 'border-[#F43F5E]/28 bg-[#F43F5E]/8 text-[#FFE2E7]/82'
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold tracking-[0.14em]">{node.name}回奏</span>
              <span className="rounded-full border border-white/12 bg-black/24 px-2 py-0.5 font-mono text-[9px] tracking-[0.12em]">
                {reply.source}
              </span>
            </div>
            <p>{reply.answer}</p>
            {reply.status === 'answered' && (
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px] text-[#F3EDDF]/68">
                {reply.confidence !== undefined && <p>置信 {Math.round(reply.confidence * 100)}%{reply.model ? ` · ${reply.model}` : ''}</p>}
                {reply.evidence.length > 0 && <p>证据：{reply.evidence.join('；')}</p>}
                {reply.conflicts && <p>冲突声明：{reply.conflicts}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function StageChip({ active, icon, label }: { active: boolean; icon: ReactNode; label: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold tracking-[0.1em] transition ${
        active
          ? 'border-[#F0C66A]/42 bg-[#F0C66A]/12 text-[#F0C66A]'
          : 'border-white/10 bg-black/20 text-[#F3EDDF]/48'
      }`}
    >
      {icon}
      {label}
    </div>
  );
}
