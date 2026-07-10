import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  postMissionWorkflow,
  type MissionWorkflowAction,
  type MissionWorkflowPayload,
} from '../api/missions-api'

export function useMissionWorkflow(missionId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      action,
      payload,
    }: {
      action: MissionWorkflowAction
      payload?: MissionWorkflowPayload
    }) => postMissionWorkflow(missionId!, action, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission', missionId] })
      queryClient.invalidateQueries({ queryKey: ['missions'] })
    },
  })
}
