"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ActionButton from "./ActionButton";
import {
  IconRocket,
  IconNew,
  IconUsers,
  IconSearch,
  IconFund,
  IconScroll,
  IconHandshake,
} from "./Glyphs";
import { DataState } from "@/components/DataState";
import { chaotang } from "@/lib/api/chaotang";
import type { GroupSubagent, GroupSubagents } from "@/lib/contracts/manor";
import type { CategorySelection } from "@/lib/contracts/decree";

// ── 快捷操作 → 下旨模板预填（点击进 compose，走真实 decreeDraft→dispatch） ──────
// 不再是 # 死链：每个快捷给一个圣旨起手模板，落到统一下旨闭环（KP-4）。

interface Quick { label: string; icon: ReactNode; template: string }
const QUICK: Quick[] = [
  { label: "新建项目", icon: <IconNew />,       template: "新建项目：" },
  { label: "拓展客户", icon: <IconUsers />,     template: "拓展客户：" },
  { label: "资源寻源", icon: <IconSearch />,    template: "资源寻源：" },
  { label: "资金申请", icon: <IconFund />,      template: "申请资金：" },
  { label: "政策申报", icon: <IconScroll />,    template: "申报政策：" },
  { label: "合作洽谈", icon: <IconHandshake />, template: "合作洽谈：" },
];

// ── 六部 key → 功能组 groupId 映射（D19） ─────────────────────────────────────
const DEPT_GROUP_MAP: Record<string, string> = {
  hubu:   "finlaw",
  xingbu: "finlaw",
  libu2:  "content",
  gongbu: "rnd",
  bingbu: "exec",
  libu:   "exec",
};

// ── subagent status → 中文标签 + 颜色 ────────────────────────────────────────

function statusLabel(s: string): string {
  if (s === "running") return "在跑";
  if (s === "idle") return "闲";
  if (s === "done" || s === "success" || s === "completed") return "已结";
  if (s === "failed" || s === "error") return "失败";
  if (s.startsWith("block")) return "阻";
  return s;
}
function statusColor(s: string): string {
  if (s === "running") return "#6BA0FF";
  if (s === "done" || s === "success" || s === "completed") return "#5FB37A";
  if (s === "failed" || s === "error") return "#FB7185";
  if (s === "idle") return "#4A5272";
  return "#FB923C";
}

