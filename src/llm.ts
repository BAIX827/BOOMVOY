import { RequestCache } from './requestCache'

type BackendProfile = { backendUrl?: string }

export type BackendConfig = {
  baseUrl: string
  ready: boolean
  fromEnv: boolean
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const boomiReplyCache = new RequestCache<string>({ ttlMs: 10 * 60 * 1000, maxEntries: 40 })

export function normalizeBackendUrl(value: string): string {
  const input = value.trim().replace(/\/+$/, '')
  if (!input) return ''
  if (input.startsWith('/') && !input.startsWith('//') && !/[\\\s?#]/.test(input)) return input
  try {
    const url = new URL(input)
    const local = LOCAL_HOSTS.has(url.hostname)
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return ''
    return url.href.replace(/\/$/, '')
  } catch {
    return ''
  }
}

export function resolveBackend(profile: BackendProfile): BackendConfig {
  const envUrl = import.meta.env.VITE_BOOMVOY_API_URL || '/api'
  const configured = profile.backendUrl || envUrl
  const baseUrl = normalizeBackendUrl(configured)
  return { baseUrl, ready: Boolean(baseUrl), fromEnv: !profile.backendUrl }
}

export function backendEndpoint(baseUrl: string, path: string): string {
  const base = normalizeBackendUrl(baseUrl)
  if (!base || !path.startsWith('/') || path.startsWith('//')) throw new Error('invalid backend endpoint')
  return `${base}${path}`
}

async function postBackend<T>(url: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
      credentials: 'same-origin',
    })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`Backend ${response.status}`)
    return await response.json() as T
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export async function askBoomi(
  backend: BackendConfig,
  question: string,
  locale: 'zh' | 'en',
  page: string,
) {
  if (!backend.ready) throw new Error('backend unavailable')
  const normalizedQuestion = question.trim()
  const key = JSON.stringify([backend.baseUrl, locale, page, normalizedQuestion])
  return boomiReplyCache.getOrCreate(key, async () => {
    const data = await postBackend<{ text?: unknown }>(backendEndpoint(backend.baseUrl, '/ai/chat'), {
      question: normalizedQuestion,
      locale,
      page,
    }, 35_000)
    const text = typeof data.text === 'string' ? data.text.trim() : ''
    if (!text || text.length > 2_000) throw new Error('invalid backend response')
    return text
  })
}
