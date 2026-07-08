'use client';

/**
 * 兵部 · 选中事项详情（右栏 · 2026-06-27）
 *
 * 读 ?item=<id> → 露 CRO 引擎对该事项的深挖：主办+协办内部席位判词、缺证清单、
 * 引擎已能生成的销售生成物（报价检查单/battlecard…，藏着没露的资产）。
 * 全部读引擎输出，生成物一律 maySendExternally:false（铁律9：对外动作走后端+人确认）。
 */
import { useSearchParams } from 'next/navigation';
import { FileText, ShieldAlert } from 'lucide-react';

import { useBingbuOverview } from '@/features/bingbu/hooks/use-bingbu-overview';
import { salesOpinionForItem, SALES_QUESTION_TYPE_CN } from '@/features/bingbu/lib/bingbu-engines';

const ACCENT = '#6BA0FF';

/** 判词里露出的生 enum（CHANNEL_PARTNER…）替成中文，避免给老板看代码常量。 */
function humanizeFinding(text: string): string {
  let out = text;
  for (const [en, cn] of Object.entries(SALES_QUESTION_TYPE_CN) as [string, string][]) {
    out = out.replace(en, cn);
  }
  return out;
}

/** 内部席位角色标签：尚书=总裁决，第一个专业席位=主办，余=协办。 */
function roleLabel(officeId: string, leadOfficeId: string): string {
  if (officeId === 'cro_chief') return '总裁决';
  if (officeId === leadOfficeId) return '主办';
  return '协办';
}

export function BingbuDetailPanel() {
  const { overview } = useBingbuOverview();
  const itemId = useSearchParams().get('item');
  const item = overview?.items.find((i) => i.id === itemId);

  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[24px] border px-5 text-center"
        style={{ borderColor: '#ffffff10', background: '#ffffff04' }}>
        <FileText size={22} className="text-[#6f6750]" />
        <p className="mt-3 text-[12px] leading-relaxed text-[#6f6750]">
          点中栏任一销售事项<br />查看主办席位判词、缺证与可生成的销售资产
        </p>
      </div>
    );
  }

  const op = salesOpinionForItem(item);
  // 主办 = 第一个非尚书的专业司（与卡片徽章 leadOfficeForItem 一致）。
  const leadOfficeId = op.subOfficeReviews.find((r) => r.officeId !== 'cro_chief')?.officeId ?? 'cro_chief';

  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-[24px] border px-4 py-4"
      style={{ borderColor: `${ACCENT}24`, background: `linear-gradient(180deg, ${ACCENT}10 0%, rgba(5,7,13,0.92) 100%)` }}>
      <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: ACCENT }}>选中事项 · 内部席位判词</div>
      <h3 className="mt-1.5 text-[14px] font-medium leading-snug text-[#F5E9C9]">{item.title}</h3>

      {/* 主办 + 协办内部席位各自判词 */}
      <div className="mt-3 space-y-2">
        {op.subOfficeReviews.map((r) => {
          const role = roleLabel(r.officeId, leadOfficeId);
          const isLead = role === '主办';
          return (
            <div key={r.officeId} className="rounded-[12px] border px-3 py-2"
              style={{ borderColor: isLead ? `${ACCENT}40` : '#ffffff10', background: isLead ? `${ACCENT}10` : '#ffffff04' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#E9DDBE]">
                  {r.officeName} · {role}
                </span>
                <span className="rounded-full px-1.5 py-0.5 text-[10px]"
                  style={{ background: r.position === '复核' ? '#E5604D1c' : r.position === '补证' ? '#E5B84D1c' : '#5FB97A1c',
                           color: r.position === '复核' ? '#E5847A' : r.position === '补证' ? '#E5B84D' : '#5FB97A' }}>
                  {r.position}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#bdb191]">{humanizeFinding(r.finding)}</p>
              <p className="mt-1 text-[10.5px] text-[#8f835f]">下一步：{r.onePrimarySalesAction}</p>
            </div>
          );
        })}
      </div>

      {/* 缺证清单 */}
      {op.missingEvidence.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">缺证清单</div>
          <div className="space-y-1">
            {op.missingEvidence.map((m) => (
              <div key={m} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                style={{ borderColor: '#ffffff10', background: '#ffffff04' }}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#E5B84D' }} />
                <span className="text-[11px] text-[#C6BB9D]">{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 可生成的销售资产（引擎已能生成，藏着没露） */}
      {op.generatedArtifacts.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">可生成销售资产</div>
          <div className="space-y-1">
            {op.generatedArtifacts.map((a) => (
              <div key={a.type} className="rounded-md border px-2.5 py-1.5"
                style={{ borderColor: `${ACCENT}24`, background: `${ACCENT}08` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-[#E9DDBE]">{a.title}</span>
                  <span className="text-[9.5px] text-[#8f835f]">{a.status === 'needs_cross_review' ? '待跨审' : a.status === 'draft' ? '可拟草案' : a.status}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-snug text-[#6f6750]">
            <ShieldAlert size={11} className="mt-0.5 shrink-0" />
            一律内部草案 · 不自动外发；真发经后端核验 + 人工确认（铁律9）。
          </p>
        </div>
      )}
    </div>
  );
}
