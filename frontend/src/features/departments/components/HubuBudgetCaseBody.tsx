'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AlertTriangle, CheckCircle2, Send, ShieldCheck, WalletCards } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

type LineItem = {
  id?: string;
  title?: string;
  category?: string;
  amount?: number;
  currency?: string;
  evidenceRefs?: string[];
  confidence?: string;
};

type LoopCase = {
  taskId: string;
  stage: string;
  task?: { rawCommand?: string; result?: Record<string, unknown> } | null;
  issue?: { id?: string; title?: string; question?: string; intent?: string } | null;
  evidencePacks?: Array<{ id: string; pack: Record<string, unknown> }>;
  memorials?: Array<{ id: string; memorial: Record<string, unknown> }>;
  decisionBrief?: { id: string; status: string; brief: Record<string, unknown> } | null;
  instruction?: { id: string; status: string; instruction: Record<string, unknown> } | null;
};

const inputClass = 'w-full rounded-[8px] border border-[#7A4A08]/20 bg-[#FFF8E0]/45 px-3 py-2 text-[12px] text-[#281C0A] outline-none focus:border-[#8A6A2A]/55';

async function fetchCase(path: string): Promise<LoopCase> {
  const response = await fetch(withBasePath(path), { cache: 'no-store' });
  const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: LoopCase; error?: string } | null;
  if (!response.ok || payload?.success !== true || !payload.data) {
    throw new Error(payload?.error ?? `request_failed:${response.status}`);
  }
  return payload.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function lines(value: unknown): LineItem[] {
  return Array.isArray(value) ? value.filter(isRecord).map((item) => item as LineItem) : [];
}

function money(amount: unknown, currency: unknown): string {
  const numeric = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `${typeof currency === 'string' ? currency : 'CNY'} ${Math.round(numeric).toLocaleString('en-US')}`;
}

function budgetRecord(data: LoopCase): Record<string, unknown> {
  const brief = data.decisionBrief?.brief ?? {};
  if (brief.budgetKind === 'research_department_budget') return brief;
  return data.memorials?.find((item) => item.memorial.budgetKind === 'research_department_budget')?.memorial
    ?? data.evidencePacks?.find((item) => item.pack.packType === 'internal_research_budget')?.pack
    ?? {};
}

