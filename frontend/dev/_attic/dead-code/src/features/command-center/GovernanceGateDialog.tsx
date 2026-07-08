'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { chaotang } from '@/lib/api/chaotang'

const STAKES_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  medium: {
    label: '中等风险',
    color: '#F0C66A',
    desc: '丞相已完成分析，请确认出动蜂群执行',
  },
  high: {
    label: '高风险决策',
    color: '#F43F5E',
    desc: '此任务涉及重大决策，请皇上御批后方可出动',
  },
}

interface Props {
  taskId: string
  stakes: string
  message: string
  onProceeded: () => void
  onCancelled: () => void
}

export function GovernanceGateDialog({ taskId, stakes, message, onProceeded, onCancelled }: Props) {
  const [loading, setLoading] = useState(false)
  const cfg = STAKES_CONFIG[stakes] ?? STAKES_CONFIG.medium

  const handleProceed = async () => {
    setLoading(true)
    try {
      await chaotang.decreeProceed(taskId)
      onProceeded()
    } catch (e) {
      console.error('proceed failed', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          background: 'rgba(4,6,14,0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          style={{
            border: `1px solid ${cfg.color}44`,
            borderTop: `3px solid ${cfg.color}`,
            background: 'rgba(8,12,24,0.97)',
            borderRadius: 12,
            padding: '32px 40px',
            maxWidth: 420,
            width: '90vw',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: cfg.color,
              letterSpacing: '0.2em',
              marginBottom: 12,
              fontFamily: 'var(--font-serif)',
            }}
          >
            治理审批 · {cfg.label}
          </div>
          <div
            style={{
              fontSize: 18,
              color: '#F6EFD8',
              fontFamily: 'var(--font-serif)',
              marginBottom: 8,
              lineHeight: 1.5,
            }}
          >
            {message}
          </div>
          <div style={{ fontSize: 13, color: '#9AA3C4', marginBottom: 28, lineHeight: 1.7 }}>
            {cfg.desc}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onCancelled}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#6A7299',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              取消任务
            </button>
            <button
              type="button"
              onClick={handleProceed}
              disabled={loading}
              style={{
                flex: 2,
                padding: '10px 0',
                borderRadius: 6,
                border: `1px solid ${cfg.color}88`,
                background: `${cfg.color}18`,
                color: cfg.color,
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-serif)',
                letterSpacing: '0.1em',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '批准中…' : '批准出动'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
