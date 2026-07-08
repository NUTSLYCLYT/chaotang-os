'use client';

/**
 * 单 agent · 问责面板（通用）—— 把"对答案负责"摆给用户看：
 * 答案 + 证据(逐字引用) + 数字接地徽标 + 冲突声明。accent 由部门主色注入。
 */

import type { AgentResult } from '@/lib/swarm/dept-agent';

export function AgentAnswerCard({ result, accent }: { result: AgentResult; accent: string }) {
  const g = result.grounding;
  const pct = Math.round((g?.rate ?? 0) * 100);
  const fullyGrounded = (g?.ungrounded?.length ?? 0) === 0;

  return (
    <div className="space-y-2.5 text-[11px] leading-6">
      {/* 终止 gate（会审 #1）：重写后仍未接地 → 降级横幅，不发"已校验"信号 */}
      {!fullyGrounded && (
        <div
          className="rounded-lg border px-2.5 py-1.5 text-[10px] leading-5 font-medium"
          style={{ borderColor: '#F43F5E66', background: '#F43F5E14', color: '#F43F5E' }}
        >
          ⚠️ 本回答含 {g?.ungrounded?.length ?? 0} 个未接地数字（重写后仍无依据），已降级为参考——
          请核对原始数据后再决策，勿直接据此采信。
        </div>
      )}

      <div
        className="whitespace-pre-line font-medium text-[#F5E9C9]"
        style={fullyGrounded ? undefined : { opacity: 0.7 }}
      >
        {result.answer}
      </div>

      {result.evidence.length > 0 && (
        <div>
          <div className="mb-1 text-[9px] uppercase tracking-[0.18em]" style={{ color: accent }}>
            📑 证据 · {result.evidence.length}
          </div>
          <ul className="space-y-0.5">
            {result.evidence.map((e, i) => (
              <li key={i} className="flex gap-1.5 text-[#C6BB9D]">
                <span style={{ color: accent }}>·</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={
            fullyGrounded
              ? { borderColor: '#3DD68C55', background: '#3DD68C14', color: '#3DD68C' }
              : { borderColor: '#FB923C55', background: '#FB923C14', color: '#FB923C' }
          }
        >
          {fullyGrounded ? '✅' : '⚠️'} 数字接地 {g?.grounded ?? 0}/{g?.total ?? 0} = {pct}%
        </span>
        {/* 会审升级：证据绑定（answer 数字是否也进了 evidence[]）—— 比纯溯源更接近"数字↔断言绑定" */}
        {result.evidenceBinding && result.evidenceBinding.total > 0 && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px]"
            style={
              result.evidenceBinding.ungrounded.length === 0
                ? { borderColor: '#3DD68C44', color: '#3DD68C' }
                : { borderColor: '#FB923C44', color: '#FB923C' }
            }
          >
            证据绑定 {result.evidenceBinding.grounded}/{result.evidenceBinding.total}
          </span>
        )}
        {/* 会审共识：grep 只证"数字可溯源"，不证"用对了" —— 不向用户暗示已校验正确性 */}
        <span className="text-[9px] text-[#6A7299]">仅溯源·非正确性</span>
        <span className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-[#9AA3C4]">
          置信 {result.confidence}
        </span>
        {result.reprompted && (
          <span className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-[#9AA3C4]">
            已重写一次
          </span>
        )}
      </div>

      {result.conflicts && result.conflicts !== '无' && (
        <div
          className="rounded-lg border px-2.5 py-1.5 text-[10px] leading-5"
          style={{ borderColor: '#FB923C33', background: '#FB923C08', color: '#D6CCB0' }}
        >
          <span className="mr-1 text-[9px] uppercase tracking-[0.16em]" style={{ color: '#FB923C' }}>
            ⚠️ 冲突
          </span>
          {result.conflicts}
        </div>
      )}
    </div>
  );
}
