'use client';

/**
 * 丞相参谋 · 先压判断与缺证(借鉴 Claude Code 交互 DNA · 2026-07-01)
 *
 * 把户部决策做成「先想再写」的可信参谋:受理回执→分析计划(待办+状态)→缺证可执行→大神视角→永远可拒。
 * 主体确定性(analyzeForChancellor 纯函数,零幻觉);自由追问走真 /api/court/hubu/ask(askHubu 接地大脑)。
 * 复用冻结帝金系统 + AskAnswerPanel(铁律3 不造第二套答案面板)。
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Circle, Loader2, Sparkles, ClipboardCheck, ListChecks, Swords, Users, ShieldCheck, Ban } from 'lucide-react';

import type { HubuEvaluation } from '@/features/hubu/lib/hubu-engines';
import type { HubuProject } from '@/lib/contracts/hubu';
import { analyzeForChancellor, type PlanStatus } from '@/features/hubu/lib/chancellor-analysis';
import { hubuEvaluationToOpinion } from '@/features/hubu/lib/hubu-opinion-bridge';
import { governChancellor, DEPT_CN } from '@/features/hubu/lib/chancellor-governance';
import { runCourtUnifiedDecisionLoop } from '@/core/courtos/unified/unified-decision-loop';
import type { UnifiedSignal } from '@/core/courtos/unified/unified-types';
import { AskAnswerPanel, type AskResult } from '@/features/shared/components/ask-answer-panel';

const SIGNAL_COLOR: Record<UnifiedSignal, string> = { GREEN: '#5FB97A', YELLOW: '#E5B84D', RED: '#E5604D', GRAY: '#8f835f' };

const C = {
  warm: '#F5E9C9', dim: '#c6bb9d', muted: '#9aa0ad', faint: '#6f6750',
  gold: '#D4A84B', goldBright: '#F0C66A', hubu: '#5FB97A', amber: '#E5B84D', danger: '#E5604D',
};
const ACCENT = '#F0C66A';

const STATUS_ICON: Record<PlanStatus, React.ReactNode> = {
  done: <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: C.hubu }} />,
  warn: <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: C.amber }} />,
  todo: <Circle size={13} className="mt-0.5 shrink-0" style={{ color: C.faint }} />,
};

export function ChancellorAnalysis({ project, ev, live = false }: { project: HubuProject; ev: HubuEvaluation; live?: boolean }) {
  const a = analyzeForChancellor(project, ev);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [showPlan, setShowPlan] = useState(false); // 分析计划默认收起(减法·合并瘦身)

  // 接点①:丞相跨部会审——户部声音用真主库数字裁决注入,矛盾显形免费拿到(确定性,可降级)。
  const unified = useMemo(
    () =>
      runCourtUnifiedDecisionLoop({
        rawQuestion: project.command?.trim() || project.title,
        taskId: project.id,
        sourceLabel: 'MIXED',
        financeOpinionOverride: hubuEvaluationToOpinion(ev, live ? 'LIVE' : 'FALLBACK'),
      }),
    [project.id, project.command, project.title, ev, live],
  );
  const convened = unified.departmentOpinions;
  const conflicts = unified.conflicts.slice(0, 3);
  // 接点③:把判词校验成可签裁断 + 把铁律9 边界变运行时(采纳碰真产线 → 要旨+人工门)。
  const gov = useMemo(() => governChancellor(ev, unified.conflicts), [ev, unified.conflicts]);

  async function ask() {
    setAsking(true);
    try {
      const command = project.command?.trim() || `「${project.title}」预算${project.requested_budget}——该批还是该退？给数据依据。`;
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/court/hubu/ask`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command }),
      });
      if (res.status === 401) { setAnswer({ needsAuth: true, deptName: '户部' }); return; }
      const json = (await res.json()) as AskResult & { ok?: boolean; error?: string };
      setAnswer(!res.ok || json.ok === false ? { error: json.error ?? `丞相暂时无法应答（${res.status}）` } : json);
    } catch {
      setAnswer({ error: '网络异常,丞相未应答' });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="mt-3 rounded-[16px] border px-4 py-3.5" style={{ borderColor: `${ACCENT}26`, background: 'linear-gradient(180deg, rgba(240,198,106,0.06) 0%, rgba(6,8,14,0.92) 100%)' }}>
      {/* 抬头 */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] text-[12px]" style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, color: C.goldBright, fontFamily: 'var(--font-serif)' }}>丞</span>
        <span className="display-serif text-[14px]" style={{ color: C.warm }}>丞相参谋 · 先压判断与缺证</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${C.hubu}44`, color: C.hubu, background: `${C.hubu}12` }}>确定性 · 非编造</span>
      </div>

      {/* 1. 受理回执 + 可验证目标(减法·合并瘦身:压成一行,验收内联) */}
      <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed" style={{ color: C.dim }}>
        <ClipboardCheck size={12} className="mt-0.5 shrink-0" style={{ color: C.faint }} />
        <span><span style={{ color: C.warm }}>受理:</span>{a.goal}<span style={{ color: C.faint }}> · 验收 {a.acceptance.join(' / ')}</span></span>
      </p>

      {/* 2. 分析计划(减法·合并瘦身:默认收起,点开看过程) */}
      <div className="mt-2">
        <button
          onClick={() => setShowPlan((v) => !v)}
          className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] transition hover:brightness-125"
          style={{ color: C.faint }}
        >
          <ListChecks size={11} /> {showPlan ? '收起分析过程' : '看分析过程 · 5 步'}
        </button>
        {showPlan && (
          <ul className="mt-1 space-y-1">
            {a.plan.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] leading-relaxed">
                {STATUS_ICON[s.status]}
                <span><span style={{ color: C.warm }}>{s.step}</span><span style={{ color: C.muted }}> · {s.note}</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 丞相·跨部会审:召几部 + 矛盾显形 + 合成判词(接点① · 丞相第一次跨部) */}
      <div className="mt-3">
        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]" style={{ color: C.faint }}>
          <Users size={11} /> 丞相 · 跨部会审 · 召 {convened.length} 部
        </div>
        {/* 第三刀(减法):有冲突才铺部门药丸 + 分歧;无冲突只留一句合奏,不堆空白装饰 */}
        {conflicts.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {convened.map((o) => (
                <span key={o.departmentId} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ border: `1px solid ${SIGNAL_COLOR[o.signal]}44`, background: `${SIGNAL_COLOR[o.signal]}12`, color: C.dim }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: SIGNAL_COLOR[o.signal] }} />
                  {DEPT_CN[o.departmentId]}
                </span>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              {conflicts.map((c, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed" style={{ color: '#E5847A' }}>
                  <Swords size={12} className="mt-0.5 shrink-0" />
                  <span><span style={{ color: C.warm }}>{DEPT_CN[c.between[0]]} × {DEPT_CN[c.between[1]]}</span> · {c.summary}</span>
                </p>
              ))}
            </div>
          </>
        )}
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.dim }}>
          <span style={{ color: C.gold }}>丞相合奏:</span>{unified.memorial.oneSentence}
          {conflicts.length === 0 && <span style={{ color: C.faint }}> · 各部口径一致</span>}
        </p>
      </div>

      {/* 3. 缺证 → 可执行 */}
      {a.missingActions.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.16em]" style={{ color: C.amber }}>缺证 → 可执行下一步</div>
          <div className="flex flex-wrap gap-1.5">
            {a.missingActions.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11.5px]" style={{ borderColor: `${C.amber}40`, background: `${C.amber}10`, color: '#F3D08A' }}>
                {m.label}<span style={{ color: C.faint }}>{m.hint}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. 大神视角 */}
      <div className="mt-3 rounded-[10px] border px-3 py-2" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
        <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>🎲 大神视角 · {a.expert.who}</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: '#E5847A' }}>⚠️ {a.expert.warning}</p>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: C.hubu }}>💡 {a.expert.advice}</p>
      </div>

      {/* 丞相裁断 · 可签 + 采纳边界(接点③:ZChancellorDecision 校验 + 铁律9 运行时闸) */}
      <div className="mt-3 rounded-[10px] border px-3 py-2" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: C.gold }}>
          <ShieldCheck size={11} /> 丞相裁断 · 可签
          <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${gov.decisionValid ? C.hubu : C.danger}44`, color: gov.decisionValid ? C.hubu : C.danger, background: `${gov.decisionValid ? C.hubu : C.danger}12` }}>
            {gov.decisionValid ? '已校验 · 无套话' : '校验未过'}
          </span>
          <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${gov.decision?.reversibility === 'one_way_door' ? C.danger : C.muted}44`, color: gov.decision?.reversibility === 'one_way_door' ? C.danger : C.muted }}>
            {gov.decision?.reversibility === 'one_way_door' ? '单向门' : '双向门'}
          </span>
        </div>
        {gov.decision ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed" style={{ color: '#E5847A' }}>
            <Ban size={12} className="mt-0.5 shrink-0" />
            <span><span style={{ color: C.warm }}>绝不:</span>{gov.decision.theThingToNotDo.action} — {gov.decision.theThingToNotDo.reason}</span>
          </p>
        ) : (
          // 校验未过 → 保守优先,不静默隐藏约束(会审 MEDIUM-3)
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed" style={{ color: '#E5847A' }}>
            <Ban size={12} className="mt-0.5 shrink-0" />
            <span>裁断校验未过 — 保守起见:先不推进,补证后重判,不得当定论采纳</span>
          </p>
        )}
        <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: gov.acceptAction.mode === 'execute' ? '#F3D08A' : C.faint }}>
          {gov.acceptAction.mode === 'execute'
            ? '⚠ 采纳=碰真产线资产,须有旨 + 过人工确认门(铁律9,丞相不自动执行)'
            : '丞相可自治先压(纯认知·闸前),无需旨'}
        </p>
      </div>

      {/* 追问(真 LLM 接地大脑) */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={ask}
          disabled={asking}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] transition hover:brightness-125 disabled:opacity-60"
          style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}12`, color: '#E9DDBE' }}
        >
          {asking ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          追问丞相 · 要逐字证据
        </button>
        <span className="text-[11px]" style={{ color: C.faint }}>自由追问走真接地大脑(/ask)</span>
      </div>
      {answer && <AskAnswerPanel result={answer} accent={ACCENT} />}

      {/* 5. 永远可拒(第四刀:压成单行,不再独立 border 块) */}
      <p className="mt-2 text-[11px] leading-relaxed" style={{ color: C.faint }}>{a.rejectable}</p>
    </div>
  );
}
