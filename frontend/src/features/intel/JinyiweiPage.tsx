'use client';

import { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  FileSearch,
  Filter,
  Layers3,
  Link2,
  MapPinned,
  RadioTower,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react';

import { StateSwitch } from '@/components/ui/state-switch';
import { DepartmentPageCanvas, DepartmentStage } from '@/features/departments/components/DepartmentPageShell';
import { GlassPanel } from '@/features/shangshufang/components/atoms';
import { useIntelSignals } from '@/lib/hooks/use-intel-signals';
import { useAppStore } from '@/lib/store/app-store';
import { assetUrl } from '@/lib/asset';
import { asyncError, asyncLoading, asyncReady, type AsyncState } from '@/types/async-state';
import type { AgentCode } from '@/types/agent';
import type { IntelCategory, IntelCredibility, IntelLevel, IntelSignal } from '@/types/intel';

import { RouteToTaskDialog } from './components/route-to-task-dialog';
import { TodayOneThing } from './components/TodayOneThing';
import { IndustryBoard } from './components/IndustryBoard';
import { sourceGrade, type SourceGrade } from './lib/source-grade';

const JINYIWEI_SCENE = '/assets/jinyiwei/scene-full.webp';
const MAP_ZOOM = 2;
const MAP_TILE_SIZE = 256;
const MAP_WORLD_SIZE = MAP_TILE_SIZE * 2 ** MAP_ZOOM;
const MAP_NORTH_LAT = 72;
const MAP_SOUTH_LAT = -58;
const MAP_TOP_Y = mercatorWorldY(MAP_NORTH_LAT);
const MAP_HEIGHT = mercatorWorldY(MAP_SOUTH_LAT) - MAP_TOP_Y;
const MAP_TILE_TEMPLATE =
  process.env.NEXT_PUBLIC_INTEL_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

type MinistryId = 'all' | 'hu_bu' | 'bing_bu' | 'li_bu' | 'li_bu_rites' | 'xing_bu' | 'gong_bu';
type ProcessStatus = 'all' | 'new' | 'verified' | 'packed' | 'routed' | 'archived';

interface MinistryOption {
  id: MinistryId;
  label: string;
  scope: string;
  color: string;
  agentCode?: AgentCode;
  keywords: RegExp;
}

interface MapPoint {
  signal: IntelSignal;
  x: number;
  y: number;
  ministry: MinistryOption;
  status: ProcessStatus;
  grade: SourceGrade;
}

const MINISTRIES: MinistryOption[] = [
  {
    id: 'all',
    label: '全部',
    scope: '六部情报总览',
    color: '#F0C66A',
    keywords: /./,
  },
  {
    id: 'hu_bu',
    label: '户部',
    scope: '财务、资本、估值、成本、预算、投资',
    color: '#F0C66A',
    agentCode: 'hu_bu',
    keywords: /财务|资本|估值|收入|利润|现金|预算|成本|投资|融资|股票|证券|市场|finance|capital|valuation|revenue|margin|cash|stock/i,
  },
  {
    id: 'bing_bu',
    label: '兵部',
    scope: '竞争、客户、渠道、海外扩张、销售机会',
    color: '#F43F5E',
    agentCode: 'bing_bu',
    keywords: /竞争|竞品|客户|渠道|销售|市场份额|海外|扩张|招标|订单|customer|sales|market|competitor/i,
  },
  {
    id: 'li_bu',
    label: '吏部',
    scope: '组织、人才、招聘、激励、管理团队变化',
    color: '#9AA3C4',
    agentCode: 'li_bu',
    keywords: /组织|人才|招聘|激励|团队|高管|人事|薪酬|hiring|talent|team|executive/i,
  },
  {
    id: 'li_bu_rites',
    label: '礼部',
    scope: '品牌、舆情、传播、客户关系、公共形象',
    color: '#C084FC',
    agentCode: 'li_bu_rites',
    keywords: /品牌|舆情|传播|公关|声誉|客户关系|媒体|社交|brand|media|public|reputation/i,
  },
  {
    id: 'xing_bu',
    label: '刑部',
    scope: '法律、合规、监管、合同、诉讼、制裁',
    color: '#F5A524',
    agentCode: 'xing_bu',
    keywords: /法律|合规|监管|合同|诉讼|处罚|制裁|许可|regulation|legal|lawsuit|compliance|sanction/i,
  },
  {
    id: 'gong_bu',
    label: '工部',
    scope: '供应链、产品、技术、交付、产能、质量',
    color: '#3DD68C',
    agentCode: 'gong_bu',
    keywords: /供应链|产品|技术|交付|产能|制造|质量|芯片|物流|工厂|supply|product|technology|delivery|capacity|chip/i,
  },
];

const LEVEL_LABEL: Record<IntelLevel, string> = {
  info: '情报',
  watch: '关注',
  warning: '预警',
  critical: '急报',
};

const LEVEL_COLOR: Record<IntelLevel, string> = {
  info: '#60A5FA',
  watch: '#F0C66A',
  warning: '#F5A524',
  critical: '#F43F5E',
};

const CATEGORY_LABEL: Record<IntelCategory, string> = {
  risk: '风险',
  opportunity: '机会',
  neutral: '中性',
};

const CREDIBILITY_LABEL: Record<IntelCredibility, string> = {
  verified: '已核验',
  high: '高可信',
  medium: '待复查',
  low: '低可信',
};

const REGION_FALLBACK: Record<string, { lat: number; lng: number }> = {
  US: { lat: 39, lng: -98 },
  CA: { lat: 56, lng: -106 },
  MX: { lat: 23, lng: -102 },
  EU: { lat: 50, lng: 10 },
  UK: { lat: 54, lng: -2 },
  DE: { lat: 51, lng: 10 },
  FR: { lat: 46, lng: 2 },
  CN: { lat: 35, lng: 105 },
  JP: { lat: 37, lng: 138 },
  KR: { lat: 36, lng: 128 },
  IN: { lat: 22, lng: 78 },
  SG: { lat: 1.35, lng: 103.8 },
  VN: { lat: 16, lng: 108 },
  AU: { lat: -25, lng: 134 },
  BR: { lat: -10, lng: -55 },
  ME: { lat: 28, lng: 47 },
  AF: { lat: 3, lng: 20 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mercatorWorldY(lat: number): number {
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * MAP_WORLD_SIZE;
}

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((clamp(lng, -180, 180) + 180) / 360) * 100;
  const y = ((mercatorWorldY(lat) - MAP_TOP_Y) / MAP_HEIGHT) * 100;
  return { x, y: clamp(y, 0, 100) };
}

function tileUrl(x: number, y: number): string {
  return MAP_TILE_TEMPLATE.replace('{z}', String(MAP_ZOOM)).replace('{x}', String(x)).replace('{y}', String(y));
}

function textOf(signal: IntelSignal): string {
  return `${signal.title} ${signal.summary} ${signal.industry} ${signal.regionLabel}`;
}

function inferMinistry(signal: IntelSignal): MinistryOption {
  const routed = MINISTRIES.find((item) => item.agentCode && signal.routedTo?.includes(item.agentCode));
  if (routed) return routed;
  return MINISTRIES.find((item) => item.id !== 'all' && item.keywords.test(textOf(signal))) ?? MINISTRIES[0]!;
}

function processStatus(signal: IntelSignal): ProcessStatus {
  if (signal.routedTo?.length) return 'routed';
  if (signal.credibility === 'verified' || signal.credibility === 'high') return 'packed';
  if (signal.credibility === 'medium') return 'verified';
  return 'new';
}

function makePoint(signal: IntelSignal, pageSource: 'turso' | 'fallback'): MapPoint {
  const coordinate = signal.coordinates ?? REGION_FALLBACK[signal.region] ?? { lat: 20, lng: 0 };
  return {
    signal,
    ...project(coordinate.lat, coordinate.lng),
    ministry: inferMinistry(signal),
    status: processStatus(signal),
    grade: sourceGrade(signal, pageSource),
  };
}

function hoursAgo(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return '刚刚';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟前`;
  if (hours < 24) return `${Math.round(hours)} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

function sourceGradeLabel(grade: SourceGrade): string {
  if (grade === 'real') return '真实来源';
  if (grade === 'mixed') return '混合来源';
  if (grade === 'fallback') return '演示来源';
  return '全部来源';
}

function statusLabel(status: ProcessStatus): string {
  if (status === 'new') return '新发现';
  if (status === 'verified') return '待成包';
  if (status === 'packed') return '已成包';
  if (status === 'routed') return '已派发';
  if (status === 'archived') return '已归档';
  return '全部状态';
}

export function JinyiweiPage() {
  const filter = useAppStore((s) => s.intelFilter);
  const selectedId = useAppStore((s) => s.selectedSignalId);
  const selectSignal = useAppStore((s) => s.selectSignal);

  const { signals: allSignals, source, isLoading, isError, mutate } = useIntelSignals();
  const state: AsyncState<IntelSignal[]> = isLoading
    ? asyncLoading()
    : isError
      ? asyncError('锦衣卫情报数据加载失败', { retryable: true })
      : asyncReady(allSignals);

  const [activeMinistry, setActiveMinistry] = useState<MinistryId>('all');
  // 默认只看真实来源(张小龙·默认即信噪比):噪声要主动点开。
  const [activeGrade, setActiveGrade] = useState<SourceGrade>('real');
  const [activeStatus, setActiveStatus] = useState<ProcessStatus>('all');
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  // 中栏舞台：本产业五道(默认) vs 世界地图(降为次要视角)。地图不删，让位给「跟我们生意的关系」。
  const [centerTab, setCenterTab] = useState<'board' | 'map'>('board');

  const points = useMemo(() => allSignals.map((signal) => makePoint(signal, source)), [allSignals, source]);

  const filteredPoints = useMemo(() => {
    return points.filter((point) => {
      const signal = point.signal;
      if (filter.categories.length > 0 && !filter.categories.includes(signal.category)) return false;
      if (filter.levels.length > 0 && !filter.levels.includes(signal.level)) return false;
      if (filter.regions.length > 0 && !filter.regions.includes(signal.region)) return false;
      if (activeMinistry !== 'all' && point.ministry.id !== activeMinistry) return false;
      // 兜底模式下所有点都是 fallback 等级,若默认 real 会空屏;此时等级筛选失效(演示态本就只有一种来源)。
      if (source !== 'fallback' && activeGrade !== 'all' && point.grade !== activeGrade) return false;
      if (activeStatus !== 'all' && point.status !== activeStatus) return false;
      return true;
    });
  }, [activeGrade, activeMinistry, activeStatus, filter.categories, filter.levels, filter.regions, points, source]);

  const selectedPoint =
    filteredPoints.find((point) => point.signal.id === selectedId) ??
    points.find((point) => point.signal.id === selectedId) ??
    filteredPoints[0] ??
    null;
  const selectedSignal = selectedPoint?.signal ?? null;

  const stats = useMemo(() => {
    const hot = filteredPoints.filter((point) => point.signal.level === 'critical' || point.signal.level === 'warning').length;
    const real = filteredPoints.filter((point) => point.grade === 'real').length;
    const routed = filteredPoints.filter((point) => point.status === 'routed').length;
    const sourceCount = filteredPoints.reduce((total, point) => total + point.signal.sources.length, 0);
    return { hot, real, routed, sourceCount };
  }, [filteredPoints]);

  const ministryCounts = useMemo(() => {
    const result = new Map<MinistryId, number>();
    for (const ministry of MINISTRIES) result.set(ministry.id, ministry.id === 'all' ? points.length : 0);
    for (const point of points) result.set(point.ministry.id, (result.get(point.ministry.id) ?? 0) + 1);
    return result;
  }, [points]);

  function resetFilters() {
    setActiveMinistry('all');
    setActiveGrade('all');
    setActiveStatus('all');
  }

  return (
    <DepartmentPageCanvas
      ariaLabel="锦衣卫世界情报地图"
      bgSrc={assetUrl(JINYIWEI_SCENE)}
      bgAlt="锦衣卫情报场景"
      imageClassName="scale-[1.02] object-cover opacity-25 saturate-[0.85]"
      overlayClassName="bg-[radial-gradient(ellipse_at_50%_20%,rgba(224,85,58,0.10)_0%,transparent_44%),linear-gradient(90deg,rgba(2,3,10,0.72)_0%,rgba(2,3,10,0.34)_28%,rgba(2,3,10,0.38)_72%,rgba(2,3,10,0.76)_100%)]"
    >
      <DepartmentStage hasLiveStrip={false} className="overflow-y-auto">
        <StateSwitch state={state} onRetry={mutate} minHeight={520}>
          {() => (
            <main className="relative z-10 mx-auto flex w-full max-w-[1800px] flex-col gap-3 px-3 py-3 lg:h-[calc(100vh-56px)] lg:min-h-0">
              <HeaderBar
                total={allSignals.length}
                visible={filteredPoints.length}
                source={source}
                hot={stats.hot}
                real={stats.real}
                routed={stats.routed}
                sourceCount={stats.sourceCount}
              />

              {/* 今日就一件事：只在有「又早又真」够格头条时渲染；无真数据即不占位（诚实纪律） */}
              <TodayOneThing signals={allSignals} onOpen={selectSignal} />


              <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[310px_minmax(0,1fr)_350px]">
                <LeftPanel
                  activeMinistry={activeMinistry}
                  activeGrade={activeGrade}
                  activeStatus={activeStatus}
                  ministryCounts={ministryCounts}
                  onMinistry={setActiveMinistry}
                  onGrade={setActiveGrade}
                  onStatus={setActiveStatus}
                  onReset={resetFilters}
                />

                <div className="flex min-h-[560px] min-w-0 flex-col gap-2 lg:h-full">
                  <div className="flex gap-2" role="tablist" aria-label="中栏视图切换">
                    <CenterTabButton active={centerTab === 'board'} accent="#E0553A" onClick={() => setCenterTab('board')}>
                      🔋 本产业 · 电池
                    </CenterTabButton>
                    <CenterTabButton active={centerTab === 'map'} accent="#F0C66A" onClick={() => setCenterTab('map')}>
                      🌐 世界地图
                    </CenterTabButton>
                  </div>
                  {centerTab === 'board' ? (
                    <section
                      data-testid="jinyiwei-center-board"
                      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E0553A]/18 bg-[#070A12] shadow-[0_28px_90px_rgba(0,0,0,0.50)]"
                    >
                      <IndustryBoard
                        signals={filteredPoints.map((point) => point.signal)}
                        selectedId={selectedSignal?.id ?? null}
                        onSelect={selectSignal}
                      />
                    </section>
                  ) : (
                    <WorldIntelMap
                      points={filteredPoints}
                      selectedId={selectedSignal?.id ?? null}
                      onSelect={selectSignal}
                    />
                  )}
                </div>

                <RightPanel
                  point={selectedPoint}
                  onRoute={() => setRouteDialogOpen(true)}
                  onSelect={selectSignal}
                  queue={filteredPoints}
                />
              </section>

              <BottomQueue points={filteredPoints} selectedId={selectedSignal?.id ?? null} onSelect={selectSignal} />
            </main>
          )}
        </StateSwitch>
      </DepartmentStage>

      <RouteToTaskDialog signal={selectedSignal} open={routeDialogOpen} onClose={() => setRouteDialogOpen(false)} />
    </DepartmentPageCanvas>
  );
}

function HeaderBar({
  total,
  visible,
  source,
  hot,
  real,
  routed,
  sourceCount,
}: {
  total: number;
  visible: number;
  source: 'turso' | 'fallback';
  hot: number;
  real: number;
  routed: number;
  sourceCount: number;
}) {
  const live = source === 'turso';
  return (
    <header className="rounded-2xl border border-[#E0553A]/22 bg-[#05070D]/78 px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="section-eyebrow text-[#E0553A]">锦衣卫 · 世界情报地图</div>
          <h1 className="mt-1 font-serif text-[24px] font-black tracking-[0.08em] text-[#F5E9C9]" data-testid="jinyiwei-page-title">
            六部公开情报巡察台
          </h1>
          <p className="mt-1 max-w-3xl text-[12px] leading-6 text-[#B6AB8C]">
            以真实世界地图定位公开来源，按六部领域核验情报，生成证据包后再派发给户部、刑部、工部等部门进入奏折流程。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="可见情报" value={`${visible}/${total}`} tone="#F0C66A" />
          <Metric label="真实来源" value={real} tone="#3DD68C" />
          <Metric label="急报预警" value={hot} tone="#F43F5E" />
          <Metric label="已派六部" value={routed} tone="#60A5FA" />
          <Metric label="来源地址" value={sourceCount} tone={live ? '#3DD68C' : '#8A6A2A'} />
        </div>
      </div>
      {source === 'fallback' && (
        <div className="mt-3 rounded-lg border border-[#8A6A2A]/40 bg-[#8A6A2A]/12 px-3 py-2 text-[11px] text-[#D8C18A]">
          当前情报主库不可用或为空，页面显示兜底样例；兜底样例不得进入正式六部测算。
        </div>
      )}
    </header>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.18em] text-[#6A7299]">{label}</div>
      <div className="mt-1 font-mono text-[18px] font-bold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function LeftPanel({
  activeMinistry,
  activeGrade,
  activeStatus,
  ministryCounts,
  onMinistry,
  onGrade,
  onStatus,
  onReset,
}: {
  activeMinistry: MinistryId;
  activeGrade: SourceGrade;
  activeStatus: ProcessStatus;
  ministryCounts: Map<MinistryId, number>;
  onMinistry: (id: MinistryId) => void;
  onGrade: (grade: SourceGrade) => void;
  onStatus: (status: ProcessStatus) => void;
  onReset: () => void;
}) {
  return (
    <GlassPanel accent="#E0553A" className="min-h-[460px] lg:h-full">
      <div className="flex items-center justify-between px-4 pt-4">
        <div>
          <div className="section-eyebrow text-[#8F835F]">筛选与巡察</div>
          <h2 className="font-serif text-[17px] font-black text-[#F5E9C9]">六部情报域</h2>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-full border border-[#E0553A]/25 bg-[#E0553A]/10 px-2 py-1 text-[10px] text-[#E0553A]"
        >
          <RotateCcw size={11} />
          重置
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <section>
          <PanelTitle icon={Layers3} text="按六部筛选" />
          <div className="mt-2 space-y-1.5">
            {MINISTRIES.map((ministry) => {
              const active = activeMinistry === ministry.id;
              return (
                <button
                  key={ministry.id}
                  type="button"
                  onClick={() => onMinistry(ministry.id)}
                  className="group w-full rounded-xl border px-3 py-2 text-left transition hover:bg-white/[0.045]"
                  style={{
                    borderColor: active ? `${ministry.color}88` : 'rgba(255,255,255,0.08)',
                    background: active ? `${ministry.color}14` : 'rgba(255,255,255,0.025)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-[13px] font-bold" style={{ color: active ? ministry.color : '#EAEEFB' }}>
                      {ministry.label}
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: ministry.color }}>
                      {ministryCounts.get(ministry.id) ?? 0}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-1 text-[10px] text-[#7E86A8]">{ministry.scope}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <PanelTitle icon={ShieldAlert} text="来源等级" />
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {[
              ['all', '全部来源', '#9AA3C4'],
              ['real', '真实来源', '#3DD68C'],
              ['mixed', '混合来源', '#F5A524'],
              ['fallback', '演示来源', '#8A6A2A'],
            ].map(([grade, label, color]) => (
              <FilterButton
                key={grade}
                active={activeGrade === grade}
                label={label}
                color={color}
                onClick={() => onGrade(grade as SourceGrade)}
              />
            ))}
          </div>
        </section>

        <section>
          <PanelTitle icon={Filter} text="处理状态" />
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {[
              ['all', '全部状态', '#9AA3C4'],
              ['new', '新发现', '#60A5FA'],
              ['verified', '待成包', '#F5A524'],
              ['packed', '已成包', '#F0C66A'],
              ['routed', '已派发', '#3DD68C'],
              ['archived', '已归档', '#8A6A2A'],
            ].map(([status, label, color]) => (
              <FilterButton
                key={status}
                active={activeStatus === status}
                label={label}
                color={color}
                onClick={() => onStatus(status as ProcessStatus)}
              />
            ))}
          </div>
        </section>
      </div>
    </GlassPanel>
  );
}

function PanelTitle({ icon: Icon, text }: { icon: typeof Layers3; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8F835F]">
      <Icon size={12} className="text-[#E0553A]" />
      {text}
      <span className="h-px flex-1 bg-gradient-to-r from-[#E0553A]/18 to-transparent" />
    </div>
  );
}

function FilterButton({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-2 py-1.5 text-[11px] transition hover:bg-white/[0.045]"
      style={{
        borderColor: active ? `${color}88` : 'rgba(255,255,255,0.08)',
        background: active ? `${color}14` : 'rgba(255,255,255,0.025)',
        color: active ? color : '#9AA3C4',
      }}
    >
      {label}
    </button>
  );
}

function CenterTabButton({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex-1 rounded-xl border px-3 py-2 text-[12px] font-bold transition"
      style={{
        borderColor: active ? `${accent}80` : 'rgba(255,255,255,0.08)',
        background: active ? `${accent}18` : 'rgba(255,255,255,0.025)',
        color: active ? accent : '#7E86A8',
      }}
    >
      {children}
    </button>
  );
}

function WorldIntelMap({
  points,
  selectedId,
  onSelect,
}: {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <section
      data-testid="jinyiwei-world-map"
      className="relative min-h-[560px] overflow-hidden rounded-2xl border border-[#F0C66A]/18 bg-[#030610] shadow-[0_28px_90px_rgba(0,0,0,0.50)] lg:h-full"
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-[0.88] brightness-[1.24] saturate-[0.92] contrast-[1.18]">
          {Array.from({ length: 4 }, (_row, y) =>
            Array.from({ length: 4 }, (_col, x) => (
              <img
                key={`${x}-${y}`}
                src={tileUrl(x, y)}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            )),
          )}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(3,6,16,0.00)_0%,rgba(3,6,16,0.18)_58%,rgba(3,6,16,0.72)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(240,198,106,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(240,198,106,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-38" />
      </div>

      <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 flex items-center justify-between gap-3">
        <div className="rounded-full border border-[#F0C66A]/24 bg-[#05070D]/78 px-3 py-1.5 font-mono text-[10px] text-[#F0C66A] backdrop-blur">
          真实地图底图 · 全球公开情报巡察
        </div>
        <div className="hidden rounded-full border border-[#E0553A]/24 bg-[#05070D]/78 px-3 py-1.5 font-mono text-[10px] text-[#E0553A] backdrop-blur sm:block">
          {points.length} 个情报点
        </div>
      </div>

      <div className="absolute inset-0 z-10">
        {points.map((point, index) => {
          const selected = selectedId === point.signal.id;
          return (
            <button
              key={point.signal.id}
              type="button"
              onClick={() => onSelect(point.signal.id)}
              className="group absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center outline-none"
              style={{ left: `${point.x}%`, top: `${point.y}%`, zIndex: selected ? 30 : 12 + index }}
              aria-label={`查看情报：${point.signal.title}`}
            >
              <span
                className="absolute h-8 w-8 rounded-full opacity-25 blur-sm transition group-hover:opacity-45"
                style={{ background: LEVEL_COLOR[point.signal.level] }}
              />
              <span
                className="relative h-3.5 w-3.5 rounded-full border-2 transition group-hover:scale-125"
                style={{
                  borderColor: selected ? '#F5E9C9' : point.ministry.color,
                  background: LEVEL_COLOR[point.signal.level],
                  boxShadow: `0 0 ${selected ? 22 : 12}px ${LEVEL_COLOR[point.signal.level]}`,
                }}
              />
              {selected && (
                <span className="absolute top-5 min-w-[180px] rounded-lg border border-[#F0C66A]/38 bg-[#05070D]/92 px-2 py-1.5 text-left shadow-[0_12px_36px_rgba(0,0,0,0.44)] backdrop-blur">
                  <span className="block truncate text-[11px] font-semibold text-[#F5E9C9]">{point.signal.title}</span>
                  <span className="mt-0.5 block text-[9px] text-[#9AA3C4]">
                    {point.ministry.label} · {LEVEL_LABEL[point.signal.level]} · {sourceGradeLabel(point.grade)}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-3 left-4 z-20 rounded-lg border border-white/[0.08] bg-[#05070D]/78 px-3 py-2 backdrop-blur">
        <div className="flex flex-wrap gap-3 text-[10px] text-[#9AA3C4]">
          {(['critical', 'warning', 'watch', 'info'] as IntelLevel[]).map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[level] }} />
              {LEVEL_LABEL[level]}
            </span>
          ))}
        </div>
      </div>

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-3 right-4 z-20 rounded bg-[#05070D]/72 px-2 py-1 text-[9px] text-[#6A7299] underline-offset-2 hover:text-[#F0C66A]"
      >
        © OpenStreetMap contributors
      </a>
    </section>
  );
}

function RightPanel({
  point,
  queue,
  onRoute,
  onSelect,
}: {
  point: MapPoint | null;
  queue: MapPoint[];
  onRoute: () => void;
  onSelect: (id: string | null) => void;
}) {
  if (!point) {
    return (
      <GlassPanel accent="#E0553A" className="min-h-[460px] lg:h-full">
        <div className="grid h-full place-items-center p-6 text-center text-[#8A92AC]">
          <div>
            <MapPinned className="mx-auto mb-3 text-[#E0553A]" />
            <p className="text-sm">暂无可展示情报</p>
          </div>
        </div>
      </GlassPanel>
    );
  }

  const { signal } = point;
  const sourceUrls = signal.sources.map((source) => source.url).filter((url): url is string => Boolean(url));

  return (
    <GlassPanel accent="#E0553A" className="min-h-[560px] lg:h-full">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <div className="section-eyebrow text-[#8F835F]">情报详情</div>
          <h2 className="mt-1 line-clamp-2 font-serif text-[17px] font-black leading-6 text-[#F5E9C9]">
            {signal.title}
          </h2>
        </div>
        <span className="shrink-0 rounded border px-2 py-1 font-mono text-[10px]" style={{ borderColor: `${point.ministry.color}66`, color: point.ministry.color }}>
          {point.ministry.label}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <InfoPill label="地区" value={signal.regionLabel} tone="#60A5FA" />
          <InfoPill label="等级" value={LEVEL_LABEL[signal.level]} tone={LEVEL_COLOR[signal.level]} />
          <InfoPill label="来源" value={sourceGradeLabel(point.grade)} tone={point.grade === 'real' ? '#3DD68C' : point.grade === 'mixed' ? '#F5A524' : '#8A6A2A'} />
          <InfoPill label="状态" value={statusLabel(point.status)} tone={point.status === 'routed' ? '#3DD68C' : '#F0C66A'} />
        </div>

        <DetailBlock icon={FileSearch} title="证据摘要">
          <p>{signal.summary}</p>
          <p className="mt-2 text-[#7E86A8]">
            行业：{signal.industry} · 类别：{CATEGORY_LABEL[signal.category]} · 可信度：{CREDIBILITY_LABEL[signal.credibility]}
          </p>
        </DetailBlock>

        <DetailBlock icon={Link2} title="公开来源">
          {sourceUrls.length > 0 ? (
            <div className="space-y-2">
              {signal.sources.slice(0, 4).map((source, index) => (
                <div key={`${source.name}-${index}`} className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                  <div className="text-[11px] font-semibold text-[#EAEEFB]">{source.name}</div>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all font-mono text-[9px] leading-4 text-[#60A5FA] hover:text-[#F0C66A]"
                    >
                      {source.url}
                    </a>
                  ) : (
                    <div className="mt-1 text-[10px] text-[#8A6A2A]">缺少公开来源地址，不能进入正式六部测算。</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#8A6A2A]">当前情报没有公开来源地址，不允许标记为真实来源。</p>
          )}
        </DetailBlock>

        <DetailBlock icon={CheckCircle2} title="证据硬门">
          <GateRow pass={sourceUrls.length > 0} text="至少一个公开来源地址" />
          <GateRow pass={point.grade === 'real'} text="来源可信度达到正式派发标准" />
          <GateRow pass={point.grade !== 'fallback'} text="不是演示或兜底数据" />
          <GateRow pass text="禁止直接生成交易、付款或对外承诺" />
        </DetailBlock>

        <DetailBlock icon={RadioTower} title="处理建议">
          <div className="space-y-1.5 text-[12px] leading-6 text-[#BFC7DD]">
            <p>当前建议：生成证据包后派发至{point.ministry.label}。</p>
            <p>若来源缺失或可信度不足，应先标记缺证，不得进入正式测算。</p>
          </div>
        </DetailBlock>
      </div>

      <div className="border-t border-[#E0553A]/18 px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={sourceUrls.length === 0}
            className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3 py-2 text-[11px] font-semibold text-[#F0C66A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            生成证据包
          </button>
          <button
            type="button"
            onClick={onRoute}
            disabled={sourceUrls.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E0553A]/45 bg-[#E0553A]/12 px-3 py-2 text-[11px] font-semibold text-[#E0553A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={12} />
            派发六部
          </button>
        </div>
        <button
          type="button"
          onClick={() => onSelect(queue.find((item) => item.signal.id !== signal.id)?.signal.id ?? null)}
          className="mt-2 w-full rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-[#9AA3C4]"
        >
          查看下一条情报
        </button>
      </div>
    </GlassPanel>
  );
}

function InfoPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.16em] text-[#6A7299]">{label}</div>
      <div className="mt-1 text-[12px] font-semibold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function DetailBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileSearch;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#05070D]/48 p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8F835F]">
        <Icon size={12} className="text-[#E0553A]" />
        {title}
      </div>
      <div className="text-[12px] leading-6 text-[#BFC7DD]">{children}</div>
    </section>
  );
}

function GateRow({ pass, text }: { pass: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="h-2 w-2 rounded-full" style={{ background: pass ? '#3DD68C' : '#F43F5E' }} />
      <span className={pass ? 'text-[#BFC7DD]' : 'text-[#F43F5E]'}>{text}</span>
    </div>
  );
}

function BottomQueue({
  points,
  selectedId,
  onSelect,
}: {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#E0553A]/18 bg-[#05070D]/78 px-3 py-3 backdrop-blur-xl" data-testid="jinyiwei-intel-queue">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">
          <Archive size={12} className="text-[#E0553A]" />
          情报处理队列
        </div>
        <span className="font-mono text-[10px] text-[#6A7299]">{points.length} 条</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {points.slice(0, 8).map((point) => {
          const selected = point.signal.id === selectedId;
          return (
            <button
              key={point.signal.id}
              type="button"
              onClick={() => onSelect(point.signal.id)}
              className="rounded-xl border px-3 py-2 text-left transition hover:bg-white/[0.045]"
              style={{
                borderColor: selected ? `${point.ministry.color}88` : 'rgba(255,255,255,0.08)',
                background: selected ? `${point.ministry.color}12` : 'rgba(255,255,255,0.025)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px]" style={{ color: LEVEL_COLOR[point.signal.level] }}>
                  {LEVEL_LABEL[point.signal.level]}
                </span>
                <span className="text-[9px] text-[#6A7299]">{hoursAgo(point.signal.lastUpdatedAt)}</span>
              </div>
              <div className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#EAEEFB]">{point.signal.title}</div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[#7E86A8]">
                <span>{point.signal.regionLabel}</span>
                <span style={{ color: point.ministry.color }}>{point.ministry.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
