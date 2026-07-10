import type {
  ClimateCurrentConditions,
  ClimateDailyPoint,
  ClimateHourlyPoint,
  ClimateLocation,
  ClimateProviderHealth,
  ClimateProviderId,
} from './climate.types'

export interface ClimateProvider {
  readonly id: ClimateProviderId

  getCurrentConditions(location: ClimateLocation): Promise<ClimateCurrentConditions>

  getHourlyForecast(location: ClimateLocation, hours: number): Promise<ClimateHourlyPoint[]>

  getDailyForecast(location: ClimateLocation, days: number): Promise<ClimateDailyPoint[]>

  getHistoricalWeather(
    location: ClimateLocation,
    from: string,
    to: string,
  ): Promise<ClimateHourlyPoint[]>

  healthCheck(): Promise<ClimateProviderHealth>
}
