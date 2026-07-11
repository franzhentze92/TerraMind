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
    <div className="mb-6 space-y-4">
      <IntelligenceFlowNavigator
        flow={flowQuery.data}
        isLoading={flowQuery.isLoading}
        isError={flowQuery.isError}
        onRetry={() => flowQuery.refetch()}
      />
      <IntelligenceFlowActionsPanel flow={flowQuery.data} />
    </div>
  )
}
