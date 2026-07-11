# Phase 6 — Professional Reports & Institutional Deliverables

**Product Consolidation Phase 6**  
**Estado:** implementado  
**Auditoría:** `npm run professional-reports:audit`

## Resumen

TerraMind convierte informes ejecutivos en entregables institucionales con un modelo canónico
(`InstitutionalReport`) compartido por HTML, impresión y PDF.

## Auditoría del sistema previo

| Elemento | Clasificación | Notas |
|----------|---------------|-------|
| Hub `/informes` | **improve** | Empty state Phase 5; ahora cards con acciones y leyenda de clasificación |
| Informe nacional HTML | **replace** | Render legacy por secciones sueltas; ahora `InstitutionalReportView` |
| Informe por incidente | **replace** | Título con UUID; ahora nombre determinístico |
| PDF nacional/incidente | **replace** | Pipeline PDFKit independiente; ahora `renderInstitutionalReportPdf` |
| Impresión | **missing → keep** | `report-print.css` A4, saltos, watermark demo |
| Métricas | **improve** | Solo `canonical_metrics` / ExecutiveMetricsService |
| Mapas | **improve** | Fallback tabular cuando mapa estático no disponible |
| Clasificación | **inconsistent → keep** | `draft/internal/official/demo` en español |
| Metodología / limitaciones / fuentes | **missing → keep** | Secciones obligatorias |
| Informe verificación | **not_institutional** | Sin motor nuevo; fuera del menú principal |
| Nombre de archivo | **improve** | `terramind_informe_nacional_YYYY-MM-DD_YYYY-MM-DD_borrador.pdf` |
| Permisos | **keep** | `findings.view`, `incidents.view` vía operational guard |

### Diferencias dashboard vs entregables (antes / después)

| Aspecto | Dashboard | HTML (antes) | PDF (antes) | Phase 6 |
|---------|-----------|--------------|-------------|---------|
| KPIs | ExecutiveMetrics | Texto suelto | Recálculo parcial | Mismo array canónico |
| Clasificación | Labels internos | `draft` crudo | Labels mixtos | Banner institucional |
| Legacy | Separado en UI | Mezclado | Mezclado | Anexo separado |
| Demo | Banner | Checkbox | Texto ad hoc | Watermark + nunca oficial |

## Modelo canónico

- `src/modules/institutional-reports/institutional-report.types.ts` — `InstitutionalReport`
- Builders: `national-report.builder.ts`, `incident-report.builder.ts`
- Adjunto en DTO: `NationalReportDto.institutional`, `IncidentReportDto.institutional`

## Componentes de presentación

| Componente | Archivo |
|------------|---------|
| ReportCover, ReportHeader, ReportFooter | `components/ReportChrome.tsx` |
| ReportSection, ReportCallout | `components/ReportSection.tsx` |
| ReportTable (métricas, hallazgos, incidentes, fuentes, timeline) | `components/ReportTable.tsx` |
| InstitutionalReportView | `components/InstitutionalReportView.tsx` |
| report-theme.ts | Colores, versión documento |
| report-print.css | A4, numeración, watermark |

## Estructura informe nacional

1. Portada institucional  
2. Resumen ejecutivo (determinístico)  
3. KPIs nacionales (6 métricas canónicas)  
4. Mapa (fallback si no renderiza)  
5. Hallazgos prioritarios (máx. 5)  
6. Incidentes operacionales (mensaje si vacío)  
7. Legacy / demo en anexos  
8. Línea temporal  
9. Metodología  
10. Limitaciones  
11. Fuentes  

## Estructura informe por incidente

19 etapas documentadas vía `story.stages` con estados: disponible, pendiente, no requerida, legacy, demo. Timeline institucional sin UUIDs en columnas visibles.

## Generación

- `server/services/reports.service.ts` — construye DTO + `institutional`
- `server/services/institutional-report-pdf.service.ts` — PDF unificado
- `server/routes/reports.ts` — filenames institucionales

## Tests y auditoría

- `src/modules/institutional-reports/institutional-reports.test.ts`
- `npm run professional-reports:audit`

## Fuera de alcance (Phase 6)

Scheduler, email, firma digital, mapa interactivo en PDF, informe de verificación standalone, datos sintéticos.
