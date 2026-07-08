'use client';
import { motion } from 'motion/react';
import type { SanshengStates, SanshengStateEntry } from './BattleStream';

const PROVINCES = [
  { sheng: 'zhongshu' as const, label: '中书省', sub: '起草·会审' },
  { sheng: 'menxia' as const, label: '门下省', sub: '审议·把关' },
  { sheng: 'shangshu' as const, label: '尚书省', sub: '执行·落地' },
];

const STATUS_COLOR: Record<string, string> = {
  active: '#6BA0FF',
  progress: '#F0C66A',
  done: '#3DD68C',
};

const STATUS_LABEL: Record<string, string> = {
  active: '进行中',
  progress: '处理中',
  done: '完成',
};

interface Props {
  sanshengStates: SanshengStates;
}

export function ThreeProvincesPanel({ sanshengStates }: Props) {
  return (
    <div className="flex flex-col gap-3 py-2">
      {PROVINCES.map(({ sheng, label, sub }) => {
        const entry: SanshengStateEntry | undefined = sanshengStates[sheng];
        const color = entry ? (STATUS_COLOR[entry.status] ?? '#4A5068') : '#2A2E42';
        const isActive = !!entry;
        return (
          <motion.div
            key={sheng}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: isActive ? 1 : 0.4 }}
            transition={{ duration: 0.4 }}
            style={{
              border: `1px solid ${color}44`,
              borderLeft: `3px solid ${color}`,
              background: isActive ? `${color}0D` : 'transparent',
              borderRadius: 6,
              padding: '10px 12px',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {isActive && (
                <motion.span
                  animate={{ opacity: entry?.status === 'done' ? 1 : [1, 0.3, 1] }}
                  transition={{ repeat: entry?.status === 'done' ? 0 : Infinity, duration: 1.2 }}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: color,
                    display: 'inline-block',
                  }}
                />
              )}
              <span
                style={{
                  color: isActive ? color : '#4A5068',
                  fontSize: 13,
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
              {entry && (
                <span style={{ fontSize: 10, color: color, marginLeft: 'auto' }}>
                  {STATUS_LABEL[entry.status] ?? entry.status}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#6A7299' }}>{sub}</div>
            {entry?.summary && (
              <div style={{ fontSize: 11, color: '#9AA3C4', marginTop: 4, lineHeight: 1.5 }}>
                {entry.summary.slice(0, 60)}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
