"use client";

/**
 * BottomBar — 庄园底部状态栏
 *
 * 左：天下大势图 + 区域切换
 * 中：庄园状态条（动态：调 /api/orchestration/run SSE 获取最新运行状态）
 *
 * 点击"查看详情"→ POST /api/orchestration/run 发起三省审议
 *   - 启动时显示"审议中…"
 *   - SSE pipeline_done 事件返回时更新状态文字 + 引用列表
 *   - 引用数量显示在状态条右侧角标
 */

import { useCallback, useRef, useState } from "react";
import ActionButton from "./ActionButton";
import { IconMap, IconChevronDown, IconArrowRight } from "./Glyphs";

// ---- SSE 事件类型（仅使用庄园所需字段）----
interface PipelineDonePayload {
  type: "pipeline_done";
  result?: {
    finalVerdict?: string;
    zhongshu?: { citations?: Array<{ scrollId?: string; text?: string }> };
  };
}

interface OrchestrationStatus {
  phase: "idle" | "running" | "done" | "error";
  text: string;
  citationCount: number;
}

const DEFAULT_STATUS: OrchestrationStatus = {
  phase: "idle",
  text: "庄园运转正常，一切尽在掌控",
  citationCount: 0,
};

/** POST /api/orchestration/run SSE，返回取消函数 */
function runOrchestration(
  command: string,
  onDone: (result: OrchestrationStatus) => void,
  onError: () => void,
): () => void {
  const ac = new AbortController();

  void (async () => {
    try {
      const res = await fetch("/api/orchestration/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        onError();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let eventName = "";
          let data = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (eventName === "pipeline_done" && data) {
            try {
              const payload = JSON.parse(data) as PipelineDonePayload;
              const citCount =
                payload.result?.zhongshu?.citations?.length ?? 0;
              const verdict = payload.result?.finalVerdict ?? "完成";
              onDone({
                phase: "done",
                text: `三省审议完成 · 最终裁决: ${verdict}`,
                citationCount: citCount,
              });
            } catch {
              onDone({
                phase: "done",
                text: "三省审议完成",
                citationCount: 0,
              });
            }
            return;
          }
          if (eventName === "error") {
            onError();
            return;
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") onError();
    }
  })();

  return () => ac.abort();
}

export default function BottomBar() {
  const [status, setStatus] = useState<OrchestrationStatus>(DEFAULT_STATUS);
  const cancelRef = useRef<(() => void) | null>(null);

  const handleViewDetail = useCallback(() => {
    cancelRef.current?.();
    setStatus({ phase: "running", text: "三省审议进行中…", citationCount: 0 });

    cancelRef.current = runOrchestration(
      "庄园状态巡检：请综合当前运行情况，给出简要经营建议",
      (result) => setStatus(result),
      () =>
        setStatus({
          phase: "error",
          text: "审议暂时不可用，庄园正常运转中",
          citationCount: 0,
        }),
    );
  }, []);

  const isRunning = status.phase === "running";

  return (
    <>
      {/* 左下：天下大势图 + 区域切换 */}
      <div
        className="pill anim-rise-lg flex items-center rounded-[9px]"
        style={{
          position: "absolute",
          left: 16,
          top: 866,
          height: 40,
          zIndex: 20,
          animationDelay: "0.55s",
        }}
      >
        <button
          type="button"
          className="glow flex items-center gap-[7px] rounded-l-[9px] px-[12px] py-[9px] text-[13px] text-jade"
        >
          <span className="text-[16px] text-gold-bright">
            <IconMap />
          </span>
          天下大势图
        </button>
        <span className="h-[18px] w-px bg-[rgba(212,168,75,0.25)]" />
        <button
          type="button"
          className="glow flex items-center gap-[8px] rounded-r-[9px] px-[12px] py-[9px] text-[13px] text-jade-muted"
        >
          全国区域
          <span className="text-[14px] text-jade-dim">
            <IconChevronDown />
          </span>
        </button>
      </div>

      {/* 中下：状态条（与 orchestration/run 联动） */}
      <div
        className="pill anim-rise-lg flex items-center gap-[14px] rounded-[10px]"
        style={{
          position: "absolute",
          left: 568,
          top: 862,
          width: 540,
          height: 44,
          zIndex: 20,
          paddingLeft: 16,
          paddingRight: 8,
          animationDelay: "0.7s",
        }}
      >
        {/* 状态图标 */}
        <span
          className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full border border-[rgba(212,168,75,0.5)] bg-[rgba(212,168,75,0.08)] text-[12px] font-serif text-gold-bright"
          style={{ boxShadow: "inset 0 0 8px rgba(235,203,123,0.25)" }}
        >
          {isRunning ? "议" : status.phase === "error" ? "警" : "安"}
        </span>

        {/* 状态文字 */}
        <span className="flex-1 text-[13.5px] tracking-[0.04em] text-jade">
          {status.text}
        </span>

        {/* 引用角标 */}
        {status.citationCount > 0 && (
          <span
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 4,
              background: "rgba(240,198,106,0.12)",
              border: "1px solid rgba(240,198,106,0.35)",
              color: "#F0C66A",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {status.citationCount} 引用
          </span>
        )}

        {/* 运行指示 */}
        <span className="flex shrink-0 items-center gap-[6px] text-[12px] text-jade-muted">
          <span
            className={
              isRunning
                ? "pulse-gold relative h-[7px] w-[7px] rounded-full"
                : "pulse-jade relative h-[7px] w-[7px] rounded-full"
            }
            style={{
              background: isRunning ? "#F0C66A" : "var(--color-celadon)",
              boxShadow: isRunning
                ? "0 0 8px #F0C66A"
                : "0 0 8px var(--color-celadon)",
            }}
          />
          {isRunning ? "审议中" : "运转中"}
        </span>

        {/* 查看详情 → 触发 orchestration/run */}
        <ActionButton
          variant="ghost"
          onClick={handleViewDetail}
          disabled={isRunning}
          iconRight={
            <span className="text-[12px]">
              <IconArrowRight />
            </span>
          }
          className="h-[30px] px-[12px] text-[12.5px]"
        >
          查看详情
        </ActionButton>
      </div>
    </>
  );
}
