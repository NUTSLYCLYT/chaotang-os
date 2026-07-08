'use client';

/**
 * 共用 · 追问结构化答案面板（户部/兵部共用 · 2026-06-27）
 *
 * 单 agent 的 /ask 返回里已算好一堆信息(evidence/assumptions/conflicts/grounded门/model)，
 * 但旧卡片只露 answer + 接地率。本面板把全部亮出来——这是"追问做到极致"的核心：
 * 老板看到的不是一段 ChatGPT 文字，而是带逐字证据、显性假设、冲突声明、接地终止门的可信答复。
 *
 * accent 参数化(户部金 #F0C66A / 兵部蓝 #6BA0FF)，复用冻结帝金视觉系统。
 * groundingBadge 抽成纯函数并单测(铁律4)：grounded=false 时**绝不**显示绿色"已校验"。
 */
import { AlertTriangle, Quote, Sparkles } from 'lucide-react';

/** /ask 返回(已是 { ok, ...AgentResult } 的展开)。字段全可选——容忍降级与旧后端。 */
export interface AskResult {
  answer?: string;
  reasoning?: string;
  evidence?: string[];
  assumptions?: string[];
  conflicts?: string;
  confidence?: number | string;
  grounding?: { total: number; grounded: number; rate: number };
  /** 终止门：重写后仍有未接地数字 → false → 不发"已校验"徽标，降级警示。 */
  grounded?: boolean;
  reprompted?: boolean;
  model?: string;
  latencyMs?: number;
  error?: string;
  /** 401 未登录 → 体面降级:中性友好提示(不报红),并指明核心裁决无需登录已在上方。 */
  needsAuth?: boolean;
  /** needsAuth 提示里的部门名(如"户部"/"兵部")。 */
  deptName?: string;
}

export interface GroundingBadge {
  label: string;
  color: string;
  /** true = 警示态(红/黄)，UI 不得呈现为"可信已校验"。 */
  warn: boolean;
}

/**
 * groundingBadge —— 由接地终止门 + 接地率裁定徽标（纯函数，铁律4 回归点）。
 * 不变量：grounded===false → 永远红色警示、label 不含"已校验"。
 */
export function groundingBadge(result: AskResult): GroundingBadge {
  const g = result.grounding;
  const pct = g && g.total > 0 ? Math.round(g.rate * 100) : null;
  const detail = g && g.total > 0 ? `（${g.grounded}/${g.total} 数字有据）` : '';

  // 终止门未过：明确未接地，红色降级，绝不"已校验"。
  if (result.grounded === false) {
    return { label: `未接地·降级 · 数字未核实${detail}`, color: '#E5604D', warn: true };
  }
  if (pct === null) {
    return { label: '无数字断言', color: '#8f835f', warn: false };
  }
  if (pct >= 80) {
    return { label: `已校验 · 接地 ${pct}%${detail}`, color: '#5FB97A', warn: false };
  }
  return { label: `接地 ${pct}%${detail} · 待补据`, color: '#E5B84D', warn: true };
}

export interface DecisionTrust {
  /** 0-100 可信度分。 */
  score: number;
  label: string;
  color: string;
  /** 透明加减项（每条人话），让分数可解释、可信、难造假。 */
  factors: string[];
}

/**
 * decisionTrustScore —— 把散落的诚实信号(接地/证据/冲突声明/二次校验)打包成一个可售签名分。
 * 纯函数，零新判断逻辑——只聚合 AskResult 已算好的字段。
 * 护城河语义：未接地(grounded=false)封顶≤40；声明冲突/缺证 = 诚实加分(一个敢自我怀疑的 AI)。
 */
export function decisionTrustScore(result: AskResult): DecisionTrust {
  if (result.error || !result.answer) {
    return { score: 0, label: '无答复', color: '#8f835f', factors: [] };
  }
  const factors: string[] = [];
  let score = 50;

  const g = result.grounding;
  if (g && g.total > 0 && result.grounded !== false) {
    const add = Math.round(g.rate * 30);
    score += add;
    factors.push(`接地 ${Math.round(g.rate * 100)}%（${g.grounded}/${g.total} 数字有据）+${add}`);
  } else if (!g || g.total === 0) {
    score += 10;
    factors.push('无数字断言 · 中性 +10');
  }

  if ((result.evidence?.length ?? 0) > 0) {
    score += 15;
    factors.push(`引用 ${result.evidence!.length} 条逐字证据 +15`);
  }
  if (isMeaningfulConflict(result.conflicts)) {
    score += 15;
    factors.push('声明了会被谁推翻（诚实）+15');
  }
  if ((result.assumptions?.length ?? 0) > 0) {
    score += 5;
    factors.push(`显性标注 ${result.assumptions!.length} 处假设 +5`);
  }
  if (result.reprompted) {
    score += 5;
    factors.push('已二次校验 +5');
  }

  // 终止门未过 → 最后封顶 ≤40，证据/冲突加分也顶不破（护城河不变量）。
  if (result.grounded === false) {
    score = Math.min(score, 40);
    factors.push('⚠ 终止门未过·有数字未核实（封顶 40）');
  }
  score = Math.max(0, Math.min(100, score));
  const { label, color } =
    result.grounded === false
      ? { label: '谨慎 · 数字待核', color: '#E5604D' }
      : score >= 80
        ? { label: '高可信', color: '#5FB97A' }
        : score >= 60
          ? { label: '可信 · 待补据', color: '#E5B84D' }
          : { label: '谨慎', color: '#E5847A' };
  return { score, label, color, factors };
}

