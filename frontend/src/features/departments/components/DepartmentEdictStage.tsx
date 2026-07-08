'use client';

import type { ReactNode } from 'react';

import { EdictStage } from '@/features/shangshufang/components/MemorialScroll';
import type { EdictView } from '@/features/shangshufang/edict-content';

const ROW_TITLE: Record<string, string> = {
  '任务标题': '任务标题',
  '事项原文': '事项原文',
  '任务状态': '任务状态',
  '案件编号': '案件编号',
  '证据与缺口': '证据与缺口',
  '下一步': '下一步',
  '协同部门': '协同部门',
};

function compactLabel(label: string) {
  return label.replace(/\s/g, '');
}

function displayLabel(label: string) {
  const compact = compactLabel(label);
  return ROW_TITLE[compact] ?? compact;
}

export function DepartmentEdictStage({
  view,
  footer,
  documentTitle,
}: {
  view: EdictView;
  footer?: ReactNode;
  documentTitle?: string;
}) {
  const primaryRow = view.rows.find((row) => compactLabel(row.label) === '任务标题') ?? view.rows[0];

  return (
    <EdictStage view={view} customBodyScroll="styled" footer={footer}>
      <div
        data-testid="department-edict-body"
        className="memorial-body-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4 pr-2"
      >
        <section
          aria-label={documentTitle ?? view.title}
          className="rounded-[18px] border px-4 py-3 md:px-5 md:py-4"
          style={{
            borderColor: 'rgba(128,72,30,0.36)',
            background:
              'linear-gradient(180deg, rgba(255,248,224,0.30), rgba(255,248,224,0.08)), radial-gradient(ellipse at 18% 0%, rgba(122,74,8,0.10), transparent 48%)',
            boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.48)',
          }}
        >
          <div className="text-[10px] font-black tracking-[0.22em]" style={{ color: '#7a4a08', fontFamily: 'var(--font-serif)' }}>
            {view.subtitle ?? '六部案卷'}
          </div>
          <h2
            className="mt-2 whitespace-pre-wrap break-words text-[23px] font-semibold leading-[1.45] md:text-[29px]"
            style={{ color: '#211406', fontFamily: '"STKaiti", "KaiTi", var(--font-serif)' }}
          >
            {primaryRow?.body || view.title}
          </h2>
          {view.question ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-6" style={{ color: '#3f2c12', fontFamily: 'var(--font-serif)' }}>
              {view.question}
            </p>
          ) : null}
        </section>

        <div className="flex flex-col gap-2.5">
          {view.rows.map((row, index) => (
            <article
              key={`${row.label}-${index}`}
              className="rounded-[14px] border px-3 py-2.5 md:px-4"
              style={{
                borderColor: 'rgba(120,90,40,0.26)',
                background: 'rgba(255,248,224,0.13)',
                boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.28)',
              }}
            >
              <div className="text-[10px] font-black tracking-[0.18em]" style={{ color: '#7a4a08', fontFamily: 'var(--font-serif)' }}>
                {displayLabel(row.label)}
              </div>
              <p
                className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-7 md:text-[15px]"
                style={{ color: '#2e2410', fontFamily: '"STKaiti", "KaiTi", var(--font-serif)' }}
              >
                {row.body}
              </p>
            </article>
          ))}
        </div>

        {view.sealDate ? (
          <div className="pr-2 pt-1 text-right text-[11.5px] tracking-[0.16em]" style={{ color: '#3f2c12', fontFamily: 'var(--font-serif)' }}>
            {view.sealDate}
          </div>
        ) : null}
      </div>
    </EdictStage>
  );
}
