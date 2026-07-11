import { Badge } from '@/shared/components/Badge'
import {
  RESPONSE_BADGE_LABELS,
  type ResponseBadgeKey,
} from '@/modules/response-orchestration/utils/response-status-labels'

const BADGE_VARIANT: Record<ResponseBadgeKey, 'default' | 'warning' | 'success' | 'danger'> = {
  monitoreo: 'default',
  verificacion_adicional: 'warning',
  respuesta_interna: 'warning',
  seguimiento_operacional: 'default',
  revision_autorizada: 'success',
  pendiente_decision: 'warning',
  accion_en_curso: 'warning',
  cierre_recomendado: 'success',
  bloqueado_incertidumbre: 'danger',
  ownership_unresolved: 'danger',
}

export function ResponseStatusBadge({ badge }: { badge: string }) {
  const key = (badge in RESPONSE_BADGE_LABELS ? badge : 'pendiente_decision') as ResponseBadgeKey
  return <Badge variant={BADGE_VARIANT[key]}>{RESPONSE_BADGE_LABELS[key]}</Badge>
}
