export type IntelligenceFlowStage =
  | 'finding'
  | 'priority'
  | 'incident'
  | 'verification'
  | 'mission'
  | 'evidence'
  | 'resolution'
  | 'response'
  | 'report'

export type IntelligenceFlowNodeStatus =
  | 'available'
  | 'pending'
  | 'not_required'
  | 'blocked'
  | 'missing'
  | 'legacy'
  | 'demo'

export type IntelligenceFlowResourceType =
  | 'finding'
  | 'priority'
  | 'incident'
  | 'mission'
  | 'evidence'
  | 'response'

export interface IntelligenceFlowNode {
  stage: IntelligenceFlowStage
  resourceId?: string
  status: IntelligenceFlowNodeStatus
  label: string
  summary?: string
  route?: string
  blockingReason?: string
  classification?: 'operational' | 'legacy' | 'demo'
}

export interface IntelligenceFlowDto {
  resource_type: IntelligenceFlowResourceType
  resource_id: string
  current_stage: IntelligenceFlowStage
  classification: 'operational' | 'legacy' | 'demo'
  nodes: IntelligenceFlowNode[]
  generated_at: string
}

export interface IntelligenceFlowAction {
  id: string
  label: string
  route?: string
  explanation?: string
  permission?: string
  disabled?: boolean
}
