"use client";

import { useMemo, useRef, useState } from "react";
import {
  Archive,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Telescope,
  Workflow,
} from "lucide-react";
import useSWR from "swr";
import { SECRECY, TONES, QUICK_SUMMONS } from "@/features/dadian/lib/dadian";
import QuickActionButton from "./QuickActionButton";
import MinisterCard from "./MinisterCard";
import { withBasePath } from "@/lib/base-path";
import type {
  DadianFeedItem,
  DadianFeedResponse,
  DadianPulseData,
  OrchestrationResult,
} from "@/lib/contracts/dadian";

type AdvisoryBrief = {
  id: string;
  label: string;
  brief: string;
  advice: string;
  detail: string;
};

const DEFAULT_DECREE = [
  "战略大势：2026 年的关键不是多开战线，而是把一个高价值闭环跑通、可复盘、可复制。",
  "今日一裁：先把上书房定为每日经营入口，只呈一件最该裁的事。",
  "锦衣卫急报：凡无来源、无时效、无责任部门的信号，不上首页，只入待补证。",
].join("\n");

async function feedFetcher(url: string): Promise<DadianFeedResponse> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const json = (await res.json()) as { success: boolean; data: DadianFeedResponse };
  return json.data;
}

async function pulseFetcher(url: string): Promise<DadianPulseData> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`pulse ${res.status}`);
  const json = (await res.json()) as { success: boolean; data: DadianPulseData };
  return json.data;
}

