import type { ReactNode } from 'react'
import { useHasPermission } from '@/core/auth/AuthProvider'
import { EvidenceButton } from './NewsEvidencePanel'
import { useAnalyzeDocument, useDocumentAnalysis } from '../hooks/useNewsAnalysis'
import type { NewsDocumentAnalysisDto } from '../types/news-analysis-dto.types'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/40 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</h3>
      <div className="mt-2 text-sm text-text-secondary">{children}</div>
    </section>
  )
}

function ConfidenceBadge({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100)
  return (
    <span className="rounded border border-border-subtle bg-surface-1 px-1.5 py-0.5 text-[10px] text-text-secondary">
      {label} {pct}%
    </span>
  )
}

function EpistemicBadge({ label }: { label: string }) {
  return (
    <span className="rounded border border-border-subtle bg-surface-1 px-1.5 py-0.5 text-[10px] text-text-secondary">
      {label}
    </span>
  )
}

function AnalysisContent({ analysis }: { analysis: NewsDocumentAnalysisDto }) {
  const corro = analysis.corroboration
  return (
    <div className="space-y-3" data-testid="news-analysis-content">
      {/* 1. Resumen analítico + confianza / corroboración */}
      <Card title="Resumen analítico">
        {analysis.analytical_summary ? (
          <p className="text-text-primary">{analysis.analytical_summary}</p>
        ) : (
          <p className="text-text-tertiary">Sin resumen analítico.</p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-text-tertiary">Confianza de extracción</p>
            <p className="text-sm text-text-primary">
              {analysis.extraction_confidence != null
                ? `${Math.round(analysis.extraction_confidence * 100)}%`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-text-tertiary">Corroboración</p>
            <p className="text-sm text-text-primary">{corro.level_label}</p>
          </div>
          <div>
            <p className="text-[11px] text-text-tertiary">Estado factual</p>
            <p className="text-sm text-text-primary">{corro.factual_status_label}</p>
          </div>
        </div>
        {analysis.classification &&
          (analysis.classification.primary_category ||
            analysis.classification.secondary_categories.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {analysis.classification.primary_category && (
                <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] text-text-primary">
                  {analysis.classification.primary_category}
                </span>
              )}
              {analysis.classification.secondary_categories.map((c) => (
                <span key={c} className="rounded border border-border-subtle px-2 py-0.5 text-[11px] text-text-secondary">
                  {c}
                </span>
              ))}
              {analysis.classification.original_category && (
                <span className="text-[10px] text-text-tertiary">
                  Categoría del medio: {analysis.classification.original_category}
                </span>
              )}
            </div>
          )}
      </Card>

      {/* 1b. Indicadores destacados (tarjetas numéricas) */}
      {analysis.metrics.some((m) => m.highlighted) && (
        <Card title="Indicadores destacados">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {analysis.metrics
              .filter((m) => m.highlighted)
              .map((m, i) => (
                <div key={m.id ?? i} className="rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                  <p className="text-lg font-semibold text-text-primary">{m.value_label}</p>
                  <p className="text-[11px] text-text-secondary">{m.label}</p>
                  {m.cutoff_date_label && (
                    <p className="text-[10px] text-text-tertiary">al {m.cutoff_date_label}</p>
                  )}
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* 2. Hecho principal */}
      {analysis.primary_fact && (
        <Card title="Hecho principal">
          <p className="text-text-primary">{analysis.primary_fact.statement}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {analysis.primary_fact.epistemic_status_label && (
              <EpistemicBadge label={analysis.primary_fact.epistemic_status_label} />
            )}
            <ConfidenceBadge value={analysis.primary_fact.confidence} label="Extracción" />
            <EvidenceButton evidence={analysis.primary_fact.evidence} />
          </div>
        </Card>
      )}

      {/* 3. Hechos relacionados */}
      {analysis.related_facts.length > 0 && (
        <Card title="Hechos relacionados">
          <ul className="space-y-2">
            {analysis.related_facts.map((f, i) => (
              <li key={i} className="rounded-lg border border-border-subtle bg-surface-1/40 p-2">
                <p className="text-text-primary">{f.statement}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {f.epistemic_status_label && <EpistemicBadge label={f.epistemic_status_label} />}
                  <ConfidenceBadge value={f.confidence} label="Extracción" />
                  <EvidenceButton evidence={f.evidence} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 4. Afirmaciones verificables */}
      {analysis.claims.length > 0 && (
        <Card title="Afirmaciones verificables">
          <ul className="space-y-2">
            {analysis.claims.map((c) => (
              <li key={c.id} className="rounded-lg border border-border-subtle bg-surface-1/40 p-2">
                <p className="text-text-primary">{c.statement}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded border border-border-subtle px-1.5 py-0.5">{c.claim_type_label}</span>
                  <EpistemicBadge label={c.epistemic_status_label} />
                  <ConfidenceBadge value={c.confidence} label="Extracción" />
                  <span className="text-text-tertiary">· {corro.factual_status_label}</span>
                  <EvidenceButton evidence={c.evidence} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 5. Entidades (agrupadas) y relaciones */}
      {(analysis.entities.length > 0 || analysis.relationships.length > 0) && (
        <Card title="Entidades y relaciones">
          {(() => {
            const groups: Array<{ key: string; title: string }> = [
              { key: 'participants', title: 'Participantes y objetos' },
              { key: 'facts', title: 'Hechos y decisiones' },
              { key: 'location', title: 'Ubicación' },
            ]
            return groups.map((g) => {
              const items = analysis.entities.filter((e) => e.entity_group === g.key)
              if (items.length === 0) return null
              return (
                <div key={g.key} className="mb-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{g.title}</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {items.map((e) => (
                      <li key={e.id} className="rounded-lg border border-border-subtle p-2">
                        <p className="font-medium text-text-primary">{e.mentioned_name}</p>
                        <p className="text-[11px] text-text-tertiary">
                          {e.entity_type_label} · {e.status_label}
                        </p>
                        <EvidenceButton evidence={e.evidence} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          })()}
          {analysis.relationships.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Relaciones</p>
              <ul className="space-y-1 text-sm">
                {analysis.relationships.map((r, i) => {
                  const resolveName = (id: string) =>
                    analysis.entities.find((e) => e.id === id)?.mentioned_name ??
                    analysis.locations.find((l) => l.id === id)?.name ??
                    id
                  const subj = resolveName(r.subject_entity_id)
                  const obj = resolveName(r.object_entity_id)
                  return (
                    <li key={i} className="text-text-secondary">
                      <span className="text-text-primary">{subj}</span> → {r.predicate} →{' '}
                      <span className="text-text-primary">{obj}</span>
                      <span className="ml-2 text-[10px] text-text-tertiary">({r.epistemic_status_label})</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* 6. Lugar y tiempo */}
      <Card title="Lugar y tiempo">
        {analysis.locations.length > 0 ? (
          <ul className="space-y-1">
            {analysis.locations.map((l) => (
              <li key={l.id}>
                {l.name} <span className="text-[11px] text-text-tertiary">({l.role_label})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-tertiary">Sin ubicaciones específicas.</p>
        )}
        <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-[11px] text-text-tertiary">Fecha de publicación</p>
            <p>{analysis.publication_date ?? 'No especificada'}</p>
          </div>
          <div>
            <p className="text-[11px] text-text-tertiary">Fecha del hecho</p>
            <p>{analysis.event_date_label}</p>
          </div>
        </div>
      </Card>

      {/* 6b. Métricas por grupo */}
      {analysis.metrics.length > 0 &&
        (() => {
          const groups: Array<{ key: string; title: string }> = [
            { key: 'human', title: 'Impacto humano' },
            { key: 'housing', title: 'Vivienda' },
            { key: 'infrastructure', title: 'Infraestructura' },
            { key: 'emergency_type', title: 'Tipos de emergencia' },
            { key: 'other', title: 'Otras cifras' },
          ]
          const rendered = groups
            .map((g) => ({ g, items: analysis.metrics.filter((m) => m.group === g.key) }))
            .filter((x) => x.items.length > 0)
          if (rendered.length === 0) return null
          return (
            <Card title="Cifras reportadas">
              {rendered.map(({ g, items }) => (
                <div key={g.key} className="mb-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{g.title}</p>
                  <ul className="space-y-1">
                    {items.map((m, i) => (
                      <li key={m.id ?? i} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-text-primary">{m.value_label}</span>
                        <span className="text-text-secondary">{m.label}</span>
                        {m.source_name && (
                          <span className="text-[10px] text-text-tertiary">· {m.source_name}</span>
                        )}
                        {m.cutoff_date_label && (
                          <span className="text-[10px] text-text-tertiary">· al {m.cutoff_date_label}</span>
                        )}
                        {m.epistemic_status_label && <EpistemicBadge label={m.epistemic_status_label} />}
                        <EvidenceButton evidence={m.evidence} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          )
        })()}

      {/* 6c. Periodo y fecha de corte */}
      {analysis.reporting_period &&
        (analysis.reporting_period.cutoff_date_label ||
          analysis.reporting_period.status ||
          analysis.reporting_period.text_reference) && (
          <Card title="Periodo y fecha de corte">
            {analysis.reporting_period.status && (
              <p className="text-text-primary">{analysis.reporting_period.status}</p>
            )}
            <div className="mt-1 grid gap-2 sm:grid-cols-2 text-sm">
              {analysis.reporting_period.cutoff_date_label && (
                <div>
                  <p className="text-[11px] text-text-tertiary">Fecha de corte</p>
                  <p>{analysis.reporting_period.cutoff_date_label}</p>
                </div>
              )}
              {analysis.reporting_period.text_reference && (
                <div>
                  <p className="text-[11px] text-text-tertiary">Referencia</p>
                  <p>{analysis.reporting_period.text_reference}</p>
                </div>
              )}
            </div>
          </Card>
        )}

      {/* 6c2. Cobertura documental y fuente primaria recomendada */}
      {(analysis.document_coverage || analysis.recommended_primary_source) && (
        <Card title="Cobertura documental">
          {analysis.document_coverage && (
            <>
              <p className="text-text-primary">{analysis.document_coverage.label}</p>
              <p className="mt-1 text-sm text-text-secondary">{analysis.document_coverage.reason}</p>
            </>
          )}
          {analysis.recommended_primary_source && (
            <div className="mt-3 rounded-lg border border-border-subtle bg-surface-1/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                Fuente primaria recomendada
              </p>
              <p className="mt-1 text-text-primary">{analysis.recommended_primary_source.source_type}</p>
              <p className="mt-1 text-sm text-text-secondary">{analysis.recommended_primary_source.reason}</p>
              {analysis.recommended_primary_source.fields_it_would_complete.length > 0 && (
                <p className="mt-1 text-[11px] text-text-tertiary">
                  Permitiría completar:{' '}
                  {analysis.recommended_primary_source.fields_it_would_complete.join(', ')}
                </p>
              )}
              <p className="mt-1 text-[10px] text-text-tertiary">
                No se busca ni descarga todavía en esta fase.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* 6d. Sectores potencialmente relacionados */}
      {analysis.sector_relevance.length > 0 && (
        <Card title="Sectores potencialmente relacionados">
          <ul className="space-y-1">
            {analysis.sector_relevance.map((s, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-text-primary">{s.sector}</span>
                {s.relevance && <span className="text-[11px] text-text-tertiary">({s.relevance})</span>}
                {s.reasons.length > 0 && (
                  <span className="text-[11px] text-text-secondary">— {s.reasons.join('; ')}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-text-tertiary">
            Sectores potencialmente relacionados, no ministerios responsables.
          </p>
        </Card>
      )}

      {/* 7. Información pendiente */}
      {analysis.unknowns.length > 0 && (
        <Card title="Información pendiente">
          <ul className="list-disc space-y-1 pl-4">
            {analysis.unknowns.map((u, i) => (
              <li key={i}>{u.description}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* 8. Candidato a evento */}
      {analysis.event_candidate && (analysis.event_candidate.qualifies || analysis.event_candidate.candidate_title) && (
        <Card title="Candidato a evento">
          <p className="text-text-primary">
            {analysis.event_candidate.candidate_title ?? 'Propuesta de evento'}
          </p>
          {analysis.event_candidate.candidate_type && (
            <p className="mt-1 text-[11px] text-text-tertiary">
              Tipo: {analysis.event_candidate.candidate_type}
            </p>
          )}
          {analysis.event_candidate.root_event_candidate && (
            <p className="mt-1 text-sm">
              <span className="text-text-tertiary">Evento raíz: </span>
              {analysis.event_candidate.root_event_candidate}
            </p>
          )}
          {analysis.event_candidate.document_role_label && (
            <p className="mt-1 text-sm">
              <span className="text-text-tertiary">Rol de esta noticia: </span>
              {analysis.event_candidate.document_role_label}
              {analysis.event_candidate.development_type
                ? ` — ${analysis.event_candidate.development_type}`
                : ''}
            </p>
          )}
          <p className="mt-1 text-[11px] text-text-tertiary">
            Estado: {analysis.event_candidate.promotion_recommendation_label}
            {' · '}Confianza {Math.round(analysis.event_candidate.confidence * 100)}%
          </p>
          {analysis.event_candidate.reason && (
            <p className="mt-1 text-sm">{analysis.event_candidate.reason}</p>
          )}
          <p className="mt-1 text-[11px] text-text-tertiary">
            No se crea el evento todavía en esta fase.
          </p>
        </Card>
      )}

      {/* 8b. Indicador preliminar de amenaza */}
      {analysis.threat_hint && analysis.threat_hint.qualifies_for_future_evaluation && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-orange-200">
            Indicador preliminar de amenaza
          </h3>
          <p className="mt-1 text-text-primary">
            {analysis.threat_hint.proposed_title ?? 'Candidato a evaluación de amenaza'}
          </p>
          <p className="mt-1 text-[11px] text-orange-200/80">
            Estado: Candidato a evaluación de amenaza · Confianza{' '}
            {Math.round(analysis.threat_hint.confidence * 100)}%
          </p>
          {analysis.threat_hint.reasons.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-sm text-text-secondary">
              {analysis.threat_hint.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[10px] text-text-tertiary">
            No se promueve ni se cuenta como amenaza en esta fase; es una señal para evaluación futura.
          </p>
        </div>
      )}

      {/* 9. Corroboración y fuentes */}
      <Card title="Corroboración y fuentes">
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-[11px] text-text-tertiary">Fuente</p>
            <p>{corro.source_name}</p>
          </div>
          <div>
            <p className="text-[11px] text-text-tertiary">Cobertura</p>
            <p>{corro.coverage_label}</p>
          </div>
          <div>
            <p className="text-[11px] text-text-tertiary">Corroboración</p>
            <p>{corro.level_label}</p>
          </div>
        </div>
      </Card>

      {/* 10. Advertencias y revisión */}
      {(analysis.requires_human_review ||
        analysis.validation_summary.warnings.length > 0 ||
        analysis.validation_summary.rejected_relations.length > 0 ||
        analysis.sensitivity_flags.length > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="text-xs font-semibold text-amber-200">Advertencias y revisión</h3>
          {analysis.validation_summary.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-sm text-amber-100/90">
              {analysis.validation_summary.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {analysis.validation_summary.rejected_relations.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-amber-200">Relaciones descartadas</p>
              <ul className="mt-1 space-y-1 text-sm text-amber-100/90">
                {analysis.validation_summary.rejected_relations.map((r, i) => (
                  <li key={i}>
                    <span className="line-through">{r.subject} → {r.predicate} → {r.object}</span>
                    <span className="block text-[11px] text-amber-200/80">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.sensitivity_flags.length > 0 && (
            <div className="mt-2 space-y-1">
              {analysis.sensitivity_flags.map((f) => (
                <div key={f.code} className="text-sm text-amber-100/90">
                  <span className="font-medium">{f.label}</span>
                  {f.reason && <span> — {f.reason}</span>}
                  {f.consequence && <span className="text-amber-200/80"> {f.consequence}</span>}
                </div>
              ))}
            </div>
          )}
          {analysis.validation_summary.technical_codes.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-amber-200/70">Detalle técnico</summary>
              <p className="mt-1 break-words text-[11px] text-amber-200/60">
                {analysis.validation_summary.technical_codes.join(', ')}
              </p>
            </details>
          )}
        </div>
      )}

      {/* Historial de versiones */}
      {analysis.version_history.length > 1 && (
        <details className="rounded-lg border border-border-subtle bg-surface-2/30 p-3">
          <summary className="cursor-pointer text-[11px] text-text-tertiary">
            Historial de análisis ({analysis.version_history.length} versiones)
          </summary>
          <ul className="mt-2 space-y-1 text-[11px] text-text-secondary">
            {analysis.version_history.map((v, i) => (
              <li key={v.id}>
                {v.is_active ? '● ' : '○ '}
                Análisis {analysis.version_history.length - i} · {v.status_label} ·{' '}
                {new Date(v.created_at).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                {v.is_active && ' (activa)'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function NewsDocumentAnalysisSection({ documentId }: { documentId: string }) {
  const canRun = useHasPermission('news.analysis.run')
  const canView = useHasPermission('news.analysis.view')
  const { data: analysis, isLoading, isFetching } = useDocumentAnalysis(documentId)
  const analyzeMutation = useAnalyzeDocument()

  if (!canView) return null

  const isAnalyzing = analyzeMutation.isPending || isFetching
  const hasResult = analysis && analysis.status !== 'failed'
  const needsAnalysis = !isLoading && (!analysis || analysis.status === 'failed')

  return (
    <section data-testid="news-analysis-section">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
        <h2 className="text-sm font-semibold text-text-primary">Análisis de hechos y señales</h2>
        {analysis && (
          <span className="rounded border border-border-subtle px-1.5 py-0.5 text-[10px] text-text-secondary">
            {analysis.status_label}
          </span>
        )}
      </div>

      {isLoading && <p className="mt-3 text-sm text-text-secondary">Cargando análisis…</p>}

      {needsAnalysis && (
        <div className="mt-3">
          <p className="text-sm text-text-secondary">
            {analysis?.status === 'failed'
              ? 'El análisis anterior no pudo completarse. Puedes intentarlo de nuevo.'
              : 'Esta noticia todavía no ha sido analizada.'}
          </p>
          {canRun && (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => analyzeMutation.mutate({ documentId, modelTier: 'fast' })}
              className="mt-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {isAnalyzing
                ? 'Analizando noticia…'
                : analysis?.status === 'failed'
                  ? 'Reintentar análisis'
                  : 'Analizar noticia'}
            </button>
          )}
        </div>
      )}

      {hasResult && (
        <div className="mt-3">
          {canRun && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => analyzeMutation.mutate({ documentId, modelTier: 'fast' })}
                className="rounded-lg border border-border-subtle px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                {isAnalyzing ? 'Analizando…' : 'Reanalizar'}
              </button>
            </div>
          )}
          <AnalysisContent analysis={analysis} />
        </div>
      )}

      {analyzeMutation.isError && (
        <p className="mt-2 text-sm text-rose-300">{(analyzeMutation.error as Error).message}</p>
      )}
    </section>
  )
}
