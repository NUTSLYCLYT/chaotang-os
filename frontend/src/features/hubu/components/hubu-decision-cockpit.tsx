'use client';

/**
 * 户部 · 决策卷轴（中栏 hero · M1 · 2026-06-27）
 *
 * 只负责「全部待拍板」决策队列（态势→顶 header，班底→左 rail，急/办/值→右 rail）。
 * 每张拍板卡 = 30 秒拍板单元：三引擎真数字 + 随卡讲解 ❔ + 真 ask 追问(接地率)。
 * 复用冻结帝金系统；拍板写回属真实产线资产→后端 jiqun(铁律9)，本版只读+追问+意向。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, FileWarning, HelpCircle, Loader2, ShieldAlert, Skull, Sparkles } from 'lucide-react';

import { useHubuOverview } from '@/features/hubu/hooks/use-hubu-overview';
import { FINANCE_RISK_LABEL, type HubuProject } from '@/lib/contracts/hubu';
import { evaluateProject, type HubuVerdict } from '@/features/hubu/lib/hubu-engines';
import { HubuAddDecision } from '@/features/hubu/components/hubu-add-decision';
import { BomUploadAnalyze } from '@/features/hubu/components/bom-upload-analyze';
import {
  withRealDecisions,
  deriveIndustrySignalsFromIntel,
  forecastTricycleCellPrice,
  TRICYCLE_DECISION,
} from '@/features/hubu/lib/real-decisions';
import { useIntelSignals } from '@/lib/hooks/use-intel-signals';
import { AskAnswerPanel, type AskResult } from '@/features/shared/components/ask-answer-panel';
import { ruinForHubuProject, ruinBadge } from '@/features/qintian/lib/ruin-map';

const QINTIAN_PREDICTION_RECORDED_KEY = 'chaotang.qintian.predictionRecorded.tricycle-cell';

const ACCENT = '#F0C66A';

/** 可信度灯：由户部三引擎裁决驱动（真信号，不只看 risk_level）。 */
const VERDICT_LIGHT: Record<HubuVerdict, { dot: string; label: string }> = {
  approve: { dot: '#5FB97A', label: '准奏 · 数据足可签' },
  adjust: { dot: '#E5B84D', label: '削减 / 分阶段' },
  hold: { dot: '#8B93A7', label: '缺证 · 先别签' },
  reject: { dot: '#E5604D', label: '驳回' },
};

const PRIORITY_RANK: Record<HubuProject['priority'], number> = { P0: 0, P1: 1, P2: 2 };
const RISK_RANK: Record<HubuProject['risk_level'], number> = { critical: 0, high: 1, medium: 2, low: 3 };

function byUrgency(a: HubuProject, b: HubuProject): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || RISK_RANK[a.risk_level] - RISK_RANK[b.risk_level];
}

const QUEUE_VISIBLE = 6;

