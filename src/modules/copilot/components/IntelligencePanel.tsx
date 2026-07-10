import { motion, AnimatePresence } from 'framer-motion'
import type { StrategicQuestion } from '@/intelligence/types'
import { EmptyState, ConfidenceIndicator } from '@/shared/components'
import { Brain } from 'lucide-react'

interface IntelligencePanelProps {
  activeQuestion: StrategicQuestion | null
}

export function IntelligencePanel({ activeQuestion }: IntelligencePanelProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {activeQuestion ? (
          <motion.div
            key={activeQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            <div className="border-b border-border-subtle px-6 py-4">
              <h2 className="text-lg font-semibold text-text-primary">{activeQuestion.question}</h2>
              <p className="mt-1 text-sm text-text-secondary">{activeQuestion.description}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <EmptyState
                icon={<Brain className="h-8 w-8" />}
                title="Esperando evidencia"
                description="Las fuentes de datos aún no están conectadas. Cuando lo estén, el Copilot generará conclusiones respaldadas por evidencia para esta pregunta estratégica."
              />
            </div>

            <div className="border-t border-border-subtle px-6 py-3">
              <ConfidenceIndicator level="insufficient" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 items-center justify-center"
          >
            <EmptyState
              icon={<Brain className="h-10 w-10" />}
              title="Centro de Inteligencia Territorial"
              description="Selecciona una pregunta estratégica para comenzar. El Copilot sintetizará evidencia de múltiples fuentes para responder."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
