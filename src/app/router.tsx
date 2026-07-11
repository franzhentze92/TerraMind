import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import { AppShell } from '@/shared/layouts'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { PermissionRoute } from '@/core/auth/PermissionRoute'
import { AwaitingAccessPage } from '@/modules/auth/pages/AwaitingAccessPage'
import { ForbiddenPage } from '@/modules/auth/pages/ForbiddenPage'
import { OrganizationAdminPage } from '@/modules/admin/pages/OrganizationAdminPage'
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
import { ReportsHubPage } from '@/modules/executive-demo/pages/ReportsHubPage'
import { NationalReportPage } from '@/modules/executive-demo/pages/NationalReportPage'
import { IncidentReportPage } from '@/modules/executive-demo/pages/IncidentReportPage'
import { IncidentStoryPage } from '@/modules/executive-demo/pages/IncidentStoryPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { FireAnalysisPage } from '@/modules/fires/pages/FireAnalysisPage'
import { BiodiversityAnalysisPage } from '@/modules/biodiversity/pages/BiodiversityAnalysisPage'
import { IncidentsPage } from '@/modules/incidents/pages/IncidentsPage'
import { IncidentDetailPage } from '@/modules/incidents/pages/IncidentDetailPage'
import { VerificationsPage } from '@/modules/verification/pages/VerificationsPage'
import { MissionsPage } from '@/modules/missions/pages/MissionsPage'
import { MissionDetailPage } from '@/modules/missions/pages/MissionDetailPage'
import { AssignmentsPage } from '@/modules/missions/pages/AssignmentsPage'
import { FieldCampoLayout } from '@/modules/field-operations/field-mobile/components/FieldCampoLayout'
import { FieldCampoHomePage } from '@/modules/field-operations/pages/FieldCampoHomePage'
import { FieldConflictsPage } from '@/modules/field-operations/pages/FieldConflictsPage'
import { FieldMissionsPage } from '@/modules/field-operations/pages/FieldMissionsPage'
import { FieldPackagesPage } from '@/modules/field-operations/pages/FieldPackagesPage'
import { FieldPackageDetailPage } from '@/modules/field-operations/pages/FieldPackageDetailPage'
import { FieldSyncPage } from '@/modules/field-operations/pages/FieldSyncPage'
import { FieldTaskFormPage } from '@/modules/field-operations/pages/FieldTaskFormPage'
import { PendingEvidencePage } from '@/modules/field-operations/pages/PendingEvidencePage'
import { ResponseOrchestrationListPage } from '@/modules/response-orchestration/pages/ResponseOrchestrationListPage'
import { ResponseOrchestrationDetailPage } from '@/modules/response-orchestration/pages/ResponseOrchestrationDetailPage'
import type { TerramindPermission } from '@/core/auth/permissions'
import type { ReactNode } from 'react'

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
      { path: 'copilot', element: guard('findings.view', <CopilotPage />) },
      { path: 'hallazgos', element: guard('findings.view', <FindingsPage />) },
      { path: 'hallazgos/:findingId', element: guard('findings.view', <FindingDetailPage />) },
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
