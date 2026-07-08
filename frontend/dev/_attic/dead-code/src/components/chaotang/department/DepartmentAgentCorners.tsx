'use client';

import { AgentDialogueCorner } from '@/components/chaotang/agents/AgentDialogueCorner';

type DepartmentAgentCornersProps = {
  deptCode: string;
  deptLabel: string;
};

const DEPT_AGENT_META: Record<string, { name: string; duty: string; line: string; portrait: string; accent: string }> = {
  finance: {
    name: '户部尚书',
    duty: 'Finance Agent',
    line: '臣核预算、现金流和报价底线；值不值得花钱，先看账本再下旨。',
    portrait: '/heroes/character-roster/v5-manors-su-qin.webp',
    accent: '#F0C66A',
  },
  legal: {
    name: '刑部尚书',
    duty: 'Risk Agent',
    line: '臣守合同、付款、股权和对外承诺红线；不清楚责任边界，不准静默执行。',
    portrait: '/heroes/character-roster/unused-bao-zheng.webp',
    accent: '#F43F5E',
  },
  market: {
    name: '礼部尚书',
    duty: 'Brand Agent',
    line: '臣负责品牌、宣传、公关和审美门禁；可发布、需改写、禁外发，先说清。',
    portrait: '/assets/officials/libu.webp',
    accent: '#6FD0D8',
  },
  libu: {
    name: '礼部尚书',
    duty: 'Brand Agent',
    line: '臣负责品牌、宣传、公关和审美门禁；可发布、需改写、禁外发，先说清。',
    portrait: '/assets/officials/libu.webp',
    accent: '#6FD0D8',
  },
  ops: {
    name: '兵部尚书',
    duty: 'Ops Agent',
    line: '臣看执行战役、资源调度和交付节奏；卡在哪里，谁负责，何时回奏。',
    portrait: '/heroes/character-roster/bingbu-sun-wu.webp',
    accent: '#6BA0FF',
  },
  gongbu: {
    name: '工部尚书',
    duty: 'Build Agent',
    line: '臣管产品、工程、验收和发布质量；不能落地的方案，不算完成。',
    portrait: '/heroes/character-roster/v5-command-center-zhuge-liang.webp',
    accent: '#3DD68C',
  },
  works: {
    name: '工部尚书',
    duty: 'Build Agent',
    line: '臣管产品、工程、验收和发布质量；不能落地的方案，不算完成。',
    portrait: '/heroes/character-roster/v5-command-center-zhuge-liang.webp',
    accent: '#3DD68C',
  },
  personnel: {
    name: '吏部尚书',
    duty: 'Org Agent',
    line: '臣管岗位、权限、负责人和组织效率；谁该做、谁能批，先定清楚。',
    portrait: '/heroes/character-roster/v5-governance-wei-zheng.webp',
    accent: '#B9F6D2',
  },
  guard: {
    name: '锦衣卫指挥使',
    duty: 'Intel Agent',
    line: '臣查事实、竞品、外部信号和证据来源；未核验，不入圣旨。',
    portrait: '/heroes/character-roster/v5-intel-qi-jiguang.webp',
    accent: '#FB923C',
  },
  physician: {
    name: '太医院院使',
    duty: 'Health Agent',
    line: '臣诊系统健康、质量波动和运行风险；先验脉象，再开方。',
    portrait: '/heroes/character-roster/forecast-zhang-heng.webp',
    accent: '#7EC8E3',
  },
};

function openDepartmentScroll() {
  window.dispatchEvent(new CustomEvent('chaotang:open-department-scroll'));
}

export function DepartmentAgentCorners({ deptCode, deptLabel }: DepartmentAgentCornersProps) {
  const meta = DEPT_AGENT_META[deptCode] ?? {
    name: `${deptLabel}负责人`,
    duty: 'Minister Agent',
    line: '臣在本部门值守；先看今日任务、成果、风险和下一步动作。',
    portrait: '/heroes/character-roster/v5-command-center-zhuge-liang.webp',
    accent: '#F0C66A',
  };

  return (
    <>
      <AgentDialogueCorner
        side="left"
        name="丞相"
        duty="Chief of Staff"
        line={`${deptLabel}今日先看任务、证据、负责人和能否交付；需要老板拍板的才上呈。`}
        portrait="/heroes/character-roster/v5-command-center-zhuge-liang.webp"
        accent="#F0C66A"
        actionLabel={`看${deptLabel}案卷`}
        onAction={openDepartmentScroll}
        bottomClassName="bottom-[164px]"
      />
      <AgentDialogueCorner
        side="right"
        name={meta.name}
        duty={meta.duty}
        line={meta.line}
        portrait={meta.portrait}
        accent={meta.accent}
        actionLabel={`问${meta.name}`}
        onAction={openDepartmentScroll}
        bottomClassName="bottom-[164px]"
      />
    </>
  );
}
