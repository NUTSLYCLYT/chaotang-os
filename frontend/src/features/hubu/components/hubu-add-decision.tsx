'use client';

/**
 * 户部 · 录入真决策（2026-06-27）
 * 让老板自己输入真实钱决策 → POST /api/court/hubu/projects(真建 hubu_projects 行) → 户部当场给真裁决。
 * 数据是老板的真数据(非编造)；字段越全,户部越能给完整裁决,缺字段则诚实显缺证。
 */
import { useState } from 'react';
import { mutate } from 'swr';
import { Plus, X, Sparkles } from 'lucide-react';

import { decreeToProject, type DecreeToProject } from '@/features/hubu/lib/decree-to-project';

const ACCENT = '#F0C66A';

const DECREE_DOT: Record<string, string> = { initiate: '#5FB97A', dispose: '#E5B84D', ambiguous: '#8B93A7' };

const EMPTY = { title: '', budget: '', roi: '', payback: '', cash: '', risk: 'medium', priority: 'P1' };

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] text-[#8f835f]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-[8px] border bg-transparent px-2 py-1.5 text-[12.5px] text-[#E9DDBE] placeholder:text-[#6f6750] focus:outline-none"
        style={{ borderColor: '#ffffff18' }}
      />
    </label>
  );
}

export function HubuAddDecision() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sentence, setSentence] = useState('');
  const [decree, setDecree] = useState<DecreeToProject | null>(null);

  const set = (k: keyof typeof EMPTY) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  // 下旨分流：开创→立项(抽字段)；处置→裁决(不建新立项)；待澄清→请说清。
  function extractFromSentence() {
    if (!sentence.trim()) return;
    const d = decreeToProject(sentence);
    setDecree(d);
    if (d.isProject && d.extracted) {
      const e = d.extracted;
      setF((s) => ({
        ...s,
        title: e.title || s.title,
        budget: e.budget || s.budget,
        roi: e.roi || s.roi,
        payback: e.payback || s.payback,
        cash: e.cash || s.cash,
        risk: e.risk,
      }));
    }
  }

  async function submit() {
    if (f.title.trim().length < 2) {
      setErr('请至少填决策标题');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const id = `real-${Date.now()}`;
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/court/hubu/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id,
          title: f.title.trim(),
          owner_dept: '户部',
          status: 'pending_review',
          requested_budget: f.budget,
          estimated_roi: f.roi,
          payback_window: f.payback,
          cash_flow_pressure: f.cash,
          risk_level: f.risk,
          priority: f.priority,
        }),
      });
      if (!res.ok) {
        setErr(`录入失败（${res.status}）`);
        return;
      }
      await mutate('/api/court/hubu/overview');
      setF({ ...EMPTY });
      setOpen(false);
    } catch {
      setErr('网络异常，未录入');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] text-[#1a1408] transition hover:brightness-110"
        style={{ borderColor: ACCENT, background: ACCENT }}
      >
        <Plus size={13} /> 录入真决策
      </button>
    );
  }

  return (
    <div className="rounded-[14px] border px-3.5 py-3" style={{ borderColor: `${ACCENT}33`, background: 'linear-gradient(180deg,#F0C66A12 0%,rgba(6,8,14,0.94) 100%)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#F5E9C9]">录入一个真实钱决策</span>
        <button onClick={() => setOpen(false)} aria-label="关闭"><X size={15} className="text-[#9aa0ad] transition hover:text-[#F5E9C9]" /></button>
      </div>
      <p className="mt-1 text-[11px] text-[#8f835f]">字段越全，户部裁决越完整；缺的字段会诚实显「缺证」。</p>

      {/* 一句话录入：降低小老板门槛——说一句，AI 抽字段到下方（可校正） */}
      <div className="mt-2.5 rounded-[10px] border px-2.5 py-2" style={{ borderColor: `${ACCENT}26`, background: `${ACCENT}0a` }}>
        <span className="text-[10.5px] text-[#d8cba8]">懒得逐项填？说一句话，AI 帮你抽到下方字段（可改）</span>
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          rows={2}
          placeholder="例：我想花8万投短视频带货，预计回报2.6倍，5个月回本，现金还够，风险中等"
          className="mt-1.5 w-full resize-none rounded-[8px] border bg-transparent px-2 py-1.5 text-[12.5px] text-[#E9DDBE] placeholder:text-[#6f6750] focus:outline-none"
          style={{ borderColor: '#ffffff18' }}
        />
        <button
          onClick={extractFromSentence}
          disabled={!sentence.trim()}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] transition hover:brightness-110 disabled:opacity-50"
          style={{ borderColor: `${ACCENT}44`, color: '#E9DDBE' }}
        >
          <Sparkles size={12} /> AI 抽取到下方字段
        </button>
        {decree && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[11px]" style={{ color: DECREE_DOT[decree.classification.kind] }}>
            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: DECREE_DOT[decree.classification.kind] }} />
            <span>下旨分流：{decree.feedback}</span>
          </div>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="col-span-2"><Field label="决策标题（必填）" value={f.title} onChange={set('title')} placeholder="要不要花8万买4张RTX5090扩产" /></div>
        <Field label="预算" value={f.budget} onChange={set('budget')} placeholder="8 万" />
        <Field label="预期回报" value={f.roi} onChange={set('roi')} placeholder="2.6x 或 22%" />
        <Field label="回收期" value={f.payback} onChange={set('payback')} placeholder="2.7 个月" />
        <Field label="现金影响" value={f.cash} onChange={set('cash')} placeholder="一次性8万，现金可覆盖" />
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-[#8f835f]">风险</span>
          <select value={f.risk} onChange={(e) => set('risk')(e.target.value)} className="rounded-[8px] border bg-[#0b0e16] px-2 py-1.5 text-[12.5px] text-[#E9DDBE] focus:outline-none" style={{ borderColor: '#ffffff18' }}>
            <option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="critical">紧急</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-[#8f835f]">优先级</span>
          <select value={f.priority} onChange={(e) => set('priority')(e.target.value)} className="rounded-[8px] border bg-[#0b0e16] px-2 py-1.5 text-[12.5px] text-[#E9DDBE] focus:outline-none" style={{ borderColor: '#ffffff18' }}>
            <option value="P0">P0 紧急</option><option value="P1">P1</option><option value="P2">P2</option>
          </select>
        </label>
      </div>

      {err && <p className="mt-2 text-[11.5px] text-[#E5604D]">{err}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button onClick={submit} disabled={busy} className="rounded-full border px-4 py-1.5 text-[12px] text-[#1a1408] transition hover:brightness-110 disabled:opacity-60" style={{ borderColor: ACCENT, background: ACCENT }}>
          {busy ? '录入中…' : '交户部裁决'}
        </button>
        <button onClick={() => setOpen(false)} className="text-[12px] text-[#9aa0ad] transition hover:text-[#F5E9C9]">取消</button>
      </div>
    </div>
  );
}
