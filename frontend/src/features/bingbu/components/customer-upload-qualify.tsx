'use client';

/**
 * 兵部 · 商机司 · 上传客户名单 → 批量验客（2026-06-28）
 *
 * 户部 BOM 上传的平行版：客户名单在浏览器里解析(SheetJS客户端)、引擎本地跑、**名单不上传服务器**。
 * 解析 → 逐个验客(目标/待定/非目标) → 批量结论 + 合规 → 本地案卷。
 * 客户名单是你的核心资产，朝堂在你浏览器里验，不传云。
 */
import { useState, useCallback } from 'react';
import { UploadCloud, ShieldCheck, Users } from 'lucide-react';

import { parseCustomerRows, batchQualify, type BatchQualifyResult } from '@/features/bingbu/lib/customer-import';
import { QUALIFY_VERDICT_CN, type IcpProfile } from '@/features/bingbu/lib/prospect-qualify';

const ACCENT = '#7FC9A8';
const ARCHIVE_KEY = 'bingbu.customer.cases';

const VERDICT_COLOR: Record<string, string> = { target: '#5FB97A', maybe: '#E0B764', not_target: '#9aa0ad' };

export function CustomerUploadQualify() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<BatchQualifyResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [industries, setIndustries] = useState('储能,新能源,电力电子,军工,通信');

  const handleFile = useCallback(async (file: File) => {
    setBusy(true); setErr(''); setResult(null); setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
      const { prospects, missing } = parseCustomerRows(rows);
      if (prospects.length === 0) { setErr(`未识别到客户：${missing.join('、')}`); return; }
      const icp: IcpProfile = {
        industries: industries.split(/[,，\s]+/).filter(Boolean),
        signals: ['竞标', '采购', '列装', '招标', '样品', '项目', '量产', '送样', '中标', '扩产'],
        disqualifiers: [],
      };
      const b = batchQualify(prospects, icp);
      setResult(b);
      try {
        const prev = JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? '[]');
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify([{ at: new Date().toISOString(), file: file.name, summary: b.summary, total: b.total }, ...prev].slice(0, 50)));
      } catch { /* noop */ }
    } catch (e) {
      setErr(e instanceof Error ? `解析失败：${e.message.slice(0, 60)}` : '解析失败');
    } finally { setBusy(false); }
  }, [industries]);

  return (
    <div className="rounded-[14px] border px-4 py-3.5" style={{ borderColor: `${ACCENT}33`, background: `linear-gradient(180deg,${ACCENT}10 0%,rgba(6,8,14,0.94) 70%)` }}>
      <div className="flex items-center gap-2">
        <Users size={15} style={{ color: ACCENT }} />
        <span className="text-[13.5px] font-semibold text-[#F5E9C9]">上传客户名单 → 批量验客（一次验一表）</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[11px]" style={{ color: '#5FB97A' }}>
        <ShieldCheck size={12} /> 名单在你浏览器里验，**不上传服务器**（客户是你的核心资产）
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] shrink-0 text-[#8f835f]">你的目标行业</span>
        <input value={industries} onChange={(e) => setIndustries(e.target.value)}
          className="flex-1 rounded-md border bg-transparent px-2 py-1 text-[12px] text-[#E9DDBE] outline-none" style={{ borderColor: '#ffffff18' }} />
      </div>

      <label
        className="mt-2.5 flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border border-dashed px-4 py-5 text-center transition hover:brightness-110"
        style={{ borderColor: `${ACCENT}44`, background: '#ffffff05' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
      >
        <UploadCloud size={20} style={{ color: ACCENT }} />
        <span className="text-[12.5px] text-[#d8cba8]">{busy ? '验客中…' : '拖入 / 点击选择客户名单（.xls/.xlsx/.csv）'}</span>
        {fileName && <span className="text-[11px] text-[#8f835f]">{fileName}</span>}
        <input type="file" accept=".xls,.xlsx,.csv" className="hidden" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </label>

      {err && <p className="mt-2 text-[11.5px] text-[#E5604D]">{err}</p>}

      {result && (
        <div className="mt-3 rounded-[12px] border px-3 py-2.5 text-[12px]" style={{ borderColor: '#ffffff14', background: '#ffffff06' }}>
          <div className="font-medium text-[#E9DDBE]">{result.headline}</div>
          <div className="mt-1.5 flex gap-3 text-[11.5px]">
            <span style={{ color: VERDICT_COLOR.target }}>目标 {result.summary.target}</span>
            <span style={{ color: VERDICT_COLOR.maybe }}>待定 {result.summary.maybe}</span>
            <span style={{ color: VERDICT_COLOR.not_target }}>非目标 {result.summary.not_target}</span>
          </div>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[11.5px]">
            {result.results.slice(0, 30).map(({ prospect, result: r }, i) => (
              <li key={i} className="flex items-center justify-between gap-2 border-b border-[#ffffff08] pb-1">
                <span className="truncate text-[#d8cba8]">{prospect.name}</span>
                <span className="shrink-0" style={{ color: VERDICT_COLOR[r.verdict] }}>
                  {QUALIFY_VERDICT_CN[r.verdict]}{r.matchedSignals.length ? ` · ${r.matchedSignals.join('/')}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[10px] text-[#5FB97A]">✅ 已存本地案卷 · 名单未离开浏览器 · 人扳机：目标客户由你亲自联系</div>
        </div>
      )}
    </div>
  );
}
