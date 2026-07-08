'use client';

/**
 * 户部 · 左栏班底（M1 · 精简）
 * 身份(精简) + 财务班底(名+在岗点+对标岗，可增减) + 省税高光(诚实占位) + 介绍折叠。
 * 张小龙：左栏精简、不堆介绍；默认 6 岗、加岗折叠、定制可选不强迫。
 * 班底增减用 hubu-roster 纯函数(不可变)；持久化待接（本版 local state）。
 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, MinusCircle, PlusCircle } from 'lucide-react';

import {
  HUBU_LITE_ROSTER,
  addStaffById,
  availableToAdd,
  removeStaffById,
  type HubuRoster,
} from '@/features/hubu/lib/hubu-roster';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';

export function HubuStaffRail({
  department,
  selected,
  onSelect,
}: {
  department: SixDepartmentContent;
  selected?: string | null;
  onSelect?: (id: string) => void;
}) {
  const accent = department.accent;
  const [roster, setRoster] = useState<HubuRoster>(HUBU_LITE_ROSTER);
  const [editing, setEditing] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const addable = availableToAdd(roster);

  return (
    <aside
      className="flex flex-col rounded-[24px] border px-4 py-4 shadow-[0_18px_56px_rgba(0,0,0,0.34)] xl:h-full xl:overflow-y-auto"
      style={{ borderColor: `${accent}24`, background: `linear-gradient(180deg, ${accent}14 0%, rgba(5, 7, 13, 0.92) 100%)` }}
    >
      <Link
        href="/departments"
        className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-[#C8CDD8] transition hover:text-[#F5E9C9]"
        style={{ borderColor: `${accent}30` }}
      >
        <ArrowLeft size={14} /> 返回六部
      </Link>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: accent }}>{department.titleEn}</div>
        <h1 className="display-serif mt-1 text-[26px] font-semibold text-[#F5E9C9]">{department.name}</h1>
        <p className="mt-0.5 text-[12px] text-[#9aa0ad]">您的 CFO · 10 岗 AI 财务专员</p>
      </div>

      {/* 省税高光（诚实占位：无真税务核算前不给假数字） */}
      <div className="mt-4 rounded-[12px] border px-3 py-2.5" style={{ borderColor: '#3DD68C2a', background: '#3DD68C0d' }}>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#7fae93]">本月省税高光</div>
        <div className="mt-1 text-[13px] text-[#bfe6cf]">待税务司核算 <span className="text-[#6f8f7c]">（接真账后显示已省金额）</span></div>
      </div>

      {/* 财务班底 */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.2em] text-[#8f835f]">财务班底 · {roster.staff.length} 岗</span>
        <button onClick={() => setEditing((v) => !v)} className="text-[11px] text-[#b6ab8c] transition hover:text-[#F5E9C9]">
          {editing ? '完成' : '管理'}
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {roster.staff.map((s) => (
          <li
            key={s.id}
            className="flex items-center rounded-[10px]"
            style={{ background: selected === s.id ? `${s.accent}22` : `${s.accent}0a` }}
          >
            <button
              onClick={() => onSelect?.(s.id)}
              className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left transition hover:brightness-125"
              title={`${s.realJobTitle} · ${s.duties} — 点击看圣旨详情`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#5FB97A' }} aria-label="在岗" />
              <span className="text-[13px] text-[#E9DDBE]">{s.nameCn}</span>
              <span className="truncate text-[11px] text-[#7a7560]">{s.realJobTitle}</span>
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
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a7560]">可加岗（大公司）</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {addable.map((s) => (
              <button
                key={s.id}
                onClick={() => setRoster((r) => addStaffById(r, s.id))}
                title={`${s.realJobTitle} · ${s.duties}`}
                className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-[11.5px] text-[#9aa0ad] transition hover:text-[#F5E9C9]"
                style={{ borderColor: `${s.accent}50` }}
              >
                <PlusCircle size={12} /> {s.nameCn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 介绍折叠 */}
      <div className="mt-auto pt-4">
        <button
          onClick={() => setShowIntro((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-[#7a7560] transition hover:text-[#b6ab8c]"
        >
          <ChevronDown size={13} className={showIntro ? 'rotate-180 transition' : 'transition'} /> 户部是什么
        </button>
        {showIntro && <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#9aa0ad]">{department.positioning}</p>}
        <p className="mt-2 text-[10px] leading-relaxed text-[#5f5a48]">户部只读 + 追问 + 拍板意向；真实付款/承诺经后端核验（铁律9）。</p>
      </div>
    </aside>
  );
}
