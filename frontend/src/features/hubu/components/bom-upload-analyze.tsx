'use client';

/**
 * 户部 · 成本司 · 上传 BOM 当场出成本裁决（2026-06-28）
 *
 * 杀手级隐私：**文件在浏览器里解析（SheetJS 客户端），原始 BOM 一个字节都不上传服务器。**
 * 解析 → 户部成本引擎(纯函数客户端跑) → 真总成本/毛利/内外对比/缺证 → 本地案卷(localStorage)。
 * 别的 AI 要你把成本表传上云；朝堂在你自己浏览器里算 —— 这是电池厂老板的决定性信任点。
 */
import { useState, useCallback } from 'react';
import { UploadCloud, ShieldCheck, FileSpreadsheet, AlertTriangle, Stamp, Printer, X } from 'lucide-react';

import { parseBomRows, analyzeBomCost, type BomCost, type BomAnalysis } from '@/features/hubu/lib/bom-cost';
import { bomCostToDocument } from '@/features/hubu/lib/bom-cost-document';
import { OfficialDocument } from '@/components/OfficialDocument';

const ACCENT = '#F0C66A';
const ARCHIVE_KEY = 'hubu.bom.cases';

interface Case {
  at: string;
  product: string;
  totalCost: number | null;
  topDriver: string | null;
  marginPct: number | null;
}

function saveCase(c: Case) {
  try {
    const prev: Case[] = JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? '[]');
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify([c, ...prev].slice(0, 50)));
  } catch {
    /* 本地存储失败不挡主流程 */
  }
}

