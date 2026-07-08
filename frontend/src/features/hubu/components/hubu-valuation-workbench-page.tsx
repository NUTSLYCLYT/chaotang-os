'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  ChevronRight,
  Landmark,
  LibraryBig,
  ScrollText,
  ShieldAlert,
  Wallet,
} from 'lucide-react';

import { DepartmentPageCanvas, DepartmentStage } from '@/features/departments/components/DepartmentPageShell';
import { DepartmentWorkflowChip } from '@/features/departments/components/DepartmentWorkflowChip';
import {
  DepartmentScrollStage,
  type DepartmentEdict,
  type DepartmentScrollFile,
  type DepartmentSourceLabel,
} from '@/components/chaotang/department/DepartmentScrollStage';
import { assetUrl } from '@/lib/asset';
import type { DeptOverview } from '@/lib/contracts/dept';
import type { HubuOverview, HubuProject } from '@/lib/contracts/hubu';
import { useHubuOverview } from '@/features/hubu/hooks/use-hubu-overview';

const HUBU_ACCENT = '#F0C66A';
const HUBU_BLUE = '#7EC8E3';
const HUBU_GOLD_BG = 'linear-gradient(135deg, rgba(240,198,106,0.96), rgba(212,168,75,0.92))';

type DetailItem = {
  id: string;
  title: string;
  intro: string;
  meta: string;
  body: string[];
};

function metricValue(value: string | number | null | undefined, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function buildDeptOverview(overview: HubuOverview | null, isLoading: boolean): DeptOverview {
  return {
    code: 'finance',
    agentCode: 'hu_bu',
    minister: {
      id: 'hubu-minister',
      name: '户部尚书',
      role: 'CFO Office / Valuation Office',
      iconKey: 'wallet',
      description: '负责现金、预算、报价、估值与财务裁决。',
    },
    status: isLoading ? 'processing' : overview ? 'pending_review' : 'idle',
    recentMemorials: [],
    activeTasks: [],
    keyMetrics: [
      { label: '现金余量', value: metricValue(overview?.summary.cash_reserve) },
      { label: '待批事项', value: metricValue(overview?.summary.pending_count, '0'), unit: '件' },
      { label: '平均 ROI', value: metricValue(overview?.summary.avg_roi) },
    ],
  };
}

function buildDetailItems(overview: HubuOverview | null, selectedProject: HubuProject | null): DetailItem[] {
  return [
    {
      id: 'valuation',
      title: '公司估值总裁决',
      intro: '统一估值叙事、价格纪律与证据门槛。',
      meta: overview ? 'LIVE / 会审完成后可落圣旨' : 'FALLBACK / 等待真实数据',
      body: [
        '估值判断必须同时回答三件事：钱从哪里来、利润何时形成、增长凭什么可持续。',
        '没有真实现金流、回款节奏与责任边界，就不允许把产品故事包装成公司价值。',
        '礼部、兵部、工部、锦衣卫只提供协同视角，最终口径由户部统一收束。',
      ],
    },
    {
      id: 'moat',
      title: '核心竞争力评定',
      intro: '把产品护城河和组织兑现能力拆开审。',
      meta: selectedProject ? `${selectedProject.title} / ${metricValue(selectedProject.estimated_roi)} ROI` : '等待选定项目',
      body: [
        '先审产品独特性，再审供应链和交付稳定性，最后审能否持续复利。',
        '任何“看起来很强”的能力，只要不能穿透到毛利、回款和复购，就不能记作护城河。',
        '右栏只放问题和方案，卷轴才展开完整论证。',
      ],
    },
    {
      id: 'growth',
      title: '商业成长价值',
      intro: '衡量增长是否真的增值，而不是增忙。',
      meta: overview ? `待批 ${metricValue(overview.summary.pending_count, '0')} 件` : '等待概览回传',
      body: [
        '增长价值要看回款速度、复购质量、交付压力和边际利润，而不是只看表面营收。',
        '高增长但低回款、高扩张但高返工，都应在户部视角下被打回重审。',
        '最终圣旨只保留一个后令，避免页面上同时出现多条相互冲突的判断。',
      ],
    },
  ];
}

function buildScrollFiles(items: DetailItem[]): DepartmentScrollFile[] {
  return items.map((item) => ({
    id: item.id,
    label: item.title,
    title: item.title,
    meta: item.meta,
    status: '待会审',
    body: (
      <div className="space-y-3">
        <p>{item.intro}</p>
        {item.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    ),
  }));
}

function buildEdict(selected: DetailItem, selectedProject: HubuProject | null): DepartmentEdict {
  return {
    title: '户部主簿裁决',
    verdict: selected.title,
    seal: '户部尚书',
    body: (
      <div className="space-y-3">
        <p>圣裁：{selected.intro}</p>
        <p>当前项目：{selectedProject?.title ?? '暂无真实项目'}。</p>
        <p>页面只在左右两栏与中部卷轴展示信息；卷轴收起后，背景应完整露出，不再堆叠文字卡片。</p>
      </div>
    ),
  };
}

function MetricTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div
      className="rounded-[18px] border px-4 py-3"
      style={{ borderColor: 'rgba(240,198,106,0.20)', background: 'rgba(240,198,106,0.08)' }}
    >
      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: HUBU_ACCENT }}>
        {label}
      </div>
      <div className="mt-2 font-mono text-[18px] font-semibold text-[#F8EBC8]">
        {value}
        {unit ? <span className="ml-1 text-[11px] text-[#B8AA88]">{unit}</span> : null}
      </div>
    </div>
  );
}

