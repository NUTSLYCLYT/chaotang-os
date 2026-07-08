'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronRight,
  Clapperboard,
  Coins,
  BriefcaseBusiness,
  ShoppingBag,
  Stethoscope,
  Telescope,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { AgentRun } from '@/types/agent';
import type { IntelSignal } from '@/types/intel';
import { formatHealthRiskLevel, type HealthProfile } from '@/types/health';
import type { Task } from '@/types/task';
import { isReady, type AsyncState } from '@/types/async-state';
import {
  useImperialSeal,
  type Verdict,
} from '@/features/shared/components/imperial-seal-stamp';

/** 先落印 · 再跳转的金色 CTA */
function SealAndGoButton({
  href,
  label,
  verdict,
}: {
  href: string;
  label: string;
  verdict: Verdict;
}) {
  const router = useRouter();
  const seal = useImperialSeal();
  return (
    <button
      type="button"
      onClick={() => {
        seal({ verdict });
        // 玺印 0.8s 后跳转，保留仪式感
        window.setTimeout(() => {
          router.push(href);
        }, 780);
      }}
      className="inline-flex items-center gap-2 rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/12 px-7 py-3 text-[12px] font-semibold tracking-[0.08em] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
    >
      {label}
      <ChevronRight size={14} />
    </button>
  );
}

export interface QuadrantData {
  signals: IntelSignal[];
  health: HealthProfile;
}

export function GovernanceDecisionPanel() {
  return (
    <GlassPanel variant="gold" tone="elevated" padding="lg" hudCorners>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-eyebrow">Decision Gate · 是否进入三省</div>
          <h2 className="section-title mt-3 text-[22px]">先做一个判断：这件事是“执行”，还是“治理”。</h2>
          <p className="body-copy mt-3 max-w-[60ch]">
            只执行，就去庄园。要批准、会签、定边界，就进三省。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/governance" className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/12 px-4 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18">
            看三省治理流
          </Link>
          <Link href="/manors" className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5">
            去庄园执行面
          </Link>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.04] px-4 py-3 text-[12px] leading-6 text-[#D9CFB4]">
        今日默认动作：先看急章最亮的官员，再决定是送三省，还是直接派庄园。
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DecisionBucket
          title="直接去庄园与蜂群"
          tone="success"
          items={[
            '方向已定，只是执行。',
            '不需要审批、会签或改规则。',
            '销售推进、页面调整、已批准实验。',
          ]}
        />
        <DecisionBucket
          title="必须进入三省治理流"
          tone="gold"
          items={[
            '需要正式批准或重定调。',
            '需要多方会签。',
            '要改优先级、口径、规则或存在制度风险。',
          ]}
        />
      </div>
    </GlassPanel>
  );
}

