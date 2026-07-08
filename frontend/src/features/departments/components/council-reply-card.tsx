'use client';

/**
 * 六部会审回奏卡 —— 把 orchestrate 真返回的 merge 结构（合议结论 + 分部门会签 + 硬冲突）
 * 摆给用户看，并在卡底落「采纳/补证/复核/驳回」拍板四键，接住被丢弃的 decisionId 写 sign-off
 * （主闭环铁律13.2-7:裁决必须持久化）。
 *
 * 诚实/安全铁律：
 * - 只渲染 merge 真返回的字段，缺字段不补、绝不伪造接地率/证据。
 * - 硬冲突(escalateToBoss)或高风险关键词 → 「采纳」默认禁用，逼走人工裁夺/确认门(铁律13.2-5)。
 * - sign-off 失败诚实标「裁决未持久化」，不静默吞；403 明示无权圣裁(需 admin/御座)。
 */

import { useState } from 'react';
import Link from 'next/link';
import type { OrchestrateMerge } from '@/lib/api/chaotang';
import { DEPT_AGENT_META } from '@/lib/swarm/dept-agent-meta';
import { withBasePath } from '@/lib/base-path';

const GOLD = '#F0C66A';

// #4 会审剧场(低成本档)：等待期把静止"会审中…"换成逐部脉冲亮灯的活体进度。
// 诚实:这是节奏感动画(CSS 错峰脉冲)，非真时序、绝不伪造"接地72%"等具体真数字——
// 真逐部回流要等 orchestrate 改 SSE(L 档)。
const PENDING_DEPTS = ['户部', '兵部', '刑部', '工部', '礼部', '吏部'];

export function CouncilPendingStrip() {
  return (
    <div className="space-y-1.5 text-[11px]">
      <div className="flex items-center gap-1.5 text-[10px] text-[#C6BB9D]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full" style={{ background: GOLD }} />
        六部会审中：召部门 live agent 逐部合议回奏…
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PENDING_DEPTS.map((d, i) => (
          <span
            key={d}
            className="animate-pulse-glow rounded-full border px-2 py-0.5 text-[10px]"
            style={{
              borderColor: `${GOLD}4d`,
              background: `${GOLD}10`,
              color: GOLD,
              animationDelay: `${i * 240}ms`,
            }}
          >
            ○ 召{d}
          </span>
        ))}
      </div>
    </div>
  );
}
// 高风险关键词(铁律13.2-5):命中则「采纳」必须过人工确认，禁一键静默落库。
const HIGH_RISK = /股权|合同|法律责任|重大付款|付款|对外报价|报价|客户承诺|承诺|供应商锁定|供应商|独家|违约金|预付款|不可逆/;

function groundBadge(grounded: boolean, rate?: number): { text: string; color: string } {
  const pct = typeof rate === 'number' && rate > 0 ? Math.round(rate * 100) : null;
  return grounded
    ? { text: pct != null ? `✅ 已接地 ${pct}%` : '✅ 已接地', color: '#3DD68C' }
    : { text: '⚠ 未接地 · 参考', color: '#F43F5E' };
}

