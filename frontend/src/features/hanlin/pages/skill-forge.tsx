'use client';

import Link from 'next/link';
import {
  Archive,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FlaskConical,
  Gavel,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { PageBrief } from '@/features/shared/components/page-brief';

const stages = [
  { key: '采证', owner: '锦衣卫', status: '6 sources', icon: FileSearch },
  { key: '学习', owner: '钦天监', status: '3 layers', icon: BookOpenCheck },
  { key: '炼 Skill', owner: '翰林院', status: '5 cases', icon: FlaskConical },
  { key: '评测', owner: '户部', status: 'unsafe blocked', icon: Gavel },
  { key: '入史', owner: '史馆', status: '30/60/90', icon: Archive },
] as const;

const evidenceCards = [
  {
    color: 'green',
    label: '绿牌 · primary verified',
    title: 'Raspberry Pi H1 FY2026 交易更新',
    body: 'Issuer regulatory news reports more than 4 million units and adjusted EBITDA of at least $38 million.',
    source: 'RNS · 2026-06-05 · accessed 2026-06-07',
    href: 'https://www.investegate.co.uk/announcement/rns/raspberry-pi-holdings-wi---rpi/trading-update/9603039',
  },
  {
    color: 'yellow',
    label: '黄牌 · issuer biased',
    title: 'Valens VA7000 第四个设计赢单',
    body: 'Design win is useful evidence, but it does not prove revenue timing, margin, or materiality.',
    source: 'Valens investor release · 2026-01-06',
    href: 'https://investors.valens.com/news-and-events/news/news-details/2026/Valens-Semiconductor-Secures-4th-VA7000-MIPI-A-PHY-Design-Win-with-a-Premium-Carmaker-Serving-the-Chinese-Market/default.aspx',
  },
  {
    color: 'red',
    label: '红牌 · unaudited social claim',
    title: 'Serenity 4502% / 3840% 收益冲突',
    body: 'The return claim is public media context only: no audited account statement, full trade log, drawdown, or realized split.',
    source: 'HTX / Coinlive reposts · accessed 2026-06-07',
    href: 'https://www.coinlive.com/zh/news/decoding-the-45x-returns-of-us-stock-market-guru-serenity',
  },
  {
    color: 'black',
    label: '黑牌 · prohibited output',
    title: '禁止买卖点与仓位指令',
    body: 'Any output that turns the case into buy, sell, hold, allocation, target price, or personalized advice is blocked.',
    source: 'Hubu gate policy · 2026-06-07',
    href: '/hubu',
  },
] as const;

const learningRows = [
  {
    label: '5 分钟理解',
    text: '不要复制神话收益。把案例蒸馏成“找上游瓶颈、验主证据、标不确定性”的学习路径。',
  },
  {
    label: '30 分钟实操',
    text: '画下游需求波、找稀缺上游环节、收监管/公告/论文/财报、再做流动性与叙事红队。',
  },
  {
    label: '专家备忘录',
    text: '户部只接收 watchlist-grade research：来源、时间戳、下行、失效点、人工复核、复盘日期齐全。',
  },
] as const;

const skillChecks = [
  'source_pack · 6 sources / 6 claims',
  'learning_pack · beginner / practitioner / expert',
  'candidate_skill · hubu-bottleneck-investing',
  'golden_cases · 5 cases',
  'outcome_ledger · 30/60/90 review plan',
  'genius_design_coverage · 5/5',
] as const;

const videoSkillProtocol = [
  '已学习 · 抽取可复用方法，不停在摘要',
  '已安装/创建 · 能装就装，不能装就本地复刻',
  '已试用 · 必须在朝堂项目跑一次',
  '未完成风险 · 账号、灰度、权限和证据缺口明示',
] as const;

const timeline = [
  { time: '00:00', title: '锦衣卫采证', detail: 'source pack 建立，红黄绿黑证据牌分流。' },
  { time: '00:18', title: '钦天监蒸馏', detail: '5 分钟、30 分钟、专家备忘录、问答和 teach-back 完成。' },
  { time: '00:32', title: '翰林炼 Skill', detail: '候选 skill 写入 hubu-bottleneck-investing，等待评测。' },
  { time: '00:40', title: '户部门禁', detail: '安全案例 2/2 通过，unsafe buy-call 被阻断。' },
  { time: '01:00', title: '史馆入卷', detail: '下次复盘日 2026-07-07，保留来源、prompt、变换和评测报告。' },
] as const;

export function HanlinSkillForgePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1680px] space-y-5 p-6 pb-12">
        <PageBrief
          eyebrow="Skill Forge · 翰林炼 Skill"
          title="把外部神话拆成证据、课程、Skill、评测和复盘，而不是把热点直接交给蜂群。"
          subtitle="锦衣卫负责来源，钦天监负责学习蒸馏，翰林负责炼 Skill，户部负责投资门禁，史馆负责复盘进化。"
          hook="世界级系统不是更会相信故事，而是更快把故事拆成可验证能力。"
          brief="当前样本使用 Serenity 瓶颈投资法。收益数字只作为未审计媒体线索；真正进入系统的是供应链瓶颈研究方法、非建议边界、证据等级和评测门禁。"
          philosophy="每个 Skill 必须带来源、时间戳、假设、不确定性、红队问题、golden cases 和史馆复盘日。"
          stats={[
            { label: '来源', value: '6' },
            { label: '证据牌', value: '4 色' },
            { label: '评测', value: '6/6 pass' },
            { label: '户部门禁', value: 'unsafe blocked' },
          ]}
          primaryAction={{ label: '运行评测', href: '#evaluation' }}
          secondaryAction={{ label: '查看户部门禁', href: '#hubu-gate', tone: 'secondary' }}
        />

        <div className="grid gap-5 xl:grid-cols-[0.86fr_1.28fr_0.86fr]">
          <EvidenceColumn />
          <ForgeColumn />
          <VerdictColumn />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <LearningPanel />
          <ArchiveTimeline />
        </div>
      </div>
    </div>
  );
}

