'use client';
import { motion, AnimatePresence } from 'motion/react';
import type { GroupCard } from './BattleStream';

const STATUS_CONFIG = {
  dispatching: { color: '#6BA0FF', label: '派遣中', pulse: true },
  running: { color: '#F0C66A', label: '执行中', pulse: true },
  aggregated: { color: '#3DD68C', label: '完成', pulse: false },
};

const GROUP_LABELS: Record<string, string> = {
  intel: '情报蜂群',
  content: '文创蜂群',
  finlaw: '财法蜂群',
  rnd: '产研蜂群',
  exec: '执行蜂群',
  review: '复盘蜂群',
};

interface Props {
  card: GroupCard;
}

export function SwarmBattleCard({ card }: Props) {
  const cfg = STATUS_CONFIG[card.status] ?? STATUS_CONFIG.dispatching;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        border: `1px solid ${cfg.color}33`,
        borderTop: `2px solid ${cfg.color}`,
        background: 'rgba(4,6,14,0.72)',
        borderRadius: 8,
        padding: '12px 14px',
        minHeight: 100,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {cfg.pulse ? (
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.0 }}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: cfg.color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        ) : (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: cfg.color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{ color: '#F6EFD8', fontSize: 13, fontFamily: 'var(--font-serif)', fontWeight: 600 }}
        >
          {GROUP_LABELS[card.groupId] ?? card.groupId}
        </span>
        <span
          style={{ marginLeft: 'auto', fontSize: 10, color: cfg.color, letterSpacing: '0.1em' }}
        >
          {cfg.label}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#9AA3C4',
          lineHeight: 1.7,
          minHeight: 48,
          maxHeight: 100,
          overflowY: 'auto',
        }}
      >
        <AnimatePresence mode="wait">
          {card.liveText ? (
            <motion.span key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {card.liveText.slice(-200)}
              {card.status === 'running' && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 12,
                    background: '#F0C66A',
                    marginLeft: 2,
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </motion.span>
          ) : (
            <motion.span key="waiting" style={{ color: '#4A5068' }}>
              等待指令…
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {card.status === 'aggregated' && card.summary && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${cfg.color}22`,
            fontSize: 11,
            color: '#3DD68C',
          }}
        >
          ✓ {card.summary.slice(0, 80)}
        </motion.div>
      )}
    </motion.div>
  );
}