export function CouncilReplyCard({
  merge,
  called,
  taskId,
  decisionId,
}: {
  merge: OrchestrateMerge;
  called: string[];
  taskId?: string;
  decisionId?: number | null;
}) {
  const escalate = merge.escalateToBoss;
  const contributors = merge.contributors ?? [];
  const canSign = typeof decisionId === 'number' && decisionId > 0;
  const highRisk = HIGH_RISK.test(merge.verdict ?? '');
  const adoptBlockReason = escalate ? '需先裁夺冲突' : highRisk ? '高风险·需人工确认' : '';

  const [outcome, setOutcome] = useState<{ action: 'signed' | 'rejected'; hash?: string } | null>(null);
  const [pending, setPending] = useState<null | 'signed' | 'rejected'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showAmend, setShowAmend] = useState(false);

  const signOff = async (action: 'signed' | 'rejected') => {
    if (!canSign || pending || outcome) return;
    if (action === 'signed' && adoptBlockReason) return;
    setPending(action);
    setErr(null);
    try {
      const res = await fetch(withBasePath('/api/court/orchestrate/sign-off'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decisionId, action }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; outcomeHash?: string; error?: string };
      if (!res.ok || !j.ok) {
        setErr(
          res.status === 403
            ? '无权圣裁（需御座/admin 账户）'
            : res.status === 409
              ? '此议已圣裁，不可重复'
              : j.error || `裁决未持久化（HTTP ${res.status}）`,
        );
        return;
      }
      setOutcome({ action, hash: j.outcomeHash });
    } catch {
      setErr('裁决未持久化（网络/服务中断）');
    } finally {
      setPending(null);
    }
  };

  const pill = 'rounded-md px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="space-y-2.5 text-[11px] leading-6">
      {/* 合议结论卡 */}
      <div
        className="rounded-lg border px-3 py-2"
        style={{
          borderColor: escalate ? '#F43F5E66' : `${GOLD}55`,
          background: escalate ? '#F43F5E10' : `${GOLD}0d`,
        }}
      >
        <div
          className="mb-1 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: escalate ? '#F8A6B4' : GOLD }}
        >
          <span>
            {escalate ? '⚠ 伏候圣裁 · 跨部门硬冲突' : `合议结论${merge.leadDept ? ` · 主判 ${merge.leadDept}` : ''}`}
          </span>
          <span
            className="ml-auto rounded px-1.5 py-0.5 text-[9px]"
            style={{
              background: merge.grounded ? '#3DD68C22' : '#6A729922',
              color: merge.grounded ? '#3DD68C' : '#9AA3C4',
            }}
          >
            {merge.grounded ? 'LIVE · 已接地' : '参考'}
          </span>
        </div>
        <div className="whitespace-pre-line font-medium text-[#F5E9C9]">{merge.verdict}</div>
      </div>

      {/* 分部门会签卡 */}
      {contributors.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#B6AB8C]">
            分部门会签 · {contributors.length} 部应奏
          </div>
          {contributors.map((c, i) => {
            const meta = DEPT_AGENT_META[c.dept];
            const gb = groundBadge(c.grounded, c.groundingRate);
            return (
              <div key={`${c.dept}-${i}`} className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span>{meta?.emoji ?? '🏛'}</span>
                  <span className="font-semibold" style={{ color: meta?.accent ?? GOLD }}>
                    {c.name || meta?.name || c.dept}
                  </span>
                  {typeof c.confidence === 'number' && c.confidence > 0 && (
                    <span className="text-[9px] text-[#6A7299]">置信 {Math.round(c.confidence * 100)}%</span>
                  )}
                  <span className="ml-auto rounded px-1.5 py-0.5 text-[9px]" style={{ background: `${gb.color}1a`, color: gb.color }}>
                    {gb.text}
                  </span>
                </div>
                {c.answer && <div className="whitespace-pre-line text-[#C6BB9D]">{c.answer}</div>}
                {c.conflicts && c.conflicts !== '无' && (
                  <div className="mt-1 text-[10px] text-[#F8A6B4]">⚠ 冲突：{c.conflicts}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 硬冲突并陈 */}
      {escalate && (merge.conflicts?.length ?? 0) > 0 && (
        <div className="space-y-1">
          {merge.conflicts.map((cf, i) => (
            <div key={i} className="rounded-md border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-2.5 py-1.5 text-[10px] text-[#F8A6B4]">
              <span className="font-semibold">{cf.depts.join(' vs ')}</span>：{cf.detail}
            </div>
          ))}
        </div>
      )}

      {/* 拍板四键(接住 decisionId 写 sign-off) */}
      {canSign && !outcome && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <button
            type="button"
            className={pill}
            style={{ background: '#3DD68C22', color: '#3DD68C', border: '1px solid #3DD68C55' }}
            disabled={!!adoptBlockReason || pending !== null}
            title={adoptBlockReason || undefined}
            onClick={() => signOff('signed')}
          >
            {pending === 'signed' ? '采纳中…' : adoptBlockReason ? `采纳（${adoptBlockReason}）` : '采纳'}
          </button>
          <button
            type="button"
            className={pill}
            style={{ background: '#F0C66A1a', color: GOLD, border: `1px solid ${GOLD}44` }}
            onClick={() => setShowAmend((v) => !v)}
          >
            补证
          </button>
          <Link
            href="/junjichu?view=council"
            className={`${pill} inline-flex items-center`}
            style={{ background: '#6BA0FF1a', color: '#6BA0FF', border: '1px solid #6BA0FF44' }}
          >
            送军机处复核
          </Link>
          <button
            type="button"
            className={pill}
            style={{ background: '#F43F5E1a', color: '#F8A6B4', border: '1px solid #F43F5E44' }}
            disabled={pending !== null}
            onClick={() => signOff('rejected')}
          >
            {pending === 'rejected' ? '驳回中…' : '驳回'}
          </button>
        </div>
      )}

      {showAmend && !outcome && (
        <div className="rounded-md border border-[#F0C66A]/25 bg-[#F0C66A]/[0.05] px-2.5 py-1.5 text-[10px] text-[#C6BB9D]">
          补证：在下方下旨框补充关键证据/材料后重新下旨，六部会带着新证据重审。
        </div>
      )}

      {/* 拍板回执：随真实 sign-off 成败定型，不静默 */}
      {outcome && (
        <div
          className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold"
          style={
            outcome.action === 'signed'
              ? { background: `${GOLD}1a`, color: GOLD, border: `1px solid ${GOLD}55` }
              : { background: '#6A729922', color: '#9AA3C4', border: '1px solid #6A729955' }
          }
        >
          {outcome.action === 'signed' ? '✅ 已采纳' : '⊘ 已驳回'}
          {taskId ? ` · ${taskId}` : ''}
          {outcome.hash ? ` · 链 ${outcome.hash.slice(0, 8)}` : ''}（已写哈希链留痕）
        </div>
      )}
      {err && (
        <div role="alert" className="rounded-md border border-[#F43F5E]/45 bg-[#F43F5E]/10 px-2.5 py-1.5 text-[10px] text-[#F8A6B4]">
          ⚠ {err}
        </div>
      )}

      {/* footer 留痕 */}
      <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-[#6A7299]">
        {called.length > 0 && <span>承办：{called.join('、')}</span>}
        {taskId && <span>· 台账 {taskId}</span>}
      </div>
    </div>
  );
}
