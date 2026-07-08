'use client';

/**
 * 现场决策回测（破冰演示入口 · 2026-06-29）
 *
 * 客户当场粘贴他最近的决定（每行一条，可「命令 | 采纳/驳回」），即时回放过当前引擎，
 * 列出"采纳了但 AI 会提示风险"的漏洞。**100% 客户端纯函数跑(backtestDecisions)，零后端、不入库**——
 * 破冰演示不依赖系统已有数据，贴完即出。
 *
 * 用法：见客户第一件事——"给我你最近10个决定"，粘进来，当场指出他漏的风险（他的真决定+真漏洞=最强成交）。
 */
import { useState } from 'react';

import { backtestDecisions, type PastDecision, type BacktestReport } from '@/features/learning/lib/decision-backtest';

const GOLD = '#F0C66A';
const ALERT = '#E5604D';

/** 按行业预置示例——客户一看"这就是我天天纠结的事",代入感强,降低粘贴门槛。 */
const PRESETS: { label: string; text: string }[] = [
  {
    label: '制造业',
    text: `要不要接这个120万独家供货合同？客户要预付款+违约金条款
要不要投80万买这两台新设备
客户压价20%要不要接，账期90天
和竞品压价谈判，客户说竞品更便宜`,
  },
  {
    label: '贸易',
    text: `要不要给这个客户发八折正式报价
签独家代理协议，要不要给他区域独家
客户要先发货后付款，要不要答应
这个新客户的预付30%，值不值得做`,
  },
  {
    label: '服务',
    text: `要不要给大客户承诺这个SLA和违约赔偿
老客户续约要打七折，签不签
要不要把这块外包出去，签长期合同
客户要免费试用三个月，要不要给`,
  },
];

/** 解析粘贴文本：每行一条；支持「命令 | 动作」，默认动作=采纳(adopt)。 */
function parse(text: string): PastDecision[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 5)
    .map((line, i) => {
      const [cmd, act] = line.split('|').map((s) => s.trim());
      const action = /驳回|拒|没做|reject/.test(act ?? '') ? 'reject' : 'adopt';
      return { id: `live_${i}`, command: cmd, action };
    });
}

export function LiveBacktest() {
  const [text, setText] = useState('');
  const [report, setReport] = useState<BacktestReport | null>(null);

  function run() {
    setReport(backtestDecisions(parse(text)));
  }

  return (
    <div className="mx-auto max-w-[820px] px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>Decision Backtest · 现场回测</div>
        {/* 显眼隐私徽：让老板敢贴真决策(B2B 最怕真决策被留存) */}
        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ borderColor: '#5FB97A66', color: '#5FB97A', background: '#5FB97A12' }}>
          🔒 本地回测 · 不上传 · 不入库
        </span>
      </div>
      <h1 className="display-serif mt-2 text-[28px] font-semibold text-[#F5E9C9]">回放你最近的决定，看 AI 会多抓出几个风险</h1>
      <p className="body-copy mt-2 text-[13px] text-[#b6ab8c]">
        每行贴一个你最近做的决定（默认按"你采纳了"算；要标驳回写「决定 | 驳回」）。当场回放，决策内容只在本机算，<span style={{ color: '#5FB97A' }}>不离开浏览器</span>。
      </p>

      {/* 行业预置：一键代入"我天天纠结的事" */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#8f835f]">没头绪？按行业填示例：</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => { setText(p.text); setReport(null); }}
            className="rounded-full border px-3 py-1 text-[12px] text-[#d8cba8] transition hover:text-[#F5E9C9]"
            style={{ borderColor: `${GOLD}30`, background: `${GOLD}0c` }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={'每行一个决定，例如：\n要不要接这个120万独家供货合同？客户要预付款+违约金\n要不要投80万买新设备\n…或点上方行业按钮一键填充'}
        className="mt-3 w-full rounded-xl border bg-black/30 px-4 py-3 text-[13px] leading-7 text-[#F5E9C9] outline-none placeholder:text-[#5b5848]"
        style={{ borderColor: `${GOLD}33` }}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={run}
          disabled={parse(text).length === 0}
          className="rounded-lg border px-5 py-2 text-[13px] font-semibold transition hover:brightness-125 disabled:opacity-50"
          style={{ borderColor: `${GOLD}66`, color: GOLD, background: `${GOLD}14` }}
        >
          回放回测
        </button>
      </div>

      {report && (
        <div className="mt-6 rounded-2xl border-2 px-5 py-4" style={{ borderColor: report.missedCount > 0 ? ALERT : GOLD, background: report.missedCount > 0 ? '#E5604D0d' : '#F0C66A0a' }}>
          <div className="text-[15px] font-bold" style={{ color: report.missedCount > 0 ? '#E5847A' : GOLD }}>
            回放 {report.replayed} 个决定 ·
            {report.missedCount > 0 ? ` AI 会多提示 ${report.missedCount} 个你当时漏的风险` : ' AI 与你的判断一致，无遗漏'}
          </div>
          {report.missed.map((f) => (
            <div key={f.id} className="mt-3 border-t pt-3 text-[12.5px]" style={{ borderColor: '#ffffff14' }}>
              <div className="text-[#E9DDBE]">「{f.command}」<span className="text-[#8f835f]"> · 你当时采纳</span></div>
              <div className="mt-1" style={{ color: '#E5847A' }}>⚠ {f.missedRisks.join('；')}</div>
            </div>
          ))}
          {report.replayed > 0 && report.missedCount === 0 && (
            <p className="mt-2 text-[12px] text-[#b6ab8c]">这几个决定引擎也认为稳妥——但贴几个含合同/独家/报价的，看它怎么拦。</p>
          )}
        </div>
      )}
    </div>
  );
}
