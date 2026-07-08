"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { MINISTRIES, type Ministry } from "./manorData";
import type { ManorMinistryMetricsMap } from "@/lib/contracts/manor";
import { assetUrl } from "@/lib/asset";
import { withBasePath } from "@/lib/base-path";

type Point = {
  x: number;
  y: number;
};

type NodeConfig = {
  id: string;
  label: string;
  shortLabel: string;
  point: Point;
  width: number;
  accent: string;
  interactive?: boolean;
};

const TOP_NODES: NodeConfig[] = [
  {
    id: "intel",
    label: "锦衣卫情报蜂群",
    shortLabel: "情",
    point: { x: 35, y: 18.6 },
    width: 164,
    accent: "#D9A85B",
  },
  {
    id: "archive",
    label: "史馆归档蜂群",
    shortLabel: "史",
    point: { x: 50, y: 18.1 },
    width: 164,
    accent: "#E6BC70",
  },
  {
    id: "api",
    label: "外部接口蜂群",
    shortLabel: "外",
    point: { x: 65, y: 18.6 },
    width: 164,
    accent: "#D9A85B",
  },
];

const CENTER_NODES: NodeConfig[] = [
  {
    id: "swarm-command",
    label: "蜂群总控",
    shortLabel: "总",
    point: { x: 40.7, y: 31.9 },
    width: 158,
    accent: "#E6BC70",
  },
  {
    id: "prime-dispatch",
    label: "丞相调度",
    shortLabel: "相",
    point: { x: 50, y: 31.9 },
    width: 158,
    accent: "#F3CF8C",
  },
  {
    id: "war-room",
    label: "军机会审",
    shortLabel: "审",
    point: { x: 59.3, y: 31.9 },
    width: 158,
    accent: "#E6BC70",
  },
];

const MINISTRY_META: Record<
  string,
  { point: Point; label: string; shortLabel: string; width: number }
> = {
  hubu: { point: { x: 12.6, y: 30.4 }, label: "户部蜂群", shortLabel: "户", width: 146 },
  libu: { point: { x: 10.7, y: 48.6 }, label: "吏部蜂群", shortLabel: "吏", width: 146 },
  libu2: { point: { x: 14, y: 67.2 }, label: "礼部蜂群", shortLabel: "礼", width: 146 },
  bingbu: { point: { x: 87.4, y: 30.4 }, label: "兵部蜂群", shortLabel: "兵", width: 146 },
  xingbu: { point: { x: 89.2, y: 48.6 }, label: "刑部蜂群", shortLabel: "刑", width: 146 },
  gongbu: { point: { x: 86, y: 67.2 }, label: "工部蜂群", shortLabel: "工", width: 146 },
};

const FOOTER_ACTIONS = [
  "下旨创建任务",
  "召集蜂群执行",
  "查看执行进度",
  "生成执行奏折",
];

async function fetchMinistryMetrics(url: string): Promise<ManorMinistryMetricsMap> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as {
    success: boolean;
    data: ManorMinistryMetricsMap;
    error?: string;
  };
  if (!json.success) throw new Error(json.error ?? "manor-metrics failed");
  return json.data;
}

function applyTursoMetrics(
  base: Ministry[],
  metricsMap: ManorMinistryMetricsMap,
): Ministry[] {
  return base.map((m) => {
    const rows = metricsMap[m.key];
    if (!rows || rows.length === 0) return m;
    return {
      ...m,
      metrics: rows.map((r) => ({
        label: r.label,
        value: r.value,
        delta: r.deltaPositive,
      })),
    };
  });
}

