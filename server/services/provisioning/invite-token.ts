import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

export function inviteTokensMatch(token: string, tokenHash: string): boolean {
  const computed = hashInviteToken(token)
  const a = Buffer.from(computed, 'utf8')
  const b = Buffer.from(tokenHash, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function buildInvitationAcceptUrl(token: string, baseUrl?: string): string {
  const origin = baseUrl?.trim() || process.env.TERRAMIND_APP_URL?.trim() || 'http://localhost:5173'
  return `${origin.replace(/\/$/, '')}/login?invite=${encodeURIComponent(token)}`
}
