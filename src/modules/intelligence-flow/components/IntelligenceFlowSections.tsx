import { IntelligenceFlowNavigator } from './IntelligenceFlowNavigator'
import { IntelligenceFlowActionsPanel } from './IntelligenceFlowActionsPanel'
import { useIntelligenceFlow } from '../api/intelligence-flow-api'
import type { IntelligenceFlowResourceType } from '../intelligence-flow.types'

export function IntelligenceFlowSections({
  resourceType,
  resourceId,
}: {
  resourceType: IntelligenceFlowResourceType
  resourceId: string | undefined
}) {
  const flowQuery = useIntelligenceFlow(resourceType, resourceId)

  return (
    <div className="mt-4 space-y-4" data-testid="intelligence-flow-sections">
      <IntelligenceFlowActionsPanel flow={flowQuery.data} />
      <IntelligenceFlowNavigator
        collapsible
        flow={flowQuery.data}
        isLoading={flowQuery.isLoading}
        isError={flowQuery.isError}
        onRetry={() => flowQuery.refetch()}
      />
    </div>
  )
}
