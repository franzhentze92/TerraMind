import { useState } from 'react'
import { Badge } from '@/shared/components/Badge'
import { OperationalEmptyState } from '@/shared/components'
import { useMissionEvidence, useEvidenceIntake, useMissionEvidenceQuality } from '../hooks/useMissionEvidence'
import { EvidenceSubmissionDetailPanel } from './EvidenceSubmissionDetailPanel'

const STATUS_LABELS: Record<string, string> = {
  received: 'Recibida',
  processing: 'Procesando',
  ready_for_validation: 'Lista para validación',
  incomplete: 'Metadatos incompletos',
  duplicate: 'Posible duplicado',
  unsupported: 'No soportada',
  processing_failed: 'Fallo de procesamiento',
  withdrawn: 'Retirada',
}

interface MissionEvidenceSectionProps {
  missionId: string
}

export function MissionEvidenceSection({ missionId }: MissionEvidenceSectionProps) {
  const query = useMissionEvidence(missionId)
  const qualityQuery = useMissionEvidenceQuality(missionId)
  const intake = useEvidenceIntake(missionId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const data = query.data
  const requirements = (data?.requirements ?? []) as Array<Record<string, unknown>>
  const submissions = (data?.submissions ?? []) as unknown as Array<Record<string, unknown>>
  const coverage = data?.coverage

  async function createPhotoSubmission() {
    setError(null)
    try {
      await intake.createSubmission.mutateAsync({
        evidence_type: 'georeferenced_photo',
        source_type: 'mission_user',
        description: 'Evidencia recibida desde misión de campo',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear submission')
    }
  }

  async function createObservationSubmission() {
    setError(null)
    try {
      const result = await intake.createSubmission.mutateAsync({
        evidence_type: 'structured_observation',
        source_type: 'mission_user',
        description: 'Observación estructurada entregada',
      })
      const submissionId = String(result.submission.id)
      await intake.addObservation.mutateAsync({
        submissionId,
        fields: {
          visible_smoke: 'uncertain',
          visible_flame: 'no',
          observer_notes: 'Observación entregada; cobertura preliminar pendiente',
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar observación')
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Evidencia</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={createPhotoSubmission}
            className="rounded border border-accent/40 px-2 py-1 text-xs text-accent"
          >
            Nueva foto
          </button>
          <button
            type="button"
            onClick={createObservationSubmission}
            className="rounded border border-accent/40 px-2 py-1 text-xs text-accent"
          >
            Observación
          </button>
        </div>
      </div>

      {query.isLoading && <p className="text-xs text-text-tertiary">Cargando evidencia…</p>}
      {error && <p className="mb-2 text-xs text-confidence-low">{error}</p>}

      {qualityQuery.data && (
        <div className="mb-4 rounded border border-border-subtle bg-surface-2/30 p-3 text-xs">
          <p className="font-medium text-text-primary">Resumen de calidad</p>
          <p className="mt-1 text-text-secondary">
            Aceptada: {String((qualityQuery.data.validation_counts as Record<string, number>)?.accepted ?? 0)} ·
            Con limitaciones:{' '}
            {String(
              (qualityQuery.data.validation_counts as Record<string, number>)
                ?.accepted_with_limitations ?? 0,
            )}{' '}
            · Inconclusa:{' '}
            {String((qualityQuery.data.validation_counts as Record<string, number>)?.inconclusive ?? 0)} ·
            Rechazada:{' '}
            {String((qualityQuery.data.validation_counts as Record<string, number>)?.rejected ?? 0)}
          </p>
          {Number(qualityQuery.data.conflict_flags) > 0 && (
            <p className="mt-1 text-confidence-low">
              Conflictos potenciales: {String(qualityQuery.data.conflict_flags)}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 rounded border border-border-subtle bg-surface-2/30 p-3">
        <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
          Cobertura preliminar
        </p>
        <div className="mt-2 space-y-1">
          {(coverage?.requirements ?? []).map((item) => (
            <p key={item.requirement_id} className="text-xs text-text-secondary">
              {item.evidence_type}: {item.submission_count}/{item.minimum_count} ·{' '}
              {item.preliminary_status}
            </p>
          ))}
          {(coverage?.requirements ?? []).length === 0 && (
            <p className="text-xs text-text-tertiary">Sin requisitos registrados.</p>
          )}
          {(coverage?.unlinked_submission_ids ?? []).length > 0 && (
            <p className="text-xs text-text-tertiary">
              Evidencia no vinculada: {coverage!.unlinked_submission_ids.length}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-medium text-text-primary">Requisitos</p>
        <div className="space-y-2">
          {requirements.map((req) => (
            <div key={String(req.id)} className="rounded border border-border-subtle px-3 py-2 text-xs">
              <p className="font-medium text-text-primary">{String(req.evidence_type)}</p>
              <p className="text-text-tertiary">
                Mínimo {String(req.minimum_count)} ·{' '}
                {req.required ? 'obligatorio' : 'opcional'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-text-primary">Evidencia recibida</p>
        <div className="space-y-2">
          {submissions.map((sub) => (
            <button
              key={String(sub.id)}
              type="button"
              onClick={() => setSelectedId(String(sub.id))}
              className="block w-full rounded border border-border-subtle px-3 py-2 text-left text-xs hover:border-accent/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-text-primary">{String(sub.evidence_type)}</span>
                <Badge variant="default">
                  {STATUS_LABELS[String(sub.status)] ?? String(sub.status)}
                </Badge>
              </div>
              <p className="mt-1 text-text-tertiary">
                Entregada {new Date(String(sub.submitted_at)).toLocaleString('es-GT')}
              </p>
              {Boolean(sub.location_outside_mission_area) && (
                <p className="mt-1 text-confidence-low">Ubicación fuera del área de misión</p>
              )}
            </button>
          ))}
          {submissions.length === 0 && !query.isLoading && (
            <OperationalEmptyState
              compact
              title="No se ha recibido evidencia operacional"
              explanation="La evidencia se genera cuando una misión de campo o una revisión estructurada entrega observaciones verificables."
              sourceProcess="Misión → captura → envío"
              status="pending"
            />
          )}
        </div>
      </div>

      {selectedId && (
        <EvidenceSubmissionDetailPanel
          submissionId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  )
}
