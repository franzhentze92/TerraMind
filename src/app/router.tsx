import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/shared/layouts'
import { NationalSituationPage } from '@/modules/national-center/pages/NationalSituationPage'
import { CopilotPage } from '@/modules/copilot/pages/CopilotPage'
import { FindingsPage } from '@/modules/findings/pages/FindingsPage'
import { PrioritiesPage } from '@/modules/priorities/pages/PrioritiesPage'
import { TerritoryPage } from '@/modules/territory/pages/TerritoryPage'
import { StrategiesPage } from '@/modules/strategies/pages/StrategiesPage'
import { KnowledgePage } from '@/modules/knowledge/pages/KnowledgePage'
import { IntegrationsPage } from '@/modules/integrations/pages/IntegrationsPage'
import { TrendsPage } from '@/modules/trends/pages/TrendsPage'
import { ReportsPage } from '@/modules/reports/pages/ReportsPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { FireAnalysisPage } from '@/modules/fires/pages/FireAnalysisPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/situacion" replace /> },
      { path: 'situacion', element: <NationalSituationPage /> },
      { path: 'incendios', element: <FireAnalysisPage /> },
      { path: 'incendios/:eventId', element: <FireAnalysisPage /> },
      { path: 'copilot', element: <CopilotPage /> },
      { path: 'hallazgos', element: <FindingsPage /> },
      { path: 'prioridades', element: <PrioritiesPage /> },
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
