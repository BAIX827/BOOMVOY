import { backendEndpoint, type BackendConfig } from './llm'
import type { Profile, Trip } from './types'
import { isSyncSnapshot, sanitizeTripForSync, type SyncSnapshot } from './syncSchema'

export const SYNC_SCHEMA_VERSION = 1
const SYNC_META_KEY = 'boomvoy-sync-meta-v1'
const MAX_SYNC_BYTES = 4 * 1024 * 1024
const memoryMeta = new Map<string, SyncMeta>()

type SyncMeta = { remoteRevision: number; etag: string }
export type SyncSuccess = { ok: true; revision: number; updatedAt: string | null; etag: string; snapshot?: SyncSnapshot | null }
export type SyncConflict = { ok: false; code: 'revision_conflict' | 'idempotency_key_reused'; revision: number; etag: string; snapshot: SyncSnapshot | null }

function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createSyncSnapshot(profile: Profile, trips: Trip[]): SyncSnapshot {
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    profile: {
      name: profile.name,
      homeCity: profile.homeCity,
      homeCurrency: profile.homeCurrency,
      themePref: profile.themePref,
      ...(profile.locale ? { locale: profile.locale } : {}),
    },
    trips: trips.filter((trip) => !trip.template).map(sanitizeTripForSync),
  }
}

export function restoreLocalPhotos(remoteTrips: Trip[], localTrips: Trip[]): Trip[] {
  const photos = new Map<string, string[]>()
  for (const trip of localTrips) for (const day of trip.days) for (const variant of ['A', 'B'] as const) {
    const plan = variant === 'A' ? day.planA : day.planB
    for (const place of plan) if (place.photos?.length) photos.set(JSON.stringify([trip.id, day.id, variant, place.id]), place.photos)
  }
  return jsonCopy(remoteTrips).map((trip) => ({
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      planA: day.planA.map((place) => ({ ...place, photos: photos.get(JSON.stringify([trip.id, day.id, 'A', place.id])) })),
      planB: day.planB.map((place) => ({ ...place, photos: photos.get(JSON.stringify([trip.id, day.id, 'B', place.id])) })),
    })),
  }))
}

function metaKey(baseUrl: string) {
  return `${SYNC_META_KEY}:${encodeURIComponent(baseUrl)}`
}

function readMeta(baseUrl: string): SyncMeta {
  const key = metaKey(baseUrl)
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || '')
    if (value && typeof value === 'object' && Number.isSafeInteger((value as SyncMeta).remoteRevision)
      && (value as SyncMeta).remoteRevision >= 0 && typeof (value as SyncMeta).etag === 'string') return value as SyncMeta
  } catch { /* use a fresh revision */ }
  return memoryMeta.get(key) || { remoteRevision: 0, etag: '"r0"' }
}

function writeMeta(baseUrl: string, revision: number, etag = `"r${revision}"`) {
  const key = metaKey(baseUrl), value = { remoteRevision: revision, etag }
  memoryMeta.set(key, value)
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* keep the tab-local in-memory revision */ }
}

export function acceptDownloadedSnapshot(backend: BackendConfig, revision: number, etag: string) {
  if (!backend.ready || !Number.isSafeInteger(revision) || revision < 0 || etag !== `"r${revision}"`) throw new Error('invalid sync revision')
  writeMeta(backend.baseUrl, revision, etag)
}

function authHeaders(token: string) {
  const value = token.trim()
  const bytes = new TextEncoder().encode(value).byteLength
  if (bytes < 32 || bytes > 512 || /\s/.test(value)) throw new Error('invalid sync token')
  return { Authorization: `Bearer ${value}` }
}

function idempotencyKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `fallback-${[...bytes].map(value => value.toString(16).padStart(2, '0')).join('')}`
}

