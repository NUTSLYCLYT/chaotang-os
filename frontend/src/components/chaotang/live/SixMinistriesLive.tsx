'use client';

/**
 * 六部运行状态 · 接真实后端
 *
 * 大殿首页「六部运行状态」卡的取数层。并行拉取六部 deptOverview
 * (GET /api/chaotang/dept/{code}/overview)，把 status / keyMetrics / minister.name
 * 映射成既有 DepartmentStatusCard 的展示形状。任一部取失败或 success:false →
 * 该部回落到内置兜底项，不报错、不白屏。
 *
 * 设计/布局/配色保持不变，仅把数据源从 mock 换成真实 deptOverview。
 */

import { useEffect, useState } from 'react';
import { DepartmentStatusCard } from '@/components/chaotang/cards/DepartmentStatusCard';
import type { DepartmentStatus, StatusTone } from '@/components/chaotang/data/mockDadianData';
import { chaotang } from '@/lib/api/chaotang';
import {
  DEPT_STATUS_LABEL,
  type DeptCode,
  type DeptOverview,
  type DeptStatus,
} from '@/lib/contracts/dept';

/** 六部展示顺序与代号(任务指定) */
const MINISTRY_CODES: DeptCode[] = ['finance', 'legal', 'market', 'ops', 'guard', 'physician'];

/** 后端 DeptStatus → 卡片 StatusTone(色板沿用 DepartmentStatusCard) */
const STATUS_TONE: Record<DeptStatus, StatusTone> = {
  idle: 'neutral',
  processing: 'processing',
  risk: 'danger',
  pending_review: 'warning',
  done: 'healthy',
};

/** 后端不可用时的兜底项(保留 mock 角色文案与负载) */
const FALLBACK: Record<DeptCode, DepartmentStatus> = {
  finance:   { name: '户部',  role: '预算 / ROI / 资源', status: '核算中', tone: 'processing', load: '76%' },
  legal:     { name: '刑部',  role: '合规 / 合同 / 风险', status: '复核中', tone: 'danger',     load: '69%' },
  market:    { name: '礼部',  role: '传播 / 客户 / 对外', status: '待定稿', tone: 'processing', load: '55%' },
  ops:       { name: '兵部',  role: '竞争 / 战场 / 销售', status: '巡防中', tone: 'healthy',    load: '63%' },
  guard:     { name: '锦衣卫', role: '情报 / 异动 / 核查', status: '监测中', tone: 'warning',    load: '58%' },
  physician: { name: '太医院', role: '健康 / 诊断 / 预警', status: '巡诊中', tone: 'healthy',    load: '47%' },
};

/** 从 keyMetrics 里找一个可当负载条宽度的百分比值，否则用兜底负载 */
function pickLoad(overview: DeptOverview, fallbackLoad: string): string {
  for (const metric of overview.keyMetrics) {
    const raw = String(metric.value).trim();
    const pct = /%$/.test(raw) ? raw : metric.unit === '%' ? `${raw}%` : null;
    if (!pct) continue;
    const num = Number.parseFloat(pct);
    if (Number.isFinite(num) && num >= 0 && num <= 100) return `${num}%`;
  }
  return fallbackLoad;
}

/** 真实 overview → 卡片形状;缺字段时回落兜底 */
function toDepartmentStatus(code: DeptCode, overview: DeptOverview): DepartmentStatus {
  const fallback = FALLBACK[code];
  return {
    name: overview.minister?.name || fallback.name,
    role: overview.minister?.role || fallback.role,
    status: DEPT_STATUS_LABEL[overview.status] ?? fallback.status,
    tone: STATUS_TONE[overview.status] ?? fallback.tone,
    load: pickLoad(overview, fallback.load),
  };
}

export function SixMinistriesLive() {
  const [departments, setDepartments] = useState<DepartmentStatus[]>(
    () => MINISTRY_CODES.map((code) => FALLBACK[code]),
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      MINISTRY_CODES.map((code) =>
        chaotang
          .deptOverview(code)
          .then((overview) => toDepartmentStatus(code, overview))
          .catch(() => FALLBACK[code]),
      ),
    ).then((resolved) => {
      if (!cancelled) setDepartments(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-3">
      {departments.map((department, idx) => (
        <DepartmentStatusCard key={`${MINISTRY_CODES[idx]}-${department.name}`} department={department} />
      ))}
    </div>
  );
}
