'use client';

/**
 * 户部 · 单司圣旨详情（M2 · 投资司为样板间 · 2026-06-27）
 *
 * 点左栏某司 → 中栏卷轴切到该司专属板块。投资司做满🟢(纯函数真)；其余司先板块占位+数据源灯。
 * 四象限/敏感性靠 hubu-engines 纯函数算真值；NPV/IRR/DCF/市场行情需外部数据 → 诚实标"待接"(费曼)。
 * 零新图表依赖：四象限用原生 SVG。
 */
import { useHubuOverview } from '@/features/hubu/hooks/use-hubu-overview';
import { HUBU_STAFF_CATALOG } from '@/features/hubu/lib/hubu-roster';
import { evaluateProject, HUBU_QUADRANT } from '@/features/hubu/lib/hubu-engines';
import type { HubuProject, HubuSummary } from '@/lib/contracts/hubu';

const ACCENT = '#F0C66A';

function roiNormOf(roiMultiple: number): number {
  return Math.max(0, Math.min(1, roiMultiple / 3)) * 100;
}

function SourceTag({ kind }: { kind: 'live' | 'feed' | 'backend' }) {
  const map = {
    live: { c: '#5FB97A', t: '🟢 真算' },
    feed: { c: '#E5B84D', t: '🟡 待接行情源' },
    backend: { c: '#E5604D', t: '🔴 待接后端真账' },
  }[kind];
  return <span className="text-[10.5px]" style={{ color: map.c }}>{map.t}</span>;
}

function Block({ title, source, children }: { title: string; source: 'live' | 'feed' | 'backend'; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border px-3.5 py-3" style={{ borderColor: '#F0C66A1c', background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[#E9DDBE]">{title}</span>
        <SourceTag kind={source} />
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** ROI×风险 四象限（原生 SVG）。x=风险敞口, y=回报；左上绿优先/右上黄谨慎/左下灰观望/右下红否决。 */
function RiskRoiQuadrant({ projects }: { projects: HubuProject[] }) {
  const W = 320;
  const H = 230;
  const pad = 30;
  const innerW = W - 2 * pad;
  const innerH = H - 2 * pad;
  const pts = projects
    .map((p) => ({ p, ev: evaluateProject(p) }))
    .filter((x) => x.ev.roiMultiple != null && x.ev.exposure != null)
    .map((x) => ({
      title: x.p.title,
      x: pad + (x.ev.exposure! / 100) * innerW,
      y: pad + (1 - roiNormOf(x.ev.roiMultiple!) / 100) * innerH,
      color: x.ev.quadrant ? HUBU_QUADRANT[x.ev.quadrant].color : ACCENT,
    }));
  const dropped = projects.length - pts.length;
  const midX = pad + innerW / 2;
  const midY = pad + innerH / 2;
  const cells = [
    { x: pad, y: pad, w: innerW / 2, h: innerH / 2, fill: '#5FB97A2e', label: '绿·优先投' },
    { x: midX, y: pad, w: innerW / 2, h: innerH / 2, fill: '#E5B84D2e', label: '黄·谨慎' },
    { x: pad, y: midY, w: innerW / 2, h: innerH / 2, fill: '#8B93A726', label: '灰·观望' },
    { x: midX, y: midY, w: innerW / 2, h: innerH / 2, fill: '#E5604D30', label: '红·否决' },
  ];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {cells.map((c, i) => (
          <g key={i}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={c.fill} stroke="#ffffff10" />
            <text x={c.x + 6} y={c.y + 14} fontSize="9" fill="#9aa0ad">{c.label}</text>
          </g>
        ))}
        <text x={pad} y={H - 8} fontSize="9" fill="#6f6750">低敞口</text>
        <text x={W - pad - 30} y={H - 8} fontSize="9" fill="#6f6750">高敞口</text>
        <text x={4} y={pad + 6} fontSize="9" fill="#6f6750">高回报</text>
        <text x={4} y={H - pad} fontSize="9" fill="#6f6750">低回报</text>
        {pts.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={4} fill={pt.color} stroke="#1a1408" strokeWidth={0.5}>
            <title>{pt.title}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-[11px] text-[#8f835f]">
        {pts.length} 项已定位 · {dropped > 0 ? `${dropped} 项缺预算/回报，未入图（缺证显性，不臆造坐标）` : '全部入图'}
      </p>
    </div>
  );
}

function InvestmentBoard({ projects }: { projects: HubuProject[] }) {
  const rows = projects
    .map((p) => ({ p, ev: evaluateProject(p) }))
    .sort((a, b) => (b.ev.score ?? -1) - (a.ev.score ?? -1))
    .slice(0, 5);
  return (
    <div className="space-y-3">
      <Block title="① ROI × 风险 四象限" source="live">
        <RiskRoiQuadrant projects={projects} />
      </Block>

      <Block title="② 财务分析（ROI / 敞口 / 评分 / 裁决）· 评分前 5" source="live">
        <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: '#ffffff10' }}>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-[#8f835f]" style={{ background: '#ffffff06' }}>
                <th className="px-2 py-1 text-left font-normal">投资事项</th>
                <th className="px-2 py-1 text-right font-normal">回报</th>
                <th className="px-2 py-1 text-right font-normal">敞口</th>
                <th className="px-2 py-1 text-right font-normal">评分</th>
                <th className="px-2 py-1 text-right font-normal">裁决</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, ev }) => (
                <tr key={p.id} className="border-t" style={{ borderColor: '#ffffff08' }}>
                  <td className="max-w-0 truncate px-2 py-1 text-[#d8cba8]" title={p.title}>{p.title}</td>
                  <td className="px-2 py-1 text-right text-[#E9DDBE]">{ev.roiMultiple != null ? `${ev.roiMultiple}x` : '缺'}</td>
                  <td className="px-2 py-1 text-right text-[#E9DDBE]">{ev.exposure ?? '缺'}</td>
                  <td className="px-2 py-1 text-right text-[#E9DDBE]">{ev.score ?? '缺'}</td>
                  <td className="px-2 py-1 text-right" style={{ color: ev.verdict === 'reject' ? '#E5604D' : ev.verdict === 'approve' ? '#5FB97A' : '#E5B84D' }}>{ev.verdictCn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11px] text-[#8f835f]">NPV / IRR / DCF 现值 需现金流序列 → <span style={{ color: '#E5B84D' }}>待接（缺证不臆造）</span></p>
      </Block>

      <Block title="③ 市场信息（行业景气 / 对标 ROI / 利率环境）" source="feed">
        <p className="text-[12px] text-[#9aa0ad]">实时行情/市场对标需外部数据源，本仓未接 —— 不画假 K 线。</p>
      </Block>

      <p className="text-[11.5px] text-[#8f835f]">产出：投资评审意见书（准奏/削减/缓议/驳回）+ 四象限定位 + 单向门判定。</p>
    </div>
  );
}

function BudgetStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border px-3 py-2" style={{ borderColor: '#ffffff10', background: '#ffffff04' }}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8f835f]">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold text-[#E9DDBE]">{value}</div>
    </div>
  );
}

function BudgetBoard({ projects, summary }: { projects: HubuProject[]; summary: HubuSummary | null }) {
  const ranked = projects
    .map((p) => ({ p, ev: evaluateProject(p) }))
    .sort((a, b) => (b.ev.score ?? -1) - (a.ev.score ?? -1))
    .slice(0, 6);
  const noScore = projects.filter((p) => evaluateProject(p).score === null).length;
  return (
    <div className="space-y-3">
      <Block title="① 预算执行" source="live">
        <div className="grid grid-cols-3 gap-2">
          <BudgetStat label="待批合计" value={summary?.total_requested ?? '—'} />
          <BudgetStat label="本周已准" value={summary?.approved_this_week ?? '—'} />
          <BudgetStat label="现金储备" value={summary?.cash_reserve ?? '—'} />
        </div>
      </Block>

      <Block title="② 待批优先级排序（评分高→先批）· 前 6" source="live">
        <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: '#ffffff10' }}>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-[#8f835f]" style={{ background: '#ffffff06' }}>
                <th className="px-2 py-1 text-left font-normal">事项</th>
                <th className="px-2 py-1 text-right font-normal">评分</th>
                <th className="px-2 py-1 text-right font-normal">敞口</th>
                <th className="px-2 py-1 text-right font-normal">裁决</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ p, ev }) => (
                <tr key={p.id} className="border-t" style={{ borderColor: '#ffffff08' }}>
                  <td className="max-w-0 truncate px-2 py-1 text-[#d8cba8]" title={p.title}>{p.title}</td>
                  <td className="px-2 py-1 text-right text-[#E9DDBE]">{ev.score ?? '缺'}</td>
                  <td className="px-2 py-1 text-right text-[#E9DDBE]">{ev.exposure ?? '缺'}</td>
                  <td className="px-2 py-1 text-right" style={{ color: ev.verdict === 'reject' ? '#E5604D' : ev.verdict === 'approve' ? '#5FB97A' : '#E5B84D' }}>{ev.verdictCn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {noScore > 0 && <p className="mt-1.5 text-[11px] text-[#8f835f]">{noScore} 项缺预算/回报，无法定评分 → <span style={{ color: '#E5B84D' }}>缓议补证</span></p>}
      </Block>

      <Block title="③ ROI × 风险 四象限" source="live">
        <RiskRoiQuadrant projects={projects} />
      </Block>

      <p className="text-[11.5px] text-[#8f835f]">产出：预算批复（准奏/削减分阶段/缓议/驳回）+ 优先级序 + 超支预警。</p>
    </div>
  );
}

