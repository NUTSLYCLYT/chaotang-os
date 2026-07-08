"use client";

import React, { useEffect, useState } from "react";
import { chaotang } from "@/lib/api/chaotang";
import type { ManorProject, PolicyFund } from "@/lib/contracts/manor";
import { OPPORTUNITY_STAGE_LABEL, OPPORTUNITY_STAGE_COLOR } from "@/lib/contracts/manor";

const GOLD = "#F0C66A";
const DIM = "#8F835F";
const JADE = "#6A7299";
const GREEN = "#3DD68C";
const BLUE = "#6BA0FF";
const RED = "#F43F5E";

function pillStyle(extra?: Record<string, string | number>): React.CSSProperties {
  return {
    background: "rgba(15, 22, 42, 0.85)",
    border: "1px solid rgba(240, 198, 106, 0.18)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 0 0 1px rgba(240, 198, 106, 0.06), 0 8px 32px rgba(0,0,0,0.4)",
    borderRadius: "10px",
    padding: "14px 16px",
    ...extra,
  };
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 6 }}>
      <div
        style={{
          height: "100%",
          width: `${Math.min(pct, 100)}%`,
          background: pct >= 80 ? GREEN : pct >= 50 ? GOLD : BLUE,
          borderRadius: 2,
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}

function FundTag({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "政府补贴": "#F0C66A",
    "产业基金": "#6BA0FF",
    "园区资源": "#3DD68C",
    "税收优惠": "#A78BFA",
  };
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 4,
        background: `${colors[type] || JADE}20`,
        color: colors[type] || JADE,
        border: `1px solid ${colors[type] || JADE}40`,
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}

export default function ProjectsPanel() {
  const [projects, setProjects] = useState<ManorProject[]>([]);
  const [funds, setFunds] = useState<PolicyFund[]>([]);
  const [fundSummary, setFundSummary] = useState<{ totalCount: number; actionableCount: number; totalPotentialAmount: string } | null>(null);
  const [tab, setTab] = useState<"projects" | "funds">("projects");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      chaotang.manorProjects().catch(() => null),
      chaotang.manorPolicyFunds().catch(() => null),
    ]).then(([pData, fData]) => {
      if (pData) {
        setProjects(pData.projects);
      }
      if (fData) {
        setFunds(fData.funds);
        setFundSummary(fData.summary);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        top: 546,
        width: 380,
        zIndex: 22,
        animation: "anim-rise-lg 0.6s ease-out",
        animationDelay: "0.3s",
      }}
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => setTab("projects")}
          style={{
            ...pillStyle({
              padding: "6px 14px",
              fontSize: 13,
              cursor: "pointer",
              color: tab === "projects" ? GOLD : JADE,
              borderColor: tab === "projects" ? "rgba(240, 198, 106, 0.4)" : "rgba(240, 198, 106, 0.18)",
            }),
          }}
        >
          📋 项目经营盘 ({projects.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("funds")}
          style={{
            ...pillStyle({
              padding: "6px 14px",
              fontSize: 13,
              cursor: "pointer",
              color: tab === "funds" ? GOLD : JADE,
              borderColor: tab === "funds" ? "rgba(240, 198, 106, 0.4)" : "rgba(240, 198, 106, 0.18)",
            }),
          }}
        >
          💰 政策资金 ({funds.length})
        </button>
      </div>

      {/* Projects Tab */}
      {tab === "projects" && (
        <div style={{ ...pillStyle(), maxHeight: 340, overflowY: "auto" }}>
          {projects.map((p) => (
            <div
              key={p.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>{p.name}</span>
                <span style={{
                  fontSize: 11,
                  padding: "1px 8px",
                  borderRadius: 4,
                  color: OPPORTUNITY_STAGE_COLOR[p.stage] || JADE,
                  background: `${OPPORTUNITY_STAGE_COLOR[p.stage] || JADE}15`,
                }}>
                  {OPPORTUNITY_STAGE_LABEL[p.stage]}
                </span>
              </div>
              <div style={{ fontSize: 11, color: JADE, marginTop: 4 }}>{p.description}</div>
              <ProgressBar pct={p.progressPct} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: DIM }}>
                <span>下个里程碑: {p.nextMilestone}</span>
                <span>{p.progressPct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Funds Tab */}
      {tab === "funds" && (
        <div style={{ ...pillStyle(), maxHeight: 340, overflowY: "auto" }}>
          {fundSummary && (
            <div style={{
              marginBottom: 10,
              padding: "8px 10px",
              borderRadius: 6,
              background: "rgba(240, 198, 106, 0.06)",
              fontSize: 12,
              color: GOLD,
              textAlign: "center",
            }}>
              共 {fundSummary.totalCount} 项 · 可申报 {fundSummary.actionableCount} 项 · {fundSummary.totalPotentialAmount}
            </div>
          )}
          {funds.map((f) => (
            <div
              key={f.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#EAEEFB", fontWeight: 500 }}>{f.name}</span>
                <FundTag type={f.type} />
              </div>
              <div style={{ fontSize: 11, color: JADE, marginTop: 4 }}>
                {f.amount} · 截止: {f.deadline}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: DIM }}>{f.description.slice(0, 40)}...</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: f.matchScore >= 80 ? GREEN : f.matchScore >= 60 ? GOLD : JADE,
                }}>
                  匹配 {f.matchScore}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