function DecisionBucket({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'success' | 'gold';
}) {
  const color = tone === 'success' ? '#3DD68C' : '#F0C66A';
  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4">
      <div className="text-[13px] font-semibold" style={{ color }}>{title}</div>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-white/6 bg-black/15 px-3 py-3 text-[11px] leading-6 text-[#9AA3C4]">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CourtSequencePanel() {
  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners className="overflow-hidden">
      <div className="section-eyebrow text-[#8e7a4b]">Imperial Sequence · 进殿顺序</div>
      <h2 className="section-title mt-3 text-[24px]">先看什么，后看什么</h2>
      <div className="mt-5 space-y-3">
        {[
          ['第一步', '看急章', '先确定今天先问谁。'],
          ['第二步', '做深问', '需要时再召入上书房。'],
          ['第三步', '收判断', '回丞相台，只问去向。'],
          ['第四步', '去治理或执行', '该审批进三省，该推进去庄园。'],
        ].map(([step, title, body]) => (
          <div
            key={step}
            className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[#F0C66A]/25 bg-[#F0C66A]/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[#F0C66A]">
                {step}
              </span>
              <div className="text-[13px] font-semibold text-[#F5E9C9]">{title}</div>
            </div>
            <div className="mt-2 text-[12px] leading-6 text-[#9AA3C4]">{body}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/departments"
          className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/12 px-4 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
        >
          巡阅六部
        </Link>
        <Link
          href="/command-center"
          className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
        >
          直接请丞相解读
        </Link>
      </div>
    </GlassPanel>
  );
}

export function CourtConstitutionPanel() {
  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-eyebrow text-[#8e7a4b]">Court Constitution · 宪制总图</div>
          <h2 className="section-title mt-3 text-[24px]">别把角色看成同级菜单，它们是有上下游关系的。</h2>
          <p className="body-copy mt-3 max-w-[70ch]">
            太子是日常代行视角，丞相是解释与路由中枢，三省是治理流，六部是共享能力域，庄园是行业战场。用户不必先学制度，只要先走对链路。
          </p>
        </div>
        <Link
          href="/throne"
          className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
        >
          查看太子监国视图
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
          <div className="text-[12px] font-semibold text-[#F5E9C9]">上层：谁负责判断与裁定</div>
          <div className="mt-3 grid gap-3">
            {[
              ['陛下', '只看高价值事项与最后裁定。'],
              ['太子', '负责日常监国、先盯一件事、决定是否惊动大殿。'],
              ['丞相', '负责解释、压缩、路由，并形成正式建议。'],
              ['三省', '负责把建议变成起草、复核、下发三段治理动作。'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-white/6 bg-black/20 px-4 py-3">
                <div className="text-[12px] font-semibold text-[#F0C66A]">{title}</div>
                <div className="mt-1 text-[11px] leading-6 text-[#9AA3C4]">{body}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
          <div className="text-[12px] font-semibold text-[#F5E9C9]">下层：谁负责能力，谁负责业务</div>
          <div className="mt-3 grid gap-3">
            {[
              ['六部', '横向共享能力域。回答“靠什么能力解决”。'],
              ['庄园', '纵向行业业务域。回答“在哪个战场承接与执行”。'],
              ['六部 × 庄园', '庄园不替代六部，而是借六部能力去打具体业务仗。'],
              ['蜂群工位', '庄园里的实际执行面，承接任务、推进、回写、复盘。'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-white/6 bg-black/20 px-4 py-3">
                <div className="text-[12px] font-semibold text-[#6BA0FF]">{title}</div>
                <div className="mt-1 text-[11px] leading-6 text-[#9AA3C4]">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/governance"
          className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/12 px-4 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
        >
          进入三省治理流
        </Link>
        <Link
          href="/manors"
          className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
        >
          查看庄园与蜂群
        </Link>
      </div>
    </GlassPanel>
  );
}

export function ExecutiveSignalGrid({
  signals,
  health,
  activeCount,
}: {
  signals: IntelSignal[];
  health: HealthProfile;
  activeCount: number;
}) {
  const riskSignals = signals.filter((s) => s.category === 'risk');
  const oppSignals = signals.filter((s) => s.category === 'opportunity');
  const latestIntel = signals[0]?.title ?? '当前没有新的外部急报';
  const latestOpportunity = oppSignals[0]?.title ?? '今日没有新增投资机会';

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 2xl:grid-cols-6">
      <ExecutiveLiveCard
        icon={AlertTriangle}
        title="锦衣卫"
        subtitle="最新情报"
        accent="#F43F5E"
        headline={latestIntel}
        detail={`${riskSignals.length} 条高风险信号待处置`}
        href="/intel"
      />
      <ExecutiveLiveCard
        icon={Coins}
        title="户部"
        subtitle="投资与证券"
        accent="#F0C66A"
        headline={latestOpportunity}
        detail="先看投资机会、资金动向与证券判断"
        href="/study/hubu"
      />
      <ExecutiveLiveCard
        icon={BriefcaseBusiness}
        title="外事专署"
        subtitle="跟单与拓展"
        accent="#6BA0FF"
        headline={`${activeCount} 支蜂群正在跟单与开窗`}
        detail="先看海外商务接触、视窗拓展与销售推进"
        href="/manors"
      />
      <ExecutiveLiveCard
        icon={ShoppingBag}
        title="电商庄园"
        subtitle="成交机会"
        accent="#3DD68C"
        headline="跨境成交机会正在形成"
        detail="先看海外电商渠道机会与成交趋势"
        href="/manors"
      />
      <ExecutiveLiveCard
        icon={Stethoscope}
        title="太医院"
        subtitle="健康与急救"
        accent="#34D399"
        headline={`健康分 ${health.totalScore} / 100`}
        detail={`风险 ${formatHealthRiskLevel(health.riskLevel)} · ${health.alerts.length} 条提醒 · 医院/医生/急救待接入`}
        href="/health"
      />
      <ExecutiveLiveCard
        icon={Telescope}
        title="钦天监"
        subtitle="趋势与命运"
        accent="#B794F4"
        headline="大趋势仍在上行窗口"
        detail="先看企业走势、自身节奏与未来窗口"
        href="/forecast"
      />
    </div>
  );
}

function ExecutiveLiveCard({
  icon: Icon,
  title,
  subtitle,
  accent,
  headline,
  detail,
  href,
}: {
  icon: typeof AlertTriangle;
  title: string;
  subtitle: string;
  accent: string;
  headline: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/6 bg-white/[0.025] p-4 transition hover:-translate-y-0.5 hover:border-[rgba(240,198,106,0.28)] hover:bg-white/[0.045]"
    >
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color: accent }} />
        <div className="text-[13px] font-semibold text-[#F5E9C9]">{title}</div>
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: accent }}>
        {subtitle}
      </div>
      <div className="mt-3 line-clamp-2 text-[13px] font-semibold leading-6 text-[#E4D7B4]">{headline}</div>
      <div className="mt-2 line-clamp-2 text-[11px] leading-6 text-[#8F98B8]">{detail}</div>
      <div className="mt-4 flex items-center gap-1 text-[11px] text-[#F0C66A]">
        深入查看
        <ChevronRight size={13} />
      </div>
    </Link>
  );
}

export function SpecialForcesPanel({ runs }: { runs: AgentRun[] }) {
  const running = runs.filter((r) => r.state === 'running').length;
  const waiting = runs.filter((r) => r.state === 'waiting_dependency').length;
  const summarizing = runs.filter((r) => r.state === 'summarizing').length;

  return (
    <GlassPanel variant="gold" tone="elevated" padding="lg" hudCorners>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-eyebrow">Special Forces · 特种军队面板</div>
          <h2 className="section-title mt-3 text-[20px]">蜂群执行态</h2>
          <p className="body-copy mt-2 max-w-[52ch] text-[12px] text-[#9AA3C4]">
            首页只看哪支蜂群在推进、卡住或回写中，深入细节再进庄园。
          </p>
        </div>
        <Link href="/manors" className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5">
          去庄园与蜂群
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <ForcesCard title="情报军" value={`${running} 支`} detail="负责最新情报、外部风险与投资机会扫描" />
        <ForcesCard title="交易军" value={`${summarizing} 支`} detail="负责资金判断、投资机会与成交推进回写" />
        <ForcesCard title="内容军" value="就绪" detail="负责宣传文案、资料、视频脚本与素材产出" />
        <ForcesCard title="经营军" value={`${waiting} 项`} detail="负责电商、销售与业务推进中的阻塞与升级" />
      </div>
    </GlassPanel>
  );
}

function ForcesCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">{title}</div>
      <div className="mt-2 text-[20px] font-semibold text-[#F5E9C9]">{value}</div>
      <div className="mt-2 text-[11px] leading-6 text-[#8F98B8]">{detail}</div>
    </div>
  );
}

export function MarketingOutputPreview() {
  return (
    <GlassPanel variant="gold" tone="elevated" padding="lg" hudCorners>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-eyebrow">Marketing Forge · 营销素材工坊</div>
          <h2 className="section-title mt-3 text-[20px]">最新素材产出</h2>
          <p className="body-copy mt-2 max-w-[46ch] text-[12px] text-[#9AA3C4]">
            这里只看最新文案、资料和视频脚本，不在首页展开长编辑流程。
          </p>
        </div>
        <Link href="/reports" className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5">
          去资料与报告
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <OutputCard title="宣传文案" body="新一版官网主文案已生成，等待礼部定调。" />
        <OutputCard title="产品资料" body="高管版一页纸与销售版资料已更新，适合直接分发。" />
        <OutputCard title="视频脚本" body="首支演示视频脚本已形成，可继续转入内容蜂群制作。" />
      </div>
    </GlassPanel>
  );
}

function OutputCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-4">
      <div className="flex items-center gap-2">
        <Clapperboard size={14} className="text-[#F0C66A]" />
        <div className="text-[13px] font-semibold text-[#F5E9C9]">{title}</div>
      </div>
      <div className="mt-3 text-[11px] leading-6 text-[#8F98B8]">{body}</div>
    </div>
  );
}

export function ImperialDecisionDeck({
  task,
  quadrant,
  activeCount,
}: {
  task: Task | null;
  quadrant: AsyncState<QuadrantData>;
  activeCount: number;
}) {
  const signals = isReady(quadrant) ? quadrant.data.signals : [];
  const critical = signals.find((s) => s.level === 'critical');
  const warningCount = signals.filter((s) => s.level === 'warning' || s.level === 'critical').length;

  const focusTitle = critical?.title ?? task?.title ?? '朝堂当前无急务';
  const focusSource = critical
    ? '锦衣卫急报'
    : task
      ? '丞相中枢'
      : '大殿空窗';
  const focusReason = critical
    ? critical.summary
    : task?.description ?? task?.rawCommand ?? '当前没有需要陛下立刻批示的紧急事项。';
  const digitalTwin = critical
    ? '数字分身草拟：先看急报，再请你决定是否交由丞相扩大战情研判。'
    : task?.status === 'report_ready'
      ? '数字分身草拟：此案已压缩到可批示状态，你只需看关键证据后准驳。'
      : task
        ? '数字分身草拟：先让丞相继续推进，关键节点再回到御前裁定。'
        : '数字分身草拟：当前可巡视六部、下达新旨或复盘史馆，由你选择下一步。';
  const primeMinister = critical
    ? '丞相建议：立刻建案，先定风险边界，再分派六部给出对策。'
    : task?.status === 'report_ready'
      ? '丞相建议：此刻最值钱的动作不是再看数据，而是做最后一锤定音。'
      : task?.status === 'running' || task?.status === 'aggregating'
        ? '丞相建议：此案尚在办理，不必频繁打断，等结果汇总后再批示。'
        : '丞相建议：大殿当前平稳，可把注意力放到下一份重要旨意上。';
  const nextAction = critical
    ? '下一步：进入指挥台，命丞相立刻拆解并派发。'
    : task?.status === 'report_ready'
      ? '下一步：进入御前简报，批示“准”或“再议”。'
      : task
        ? '下一步：查看当前总任务，确认是否需要催办。'
        : '下一步：亲笔下达新旨，建立新的主线任务。';
  const nextHref = critical
    ? '/command-center'
    : task?.status === 'report_ready'
      ? task?.id
        ? `/throne/brief/${task.id}`
        : '/throne'
      : task
        ? '/command-center'
        : '/throne/compose';

  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners glow className="overflow-hidden">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_0.95fr]">
        <div>
          <div className="page-eyebrow text-[#8e7a4b]">
            Emperor View · Today Only
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[#F0C66A]">
              {focusSource}
            </span>
            <span className="page-meta text-[11px]">
              {warningCount} 条高风险 / {activeCount} 部门执行中
            </span>
          </div>
          <h2 className="display-serif mt-6 max-w-[11ch] text-[46px] font-semibold leading-[0.96] text-[#f7edd1]">
            今天最该先处理的，只有这一件事。
          </h2>
          <div className="gold-text display-serif mt-5 max-w-[16ch] text-[34px] font-bold leading-[1.02]">
            {focusTitle}
          </div>
          <p className="body-copy mt-5 max-w-[54ch] text-[14px] text-[#c6bb9d]">
            {focusReason}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <SealAndGoButton
              href={nextHref}
              label={task?.status === 'report_ready' ? '进入御前简报' : '立即处理'}
              verdict="准"
            />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('court:seal-stamp', {
                      detail: { verdict: '查' },
                    }),
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-5 py-3 text-[12px] font-medium text-[#C8CDD8] transition hover:bg-white/[0.06]"
            >
              先查清再批
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-[#f0c66a]/12 bg-[#f0c66a]/[0.04] px-4 py-3 text-[13px] leading-6 text-[#e2d6b6]">
            {nextAction}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-[#f0c66a]/12 bg-[#f0c66a]/[0.03] p-5">
            <div className="section-eyebrow text-[#8e7a4b]">
              Digital Twin
            </div>
            <div className="display-serif mt-3 text-[20px] font-semibold text-[#f7edd1]">数字分身建议</div>
            <p className="body-copy mt-3 text-[#c6bb9d]">{digitalTwin}</p>
            <div className="mt-4 rounded-xl border border-[#F0C66A]/12 bg-[#F0C66A]/[0.03] px-3 py-2 text-[11px] leading-5 text-[#F0C66A]">
              只压缩局势和代拟口径，不代你准驳、签约、付款或公开发布。
            </div>
          </div>

          <div className="rounded-2xl border border-[#f0c66a]/12 bg-[#f0c66a]/[0.025] p-5">
            <div className="section-eyebrow text-[#8e7a4b]">
              丞相批注
            </div>
            <div className="display-serif mt-3 text-[20px] font-semibold text-[#f7edd1]">丞相今日批注</div>
            <p className="body-copy mt-3 text-[#c6bb9d]">{primeMinister}</p>
            <div className="mt-4 border-t border-[#f0c66a]/10 pt-3 text-[11px] leading-5 text-[#d9cfb4]">
              陛下只看最关键的一案，其余交给朝堂持续推进。
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
