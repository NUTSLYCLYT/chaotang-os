'use client'

import { useState, useEffect, useRef } from 'react'

interface TypewriterPlaceholderProps {
  phrases: string[]
  typingSpeed?: number
  pauseDuration?: number
  erasingSpeed?: number
}

export function TypewriterPlaceholder({
  phrases,
  typingSpeed = 45,
  pauseDuration = 2400,
  erasingSpeed = 20,
}: TypewriterPlaceholderProps) {
  const [displayed, setDisplayed] = useState('')
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'erasing'>('typing')
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const current = phrases[phraseIndex] ?? ''

    if (phase === 'typing') {
      if (displayed.length < current.length) {
        frameRef.current = setTimeout(() => {
          setDisplayed(current.slice(0, displayed.length + 1))
        }, typingSpeed)
      } else {
        frameRef.current = setTimeout(() => setPhase('pausing'), pauseDuration)
      }
    } else if (phase === 'pausing') {
      frameRef.current = setTimeout(() => setPhase('erasing'), 0)
    } else {
      if (displayed.length > 0) {
        frameRef.current = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1))
        }, erasingSpeed)
      } else {
        setPhraseIndex((i) => (i + 1) % phrases.length)
        setPhase('typing')
      }
    }

    return () => {
      if (frameRef.current != null) clearTimeout(frameRef.current)
    }
  }, [displayed, phase, phraseIndex, phrases, typingSpeed, pauseDuration, erasingSpeed])

  return (
    <span aria-hidden>
      {displayed}
      <span
        className="inline-block w-px h-[0.9em] align-middle ml-0.5 animate-pulse"
        style={{ background: 'var(--color-gold)', opacity: 0.7 }}
      />
    </span>
  )
}