export function BomUploadAnalyze() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [bom, setBom] = useState<BomCost | null>(null);
  const [analysis, setAnalysis] = useState<BomAnalysis | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [fileName, setFileName] = useState('');
  const [showDoc, setShowDoc] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setErr('');
    setBom(null);
    setAnalysis(null);
    setFileName(file.name);
    try {
      // 懒加载 SheetJS（仅选文件时拉，~1MB，不进主包）。全程浏览器，文件不上传。
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
      const product = file.name.replace(/\.(xlsx?|csv)$/i, '');
      const parsed = parseBomRows(rows, product);
      setBom(parsed);
      const a = analyzeBomCost(parsed, sellPrice ? Number(sellPrice) : null);
      setAnalysis(a);
      saveCase({ at: new Date().toISOString(), product, totalCost: parsed.totalCost, topDriver: parsed.topCostDriver?.name ?? null, marginPct: a.grossMargin?.marginPct ?? null });
    } catch (e) {
      setErr(e instanceof Error ? `解析失败：${e.message.slice(0, 60)}` : '解析失败');
    } finally {
      setBusy(false);
    }
  }, [sellPrice]);

  return (
    <div className="rounded-[14px] border px-4 py-3.5" style={{ borderColor: `${ACCENT}33`, background: `linear-gradient(180deg,${ACCENT}10 0%,rgba(6,8,14,0.94) 70%)` }}>
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={15} style={{ color: ACCENT }} />
        <span className="text-[13.5px] font-semibold text-[#F5E9C9]">上传成本表 / BOM → 当场出成本裁决</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[11px]" style={{ color: '#5FB97A' }}>
        <ShieldCheck size={12} /> 文件在你浏览器里算，**原始数据不上传服务器**（别的 AI 要你传云，朝堂在本地算）
      </div>

      <label
        className="mt-3 flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border border-dashed px-4 py-6 text-center transition hover:brightness-110"
        style={{ borderColor: `${ACCENT}44`, background: '#ffffff05' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
      >
        <UploadCloud size={22} style={{ color: ACCENT }} />
        <span className="text-[12.5px] text-[#d8cba8]">{busy ? '解析中…' : '拖入 / 点击选择 BOM 表（.xls/.xlsx/.csv）'}</span>
        {fileName && <span className="text-[11px] text-[#8f835f]">{fileName}</span>}
        <input type="file" accept=".xls,.xlsx,.csv" className="hidden" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </label>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-[#8f835f]">售价(算毛利,可选)</span>
        <input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="如 18000"
          className="w-28 rounded-md border bg-transparent px-2 py-1 text-[12px] text-[#E9DDBE] outline-none" style={{ borderColor: '#ffffff18' }} />
      </div>

      {err && <p className="mt-2 text-[11.5px] text-[#E5604D]">{err}</p>}

      {bom && analysis && (
        <div className="mt-3 rounded-[12px] border px-3 py-2.5 text-[12px]" style={{ borderColor: '#ffffff14', background: '#ffffff06' }}>
          <div className="font-semibold text-[#F5E9C9]">{bom.product}</div>
          <div className="mt-1.5 text-[#d8cba8]">
            总成本 <span className="font-medium" style={{ color: ACCENT }}>{bom.totalCost ?? '缺'}</span> 元
            {analysis.grossMargin && <> · 毛利 <span style={{ color: analysis.grossMargin.marginPct >= 20 ? '#5FB97A' : '#E5B84D' }}>{analysis.grossMargin.profit}元（{analysis.grossMargin.marginPct}%）</span></>}
          </div>
          {bom.breakdown.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#8f835f]">成本结构（该盯的）</div>
              <ul className="mt-1 space-y-0.5 text-[11.5px] text-[#c6bb9d]">
                {bom.breakdown.slice(0, 5).map((b, i) => (
                  <li key={i} className="flex justify-between"><span>{b.name}</span><span style={{ color: i === 0 ? ACCENT : undefined }}>{b.amount}元 · {b.pct}%</span></li>
                ))}
              </ul>
            </div>
          )}
          {analysis.comparison && analysis.comparison.verdict !== 'no_internal' && (
            <div className="mt-2 text-[11.5px]" style={{ color: analysis.comparison.verdict === 'above' ? '#E5B84D' : '#c6bb9d' }}>📊 {analysis.comparison.note}</div>
          )}
          {analysis.missing.length > 0 && (
            <div className="mt-2 flex items-start gap-1 text-[11px] text-[#9aa0ad]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>缺证：{analysis.missing.join('、')}（户部不替你猜）</span>
            </div>
          )}
          <div className="mt-2 text-[10px] text-[#5FB97A]">✅ 已存本地案卷 · 数据未离开浏览器</div>

          <button
            onClick={() => setShowDoc(true)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition hover:brightness-110"
            style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}14`, color: ACCENT }}
          >
            <Stamp size={14} /> 生成盖章呈奏（可导出 PDF）
          </button>
        </div>
      )}

      {showDoc && bom && (
        <div className="doc-overlay fixed inset-0 z-[200] overflow-auto" style={{ background: 'rgba(2,3,8,0.86)', padding: '32px 16px' }}>
          <style>{`@media print {
            @page { size: A4; margin: 14mm; }
            body { background: #fff !important; }
            body * { visibility: hidden; }
            .doc-print-area, .doc-print-area * { visibility: visible; }
            .doc-print-area { position: absolute; inset: 0; }
            .doc-overlay { background: #fff !important; padding: 0 !important; }
            .doc-toolbar { display: none !important; }
          }`}</style>
          <div className="doc-toolbar mx-auto mb-3 flex max-w-[720px] items-center justify-end gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-[12px]" style={{ borderColor: ACCENT, background: `${ACCENT}1f`, color: ACCENT }}>
              <Printer size={13} /> 导出 PDF / 打印
            </button>
            <button onClick={() => setShowDoc(false)} className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-[12px]" style={{ borderColor: '#ffffff22', color: '#c6bb9d' }}>
              <X size={13} /> 关闭
            </button>
          </div>
          <div className="doc-print-area">
            <OfficialDocument
              {...bomCostToDocument(bom, {
                docNo: `户字〔2026〕第${String(Math.abs(hashStr(bom.product)) % 900 + 100)}号`,
                date: new Date().toISOString().slice(0, 10),
                handler: '采购司',
              })}
              theme="paper"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** 据产品名稳定派生文号尾数（避免随机，刷新不变）。 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
