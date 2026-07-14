import type { NewsSourceConnector } from '../connectors/news-source-connector'
import { EmisorasUnidasConnector } from '../sources/emisoras-unidas/emisoras-unidas.connector'
import { PrensaLibreConnector } from '../sources/prensa-libre/prensa-libre.connector'

const CONNECTORS: Record<string, NewsSourceConnector> = {
  prensa_libre_gt: new PrensaLibreConnector(),
  emisoras_unidas_gt: new EmisorasUnidasConnector(),
}

export function getNewsConnector(code: string): NewsSourceConnector {
  const connector = CONNECTORS[code]
  if (!connector) throw new Error(`Conector no registrado: ${code}`)
  return connector
}

export function listRegisteredConnectors(): string[] {
  return Object.keys(CONNECTORS)
}
