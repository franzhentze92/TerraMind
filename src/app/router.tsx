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
import { FieldCampoLayout } from '@/modules/field-operations/field-mobile/components/FieldCampoLayout'
import { FieldCampoHomePage } from '@/modules/field-operations/pages/FieldCampoHomePage'
import { FieldConflictsPage } from '@/modules/field-operations/pages/FieldConflictsPage'
import { FieldMissionsPage } from '@/modules/field-operations/pages/FieldMissionsPage'
import { FieldPackagesPage } from '@/modules/field-operations/pages/FieldPackagesPage'
import { FieldPackageDetailPage } from '@/modules/field-operations/pages/FieldPackageDetailPage'
import { FieldSyncPage } from '@/modules/field-operations/pages/FieldSyncPage'
import { FieldTaskFormPage } from '@/modules/field-operations/pages/FieldTaskFormPage'
import { PendingEvidencePage } from '@/modules/field-operations/pages/PendingEvidencePage'

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
      {
        path: 'campo',
        element: <FieldCampoLayout />,
        children: [
          { index: true, element: <FieldCampoHomePage /> },
          { path: 'misiones', element: <FieldMissionsPage /> },
          { path: 'paquetes', element: <FieldPackagesPage /> },
          { path: 'paquetes/:packageId', element: <FieldPackageDetailPage /> },
          { path: 'paquetes/:packageId/tareas/:taskId', element: <FieldTaskFormPage /> },
          { path: 'evidencia-pendiente', element: <PendingEvidencePage /> },
          { path: 'sincronizacion', element: <FieldSyncPage /> },
          { path: 'conflictos', element: <FieldConflictsPage /> },
        ],
      },
      { path: 'estrategias', element: <StrategiesPage /> },
      { path: 'territorio', element: <TerritoryPage /> },
      { path: 'tendencias', element: <TrendsPage /> },
      { path: 'informes', element: <ReportsPage /> },
      { path: 'fuentes', element: <IntegrationsPage /> },
      { path: 'conocimiento', element: <KnowledgePage /> },
      { path: 'administracion', element: <SettingsPage /> },
      {
        path: 'admin/organizacion',
        element: (
          <PermissionRoute permission="organization.settings">
            <OrganizationAdminPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'admin/organizacion/miembros',
        element: (
          <PermissionRoute permission="memberships.manage">
            <OrganizationAdminPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'admin/organizacion/invitaciones',
        element: (
          <PermissionRoute permission="users.invite">
            <OrganizationAdminPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'admin/organizacion/auditoria',
        element: (
          <PermissionRoute permission="organization.settings">
            <OrganizationAdminPage />
          </PermissionRoute>
        ),
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
