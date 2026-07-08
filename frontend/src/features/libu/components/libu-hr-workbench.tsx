'use client';

/**
 * 吏部 · 中栏 HR 工作台（2026-06-29）
 *
 * 四 Tab 导航 + ARIA tablist/tabpanel 骨架。
 * 各 Tab 逻辑独立成文件（libu-*-tab.tsx），本文件仅做路由。
 * 纯客户端咨询面，数据不出浏览器（铁律9）。
 */
import { useState } from 'react';
import {
  BadgeCheck,
  GraduationCap,
  Network,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';

import { ACCENT, LIBU_OFFICE_ORDER, LIBU_ROSTER } from '@/features/libu/lib/libu-roster';
import { DeptDigestBar } from '@/features/shared/components/dept-digest-bar';
import { HiringTab } from './libu-hiring-tab';
import { TerminationTab } from './libu-termination-tab';
import { CompensationTab } from './libu-compensation-tab';
import { PromotionTab } from './libu-promotion-tab';
import { TrainingTab } from './libu-training-tab';
import { OrgHeadcountTab } from './libu-org-tab';

type Tab = 'hiring' | 'termination' | 'compensation' | 'promotion' | 'training' | 'org';

export function LibuHRWorkbench() {
  const [tab, setTab] = useState<Tab>('hiring');

  function tabBtn(
    t: Tab,
    label: string,
    Icon: React.ComponentType<{ size?: number }>,
  ) {
    const active = tab === t;
    return (
      <button
        key={t}
        id={`tab-${t}`}
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={`panel-${t}`}
        onClick={() => setTab(t)}
        className="inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A99CF0]"
        style={{
          background: active ? `${ACCENT}22` : 'transparent',
          color: active ? ACCENT : '#6a7080',
          borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
        }}
      >
        <Icon size={14} />
        {label}
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      {/* 一句话摘要顶条:老板 5 秒读完本部能算什么 */}
      <DeptDigestBar
        deptName="吏部 · 人事决策"
        accent={ACCENT}
        perOfficeSavingWan={3}
        offices={LIBU_OFFICE_ORDER.map((id) => ({
          name: LIBU_ROSTER[id].name,
          role: LIBU_ROSTER[id].role,
          engine: LIBU_ROSTER[id].engine,
          isChief: id === 'chief',
        }))}
      />

      {/* Tab 导航 */}
      <div
        className="flex flex-wrap items-center gap-1 rounded-[14px] border p-1"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.45)' }}
      >
        <div role="tablist" aria-label="人事工作台" className="flex flex-wrap gap-1">
          {tabBtn('hiring',       '招人', UserCheck)}
          {tabBtn('termination',  '辞退', UserMinus)}
          {tabBtn('compensation', '薪酬', TrendingUp)}
          {tabBtn('promotion',    '转正', BadgeCheck)}
          {tabBtn('training',     '培训', GraduationCap)}
          {tabBtn('org',          '编制', Network)}
        </div>
        <div className="ml-auto flex items-center">
          <span
            className="rounded-full border px-2 py-0.5 text-[10px]"
            style={{ borderColor: `${ACCENT}28`, color: `${ACCENT}88` }}
          >
            <Users size={10} className="mr-1 inline" />
            LOCAL
          </span>
        </div>
      </div>

      {/* Tab 内容 */}
      {tab === 'hiring' && (
        <div role="tabpanel" id="panel-hiring" aria-labelledby="tab-hiring">
          <HiringTab />
        </div>
      )}
      {tab === 'termination' && (
        <div role="tabpanel" id="panel-termination" aria-labelledby="tab-termination">
          <TerminationTab />
        </div>
      )}
      {tab === 'compensation' && (
        <div role="tabpanel" id="panel-compensation" aria-labelledby="tab-compensation">
          <CompensationTab />
        </div>
      )}
      {tab === 'promotion' && (
        <div role="tabpanel" id="panel-promotion" aria-labelledby="tab-promotion">
          <PromotionTab />
        </div>
      )}
      {tab === 'training' && (
        <div role="tabpanel" id="panel-training" aria-labelledby="tab-training">
          <TrainingTab />
        </div>
      )}
      {tab === 'org' && (
        <div role="tabpanel" id="panel-org" aria-labelledby="tab-org">
          <OrgHeadcountTab />
        </div>
      )}
    </div>
  );
}
