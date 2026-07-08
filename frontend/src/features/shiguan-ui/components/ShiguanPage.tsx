"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// 顶导由 (dashboard)/layout.tsx 的 ChaotangTopNav 统一接管, 不再渲染自带 TopNav
import { Tabs } from "@/components/ui/tabs";
import GlassPanel from "./GlassPanel";
import ActionButton from "./ActionButton";
import { ShiguanPromoArchive } from "./ShiguanPromoArchive";
import RecordCard from "./RecordCard";
import TimelinePanel, { type TimelineRow, type BadgeTone } from "./TimelinePanel";
import ArchivePanel from "./ArchivePanel";
import InsightPanel from "./InsightPanel";
import KnowledgeGraph from "./KnowledgeGraph";
import ShiguanDrawer from "./ShiguanDrawer";
import { chaotang } from "@/lib/api/chaotang";
import { AnalysisPanel } from "@/features/shiguan/components/analysis-panel";
import { PatternPanel } from "@/features/shiguan/components/pattern-panel";
import { ShiguanBottomDock } from "@/features/shiguan/components/shiguan-bottom-dock";
import { EdictStage } from "@/features/shangshufang/components/MemorialScroll";
import type { EdictView } from "@/features/shangshufang/edict-content";
import { withBasePath } from "@/lib/base-path";
import {
  useArchiveStats,
  useArchiveRecords,
  useCommandTypeFreq,
  useDeptSuccessRates,
  useShiguanAnalysis,
} from "@/features/shiguan/lib/use-shiguan";
import {
  searchSuggestions,
  timelineFilters,
  decisionFilters,
  reviewFilters,
  reviewRecords,
  versionFilters,
  versionRecords,
  quickActions,
  type QuickAction,
} from "@/features/shiguan-ui/lib/shiguan-data";
import { ActionProtocolRow } from "@/features/shared/components/next-action-token";
import {
  BUILD_STATUS_LABEL,
  DEPARTMENT_BUILD_TASKS,
} from "@/features/operating-loop/lib/department-build-workflow";
import { BUILD_RETROSPECTIVES, BUILD_RETROSPECTIVE_SUMMARY } from "@/features/operating-loop/lib/build-retrospective";
import {
  OPERATING_KNOWLEDGE_CASES,
  OPERATING_KNOWLEDGE_SUMMARY,
  type KnowledgeCase,
} from "@/features/operating-loop/lib/knowledge-kernel";
import {
  BUILD_LEDGER_STATUS_LABEL,
  assessBuildLedgerEntry,
  fetchBuildLedgerAudit,
  readBuildLedger,
  subscribeBuildLedger,
  syncBuildLedgerFromServer,
  type BuildLedgerAuditEvent,
  type BuildLedgerEntry,
} from "@/features/operating-loop/lib/build-ledger";
import { BuildLedgerBackendTrace, BuildLedgerObjectPassport } from "@/features/operating-loop/components/ObjectPassport";

interface ScribeLesson {
  billId: string;
  billTitle: string;
  extractedAt: string;
  lessons: Array<{
    id: string;
    text: string;
    severity: "critical" | "important" | "note";
  }>;
  patterns: string[];
  tags: string[];
  summary: string;
}

interface ReleaseGateSummary {
  total?: number;
  passed?: number;
  failed?: number;
  durationMs?: number;
  screenshotCount?: number;
  completed?: number;
}

interface ReleaseGateStage {
  id: string;
  status: string;
  startedAt?: string;
  finishedAt?: string | null;
  durationMs?: number;
  error?: string | null;
}

interface ReleaseGateReport {
  schema?: string;
  runId?: string;
  startedAt?: string;
  finishedAt?: string | null;
  checkedAt?: string;
  decision?: string;
  gitCommit?: string | null;
  summary?: ReleaseGateSummary;
  evidence?: {
    releaseReport?: string;
    screenshotQaReport?: string | null;
    screenshotQaSummary?: ReleaseGateSummary | null;
  };
  stages?: ReleaseGateStage[];
  failedStages?: Array<{ id?: string; error?: string | null }>;
}

interface ReleaseGatePayload {
  status: string;
  latest: ReleaseGateReport | null;
  screenshotQa?: {
    decision?: string;
    summary?: ReleaseGateSummary;
    outputDir?: string;
    blockers?: unknown[];
  } | null;
  audit: ReleaseGateReport[];
  paths?: Record<string, string>;
}

interface ImaKnowledgeDocument {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  contentChars: number;
  contentExcerpt: string;
  source: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  archiveHref: string;
}