export function HubuValuationWorkbenchPage() {
  const { overview, isLoading } = useHubuOverview();
  const deptOverview = useMemo(() => buildDeptOverview(overview, isLoading), [overview, isLoading]);
  const selectedProject = overview?.projects[0] ?? null;
  const detailItems = useMemo(() => buildDetailItems(overview, selectedProject), [overview, selectedProject]);
  const [activeFileId, setActiveFileId] = useState(detailItems[0]?.id ?? 'valuation');
  const [openRequest, setOpenRequest] = useState(0);

  const scrollFiles = useMemo(() => buildScrollFiles(detailItems), [detailItems]);
  const selectedDetail = detailItems.find((item) => item.id === activeFileId) ?? detailItems[0];
  const edict = useMemo(() => buildEdict(selectedDetail, selectedProject), [selectedDetail, selectedProject]);
  const sourceLabel: DepartmentSourceLabel = overview ? 'LIVE' : isLoading ? 'MIXED' : 'FALLBACK';

  const openFile = (fileId: string) => {
    setActiveFileId(fileId);
    setOpenRequest((count) => count + 1);
  };

  return (
    <DepartmentPageCanvas
      ariaLabel="户部估值工作台"
      bgSrc={assetUrl('/assets/six-ministries/hubu-bg.webp')}
      bgAlt="户部估值工作台"
      overlayClassName="bg-transparent"
      imageClassName="object-cover opacity-100"
    >
      <DepartmentStage hasLiveStrip={false} className="overflow-hidden">
        <div className="mx-auto grid h-full max-w-[1780px] min-h-0 grid-cols-1 gap-4 pb-36 xl:grid-cols-[320px_minmax(0,1.08fr)_360px] xl:pb-28">
          <aside
            className="order-2 min-h-0 overflow-y-auto rounded-[26px] border px-4 py-4 pb-8 shadow-[0_28px_68px_rgba(0,0,0,0.30)] xl:order-1"
            style={{ borderColor: 'rgba(240,198,106,0.18)', background: 'linear-gradient(180deg, rgba(18,13,7,0.88), rgba(8,7,4,0.80))' }}
          >
            <Link
              href="/departments"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-[#D6CCB0] transition hover:text-[#F8EBC8]"
              style={{ borderColor: 'rgba(240,198,106,0.24)' }}
            >
              <ArrowLeft size={14} />
              返回六部大厅
            </Link>

            <div className="mt-5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: HUBU_ACCENT }}>
                <Wallet size={13} />
                Hubu Valuation Office
              </div>
              <h1 className="display-serif mt-2 text-[30px] font-semibold text-[#F8EBC8]">户部</h1>
              <p className="mt-3 text-[13px] leading-7 text-[#D6CCB0]">
                左栏只保留司簿面板和关键指标。详细表述全部进入二级入口或中部卷轴，不在背景上堆字。
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {deptOverview.keyMetrics.map((metric) => (
                <MetricTile key={metric.label} label={metric.label} value={metric.value} unit={metric.unit} />
              ))}
            </div>

            <div className="mt-5 rounded-[22px] border p-4" style={{ borderColor: 'rgba(240,198,106,0.16)', background: 'rgba(240,198,106,0.06)' }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: HUBU_ACCENT }}>
                <ScrollText size={12} />
                司簿目录
              </div>
              <div className="mt-3 space-y-2">
                {detailItems.map((item) => {
                  const active = item.id === activeFileId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openFile(item.id)}
                      className="group w-full rounded-[18px] border px-4 py-3 text-left transition hover:-translate-y-0.5"
                      style={{
                        borderColor: active ? 'rgba(240,198,106,0.54)' : 'rgba(240,198,106,0.18)',
                        background: active ? 'linear-gradient(135deg, rgba(240,198,106,0.24), rgba(163,116,30,0.18))' : 'rgba(255,255,255,0.025)',
                        boxShadow: active ? '0 16px 32px rgba(122,74,8,0.22)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold text-[#F8EBC8]">{item.title}</div>
                        <ChevronRight size={14} className="text-[#A98D55] transition group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-1 text-[11px] leading-6 text-[#AFA487]">{item.intro}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="order-1 min-h-[180px] xl:order-2 xl:min-h-0">
            <div className="mx-auto w-full max-w-[920px] md:px-2 xl:pt-2">
              <DepartmentScrollStage
                eyebrow="户部主案 / 估值、竞争力、成长价值"
                title="户部会审卷轴"
                files={scrollFiles}
                edict={edict}
                tone="gold"
                sourceLabel={sourceLabel}
                activeFileId={activeFileId}
                defaultCollapsed
                openRequest={openRequest}
              />
            </div>
          </main>

          <aside
            className="order-3 min-h-0 overflow-y-auto rounded-[26px] border px-4 py-4 pb-8 shadow-[0_28px_68px_rgba(0,0,0,0.30)]"
            style={{ borderColor: 'rgba(126,200,227,0.18)', background: 'linear-gradient(180deg, rgba(7,10,18,0.88), rgba(6,8,12,0.78))' }}
          >
            <DepartmentWorkflowChip deptLabel="户部" deptCode="finance" embedded />

            <div className="mt-4 rounded-[22px] border px-4 py-4" style={{ borderColor: 'rgba(240,198,106,0.20)', background: 'rgba(240,198,106,0.08)' }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: HUBU_ACCENT }}>
                <ScrollText size={13} />
                Final Judgement
              </div>
              <div className="mt-3 text-[16px] font-semibold text-[#F8EBC8]">{selectedDetail.title}</div>
              <div className="mt-2 text-[12px] leading-6 text-[#D6CCB0]">{selectedDetail.intro}</div>
            </div>

            <div className="mt-4 rounded-[22px] border px-4 py-4" style={{ borderColor: 'rgba(126,200,227,0.20)', background: 'rgba(126,200,227,0.08)' }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: HUBU_BLUE }}>
                <BadgeDollarSign size={13} />
                Current Project
              </div>
              <div className="mt-3 text-[15px] font-semibold text-[#F8EBC8]">{selectedProject?.title ?? '暂无真实项目'}</div>
              <div className="mt-2 text-[12px] leading-6 text-[#D6CCB0]">
                预算 {metricValue(selectedProject?.requested_budget)} / ROI {metricValue(selectedProject?.estimated_roi)} / 风险 {metricValue(selectedProject?.risk_level)}
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border px-4 py-4" style={{ borderColor: 'rgba(240,198,106,0.20)', background: 'rgba(240,198,106,0.08)' }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: HUBU_ACCENT }}>
                <ShieldAlert size={13} />
                Evidence Gate
              </div>
              <div className="mt-3 space-y-2 text-[12px] leading-6 text-[#D6CCB0]">
                <p>缺付款条件，退回补证。</p>
                <p>缺授权人，退回补证。</p>
                <p>缺合同责任边界，转礼部与锦衣卫复核。</p>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border px-4 py-4" style={{ borderColor: 'rgba(240,198,106,0.18)', background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: HUBU_ACCENT }}>
                <Landmark size={13} />
                Detail Queue
              </div>
              <div className="mt-3 space-y-2">
                {detailItems.map((item) => {
                  const active = item.id === activeFileId;
                  return (
                    <button
                      key={`detail-${item.id}`}
                      type="button"
                      onClick={() => openFile(item.id)}
                      className="w-full rounded-[16px] border px-3 py-3 text-left transition hover:-translate-y-0.5"
                      style={{
                        borderColor: active ? 'rgba(240,198,106,0.54)' : 'rgba(240,198,106,0.16)',
                        background: active ? 'linear-gradient(135deg, rgba(240,198,106,0.20), rgba(163,116,30,0.12))' : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div className="text-[12px] font-semibold text-[#F8EBC8]">{item.title}</div>
                      <div className="mt-1 text-[11px] leading-6 text-[#D6CCB0]">{item.meta}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border px-4 py-4" style={{ borderColor: 'rgba(240,198,106,0.16)', background: 'rgba(255,255,255,0.035)' }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: HUBU_ACCENT }}>
                <LibraryBig size={13} />
                Secondary Views
              </div>
              <div className="mt-3 grid gap-2">
                <Link
                  href="/reports?dept=finance"
                  className="rounded-[14px] border px-3 py-2 text-[12px] font-semibold text-[#2B1A05]"
                  style={{ borderColor: 'rgba(240,198,106,0.38)', background: HUBU_GOLD_BG }}
                >
                  财务报告
                </Link>
                <Link
                  href="/archive?dept=finance"
                  className="rounded-[14px] border px-3 py-2 text-[12px] font-semibold text-[#2B1A05]"
                  style={{ borderColor: 'rgba(240,198,106,0.38)', background: HUBU_GOLD_BG }}
                >
                  史馆归档
                </Link>
                <Link
                  href="/command-center?from=hubu"
                  className="rounded-[14px] border px-3 py-2 text-[12px] font-semibold text-[#2B1A05]"
                  style={{ borderColor: 'rgba(240,198,106,0.38)', background: HUBU_GOLD_BG }}
                >
                  会审中枢
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </DepartmentStage>
    </DepartmentPageCanvas>
  );
}