export function HubuBudgetCaseBody({ taskId, accent }: { taskId: string; accent: string }) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/court/shangshufang/finance-intel-loop/cases/${encodeURIComponent(taskId)}`,
    fetchCase,
  );
  const [reason, setReason] = useState('已核对圣旨原文、户部预算明细和锦衣卫证据边界。');
  const [manualConfirmation, setManualConfirmation] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const budget = useMemo(() => (data ? budgetRecord(data) : {}), [data]);
  const lineItems = lines(budget.lineItems);
  const missingEvidence = Array.from(new Set([
    ...stringArray(budget.missingEvidence),
    ...stringArray(isRecord(budget.evidenceSummary) ? budget.evidenceSummary.missingEvidence : undefined),
  ]));
  const riskGate = isRecord(budget.riskGate) ? budget.riskGate : {};
  const requiresManualConfirmation = riskGate.manualConfirmationRequired === true;
  const sacredEdict = data?.issue?.question ?? data?.task?.rawCommand ?? '圣旨原文未登记';
  const canDecide = data?.stage === 'awaiting_authorized_decision' && Boolean(data.decisionBrief?.id);

  async function submitDecision(decision: string) {
    if (!data?.decisionBrief?.id) return;
    setBusy(decision);
    setDecisionError(null);
    try {
      const response = await fetch(withBasePath(`/api/court/shangshufang/briefs/${encodeURIComponent(data.decisionBrief.id)}/decision/advance`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason, executionType: 'no_action_archive', manualConfirmation }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error ?? `decision_failed:${response.status}`);
      await mutate();
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'decision_failed');
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <ScrollNotice text="户部正在调取预算案卷。" />;
  if (error) return <ScrollNotice text={`案卷读取失败：${error.message}`} danger />;
  if (!data) return <ScrollNotice text="未找到预算案卷。" danger />;

  return (
    <div className="space-y-4 text-[#281C0A]">
      <section className="rounded-[10px] border border-[#7A4A08]/20 bg-[#FFF8E0]/42 p-4">
        <div className="flex items-center gap-2 text-[12px] font-bold tracking-[0.18em]" style={{ color: accent }}>
          <ShieldCheck size={14} />
          圣旨原文
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[14px] font-semibold leading-7">{sacredEdict}</p>
        <div className="mt-3 grid gap-2 text-[11px] text-[#6F5830] md:grid-cols-3">
          <span>taskId: {data.taskId}</span>
          <span>issueId: {data.issue?.id ?? '未登记'}</span>
          <span>briefId: {data.decisionBrief?.id ?? '待生成'}</span>
        </div>
      </section>

      <section className="rounded-[10px] border border-[#7A4A08]/20 bg-[#FFF4CC]/38 p-4">
        <div className="flex items-center gap-2 text-[12px] font-bold tracking-[0.18em]" style={{ color: accent }}>
          <WalletCards size={14} />
          户部承办正文
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Metric label="结论" value={missingEvidence.length ? '暂不可准奏' : canDecide ? '待授权裁决' : data.stage} tone={missingEvidence.length ? 'red' : 'green'} />
          <Metric label="预算" value={money(budget.requestedAmount, budget.currency)} />
          <Metric label="证据完整度" value={`${Number(budget.evidenceCompleteness ?? 0)}%`} />
          <Metric label="人工确认" value={requiresManualConfirmation ? '必须' : '未触发'} tone={requiresManualConfirmation ? 'red' : 'green'} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead className="text-[#6F5830]">
              <tr className="border-b border-[#7A4A08]/18">
                <th className="py-2 pr-3">预算项</th>
                <th className="py-2 pr-3">类别</th>
                <th className="py-2 pr-3">金额</th>
                <th className="py-2 pr-3">证据</th>
                <th className="py-2">置信度</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={item.id ?? index} className="border-b border-[#7A4A08]/12 last:border-b-0">
                  <td className="py-2 pr-3 font-semibold">{item.title ?? item.id ?? `预算项 ${index + 1}`}</td>
                  <td className="py-2 pr-3">{item.category ?? 'other'}</td>
                  <td className="py-2 pr-3">{money(item.amount, item.currency)}</td>
                  <td className="py-2 pr-3">{(item.evidenceRefs ?? []).join(', ') || '缺证'}</td>
                  <td className="py-2">{item.confidence ?? 'low'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {missingEvidence.length > 0 ? (
          <div className="mt-4 rounded-[8px] border border-[#9B3A2D]/25 bg-[#9B3A2D]/10 p-3">
            <div className="flex items-center gap-2 text-[12px] font-bold text-[#8D2E25]">
              <AlertTriangle size={14} />
              缺证清单
            </div>
            <ul className="mt-2 space-y-1 text-[12px] leading-5">
              {missingEvidence.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </div>
        ) : (
          <div className="mt-4 rounded-[8px] border border-[#4B7F3A]/25 bg-[#4B7F3A]/10 p-3 text-[12px] text-[#315A28]">
            <CheckCircle2 className="mr-1 inline" size={14} />
            锦衣卫内部证据已满足本预算案的最低承办门槛。
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-[#7A4A08]/20 bg-[#FFF8E0]/45 p-4">
        <div className="text-[12px] font-bold tracking-[0.18em]" style={{ color: accent }}>裁决操作区</div>
        {!canDecide ? (
          <p className="mt-2 text-[13px] leading-6 text-[#6F5830]">当前阶段为 {data.stage}，尚不可在户部正文中裁决。</p>
        ) : (
          <>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} className={`${inputClass} mt-3 min-h-20`} />
            {requiresManualConfirmation && (
              <label className="mt-3 flex items-start gap-2 text-[12px] leading-5">
                <input type="checkbox" checked={manualConfirmation} onChange={(event) => setManualConfirmation(event.target.checked)} className="mt-1" />
                已完成线下人工复核；本次只写裁决记录，不执行付款或对外承诺。
              </label>
            )}
            {decisionError ? <div className="mt-3 rounded-[8px] border border-[#9B3A2D]/25 bg-[#9B3A2D]/10 px-3 py-2 text-[12px] text-[#8D2E25]">{decisionError}</div> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <DecisionButton label="准奏" busy={busy === 'issue_decree'} onClick={() => void submitDecision('issue_decree')} accent={accent} primary />
              <DecisionButton label="发补证令" busy={busy === 'request_more_evidence'} onClick={() => void submitDecision('request_more_evidence')} accent={accent} />
              <DecisionButton label="交复核" busy={busy === 'request_review'} onClick={() => void submitDecision('request_review')} accent={accent} />
              <DecisionButton label="驳回" busy={busy === 'reject'} onClick={() => void submitDecision('reject')} accent="#9B3A2D" />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function HubuBudgetIntakeBody({ accent }: { accent: string }) {
  const router = useRouter();
  const [sacredEdict, setSacredEdict] = useState('上书房圣旨：研发部 2026 Q3 申请 CNY 600,000，用于 AI 工具链、云算力和原型验证。');
  const [owner, setOwner] = useState('研发负责人');
  const [budgetPeriod, setBudgetPeriod] = useState('2026 Q3');
  const [purpose, setPurpose] = useState('AI 工具链、云算力和原型验证');
  const [amount, setAmount] = useState(600000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(withBasePath('/api/court/shangshufang/research-budget-loop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sacredEdict,
          department: '研发部',
          owner,
          budgetPeriod,
          purpose,
          requestedAmount: amount,
          currency: 'CNY',
          riskThresholdAmount: 500000,
          lineItems: [
            { id: 'cloud_compute', title: '云算力与 AI 训练', category: 'cloud', amount: Math.round(amount * 0.5), currency: 'CNY', evidenceRefs: ['cloud_bill_baseline'], confidence: 'medium' },
            { id: 'prototype_validation', title: '原型验证与测试物料', category: 'prototype', amount: Math.round(amount * 0.5), currency: 'CNY', evidenceRefs: ['supplier_quote_prototype'], confidence: 'medium' },
          ],
          evidenceRefs: [
            { id: 'historical_spend', label: '历史研发支出台账', kind: 'historical_spend', sourceLabel: 'INTERNAL_LEDGER' },
            { id: 'cloud_bill_baseline', label: '云账单基线', kind: 'cloud_bill', sourceLabel: 'UPLOADED_EVIDENCE' },
            { id: 'supplier_quote_prototype', label: '原型物料供应商报价', kind: 'supplier_quote', sourceLabel: 'UPLOADED_EVIDENCE' },
          ],
        }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: { taskId?: string }; error?: string } | null;
      if (!response.ok || payload?.success !== true || !payload.data?.taskId) throw new Error(payload?.error ?? `request_failed:${response.status}`);
      router.push(withBasePath(`/liubu/hubu?taskId=${encodeURIComponent(payload.data.taskId)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'research_budget_submit_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-[#281C0A]">
      <section className="rounded-[10px] border border-[#7A4A08]/20 bg-[#FFF8E0]/42 p-4">
        <div className="text-[12px] font-bold tracking-[0.18em]" style={{ color: accent }}>复制上书房圣旨</div>
        <textarea value={sacredEdict} onChange={(event) => setSacredEdict(event.target.value)} className={`${inputClass} mt-3 min-h-28`} />
      </section>
      <section className="grid gap-3 rounded-[10px] border border-[#7A4A08]/20 bg-[#FFF4CC]/38 p-4 md:grid-cols-2">
        <Field label="预算 owner" value={owner} onChange={setOwner} />
        <Field label="预算周期" value={budgetPeriod} onChange={setBudgetPeriod} />
        <Field label="用途" value={purpose} onChange={setPurpose} />
        <label className="block">
          <span className="text-[12px] font-semibold text-[#6F5830]">申请金额 CNY</span>
          <input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value || 0))} className={`${inputClass} mt-1`} />
        </label>
      </section>
      {error ? <div className="rounded-[8px] border border-[#9B3A2D]/25 bg-[#9B3A2D]/10 px-3 py-2 text-[12px] text-[#8D2E25]">{error}</div> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="inline-flex items-center gap-2 rounded-[8px] border px-4 py-2 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderColor: `${accent}55`, background: `${accent}18`, color: '#281C0A' }}
      >
        <Send size={14} />
        {busy ? '立案中...' : '在户部承办此圣旨'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[#6F5830]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-1`} />
    </label>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'green' | 'red' | 'neutral' }) {
  const color = tone === 'green' ? '#315A28' : tone === 'red' ? '#8D2E25' : '#281C0A';
  return (
    <div className="rounded-[8px] border border-[#7A4A08]/16 bg-[#FFF8E0]/38 p-3">
      <div className="text-[11px] text-[#6F5830]">{label}</div>
      <div className="mt-1 text-[14px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function DecisionButton({ label, busy, onClick, accent, primary = false }: { label: string; busy: boolean; onClick: () => void; accent: string; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-[8px] border px-3 py-2 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
      style={{ borderColor: `${accent}55`, background: primary ? `${accent}22` : 'rgba(255,248,224,0.36)', color: '#281C0A' }}
    >
      {busy ? '提交中...' : label}
    </button>
  );
}

function ScrollNotice({ text, danger = false }: { text: string; danger?: boolean }) {
  return (
    <div className="rounded-[10px] border px-4 py-3 text-[13px]" style={{ borderColor: danger ? 'rgba(141,46,37,0.28)' : 'rgba(122,74,8,0.20)', color: danger ? '#8D2E25' : '#281C0A' }}>
      {text}
    </div>
  );
}
