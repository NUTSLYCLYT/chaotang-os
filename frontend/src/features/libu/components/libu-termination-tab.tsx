'use client';

import { useState } from 'react';
import { AlertCircle, UserMinus } from 'lucide-react';

import {
  reviewTermination,
  REASON_CN,
  type TerminationInput,
  type TerminationReview,
  type TerminationReason,
} from '@/features/libu/lib/termination-review';
import { ACCENT } from '@/features/libu/lib/libu-roster';
import { INPUT_BASE, bdr, BoolChip, TerminationResult } from './libu-hr-shared';

const INIT_TERMINATION: TerminationInput = {
  employeeName: '',
  tenureMonths: null,
  monthlySalary: null,
  reason: 'negotiated',
  hasEvidence: false,
  hasPIP: false,
  noticeGiven: false,
};

const REASONS: TerminationReason[] = ['negotiated', 'performance', 'misconduct', 'redundancy', 'unknown'];

export function TerminationTab() {
  const [form, setForm] = useState<TerminationInput>(INIT_TERMINATION);
  const [result, setResult] = useState<TerminationReview | null>(null);

  function analyse() {
    if (!form.employeeName.trim()) return;
    setResult(reviewTermination(form));
  }

  function upd<K extends keyof TerminationInput>(k: K, v: TerminationInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <UserMinus size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            劳关司 · 辞退合规审查
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        <div className="space-y-2">
          <input
            value={form.employeeName}
            onChange={(e) => upd('employeeName', e.target.value)}
            placeholder="员工姓名"
            className={INPUT_BASE}
            style={bdr()}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#6a7080]">工龄（月）</label>
              <input
                type="number"
                min={0}
                value={form.tenureMonths ?? ''}
                onChange={(e) =>
                  upd('tenureMonths', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))
                }
                placeholder="如 24"
                className={`${INPUT_BASE} mt-0.5`}
                style={bdr()}
              />
            </div>
            <div>
              <label className="text-[10px] text-[#6a7080]">月薪（元）</label>
              <input
                type="number"
                min={0}
                value={form.monthlySalary ?? ''}
                onChange={(e) =>
                  upd('monthlySalary', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))
                }
                placeholder="如 12000"
                className={`${INPUT_BASE} mt-0.5`}
                style={bdr()}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#6a7080]">辞退原因</label>
            <select
              value={form.reason}
              onChange={(e) => upd('reason', e.target.value as TerminationReason)}
              className={`${INPUT_BASE} mt-0.5`}
              style={bdr()}
            >
              {REASONS.map((r) => (
                <option key={r} value={r} style={{ background: '#0e1220' }}>
                  {REASON_CN[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#5a6070]">人工判断：</span>
          <BoolChip label="有证据" value={form.hasEvidence} onChange={(v) => upd('hasEvidence', v)} />
          <BoolChip label="有 PIP" value={form.hasPIP} onChange={(v) => upd('hasPIP', v)} />
          <BoolChip label="已提前30天通知" value={form.noticeGiven} onChange={(v) => upd('noticeGiven', v)} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analyse}
            disabled={!form.employeeName.trim()}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: ACCENT, color: '#040A10' }}
          >
            <AlertCircle size={14} />
            审查辞退
          </button>
          <span className="ml-auto text-[10px] text-[#5f5a48]">
            LOCAL · 中国劳动法 N/N+1/2N 确定性计算
          </span>
        </div>
      </div>

      {result && <TerminationResult result={result} />}

      {!result && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <UserMinus size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">填入辞退信息，点「审查辞退」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            协商/绩效/违纪 三路径 · N/N+1/2N 赔偿估算
          </p>
        </div>
      )}
    </div>
  );
}
