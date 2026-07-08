'use client';

import Link from 'next/link';
import { Archive, Send } from 'lucide-react';
import { DepartmentScrollStage, type DepartmentScrollFile, type DepartmentScrollTone } from './DepartmentScrollStage';

type DepartmentUniversalScrollProps = {
  deptCode: string;
  deptLabel: string;
};

type ScrollMeta = {
  tone: DepartmentScrollTone;
  chief: string;
  verdict: string;
  fileTitles: [string, string, string];
};

const DEPT_SCROLL_META: Record<string, ScrollMeta> = {
  finance: {
    tone: 'gold',
    chief: '户部尚书',
    verdict: '先核现金流、预算边界、报价底线，再准执行。',
    fileTitles: ['预算核验簿', '现金流奏报', '报价底线批注'],
  },
  legal: {
    tone: 'vermilion',
    chief: '刑部尚书',
    verdict: '合同、股权、付款、对外承诺先过责任边界。',
    fileTitles: ['风险断案簿', '合同红线录', '责任归属批注'],
  },
  market: {
    tone: 'cyan',
    chief: '礼部尚书',
    verdict: '先定审美、口径、公关风险，再准对外发布。',
    fileTitles: ['品宣会审稿', '视觉门禁录', '传播战役批注'],
  },
  libu: {
    tone: 'cyan',
    chief: '礼部尚书',
    verdict: '先定审美、口径、公关风险，再准对外发布。',
    fileTitles: ['品宣会审稿', '视觉门禁录', '传播战役批注'],
  },
  ops: {
    tone: 'blue',
    chief: '兵部尚书',
    verdict: '先看战役目标、资源调度、阻塞点，再排执行令。',
    fileTitles: ['战役调度图', '执行阻塞表', '交付军令批注'],
  },
  gongbu: {
    tone: 'jade',
    chief: '工部尚书',
    verdict: '方案必须能落地、能验收、能发布，否则退回重造。',
    fileTitles: ['工程营造簿', '验收清单', '发布门禁批注'],
  },
  works: {
    tone: 'jade',
    chief: '工部尚书',
    verdict: '方案必须能落地、能验收、能发布，否则退回重造。',
    fileTitles: ['工程营造簿', '验收清单', '发布门禁批注'],
  },
  personnel: {
    tone: 'jade',
    chief: '吏部尚书',
    verdict: '先定岗位、权限、负责人和交接链路，再动组织。',
    fileTitles: ['任免权限簿', '岗位绩效录', '负责人批注'],
  },
  guard: {
    tone: 'vermilion',
    chief: '锦衣卫指挥使',
    verdict: '未核验的消息不得入旨；先查来源、证据和反证。',
    fileTitles: ['情报源流图', '证据核验簿', '外部信号批注'],
  },
  physician: {
    tone: 'cyan',
    chief: '太医院院使',
    verdict: '先诊系统脉象、质量波动和运行风险，再开处方。',
    fileTitles: ['系统脉案', '质量诊断录', '调养处方批注'],
  },
};

function metaFor(deptCode: string, deptLabel: string): ScrollMeta {
  return DEPT_SCROLL_META[deptCode] ?? {
    tone: 'gold',
    chief: `${deptLabel}负责人`,
    verdict: '先看任务、证据、成果和风险，再决定下一步。',
    fileTitles: ['今日任务簿', '成果验收录', '主管批注'],
  };
}

function buildFiles(deptLabel: string, meta: ScrollMeta): DepartmentScrollFile[] {
  return [
    {
      id: 'task-ledger',
      label: '任务池',
      title: `${deptLabel}${meta.fileTitles[0]}`,
      meta: '替代谁 · 做什么 · 当前卡点',
      status: '待裁',
      body: (
        <div className="space-y-3">
          <p>今日先看真实任务池、负责人、截止时间和阻塞原因；所有事项按“能否替代部门员工完成实际工作”验收。</p>
          <p>左侧面板负责排队与筛选，右侧面板负责主管汇报；中央案卷只承载需要用户判断的关键证据。</p>
        </div>
      ),
    },
    {
      id: 'pipeline',
      label: '流水线',
      title: `${deptLabel}${meta.fileTitles[1]}`,
      meta: '输入 · 处理 · 产出 · 验收',
      status: '运行',
      body: (
        <div className="space-y-3">
          <p>每条工作必须展示输入材料、AI 员工处理状态、阶段产出、缺证和下一步动作；不能只展示部门介绍。</p>
          <p>用户进门后应立刻知道：谁在干活、干到哪、产出了什么、哪里需要他拍板。</p>
        </div>
      ),
    },
    {
      id: 'chief-brief',
      label: '主管汇报',
      title: `${deptLabel}${meta.fileTitles[2]}`,
      meta: `${meta.chief} · 裁决建议`,
      status: '上呈',
      body: (
        <div className="space-y-3">
          <p>{meta.verdict}</p>
          <p>主管汇报必须短、硬、可执行：结论在前，证据随后，风险明示，最后给出用户可点击的下一步。</p>
        </div>
      ),
    },
  ];
}

export function DepartmentUniversalScroll({ deptCode, deptLabel }: DepartmentUniversalScrollProps) {
  // libu/market/physician/finance 已是各自的真 client 全屏页，不叠通用卷轴 chrome
  //（physician 太医院尤其忌——卷轴 fileTitles 含「系统脉案/质量诊断录」诊断味，违背不诊断边界；
  //  finance 户部 HubuClient 自带「库银总览/中央三本账/审计裁决」真三栏，卷轴只会盖住中央三本账）。
  if (deptCode === 'libu' || deptCode === 'market' || deptCode === 'physician' || deptCode === 'finance') return null;

  const meta = metaFor(deptCode, deptLabel);
  const files = buildFiles(deptLabel, meta);

  return (
    <div data-three-axis-scroll className="pointer-events-none fixed left-1/2 top-[72px] z-[64] w-[min(900px,calc(100vw-28px))] -translate-x-1/2 lg:top-[74px]">
      <div className="pointer-events-auto mx-auto">
        <DepartmentScrollStage
          eyebrow={`${deptLabel}主案 · AI 部门办公室`}
          title={`${deptLabel}今日案卷`}
          files={files}
          edict={{
            title: `${deptLabel}主管批示`,
            verdict: meta.verdict,
            seal: meta.chief,
            body: (
              <div className="space-y-3">
                <p>{meta.verdict}</p>
                <p>两侧面板负责工作流，中间案卷负责关键裁决；默认收卷，让部门背景和办公室空间先被看见。</p>
              </div>
            ),
          }}
          tone={meta.tone}
          defaultCollapsed
          actions={
            <>
              <Link
                href={`/court-briefing?dept=${encodeURIComponent(deptCode)}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:brightness-105"
                style={{ borderColor: 'rgba(122,74,8,0.34)', color: '#5b3410', background: 'rgba(122,74,8,0.08)' }}
              >
                <Send size={12} />
                下旨处理
              </Link>
              <Link
                href={`/archive?dept=${encodeURIComponent(deptCode)}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:brightness-105"
                style={{ borderColor: 'rgba(122,74,8,0.30)', color: '#5b3410', background: 'rgba(255,248,224,0.16)' }}
              >
                <Archive size={12} />
                入史归档
              </Link>
            </>
          }
        />
      </div>
    </div>
  );
}
