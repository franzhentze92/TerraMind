import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/shared/layouts'
import { NationalSituationPage } from '@/modules/national-center/pages/NationalSituationPage'
import { CopilotPage } from '@/modules/copilot/pages/CopilotPage'
import { FindingsPage } from '@/modules/findings/pages/FindingsPage'
import { FindingDetailPage } from '@/modules/findings/pages/FindingDetailPage'
import { PrioritiesPage } from '@/modules/priorities/pages/PrioritiesPage'
import { PriorityDetailPage } from '@/modules/priorities/pages/PriorityDetailPage'
import { TerritoryPage } from '@/modules/territory/pages/TerritoryPage'
import { StrategiesPage } from '@/modules/strategies/pages/StrategiesPage'
import { KnowledgePage } from '@/modules/knowledge/pages/KnowledgePage'
import { IntegrationsPage } from '@/modules/integrations/pages/IntegrationsPage'
import { TrendsPage } from '@/modules/trends/pages/TrendsPage'
import { ReportsPage } from '@/modules/reports/pages/ReportsPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { FireAnalysisPage } from '@/modules/fires/pages/FireAnalysisPage'
import { BiodiversityAnalysisPage } from '@/modules/biodiversity/pages/BiodiversityAnalysisPage'
import { IncidentsPage } from '@/modules/incidents/pages/IncidentsPage'
import { IncidentDetailPage } from '@/modules/incidents/pages/IncidentDetailPage'
import { VerificationsPage } from '@/modules/verification/pages/VerificationsPage'
import { MissionsPage } from '@/modules/missions/pages/MissionsPage'
import { MissionDetailPage } from '@/modules/missions/pages/MissionDetailPage'
import { AssignmentsPage } from '@/modules/missions/pages/AssignmentsPage'
import { FieldPackagesPage } from '@/modules/field-operations/pages/FieldPackagesPage'
import { FieldPackageDetailPage } from '@/modules/field-operations/pages/FieldPackageDetailPage'
import { FieldTaskFormPage } from '@/modules/field-operations/pages/FieldTaskFormPage'
import { PendingEvidencePage } from '@/modules/field-operations/pages/PendingEvidencePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/situacion" replace /> },
      { path: 'situacion', element: <NationalSituationPage /> },
      { path: 'incendios', element: <FireAnalysisPage /> },
      { path: 'incendios/:eventId', element: <FireAnalysisPage /> },
      { path: 'biodiversidad', element: <BiodiversityAnalysisPage /> },
      { path: 'copilot', element: <CopilotPage /> },
      { path: 'hallazgos', element: <FindingsPage /> },
      { path: 'hallazgos/:findingId', element: <FindingDetailPage /> },
      { path: 'prioridades', element: <PrioritiesPage /> },
      { path: 'prioridades/:priorityId', element: <PriorityDetailPage /> },
      { path: 'incidentes', element: <IncidentsPage /> },
      { path: 'incidentes/:incidentId', element: <IncidentDetailPage /> },
      { path: 'verificaciones', element: <VerificationsPage /> },
      { path: 'misiones', element: <MissionsPage /> },
      { path: 'misiones/:missionId', element: <MissionDetailPage /> },
      { path: 'operaciones/asignaciones', element: <AssignmentsPage /> },
      { path: 'campo/paquetes', element: <FieldPackagesPage /> },
      { path: 'campo/paquetes/:packageId', element: <FieldPackageDetailPage /> },
      { path: 'campo/paquetes/:packageId/tareas/:taskId', element: <FieldTaskFormPage /> },
      { path: 'campo/evidencia-pendiente', element: <PendingEvidencePage /> },
      { path: 'estrategias', element: <StrategiesPage /> },
      { path: 'territorio', element: <TerritoryPage /> },
      { path: 'tendencias', element: <TrendsPage /> },
      { path: 'informes', element: <ReportsPage /> },
      { path: 'fuentes', element: <IntegrationsPage /> },
      { path: 'conocimiento', element: <KnowledgePage /> },
      { path: 'administracion', element: <SettingsPage /> },
      // Legacy redirects
      { path: 'events', element: <Navigate to="/hallazgos" replace /> },
      { path: 'reports', element: <Navigate to="/informes" replace /> },
      { path: 'trends', element: <Navigate to="/tendencias" replace /> },
      { path: 'territory', element: <Navigate to="/territorio" replace /> },
      { path: 'strategies', element: <Navigate to="/estrategias" replace /> },
      { path: 'integrations', element: <Navigate to="/fuentes" replace /> },
      { path: 'settings', element: <Navigate to="/administracion" replace /> },
    ],
  },
])
