"use client";

import { useEffect, useState } from "react";
import { chaotang } from "@/lib/api/chaotang";
import type { AssetCategory, ManorOverview } from "@/lib/contracts/manor";

/**
 * 左侧"企业核心资产"浮窗
 *
 * 数据来源: chaotang.manorOverview() → GET /api/court/chaotang/manor/overview
 *   - pulse: totalAssets / activeOpportunities / runningProjects / supplyItems / riskCount
 *   - assetCategories: F2 已接**真实计数**(memorial/opportunity/supply/knowledge,count 为真实值,
 *     0 就显示 0,不伪造、不再标 [演示])。
 *
 * 画布坐标系尺寸保持 left:20 top:56 width:176 height:582
 * (面板放在 1672×941 设计画布内, 由 ScaledStage 统一缩放)
 */

interface AssetMetric {
  key: string;
  label: string;
  value: string;
  unit: string;
}

/** 将 PulseStat 映射为顶部脉冲指标 */
function pulseToMetrics(overview: ManorOverview): AssetMetric[] {
  const p = overview.pulse;
  return [
    { key: 'total-assets',     label: '资产总值',   value: p.totalAssets.toLocaleString('en-US'), unit: '亿' },
    { key: 'opportunities',    label: '商机数量',   value: String(p.activeOpportunities),         unit: '个' },
    { key: 'running-projects', label: '在跑项目',   value: String(p.runningProjects),             unit: '项' },
  ];
}

export default function AssetMapPanel() {
  const [metrics, setMetrics] = useState<AssetMetric[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const overview = await chaotang.manorOverview();
        if (!cancelled) {
          setMetrics(pulseToMetrics(overview));
          // F2: 真实 assetCategories(count 真实,0 也显示),不再伪造演示标记
          setCategories(overview.assetCategories ?? []);
          setLoaded(true);
        }
      } catch {
        // 静默降级，保持空态加载提示
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        left: 20,
        top: 56,
        width: 176,
        height: 582,
        zIndex: 20,
        borderRadius: 8,
        padding: "12px 12px 10px",
        background:
          "linear-gradient(160deg, rgba(10,16,36,0.94) 0%, rgba(6,9,20,0.92) 100%)",
        border: "1px solid rgba(212,168,75,0.35)",
        boxShadow:
          "inset 0 1px 0 rgba(235,203,123,0.18), 0 14px 36px -14px rgba(0,0,0,0.85)",
        backdropFilter: "blur(2px)",
        color: "#eef2ec",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* 标题 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 6,
          borderBottom: "1px solid rgba(212,168,75,0.18)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 13,
            letterSpacing: "0.1em",
            color: "#ebcb7b",
          }}
        >
          企业核心资产
        </span>
        <span
          aria-hidden
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "1px solid rgba(235,203,123,0.45)",
            color: "rgba(235,203,123,0.75)",
            fontSize: 9,
            fontStyle: "italic",
            lineHeight: 1,
          }}
        >
          i
        </span>
      </div>

      {/* 顶部 3 脉冲指标 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {!loaded ? (
          <div
            style={{
              padding: "12px 0",
              display: "grid",
              placeItems: "center",
              color: "rgba(212,168,75,0.55)",
              fontSize: 11,
            }}
          >
            加载中…
          </div>
        ) : (
          metrics.map((m) => (
            <div
              key={m.key}
              style={{
                padding: "5px 8px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(212,168,75,0.14)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "#b6ab8c",
                  marginBottom: 2,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 3,
                  fontFamily: "var(--font-serif)",
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "#f5e9c9",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {m.value}
                </span>
                <span style={{ fontSize: 11, color: "#c6bb9d" }}>{m.unit}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 核心资产类目(F2 真实 count) */}
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          color: "#8a8268",
          marginTop: 2,
        }}
      >
        资产类目
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {loaded && categories.length === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(212,168,75,0.45)", padding: "6px 0" }}>
            暂无资产类目
          </div>
        ) : (
          categories.map((c) => (
            <div
              key={c.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                padding: "5px 8px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(212,168,75,0.12)",
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  color: "#c6bb9d",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={c.items.length > 0 ? c.items.join(" · ") : c.label}
              >
                {c.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 15,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: c.count > 0 ? "#f5e9c9" : "#6A7299",
                  lineHeight: 1,
                }}
              >
                {c.count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
