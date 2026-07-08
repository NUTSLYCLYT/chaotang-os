import type { ReactNode } from 'react';

import {
  DEPT_STATUS_COLOR,
  DEPT_STATUS_LABEL,
  type DeptOverview,
} from '@/lib/contracts/dept';
import { DOCK_BOTTOM_PADDING } from '@/features/shared/components/bottom-dock';

type DepartmentPageCanvasProps = {
  ariaLabel: string;
  bgSrc: string;
  bgAlt: string;
  children: ReactNode;
  ambientLayer?: ReactNode;
  imageClassName?: string;
  overlayClassName?: string;
};

type DepartmentLiveStripProps = {
  deptOverview: DeptOverview | null;
  accent: string;
  ministerColor?: string;
  fallbackText?: string;
};

type DepartmentStageProps = {
  hasLiveStrip: boolean;
  children: ReactNode;
  className?: string;
};

const DEFAULT_OVERLAY_CLASS =
  'bg-transparent';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function DepartmentPageCanvas({
  ariaLabel,
  bgSrc,
  bgAlt,
  children,
  ambientLayer,
  imageClassName,
  overlayClassName,
}: DepartmentPageCanvasProps) {
  return (
    <main
      aria-label={ariaLabel}
      className={cx(
        'relative h-screen w-full overflow-hidden bg-[#040A10] text-[#EAEEFB]',
        DOCK_BOTTOM_PADDING,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgSrc}
        alt={bgAlt}
        draggable={false}
        className={cx('absolute inset-0 h-full w-full object-cover', imageClassName)}
      />
      <div className={cx('absolute inset-0', overlayClassName ?? DEFAULT_OVERLAY_CLASS)} />
      {ambientLayer}
      {children}
    </main>
  );
}

export function DepartmentLiveStrip({
  deptOverview,
  accent,
  ministerColor,
  fallbackText = '指标实况加载中',
}: DepartmentLiveStripProps) {
  if (!deptOverview) return null;

  return (
    <div className="absolute inset-x-0 top-0 z-20 px-5">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-2 py-1.5 text-[10px]">
        <span
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 tracking-[0.08em]"
          style={{ borderColor: `${accent}26`, background: `${accent}0a` }}
        >
          <span className="text-[#6A7299]">部门实况</span>
          <span className="font-semibold" style={{ color: accent }}>
            chaotang 实时
          </span>
        </span>

        <span
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1"
          style={{
            borderColor: `${DEPT_STATUS_COLOR[deptOverview.status]}30`,
            background: `${DEPT_STATUS_COLOR[deptOverview.status]}0c`,
          }}
        >
          <span className="text-[#6A7299]">状态</span>
          <span className="font-semibold" style={{ color: DEPT_STATUS_COLOR[deptOverview.status] }}>
            {DEPT_STATUS_LABEL[deptOverview.status]}
          </span>
        </span>

        {deptOverview.minister?.name ? (
          <span
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1"
            style={{
              borderColor: `${ministerColor ?? accent}26`,
              background: `${ministerColor ?? accent}0a`,
            }}
          >
            <span className="text-[#6A7299]">主官</span>
            <span className="font-semibold" style={{ color: ministerColor ?? accent }}>
              {deptOverview.minister.name}
            </span>
          </span>
        ) : null}

        {deptOverview.keyMetrics.length > 0 ? (
          deptOverview.keyMetrics.slice(0, 4).map((metric) => (
            <span
              key={metric.label}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1"
              style={{ borderColor: `${accent}24`, background: `${accent}08` }}
            >
              <span className="text-[#6A7299]">{metric.label}</span>
              <span className="font-mono font-semibold text-[#F5E9C9]">
                {metric.value}
                {metric.unit ? (
                  <span className="ml-0.5 text-[9px] text-[#8B9AA2]">{metric.unit}</span>
                ) : null}
              </span>
            </span>
          ))
        ) : (
          <span
            className="rounded-md border px-2.5 py-1 text-[#6A7299]"
            style={{ borderColor: `${accent}1a`, background: `${accent}06` }}
          >
            {fallbackText}
          </span>
        )}
      </div>
    </div>
  );
}

export function DepartmentStage({
  hasLiveStrip,
  children,
  className,
}: DepartmentStageProps) {
  return (
    <div
      className={cx(
        'absolute inset-x-0 bottom-[112px] z-10 min-h-0 px-5',
        hasLiveStrip ? 'top-[92px]' : 'top-[56px]',
        className,
      )}
    >
      {children}
    </div>
  );
}