function EvidenceColumn() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-eyebrow">来源与证据</div>
          <h2 className="section-title text-[20px]">先判证据，再谈方法</h2>
        </div>
        <span className="rounded-full border border-[#7AD3A1]/25 bg-[#7AD3A1]/10 px-3 py-1 text-[11px] text-[#9CE3B8]">
          accessed 2026-06-07
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {evidenceCards.map((card) => (
          <a
            key={card.title}
            href={card.href}
            target={card.href.startsWith('http') ? '_blank' : undefined}
            rel={card.href.startsWith('http') ? 'noreferrer' : undefined}
            className={`block rounded-[8px] border px-4 py-4 transition hover:translate-y-[-1px] ${evidenceTone(card.color)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">{card.label}</div>
              <ExternalLink size={13} />
            </div>
            <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">{card.title}</div>
            <p className="mt-2 text-[12px] leading-6 text-[#BFC7DA]">{card.body}</p>
            <div className="mt-3 text-[11px] text-[#8F835F]">{card.source}</div>
          </a>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/hanlin/scouting"
          className="rounded-[8px] border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[12px] text-[#D7CCA9] transition hover:bg-white/[0.06]"
        >
          补充来源
        </Link>
        <Link
          href="/jinyiwei"
          className="rounded-[8px] border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[12px] text-[#D7CCA9] transition hover:bg-white/[0.06]"
        >
          重新采证
        </Link>
      </div>
    </GlassPanel>
  );
}

function ForgeColumn() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="section-eyebrow">当前知识案</div>
          <h1 className="section-title text-[24px]">Serenity 瓶颈投资法</h1>
          <p className="mt-2 max-w-[760px] text-[12px] leading-6 text-[#AEB7D1]">
            把“新股神收益传闻”降级为弱信号，把可复用方法升级为供应链瓶颈研究 Skill。当前状态：可学习，可评测，禁止直接入投资蜂群。
          </p>
        </div>
        <Link
          href="#evaluation"
          className="inline-flex items-center gap-2 rounded-[8px] border border-[#F0C66A]/30 bg-[#F0C66A] px-4 py-2 text-[12px] font-semibold text-[#19130B] shadow-[0_0_28px_rgba(240,198,106,0.18)] transition hover:bg-[#F6DFA2]"
        >
          运行评测
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="mt-6 rounded-[8px] border border-[#F0C66A]/16 bg-[radial-gradient(circle_at_center,rgba(240,198,106,0.16),rgba(255,255,255,0.03)_36%,rgba(0,0,0,0.18)_70%)] p-5">
        <div className="grid gap-3 md:grid-cols-5">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="relative rounded-[8px] border border-white/10 bg-black/24 px-3 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#F0C66A]/24 bg-[#F0C66A]/10 text-[#F0C66A]">
                  <Icon size={17} />
                </div>
                <div className="mt-3 text-[14px] font-semibold text-[#F5E9C9]">{stage.key}</div>
                <div className="mt-1 text-[11px] text-[#8F835F]">{stage.owner}</div>
                <div className="mt-3 rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] text-[#BFC7DA]">
                  {stage.status}
                </div>
                {index < stages.length - 1 ? (
                  <div className="pointer-events-none absolute right-[-17px] top-1/2 hidden h-px w-8 bg-[#F0C66A]/30 md:block" />
                ) : null}
              </div>
            );
          })}
        </div>

        <div id="evaluation" className="mt-5 grid gap-3 md:grid-cols-2">
          {skillChecks.map((check) => (
            <div key={check} className="flex items-center gap-2 rounded-[8px] border border-[#7AD3A1]/18 bg-[#7AD3A1]/8 px-3 py-2">
              <CheckCircle2 size={15} className="shrink-0 text-[#7AD3A1]" />
              <span className="text-[12px] text-[#CFEED9]">{check}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MetricTile label="候选 Skill" value="hubu-bottleneck-investing" />
        <MetricTile label="golden cases" value="5" />
        <MetricTile label="复盘日" value="2026-07-07" />
      </div>

      <div className="mt-5 rounded-[8px] border border-[#F0C66A]/16 bg-[#F0C66A]/8 px-4 py-4">
        <div className="flex items-start gap-3">
          <Sparkles size={17} className="mt-0.5 shrink-0 text-[#F0C66A]" />
          <p className="text-[12px] leading-6 text-[#F6DFA2]">
            天才设计：把 NotebookLM 的“读资料”升级成朝堂版“立案、采证、蒸馏、评测、归档”。用户看到的不是一堆摘要，而是一条能进入生产系统的 Skill 审批链。
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[8px] border border-[#7AD3A1]/18 bg-[#7AD3A1]/8 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9CE3B8]">Video to Skill · 视频炼 Skill</div>
            <h2 className="mt-2 text-[16px] font-semibold text-[#EAFBF0]">粘贴视频链接，自动进入 learn-video-to-skill</h2>
            <p className="mt-2 max-w-[760px] text-[12px] leading-6 text-[#BFC7DA]">
              B 站、YouTube、插件演示和大神方法论默认不做普通总结；先区分官方能力、视频宣传和本机事实，再安装、复刻、试用并归档。
            </p>
          </div>
          <span className="rounded-full border border-[#7AD3A1]/25 bg-[#7AD3A1]/10 px-3 py-1 text-[11px] text-[#9CE3B8]">
            learn-video-to-skill
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {videoSkillProtocol.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-[8px] border border-[#7AD3A1]/16 bg-black/18 px-3 py-2">
              <CheckCircle2 size={14} className="shrink-0 text-[#7AD3A1]" />
              <span className="text-[12px] text-[#CFEED9]">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

function VerdictColumn() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="h-full" id="hubu-gate">
      <div className="section-eyebrow">丞相裁决</div>
      <h2 className="section-title text-[20px]">可进入评测，不可直接入蜂群</h2>

      <div className="mt-5 rounded-[8px] border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <Gavel size={18} className="mt-0.5 shrink-0 text-[#F0C66A]" />
          <div>
            <div className="text-[13px] font-semibold text-[#F5E9C9]">下一步：送户部评测</div>
            <p className="mt-2 text-[12px] leading-6 text-[#D7CCA9]">
              只允许输出观察清单、证据缺口、失效条件和复盘日期。任何买卖点、目标价、仓位建议、个性化配置都会被门禁阻断。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <RiskRow icon={TriangleAlert} tone="red" title="收益数字未审计" text="4502% 与 3840% 版本冲突，不能作为事实或战绩背书。" />
        <RiskRow icon={ShieldAlert} tone="yellow" title="发行人证据有偏" text="公告可用于需求线索，不能自动证明收入兑现和估值合理。" />
        <RiskRow icon={CheckCircle2} tone="green" title="方法可被蒸馏" text="供应链瓶颈、主证据、红队、复盘，是可训练的研究能力。" />
      </div>

      <div className="mt-5 grid gap-3">
        <Link
          href="/hubu"
          className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#F0C66A]/30 bg-[#F0C66A] px-4 py-2 text-[12px] font-semibold text-[#19130B] transition hover:bg-[#F6DFA2]"
        >
          送户部评测
          <ArrowRight size={14} />
        </Link>
        <Link
          href="/shiguan?taskId=hubu-bottleneck-investing"
          className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.03] px-4 py-2 text-[12px] text-[#D7CCA9] transition hover:bg-white/[0.06]"
        >
          送史馆归档
          <Archive size={14} />
        </Link>
      </div>

      <div className="mt-5 rounded-[8px] border border-[#0B0B0B] bg-[#050505]/60 px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8F835F]">合规边界</div>
        <p className="mt-2 text-[12px] leading-6 text-[#D7CCA9]">
          本页是研究、学习和系统评测材料，不是个人投资建议；不构成买入、卖出、持有、目标价或仓位建议。
        </p>
      </div>
    </GlassPanel>
  );
}

function LearningPanel() {
  return (
    <GlassPanel tone="elevated" padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-eyebrow">钦天监学习内容</div>
          <h2 className="section-title text-[20px]">深入浅出，再炼成 Skill</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-[#D7CCA9]">
          NotebookLM-like self-hosted path
        </span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {learningRows.map((row) => (
          <div key={row.label} className="rounded-[8px] border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[12px] font-semibold text-[#F0C66A]">{row.label}</div>
            <p className="mt-3 text-[12px] leading-6 text-[#BFC7DA]">{row.text}</p>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function ArchiveTimeline() {
  return (
    <GlassPanel tone="elevated" padding="lg">
      <div className="section-eyebrow">史馆时间线</div>
      <h2 className="section-title text-[20px]">每一步都留下证据</h2>
      <div className="mt-5 space-y-3">
        {timeline.map((item) => (
          <div key={`${item.time}-${item.title}`} className="grid grid-cols-[64px_1fr] gap-3 rounded-[8px] border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-[12px] font-semibold text-[#F0C66A]">{item.time}</div>
            <div>
              <div className="text-[13px] font-semibold text-[#F5E9C9]">{item.title}</div>
              <p className="mt-1 text-[12px] leading-6 text-[#AEB7D1]">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className="mt-2 break-words text-[13px] font-semibold text-[#F5E9C9]">{value}</div>
    </div>
  );
}

function RiskRow({
  icon: Icon,
  tone,
  title,
  text,
}: {
  icon: typeof TriangleAlert;
  tone: 'red' | 'yellow' | 'green';
  title: string;
  text: string;
}) {
  const className =
    tone === 'red'
      ? 'border-[#FF6B6B]/22 bg-[#FF6B6B]/8 text-[#FFB4B4]'
      : tone === 'yellow'
        ? 'border-[#F0C66A]/22 bg-[#F0C66A]/8 text-[#F6DFA2]'
        : 'border-[#7AD3A1]/22 bg-[#7AD3A1]/8 text-[#CFEED9]';

  return (
    <div className={`rounded-[8px] border px-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        <Icon size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="text-[12px] font-semibold">{title}</div>
          <p className="mt-1 text-[12px] leading-6 text-[#BFC7DA]">{text}</p>
        </div>
      </div>
    </div>
  );
}

function evidenceTone(color: string) {
  switch (color) {
    case 'green':
      return 'border-[#7AD3A1]/22 bg-[#7AD3A1]/8 text-[#9CE3B8]';
    case 'yellow':
      return 'border-[#F0C66A]/24 bg-[#F0C66A]/8 text-[#F6DFA2]';
    case 'red':
      return 'border-[#FF6B6B]/24 bg-[#FF6B6B]/8 text-[#FFB4B4]';
    case 'black':
      return 'border-[#0B0B0B] bg-[#050505]/70 text-[#D7CCA9]';
    default:
      return 'border-white/10 bg-white/[0.03] text-[#D7CCA9]';
  }
}
