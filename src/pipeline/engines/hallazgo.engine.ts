import type { Evento } from '@/ontology/entities/evento'
import type { Evidencia } from '@/ontology/entities/evidencia'
import type { Expediente } from '@/ontology/entities/expediente'
import type { Hallazgo } from '@/ontology/entities/hallazgo'
import type { Hipotesis } from '@/ontology/entities/hipotesis'
import type { Observacion } from '@/ontology/entities/observacion'
import { generateHallazgoCodigo } from '@/ontology/lifecycles'
import { confidenceCalculator } from '@/engine/confidence/calculator'
import type { ConfidenceInput } from '@/engine/confidence/types'
import { HYPOTHESIS_LIBRARY } from '@/engine/libraries/hypothesis.library'

const MOCK_TEMP_THRESHOLD = 28 // °C — mock para Sprint 1
const MIN_CLUSTER_SIZE = 3
const MOTOR_VERSION = '1.0.0-sprint1'

export interface HallazgoEngineInput {
  eventos: Evento[]
  observations: Observacion[]
  existingHallazgos: Hallazgo[]
  sequence: number
}

export interface HallazgoEngineOutput {
  hallazgo?: Hallazgo
  expediente?: Expediente
  hipotesis?: Hipotesis
  evidencias: Evidencia[]
  sequence: number
}

function buildConfidenceInput(
  obs: Observacion[],
  hipotesisEstado: ConfidenceInput['hipotesisEstado'],
): ConfidenceInput {
  const calidadPromedio =
    obs.length > 0
      ? Math.round(obs.reduce((s, o) => s + o.calidad, 0) / obs.length)
      : 0

  return {
    fuentesIndependientes: 1,
    ventanaTemporalDias: 1,
    coherenciaEspacial: 'mismo',
    evidenciaAFavor: obs.length,
    evidenciaEnContra: 0,
    calidadPromedio,
    hipotesisEstado,
    hipotesisConfianza: 70,
  }
}

/**
 * Hallazgo Engine — aplica R-COR-FIRE y crea el expediente completo.
 */
export function processFireHallazgos(input: HallazgoEngineInput): HallazgoEngineOutput {
  const fireEvents = input.eventos.filter(
    (e) => e.tipo === 'fire_cluster' && (e.metadata?.clusterSize as number) >= MIN_CLUSTER_SIZE,
  )

  const unprocessed = fireEvents.filter(
    (e) => !input.existingHallazgos.some((h) => h.eventoIds.includes(e.id)),
  )

  if (unprocessed.length === 0) {
    return { evidencias: [], sequence: input.sequence }
  }

  const event = unprocessed[0]
  const regionName = (event.metadata?.regionName as string) ?? 'Guatemala'
  const clusterSize = event.metadata?.clusterSize as number
  const maxFrp = event.valorObservado

  // Mock: temperatura umbral (Sprint 2 = Open-Meteo real)
  const mockTemp = 32
  if (maxFrp <= 0 || mockTemp < MOCK_TEMP_THRESHOLD) {
    return { evidencias: [], sequence: input.sequence }
  }

  const relatedObs = input.observations.filter((o) =>
    event.observacionIds.includes(o.id),
  )

  const now = new Date().toISOString()
  const year = new Date().getFullYear()
  const sequence = input.sequence + 1
  const codigo = generateHallazgoCodigo(year, sequence)
  const hallazgoId = `hal:${codigo}`
  const expedienteId = `exp:${codigo}`

  const hipTemplate = HYPOTHESIS_LIBRARY.find((h) => h.id === 'HIP-003')!
  const confResult = confidenceCalculator.calculate(
    buildConfidenceInput(relatedObs, 'activa'),
  )

  const titulo = `Focos de calor activos en ${regionName}`
  const descripcion =
    `TerraMind detectó ${clusterSize} focos de calor agrupados en ${regionName}. ` +
    `Potencia radiativa máxima: ${maxFrp.toFixed(1)} MW. ` +
    `Condiciones térmicas favorables para propagación (mock: ${mockTemp}°C).`

  const evidencias: Evidencia[] = relatedObs.map((o, i) => ({
    id: `evd:${codigo}:${i}`,
    tipo: 'a_favor' as const,
    hallazgoId,
    observacionIds: [o.id],
    eventoIds: [event.id],
    fuenteIds: [o.fuenteId],
    variableIds: [o.variableId],
    resumen: `Foco FIRMS ${o.valor} MW en ${o.ubicacion.regionName}`,
    peso: 80,
    confianza: o.calidad,
    generadaEn: now,
    generadaPor: 'motor' as const,
  }))

  const hipotesis: Hipotesis = {
    id: `hip:${codigo}`,
    hallazgoId,
    afirmacion: hipTemplate.descripcion,
    confianza: confResult.score,
    estado: 'activa',
    evidenciaAFavor: evidencias.map((e) => e.id),
    evidenciaEnContra: [],
    reglaId: 'R-COR-FIRE',
    generadaEn: now,
    evaluadaEn: now,
  }

  const hallazgo: Hallazgo = {
    id: hallazgoId,
    codigo,
    titulo,
    descripcion,
    categoria: 'incendio',
    territorioId: event.territorioId,
    ubicacion: relatedObs[0]?.ubicacion ?? {
      type: 'region',
      regionName,
      countryCode: 'GT',
    },
    detectadoEn: now,
    actualizadoEn: now,
    estado: 'confirmado',
    eventoIds: [event.id],
    hipotesisIds: [hipotesis.id],
    evidenciaIds: evidencias.map((e) => e.id),
    estrategiaIds: [],
    expedienteId,
    confianza: confResult.score,
    observacionCount: relatedObs.length,
    eventoCount: 1,
    version: 1,
    versionMotor: MOTOR_VERSION,
  }

  const expediente: Expediente = {
    id: expedienteId,
    hallazgoId,
    codigo,
    estado: 'en_investigacion',
    aperturadoEn: now,
    observacionCount: relatedObs.length,
    eventoCount: 1,
    hipotesisCount: 1,
    evidenciaAFavorCount: evidencias.length,
    evidenciaEnContraCount: 0,
    hipotesisPrincipalId: hipotesis.id,
    confianzaActual: confResult.score,
    fuentesUtilizadas: ['nasa-firms'],
    proximaActualizacion: new Date(Date.now() + 3_600_000).toISOString(),
    frecuenciaMonitoreo: '1h',
    historial: [
      {
        id: `exp-ev:open:${codigo}`,
        tipo: 'apertura',
        timestamp: now,
        descripcion: 'Expediente abierto automáticamente por Hallazgo Engine',
      },
      {
        id: `exp-ev:hip:${codigo}`,
        tipo: 'hipotesis_generada',
        timestamp: now,
        descripcion: hipTemplate.nombre,
      },
    ],
    solicitudesPendientes: [],
    resumenEjecutivo: descripcion,
  }

  return { hallazgo, expediente, hipotesis, evidencias, sequence }
}
