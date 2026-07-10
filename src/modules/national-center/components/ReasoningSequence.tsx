import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'

const DEMO_STEPS = [
  'TerraMind está razonando…',
  '12 fuentes verificadas',
  '41 eventos correlacionados',
  '8 hallazgos confirmados',
  'Informe generado',
]

interface ReasoningSequenceProps {
  live?: boolean
  steps?: string[]
}

export function ReasoningSequence({ live = false, steps }: ReasoningSequenceProps) {
  const [phase, setPhase] = useState(0)
  const [done, setDone] = useState(false)

  const STEPS = steps ?? (live ? DEMO_STEPS : DEMO_STEPS)

  useEffect(() => {
    setPhase(0)
    setDone(false)
  }, [steps?.join('|')])

  useEffect(() => {
    if (phase === 0) {
      const t = setTimeout(() => setPhase(1), 1200)
      return () => clearTimeout(t)
    }
    if (phase < STEPS.length) {
      const t = setTimeout(() => {
        if (phase === STEPS.length - 1) setDone(true)
        else setPhase((p) => p + 1)
      }, 600)
      return () => clearTimeout(t)
    }
  }, [phase, STEPS.length])

  if (done) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-6 rounded-lg border border-border-subtle bg-surface-2/60 px-4 py-3"
    >
      <AnimatePresence mode="wait">
        {phase === 0 ? (
          <motion.p
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-text-secondary"
          >
            <span className="inline-block animate-pulse">{STEPS[0]}</span>
          </motion.p>
        ) : (
          <motion.ul
            key="steps"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1.5"
          >
            {STEPS.slice(1, phase + 1).map((step) => (
              <motion.li
                key={step}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-xs text-text-secondary"
              >
                <Check className="h-3 w-3 text-confidence-high" />
                {step}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
