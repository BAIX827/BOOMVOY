import type { Cuisine, DecisionCandidate, DecisionPreferences } from './decisionTypes'

export type DecisionSearchErrorCode = 'unavailable' | 'rate_limited' | 'timeout' | 'failed' | 'invalid'
export class DecisionSearchError extends Error {
  constructor(public readonly code: DecisionSearchErrorCode) { super(code); this.name = 'DecisionSearchError' }
}
export { DecisionSearchError as DecisionProviderError }
const CUISINES: Cuisine[] = ['any', 'mexican', 'japanese', 'italian', 'thai', 'chinese', 'indian', 'korean', 'vietnamese', 'local']
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : undefined
}
function webUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}
function mapsUrl(value: unknown): string | undefined {
  const safe = webUrl(value)
  if (!safe) return undefined
  const url = new URL(safe)
  return url.protocol === 'https:' && (url.hostname === 'maps.google.com' || url.hostname === 'www.google.com' && url.pathname.startsWith('/maps') || url.hostname === 'maps.app.goo.gl') ? safe : undefined
}
function timestamp(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined
}

export function decisionSearchEndpoint(endpoint = '/api/decisions/search'): string {
  const input = endpoint.trim()
  if (!input || input.length > 2048 || /[\s\\]/.test(input) || input.startsWith('//')) throw new DecisionSearchError('invalid')
  if (input.startsWith('/')) return input
  try {
    const url = new URL(input)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.username || url.password || url.hash || url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('invalid')
    return url.href
  } catch { throw new DecisionSearchError('invalid') }
}

export function validateDecisionCandidate(value: unknown, preferences: DecisionPreferences, fetchedAt: string): DecisionCandidate | undefined {
  if (!object(value) || value.source !== 'google' || value.kind !== preferences.kind) return undefined
  const id = text(value.id, 300), name = text(value.name, 250), city = text(value.city, 120), sourceUrl = mapsUrl(value.sourceUrl)
  if (!id || !/^google:[A-Za-z0-9_-]+$/.test(id) || !name || !city || !sourceUrl) return undefined
  const rating = object(value.rating) && finite(value.rating.value, 1, 5) && mapsUrl(value.rating.sourceUrl)
    ? { value: value.rating.value, sourceUrl: mapsUrl(value.rating.sourceUrl)!,
      ...(Number.isInteger(value.rating.count) && finite(value.rating.count, 0, 100000000) ? { count: value.rating.count } : {}) } : undefined
  const rawPrice = value.price
  const price = preferences.kind === 'restaurant' && object(rawPrice) && rawPrice.basis === 'person'
    && typeof rawPrice.currency === 'string' && /^[A-Z]{3}$/.test(rawPrice.currency) && finite(rawPrice.max, 0.01, 100000000)
    && (rawPrice.min === undefined || finite(rawPrice.min, 0, rawPrice.max))
    ? { max: rawPrice.max, currency: rawPrice.currency, basis: 'person' as const, ...(finite(rawPrice.min, 0, rawPrice.max) ? { min: rawPrice.min } : {}) } : undefined
  const attributions = Array.isArray(value.attributions) ? value.attributions.slice(0, 20).flatMap(item => {
    if (!object(item)) return []
    const name = text(item.name, 250)
    return name ? [{ name, ...(webUrl(item.url) ? { url: webUrl(item.url) } : {}) }] : []
  }) : []
  return { id, kind: preferences.kind, name, city, source: 'google', sourceUrl,
    address: text(value.address, 500), checkedAt: timestamp(value.checkedAt) || fetchedAt,
    websiteUrl: webUrl(value.websiteUrl), bookingUrl: webUrl(value.bookingUrl), mapsUrl: mapsUrl(value.mapsUrl) || sourceUrl,
    cuisines: Array.isArray(value.cuisines) ? value.cuisines.filter((item): item is Cuisine => typeof item === 'string' && CUISINES.includes(item as Cuisine)).slice(0, 10) : [],
    parking: ['free', 'paid', 'available', 'none'].includes(String(value.parking)) ? value.parking as DecisionCandidate['parking'] : 'unknown',
    seaView: 'unknown', price, rating, attributions }
}

export async function fetchDecisionCandidates(preferences: DecisionPreferences, locale: 'zh' | 'en', endpoint = '/api/decisions/search', signal?: AbortSignal): Promise<DecisionCandidate[]> {
  const url = decisionSearchEndpoint(endpoint)
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
  const controller = new AbortController()
  const abort = () => controller.abort()
  let timedOut = false
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 12000)
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences, locale }), signal: controller.signal, cache: 'no-store', redirect: 'error', credentials: 'same-origin' })
    if (!response.ok) throw new DecisionSearchError(response.status === 503 || response.status === 404 ? 'unavailable' : response.status === 429 ? 'rate_limited' : response.status === 504 ? 'timeout' : 'failed')
    if (!response.headers.get('content-type')?.includes('application/json')) throw new DecisionSearchError('unavailable')
    if (Number(response.headers.get('content-length') || 0) > 256 * 1024) throw new DecisionSearchError('invalid')
    const raw = await response.text()
    if (raw.length > 256 * 1024) throw new DecisionSearchError('invalid')
    const data: unknown = JSON.parse(raw)
    if (!object(data) || data.source !== 'google' || !Array.isArray(data.candidates) || data.candidates.length > 20) throw new DecisionSearchError('invalid')
    const fetchedAt = timestamp(data.fetchedAt)
    if (!fetchedAt) throw new DecisionSearchError('invalid')
    const seen = new Set<string>()
    const candidates = data.candidates.flatMap(item => {
      const candidate = validateDecisionCandidate(item, preferences, fetchedAt)
      if (!candidate || seen.has(candidate.id)) return []
      seen.add(candidate.id); return [candidate]
    })
    if (data.candidates.length && !candidates.length) throw new DecisionSearchError('invalid')
    return candidates
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
    if (timedOut) throw new DecisionSearchError('timeout')
    if (error instanceof DecisionSearchError) throw error
    throw new DecisionSearchError('failed')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
