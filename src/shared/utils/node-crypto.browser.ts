/**
 * Browser shim for `node:crypto` — used via Vite alias in client bundles only.
 */
import { hmac as nobleHmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils.js'

type HashInput = string | Uint8Array

function toBytes(data: HashInput): Uint8Array {
  return typeof data === 'string' ? utf8ToBytes(data) : data
}

class HashStream {
  private chunks: Uint8Array[] = []

  update(data: HashInput): this {
    this.chunks.push(toBytes(data))
    return this
  }

  digest(encoding?: 'hex' | 'base64'): string {
    const hash = sha256(concatBytes(...this.chunks))
    if (encoding === 'hex') return bytesToHex(hash)
    if (encoding === 'base64') return btoa(String.fromCharCode(...hash))
    return bytesToHex(hash)
  }
}

class HmacStream {
  private chunks: Uint8Array[] = []

  constructor(private key: Uint8Array) {}

  update(data: HashInput): this {
    this.chunks.push(toBytes(data))
    return this
  }

  digest(encoding?: 'hex'): string {
    const hash = nobleHmac(sha256, this.key, concatBytes(...this.chunks))
    if (encoding === 'hex') return bytesToHex(hash)
    return bytesToHex(hash)
  }
}

export function createHash(algorithm: string): HashStream {
  if (algorithm !== 'sha256') throw new Error(`Unsupported hash algorithm: ${algorithm}`)
  return new HashStream()
}

export function createHmac(algorithm: string, key: HashInput): HmacStream {
  if (algorithm !== 'sha256') throw new Error(`Unsupported HMAC algorithm: ${algorithm}`)
  return new HmacStream(toBytes(key))
}

export function randomUUID(): string {
  return crypto.randomUUID()
}

export function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytes
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}
