'use client';

/**
 * 启发式命令 · Starter Prompts
 *
 * 对不知从何开始的用户 — 提供一组现成的命令示例。
 * 点击即填入，直接发令。
 */

import { Sparkles } from 'lucide-react';

export const STARTER_PROMPTS: Array<{
  category: string;
  prompts: string[];
}> = [
  {
    category: '战略研判',
    prompts: [
      '帮我评估本季度最重要的三件事，按优先级排序。',
      '扫描过去 30 天的关键变化，整理成一份高管简报。',
      '为下周的董事会准备一份 15 分钟的情报综述。',
    ],
  },
  {
    category: '竞品情报',
    prompts: [
      '扫描竞品本月的重要动作，标出可能影响我方的三条。',
      '比较主要对手的定价策略，给出应对建议。',
    ],
  },
  {
    category: '风险预演',
    prompts: [
      '未来 90 天最可能发生的三个黑天鹅事件是什么？如何预防？',
      '推演若 XX 事件发生，我方应启动哪些预案。',
    ],
  },
  {
    category: '决策支持',
    prompts: [
      '我在 A 和 B 之间犹豫，请列出每个选项的关键风险与机会。',
      '生成一份备忘录，陈述是否应投资 XX 项目。',
    ],
  },
];

export interface StarterPromptsProps {
  onSelect: (prompt: string) => void;
}

export function StarterPrompts({ onSelect }: StarterPromptsProps) {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#6A7299]">
        <Sparkles size={11} className="text-[#F0C66A]" />
        若一时难以下笔，可从这些开始
      </div>
      <div className="space-y-5">
        {STARTER_PROMPTS.map((group) => (
          <div key={group.category}>
            <div className="display-serif mb-2 text-[11px] font-medium tracking-wider text-[#F0C66A]">
              {group.category}
            </div>
            <div className="flex flex-wrap gap-2">
              {group.prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="display-serif rounded-lg border px-3 py-2 text-left text-[11px] leading-snug text-[#C8CDD8] transition-all hover:-translate-y-0.5 hover:text-white"
                  style={{
                    borderColor: 'rgba(240, 198, 106, 0.18)',
                    background:
                      'linear-gradient(180deg, rgba(20,16,8,0.5), rgba(10,8,4,0.7))',
                    maxWidth: 320,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
