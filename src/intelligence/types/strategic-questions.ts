import type { StrategicQuestion, StrategicQuestionId } from '@/intelligence/types'

export const STRATEGIC_QUESTIONS: StrategicQuestion[] = [
  {
    id: 'what-is-happening',
    question: '¿Qué está pasando?',
    description: 'Síntesis del estado actual del territorio basada en evidencia observable.',
    order: 1,
  },
  {
    id: 'why-is-it-happening',
    question: '¿Por qué está pasando?',
    description: 'Hipótesis causales respaldadas por múltiples fuentes de datos.',
    order: 2,
  },
  {
    id: 'what-could-happen',
    question: '¿Qué podría pasar si continúa esta tendencia?',
    description: 'Proyecciones y escenarios basados en tendencias actuales.',
    order: 3,
  },
  {
    id: 'what-deserves-attention',
    question: '¿Qué merece atención primero?',
    description: 'Priorización ejecutiva de amenazas y oportunidades.',
    order: 4,
  },
  {
    id: 'what-strategies',
    question: '¿Qué estrategias recomendamos?',
    description: 'Recomendaciones accionables con justificación y nivel de confianza.',
    order: 5,
  },
]

export function getStrategicQuestion(id: StrategicQuestionId): StrategicQuestion | undefined {
  return STRATEGIC_QUESTIONS.find((q) => q.id === id)
}
