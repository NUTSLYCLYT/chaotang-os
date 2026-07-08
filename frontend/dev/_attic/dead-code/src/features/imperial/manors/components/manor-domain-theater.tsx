'use client';

import { ImperialChartPanel } from '@/features/imperial/departments/components/imperial-chart-panel';
import { ImperialCustomerPanel } from './imperial-customer-panel';
import { ImperialOverseasPanel } from './imperial-overseas-panel';
import type { ManorDomain } from '@/features/shared/lib/court-flow-data';

export interface ManorDomainTheaterProps {
  domain: ManorDomain;
}

export function ManorDomainTheater({ domain }: ManorDomainTheaterProps) {
  if (domain === 'marketing') {
    return <ImperialCustomerPanel />;
  }

  if (domain === 'ecommerce') {
    return <ImperialOverseasPanel />;
  }

  return (
    <ImperialChartPanel
      title="销售庄园经营主视区"
      subtitle="先看线索质量、回款节奏和升级压力，再决定是否继续放大快车队列。"
      bars={[
        { label: '高意图线索', value: 78, tone: 'gold' },
        { label: '预计回款进度', value: 69, tone: 'green' },
        { label: '边界风险', value: 34, tone: 'blue' },
        { label: '升级压力', value: 22, tone: 'purple' },
      ]}
      lineLabel="周度经营趋势"
    />
  );
}
