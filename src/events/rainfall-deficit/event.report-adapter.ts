/** Déficit de precipitación — report adapter. */
import type { EventReportAdapter } from '@/modules/environmental-events/contracts/report-adapter'
import type { ReportSection } from '@/modules/institutional-reports/institutional-report.types'
import type {
  EnvironmentalEvent,
  RainfallDeficitEnvironmentalEvent,
} from '@/modules/environmental-events/types/environmental-event.types'
import { rainfallDeficitMethodology } from './event.methodology'
import { rainfallDeficitLimitations } from './event.limitations'

function fmtMm(v?: number): string {
  if (v === undefined || !Number.isFinite(v)) return '—'
  return `${v.toFixed(1)} mm`
}

export class RainfallDeficitReportAdapter implements EventReportAdapter {
  readonly eventType = 'rainfall_deficit' as const

  buildSection(events: EnvironmentalEvent[]): ReportSection {
    const own = events.filter(
      (e): e is RainfallDeficitEnvironmentalEvent => e.eventType === 'rainfall_deficit',
    )
    if (own.length === 0) {
      return {
        id: 'rainfall_deficit',
        title: 'Déficits de precipitación',
        content: 'Sin eventos de déficit de precipitación en el periodo.',
        status: 'available',
      }
    }

    const lines = own.map((event) => {
      const w = event.attributes.windows.days30
      const product =
        event.attributes.currentProductStatus === 'preliminary' ? 'Preliminar' : 'Final'
      return [
        `### ${event.title}`,
        '',
        'La precipitación acumulada reciente se encuentra por debajo de lo históricamente esperado para el mismo territorio y época del año.',
        '',
        `- Periodo evaluado: ${w.analysisWindowDays} días`,
        `- Precipitación observada: ${fmtMm(w.observedRainfallMm)}`,
        `- Referencia histórica (mediana): ${fmtMm(w.expectedRainfallMm)}`,
        `- Déficit absoluto: ${fmtMm(w.absoluteDeficitMm)}`,
        `- Déficit relativo: ${w.relativeDeficitPercent !== undefined ? `${w.relativeDeficitPercent} %` : '—'}`,
        `- Percentil histórico: ${w.historicalPercentile !== undefined ? `P${w.historicalPercentile}` : '—'}`,
        `- Persistencia: ${event.attributes.consecutiveDeficitPentads} pentadas`,
        `- Área bajo señal: ${event.attributes.affectedAreaKm2.toFixed(0)} km²`,
        `- Producto CHIRPS: ${product}`,
        `- Última actualización: ${new Date(event.lastObservedAt).toLocaleDateString('es-GT')}`,
        event.attributes.croplandOverlapKm2 !== undefined
          ? `- Área agrícola bajo la señal: ${event.attributes.croplandOverlapKm2.toFixed(0)} km²`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    })

    return {
      id: 'rainfall_deficit',
      title: 'Déficits de precipitación',
      content: [
        lines.join('\n\n'),
        '',
        '## Metodología',
        rainfallDeficitMethodology,
        '',
        '## Limitaciones',
        rainfallDeficitLimitations.map((l) => `- ${l}`).join('\n'),
      ].join('\n'),
      status: 'available',
    }
  }
}

export const rainfallDeficitReportAdapter = new RainfallDeficitReportAdapter()
