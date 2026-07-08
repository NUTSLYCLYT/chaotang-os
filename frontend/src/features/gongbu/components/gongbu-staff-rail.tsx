'use client';

/** 工部 · 左栏班底（M1 · 精简）：身份 + 班底(可增减) + 介绍折叠。 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, MinusCircle, PlusCircle } from 'lucide-react';

import {
  GONGBU_LITE_ROSTER,
  addStaffById,
  availableToAdd,
  removeStaffById,
  type GongbuRoster,
} from '@/features/gongbu/lib/gongbu-roster';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';

export function GongbuStaffRail({
  department,
  selected,
  onSelect,
}: {
  department: SixDepartmentContent;
  selected?: string | null;
  onSelect?: (id: string) => void;
}) {
  const accent = department.accent;
  const [roster, setRoster] = useState<GongbuRoster>(GONGBU_LITE_ROSTER);
  const [editing, setEditing] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const addable = availableToAdd(roster);

  return (
    <aside
      className="flex flex-col rounded-[24px] border px-4 py-4 shadow-[0_18px_56px_rgba(0,0,0,0.34)] xl:h-full xl:overflow-y-auto"
      style={{ borderColor: `${accent}24`, background: `linear-gradient(180deg, ${accent}14 0%, rgba(5, 7, 13, 0.92) 100%)` }}
    >
      <Link href="/departments" className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-[#C8CDD8] transition hover:text-[#EAF3EE]" style={{ borderColor: `${accent}30` }}>
        <ArrowLeft size={14} /> 返回六部
      </Link>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: accent }}>{department.titleEn}</div>
        <h1 className="display-serif mt-1 text-[26px] font-semibold text-[#EAF3EE]">{department.name}</h1>
        <p className="mt-0.5 text-[12px] text-[#8fa39a]">您的 CTO/CPO · 产品技术与交付</p>
      </div>

      <div className="mt-4 rounded-[12px] border px-3 py-2.5" style={{ borderColor: '#4A82F02a', background: '#4A82F00d' }}>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#7f9fce]">铁律9 · 产线红线</div>
        <div className="mt-1 text-[12px] text-[#bcd2ee]">真实成本/BOM/交期/报价 <span className="text-[#6f86a8]">前端只给定性、数字转后端核算</span></div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.2em] text-[#7a8a82]">工部班底 · {roster.staff.length} 司</span>
        <button onClick={() => setEditing((v) => !v)} className="text-[11px] text-[#8fa39a] transition hover:text-[#EAF3EE]">{editing ? '完成' : '管理'}</button>
      </div>
      <ul className="mt-2 space-y-1">
        {roster.staff.map((s) => (
          <li key={s.id} className="flex items-center rounded-[10px]" style={{ background: selected === s.id ? `${s.accent}22` : `${s.accent}0a` }}>
            <button onClick={() => onSelect?.(s.id)} className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left transition hover:brightness-125" title={`${s.realJobTitle} · ${s.duties} — 点击看圣旨详情`}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#5FB97A' }} aria-label="在岗" />
              <span className="text-[13px] text-[#EAF3EE]">{s.nameCn}</span>
              <span className="truncate text-[11px] text-[#6f827a]">{s.realJobTitle}</span>
              {s.note && <span title={s.note} className="ml-auto text-[10px] text-[#7f9fce]">🔒</span>}
            </button>
            {editing && (
              <button onClick={() => setRoster((r) => removeStaffById(r, s.id))} className="px-2" aria-label={`移除${s.nameCn}`}>
                <MinusCircle size={13} className="text-[#E5604D] transition hover:scale-110" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {editing && addable.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#6f827a]">可加司</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {addable.map((s) => (
              <button key={s.id} onClick={() => setRoster((r) => addStaffById(r, s.id))} title={`${s.realJobTitle} · ${s.duties}`} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-[11.5px] text-[#8fa39a] transition hover:text-[#EAF3EE]" style={{ borderColor: `${s.accent}50` }}>
                <PlusCircle size={12} /> {s.nameCn}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4">
        <button onClick={() => setShowIntro((v) => !v)} className="inline-flex items-center gap-1 text-[11px] text-[#6f827a] transition hover:text-[#8fa39a]">
          <ChevronDown size={13} className={showIntro ? 'rotate-180 transition' : 'transition'} /> 工部是什么
        </button>
        {showIntro && <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#8fa39a]">{department.positioning}</p>}
        <p className="mt-2 text-[10px] leading-relaxed text-[#586a62]">工部只给定性可行性 + 会审需求；真实交付/付款/承诺经后端核验（铁律9）。</p>
      </div>
    </aside>
  );
}
