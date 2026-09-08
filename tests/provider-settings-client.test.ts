import assert from 'node:assert/strict'
import { loadProviderSettings, providerSettingsEndpoint, ProviderSettingsError, saveProviderSettings } from '../src/providerSettings'
import { providerConfigurationRevision } from '../src/providerGeneration'
import type { BackendConfig } from '../src/llm'

const backend: BackendConfig = { baseUrl: '/api', ready: true, fromEnv: true }
const page = 'http://127.0.0.1:5173/profile'
const token = 'test-csrf-token-0123456789'
const openaiKey = 'sk-placeholder-for-local-testing-only'
const googleKey = 'AIza-placeholder-for-local-testing-only'
const metadata = {
  editable: true,
  csrfToken: token,
  openai: { configured: false, source: 'none' },
  google: { configured: true, source: 'environment' },
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const code = (expected: string) => (error: unknown) => error instanceof ProviderSettingsError && error.code === expected

assert.equal(providerSettingsEndpoint(backend, page), 'http://127.0.0.1:5173/api/settings/providers')
assert.equal(providerSettingsEndpoint({ ...backend, baseUrl: 'http://localhost:8787/api' }, page), 'http://localhost:8787/api/settings/providers')
assert.equal(providerSettingsEndpoint({ ...backend, baseUrl: 'http://[::1]:8787/api' }, 'http://[::1]:5173'), 'http://[::1]:8787/api/settings/providers')
for (const url of ['https://api.example.com/api', '//api.example.com/api', 'http://localhost.example.com/api', 'http://user:secret@localhost/api', '/api?destination=remote', '/api#hash', 'file:///api']) {
  assert.throws(() => providerSettingsEndpoint({ ...backend, baseUrl: url }, page), code('localOnly'), `Reject unsafe backend ${url}`)
}
for (const url of ['https://boomvoy.example.com/profile', 'http://user:secret@localhost/profile', 'file:///profile', '']) {
  assert.throws(() => providerSettingsEndpoint(backend, url), code('localOnly'), 'A remote page cannot submit keys even to a local backend')
}
assert.throws(() => providerSettingsEndpoint({ ...backend, ready: false }, page), code('localOnly'))

const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let storageAccess = 0
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { storageAccess += 1; throw new Error('Key settings must not access browser persistence') } })
let calls = 0
try {
  globalThis.fetch = async (url, init) => {
    calls += 1
    assert.equal(String(url), 'http://127.0.0.1:5173/api/settings/providers')
    assert.equal(init?.method, 'GET')
    assert.equal(init?.body, undefined)
    assert.equal(init?.cache, 'no-store')
    assert.equal(init?.redirect, 'error')
    assert.equal(init?.credentials, 'same-origin')
    return response({ ...metadata, openaiApiKey: 'must-not-retain', google: { ...metadata.google, key: 'must-not-retain' } })
  }
  const initialRevision = providerConfigurationRevision()
  assert.deepEqual(await loadProviderSettings(backend, undefined, page), metadata, 'Only status metadata is retained, never unexpected keys')
  assert.equal(providerConfigurationRevision(), initialRevision, 'Reading configuration does not invalidate recommendation caches')
  const beforeBlocked = calls
  assert.throws(() => saveProviderSettings({ ...backend, baseUrl: 'https://remote.example.com/api' }, token, { openaiApiKey: 'secret' }, undefined, page), code('localOnly'))
  assert.equal(calls, beforeBlocked, 'An unsafe destination is rejected before fetch receives any key')

  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.method, 'PUT')
    assert.deepEqual(JSON.parse(String(init?.body)), { openaiApiKey: openaiKey })
    assert.equal(new Headers(init?.headers).get('X-Boomvoy-Settings-Token'), token)
    assert.equal(new Headers(init?.headers).get('Content-Type'), 'application/json')
    assert.equal(init?.cache, 'no-store')
    assert.equal(init?.redirect, 'error')
    assert.equal(init?.credentials, 'same-origin')
    return response({ ...metadata, openai: { configured: true, source: 'saved' } })
  }
  await saveProviderSettings(backend, token, { openaiApiKey: `  ${openaiKey}  ` }, undefined, page)
  assert.equal(providerConfigurationRevision(), initialRevision + 1, 'A successful save switches later requests to a fresh cache generation')

  globalThis.fetch = async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { googleApiKey: null }, 'Remove is explicit and leaves the other provider unchanged')
    return response(metadata)
  }
  await saveProviderSettings(backend, token, { googleApiKey: null }, undefined, page)
  assert.equal(providerConfigurationRevision(), initialRevision + 2)
  for (const value of ['', '  ', 'key with spaces', 'key\nline', 'x'.repeat(513), 'AIza-wrong-provider-placeholder-for-tests', 'sk-short']) {
    assert.throws(() => saveProviderSettings(backend, token, { openaiApiKey: value }, undefined, page), code('invalidKey'))
  }
  assert.throws(() => saveProviderSettings(backend, token, {}, undefined, page), code('invalidKey'))
  assert.throws(() => saveProviderSettings(backend, 'bad\r\nheader', { googleApiKey: 'value' }, undefined, page), code('refresh'))

  for (const [status, serverError, expected] of [
    [400, 'settings_invalid_key', 'invalidKey'],
    [400, 'settings_openai_endpoint', 'openaiEndpoint'],
    [403, 'settings_token_invalid', 'refresh'],
    [403, 'settings_local_only', 'localOnly'],
    [403, 'unknown', 'forbidden'],
    [503, 'settings_unavailable', 'unavailable'],
  ] as const) {
    globalThis.fetch = async () => response({ error: serverError, message: 'raw-secret-must-never-appear' }, status)
    await assert.rejects(saveProviderSettings(backend, token, { googleApiKey: googleKey }, undefined, page), (error: unknown) => code(expected)(error) && !(error as Error).message.includes('raw-secret'))
  }
  assert.equal(providerConfigurationRevision(), initialRevision + 2, 'Failed saves do not invalidate configuration')
  globalThis.fetch = async () => new Response('<html>Vite fallback</html>', { headers: { 'Content-Type': 'text/html' } })
  await assert.rejects(loadProviderSettings(backend, undefined, page), code('unavailable'))
  for (const invalid of [
    { ...metadata, editable: false },
    { ...metadata, csrfToken: '' },
    { ...metadata, openai: { configured: false, source: 'saved' } },
    { ...metadata, google: { configured: true, source: 'unknown' } },
  ]) {
    globalThis.fetch = async () => response(invalid)
    await assert.rejects(loadProviderSettings(backend, undefined, page), code('invalidResponse'))
  }

  const controller = new AbortController()
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    assert.ok(init?.signal)
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  const pending = loadProviderSettings(backend, controller.signal, page)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(storageAccess, 0, 'The settings client never reads or writes localStorage')
} finally {
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}

console.log('Provider settings client tests passed')
