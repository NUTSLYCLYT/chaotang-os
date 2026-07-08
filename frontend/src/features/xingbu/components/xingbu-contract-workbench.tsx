'use client';

/**
 * 刑部 · 合同审查台（中栏 hero · 2026-06-28）
 *
 * 用户贴合同文本 → 点「审查」→ 客户端运行 scanWithHistory → renderClauseReport 结构渲染。
 * 纯客户端：原文不出浏览器（铁律9 咨询面）。
 * 史馆踩坑率：pastContractCases 传空数组，诚实标「接入中」。
 * verdict = veto 红 / caution 黄 / pass 绿（语义色）。
 * 下载按钮生成 markdown 报告（renderClauseReport）。
 */
import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import { scanWithHistory, type ClauseHistoryResult } from '@/lib/swarm/clause-history';
import { clauseReportFilename, renderClauseReport } from '@/lib/swarm/clause-report';
import type { ClauseRisk } from '@/lib/swarm/clause-risk';
import { ACCENT } from '@/features/xingbu/lib/xingbu-roster';
import { XingbuLegalSwarmPanel } from '@/features/xingbu/components/xingbu-legal-swarm-panel';

const VERDICT_CONFIG = {
  veto: {
    label: '一票否决',
    sublabel: '命中高危条款，禁止径自签署，必须人工/法务复核',
    color: '#E5604D',
    bg: '#E5604D12',
    border: '#E5604D3a',
    Icon: AlertTriangle,
  },
  caution: {
    label: '谨慎',
    sublabel: '存在风险条款，逐条人工确认后再定',
    color: '#E5B84D',
    bg: '#E5B84D0e',
    border: '#E5B84D34',
    Icon: AlertTriangle,
  },
  pass: {
    label: '低风险',
    sublabel: '未命中已知高危，标准保护齐备；仍建议人工抽查',
    color: '#3DD68C',
    bg: '#3DD68C0c',
    border: '#3DD68C2c',
    Icon: CheckCircle2,
  },
} as const;

const SEV_CONFIG = {
  high: { label: '高危', color: '#E5604D', bg: '#E5604D16' },
  medium: { label: '中危', color: '#E5B84D', bg: '#E5B84D12' },
  low: { label: '低危', color: '#8B93A7', bg: '#8B93A712' },
} as const;

