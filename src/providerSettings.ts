import { backendEndpoint, type BackendConfig } from './llm'
import { advanceProviderConfiguration } from './providerGeneration'

export type ProviderName = 'openai' | 'google'
export type ProviderStatus = { configured: boolean; source: 'saved' | 'environment' | 'none' }
export type ProviderSettings = {
  editable: true
  csrfToken: string
  openai: ProviderStatus
  google: ProviderStatus
}
export type ProviderSettingsPatch = { openaiApiKey?: string | null; googleApiKey?: string | null }
export type ProviderSettingsErrorCode = 'localOnly' | 'unavailable' | 'invalidResponse' | 'invalidKey' | 'forbidden' | 'refresh' | 'openaiEndpoint' | 'failed'

export class ProviderSettingsError extends Error {
  constructor(readonly code: ProviderSettingsErrorCode) {
    super(code)
    this.name = 'ProviderSettingsError'
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

function localUrl(url: URL) {
  return LOCAL_HOSTS.has(url.hostname) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
}

export function providerSettingsEndpoint(backend: BackendConfig, pageUrl = globalThis.location?.href ?? ''): string {
  try {
    const page = new URL(pageUrl)
    if (!localUrl(page) || !backend.ready) throw new Error()
    const endpoint = new URL(backendEndpoint(backend.baseUrl, '/settings/providers'), page)
    if (!localUrl(endpoint) || endpoint.search || endpoint.hash) throw new Error()
    return endpoint.href
  } catch {
    throw new ProviderSettingsError('localOnly')
  }
}

function providerStatus(value: unknown): ProviderStatus {
  if (!isRecord(value) || typeof value.configured !== 'boolean' || !['saved', 'environment', 'none'].includes(String(value.source))
    || value.configured !== (value.source !== 'none')) throw new ProviderSettingsError('invalidResponse')
  return { configured: value.configured, source: value.source as ProviderStatus['source'] }
}

function settingsResponse(value: unknown): ProviderSettings {
  if (!isRecord(value) || value.editable !== true || typeof value.csrfToken !== 'string' || value.csrfToken.length < 16 || value.csrfToken.length > 512
    || /[\r\n]/.test(value.csrfToken)) throw new ProviderSettingsError('invalidResponse')
  // Only status metadata reaches component state. Never retain unexpected response fields.
  return { editable: true, csrfToken: value.csrfToken, openai: providerStatus(value.openai), google: providerStatus(value.google) }
}

function normalizePatch(patch: ProviderSettingsPatch): ProviderSettingsPatch {
  const clean: ProviderSettingsPatch = {}
  for (const key of ['openaiApiKey', 'googleApiKey'] as const) {
    const value = patch[key]
    if (value === undefined) continue
    if (value === null) { clean[key] = null; continue }
    if (typeof value !== 'string') throw new ProviderSettingsError('invalidKey')
    const trimmed = value.trim()
    const pattern = key === 'openaiApiKey' ? /^sk-[A-Za-z0-9_-]+$/ : /^AIza[A-Za-z0-9_-]+$/
    if (trimmed.length < 32 || trimmed.length > 512 || !pattern.test(trimmed)) throw new ProviderSettingsError('invalidKey')
    clean[key] = trimmed
  }
  if (!Object.keys(clean).length) throw new ProviderSettingsError('invalidKey')
  return clean
}

async function requestSettings(endpoint: string, init: RequestInit, signal?: AbortSignal): Promise<ProviderSettings> {
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(endpoint, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      credentials: 'same-origin',
      signal: controller.signal,
    })
    if (!response.headers.get('content-type')?.includes('application/json')) throw new ProviderSettingsError('unavailable')
    const data: unknown = await response.json()
    if (!response.ok) {
      if (isRecord(data) && data.error === 'settings_openai_endpoint') throw new ProviderSettingsError('openaiEndpoint')
      if (isRecord(data) && data.error === 'settings_token_invalid') throw new ProviderSettingsError('refresh')
      if (isRecord(data) && data.error === 'settings_local_only') throw new ProviderSettingsError('localOnly')
      if (response.status === 400 || response.status === 422) throw new ProviderSettingsError('invalidKey')
      if (response.status === 401 || response.status === 403) throw new ProviderSettingsError('forbidden')
      if (response.status === 409) throw new ProviderSettingsError('refresh')
      if (response.status === 404 || response.status >= 500) throw new ProviderSettingsError('unavailable')
      throw new ProviderSettingsError('failed')
    }
    return settingsResponse(data)
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
    if (error instanceof ProviderSettingsError) throw error
    throw new ProviderSettingsError('unavailable')
  } finally {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

export function loadProviderSettings(backend: BackendConfig, signal?: AbortSignal, pageUrl?: string): Promise<ProviderSettings> {
  return requestSettings(providerSettingsEndpoint(backend, pageUrl), { method: 'GET', headers: { Accept: 'application/json' } }, signal)
}

export function saveProviderSettings(backend: BackendConfig, csrfToken: string, patch: ProviderSettingsPatch, signal?: AbortSignal, pageUrl?: string): Promise<ProviderSettings> {
  const endpoint = providerSettingsEndpoint(backend, pageUrl)
  if (!csrfToken || csrfToken.length > 512 || /[\r\n]/.test(csrfToken)) throw new ProviderSettingsError('refresh')
  return requestSettings(endpoint, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Boomvoy-Settings-Token': csrfToken },
    body: JSON.stringify(normalizePatch(patch)),
  }, signal).then((settings) => {
    advanceProviderConfiguration()
    return settings
  })
}