async function syncFetch(url: string, init: RequestInit, signal?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = globalThis.setTimeout(abort, 30_000)
  try { return await fetch(url, { ...init, signal: controller.signal }) }
  finally {
    globalThis.clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

async function readBoundedText(response: Response) {
  const maxBytes = MAX_SYNC_BYTES + 65_536
  const declaredSize = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) throw new Error('invalid sync response')
  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('invalid sync response')
    return text
  }
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new Error('invalid sync response')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('invalid sync response')
  const text = await readBoundedText(response)
  let value: unknown
  try { value = JSON.parse(text) }
  catch { throw new Error('invalid sync response') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid sync response')
  return value as Record<string, unknown>
}

function responseEtag(response: Response, revision: number) {
  const etag = response.headers.get('etag')
  if (etag !== `"r${revision}"`) throw new Error('invalid sync response')
  return etag
}

function responseUpdatedAt(value: unknown, revision: number): string | null {
  if (revision === 0 ? value !== null : typeof value !== 'string') throw new Error('invalid sync response')
  return value as string | null
}

function responseSnapshot(value: unknown): SyncSnapshot | null {
  if (value === null) return null
  if (!isSyncSnapshot(value)) throw new Error('invalid sync response')
  return value
}

export async function uploadSnapshot(backend: BackendConfig, token: string, snapshot: SyncSnapshot, signal?: AbortSignal): Promise<SyncSuccess | SyncConflict> {
  if (!backend.ready) throw new Error('backend unavailable')
  const meta = readMeta(backend.baseUrl)
  const body = JSON.stringify(snapshot)
  if (new TextEncoder().encode(body).byteLength > MAX_SYNC_BYTES) throw new Error('snapshot too large')
  if (!isSyncSnapshot(snapshot)) throw new Error('invalid sync snapshot')
  const response = await syncFetch(backendEndpoint(backend.baseUrl, '/v1/me/snapshot'), {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
      'If-Match': meta.etag,
      'Idempotency-Key': idempotencyKey(),
    },
    body,
    cache: 'no-store',
    redirect: 'error',
    credentials: 'same-origin',
  }, signal)
  const data = await readJson(response)
  if (response.status === 409 && (data.code === 'revision_conflict' || data.code === 'idempotency_key_reused')
    && data.schemaVersion === SYNC_SCHEMA_VERSION && Number.isSafeInteger(data.revision) && (data.revision as number) >= 0) {
    const revision = data.revision as number
    const snapshot = responseSnapshot(data.snapshot ?? null)
    if (revision === 0 ? snapshot !== null : snapshot === null) throw new Error('invalid sync response')
    responseUpdatedAt(data.updatedAt, revision)
    return { ok: false, code: data.code, revision, etag: responseEtag(response, revision), snapshot }
  }
  if (!response.ok || data.schemaVersion !== SYNC_SCHEMA_VERSION || !Number.isSafeInteger(data.revision)
    || (data.revision as number) < 1 || data.ok !== true) throw new Error(String(data.error || 'sync failed'))
  const revision = data.revision as number
  const etag = responseEtag(response, revision)
  const updatedAt = responseUpdatedAt(data.updatedAt, revision)
  writeMeta(backend.baseUrl, revision, etag)
  return { ok: true, revision, etag, updatedAt }
}

export async function downloadSnapshot(backend: BackendConfig, token: string, signal?: AbortSignal): Promise<SyncSuccess> {
  if (!backend.ready) throw new Error('backend unavailable')
  const response = await syncFetch(backendEndpoint(backend.baseUrl, '/v1/me/snapshot'), {
    headers: authHeaders(token),
    cache: 'no-store',
    redirect: 'error',
    credentials: 'same-origin',
  }, signal)
  const data = await readJson(response)
  if (!response.ok || data.schemaVersion !== SYNC_SCHEMA_VERSION || !Number.isSafeInteger(data.revision)
    || (data.revision as number) < 0) throw new Error(String(data.error || 'sync failed'))
  const revision = data.revision as number
  const snapshot = responseSnapshot(data.snapshot ?? null)
  if (revision === 0 ? snapshot !== null : snapshot === null) throw new Error('invalid sync response')
  const updatedAt = responseUpdatedAt(data.updatedAt, revision)
  return {
    ok: true,
    revision,
    etag: responseEtag(response, revision),
    updatedAt,
    snapshot,
  }
}