function RiskItem({ risk }: { risk: ClauseRisk }) {
  const sev = SEV_CONFIG[risk.severity];
  return (
    <div
      className="rounded-[10px] border p-2.5"
      style={{ borderColor: `${sev.color}28`, background: sev.bg }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
          style={{ color: sev.color, background: `${sev.color}20` }}
        >
          {sev.label}
        </span>
        <span className="text-[12px] text-[#d8cba8]">{risk.reason}</span>
      </div>
      <p className="mt-1.5 font-mono text-[10.5px] text-[#7a8890]">
        命中片段: <span className="text-[#a0acb8]">{risk.snippet}</span>
      </p>
      {risk.legalBasis && (
        <p className="mt-0.5 text-[10.5px]" style={{ color: ACCENT }}>
          法条: {risk.legalBasis}
        </p>
      )}
      <p className="mt-1 text-[10.5px] text-[#6a7880]">建议: {risk.suggestion}</p>
    </div>
  );
}

function downloadMarkdown(result: ClauseHistoryResult, subject: string) {
  const nowIso = new Date().toISOString();
  const md = renderClauseReport(result, {
    subject: subject.trim() || '未命名合同',
    generatedAt: nowIso,
  });
  const filename = clauseReportFilename(subject.trim() || '合同', nowIso);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function XingbuContractWorkbench() {
  const [subject, setSubject] = useState('');
  const [contractText, setContractText] = useState('');
  const [result, setResult] = useState<ClauseHistoryResult | null>(null);
  const [scanning, setScanning] = useState(false);

  function handleScan() {
    const text = contractText.trim();
    if (!text) return;
    setScanning(true);
    // Defer to next tick so the loading state renders before synchronous scan
    setTimeout(() => {
      const r = scanWithHistory(text, [], new Date().toISOString());
      setResult(r);
      setScanning(false);
    }, 0);
  }

  const verdict = result ? VERDICT_CONFIG[result.scan.verdict] : null;
  const VerdictIcon = verdict?.Icon;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      {/* ── 输入区 ── */}
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <FileText size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            合同审查司 · 贴入合同条款
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">
            原文不出浏览器（铁律9）
          </span>
        </div>

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="合同名称 / 对象（可选，用于下载报告命名）"
          className="mb-2 w-full rounded-[10px] border bg-transparent px-3 py-1.5 text-[12px] text-[#E9DDBE] placeholder:text-[#4a4e5c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DD68C]"
          style={{ borderColor: `${ACCENT}28` }}
        />

        <textarea
          value={contractText}
          onChange={(e) => setContractText(e.target.value)}
          placeholder="粘贴合同条款文本（可粘贴部分关键条款）……"
          className="w-full resize-none rounded-[12px] border bg-transparent px-3 py-2.5 text-[12.5px] leading-relaxed text-[#d0c9b4] placeholder:text-[#3a3e4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DD68C]"
          style={{ borderColor: `${ACCENT}24`, minHeight: '160px' }}
          rows={8}
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <button
            onClick={handleScan}
            disabled={!contractText.trim() || scanning}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: scanning ? `${ACCENT}30` : ACCENT,
              color: scanning ? ACCENT : '#040A10',
            }}
          >
            {scanning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ShieldAlert size={14} />
            )}
            {scanning ? '审查中…' : '审查'}
          </button>

          {result && (
            <button
              onClick={() => downloadMarkdown(result, subject)}
              className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] text-[#b6ab8c] transition hover:text-[#F5E9C9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DD68C]"
              style={{ borderColor: `${ACCENT}28` }}
            >
              <Download size={13} /> 下载报告
            </button>
          )}

          <span className="ml-auto text-[10px] text-[#5f5a48]">
            史馆踩坑率: 接入中
          </span>
        </div>
      </div>

      {/* ── 审查结果 ── */}
      {result && verdict && VerdictIcon && (
        <div
          className="rounded-[20px] border p-4"
          style={{ borderColor: verdict.border, background: verdict.bg }}
        >
          {/* verdict 横幅 */}
          <div
            className="mb-3 flex items-center gap-2.5 rounded-[12px] border px-3 py-2.5"
            style={{ borderColor: verdict.border, background: `${verdict.color}10` }}
          >
            <VerdictIcon size={16} style={{ color: verdict.color }} className="shrink-0" />
            <div className="min-w-0">
              <span className="text-[14px] font-semibold" style={{ color: verdict.color }}>
                {verdict.label}
              </span>
              <span
                className="ml-2 text-[11.5px]"
                style={{ color: `${verdict.color}cc` }}
              >
                {verdict.sublabel}
              </span>
            </div>
            <span
              className="ml-auto shrink-0 font-mono text-[13px]"
              style={{ color: verdict.color }}
            >
              {result.scan.riskScore}/100
            </span>
          </div>

          {/* 风险条款 */}
          {result.scan.risks.length > 0 ? (
            <div className="mb-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">
                风险条款 · {result.scan.risks.length} 项
              </div>
              <div className="space-y-2">
                {result.scan.risks.map((r) => (
                  <RiskItem key={r.type} risk={r} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2 text-[12px] text-[#6f6750]">
              <ShieldCheck size={14} style={{ color: ACCENT }} />
              未命中已知高危条款。
            </div>
          )}

          {/* 缺标准保护条款 */}
          {result.scan.missing.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">
                缺标准保护条款 · {result.scan.missing.length} 项
              </div>
              <div className="space-y-1">
                {result.scan.missing.map((m) => (
                  <div
                    key={m.what}
                    className="flex items-start gap-2 rounded-[8px] border border-dashed px-2.5 py-1.5 text-[11.5px]"
                    style={{ borderColor: '#ffffff12' }}
                  >
                    <span className="mt-0.5 shrink-0 text-[#E5B84D]">·</span>
                    <span>
                      <span className="text-[#d8cba8]">缺「{m.what}」</span>
                      <span className="text-[#5a6070]"> — {m.why}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 外部视角：史馆踩坑率 */}
          {result.topRiskHistory ? (
            <div
              className="rounded-[10px] border px-3 py-2"
              style={{ borderColor: `${ACCENT}22`, background: `${ACCENT}08` }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{ color: `${ACCENT}99` }}
              >
                外部视角 · 史馆同类条款踩坑率
              </div>
              <p className="mt-1 text-[11.5px]" style={{ color: '#9fba9f' }}>
                {result.topRiskHistory.rationale}
              </p>
            </div>
          ) : (
            <div
              className="rounded-[10px] border border-dashed px-3 py-2"
              style={{ borderColor: '#ffffff10' }}
            >
              <span className="text-[11px] text-[#5a6070]">
                史馆踩坑率: 无历史样本（接入中，传入真实旧合同案后生效）
              </span>
            </div>
          )}

          <p className="mt-2.5 text-[10px] text-[#4a5060]">
            AI 初审，非法律意见；高风险必人工/法务复核。
          </p>
        </div>
      )}

      {/* ── 空状态 ── */}
      {!result && !scanning && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-12"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <ShieldAlert size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">
            贴入合同文本，点「审查」出合规报告
          </p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            逐条匹配《民法典》法条，标风险等级与缺证
          </p>
        </div>
      )}

      <XingbuLegalSwarmPanel />
    </div>
  );
}
