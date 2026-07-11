declare module 'shapefile' {
  export function open(
    shp: string | ArrayBuffer | Uint8Array,
    dbf?: string | ArrayBuffer | Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<{ read: () => Promise<{ done: boolean; value?: { type: string; properties: Record<string, unknown>; geometry: unknown } }> }>

  export function read(
    shp: string | ArrayBuffer | Uint8Array,
    dbf?: string | ArrayBuffer | Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<Array<{ type: string; properties: Record<string, unknown>; geometry: unknown }>>
}