function isMeaningfulConflict(c: string | undefined): boolean {
  if (!c) return false;
  const t = c.trim();
  return t.length > 0 && t !== '无' && t !== '无。' && t !== 'N/A' && t !== 'none';
}

export function AskAnswerPanel({ result, accent }: { result: AskResult; accent: string }) {
  // 体面降级:未登录不报红 401,给中性友好提示 + 安抚"核心价值无需登录"。
  if (result.needsAuth) {
    return (
      <div className="mt-3 rounded-[12px] border px-3 py-2.5 text-[12px]" style={{ borderColor: `${accent}33`, background: `${accent}0a` }}>
        <p className="leading-relaxed text-[#c6bb9d]">
          登录后可在这里追问{result.deptName ?? ''}；
          <span style={{ color: accent }}>裁决、缺证、风险无需登录，已在上方</span>。
        </p>
      </div>
    );
  }
  if (result.error) {
    return (
      <div className="mt-3 rounded-[12px] border px-3 py-2.5 text-[12px]" style={{ borderColor: '#E5604D33', background: '#E5604D0d' }}>
        <p className="text-[#E5604D]">{result.error}</p>
      </div>
    );
  }

  const badge = groundingBadge(result);
  const trust = decisionTrustScore(result);
  const evidence = result.evidence ?? [];
  const assumptions = result.assumptions ?? [];
  const showConflict = isMeaningfulConflict(result.conflicts);

  return (
    <div className="mt-3 rounded-[12px] border px-3 py-2.5 text-[12px]" style={{ borderColor: '#ffffff14', background: '#ffffff06' }}>
      {/* 决策可信度签名分（vs ChatGPT 的护城河：一个敢自我怀疑的 AI） */}
      <div className="mb-2 flex items-center gap-2" title={trust.factors.join(' · ')}>
        <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: trust.color, fontFamily: 'var(--font-serif)' }}>
          {trust.score}
        </span>
        <span className="text-[10px] text-[#8f835f]">可信度</span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: trust.color, border: `1px solid ${trust.color}55`, background: `${trust.color}14` }}>
          {trust.label}
        </span>
      </div>

      {/* 主答复 */}
      <p className="leading-relaxed text-[#e6dcc0]">{result.answer}</p>

      {/* 逐字证据 */}
      {evidence.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: accent }}>
            <Quote size={11} /> 证据 · 逐字引用所依据数据
          </div>
          <ul className="space-y-1">
            {evidence.map((e, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[#c6bb9d]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 假设（仅数据真缺时） */}
      {assumptions.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[#8f835f]">
            <Sparkles size={11} /> 假设 · 数据缺口下的前提
          </div>
          <ul className="space-y-1">
            {assumptions.map((a, idx) => (
              <li key={idx} className="text-[11.5px] leading-relaxed text-[#a39a7e]">· {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 冲突声明 */}
      {showConflict && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-[8px] border px-2.5 py-1.5"
          style={{ borderColor: '#E5604D33', background: '#E5604D0a' }}>
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[#E5847A]" />
          <p className="text-[11px] leading-relaxed text-[#d8bfae]">
            <span className="text-[#E5847A]">冲突声明：</span>{result.conflicts}
          </p>
        </div>
      )}

      {/* 页脚：接地终止门徽标 + 置信 + model */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]">
        <span className="inline-flex items-center gap-1" style={{ color: badge.color }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: badge.color }} />
          {badge.label}
        </span>
        {result.confidence != null && <span className="text-[#8f835f]">置信 {result.confidence}</span>}
        {result.reprompted && <span className="text-[#8f835f]">· 已二次校验</span>}
        {result.model && <span className="text-[#6f6750]">· {result.model}</span>}
        {result.latencyMs != null && <span className="text-[#6f6750]">· {(result.latencyMs / 1000).toFixed(1)}s</span>}
      </div>
    </div>
  );
}
