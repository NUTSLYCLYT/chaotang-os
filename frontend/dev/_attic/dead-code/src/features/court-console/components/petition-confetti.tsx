'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotate: number
  shape: 'circle' | 'rect'
}

const COLORS = [
  'var(--color-gold)',
  'var(--color-gold-bright)',
  '#F0C66A',
  '#E8A020',
  'rgba(240,198,106,0.7)',
]

function makeParticles(count = 40): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20,
    y: 30 + Math.random() * 10,
    vx: (Math.random() - 0.5) * 140,
    vy: -(Math.random() * 120 + 80),
    color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
    size: Math.random() * 8 + 4,
    rotate: Math.random() * 360,
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
  }))
}

interface PetitionConfettiProps {
  active: boolean
}

export function PetitionConfetti({ active }: PetitionConfettiProps) {
  const particles = useRef<Particle[]>(makeParticles())
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (active) particles.current = makeParticles()
  }, [active])

  if (shouldReduceMotion) return null

  return (
    <AnimatePresence>
      {active && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {particles.current.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                x: `${p.x}%`,
                y: `${p.y}%`,
                opacity: 1,
                scale: 1,
                rotate: p.rotate,
              }}
              animate={{
                x: `calc(${p.x}% + ${p.vx}px)`,
                y: `calc(${p.y}% + ${p.vy + 200}px)`,
                opacity: 0,
                scale: 0.3,
                rotate: p.rotate + 360,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.shape === 'rect' ? p.size * 0.5 : p.size,
                borderRadius: p.shape === 'circle' ? '50%' : 2,
                background: p.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