/** 去掉 "### 子任务 N：" 之类的解析前缀，还原干净文案 */
function cleanText(t: string | undefined): string {
  return (t || "").replace(/^#{1,6}\s*子任务\s*\d+\s*[：:]?\s*/u, "").trim();
}

const clamp = (lines: number) =>
  ({
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  });

// ── 单个 subagent 卡 ──────────────────────────────────────────────────────────

function SubagentCard({ sa, accentColor }: { sa: GroupSubagent; accentColor: string }) {
  const sc = statusColor(sa.status);
  const task = cleanText(sa.task) || cleanText(sa.taskTitle) || "（待分配任务）";
  const summaryRaw = cleanText(sa.summary);
  // 去重：summary 与 task 高度重叠时不再重复展示
  const summary =
    summaryRaw && summaryRaw !== task && !task.startsWith(summaryRaw.slice(0, 24)) && !summaryRaw.startsWith(task.slice(0, 24))
      ? summaryRaw
      : "";

  return (
    <div
      style={{
        borderRadius: 8,
        padding: "8px 10px",
        background: "linear-gradient(155deg, rgba(10,15,34,0.94) 0%, rgba(6,9,20,0.96) 100%)",
        border: `1px solid ${accentColor}28`,
        boxShadow: `inset 0 1px 0 ${accentColor}10`,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* 顶行：id 截断 + 状态 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: "#4A5272", fontVariantNumeric: "tabular-nums" }}>
          {sa.id.slice(0, 10)}…
        </span>
        <span
          style={{
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 3,
            border: `1px solid ${sc}55`,
            color: sc,
            background: `${sc}0e`,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {statusLabel(sa.status)}
        </span>
      </div>

      {/* task 描述（限 3 行，统一卡高） */}
      <div
        title={task}
        style={{ fontSize: 11, color: "#F5E9C9", fontFamily: "var(--font-serif)", lineHeight: 1.45, marginBottom: summary ? 4 : 6, ...clamp(3) }}
      >
        {task}
      </div>

      {/* summary（仅当与 task 不重复时，限 2 行） */}
      {summary && (
        <div title={summary} style={{ fontSize: 10, color: "#6A7299", lineHeight: 1.4, marginBottom: 6, ...clamp(2) }}>
          {summary}
        </div>
      )}

      {/* 入口：有 taskId → 进军机处实时流；无则明确标"已归档·无实时流"（非缺失按钮） */}
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
        {sa.taskId ? (
          <Link
            href={`/junjichu?taskId=${encodeURIComponent(sa.taskId)}`}
            style={{
              fontSize: 10,
              color: accentColor,
              fontFamily: "var(--font-serif)",
              textDecoration: "none",
              padding: "2px 7px",
              borderRadius: 4,
              border: `1px solid ${accentColor}44`,
              background: `${accentColor}0a`,
            }}
          >
            进入任务 →
          </Link>
        ) : (
          <span
            style={{
              fontSize: 9,
              color: "#4A5272",
              padding: "2px 7px",
              borderRadius: 4,
              border: "1px solid rgba(74,82,114,0.3)",
            }}
          >
            已归档 · 无实时流
          </span>
        )}
      </div>
    </div>
  );
}

// ── 蜂群集群区块 ─────────────────────────────────────────────────────────────

function SwarmClusterBlock({
  deptKey,
  deptTitle,
  deptColor,
}: {
  deptKey: string | null;
  deptTitle: string | null;
  deptColor: string;
}) {
  const [data, setData] = useState<GroupSubagents | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const groupId = deptKey ? (DEPT_GROUP_MAP[deptKey] ?? null) : null;

  const load = useCallback(() => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    chaotang.groupSubagents(groupId)
      .then((d) => setData(d))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // 有实时流（taskId）的 subagent 排前，让入口可见者不被埋没
  const subagents = useMemo(() => {
    const arr = data?.subagents ?? [];
    return [...arr].sort((a, b) => (b.taskId ? 1 : 0) - (a.taskId ? 1 : 0));
  }, [data]);

  // 未选中部门 → 空态提示
  if (!deptKey) {
    return (
      <div
        style={{
          borderRadius: 8,
          padding: "16px 10px",
          background: "rgba(6,9,20,0.55)",
          border: "1px solid rgba(240,198,106,0.1)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>🏛</div>
        <div style={{ fontSize: 11, color: "#6A7299", lineHeight: 1.6, fontFamily: "var(--font-serif)" }}>
          点击部门查看业务集群
        </div>
        <div style={{ fontSize: 10, color: "#4A5272", marginTop: 4 }}>
          选中某部门卡片，查看真实在跑 subagent
        </div>
      </div>
    );
  }

  if (!groupId) {
    return (
      <div style={{ textAlign: "center", padding: "12px", fontSize: 11, color: "#6A7299" }}>
        该部门暂无独立蜂群编制
      </div>
    );
  }

  const groupName = data?.groupName ?? groupId;

  return (
    <div>
      {/* 标题 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.18em", color: deptColor, textTransform: "uppercase", marginBottom: 2 }}>
            SWARM CLUSTER · 蜂群集群
          </div>
          <div style={{ fontSize: 13, fontFamily: "var(--font-serif)", color: "#F5E9C9", fontWeight: 600 }}>
            {deptTitle} · {groupName} 蜂群集群
          </div>
        </div>
        {!loading && !error && data && (
          <span style={{ fontSize: 9, color: "#4A5272" }}>
            {subagents.length}/{data.subagentMax}
          </span>
        )}
      </div>

      {/* 滚动区 */}
      <div style={{ maxHeight: 368, overflowY: "auto" }}>
        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && subagents.length === 0}
          emptyMessage="该组暂无在跑 subagent，待下旨派活"
          onRetry={load}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {subagents.map((sa, idx) => (
              // subagent id(如 rnd-1)跨多 run 重复 → 拼 index 保证 key 唯一
              <SubagentCard key={`${sa.taskId || "norun"}-${sa.id}-${idx}`} sa={sa} accentColor={deptColor} />
            ))}
          </div>
        </DataState>
      </div>
    </div>
  );
}

// ── 下旨 compose 弹窗（portal 到 body，避开舞台 transform 缩放） ──────────────

function ComposeOverlay({
  deptTitle,
  deptColor,
  initialText,
  onClose,
}: {
  deptTitle: string | null;
  deptColor: string;
  initialText: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useCallback(async () => {
    const cmd = text.trim();
    if (cmd.length < 2) { setMsg("陛下，旨意太短 · 请说明意图（至少 2 字）"); return; }
    setBusy(true);
    setMsg("正在拟旨，丞相分析中……");
    try {
      const draft = await chaotang.decreeDraft(cmd);
      const cats = draft.recommendedCategories ?? [];
      const selectedCategories: CategorySelection[] = cats.slice(0, 1).map((c) => ({
        taskType: c.taskType, ministers: c.ministers, groups: c.groups, label: c.label,
      }));
      setMsg("圣旨已拟定，正在派发群臣……");
      const result = await chaotang.decreeDispatch({
        rawCommand: cmd,
        intent: draft.intent ?? cmd,
        selectedCategories,
      });
      setDone(true);
      setMsg("圣旨已发布！任务已创建，正在前往军机处查看作战进展……");
      window.setTimeout(() => {
        router.push(`/junjichu?taskId=${encodeURIComponent(result.taskId)}`);
      }, 1000);
    } catch {
      setBusy(false);
      setMsg("拟旨失败，请稍后重试或直接前往军机处。");
    }
  }, [text, router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="发起任务 · 下旨"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(3,5,12,0.74)",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "92vw",
          borderRadius: 14,
          padding: 22,
          background: "linear-gradient(160deg, rgba(14,19,40,0.98) 0%, rgba(7,10,22,0.99) 100%)",
          border: `1px solid ${deptColor}55`,
          boxShadow: `0 0 0 1px ${deptColor}22, 0 30px 80px -24px rgba(0,0,0,0.9)`,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: deptColor, textTransform: "uppercase", marginBottom: 4 }}>
          DECREE · 下旨发起任务
        </div>
        <div style={{ fontSize: 18, fontFamily: "var(--font-serif)", color: "#F5E9C9", fontWeight: 600, marginBottom: 4 }}>
          发起任务
        </div>
        <div style={{ fontSize: 11, color: "#6A7299", marginBottom: 14 }}>
          {deptTitle ? <>当前部门：<span style={{ color: deptColor }}>{deptTitle}</span> · </> : null}
          拟定旨意，丞相拆解后派发群臣，于军机处实时会审。
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || done}
          placeholder="请陈述旨意，例如：盘点本季资金缺口并拟定融资方案……"
          rows={4}
          style={{
            width: "100%",
            resize: "vertical",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
            lineHeight: 1.6,
            color: "#F5E9C9",
            background: "rgba(6,9,20,0.9)",
            border: "1px solid rgba(240,198,106,0.22)",
            outline: "none",
            fontFamily: "var(--font-serif)",
          }}
        />

        {msg && (
          <div style={{ marginTop: 10, fontSize: 12, color: done ? "#5FB37A" : "#C6BB9D", lineHeight: 1.5 }}>
            {msg}
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              fontSize: 13,
              padding: "8px 16px",
              borderRadius: 7,
              color: "#9AA3C4",
              background: "transparent",
              border: "1px solid rgba(154,163,196,0.25)",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || done}
            className="btn-gold"
            style={{
              fontSize: 14,
              padding: "8px 22px",
              borderRadius: 7,
              fontWeight: 600,
              letterSpacing: "0.12em",
              cursor: busy || done ? "not-allowed" : "pointer",
              opacity: busy || done ? 0.65 : 1,
            }}
          >
            {busy ? "拟旨中…" : "下旨"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

interface AdvicePanelProps {
  /** 当前选中部门 key（如"hubu"），null = 未选中 */
  selectedDeptKey: string | null;
  /** 选中部门中文名（如"户部"），null = 未选中 */
  selectedDeptTitle: string | null;
  /** 选中部门主题色 */
  selectedDeptColor: string;
}

export default function AdvicePanel({
  selectedDeptKey,
  selectedDeptTitle,
  selectedDeptColor,
}: AdvicePanelProps) {
  const [composeText, setComposeText] = useState<string | null>(null); // null = 关闭

  const openCompose = (prefill: string) => setComposeText(prefill);
  const closeCompose = () => setComposeText(null);

  return (
    <section
      className="panel anim-slide-l flex flex-col rounded-[14px]"
      style={{
        position: "absolute",
        left: 1306,
        top: 56,
        width: 352,
        height: 726,
        zIndex: 20,
        padding: 16,
        animationDelay: "0.32s",
      }}
    >
      {/* 蜂群集群区块 */}
      <SwarmClusterBlock
        deptKey={selectedDeptKey}
        deptTitle={selectedDeptTitle}
        deptColor={selectedDeptColor}
      />

      <div className="flex-1" />

      {/* 发起任务 — 打开下旨 compose（真实闭环，非死链） */}
      <div className="anim-rise pulse-gold rounded-[7px]" style={{ animationDelay: "0.9s" }}>
        <ActionButton
          variant="gold"
          onClick={() => openCompose("")}
          icon={<span className="text-[17px]"><IconRocket /></span>}
          className="h-[44px] w-full text-[15px] tracking-[0.18em]"
        >
          发起任务
        </ActionButton>
      </div>

      {/* 六宫格快捷操作 — 各自预填模板进 compose */}
      <div className="mt-[14px] grid grid-cols-3 gap-[10px]">
        {QUICK.map((q, i) => (
          <button
            key={q.label}
            type="button"
            onClick={() => openCompose(q.template)}
            className="tile anim-rise flex flex-col items-center justify-center gap-[6px] rounded-[9px] py-[12px]"
            style={{ animationDelay: `${1000 + i * 70}ms` }}
          >
            <span className="tile-icon text-[19px] text-gold-bright">{q.icon}</span>
            <span className="text-[12px] text-jade-muted">{q.label}</span>
          </button>
        ))}
      </div>

      {/* compose 弹窗 portal 到 body，避开舞台 transform 缩放 */}
      {composeText !== null && typeof document !== "undefined" &&
        createPortal(
          <ComposeOverlay
            deptTitle={selectedDeptTitle}
            deptColor={selectedDeptColor}
            initialText={composeText}
            onClose={closeCompose}
          />,
          document.body,
        )}
    </section>
  );
}