async function runOrchestration(
  command: string,
  onProgress: (stage: string) => void,
): Promise<OrchestrationResult> {
  const res = await fetch(withBasePath("/api/orchestration/run"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok || !res.body) throw new Error(`orchestration HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: OrchestrationResult | null = null;
  const startedAt = Date.now();

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let eventType = "";
      let dataPart = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        if (line.startsWith("data:")) dataPart = line.slice(5).trim();
      }
      const stageLabel: Record<string, string> = {
        retrieve: "检索史官记忆...",
        zhongshu: "中书省起草...",
        menxia: "门下省审议...",
        shangshu: "尚书省颁布...",
        persist: "归档记录...",
        pipeline_done: "旨意发布完成",
      };
      if (eventType && eventType !== "open" && eventType !== "eof") {
        onProgress(stageLabel[eventType] ?? eventType);
      }
      if ((eventType === "pipeline_done" || eventType === "shangshu") && dataPart) {
        try {
          const payload = JSON.parse(dataPart) as Record<string, unknown>;
          result = {
            taskId: payload.taskId as string | undefined,
            command,
            summary: (payload.summary as string) || "旨意已发布，三省正在审议",
            citations: (payload.citations as OrchestrationResult["citations"]) ?? [],
            toolResults: (payload.toolResults as OrchestrationResult["toolResults"]) ?? [],
            dispatchedTo: (payload.dispatchedTo as string[]) ?? [],
            durationMs: Date.now() - startedAt,
            completedAt: new Date().toISOString(),
          };
        } catch {
          // Ignore partial SSE parse errors; final fallback still confirms submission.
        }
      }
    }
  }

  return (
    result ?? {
      taskId: undefined,
      command,
      summary: "旨意已提交三省，审议完毕",
      citations: [],
      toolResults: [],
      dispatchedTo: [],
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
    }
  );
}

export default function CommandPanel() {
  const [tone, setTone] = useState<string>(TONES[0]);
  const [secrecy, setSecrecy] = useState<string>(SECRECY[0]);
  const [commandText, setCommandText] = useState(DEFAULT_DECREE);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OrchestrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: pulse, error: pulseError } = useSWR<DadianPulseData>(
    withBasePath("/api/court/dadian/pulse"),
    pulseFetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const { data: feedData, error: feedError } = useSWR<DadianFeedResponse>(
    withBasePath("/api/court/dadian/feed"),
    feedFetcher,
    { refreshInterval: 15_000, revalidateOnFocus: false },
  );

  const feedItems: DadianFeedItem[] = feedData?.items ?? [];
  const degraded = Boolean(pulseError) || pulse?.source === "fallback";
  const riskCount = pulse?.riskCount ?? 0;
  const runningCount = pulse?.activeTasks ?? 0;
  const pendingCount = pulse?.pendingDecisions ?? 0;
  const topFeed = feedItems[0];
  const feedSourceLabel = feedError
    ? "稍后补录"
    : feedData?.source === "fallback"
      ? "演示动态"
      : "实时动态";

  const statusLabel = degraded
    ? "外廷回声偏弱，可先下旨"
    : riskCount > 0
      ? `${riskCount} 项风险待看`
      : pendingCount > 0
        ? `${pendingCount} 件待裁`
        : runningCount > 0
          ? `${runningCount} 路执行中`
          : "今日正常";

  const astronomerReading = degraded
    ? "钦天监提示：外廷回声偏弱，仍可先下旨；涉及真案时需补证据链。"
    : riskCount > 0
      ? "钦天监提示：有风险信号，建议下旨时要求锦衣卫先补证。"
      : "钦天监候星：当前适合下旨，先让丞相拆解，再由军机追踪。";

  const chancellorBriefs: AdvisoryBrief[] = useMemo(() => {
    const todayTitle = topFeed?.title ?? "上书房只呈今日最该裁的一件事";
    return [
      {
        id: "today-ruling",
        label: "今日一裁",
        brief: todayTitle,
        advice: "准奏：让丞相先裁优先级，再分派六部。",
        detail: [
          "今日一裁：上书房只呈一件最该裁的事。",
          `丞相判断：${todayTitle}`,
          "建议：先确认目标、责任部门、验收证据；其余信息后置到六部细档。",
        ].join("\n"),
      },
      {
        id: "one-thing",
        label: "唯一动作",
        brief: "把老板要做的事压成一句圣旨",
        advice: "不要先开配置；先问丞相该不该做。",
        detail: "唯一动作：把今天最重要的经营问题写成一句圣旨。丞相只回裁断、理由、责任部门和下一步。",
      },
      {
        id: "evidence",
        label: "验收证据",
        brief: "每个建议必须带来源、时效、归档去处",
        advice: "无证据不上首页，先入待补证。",
        detail: "验收证据：每条建议都必须说明为什么出现、谁负责、凭什么判断、下一步去哪办。",
      },
      {
        id: "handoff",
        label: "流转",
        brief: "准奏后自动去工部、户部、军机处、史馆",
        advice: "用户只看朝堂运转，不看工程配置。",
        detail: "流转：准奏后生成任务、责任部门、验收证据和史馆归档；细节在相关部门展开。",
      },
      {
        id: "stop-doing",
        label: "不做",
        brief: "主页不堆蜂群日志、模型状态、长报告",
        advice: "首屏越少，裁断越强。",
        detail: "不做：企业家主页不展示蜂群内部日志、模型状态、长报告和配置项；需要细化时再进六部。",
      },
    ].slice(0, 5);
  }, [topFeed]);

  const qintianBriefs: AdvisoryBrief[] = useMemo(() => {
    const riskBrief = riskCount > 0 ? `${riskCount} 条风险信号待补证` : "当前无急迫红灯，先跑主线闭环";
    return [
      {
        id: "strategic-trend",
        label: "战略大势",
        brief: "先做一个可复制闭环，再扩大部门和蜂群",
        advice: "本周不扩功能，先让上书房每日能裁一件事。",
        detail: "战略大势：2026 年的关键不是堆页面，而是让上书房每天产出一件可执行、可验收、可归档的经营裁断。",
      },
      {
        id: "timing",
        label: "时机",
        brief: degraded ? "外廷回声偏弱，仍可先下旨" : "当前适合下旨，让丞相收束",
        advice: "先把真案压成一句话，再补证据链。",
        detail: astronomerReading,
      },
      {
        id: "jinyiwei",
        label: "锦衣卫",
        brief: riskBrief,
        advice: "只把有来源、有时效、有责任部门的信号放进圣旨。",
        detail: `锦衣卫急报：${riskBrief}。建议：无来源信号不上首页，先送锦衣卫补证；高风险信号再交丞相裁断。`,
      },
      {
        id: "forecast",
        label: "推演",
        brief: "钦天监只给阈值、变量、尾部风险",
        advice: "避免占卜式结论，给可证伪条件。",
        detail: "推演：钦天监必须说明触发阈值、关键变量、不变量和尾部风险；更细的情景树放到钦天监板块。",
      },
      {
        id: "archive",
        label: "复盘",
        brief: "每次准奏都要能回看依据和结果",
        advice: "史馆归档是让系统不像套壳的证据。",
        detail: "复盘：每道圣旨都归档判断、证据、责任部门、结果和下次学习点；用户可看实现，但不用改流程。",
      },
    ].slice(0, 5);
  }, [astronomerReading, degraded, riskCount]);

  const chancellorReading = useMemo(() => {
    const text = commandText.trim();
    if (!text) return "臣先候旨。写下一句话后，我会拆目标、责任部门、验收证据。";
    if (text.length < 12) return "旨意偏短，臣建议补上对象、期限或验收标准。";
    return "臣可据此拆成任务：先定目标，再分派六部，最后交史馆归档证据。";
  }, [commandText]);

  async function handleSubmit() {
    const cmd = commandText.trim();
    if (cmd.length < 5) {
      setError("旨意至少 5 字");
      return;
    }
    setError(null);
    setSubmitting(true);
    setStage("提交中...");
    setLastResult(null);
    try {
      const res = await runOrchestration(cmd, setStage);
      setLastResult(res);
      setCommandText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "下旨失败，请重试");
    } finally {
      setSubmitting(false);
      setStage(null);
    }
  }

  function applyBrief(brief: AdvisoryBrief | undefined) {
    if (!brief) return;
    setCommandText(brief.detail.slice(0, 320));
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handlePolish() {
    const text = commandText.trim();
    const base = text.length > 0 ? text : "请丞相先判断今日最该处理的一件经营大事。";
    const polished = base.includes("战略大势") || base.includes("今日一裁")
      ? base
      : [
          `战略大势：${base}`,
          "今日一裁：只呈一件最该先处理的事，明确责任部门与截止时间。",
          "验收证据：每项建议必须带来源、时效、责任人、归档去处。",
        ].join("\n");
    setCommandText(polished.slice(0, 320));
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  return (
    <section className="absolute bottom-[104px] left-1/2 top-[146px] z-30 w-[min(1260px,calc(100%-40px))] -translate-x-1/2 animate-fade-up overflow-y-auto rounded-[8px] border border-[#F0C66A]/24 bg-[linear-gradient(180deg,rgba(8,13,25,0.78),rgba(3,7,16,0.88))] shadow-[0_30px_90px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl max-md:bottom-[102px] max-md:top-[112px] max-md:w-[calc(100%-24px)]">
      <span aria-hidden className="absolute left-3 top-3 h-3 w-3 border-l border-t border-[#F0C66A]/54" />
      <span aria-hidden className="absolute right-3 top-3 h-3 w-3 border-r border-t border-[#F0C66A]/54" />
      <span aria-hidden className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-[#F0C66A]/32" />
      <span aria-hidden className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-[#F0C66A]/32" />
      <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/70 to-transparent" />

      <div className="relative border-b border-[#F0C66A]/14 px-4 py-3 md:px-6 md:py-4">
        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8F835F]">
              Daily Court Decision · 今日圣裁
            </p>
            <h2 className="mt-1 text-[18px] font-semibold tracking-wide text-gold-200 md:text-[22px]">
              一句话下旨，丞相拆解，钦天监校时
            </h2>
            <p className="mt-1 max-w-[76ch] text-[12px] leading-5 text-parchment-200/58">
              首屏只保留一个裁断入口：写明目标、责任、证据，系统再分流给六部与史馆。
            </p>
          </div>
          <div className="grid min-w-[min(100%,430px)] grid-cols-3 gap-2">
            <SystemMetric icon={<ShieldCheck size={14} />} label="待裁" value={`${pendingCount}`} tone={degraded ? "warn" : "gold"} />
            <SystemMetric icon={<Workflow size={14} />} label="在办" value={`${runningCount}`} tone="blue" />
            <SystemMetric icon={<Archive size={14} />} label="风险" value={`${riskCount}`} tone={riskCount > 0 ? "warn" : "green"} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className={`rounded-[6px] border px-3 py-1.5 text-[12px] ${degraded ? "border-ember-400/35 bg-ember-400/10 text-ember-400" : "border-jade-400/28 bg-jade-400/10 text-jade-400"}`}>
            {statusLabel}
          </div>
          <div className="rounded-[6px] border border-[#F0C66A]/14 bg-black/18 px-3 py-1.5 text-[12px] text-parchment-200/62">
            {feedSourceLabel}
          </div>
        </div>
      </div>

      <div className="relative grid gap-4 p-4 md:grid-cols-[230px_minmax(0,1fr)_230px] md:p-6 xl:grid-cols-[270px_minmax(0,1fr)_270px]">
        <AdvisorPanel
          eyebrow="Prime Minister · 丞相"
          title="丞相简讯"
          body={chancellorReading}
          briefs={chancellorBriefs}
          tone="gold"
          onSelect={(brief) => setCommandText(brief.detail)}
          className="order-2 md:order-none"
        />

        <div className="order-1 min-w-0 rounded-[8px] border border-[#F0C66A]/24 bg-[linear-gradient(180deg,rgba(6,10,20,0.92),rgba(2,5,12,0.96))] p-4 shadow-[0_18px_54px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(240,198,106,0.13)] md:order-none md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#F0C66A]">
                <BrainCircuit size={14} />
                Imperial Decree · 圣旨主体
              </div>
              <div className="mt-1 text-[12px] text-parchment-200/62">
                第一行看大势，第二行看今日一裁，第三行看锦衣卫信号
              </div>
            </div>
            <span className="rounded border border-[#F0C66A]/18 bg-black/18 px-2 py-1 text-[10px] text-parchment-200/55">
              {commandText.length}/320
            </span>
          </div>

          <textarea
            ref={textareaRef}
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder={DEFAULT_DECREE}
            maxLength={320}
            rows={7}
            disabled={submitting}
            className="min-h-[170px] w-full resize-none rounded-[6px] border border-[#F0C66A]/22 bg-[linear-gradient(180deg,rgba(244,231,192,0.06),rgba(4,8,20,0.9))] px-4 py-3 text-[15px] leading-7 text-parchment-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition placeholder:text-parchment-200/38 focus:border-[#F0C66A]/55 focus:bg-[#040814]/95 disabled:opacity-50 md:min-h-[190px] md:text-[16px] lg:min-h-[210px]"
          />

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <SegGroup title="语气选择" items={TONES} selected={tone} onSelect={setTone} />
            <SegGroup title="秘密级别" items={SECRECY} selected={secrecy} onSelect={setSecrecy} />
          </div>

          {error && (
            <p className="mt-3 rounded border border-ember-400/30 bg-ember-400/10 px-3 py-2 text-micro text-ember-400">
              {error}
            </p>
          )}
          {stage && <p className="mt-3 animate-pulse text-micro text-jade-400">{stage}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || commandText.trim().length < 5}
              className="group relative inline-flex min-h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-[6px] border border-[#F5DE96]/72 bg-gold-btn px-5 py-3 text-[14px] font-semibold text-ink-900 shadow-gold-btn transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 md:text-[15px]"
            >
              <span className="absolute inset-0 translate-x-[-120%] skew-x-[-18deg] bg-white/35 transition duration-700 group-hover:translate-x-[120%]" />
              <SendHorizontal size={16} className="relative" />
              <span className="relative">{submitting ? "三省审议中..." : "发布今日旨意"}</span>
            </button>
            <SecondaryAction icon={<MessageSquareText size={14} />} label="问丞相" tone="gold" onClick={() => applyBrief(chancellorBriefs[0])} />
            <SecondaryAction icon={<Telescope size={14} />} label="问钦天监" tone="blue" onClick={() => applyBrief(qintianBriefs[0])} />
            <SecondaryAction icon={<Sparkles size={14} />} label="AI 润色" onClick={handlePolish} />
          </div>

          {lastResult && (
            <div className="mt-4 rounded border border-jade-400/20 bg-jade-400/5 p-3">
              <p className="mb-1 text-micro font-medium text-jade-400">旨意已发布</p>
              <p className="text-micro leading-relaxed text-parchment-200/70">{lastResult.summary}</p>
            </div>
          )}
        </div>

        <AdvisorPanel
          eyebrow="Astronomer · 钦天监"
          title="战略与大势"
          body={astronomerReading}
          briefs={qintianBriefs}
          tone="blue"
          onSelect={(brief) => setCommandText(brief.detail)}
          className="order-3 md:order-none"
        />
      </div>

      <div className="grid gap-3 border-t border-[#F0C66A]/12 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:px-6">
        <div className="grid gap-2 md:grid-cols-3">
          <DecisionStep label="先处理什么" value={topFeed?.title ?? "把今天最重要的问题写成一句旨意"} />
          <DecisionStep label="谁负责" value={topFeed?.depts?.join("、") ?? "丞相先拆，六部承办"} />
          <DecisionStep label="下一步" value="发布旨意或继续上次任务" />
        </div>
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] border border-[#F0C66A]/24 bg-black/16 px-4 py-2 text-[12px] text-gold-200 transition hover:border-[#F0C66A]/45 hover:bg-[#F0C66A]/8"
        >
          {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {detailsOpen ? "收起细目" : "展开六部与动态"}
        </button>
      </div>

      {detailsOpen && (
        <div className="grid gap-4 border-t border-[#F0C66A]/12 px-4 py-4 md:grid-cols-2 md:px-6">
          <section>
            <h3 className="mb-2 text-base2 font-medium tracking-wide text-gold-200/90">快捷召集</h3>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_SUMMONS.map((q) => <QuickActionButton key={q} label={q} />)}
            </div>
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-base2 font-medium tracking-wide text-gold-200/90">最新动态</h3>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${feedError ? "border-ember-400/30 bg-ember-400/10 text-ember-400" : "border-jade-400/24 bg-jade-400/8 text-jade-400"}`}>
                {feedSourceLabel}
              </span>
            </div>
            <div className="grid gap-2">
              {feedItems.length === 0 ? (
                <p className="text-micro text-parchment-200/45">暂无动态</p>
              ) : (
                feedItems.slice(0, 3).map((f) => <MinisterCard key={f.id} item={f} />)
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function SystemMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "gold" | "blue" | "green" | "warn";
}) {
  const color =
    tone === "gold"
      ? "#F0C66A"
      : tone === "blue"
        ? "#6BA0FF"
        : tone === "green"
          ? "#3DD68C"
          : "#F5A524";

  return (
    <div
      className="min-h-[58px] rounded-[6px] border bg-black/20 px-3 py-2"
      style={{ borderColor: `${color}38` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8F835F]">
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="mt-1 font-mono text-[20px] font-semibold leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SecondaryAction({
  icon,
  label,
  tone = "plain",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "gold" | "blue" | "plain";
  onClick: () => void;
}) {
  const color = tone === "gold" ? "#F0C66A" : tone === "blue" ? "#6BA0FF" : "#D6DEEF";
  const border = tone === "plain" ? "rgba(255,255,255,0.12)" : `${color}3d`;
  const bg = tone === "plain" ? "rgba(255,255,255,0.035)" : `${color}14`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-12 items-center gap-2 rounded-[6px] border px-4 py-3 text-[12px] transition hover:brightness-110"
      style={{ borderColor: border, background: bg, color }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AdvisorPanel({
  eyebrow,
  title,
  body,
  briefs,
  tone,
  onSelect,
  className = "",
}: {
  eyebrow: string;
  title: string;
  body: string;
  briefs: AdvisoryBrief[];
  tone: "gold" | "blue";
  onSelect: (brief: AdvisoryBrief) => void;
  className?: string;
}) {
  const accent = tone === "gold" ? "#F0C66A" : "#6BA0FF";
  return (
    <aside className={`rounded-lg border border-white/[0.08] bg-black/22 p-3 max-md:py-2.5 md:p-4 ${className}`}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
        {eyebrow}
      </div>
      <h3 className="mt-2 text-[15px] font-semibold text-parchment-50 max-md:mt-1 max-md:text-[14px]">{title}</h3>
      <p className="mt-2 text-[12px] leading-6 text-parchment-200/72 max-md:mt-1 max-md:max-h-10 max-md:overflow-hidden max-md:leading-5">{body}</p>
      <div className="mt-3 grid gap-2">
        {briefs.slice(0, 5).map((brief, index) => (
          <button
            key={brief.id}
            type="button"
            onClick={() => onSelect(brief)}
            className="rounded-md border bg-black/14 p-2 text-left transition hover:bg-white/[0.055]"
            style={{ borderColor: index === 0 ? `${accent}55` : "rgba(255,255,255,0.09)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold tracking-[0.16em]" style={{ color: accent }}>
                {brief.label}
              </span>
              {index === 0 && <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-parchment-200/50">首位</span>}
            </div>
            <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-parchment-100">{brief.brief}</div>
            <div className="mt-1 line-clamp-1 text-[11px] text-parchment-200/52">{brief.advice}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function DecisionStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#F0C66A]/12 bg-black/18 px-3 py-2">
      <div className="text-[10px] tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className="mt-1 truncate text-[12px] text-parchment-100">{value}</div>
    </div>
  );
}

function SegGroup({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-micro text-parchment-200/60">{title}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((it) => {
          const active = it === selected;
          return (
            <button
              key={it}
              type="button"
              onClick={() => onSelect(it)}
              className={`cursor-pointer rounded-[3px] border py-1.5 text-center text-micro transition ${
                active
                  ? "border-royal-400 bg-royal-600/62 text-white"
                  : "border-gold-400/14 bg-ink-800/24 text-parchment-100/70 hover:border-gold-400/40"
              }`}
            >
              {it}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
      <path
        d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6L8 1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
