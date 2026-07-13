import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy } from 'react'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import { AppShell } from '@/shared/layouts'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { PermissionRoute } from '@/core/auth/PermissionRoute'
import { AwaitingAccessPage } from '@/modules/auth/pages/AwaitingAccessPage'
import { ForbiddenPage } from '@/modules/auth/pages/ForbiddenPage'
import type { TerramindPermission } from '@/core/auth/permissions'
import type { ReactNode } from 'react'

const NationalSituationPage = lazy(() =>
  import('@/modules/national-center/pages/NationalSituationPage').then((m) => ({
    default: m.NationalSituationPage,
  })),
)
const FireAnalysisPage = lazy(() =>
  import('@/modules/fires/pages/FireAnalysisPage').then((m) => ({ default: m.FireAnalysisPage })),
)
const BiodiversityAnalysisPage = lazy(() =>
  import('@/modules/biodiversity/pages/BiodiversityAnalysisPage').then((m) => ({
    default: m.BiodiversityAnalysisPage,
  })),
)
const EnvironmentalEventDetailPage = lazy(() =>
  import('@/modules/environmental-events/pages/EnvironmentalEventDetailPage').then((m) => ({
    default: m.EnvironmentalEventDetailPage,
  })),
)
const EnvironmentalEventTypeListPage = lazy(() =>
  import('@/modules/environmental-events/pages/EnvironmentalEventTypeListPage').then((m) => ({
    default: m.EnvironmentalEventTypeListPage,
  })),
)
const NationalReportPage = lazy(() =>
  import('@/modules/executive-demo/pages/NationalReportPage').then((m) => ({
    default: m.NationalReportPage,
  })),
)
const FieldCampoLayout = lazy(() =>
  import('@/modules/field-operations/field-mobile/components/FieldCampoLayout').then((m) => ({
    default: m.FieldCampoLayout,
  })),
)
const OrganizationAdminPage = lazy(() =>
  import('@/modules/admin/pages/OrganizationAdminPage').then((m) => ({
    default: m.OrganizationAdminPage,
  })),
)
const CopilotPage = lazy(() =>
  import('@/modules/copilot/pages/CopilotPage').then((m) => ({ default: m.CopilotPage })),
)
const FindingsPage = lazy(() =>
  import('@/modules/findings/pages/FindingsPage').then((m) => ({ default: m.FindingsPage })),
)
const FindingDetailPage = lazy(() =>
  import('@/modules/findings/pages/FindingDetailPage').then((m) => ({ default: m.FindingDetailPage })),
)
const NewsLivePage = lazy(() =>
  import('@/modules/news/pages/NewsLivePage').then((m) => ({ default: m.NewsLivePage })),
)
const NewsDocumentDetailPage = lazy(() =>
  import('@/modules/news/pages/NewsDocumentDetailPage').then((m) => ({ default: m.NewsDocumentDetailPage })),
)
const PrioritiesPage = lazy(() =>
  import('@/modules/priorities/pages/PrioritiesPage').then((m) => ({ default: m.PrioritiesPage })),
)
const PriorityDetailPage = lazy(() =>
  import('@/modules/priorities/pages/PriorityDetailPage').then((m) => ({ default: m.PriorityDetailPage })),
)
const TerritoryPage = lazy(() =>
  import('@/modules/territory/pages/TerritoryPage').then((m) => ({ default: m.TerritoryPage })),
)
const StrategiesPage = lazy(() =>
  import('@/modules/strategies/pages/StrategiesPage').then((m) => ({ default: m.StrategiesPage })),
)
const KnowledgePage = lazy(() =>
  import('@/modules/knowledge/pages/KnowledgePage').then((m) => ({ default: m.KnowledgePage })),
)
const IntegrationsPage = lazy(() =>
  import('@/modules/integrations/pages/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })),
)
const TrendsPage = lazy(() =>
  import('@/modules/trends/pages/TrendsPage').then((m) => ({ default: m.TrendsPage })),
)
const ReportsHubPage = lazy(() =>
  import('@/modules/executive-demo/pages/ReportsHubPage').then((m) => ({ default: m.ReportsHubPage })),
)
const IncidentReportPage = lazy(() =>
  import('@/modules/executive-demo/pages/IncidentReportPage').then((m) => ({
    default: m.IncidentReportPage,
  })),
)
const IncidentStoryPage = lazy(() =>
  import('@/modules/executive-demo/pages/IncidentStoryPage').then((m) => ({ default: m.IncidentStoryPage })),
)
const SettingsPage = lazy(() =>
  import('@/modules/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const IncidentsPage = lazy(() =>
  import('@/modules/incidents/pages/IncidentsPage').then((m) => ({ default: m.IncidentsPage })),
)
const IncidentDetailPage = lazy(() =>
  import('@/modules/incidents/pages/IncidentDetailPage').then((m) => ({ default: m.IncidentDetailPage })),
)
const VerificationsPage = lazy(() =>
  import('@/modules/verification/pages/VerificationsPage').then((m) => ({ default: m.VerificationsPage })),
)
const MissionsPage = lazy(() =>
  import('@/modules/missions/pages/MissionsPage').then((m) => ({ default: m.MissionsPage })),
)
const MissionDetailPage = lazy(() =>
  import('@/modules/missions/pages/MissionDetailPage').then((m) => ({ default: m.MissionDetailPage })),
)
const AssignmentsPage = lazy(() =>
  import('@/modules/missions/pages/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })),
)
const FieldCampoHomePage = lazy(() =>
  import('@/modules/field-operations/pages/FieldCampoHomePage').then((m) => ({
    default: m.FieldCampoHomePage,
  })),
)
const FieldConflictsPage = lazy(() =>
  import('@/modules/field-operations/pages/FieldConflictsPage').then((m) => ({
    default: m.FieldConflictsPage,
  })),
)
const FieldMissionsPage = lazy(() =>
  import('@/modules/field-operations/pages/FieldMissionsPage').then((m) => ({
    default: m.FieldMissionsPage,
  })),
)
const FieldPackagesPage = lazy(() =>
  import('@/modules/field-operations/pages/FieldPackagesPage').then((m) => ({
    default: m.FieldPackagesPage,
  })),
)
const FieldPackageDetailPage = lazy(() =>
  import('@/modules/field-operations/pages/FieldPackageDetailPage').then((m) => ({
    default: m.FieldPackageDetailPage,
  })),
)
const FieldSyncPage = lazy(() =>
  import('@/modules/field-operations/pages/FieldSyncPage').then((m) => ({ default: m.FieldSyncPage })),
)
const FieldTaskFormPage = lazy(() =>
  import('@/modules/field-operations/pages/FieldTaskFormPage').then((m) => ({
    default: m.FieldTaskFormPage,
  })),
)
const PendingEvidencePage = lazy(() =>
  import('@/modules/field-operations/pages/PendingEvidencePage').then((m) => ({
    default: m.PendingEvidencePage,
  })),
)
const ResponseOrchestrationListPage = lazy(() =>
  import('@/modules/response-orchestration/pages/ResponseOrchestrationListPage').then((m) => ({
    default: m.ResponseOrchestrationListPage,
  })),
)
const ResponseOrchestrationDetailPage = lazy(() =>
  import('@/modules/response-orchestration/pages/ResponseOrchestrationDetailPage').then((m) => ({
    default: m.ResponseOrchestrationDetailPage,
  })),
)

function guard(permission: TerramindPermission, element: ReactNode) {
  return <PermissionRoute permission={permission}>{element}</PermissionRoute>
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/403', element: <ForbiddenPage /> },
  { path: '/espera-acceso', element: <AwaitingAccessPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/situacion" replace /> },
      { path: 'situacion', element: guard('findings.view', <NationalSituationPage />) },
      { path: 'situacion-nacional', element: guard('findings.view', <NationalSituationPage />) },
      { path: 'incendios', element: guard('incidents.view', <FireAnalysisPage />) },
      { path: 'incendios/:eventId', element: guard('incidents.view', <FireAnalysisPage />) },
      { path: 'biodiversidad', element: guard('findings.view', <BiodiversityAnalysisPage />) },
      { path: 'eventos/tipo/:type', element: guard('findings.view', <EnvironmentalEventTypeListPage />) },
      { path: 'eventos/:eventId', element: guard('findings.view', <EnvironmentalEventDetailPage />) },
      { path: 'copilot', element: guard('findings.view', <CopilotPage />) },
      { path: 'hallazgos', element: guard('findings.view', <FindingsPage />) },
      { path: 'hallazgos/:findingId', element: guard('findings.view', <FindingDetailPage />) },
      { path: 'noticias', element: guard('news.view', <NewsLivePage />) },
      { path: 'noticias/:documentId', element: guard('news.view', <NewsDocumentDetailPage />) },
      { path: 'prioridades', element: guard('priorities.view', <PrioritiesPage />) },
      { path: 'prioridades/:priorityId', element: guard('priorities.view', <PriorityDetailPage />) },
      { path: 'incidentes', element: guard('incidents.view', <IncidentsPage />) },
      { path: 'incidentes/:incidentId', element: guard('incidents.view', <IncidentDetailPage />) },
      { path: 'incidentes/:incidentId/historia', element: guard('incidents.view', <IncidentStoryPage />) },
      { path: 'verificaciones', element: guard('verification_plans.view', <VerificationsPage />) },
      {
        path: 'respuesta',
        element: guard('responses.view', <ResponseOrchestrationListPage />),
      },
      {
        path: 'respuesta/:incidentId',
        element: guard('responses.view', <ResponseOrchestrationDetailPage />),
      },
      { path: 'misiones', element: guard('missions.view', <MissionsPage />) },
      { path: 'misiones/:missionId', element: guard('missions.view', <MissionDetailPage />) },
      { path: 'misiones/asignaciones', element: guard('missions.assign', <AssignmentsPage />) },
      { path: 'operaciones/asignaciones', element: <Navigate to="/misiones/asignaciones" replace /> },
      {
        path: 'campo',
        element: guard('missions.view', <FieldCampoLayout />),
        children: [
          { index: true, element: <FieldCampoHomePage /> },
          { path: 'misiones', element: guard('missions.view', <FieldMissionsPage />) },
          { path: 'paquetes', element: guard('offline_packages.download', <FieldPackagesPage />) },
          { path: 'paquetes/:packageId', element: guard('offline_packages.download', <FieldPackageDetailPage />) },
          {
            path: 'paquetes/:packageId/tareas/:taskId',
            element: guard('evidence.submit', <FieldTaskFormPage />),
          },
          { path: 'evidencia-pendiente', element: guard('evidence.submit', <PendingEvidencePage />) },
          { path: 'sincronizacion', element: guard('field_sync.execute', <FieldSyncPage />) },
          { path: 'conflictos', element: guard('field_sync.resolve_conflict', <FieldConflictsPage />) },
        ],
      },
      { path: 'estrategias', element: guard('findings.view', <StrategiesPage />) },
      { path: 'territorio', element: guard('findings.view', <TerritoryPage />) },
      { path: 'tendencias', element: guard('findings.view', <TrendsPage />) },
      { path: 'informes', element: guard('findings.view', <ReportsHubPage />) },
      { path: 'informes/nacional', element: guard('findings.view', <NationalReportPage />) },
      { path: 'informes/incidentes/:incidentId', element: guard('findings.view', <IncidentReportPage />) },
      { path: 'fuentes', element: guard('organization.settings', <IntegrationsPage />) },
      { path: 'conocimiento', element: guard('findings.view', <KnowledgePage />) },
      { path: 'administracion', element: guard('organization.settings', <SettingsPage />) },
      {
        path: 'admin/organizacion',
        element: guard('organization.settings', <OrganizationAdminPage />),
      },
      {
        path: 'admin/organizacion/miembros',
        element: guard('memberships.manage', <OrganizationAdminPage />),
      },
      {
        path: 'admin/organizacion/invitaciones',
        element: guard('users.invite', <OrganizationAdminPage />),
      },
      {
        path: 'admin/organizacion/auditoria',
        element: guard('organization.settings', <OrganizationAdminPage />),
      },
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
