'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import { ThreeAxisOfficeRails } from '@/components/chaotang/department/ThreeAxisOfficeRails';
import DomainCard from '@/features/zhuangyuan/components/DomainCard';
import { MINISTRIES, type Ministry } from '@/features/zhuangyuan/components/manorData';
import { isMinistryLive, MINISTRY_TO_DEPT_CODE } from '@/features/departments/lib/department-vitrine';
import { assetUrl } from '@/lib/asset';
import { withBasePath } from '@/lib/base-path';
import type { ManorMinistryMetricsMap } from '@/lib/contracts/manor';

const CANVAS_W = 1672;
const CANVAS_H = 941;
const TOP_CROP = 52;

async function fetchMinistryMetrics(url: string): Promise<ManorMinistryMetricsMap> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = (await res.json()) as {
    success: boolean;
    data: ManorMinistryMetricsMap;
    error?: string;
  };
  if (!json.success) throw new Error(json.error ?? 'departments-metrics failed');
  return json.data;
}

function applyTursoMetrics(
  base: Ministry[],
  metricsMap: ManorMinistryMetricsMap,
): Ministry[] {
  return base.map((ministry) => {
    const rows = metricsMap[ministry.key];
    if (!rows || rows.length === 0) return ministry;
    return {
      ...ministry,
      metrics: rows.map((row) => ({
        label: row.label,
        value: row.value,
        delta: row.deltaPositive,
      })),
    };
  });
}

export default function DepartmentsHallPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: metricsMap } = useSWR<ManorMinistryMetricsMap>(
    withBasePath('/api/court/zhuangyuan/ministry-metrics'),
    fetchMinistryMetrics,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );

  const ministries: Ministry[] = useMemo(
    () => (metricsMap ? applyTursoMetrics(MINISTRIES, metricsMap) : MINISTRIES),
    [metricsMap],
  );

  const selectedMinistry = selectedKey
    ? (ministries.find((ministry) => ministry.key === selectedKey) ?? null)
    : null;

  const activeDeptCode = selectedKey
    ? (MINISTRY_TO_DEPT_CODE[selectedKey] ?? 'manors')
    : 'manors';

  const activeDeptLabel = selectedMinistry
    ? selectedMinistry.title.split('·')[0].trim()
    : '六部';

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const parent = stage?.parentElement;
    if (!stage || !parent) return;

    const update = () => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (width > 0 && height > 0) {
        setScale(Math.max(width / CANVAS_W, height / (CANVAS_H - TOP_CROP)));
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="h-full w-full overflow-hidden" style={{ background: '#04060e' }}>
      <div className="relative h-full flex-1 overflow-hidden">
        {selectedKey ? (
          <ThreeAxisOfficeRails
            deptCode={activeDeptCode}
            deptLabel={activeDeptLabel}
            accent={selectedMinistry?.color}
          />
        ) : null}

        <div
          ref={stageRef}
          style={{
            position: 'absolute',
            left: '50%',
            top: -TOP_CROP * scale,
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl('/assets/zhuangyuan/04-zhuangyuan-new.webp')}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />

          {ministries.map((ministry, index) => (
            <DomainCard
              key={ministry.key}
              keyName={ministry.key}
              title={ministry.title}
              mark={ministry.mark}
              color={ministry.color}
              metrics={ministry.metrics}
              box={ministry.box}
              selected={selectedKey === ministry.key}
              enterDelayMs={120 + index * 80}
              markHref={ministry.href}
              live={isMinistryLive(ministry.key)}
              dimWhenInactive={false}
              onClick={() => {
                setSelectedKey((prev) => (prev === ministry.key ? null : ministry.key));
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