export default function ShiguanPage() {
  const [selectedBuildCase, setSelectedBuildCase] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedMemorialId, setSelectedMemorialId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState("archive-deck");
  const [rightPanelTab, setRightPanelTab] = useState("memory-deck");
  const [spotlightKey, setSpotlightKey] = useState<"memorial" | "decision" | "task" | "knowledge">("memorial");
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Turso + SWR 真实数据 ───
  const { data: archiveStats } = useArchiveStats();
  const { data: archivePayload, mutate: mutateArchiveRecords } = useArchiveRecords(80);
  const { analysis, analyzing, error: analysisError, generate } = useShiguanAnalysis();
  const tursoRecords = archivePayload?.data ?? [];

  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [feedbackResult, setFeedbackResult] = useState<{ succeeded: number; totalKnowledgeCount: number } | null>(null);
  const [buildLedger, setBuildLedger] = useState<BuildLedgerEntry[]>([]);
  const [buildLedgerAudit, setBuildLedgerAudit] = useState<BuildLedgerAuditEvent[]>([]);
  const [scribeLessons, setScribeLessons] = useState<ScribeLesson[]>([]);
  const [releaseGatePayload, setReleaseGatePayload] = useState<ReleaseGatePayload | null>(null);
  const [imaKnowledgeDocs, setImaKnowledgeDocs] = useState<ImaKnowledgeDocument[]>([]);
  const [imaKnowledgeLoading, setImaKnowledgeLoading] = useState(true);
  const [imaKnowledgeBusyId, setImaKnowledgeBusyId] = useState<string | null>(null);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedBuildCase(params.get("case"));
    setSelectedTaskId(params.get("taskId"));
    setSelectedMemorialId(params.get("memorialId"));
    setSelectedKnowledgeId(params.get("knowledgeId"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const kc = await chaotang.knowledgeCount().catch(() => ({ count: 0 }));
        if (cancelled) return;
        setKnowledgeCount(kc.count);
      } catch (err) {
        console.error('史馆数据加载失败:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const refresh = () => {
      setBuildLedger(readBuildLedger());
      void fetchBuildLedgerAudit().then(setBuildLedgerAudit).catch(() => {});
    };
    refresh();
    void syncBuildLedgerFromServer().then(setBuildLedger).catch(() => {});
    return subscribeBuildLedger(refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadLessons() {
      try {
        const response = await fetch(withBasePath("/api/scribe/lessons"), { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        setScribeLessons(Array.isArray(payload?.lessons) ? payload.lessons as ScribeLesson[] : []);
      } catch {
        if (!cancelled) setScribeLessons([]);
      }
    }
    void loadLessons();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadReleaseGates() {
      try {
        const response = await fetch(withBasePath("/api/court/shiguan/release-gates"), { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        setReleaseGatePayload(payload?.success ? payload.data as ReleaseGatePayload : null);
      } catch {
        if (!cancelled) setReleaseGatePayload(null);
      }
    }
    void loadReleaseGates();
    return () => { cancelled = true; };
  }, []);

  const loadImaKnowledge = useCallback(async () => {
    setImaKnowledgeLoading(true);
    try {
      const response = await fetch(withBasePath("/api/court/ima-knowledge?limit=20"), { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      setImaKnowledgeDocs(Array.isArray(payload?.data?.documents) ? payload.data.documents as ImaKnowledgeDocument[] : []);
    } catch {
      setImaKnowledgeDocs([]);
    } finally {
      setImaKnowledgeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImaKnowledge();
  }, [loadImaKnowledge]);

  const handleImaKnowledgeStatus = useCallback(
    async (document: ImaKnowledgeDocument) => {
      const nextStatus = document.status === "active" ? "archived" : "active";
      setImaKnowledgeBusyId(document.id);
      try {
        const response = await fetch(withBasePath("/api/court/ima-knowledge"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ id: document.id, status: nextStatus }),
        });
        const payload = await response.json().catch(() => null);
        const updated = payload?.data?.document as ImaKnowledgeDocument | null | undefined;
        if (!response.ok || !payload?.success || !updated) throw new Error(payload?.message || payload?.error || "IMA status update failed");
        setImaKnowledgeDocs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } catch {
        await loadImaKnowledge();
      } finally {
        setImaKnowledgeBusyId(null);
      }
    },
    [loadImaKnowledge],
  );

  const handleFeedback = useCallback(async () => {
    try {
      const result = await chaotang.feedbackToKnowledge();
      setFeedbackResult(result);
      setKnowledgeCount(result.totalKnowledgeCount);
    } catch {
      // ignore
    }
  }, []);

  const handleRetroUpdate = useCallback(async (archiveId: string, status: string) => {
    const res = await fetch(withBasePath(`/api/shiguan/archives/${archiveId}/retrospective`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retrospective_status: status }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { message?: string } | null;
      throw new Error((payload?.message) ?? `HTTP ${res.status}`);
    }
    await mutateArchiveRecords();
  }, [mutateArchiveRecords]);

  // ─── 从 Turso + 奏折 API 构建展示数据 ───
  const memorialRecords = tursoRecords.filter((record) => !record.isGovernance);
  const decisionRecords = tursoRecords.filter((record) => record.isGovernance);
  const commandTypeFreq = useCommandTypeFreq(tursoRecords);
  const deptSuccessRates = useDeptSuccessRates(tursoRecords);
  const tursoTaskCount = tursoRecords.filter((r) => !r.isGovernance).length;
  const tursoGovCount = tursoRecords.filter((r) => r.isGovernance).length;
  // HIGH-1 修复: 成功率只对已真实回填的样本算（排除 not_started / 未回填），防虚高。
  const FILLED_STATUSES: ReadonlySet<string> = new Set(['达成', '未达成', '部分']);
  const filledRecords = tursoRecords.filter(
    (r) => r.retrospectiveStatus !== undefined && FILLED_STATUSES.has(r.retrospectiveStatus),
  );
  const successfulCount = filledRecords.filter((record) => record.outcome === "success").length;
  const computedSuccessRate = filledRecords.length > 0
    ? Math.round((successfulCount / filledRecords.length) * 100)
    : 0;
  const thisMonthCount = tursoRecords.filter((record) => {
    const date = new Date(record.date);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
  const topCase = [...memorialRecords, ...decisionRecords].find((record) => record.outcome === "success")
    ?? memorialRecords[0]
    ?? decisionRecords[0];
  const taskTotal = archiveStats?.totalTasks ?? tursoTaskCount;
  const govTotal = archiveStats?.totalCases ?? tursoGovCount;
  const statCards = [
    { key: "memorial", title: "奏折库", image: "/assets/shiguan/shiguan.webp", glyph: "卷", count: String(taskTotal), delta: `共 ${taskTotal} 件` },
    { key: "decision", title: "决策档案", image: "/assets/shiguan/shiguan.webp", glyph: "玺", count: String(govTotal), delta: `共 ${govTotal} 条` },
    { key: "task", title: "任务履历", image: "/assets/shiguan/shiguan.webp", glyph: "册", count: String(taskTotal), delta: "Turso 任务档案" },
    { key: "knowledge", title: "知识库", image: "/assets/shiguan/shiguan.webp", glyph: "藏", count: String(feedbackResult?.totalKnowledgeCount ?? knowledgeCount), delta: "条知识条目" },
  ];

  const chronicleRows: TimelineRow[] = memorialRecords.slice(0, 15).map((record) => ({
    date: record.date ? new Date(record.date).toLocaleDateString('zh-CN') : '',
    title: record.title,
    badge: {
      text: record.outcome === 'success' ? '已归档' : record.outcome === 'blocked' ? '已阻塞' : record.outcome === 'failed' ? '失败' : '处理中',
      tone: record.outcome === 'success' ? 'done' as BadgeTone : 'running' as BadgeTone,
    },
    ...(record.retrospectiveStatus !== undefined && {
      archiveId: record.id,
      retrospectiveStatus: record.retrospectiveStatus,
      onRetroUpdate: handleRetroUpdate,
    }),
  }));

  const decisionRows: TimelineRow[] = decisionRecords.slice(0, 15).map((record) => ({
    date: record.date ? new Date(record.date).toLocaleDateString('zh-CN') : '',
    title: `${record.outcome === 'success' ? '✅ 批准' : record.outcome === 'blocked' ? '❌ 驳回' : '❓ 待定'}: ${record.title}`,
    badge: {
      text: record.outcome === 'success' ? '已批准' : record.outcome === 'blocked' ? '已驳回' : '待定',
      tone: record.outcome === 'success' ? 'done' as BadgeTone : 'decision' as BadgeTone,
    },
    ...(record.retrospectiveStatus !== undefined && {
      archiveId: record.id,
      retrospectiveStatus: record.retrospectiveStatus,
      onRetroUpdate: handleRetroUpdate,
    }),
  }));

  const focusPanel = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlight(null), 1500);
  }, []);

  const handleAction = useCallback(
    (a: QuickAction) => {
      if (a.id === 'knowledge-intake') {
        // 知识入库 → 调用反哺丞相 API
        setRightPanelTab("memory-deck");
        setSpotlightKey("knowledge");
        handleFeedback();
        return;
      }
      if (a.target) {
        if (a.target === "panel-timeline" || a.target === "panel-decision" || a.target === "panel-overview") {
          setLeftPanelTab("archive-deck");
        }
        if (a.target === "panel-knowledge" || a.target === "panel-feedback") {
          setRightPanelTab("memory-deck");
          setSpotlightKey("knowledge");
        }
        if (a.target === "panel-review" || a.target === "panel-version") {
          setRightPanelTab("review-deck");
          setSpotlightKey("task");
        }
        focusPanel(a.target);
      }
      else setDrawerOpen(true);
    },
    [focusPanel, handleFeedback]
  );

  const handleCard = useCallback(
    (key: string) => {
      setSpotlightKey(key as "memorial" | "decision" | "task" | "knowledge");
      const map: Record<string, string> = {
        memorial: "panel-timeline",
        decision: "panel-decision",
        task: "panel-overview",
        knowledge: "panel-knowledge",
      };
      if (key === "memorial" || key === "decision" || key === "task") {
        setLeftPanelTab("archive-deck");
      }
      if (key === "knowledge") {
        setRightPanelTab("memory-deck");
      }
      focusPanel(map[key] ?? "panel-timeline");
    },
    [focusPanel]
  );

  const shiguanEdict = useMemo<EdictView>(() => {
    const latestTitle = topCase?.title ?? "暂无可召回案卷";
    const latestDate = topCase?.date ? new Date(topCase.date).toLocaleDateString("zh-CN") : "待归档";
    const recentTitles = tursoRecords
      .slice(0, 5)
      .map((record, index) => `${index + 1}. ${record.title}`)
      .join("\n");

    return {
      id: `shiguan-scroll:${taskTotal}:${govTotal}:${knowledgeCount}:${spotlightKey}`,
      title: "史馆案卷总览",
      subtitle: "旧案召回、复盘归档、组织记忆",
      headerKicker: "ARCHIVE SCROLL",
      issuerLine: "太史令 · 史馆中卷",
      question: topCase
        ? `当前可鉴旧案：${latestTitle}`
        : "史馆正在整理案卷，新的圣裁与任务完成后会在此沉淀。",
      seal: "imperial",
      meta: {
        reporter: "太史令",
        priority: "medium",
        accent: "#3DD68C",
        accentSoft: "#F0C66A",
        badges: [
          { label: `案卷 ${taskTotal}`, tone: "green" },
          { label: `治理 ${govTotal}`, tone: "blue" },
          { label: `知识 ${feedbackResult?.totalKnowledgeCount ?? knowledgeCount}`, tone: "amber" },
        ],
      },
      rows: [
        {
          label: "圣裁",
          body: `史馆当前收录案卷 ${taskTotal} 件，治理决策 ${govTotal} 条，复盘成功率 ${archiveStats?.successRate ?? computedSuccessRate}%。`,
        },
        {
          label: "证据",
          body: recentTitles || "暂无近期案卷。完成上书房裁决、军机处会审或任务归档后，会自动进入史馆。",
        },
        {
          label: "为何现在",
          body: `最近可鉴案卷：${latestTitle}\n归档时间：${latestDate}\n当前焦点：${spotlightKey === "knowledge" ? "知识反哺" : spotlightKey === "task" ? "复盘闭环" : "档案先例"}`,
        },
        {
          label: "后令",
          body: "先召回同类旧案，再进入上书房形成新旨意；已经完成的裁断继续写回史馆，供下一轮会审引用。",
        },
      ],
    };
  }, [
    archiveStats?.successRate,
    computedSuccessRate,
    feedbackResult?.totalKnowledgeCount,
    govTotal,
    knowledgeCount,
    spotlightKey,
    taskTotal,
    topCase,
    tursoRecords,
  ]);

  return (
    <div className="relative h-full min-h-0">
      <main className="relative h-full min-h-[760px] overflow-hidden text-[#EAEEFB]">
        <div className="relative z-10 mx-auto flex h-full max-w-[1680px] flex-col px-4 pb-[286px] pt-5">
          <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_330px]">
            <aside data-three-axis-panel="left" className="min-h-0">
              <GlassPanel
                title="档案与规律"
                eyebrow="Archive + Pattern"
                className="flex h-full min-h-0 flex-col"
                bodyClassName="min-h-0 flex-1 overflow-y-auto thin-scroll"
              >
            <div className="space-y-3">
              <div className="rounded-2xl border border-gold-300/14 bg-black/18 px-3 py-3 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="section-eyebrow text-gold-200/85">史馆总览</div>
                    <div className="mt-1 text-[18px] font-serif font-semibold text-gold-gradient">太史馆</div>
                    <p className="mt-1 text-[11.5px] leading-5 text-slatey-300/86">
                      档案、规律与主统计收束到左侧工作区，中间卷轴用于召回旧案、沉淀复盘和反哺上书房。
                    </p>
                  </div>
                  <Link
                    href="/governance"
                    className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
                  >
                    去三省审议台
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { label: "档案", value: `${taskTotal} 件` },
                    { label: "治理", value: `${govTotal} 条` },
                    { label: "本月", value: `${thisMonthCount} 件` },
                    { label: "成功率", value: `${archiveStats?.successRate ?? computedSuccessRate}%` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-gold-300/12 bg-white/[0.025] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slatey-400">{item.label}</div>
                      <div className="mt-1 font-serif text-[17px] text-gold-gradient">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {statCards.map((card) => (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => handleCard(card.key)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        spotlightKey === card.key
                          ? "border-gold-300/40 bg-gold-300/[0.12]"
                          : "border-white/10 bg-black/20 hover:border-gold-300/24"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-slatey-300/88">{card.title}</span>
                        <span className="font-serif text-[16px] text-gold-gradient">{card.count}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slatey-400">{card.delta}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickActions.slice(0, 3).map((action) => (
                    <ActionButton
                      key={action.id}
                      glyph={action.glyph}
                      variant={action.primary ? "gold" : "ghost"}
                      onClick={() => handleAction(action)}
                    >
                      {action.label}
                    </ActionButton>
                  ))}
                </div>
              </div>

              <ShiguanPromoArchive />

              <Tabs
                gap="sm"
                activeTabId={leftPanelTab}
                onChange={setLeftPanelTab}
                items={[
                {
                  id: "archive-deck",
                  label: "档案总览",
                  badge: chronicleRows.length + decisionRows.length,
                  children: (
                    <div className="pr-1">
                      <div className="space-y-3">
                        <SearchPanel />
                        {/* LOW-1 修复: 有决策归档时不误报"还没有档案" */}
                        {chronicleRows.length + decisionRows.length === 0 && (
                          <div className="mb-3 rounded-lg border border-slatey-400/20 bg-slatey-400/5 px-4 py-4 text-center">
                            <p className="text-[12.5px] text-slatey-300">
                              史馆还没有档案 —{" "}
                              <Link
                                href={withBasePath("/shangshufang")}
                                className="text-gold-200/90 underline transition-colors hover:text-gold-100"
                              >
                                去上书房下第一道旨
                              </Link>
                              ，裁决采纳后这里自动留档。
                            </p>
                          </div>
                        )}
                        <TimelinePanel
                          id="panel-timeline"
                          title="时间轴视图"
                          filters={timelineFilters}
                          rows={chronicleRows}
                          variant="chronicle"
                          highlight={highlight === "panel-timeline"}
                          footer={
                            <button
                              type="button"
                              className="w-full text-center text-[12px] text-gold-200/90 transition-colors hover:text-gold-100"
                            >
                              查看完整时间轴 ›
                            </button>
                          }
                        />
                        <TimelinePanel
                          id="panel-decision"
                          title="决策时间线"
                          filters={decisionFilters}
                          rows={decisionRows}
                          variant="decision"
                          highlight={highlight === "panel-decision"}
                          footer={
                            <button
                              type="button"
                              className="w-full rounded-lg border border-gold-300/30 bg-gold-300/8 py-2 text-[12.5px] text-gold-100 transition-colors hover:border-gold-300/55 hover:bg-gold-300/14"
                            >
                              查看全部决策档案
                            </button>
                          }
                        />
                        <DataOverview
                          highlight={highlight === "panel-overview"}
                          totalTasks={archiveStats?.totalTasks}
                          totalCases={archiveStats?.totalCases}
                          successRate={archiveStats?.successRate}
                          knowledgeCount={feedbackResult?.totalKnowledgeCount ?? knowledgeCount}
                          govCount={tursoGovCount}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  id: "pattern-deck",
                  label: "规律分析",
                  badge: commandTypeFreq.length,
                  children: (
                    <div className="pr-1">
                      <div className="space-y-3">
                        <PatternPanel
                          items={tursoRecords}
                          topCase={topCase}
                          commandTypes={commandTypeFreq}
                          deptSuccessRates={deptSuccessRates}
                        />
                        <AnalysisPanel
                          result={analysis}
                          analyzing={analyzing}
                          onGenerate={generate}
                        />
                        {analysisError ? (
                          <div className="rounded-xl border border-amber-400/18 bg-amber-400/8 px-4 py-3 text-[12px] text-amber-100/88">
                            规律分析暂时生成失败：{analysisError}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ),
                },
              ]}
              />
            </div>
              </GlassPanel>
            </aside>

            <section className="h-[620px] min-h-0 xl:h-full">
              <div className="h-full min-h-0">
                <EdictStage
                  view={shiguanEdict}
                  customBodyScroll="styled"
                  footer={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href="/court-briefing"
                        className="inline-flex items-center rounded-lg border border-[#3DD68C]/35 bg-[#3DD68C]/10 px-3 py-1.5 text-[11px] font-semibold text-[#24513A] transition hover:bg-[#3DD68C]/16"
                      >
                        回上书房召回旧案
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        className="inline-flex items-center rounded-lg border border-[#F0C66A]/38 bg-[#F0C66A]/12 px-3 py-1.5 text-[11px] font-semibold text-[#5B3A0A] transition hover:bg-[#F0C66A]/18"
                      >
                        问太史令
                      </button>
                    </div>
                  }
                />
              </div>
            </section>

            <aside data-three-axis-panel="right" className="min-h-0">
              <GlassPanel
                title="知识与专项"
                eyebrow="Memory + Special"
                className="flex h-full min-h-0 flex-col"
                bodyClassName="min-h-0 flex-1 overflow-y-auto thin-scroll"
              >
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-400/18 bg-emerald-400/[0.05] px-3 py-3 backdrop-blur-sm">
                <div className="grid gap-3">
                  <div>
                    <div className="section-eyebrow text-[#B9F6D2]">Archive Flywheel · 史馆组织记忆</div>
                    <p className="mt-1 text-[11.5px] leading-5 text-slatey-300/88">
                      每条归档都要改变下一次上书房简报或军机处推荐，组织记忆与反哺动作统一并到右侧工作区。
                    </p>
                  </div>
                  <ActionProtocolRow
                    items={[
                      { label: "决策", value: "背景、分歧、证据、拍板人", tone: "gold" },
                      { label: "战报", value: "目标、偏差、结果、教训", tone: "blue" },
                      { label: "蜂群", value: "适用边界与历史表现", tone: "green" },
                      { label: "反哺", value: "复盘改变下一次路由", tone: "violet" },
                    ]}
                  />
                  <div className="rounded-xl border border-gold-300/14 bg-black/18 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="section-eyebrow text-gold-200/78">Next Action</div>
                        <div className="mt-1 text-[13px] font-semibold text-[#F5E9C9]">把本次教训写回上书房</div>
                      </div>
                      <span className="rounded border border-emerald-400/22 bg-emerald-400/[0.08] px-2 py-1 text-[10px] text-emerald-100">
                        待反哺
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[#AEB8CE]">
                      当前焦点: {spotlightKey === "knowledge" ? "知识反哺" : spotlightKey === "task" ? "复盘闭环" : "档案先例"}。
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slatey-400">责任: 史馆 / 上书房</div>
                      <Link
                        href="/court-briefing"
                        className="rounded-md border border-gold-300/24 bg-gold-300/[0.08] px-3 py-1.5 text-[11px] text-gold-100 transition hover:bg-gold-300/[0.14]"
                      >
                        回上书房应用教训
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <Tabs
                gap="sm"
                activeTabId={rightPanelTab}
                onChange={setRightPanelTab}
                items={[
                {
                  id: "memory-deck",
                  label: "知识记忆",
                  badge: feedbackResult?.totalKnowledgeCount ?? knowledgeCount,
                  children: (
                    <div className="pr-1">
                      <div className="grid gap-3">
                        <UnifiedMemoryPanel
                          buildLedgerCount={buildLedger.length}
                          auditCount={buildLedgerAudit.length}
                          knowledgeCount={feedbackResult?.totalKnowledgeCount ?? knowledgeCount}
                          lessons={scribeLessons}
                        />
                        <KnowledgeGraph id="panel-knowledge" />
                        <ImaKnowledgePanel
                          documents={imaKnowledgeDocs}
                          loading={imaKnowledgeLoading}
                          busyId={imaKnowledgeBusyId}
                          selectedId={selectedKnowledgeId}
                          onToggleStatus={handleImaKnowledgeStatus}
                        />
                        <KnowledgeKernelPanel />
                        <InsightPanel
                          id="panel-feedback"
                          onGenerate={() => setDrawerOpen(true)}
                          highlight={highlight === "panel-feedback"}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  id: "special-deck",
                  label: "专项档案",
                  badge: buildLedger.length,
                  children: (
                    <div className="pr-1">
                      <div className="space-y-3">
                        <ReleaseGateArchivePanel payload={releaseGatePayload} />
                        <DevelopmentArchivePanel
                          selectedCase={selectedBuildCase}
                          selectedTaskId={selectedTaskId}
                          selectedMemorialId={selectedMemorialId}
                          buildLedger={buildLedger}
                          buildLedgerAudit={buildLedgerAudit}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  id: "review-deck",
                  label: "复盘版本",
                  badge: reviewRecords.length + versionRecords.length,
                  children: (
                    <div className="pr-1">
                      <div className="grid gap-3">
                        <ArchivePanel
                          id="panel-review"
                          title="复盘系统"
                          variant="review"
                          filters={reviewFilters}
                          rows={reviewRecords}
                          highlight={highlight === "panel-review"}
                          footer={
                            <button
                              type="button"
                              className="w-full rounded-lg border border-gold-300/30 bg-gold-300/8 py-2 text-[12.5px] text-gold-100 transition-colors hover:border-gold-300/55 hover:bg-gold-300/14"
                            >
                              进入复盘中心
                            </button>
                          }
                        />
                        <ArchivePanel
                          id="panel-version"
                          title="版本记录"
                          variant="version"
                          filters={versionFilters}
                          rows={versionRecords}
                          footer={
                            <button
                              type="button"
                              className="w-full text-center text-[12px] text-gold-200/90 transition-colors hover:text-gold-100"
                            >
                              查看全部版本 ›
                            </button>
                          }
                        />
                      </div>
                    </div>
                  ),
                },
              ]}
              />
            </div>
              </GlassPanel>
            </aside>
          </section>
        </div>
      </main>

      <ShiguanDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* 太史令底部 Dock — 走 /api/orchestration/run 三省会审 */}
      <ShiguanBottomDock
        stats={archiveStats ?? null}
        recentRecords={tursoRecords.slice(0, 8)}
      />
    </div>
  );
}

function ImaKnowledgePanel({
  documents,
  loading,
  busyId,
  selectedId,
  onToggleStatus,
}: {
  documents: ImaKnowledgeDocument[];
  loading: boolean;
  busyId: string | null;
  selectedId: string | null;
  onToggleStatus: (document: ImaKnowledgeDocument) => void;
}) {
  const activeCount = documents.filter((item) => item.status === "active").length;

  return (
    <GlassPanel
      id="panel-ima-knowledge"
      title="IMA 知识库维护"
      eyebrow={`${activeCount}/${documents.length} active`}
    >
      <div className="rounded-xl border border-emerald-400/18 bg-emerald-400/[0.055] px-3 py-2 text-[11px] leading-5 text-jade-100/82">
        上书房上传的补证文本会先进入 IMA 知识库，再作为下旨证据上下文使用；在此可归档或重新启用。
      </div>

      <div className="mt-3 space-y-2.5" data-testid="ima-knowledge-panel">
        {loading ? (
          <div className="rounded-xl border border-gold-300/12 bg-white/[0.03] px-3 py-3 text-[11px] text-slatey-300">
            正在读取 IMA 知识条目...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-gold-300/12 bg-white/[0.03] px-3 py-3 text-[11px] leading-5 text-slatey-300">
            暂无上书房补证附件。上传 txt、md、csv、json 等文本文件后会在这里出现。
          </div>
        ) : (
          documents.map((item) => {
            const active = item.status === "active";
            const selected = selectedId === item.id;
            return (
              <div
                key={item.id}
                data-testid="ima-knowledge-record"
                className={`rounded-xl border bg-white/[0.035] p-3 transition ${selected ? "shiguan-pulse-gold border-gold-300/45" : "border-gold-300/12"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-gold-100">{item.filename}</div>
                    <div className="mt-1 text-[9.5px] uppercase tracking-[0.14em] text-slatey-400">
                      {item.source} · {formatBytes(item.size)} · {item.contentChars} chars
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] ${
                      active
                        ? "border-emerald-400/22 bg-emerald-400/[0.07] text-emerald-100"
                        : "border-slate-400/20 bg-white/[0.04] text-slatey-300"
                    }`}
                  >
                    {active ? "启用" : "归档"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-[10.8px] leading-5 text-jade-100/76">
                  {item.contentExcerpt}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[9.5px] text-slatey-400">
                    {item.id} · {formatDateTime(item.updatedAt)}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => onToggleStatus(item)}
                    className="shrink-0 rounded-lg border border-gold-300/24 bg-gold-300/[0.06] px-2.5 py-1.5 text-[10.5px] text-gold-100 transition hover:bg-gold-300/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === item.id ? "处理中" : active ? "归档" : "启用"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
}

function KnowledgeKernelPanel() {
  const cases = OPERATING_KNOWLEDGE_CASES.slice(0, 4);

  return (
    <GlassPanel
      id="panel-knowledge-kernel"
      title="经营记忆内核"
      eyebrow={`${OPERATING_KNOWLEDGE_SUMMARY.totalCases} 案卷`}
    >
      <div className="grid grid-cols-3 gap-2">
        <KernelMetric label="证据块" value={OPERATING_KNOWLEDGE_SUMMARY.evidenceCount} />
        <KernelMetric label="进化基因" value={OPERATING_KNOWLEDGE_SUMMARY.geneCount} />
        <KernelMetric label="学习中" value={OPERATING_KNOWLEDGE_SUMMARY.learningCases} />
      </div>

      <div className="mt-3 rounded-xl border border-gold-300/14 bg-black/18 px-3 py-2 text-[11px] leading-5 text-jade-100/78">
        史馆不只存资料，而是把建议、预算、立项、交付、证据和复盘压成可调用案卷，反哺上书房、户部、军机处和工部。
      </div>

      <div className="mt-3 space-y-2.5">
        {cases.map((item) => (
          <KnowledgeCaseCard key={item.id} item={item} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/archive?view=knowledge-kernel"
          className="rounded-lg border border-gold-300/24 bg-gold-300/[0.06] px-2.5 py-2 text-center text-[11px] text-gold-100 transition hover:bg-gold-300/[0.12]"
        >
          查看案卷
        </Link>
        <Link
          href="/command-center?intent=%E5%A4%8D%E7%94%A8%E5%8F%B2%E9%A6%86%E7%BB%8F%E8%90%A5%E8%AE%B0%E5%BF%86%E5%86%85%E6%A0%B8"
          className="rounded-lg border border-emerald-400/22 bg-emerald-400/[0.055] px-2.5 py-2 text-center text-[11px] text-emerald-100 transition hover:bg-emerald-400/[0.1]"
        >
          交军机复用
        </Link>
      </div>
    </GlassPanel>
  );
}

function UnifiedMemoryPanel({
  buildLedgerCount,
  auditCount,
  knowledgeCount,
  lessons,
}: {
  buildLedgerCount: number;
  auditCount: number;
  knowledgeCount: number;
  lessons: ScribeLesson[];
}) {
  const latestLesson = lessons[0];
  const memorySources = [
    {
      id: "build-ledger",
      label: "建设台账",
      value: buildLedgerCount,
      detail: "工部任务进入军机复核后的交付记录",
    },
    {
      id: "audit",
      label: "独立审计",
      value: auditCount,
      detail: "身份、状态迁移、时间线与责任来源",
    },
    {
      id: "kernel",
      label: "经营案卷",
      value: OPERATING_KNOWLEDGE_SUMMARY.totalCases,
      detail: "目标、证据、进化基因和可复用判断",
    },
    {
      id: "lessons",
      label: "旧案教训",
      value: lessons.length,
      detail: "可召回的 patterns、tags 与 lessons",
    },
  ];

  return (
    <GlassPanel
      id="panel-unified-memory"
      title="统一记忆入口"
      eyebrow="Shiguan Memory Router"
    >
      <div className="rounded-xl border border-emerald-400/18 bg-emerald-400/[0.055] px-3 py-2 text-[11.5px] leading-5 text-jade-100/82">
        先把史馆拆散的记忆线收成一个入口：建设台账管发生了什么，独立审计管谁在何时做了什么，经营案卷管为什么值得复用，旧案教训管下次如何少走弯路。
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {memorySources.map((source) => (
          <div
            key={source.id}
            className="rounded-xl border border-gold-300/12 bg-white/[0.035] px-2.5 py-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[10px] text-slatey-400">{source.label}</div>
              <div className="font-serif text-[18px] font-semibold leading-none text-gold-gradient">
                {source.value}
              </div>
            </div>
            <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-jade-100/68">
              {source.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-gold-300/12 bg-black/15 px-2.5 py-2">
        <div className="text-[9.5px] uppercase tracking-[0.14em] text-gold-200/75">
          Recall Seed · 下次召回种子
        </div>
        {latestLesson ? (
          <div className="mt-1">
            <div className="line-clamp-1 text-[11.5px] font-semibold text-gold-100">
              {latestLesson.billTitle}
            </div>
            <div className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-slatey-300">
              {latestLesson.summary}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {latestLesson.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-emerald-400/18 bg-emerald-400/[0.055] px-1.5 py-0.5 text-[9px] text-emerald-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-1 text-[10.5px] leading-4 text-slatey-300">
            暂无旧案 lessons。下一步应从已归档任务抽取 lessons，再让上书房和工部在起草前召回。
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/scribe?tab=recall"
          className="rounded-lg border border-gold-300/24 bg-gold-300/[0.06] px-2.5 py-2 text-center text-[11px] text-gold-100 transition hover:bg-gold-300/[0.12]"
        >
          召回旧案
        </Link>
        <Link
          href="/shiguan"
          className="rounded-lg border border-emerald-400/22 bg-emerald-400/[0.055] px-2.5 py-2 text-center text-[11px] text-emerald-100 transition hover:bg-emerald-400/[0.1]"
        >
          查看 RAG
        </Link>
      </div>
    </GlassPanel>
  );
}

function ReleaseGateArchivePanel({ payload }: { payload: ReleaseGatePayload | null }) {
  const latest = payload?.latest ?? null;
  const audit = payload?.audit ?? [];
  const paths = payload?.paths ?? {};
  const screenshotSummary = latest?.evidence?.screenshotQaSummary ?? payload?.screenshotQa?.summary ?? null;
  const decision = latest?.decision ?? "MISSING";
  const decisionTone = decision === "SHIP"
    ? "border-emerald-400/30 bg-emerald-400/[0.09] text-emerald-100"
    : decision === "FIX"
      ? "border-rose-400/30 bg-rose-400/[0.09] text-rose-100"
      : "border-gold-300/30 bg-gold-300/[0.08] text-gold-100";
  const latestTime = latest?.finishedAt ?? latest?.startedAt ?? latest?.checkedAt;
  const total = latest?.summary?.total ?? latest?.stages?.length ?? 0;
  const passed = latest?.summary?.passed ?? latest?.stages?.filter((stage) => stage.status === "passed").length ?? 0;
  const durationLabel = formatDuration(latest?.summary?.durationMs);
  const screenshotPassed = screenshotSummary?.passed ?? screenshotSummary?.completed ?? 0;
  const screenshotTotal = screenshotSummary?.total ?? screenshotSummary?.completed ?? 0;
  const latestStages = latest?.stages ?? [];

  return (
    <GlassPanel
      id="panel-release-gates"
      title="发布可信战报"
      eyebrow="Release Evidence"
    >
      {!latest ? (
        <div className="rounded-xl border border-gold-300/16 bg-gold-300/[0.045] px-3 py-2 text-[11.5px] leading-5 text-gold-100/86">
          暂无发布战报；先运行 pnpm run harness:chaotang:gates，史馆会自动收录最新门禁、截图 QA 和独立审计 JSONL。
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-400/18 bg-emerald-400/[0.055] px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/80">
                  最新发布结论
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${decisionTone}`}>
                    {decision}
                  </span>
                  <span className="font-serif text-[18px] font-semibold leading-none text-gold-gradient">
                    {passed}/{total}
                  </span>
                  {durationLabel && (
                    <span className="text-[10.5px] text-slatey-300">
                      {durationLabel}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right text-[10px] leading-4 text-slatey-400">
                <div>{formatDateTime(latestTime)}</div>
                {latest.gitCommit && <div>{latest.gitCommit.slice(0, 8)}</div>}
              </div>
            </div>
            {latest.runId && (
              <div className="mt-2 truncate text-[10.5px] text-jade-100/72">
                runId · {latest.runId}
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <EvidenceMetric
              label="门禁"
              value={`${passed}/${total}`}
              detail={latest.summary?.failed ? `${latest.summary.failed} 项需修复` : "全部通过"}
            />
            <EvidenceMetric
              label="截图 QA"
              value={`截图 QA ${screenshotPassed}/${screenshotTotal}`}
              detail={`${screenshotSummary?.screenshotCount ?? screenshotTotal} 张截图留证`}
            />
          </div>

          <div className="mt-3 rounded-lg border border-gold-300/12 bg-black/15 px-2.5 py-2">
            <div className="mb-1.5 text-[9.5px] uppercase tracking-[0.14em] text-gold-200/75">
              Checked Gates · 用户可见证据
            </div>
            <div className="space-y-1.5">
              {latestStages.slice(0, 8).map((stage) => (
                <ReleaseGateStageRow key={stage.id} stage={stage} />
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-emerald-400/12 bg-emerald-400/[0.045] px-2.5 py-2">
            <div className="text-[9.5px] uppercase tracking-[0.14em] text-emerald-200/75">
              独立审计 JSONL
            </div>
            <div className="mt-1 text-[10.5px] leading-4 text-jade-100/78">
              {paths.releaseAudit ?? latest.evidence?.releaseReport ?? "dev/artifacts/chaotang-release-gates/release-audit.jsonl"}
            </div>
            <div className="mt-2 space-y-1">
              {audit.slice(0, 2).map((record) => (
                <div key={record.runId ?? record.checkedAt} className="flex items-center justify-between gap-2 text-[10px] text-slatey-300">
                  <span className="truncate">{record.decision ?? "UNKNOWN"} · {record.runId ?? "no-run"}</span>
                  <span className="shrink-0 text-slatey-400">{formatDateTime(record.checkedAt ?? record.finishedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </GlassPanel>
  );
}

function EvidenceMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-gold-300/12 bg-white/[0.035] px-2.5 py-2">
      <div className="text-[10px] text-slatey-400">{label}</div>
      <div className="mt-1 text-[12px] font-semibold leading-4 text-gold-100">{value}</div>
      <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-jade-100/68">{detail}</div>
    </div>
  );
}

function ReleaseGateStageRow({ stage }: { stage: ReleaseGateStage }) {
  const tone = stage.status === "passed"
    ? "border-emerald-400/22 bg-emerald-400/[0.07] text-emerald-100"
    : stage.status === "failed"
      ? "border-rose-400/24 bg-rose-400/[0.08] text-rose-100"
      : "border-gold-300/24 bg-gold-300/[0.07] text-gold-100";

  return (
    <div className="flex items-center justify-between gap-2 rounded border border-gold-300/10 bg-white/[0.025] px-2 py-1.5">
      <div className="min-w-0">
        <div className="truncate text-[10.5px] text-jade-100/82">{stage.id}</div>
        {stage.error && <div className="mt-0.5 truncate text-[9.5px] text-rose-100/82">{stage.error}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`rounded border px-1.5 py-0.5 text-[9px] ${tone}`}>
          {stage.status}
        </span>
        <span className="w-10 text-right text-[9.5px] text-slatey-400">
          {formatDuration(stage.durationMs)}
        </span>
      </div>
    </div>
  );
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0B";
  if (size < 1024) return `${Math.round(size)}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs < 0) return "";
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "暂无时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function KernelMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gold-300/12 bg-white/[0.03] px-2.5 py-2">
      <div className="text-[10px] text-slatey-400">{label}</div>
      <div className="mt-1 font-serif text-[20px] font-semibold leading-none text-gold-gradient">
        {value}
      </div>
    </div>
  );
}

function KnowledgeCaseCard({ item }: { item: KnowledgeCase }) {
  const firstGene = item.reusableGenes[0];
  const firstEvidence = item.evidence[0];

  return (
    <div className="rounded-xl border border-gold-300/12 bg-white/[0.035] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold text-gold-100">{item.title}</div>
          <div className="mt-1 text-[9.5px] uppercase tracking-[0.14em] text-slatey-400">
            {item.source} · {item.status}
            {item.targetDept ? ` · ${item.targetDept}` : ""}
          </div>
        </div>
        <span className="shrink-0 rounded border border-gold-300/20 bg-gold-300/[0.065] px-1.5 py-0.5 text-[9px] text-gold-200">
          {item.evidence.length} 证据
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-[10.8px] leading-5 text-jade-100/76">
        {item.businessGoal}
      </p>

      {firstEvidence && (
        <div className="mt-2 rounded-lg border border-gold-300/10 bg-black/15 px-2.5 py-2">
          <div className="text-[9.5px] uppercase tracking-[0.14em] text-gold-200/75">
            EvidenceBlock
          </div>
          <div className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-slatey-300">
            {firstEvidence.summary}
          </div>
        </div>
      )}

      {firstGene && (
        <div className="mt-2 rounded-lg border border-emerald-400/12 bg-emerald-400/[0.045] px-2.5 py-2">
          <div className="text-[9.5px] uppercase tracking-[0.14em] text-emerald-200/75">
            EvolutionGene
          </div>
          <div className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-jade-100/78">
            {firstGene.title}：{firstGene.trigger}
          </div>
        </div>
      )}
    </div>
  );
}

function DevelopmentArchivePanel({
  selectedCase,
  selectedTaskId,
  selectedMemorialId,
  buildLedger,
  buildLedgerAudit,
}: {
  selectedCase: string | null;
  selectedTaskId: string | null;
  selectedMemorialId: string | null;
  buildLedger: BuildLedgerEntry[];
  buildLedgerAudit: BuildLedgerAuditEvent[];
}) {
  const auditTrailForEntry = useCallback((entry: BuildLedgerEntry) => {
    const independentAudit = buildLedgerAudit
      .filter((event) => event.taskId === entry.taskId || event.id.includes(entry.taskId))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return independentAudit.length > 0
      ? { events: independentAudit, source: "independent" as const }
      : { events: entry.auditTrail ?? [], source: "embedded" as const };
  }, [buildLedgerAudit]);

  return (
    <GlassPanel title="工部开发复盘">
      <div className="mb-3 rounded-xl border border-gold-300/18 bg-gold-300/[0.045] px-3 py-2 text-[11.5px] leading-5 text-gold-100/90">
        工部建设任务在此沉淀目标、结果、证据、风险和下一步建议，后续反哺上书房每日建议。
      </div>
      {selectedTaskId && (
        <div className="mb-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/80">
            Junjichu Task Retrospective · 军机任务复盘草档
          </div>
          <div className="mt-1 text-[13px] font-semibold text-emerald-100">
            任务 {selectedTaskId.slice(0, 12)} 已送入史馆
          </div>
          <p className="mt-2 text-[11px] leading-5 text-jade-100/78">
            待沉淀：圣旨原文、会审过程、执行结果、奏折编号、风险证据、评分和下次建议。
            {selectedMemorialId ? ` 奏折编号：${selectedMemorialId.slice(0, 12)}。` : ''}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10.5px] text-slatey-300">
            <div className="rounded-lg border border-emerald-400/15 bg-black/15 px-2 py-1.5">
              状态 · 待补证据
            </div>
            <div className="rounded-lg border border-emerald-400/15 bg-black/15 px-2 py-1.5">
              下一步 · 反哺上书房
            </div>
          </div>
        </div>
      )}
      {buildLedger.length > 0 && (
        <div className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.055] p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/80">
            Build Ledger · 军机立项台账
          </div>
          <div className="mt-1 text-[13px] font-semibold text-emerald-100">
            已接收 {buildLedger.length} 条建设立项
          </div>
          <div className="mt-2 space-y-2">
            {buildLedger.slice(0, 3).map((entry) => {
              const assessment = assessBuildLedgerEntry(entry);
              const auditTrail = auditTrailForEntry(entry);
              const riskTone = assessment.riskLevel === "low" ? "text-emerald-100 border-emerald-400/20 bg-emerald-400/[0.07]" :
                assessment.riskLevel === "medium" ? "text-gold-100 border-gold-300/20 bg-gold-300/[0.07]" :
                  "text-rose-100 border-rose-400/20 bg-rose-400/[0.07]";
              return (
                <div
                  key={entry.id}
                  aria-label={`史馆建设台账 ${entry.taskId}`}
                  className="rounded-lg border border-emerald-400/15 bg-black/15 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11.5px] font-semibold text-jade-100">{entry.title}</div>
                      <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.12em] text-slatey-400">
                        任务 {entry.taskId.slice(0, 10)} · {new Date(entry.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] ${riskTone}`}>
                      {assessment.score} · {assessment.grade}
                    </span>
                  </div>
                  {entry.source && <div className="mt-1 text-[10px] text-gold-100/85">{entry.source}</div>}
                  <div className="mt-2">
                    <BuildLedgerObjectPassport entry={entry} tone="emerald" compact />
                  </div>
                  <div className="mt-1.5">
                    <BuildLedgerBackendTrace entry={entry} compact />
                  </div>
                  <div className="mt-1 text-[10px] text-emerald-100/85">
                    状态：{BUILD_LEDGER_STATUS_LABEL[entry.status]}
                  </div>
                  {entry.evidence.length > 0 && (
                    <div className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-slatey-300">
                      证据：{entry.evidence.join("；")}
                    </div>
                  )}
                  {auditTrail.events.length > 0 && (
                    <div className="mt-2 rounded border border-gold-300/12 bg-black/15 px-2 py-1.5">
                      <div className="text-[9.5px] uppercase tracking-[0.14em] text-gold-100/70">
                        状态时间线{auditTrail.source === "independent" ? " · 独立审计" : ""}
                      </div>
                      <div className="mt-1 grid gap-1">
                        {auditTrail.events.slice(-4).map((event) => (
                          <div key={event.id} className="text-[10.5px] leading-4 text-slatey-300">
                            {new Date(event.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · {event.actor} · {event.note}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 rounded border border-emerald-400/10 bg-black/15 px-2 py-1.5 text-[10.5px] leading-4 text-jade-100/78">
                    {assessment.nextSuggestion}
                  </div>
                  {assessment.riskNotes.length > 0 && (
                    <div className="mt-1 text-[10px] text-gold-100/75">
                      风险：{assessment.riskNotes.join("、")}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Link
                      href={`/command-center?taskId=${encodeURIComponent(entry.taskId)}`}
                      className="rounded border border-gold-300/24 bg-gold-300/[0.06] px-2 py-0.5 text-[10px] text-gold-100"
                    >
                      军机复核
                    </Link>
                    <Link
                      href="/departments"
                      className="rounded border border-emerald-400/18 bg-emerald-400/[0.05] px-2 py-0.5 text-[10px] text-emerald-100"
                    >
                      户部追踪
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="space-y-2.5">
        {DEPARTMENT_BUILD_TASKS.map((task) => {
          const active = selectedCase === task.id;
          const retrospective = BUILD_RETROSPECTIVES.find((item) => item.sourceBudgetId === task.id);
          return (
            <div
              key={task.id}
              id={`dev-archive-${task.id}`}
              className={`rounded-xl border bg-white/[0.035] p-3 transition ${active ? "shiguan-pulse-gold border-gold-300/45" : "border-gold-300/12"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold leading-5 text-gold-100">{task.title}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slatey-400">
                    {task.targetDept} · {task.priority} · {BUILD_STATUS_LABEL[task.status]}
                  </div>
                </div>
                <span className="shrink-0 rounded border border-gold-300/22 bg-gold-300/[0.07] px-1.5 py-0.5 text-[9px] text-gold-200">
                  {retrospective ? `${retrospective.score} · ${retrospective.grade}` : "复盘草档"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-jade-100/78">
                {retrospective?.outcome ?? task.businessGoal}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10.5px] text-slatey-300">
                <div className="rounded-lg border border-gold-300/10 bg-black/15 px-2 py-1.5">
                  验收 · {task.acceptanceCriteria.length} 条
                </div>
                <div className="rounded-lg border border-gold-300/10 bg-black/15 px-2 py-1.5">
                  面板 · {task.requiredPanels.length} 个
                </div>
              </div>
              {retrospective && (
                <div className="mt-2 rounded-lg border border-gold-300/10 bg-black/15 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-gold-200/80">证据链</div>
                  <ul className="mt-1.5 space-y-1">
                    {retrospective.evidence.slice(0, 3).map((item) => (
                      <li key={item} className="text-[10.5px] leading-4 text-slatey-300">· {item}</li>
                    ))}
                  </ul>
                  <div className="mt-2 border-t border-gold-300/10 pt-2 text-[10.5px] leading-4 text-jade-100/78">
                    下次建议：{retrospective.nextSuggestion}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={task.nextHref}
                  className="rounded border border-gold-300/28 bg-gold-300/[0.07] px-2 py-1 text-[10.5px] text-gold-100 transition hover:bg-gold-300/[0.12]"
                >
                  军机复核
                </Link>
                <Link
                  href="/departments"
                  className="rounded border border-[#6BA0FF]/28 bg-[#6BA0FF]/[0.07] px-2 py-1 text-[10.5px] text-[#9FC1FF] transition hover:bg-[#6BA0FF]/[0.12]"
                >
                  回工部
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

/* ---------- 中央标题装饰 ---------- */
function Ornament({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="68"
      height="20"
      viewBox="0 0 68 20"
      fill="none"
      className={flip ? "scale-x-[-1]" : ""}
      aria-hidden
    >
      <path
        d="M2 10h34c6 0 8-3 12-6 3 4 7 4 11 2-3 5-8 6-12 4-4-2-6-4-10-4H2z"
        stroke="rgba(220,180,86,0.7)"
        strokeWidth="1.2"
        fill="rgba(220,180,86,0.08)"
      />
      <circle cx="60" cy="8" r="2" fill="#e3c074" />
    </svg>
  );
}

/* ---------- 左列：搜索与追问 ---------- */
function SearchPanel() {
  return (
    <GlassPanel title="搜索与追问">
      <div className="flex items-center gap-2 rounded-xl border border-gold-300/18 bg-black/25 px-3 py-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="rgba(220,180,86,0.7)" strokeWidth="1.6" />
          <path d="M20 20l-3.5-3.5" stroke="rgba(220,180,86,0.7)" strokeWidth="1.6" />
        </svg>
        <input
          className="w-full bg-transparent text-[13px] text-jade-100 placeholder:text-slatey-400 focus:outline-none"
          placeholder="搜索奏折、决策、任务、知识…"
        />
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" stroke="rgba(220,180,86,0.6)" strokeWidth="1.5" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="rgba(220,180,86,0.6)" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="mb-2.5 mt-3 flex items-center justify-between">
        <span className="text-[12px] text-slatey-300">热门追问</span>
        <button
          type="button"
          className="text-[12px] text-gold-200/90 transition-colors hover:text-gold-100"
        >
          换一组 ⟲
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {searchSuggestions.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-lg border border-gold-300/15 bg-white/[0.03] px-2.5 py-2 text-left text-[11.5px] leading-snug text-jade-100/85 transition-colors hover:border-gold-300/40 hover:text-gold-100"
          >
            {s}
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}

/* ---------- 左列：数据概览（Turso 驱动） ---------- */
function DataOverview({
  highlight,
  totalTasks,
  totalCases,
  successRate,
  knowledgeCount,
  govCount,
}: {
  highlight?: boolean;
  totalTasks?: number;
  totalCases?: number;
  successRate?: number;
  knowledgeCount?: number;
  govCount?: number;
}) {
  const cells = [
    { label: "档案总数", value: totalTasks != null ? String(totalTasks) : "—", unit: "件", glyph: "卷" },
    { label: "已结案", value: totalCases != null ? String(totalCases) : "—", unit: "件", glyph: "玺" },
    { label: "治理决策", value: govCount != null ? String(govCount) : "—", unit: "条", glyph: "典" },
    { label: "成功率", value: successRate != null ? String(successRate) : "—", unit: "%", glyph: "鉴" },
    { label: "知识条目", value: knowledgeCount ? String(knowledgeCount) : "—", unit: "条", glyph: "藏" },
    { label: "建设复盘", value: String(BUILD_RETROSPECTIVE_SUMMARY.total), unit: "次", glyph: "镜" },
  ];

  return (
    <GlassPanel
      id="panel-overview"
      title="数据概览"
      className={highlight ? "shiguan-pulse-gold" : ""}
    >
      <div className="grid grid-cols-2 gap-2.5">
        {cells.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-2.5 rounded-xl border border-gold-300/12 bg-white/[0.025] px-3 py-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold-300/25 bg-gold-300/10 font-serif text-[13px] text-gold-200">
              {c.glyph}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-slatey-400">{c.label}</p>
              <p className="flex items-baseline gap-0.5">
                <span className="font-serif text-[17px] font-semibold leading-none text-gold-gradient">
                  {c.value}
                </span>
                <span className="text-[10px] text-slatey-400">{c.unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
