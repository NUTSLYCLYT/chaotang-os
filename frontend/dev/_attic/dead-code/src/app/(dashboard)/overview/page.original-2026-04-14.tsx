/**
 * 朝堂 OS V2 · 朝堂总览
 *
 * 视觉锚点：中央丞相状态环 + Agent 矩阵 + 四象限摘要
 * 数据源：mock fixtures（后续切 real API）
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Crown,
  Activity,
  AlertTriangle,
  Sparkles,
  Heart,
  Telescope,
  ChevronRight,
  MessageSquareQuote,
  Radio,
  Coins,
  BriefcaseBusiness,
  ShoppingBag,
  Stethoscope,
  Clapperboard,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { DecreeInputDock } from '@/features/imperial/overview/components/decree-input-dock';
import { ImperialCentralStage } from '@/features/imperial/overview/components/imperial-central-stage';
import { ImperialTimeline } from '@/features/imperial/overview/components/imperial-timeline';
import { OfficialSeatRing } from '@/features/imperial/overview/components/official-seat-ring';
import {
  CourtConstitutionPanel,
  CourtSequencePanel,
  ExecutiveSignalGrid,
  GovernanceDecisionPanel,
  ImperialDecisionDeck,
  MarketingOutputPreview,
  QuadrantData,
  SpecialForcesPanel,
} from '@/features/imperial/overview/components/overview-page-sections';
import {
  AgentMatrix,
  CurrentTaskCard,
  LiveEventFeed,
  PendingReviewPanel,
  PrimeMinisterHero,
} from '@/features/imperial/overview/components/overview-support-panels';
import { OFFICIAL_SEATS } from '@/features/imperial/overview/lib/official-seats';
import { ThroneBridgeBanner } from '@/features/shared/components/throne-bridge-banner';
import { SurfaceBridgePanel } from '@/features/shared/components/surface-bridge-panel';
import { StateSwitch } from '@/components/ui/state-switch';
import { PrimeMinisterHub } from '@/components/effects';
import { playDemoScript, stopDemoScript } from '@/lib/demo/script-player';
import { nvidiaMainScript } from '@/lib/demo/scripts/nvidia-main';
import { Play, Pause } from 'lucide-react';
import {
  asyncIdle,
  asyncLoading,
  asyncReady,
  asyncError,
  type AsyncState,
} from '@/types/async-state';
import { api } from '@/lib/api/client';
import { useAppStore } from '@/lib/store/app-store';
import type { AgentCode, AgentRun } from '@/types/agent';
import type { Task } from '@/types/task';
import type { IntelSignal } from '@/types/intel';
import type { HealthProfile } from '@/types/health';

export default function OverviewPage() {
  // 1) 响应式从 store 读取（剧本播放会 mutate 这些）
  const tasks = useAppStore((s) => s.tasks);
  const currentTaskId = useAppStore((s) => s.currentTaskId);
  const storeRuns = useAppStore((s) => s.agentRuns);
  const playingScriptId = useAppStore((s) => s.demoPlayingScriptId);

  // 2) 启动时用 mock API 灌入初始态（如果 store 是空的）
  // 四象限的 intel/health 走统一 AsyncState 契约（CLAUDE.md §5）
  const [quadrant, setQuadrant] = useState<AsyncState<QuadrantData>>(asyncIdle());

  const loadQuadrant = useCallback(async (mountedRef: { current: boolean }) => {
    setQuadrant(asyncLoading({ hint: 'Sync intel & health' }));
    try {
      const [signals, healthProfile] = await Promise.all([
        api.intel.getTopSignals(6),
        api.health.getProfile(),
      ]);
      if (!mountedRef.current) return;
      setQuadrant(asyncReady({ signals, health: healthProfile }));
    } catch (err) {
      if (!mountedRef.current) return;
      setQuadrant(
        asyncError(err instanceof Error ? err.message : '数据加载失败', {
          retryable: true,
          cause: err,
        }),
      );
    }
  }, []);

  useEffect(() => {
    const mountedRef = { current: true };
    (async () => {
      const store = useAppStore.getState();
      // 仅当 store 空时才 seed，避免覆盖剧本状态
      if (store.tasks.length === 0 || store.agentRuns.length === 0) {
        const [task, runs] = await Promise.all([
          api.tasks.getCurrent(),
          api.agents.getStatusMatrix(),
        ]);
        if (!mountedRef.current) return;
        if (task) {
          store.addTask(task);
          if (!store.currentTaskId) store.selectTask(task.id);
        }
        store.setAgentRuns(runs);
      }
      await loadQuadrant(mountedRef);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [loadQuadrant]);

  const currentTask: Task | null =
    tasks.find((t) => t.id === currentTaskId) ?? tasks[0] ?? null;
  const agentRuns: AgentRun[] = storeRuns;

  const runsByCode = new Map<AgentCode, AgentRun>();
  for (const run of agentRuns) runsByCode.set(run.agentCode, run);

  // 重试入口（StateSwitch error 态用）
  const retryQuadrant = useCallback(() => {
    void loadQuadrant({ current: true });
  }, [loadQuadrant]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        {/* ===== 陛下视图桥接条 ===== */}
        <ThroneBridgeBanner />

        <ImperialDecisionDeck
          task={currentTask}
          quadrant={quadrant}
          activeCount={agentRuns.filter((r) => r.state === 'running' || r.state === 'summarizing').length}
        />

        <SurfaceBridgePanel
          mode="frontstage"
          frontstageHref="/throne"
          backstageHref="/governance"
          frontstageLabel="回陛下第一眼"
          backstageLabel="进入三省审议台"
        />

        <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="section-eyebrow text-[#8e7a4b]">Hall Access · 大殿侧边入口</div>
              <div className="mt-2 text-[15px] font-semibold text-[#F5E9C9]">先看群臣与总批，再按房间和后台层级分流。</div>
            </div>
            <div className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#F0C66A]">前台房间 + 后台中枢</div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.04] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8F835F]">前台房间</div>
              <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">看群臣、问房间、收丞相判断。</div>
              <div className="mt-2 text-[11px] leading-6 text-[#9AA3C4]">
                军机处负责定调，上书房负责召见，情报中心、观天台、太医院负责提供最有价值的单点判断。
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8F835F]">后台中枢</div>
              <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">要巡查去御巡台，要裁断去三省。</div>
              <div className="mt-2 text-[11px] leading-6 text-[#9AA3C4]">
                御巡台负责抽查六部与蜂群运行，三省负责会签、边界与工作流铸造，不在大殿直接展开后台细节。
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Link href="/command-center" className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-[12px] text-[#D6CCB0] transition hover:border-[#F0C66A]/24 hover:bg-white/[0.045] hover:text-[#F5E9C9]">军机处</Link>
            <Link href="/study/hubu" className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-[12px] text-[#D6CCB0] transition hover:border-[#F0C66A]/24 hover:bg-white/[0.045] hover:text-[#F5E9C9]">上书房</Link>
            <Link href="/intel" className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-[12px] text-[#D6CCB0] transition hover:border-[#F0C66A]/24 hover:bg-white/[0.045] hover:text-[#F5E9C9]">情报中心</Link>
            <Link href="/forecast" className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-[12px] text-[#D6CCB0] transition hover:border-[#F0C66A]/24 hover:bg-white/[0.045] hover:text-[#F5E9C9]">观天台</Link>
            <Link href="/health" className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-[12px] text-[#D6CCB0] transition hover:border-[#F0C66A]/24 hover:bg-white/[0.045] hover:text-[#F5E9C9]">太医院</Link>
            <Link href="/archive" className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-[12px] text-[#D6CCB0] transition hover:border-[#F0C66A]/24 hover:bg-white/[0.045] hover:text-[#F5E9C9]">御巡台</Link>
          </div>
        </GlassPanel>

        <StateSwitch state={quadrant} onRetry={retryQuadrant} minHeight={120}>
          {({ signals, health }) => (
            <>
              <ExecutiveSignalGrid signals={signals} health={health} activeCount={agentRuns.filter((r) => r.state === 'running' || r.state === 'summarizing').length} />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <SpecialForcesPanel runs={agentRuns} />
                <MarketingOutputPreview />
              </div>
            </>
          )}
        </StateSwitch>

        <ImperialCentralStage officials={OFFICIAL_SEATS} />
        <GlassPanel variant="gold" tone="deep" padding="md" hudCorners>
          <div className="section-eyebrow">Hall Rule · 进殿四步</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              ['先看总批', '先收丞相一句话，不要先陷入细节。'],
              ['再看群臣', '看哪一席有急章、有机会、有异常。'],
              ['再入房间', '只进入最值得看的房间，不并行乱跳。'],
              ['最后分流', '要巡查去御巡台，要裁断去三省，要执行去庄园。'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4">
                <div className="text-[12px] font-semibold text-[#F5E9C9]">{title}</div>
                <div className="mt-2 text-[11px] leading-6 text-[#9AA3C4]">{body}</div>
              </div>
            ))}
          </div>
        </GlassPanel>
        <DecreeInputDock />

        <GovernanceDecisionPanel />

        {/* ===== 顶部：Hero + 当前总任务 ===== */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          <div className="md:col-span-7">
            <PrimeMinisterHero
              task={currentTask}
              runsCount={agentRuns.length}
              activeCount={agentRuns.filter((r) => r.state === 'running' || r.state === 'summarizing').length}
            />
          </div>
          <div className="md:col-span-5">
            <CurrentTaskCard task={currentTask} runs={agentRuns} />
          </div>
        </div>

        {/* ===== 朝堂中枢 · Wow Moment 视觉锚 ===== */}
        {/* DEMO-BIBLE.md §九 · 中央丞相状态环 + 11 部门轨道 */}
        <GlassPanel tone="elevated" padding="lg" hudCorners className="relative overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="section-eyebrow">
                Imperial Cabinet · 朝堂中枢
              </div>
              <h2 className="section-title gold-text mt-1 text-[20px]">
                丞相状态环
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {playingScriptId && (
                <div className="flex items-center gap-2 text-[11px]">
                  <Activity size={12} className="animate-pulse text-[#F0C66A]" />
                  <span className="text-[#F0C66A]">剧本播放中</span>
                </div>
              )}
              {playingScriptId ? (
                <button
                  type="button"
                  onClick={stopDemoScript}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition hover:brightness-110"
                  style={{
                    background: 'rgba(244, 63, 94, 0.12)',
                    border: '1px solid rgba(244, 63, 94, 0.5)',
                    color: 'rgba(244, 63, 94, 0.95)',
                  }}
                >
                  <Pause size={11} />
                  停止播放
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void playDemoScript(nvidiaMainScript)}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition hover:brightness-110"
                  style={{
                    background: 'rgba(240, 198, 106, 0.12)',
                    border: '1px solid rgba(240, 198, 106, 0.5)',
                    color: 'rgba(240, 198, 106, 0.95)',
                  }}
                  title="播放主线剧本：NVIDIA 估值研判 · 90 秒"
                >
                  <Play size={11} />
                  播放主线（90s）
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center">
            <PrimeMinisterHub
              runsByCode={runsByCode}
              dispatching={!!playingScriptId}
              size={560}
            />
          </div>
        </GlassPanel>

        {/* ===== Agent 矩阵 + 待批示 ===== */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          <div className="md:col-span-8">
            <AgentMatrix runsByCode={runsByCode} />
          </div>
          <div className="md:col-span-4">
            <PendingReviewPanel />
          </div>
        </div>

        <ImperialTimeline />

        {/* ===== 底部事件流 ===== */}
        <LiveEventFeed />
      </div>
    </div>
  );
}
