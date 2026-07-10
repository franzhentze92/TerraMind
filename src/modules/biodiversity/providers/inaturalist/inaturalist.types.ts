export interface InatTaxon {
  id: number
  name?: string
  rank?: string
  rank_level?: number
  preferred_common_name?: string
  iconic_taxon_name?: string
  ancestry?: string
  default_photo?: { url?: string }
  wikipedia_url?: string
  matched_term?: string
  is_active?: boolean
}

export interface InatUser {
  id: number
  login?: string
  name?: string
}

export interface InatObservation {
  id: number
  uuid?: string
  observed_on?: string
  time_observed_at?: string
  created_at?: string
  updated_at?: string
  quality_grade?: 'research' | 'needs_id' | 'casual' | string
  captive?: boolean
  latitude?: number | null
  longitude?: number | null
  positional_accuracy?: number | null
  geoprivacy?: 'open' | 'obscured' | 'private' | string | null
  taxon_geoprivacy?: 'open' | 'obscured' | 'private' | string | null
  obscured?: boolean
  private_place_guess?: string | null
  place_guess?: string | null
  taxon?: InatTaxon
  user?: InatUser
  license_code?: string | null
  uri?: string
  url?: string
  site_id?: number
  oauth_application_id?: number | null
  out_of_range?: boolean | null
  location?: [number, number] | null
  geojson?: { type: string; coordinates: [number, number] } | null
  identification_count?: number
  comments_count?: number
  photos?: Array<{ url?: string }>
  sounds?: Array<{ file_url?: string }>
  ofvs?: Array<{ name: string; value: string }>
}

export interface InatObservationSearchResponse {
  total_results: number
  page: number
  per_page: number
  results: InatObservation[]
}

export interface InatTaxonSearchResponse {
  total_results: number
  page: number
  per_page: number
  results: InatTaxon[]
}

export class InaturalistApiError extends Error {
  readonly code: 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK' | 'RATE_LIMIT' | 'PARSE_ERROR'
  readonly status?: number

  constructor(code: InaturalistApiError['code'], message: string, status?: number) {
    super(message)
    this.name = 'InaturalistApiError'
    this.code = code
    this.status = status
  }
}