/** 标题清洗：把"请军机处围绕『真问题』…"提炼成真问题；过长截断。 */
function cleanTitle(raw: string): string {
  const quoted = raw.match(/[“"]([^”"]{4,})[”"]/);
  const base = (quoted ? quoted[1] : raw.replace(/^请[^，。：:、]{0,10}(围绕|就|对|审查|判断)\s*/, '')).trim();
  return base.length > 40 ? `${base.slice(0, 40)}…` : base;
}

function panelStyle(accent: string) {
  return {
    borderColor: `${accent}26`,
    background: `linear-gradient(180deg, ${accent}12 0%, rgba(6, 8, 14, 0.92) 100%)`,
  } as const;
}

export function HubuDecisionCockpit() {
  const { overview, isLoading, error } = useHubuOverview();
  const { signals: intelSignals } = useIntelSignals();
  const [asking, setAsking] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AskResult>>({});
  const [showAll, setShowAll] = useState(false);
  const [openExplain, setOpenExplain] = useState<string | null>(null);

  // 样本只在「加载完成且真行确为空」时兜底,绝不在加载中或置顶冒充权威(贝索斯警示 + 用户「样本明标」决策)。
  const realProjects = overview?.projects ?? [];
  const usingSample = !isLoading && !error && realProjects.length === 0;
  const industrySignals = deriveIndustrySignalsFromIntel(intelSignals);
  const projects = (usingSample ? withRealDecisions([], industrySignals) : realProjects).sort(byUrgency);
  const shown = showAll ? projects : projects.slice(0, QUEUE_VISIBLE);
  const cellForecast = forecastTricycleCellPrice(industrySignals);

  // 钦天监事件预测→部门学习记录(2026-07-04)：本次预测真引用了锦衣卫信号时，把它记一笔
  // observing 记录(citedSignalIds 溯源)，供日后回填 confirmed/refuted 时按信号来源算可靠度
  // (department-flywheel-recap.tsx 展示)。每个浏览器会话最多写一次，不随 SWR 轮询反复写库。
  useEffect(() => {
    if (cellForecast.citedSignalIds.length === 0) return;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(QINTIAN_PREDICTION_RECORDED_KEY) === '1') return;
    window.sessionStorage.setItem(QINTIAN_PREDICTION_RECORDED_KEY, '1');
    void fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/court/learning/qintian-prediction`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: '电芯 LFP32Ah 涨跌趋势', forecast: cellForecast }),
    }).catch(() => {
      // 记录失败不影响页面：未登录/网络异常时静默跳过，不阻断驾驶舱渲染。
      window.sessionStorage.removeItem(QINTIAN_PREDICTION_RECORDED_KEY);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellForecast.citedSignalIds.join(',')]);

  async function askProject(p: HubuProject) {
    setAsking(p.id);
    try {
      const command = p.command?.trim() || `「${p.title}」预算${p.requested_budget}——该批还是该退？给数据依据。`;
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/court/hubu/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (res.status === 401) {
        // 体面降级:未登录不报红 401,提示"登录后可问"+ 安抚核心裁决无需登录。
        setAnswers((s) => ({ ...s, [p.id]: { needsAuth: true, deptName: '户部' } }));
        return;
      }
      const json = (await res.json()) as AskResult & { ok?: boolean; error?: string };
      setAnswers((s) => ({
        ...s,
        [p.id]: !res.ok || json.ok === false ? { error: json.error ?? `户部暂时无法应答（${res.status}）` } : json,
      }));
    } catch {
      setAnswers((s) => ({ ...s, [p.id]: { error: '网络异常，户部未应答' } }));
    } finally {
      setAsking(null);
    }
  }

  return (
    <section id="hubu-decision-queue" className="flex min-h-0 flex-col gap-3 pr-1">
      <div className="flex items-center justify-between gap-2">
        <h2 className="display-serif flex items-center gap-2 text-[16px] text-[#F5E9C9]">
          今日待陛下拍板{projects.length ? ` · ${projects.length} 件` : ''}
          {overview?.summary?.source === 'fallback' && (
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-normal" style={{ borderColor: '#E5B84D55', color: '#E5B84D' }}>
              演示 / 兜底数据
            </span>
          )}
        </h2>
        <HubuAddDecision />
      </div>

      <div className="mt-3"><BomUploadAnalyze /></div>

      {!isLoading && usingSample && (
        <div
          className="flex items-start gap-2 rounded-[10px] border px-3 py-2 text-[12px]"
          style={{ borderColor: '#E5B84D33', background: '#E5B84D12', color: '#F3D08A' }}
        >
          <span className="mt-0.5">ⓘ</span>
          <span>
            主库暂无真立项(或需真后端登录)——下方为<strong>户部真决策样本</strong>(real-decisions.ts),
            <span className="text-[#9aa0ad]">非编造、非 mock。上书房下一道含预算的旨意后,此处即换主库真行(LIVE)。</span>
          </span>
        </div>
      )}

      {isLoading && <SkeletonCard />}
      {error && <p className="body-copy text-[#E5604D]">户部总览暂时拉取失败，请稍后重试。</p>}
      {!isLoading && !error && projects.length === 0 && (
        <p className="body-copy text-[#b6ab8c]">当前没有待拍板的财务事项。户部待命中。</p>
      )}

      {shown.map((p) => {
        const ev = evaluateProject(p);
        const tl = VERDICT_LIGHT[ev.verdict];
        const ans = answers[p.id];
        const ruin = ruinBadge(ruinForHubuProject(p));
        return (
          <article key={p.id} className="hud-corner relative rounded-[16px] border px-4 py-3.5" style={panelStyle(ACCENT)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: p.priority === 'P0' ? '#E5604D22' : '#F0C66A18', color: p.priority === 'P0' ? '#E5604D' : ACCENT }}
                  >
                    {p.priority}
                  </span>
                  <h3 className="truncate text-[15px] font-medium text-[#F5E9C9]" title={p.title}>
                    {cleanTitle(p.title)}
                  </h3>
                </div>
                <div className="mt-1 text-[12px] text-[#b6ab8c]">
                  预算 <span className="text-[#E9DDBE]">{p.requested_budget}</span> · 回报{' '}
                  <span className="text-[#E9DDBE]">{ev.roiMultiple != null ? `${ev.roiMultiple}x` : '缺证'}</span> · 回收{' '}
                  {p.payback_window && p.payback_window !== '—' ? p.payback_window : '缺证'}
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px]" style={{ color: tl.dot }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tl.dot }} />
                {tl.label}
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5 text-[12.5px] leading-relaxed">
              <p className="text-[#d8cba8]">
                <span className="text-[#8f835f]">户部裁决：</span>
                <span className="font-medium" style={{ color: tl.dot }}>{ev.verdictCn}</span>
                <span className="text-[#9aa0ad]"> — 评分 {ev.score ?? '缺'} · 敞口 {ev.exposure ?? '缺'}</span>
                {/* 质检/防幻觉显形:数据有几项有据,缺则标缺、绝不编 */}
                <span
                  className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: ev.quality.missing ? '#E5B84D1a' : '#5FB97A1a', color: ev.quality.missing ? '#E5B84D' : '#5FB97A' }}
                >
                  质检 {ev.quality.grounded}/{ev.quality.total} 有据{ev.quality.missing ? `· ${ev.quality.missing} 项缺证` : '· 无编造'}
                </span>
              </p>
              {ev.cashStress && (
                <p className="flex items-start gap-1 rounded-[8px] px-1.5 py-1 text-[#E5604D]" style={{ background: '#E5604D14' }}>
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span><span className="font-medium">现金缺口</span> · {ev.cashNote?.replace('现金压力：', '')} · 小老板最致命的是现金断流</span>
                </p>
              )}
              {ev.oneWayDoor.oneWay && (
                <p className="flex items-start gap-1 rounded-[8px] px-1.5 py-1 text-[#E5604D]" style={{ background: '#E5604D12' }}>
                  <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">单向门 · 需陛下亲裁</span>
                    <span className="text-[#c9837a]">（{ev.oneWayDoor.reasons.join('、')}）· 禁一键静默准奏</span>
                  </span>
                </p>
              )}
              {ev.missing.length > 0 && (
                <p className="flex items-start gap-1 text-[#9aa0ad]">
                  <FileWarning size={13} className="mt-0.5 shrink-0" />
                  <span><span className="text-[#8f835f]">缺证：</span>{ev.missing.join('、')}</span>
                </p>
              )}
              <p className="flex items-start gap-1 text-[#c9a86a]">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>
                  <span className="text-[#8f835f]">最大风险：</span>
                  {p.cash_flow_pressure && p.cash_flow_pressure !== '—'
                    ? p.cash_flow_pressure
                    : `风险 ${FINANCE_RISK_LABEL[p.risk_level]}`}
                </span>
              </p>
              {ruin.veto && (
                <div className="flex items-start gap-1.5 rounded-[8px] border px-2 py-1.5 text-[12px]" style={{ borderColor: '#E5604D44', background: '#E5604D12', color: '#E5847A' }}>
                  <Skull size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium text-[#E5604D]">钦天监 · 死法地图一票否决</span>
                    <span className="text-[#8f835f]"> — 触 ruin 红线 [{ruin.redlines.join(' · ')}]</span>
                    <span className="text-[#9aa0ad]">（仅据风险级判，户部字段不含合同/承诺语义；后果不可逆，不看回报多漂亮）</span>
                  </span>
                </div>
              )}

              <button
                onClick={() => setOpenExplain((id) => (id === p.id ? null : p.id))}
                className="inline-flex items-center gap-1 text-[11.5px] text-[#b6ab8c] transition hover:text-[#F5E9C9]"
              >
                <HelpCircle size={13} />
                {openExplain === p.id ? '收起讲解' : '户部讲解 · 每个数字怎么来的'}
              </button>
              {openExplain === p.id && (
                <div className="space-y-1 rounded-[10px] border px-2.5 py-2 text-[11.5px] text-[#bdb191]" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
                  <p>❔ 回报：{ev.explain.roi}</p>
                  <p>❔ 敞口：{ev.explain.exposure}</p>
                  <p>❔ 评分：{ev.explain.score}</p>
                  <p>❔ 裁决：{ev.explain.verdict}</p>
                  {p.id === TRICYCLE_DECISION.id && (
                    <p className="pt-1" style={{ borderTop: '1px solid #ffffff0f' }}>
                      <span className="text-[#B794F4]">🔭 钦天监电芯{cellForecast.directionCn}证伪条件：</span>
                      {cellForecast.falsifiedBy}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VerdictButton label="准奏预览" tone="approve" />
              <VerdictButton label="补证预览" tone="neutral" />
              <VerdictButton label="驳回预览" tone="reject" />
              <Link
                href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/departments/finance?newBudget=1`}
                className="rounded-full border px-3 py-1 text-[12px] text-[#F0C66A] transition hover:brightness-125"
                style={{ borderColor: `${ACCENT}50`, background: `${ACCENT}12` }}
              >
                新建真实预算案
              </Link>
              <button
                onClick={() => askProject(p)}
                disabled={asking === p.id}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] text-[#E9DDBE] transition hover:text-[#fff] disabled:opacity-60"
                style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}12` }}
              >
                {asking === p.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                追问户部
              </button>
            </div>

            {ans && <AskAnswerPanel result={ans} accent={ACCENT} />}
          </article>
        );
      })}

      {projects.length > QUEUE_VISIBLE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 self-center rounded-full border px-4 py-1.5 text-[12px] text-[#d8cba8] transition hover:text-[#F5E9C9]"
          style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0c` }}
        >
          {showAll ? `收起 · 只看最急的 ${QUEUE_VISIBLE} 件` : `还有 ${projects.length - QUEUE_VISIBLE} 件待批 · 展开全部`}
        </button>
      )}
    </section>
  );
}

function VerdictButton({ label, tone }: { label: string; tone: 'approve' | 'reject' | 'neutral' }) {
  const color = tone === 'approve' ? '#5FB97A' : tone === 'reject' ? '#E5604D' : '#b6ab8c';
  return (
    <button
      disabled
      title="预览队列没有 decision brief；请进入真实预算案后裁决。"
      className="cursor-not-allowed rounded-full border px-3 py-1 text-[12px] opacity-70"
      style={{ borderColor: `${color}50`, color, background: `${color}10` }}
    >
      {label}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[16px] border px-4 py-4" style={panelStyle(ACCENT)}>
      <div className="h-4 w-1/3 rounded bg-white/10" />
      <div className="mt-3 h-3 w-2/3 rounded bg-white/5" />
      <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
    </div>
  );
}
