import { create } from 'zustand'
import type { TerritoryContext } from '@/intelligence/types'
import { APP_CONFIG } from '@/core/config'

interface TerritoryState {
  territory: TerritoryContext
  setTerritory: (territory: TerritoryContext) => void
}

export const useTerritoryStore = create<TerritoryState>((set) => ({
  territory: {
    ...APP_CONFIG.defaultTerritory,
    activeSince: new Date().toISOString(),
  },
  setTerritory: (territory) => set({ territory }),
}))