function RolePlaceholder({ topics }: { topics: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-[#9aa0ad]">本司圣旨详情按样板间（投资司）复制，待建。计划板块：</p>
      <ul className="space-y-1">
        {topics.map((t) => (
          <li key={t} className="flex items-center justify-between rounded-[8px] border border-dashed px-2.5 py-1.5 text-[12px]" style={{ borderColor: '#ffffff14' }}>
            <span className="text-[#d8cba8]">{t}</span>
            <span className="text-[10.5px] text-[#6f6750]">待建</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HubuStaffDetail({ staffId }: { staffId: string }) {
  const { overview } = useHubuOverview();
  const role = HUBU_STAFF_CATALOG[staffId];
  const projects = overview?.projects ?? [];

  return (
    <section className="flex min-h-0 flex-col gap-3 pr-1 xl:h-full xl:overflow-y-auto">
      {role ? (
        <>
          <div className="rounded-[14px] border px-3.5 py-3" style={{ borderColor: `${role.accent}2a`, background: `linear-gradient(180deg,${role.accent}10 0%,rgba(6,8,14,0.9) 100%)` }}>
            <div className="flex items-center gap-2">
              <span className="display-serif text-[18px] text-[#F5E9C9]">{role.nameCn}司</span>
              <span className="text-[12px] text-[#9aa0ad]">· {role.realJobTitle}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-[#8f835f]">{role.guardianLens}</p>
          </div>

          {staffId === 'investment' ? (
            <InvestmentBoard projects={projects} />
          ) : staffId === 'budget' ? (
            <BudgetBoard projects={projects} summary={overview?.summary ?? null} />
          ) : (
            <RolePlaceholder topics={role.frontendTopics} />
          )}
        </>
      ) : (
        <p className="body-copy text-[#E5604D]">未知岗位。</p>
      )}
    </section>
  );
}
