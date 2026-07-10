import type {
  BiodiversityOccurrence,
  BiodiversityProviderHealth,
  BiodiversityProviderId,
  BiodiversitySearchQuery,
  BiodiversitySearchResult,
  BiodiversityTaxon,
  BiodiversityTaxonResolveInput,
} from './biodiversity.types'

export interface BiodiversityProvider {
  readonly id: BiodiversityProviderId

  searchOccurrences(query: BiodiversitySearchQuery): Promise<BiodiversitySearchResult>

  getOccurrence(id: string): Promise<BiodiversityOccurrence | null>

  resolveTaxon(input: BiodiversityTaxonResolveInput): Promise<BiodiversityTaxon | null>

  getTaxon(id: string): Promise<BiodiversityTaxon | null>

  healthCheck(): Promise<BiodiversityProviderHealth>
}
