'use client';

import type { ReactNode } from 'react';
import { ReceiptText } from 'lucide-react';

/**
 * ManorEntityColumn — 实体列表列
 *
 * 从户部 hubu-client.tsx 的 LedgerColumn 泛化。
 * 每一列有标题/副标题/计数徽章，内部是自定义渲染的实体列表。
 */

export interface ManorEntityColumnProps<T> {
  title: string;
  subtitle: string;
  accent: string;
  count: number;
  entities: T[];
  selectedId?: string | null;
  emptyLabel: string;
  emptyHint: string;
  renderEntity: (entity: T, index: number, active: boolean) => ReactNode;
}

export function ManorEntityColumn<T extends { id: string }>({
  title,
  subtitle,
  accent,
  count,
  entities,
  selectedId,
  emptyLabel,
  emptyHint,
  renderEntity,
}: ManorEntityColumnProps<T>) {
  return (
    <section
      className="flex flex-col overflow-hidden rounded-xl border backdrop-blur-sm"
      style={{
        borderColor: `${accent}22`,
        background:
          'linear-gradient(180deg, rgba(9,13,28,0.92) 0%, rgba(5,8,18,0.97) 100%)',
        boxShadow: `0 20px 55px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,233,201,0.045), inset 0 0 42px ${accent}08`,
      }}
    >
      {/* 标题栏 */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-4 py-3"
        style={{ borderColor: `${accent}16` }}
      >
        <div>
          <h3
            className="font-serif text-[14px] font-semibold tracking-[0.06em]"
            style={{ color: accent }}
          >
            {title}
          </h3>
          <p className="mt-0.5 text-[10px] tracking-[0.06em] text-[#8F835F]">
            {subtitle}
          </p>
        </div>
        <span
          className="grid h-7 min-w-[28px] place-items-center rounded-full border font-mono text-[12px] font-bold"
          style={{
            borderColor: `${accent}44`,
            color: accent,
            background: `${accent}10`,
          }}
        >
          {count}
        </span>
      </div>

      {/* 列表区 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {count > 0 ? (
          <div className="space-y-1.5">
            {entities.map((entity, index) => {
              const active = selectedId != null && entity.id === selectedId;
              return (
                <div key={entity.id}>
                  {renderEntity(entity, index, active)}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <ReceiptText size={22} className="text-[#6A7299] opacity-25" />
            <p className="mt-2 text-[11px] text-[#8F9AB8]">{emptyLabel}</p>
            <p className="mt-1 text-[10px] text-[#6A7299]">{emptyHint}</p>
          </div>
        )}
      </div>
    </section>
  );
}