function NodePlaque({
  node,
  active = false,
  onClick,
}: {
  node: NodeConfig;
  active?: boolean;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 text-left transition duration-300 ${
        clickable ? "hover:scale-[1.025] hover:-translate-y-[52%]" : "cursor-default"
      }`}
      style={{
        left: `${node.point.x}%`,
        top: `${node.point.y}%`,
        width: `${node.width}px`,
      }}
    >
      <span
        className="relative flex items-center gap-2 overflow-hidden px-2.5 py-2"
        style={{
          clipPath:
            "polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)",
          border: `1px solid ${active ? "#F4CE88" : `${node.accent}70`}`,
          background: active
            ? "linear-gradient(180deg, rgba(24,19,12,0.92), rgba(12,10,8,0.86))"
            : "linear-gradient(180deg, rgba(18,15,10,0.84), rgba(8,8,7,0.72))",
          boxShadow: active
            ? "0 0 0 1px rgba(244,206,136,0.14), 0 10px 26px rgba(0,0,0,0.34)"
            : "0 8px 22px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,240,206,0.08)",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-x-4 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(244,206,136,0.88), transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-x-5 bottom-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(177,127,46,0.60), transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute left-[10px] top-1/2 h-[68%] w-px -translate-y-1/2"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(244,206,136,0.42), transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute right-[10px] top-1/2 h-[68%] w-px -translate-y-1/2"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(244,206,136,0.30), transparent)",
          }}
        />
        <span
          className="relative z-10 grid h-8 w-8 shrink-0 place-items-center border text-[13px] font-black"
          style={{
            clipPath: "polygon(25% 8%, 75% 8%, 100% 50%, 75% 92%, 25% 92%, 0% 50%)",
            color: active ? "#F7DDA6" : node.accent,
            borderColor: active ? "#F4CE88" : `${node.accent}85`,
            background: active
              ? "linear-gradient(180deg, rgba(240,198,106,0.18), rgba(93,61,12,0.12))"
              : "linear-gradient(180deg, rgba(240,198,106,0.12), rgba(93,61,12,0.08))",
            boxShadow: active ? "0 0 0 1px rgba(240,198,106,0.14)" : "0 0 0 1px rgba(240,198,106,0.08)",
          }}
        >
          {node.shortLabel}
        </span>
        <span className="relative z-10 min-w-0">
          <span
            className="block truncate font-serif text-[15px] font-black"
            style={{ color: active ? "#F9E7BF" : "#E7C98A" }}
          >
            {node.label}
          </span>
        </span>
      </span>
    </button>
  );
}

function FooterAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-[16px] border px-5 py-3 text-[14px] font-semibold text-[#F6DEAC] transition duration-300 hover:-translate-y-0.5"
      style={{
        borderColor: "rgba(240,198,106,0.36)",
        background:
          "linear-gradient(180deg, rgba(22,18,12,0.88), rgba(8,8,7,0.84))",
        boxShadow:
          "0 12px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,236,196,0.10)",
      }}
    >
      <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/70 to-transparent" />
      <span className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/30 to-transparent" />
      <span className="relative">{label}</span>
    </button>
  );
}

export default function Manor() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: metricsMap } = useSWR<ManorMinistryMetricsMap>(
    withBasePath("/api/court/zhuangyuan/ministry-metrics"),
    fetchMinistryMetrics,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );

  const ministries = useMemo(
    () => (metricsMap ? applyTursoMetrics(MINISTRIES, metricsMap) : MINISTRIES),
    [metricsMap],
  );

  const ministryNodes = useMemo<NodeConfig[]>(
    () =>
      ministries.map((ministry) => {
        const meta = MINISTRY_META[ministry.key];
        return {
          id: ministry.key,
          label: meta?.label ?? `${ministry.title.split("·")[0].trim()}蜂群`,
          shortLabel: meta?.shortLabel ?? ministry.title[0] ?? "部",
          point: meta?.point ?? { x: 50, y: 50 },
          width: meta?.width ?? 138,
          accent: ministry.color,
          interactive: true,
        };
      }),
    [ministries],
  );

  const selectedMinistry = useMemo(
    () => ministries.find((item) => item.key === selectedKey) ?? null,
    [ministries, selectedKey],
  );

  const selectedTitle = selectedMinistry?.title.split("·")[0].trim();
  const selectedMetricLine = selectedMinistry?.metrics
    .slice(0, 2)
    .map((metric) => `${metric.label}${metric.value}`)
    .join(" · ");

  return (
    <main
      id="zhuangyuan"
      className="relative isolate h-screen w-full overflow-hidden bg-[#04060e] text-[#F5E9C9]"
    >
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetUrl("/assets/manor.webp")}
          alt="庄园蜂群执行中心"
          draggable={false}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,4,8,0.48),rgba(2,4,8,0.20)_18%,rgba(2,4,8,0.12)_58%,rgba(2,4,8,0.76)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(240,198,106,0.10),transparent_24%),radial-gradient(circle_at_50%_52%,rgba(68,110,178,0.05),transparent_28%)]" />
        <div className="absolute inset-y-0 left-0 w-[16%] bg-[linear-gradient(90deg,rgba(0,0,0,0.66),transparent)]" />
        <div className="absolute inset-y-0 right-0 w-[16%] bg-[linear-gradient(270deg,rgba(0,0,0,0.66),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-[28%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.56))]" />
      </div>

      <div className="absolute inset-x-0 top-3 z-30 px-6 text-center md:top-4">
        <div className="mx-auto w-fit rounded-full border border-[#F0C66A]/18 bg-black/12 px-4 py-1 text-[10px] tracking-[0.40em] text-[#B88E50] backdrop-blur-sm">
          庄园夜幕指挥厅
        </div>
        <h1 className="mt-2 font-serif text-[40px] font-black tracking-[0.12em] text-[#F8D99B] [text-shadow:0_0_6px_rgba(255,220,150,0.28),0_0_18px_rgba(240,198,106,0.16)] md:text-[54px]">
          庄园蜂群执行中心
        </h1>
        <div className="mt-2 flex items-center justify-center gap-3 text-[13px] tracking-[0.22em] text-[#C9A867]">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#C9A867]/70" />
          <span>六部统筹</span>
          <span className="text-[#8C6935]">·</span>
          <span>蜂群出征</span>
          <span className="text-[#8C6935]">·</span>
          <span>结果成奏折</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#C9A867]/70" />
        </div>
      </div>

      <div className="absolute inset-[18%_7%_22%_7%] z-10 md:inset-[17%_7%_21%_7%]">
        {TOP_NODES.map((node) => (
          <NodePlaque key={node.id} node={node} />
        ))}
        {CENTER_NODES.map((node) => (
          <NodePlaque
            key={node.id}
            node={node}
          />
        ))}
        {ministryNodes.map((node) => (
          <NodePlaque
            key={node.id}
            node={node}
            active={selectedKey === node.id}
            onClick={() =>
              setSelectedKey((prev) => (prev === node.id ? null : node.id))
            }
          />
        ))}
      </div>

      <section
        data-three-axis-decree-input
        className="fixed inset-x-0 z-30 overflow-x-hidden overflow-y-visible px-4 lg:px-8"
        style={{
          background:
            "linear-gradient(0deg, rgba(10,8,4,0.97) 0%, rgba(14,12,8,0.94) 80%, rgba(14,12,8,0) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          bottom: "calc(24px + env(safe-area-inset-bottom))",
          boxShadow: "0 -18px 70px rgba(0,0,0,0.58), inset 0 1px 0 rgba(245,233,201,0.06)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="庄园底部执行台"
      >
        <div
          aria-hidden
          className="h-px"
          style={{
            background: "linear-gradient(90deg, transparent, #F0C66A, transparent)",
            boxShadow: "0 0 16px rgba(240,198,106,0.40)",
          }}
        />
        <div className="mx-auto flex max-w-[1920px] flex-col gap-2.5 py-2.5">
          <div
            className="w-fit rounded-full border bg-black/24 px-5 py-2 text-[12px] text-[#DBC38F] backdrop-blur-sm transition duration-300"
            style={{
              borderColor: selectedMinistry ? `${selectedMinistry.color}44` : "rgba(240,198,106,0.22)",
              boxShadow: selectedMinistry ? `0 0 18px ${selectedMinistry.color}22` : "none",
            }}
          >
            {selectedMinistry
              ? `当前焦点：${selectedTitle} · ${selectedMetricLine ?? "任务已接入主责蜂群"}`
              : "点击蜂群节点，可聚焦当前主责蜂群与执行指标"}
          </div>
          <div className="flex justify-center">
            <div className="grid w-full max-w-[820px] grid-cols-2 gap-4 md:grid-cols-4">
              {FOOTER_ACTIONS.map((action) => (
                <FooterAction
                  key={action}
                  label={action}
                  onClick={() => {
                    if (!selectedKey) {
                      setSelectedKey("hubu");
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
