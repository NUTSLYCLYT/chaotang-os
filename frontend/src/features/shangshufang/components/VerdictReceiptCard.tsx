import { CheckCircle2, FileSearch } from 'lucide-react';
import type { Memorial } from '../types';
import type { VerdictReceipt } from '../ShangshufangPage';

const SOURCE_MODE_LABEL: Record<NonNullable<Memorial['sourceMode']>, string> = {
  LIVE: '真实任务',
  MIXED: '证据待补',
  FALLBACK: '降级建议',
  DEMO: '演示数据',
};

export function VerdictReceiptCard({
  receipt,
  result,
}: {
  receipt: VerdictReceipt | null;
  result: string;
}) {
  if (!receipt) {
    return (
      <p className="text-[13px] leading-[1.9]" style={{ fontFamily: 'var(--font-serif)' }}>
        {result}
      </p>
    );
  }

  const trace = receipt.loopTraceId ?? '待后端返回';
  const source = receipt.sourceMode ? SOURCE_MODE_LABEL[receipt.sourceMode] : '真实接口回执';
  const actionItems = [
    { label: '负责人', body: receipt.nextOwner },
    { label: '下一次回看', body: receipt.nextCheckpoint },
    { label: '最大风险/缺口', body: receipt.sourceMode === 'FALLBACK' || receipt.sourceMode === 'DEMO' ? '当前来源不是 LIVE，不能当最终依据。' : '重点看证据缺口、合同报价、付款和对外承诺风险。' },
  ];

  return (
    <div data-testid="verdict-receipt" className="space-y-3">
      <div
        className="rounded-xl border px-3 py-3"
        style={{
          borderColor: 'rgba(62,214,140,0.22)',
          background: 'linear-gradient(180deg, rgba(62,214,140,0.10), rgba(255,255,255,0.025))',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-[#3ED68C]/35 bg-[#3ED68C]/10 text-[#3ED68C]">
            <CheckCircle2 size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.24em] text-[#8F835F]">落子回执</div>
            <div className="mt-0.5 truncate text-[15px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
              已落子，组织开始运转
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-[1.8] text-[#C6BB9D]" style={{ fontFamily: 'var(--font-serif)' }}>
          {result}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={receipt.detailHref}
            data-testid="verdict-detail-link"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#FFE09A] to-[#F0C66A] px-3.5 py-1.5 text-[11.5px] font-bold tracking-[0.04em] text-[#1B1306] shadow-[0_4px_18px_rgba(240,198,106,0.28)] transition-all hover:brightness-110"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            <FileSearch size={13} />
            {receipt.detailLabel}
          </a>
          <span className="text-[10.5px] leading-[1.6] text-[#8F835F]">
            {receipt.detailHint}
          </span>
        </div>
      </div>

      <div
        data-testid="boss-action-card"
        className="rounded-xl border px-3 py-3"
        style={{
          borderColor: 'rgba(240,198,106,0.18)',
          background: 'linear-gradient(180deg, rgba(240,198,106,0.075), rgba(255,255,255,0.018))',
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] tracking-[0.22em] text-[#D9C79A]">老板行动卡</div>
            <div className="mt-0.5 text-[12px] text-[#8F835F]">这一步已经有责任人、有回看点、有风险边界。</div>
          </div>
          <span className="shrink-0 rounded-full border border-[#F0C66A]/20 px-2 py-0.5 text-[10px] text-[#B6AB8C]">
            已推进
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {actionItems.map((item) => (
            <div key={item.label} className="min-h-[74px] rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-2">
              <div className="mb-1 text-[10px] font-semibold tracking-[0.10em] text-[#F5E9C9]">
                {item.label}
              </div>
              <div className="text-[10.5px] leading-[1.55] text-[#B6AB8C]">
                {item.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      <details
        data-testid="verdict-technical-receipt"
        className="group rounded-lg border px-3 py-2.5"
        style={{
          borderColor: 'rgba(240,198,106,0.14)',
          background: 'rgba(0,0,0,0.18)',
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
          <span className="text-[10px] tracking-[0.18em] text-[#D9C79A]">技术回执</span>
          <span className="text-[10px] text-[#8F835F] group-open:hidden">展开</span>
          <span className="hidden text-[10px] text-[#F0C66A] group-open:inline">收起</span>
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px] text-[#8F835F]">
          <span>状态：{receipt.status}</span>
          <span>任务号：{receipt.taskId}</span>
          {receipt.decisionId ? <span>决策号：{receipt.decisionId}</span> : null}
          <span>Trace：{trace}</span>
          <span>来源：{source}</span>
          <span>史馆：{receipt.archiveHint}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {receipt.inspectionChain.map((item, index) => (
            <span key={`${item.href}-${item.label}`} className="inline-flex items-center gap-1.5">
              {index > 0 ? <span className="text-[#5A5340]">→</span> : null}
              <button
                type="button"
                onClick={() => {
                  window.location.href = item.href;
                }}
                className="rounded-full border border-white/[0.10] bg-white/[0.025] px-2.5 py-1 text-[10.5px] text-[#B6AB8C] transition hover:border-[#F0C66A]/35 hover:text-[#F0C66A]"
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}

function verdictSealMeta(option: string, index: number) {
  if (/批示/.test(option)) {
    return {
      seal: '批',
      title: '批示',
      tone: '#B91C1C',
      hint: '打开朱批，确认后落裁',
      consequence: '进入朱批确认；确认后写入任务裁决并送史馆归档。高风险内容仍需人工确认。',
      owner: '承办：丞相督办 · 史馆归档',
    };
  }
  if (/准|采纳|批准|批示|转为圣旨|归档/.test(option)) {
    return {
      seal: '准',
      title: '准奏',
      tone: '#B91C1C',
      hint: '立刻进入执行/圣旨流程',
      consequence: '生成圣旨，写入任务裁决并送史馆归档；若含合同、报价、付款等高风险内容，先弹人工确认。',
      owner: '承办：丞相督办 · 史馆归档',
    };
  }
  if (/补证|询问|补充/.test(option)) {
    return {
      seal: '问',
      title: '补证',
      tone: '#B46F12',
      hint: '退回丞相补关键证据',
      consequence: '保持任务未闭环，向原奏折追加缺证要求；丞相汇总后重新上呈。',
      owner: '承办：丞相台 · 相关部门补材料',
    };
  }
  if (/复核|再审/.test(option)) {
    return {
      seal: '复',
      title: '复核',
      tone: '#24537B',
      hint: '交军机处或相关部门复议',
      consequence: '打开复核回路，要求军机处或争议部门重做判断，保留原奏折证据链。',
      owner: '承办：军机处 · 争议部门会审',
    };
  }
  if (/会审/.test(option)) {
    return {
      seal: '审',
      title: '会审',
      tone: '#24537B',
      hint: '交军机处或相关部门会审',
      consequence: '打开会审回路，要求军机处或争议部门重做判断，保留原奏折证据链。',
      owner: '承办：军机处 · 争议部门会审',
    };
  }
  if (/驳回|不准/.test(option)) {
    return {
      seal: '驳',
      title: '驳回',
      tone: '#7A241E',
      hint: '记录原因并终止此版',
      consequence: '要求填写驳回理由；奏折保持原位，不送史馆归档，后续可继续改判或重议。',
      owner: '承办：丞相留档 · 待重新批示',
    };
  }
  if (/暂缓|留中/.test(option)) {
    return {
      seal: '留',
      title: '留中',
      tone: '#6B5A3A',
      hint: '暂不执行，保留待议',
      consequence: '暂不写入最终裁决，保留当前奏折；稍后可继续御览或交丞相后台跟进。',
      owner: '承办：丞相留档 · 钦天监提醒',
    };
  }
  const fallbackSeals = ['裁', '审', '议', '令'];
  return {
    seal: fallbackSeals[index % fallbackSeals.length]!,
    title: '裁决',
    tone: '#8A6A2A',
    hint: '按此项落裁',
    consequence: '按当前选项写入裁决记录，后续由丞相台分派下一步。',
    owner: '承办：丞相台',
  };
}

export function ImperialVerdictSealButton({
  option,
  index,
  onClick,
}: {
  option: string;
  index: number;
  onClick: () => void;
}) {
  const meta = verdictSealMeta(option, index);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-[188px] overflow-hidden rounded-xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:brightness-110"
      style={{
        borderColor: `${meta.tone}55`,
        background:
          'linear-gradient(180deg, rgba(246,233,201,0.14), rgba(240,198,106,0.045)), rgba(8,10,18,0.62)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.24)',
        fontFamily: 'var(--font-serif)',
      }}
    >
      <span
        aria-hidden
        className="absolute -right-3 -top-3 grid h-20 w-20 rotate-[-12deg] place-items-center rounded-full border text-[34px] font-black opacity-80 transition-transform group-hover:scale-105"
        style={{
          borderColor: `${meta.tone}88`,
          color: meta.tone,
          background: `${meta.tone}12`,
          textShadow: '0 1px 0 rgba(255,240,220,0.18)',
        }}
      >
        {meta.seal}
      </span>
      <span className="relative z-10 block text-[11px] tracking-[0.22em]" style={{ color: meta.tone }}>
        朱批
      </span>
      <span className="relative z-10 mt-2 block text-[18px] font-black text-[#F5E9C9]">
        {meta.title}
      </span>
      <span className="relative z-10 mt-2 block line-clamp-2 text-[12px] leading-[1.65] text-[#C6BB9D]">
        {option}
      </span>
      <span className="relative z-10 mt-2 block text-[10px] text-[#8F835F]">
        {meta.hint}
      </span>
      <span className="relative z-10 mt-3 block border-t pt-2 text-[10.5px] leading-[1.65] text-[#B6AB8C]" style={{ borderColor: `${meta.tone}33` }}>
        <span className="mb-1 block font-semibold tracking-[0.16em]" style={{ color: meta.tone }}>
          后果预览
        </span>
        {meta.consequence}
      </span>
      <span className="relative z-10 mt-1 block text-[10px] text-[#8F835F]">
        {meta.owner}
      </span>
    </button>
  );
}
