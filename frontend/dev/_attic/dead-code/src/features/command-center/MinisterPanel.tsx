'use client';
import { motion, AnimatePresence } from 'motion/react';
import type { MinisterRow } from './BattleStream';

const MINISTER_META: Record<string, { icon: string; title: string }> = {
  hu_bu: { icon: '💰', title: '户部' },
  li_bu: { icon: '📋', title: '吏部' },
  xing_bu: { icon: '⚖️', title: '刑部' },
  gong_bu: { icon: '⚙️', title: '工部' },
  li_bu_rites: { icon: '📣', title: '礼部' },
  bing_bu: { icon: '🗡️', title: '兵部' },
  jin_yi_wei: { icon: '🔍', title: '锦衣卫' },
  qin_tian_jian: { icon: '🌌', title: '钦天监' },
  scribe: { icon: '📜', title: '史官' },
};

interface Props {
  ministers: MinisterRow[];
}

export function MinisterPanel({ ministers }: Props) {
  if (ministers.length === 0) {
    return (
      <div style={{ color: '#4A5068', fontSize: 12, padding: '16px 0', textAlign: 'center' }}>
        等待大臣会审…
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence>
        {ministers.map((m) => {
          const meta = MINISTER_META[m.agentCode] ?? { icon: '👤', title: m.name };
          const isDone = m.status === 'completed';
          return (
            <motion.div
              key={m.agentCode}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                border: `1px solid ${isDone ? '#3DD68C33' : '#6BA0FF33'}`,
                borderLeft: `2px solid ${isDone ? '#3DD68C' : '#6BA0FF'}`,
                background: isDone ? 'rgba(61,214,140,0.05)' : 'rgba(107,160,255,0.05)',
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <span
                  style={{ color: '#F6EFD8', fontSize: 12, fontFamily: 'var(--font-serif)' }}
                >
                  {meta.title}
                </span>
                {isDone ? (
                  <span style={{ marginLeft: 'auto', color: '#3DD68C', fontSize: 10 }}>已定 ✓</span>
                ) : (
                  <motion.span
                    style={{ marginLeft: 'auto', fontSize: 10, color: '#6BA0FF' }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  >
                    议事中…
                  </motion.span>
                )}
              </div>
              {m.opinion && (
                <div
                  style={{
                    fontSize: 10,
                    color: '#9AA3C4',
                    lineHeight: 1.6,
                    maxHeight: 60,
                    overflowY: 'auto',
                  }}
                >
                  {m.opinion.slice(0, 120)}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
