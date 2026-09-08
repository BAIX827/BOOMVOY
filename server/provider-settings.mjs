import { randomUUID } from 'node:crypto'
import { chmod, mkdir, open, rename, unlink } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

export const MAX_SETTINGS_BYTES = 4096

export class ProviderSettingsError extends Error {
  constructor(status, code) { super(code); this.name = 'ProviderSettingsError'; this.status = status; this.code = code }
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const fields = ['openaiApiKey', 'googleApiKey']

function normalizeKey(value, field) {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > 1024) throw new ProviderSettingsError(400, 'settings_invalid_key')
  const key = value.trim()
  const pattern = field === 'openaiApiKey' ? /^sk-[A-Za-z0-9_-]+$/ : /^AIza[A-Za-z0-9_-]+$/
  if (key.length < 32 || key.length > 512 || !pattern.test(key)) throw new ProviderSettingsError(400, 'settings_invalid_key')
  return key
}

export function validateProviderSettingsPatch(value) {
  if (!record(value) || !Object.keys(value).length || Object.keys(value).some(key => !fields.includes(key))) {
    throw new ProviderSettingsError(400, 'invalid_request')
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeKey(item, key)]))
}

function storedKeys(value) {
  if (!record(value) || value.version !== 1 || Object.keys(value).some(key => !['version', ...fields].includes(key))) throw new Error('invalid')
  return Object.fromEntries(fields.flatMap(key => value[key] === undefined ? [] : [[key, normalizeKey(value[key], key)]]))
}

/** Local server secret file only. No secret appears in errors, status or logs. */
export function createProviderSettingsStore({ filePath } = {}) {
  const path = filePath === undefined ? undefined : resolve(filePath)
  let keys = {}, loaded = false, tail = Promise.resolve()

  const serial = work => {
    const result = tail.then(work)
    tail = result.catch(() => {})
    return result
  }

  async function load() {
    if (loaded) return
    if (path) {
      let handle
      try {
        handle = await open(path, 'r')
        const info = await handle.stat()
        if (!info.isFile() || info.size > MAX_SETTINGS_BYTES) throw new Error('invalid')
        // Bound the read even if another process changes the file after stat.
        const buffer = Buffer.alloc(MAX_SETTINGS_BYTES + 1)
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
        if (bytesRead > MAX_SETTINGS_BYTES) throw new Error('invalid')
        keys = storedKeys(JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')))
      } catch (error) {
        if (error.code !== 'ENOENT') throw new ProviderSettingsError(503, 'settings_unavailable')
      } finally { await handle?.close() }
    }
    loaded = true
  }

  async function persist(next) {
    if (!path) return
    const directory = dirname(path)
    const temp = `${directory}/${basename(path)}.${randomUUID()}.tmp`
    let handle
    try {
      const payload = JSON.stringify({ version: 1, ...next })
      if (Buffer.byteLength(payload) > MAX_SETTINGS_BYTES) throw new Error('invalid')
      await mkdir(directory, { recursive: true, mode: 0o700 })
      if (process.platform !== 'win32') await chmod(directory, 0o700)
      handle = await open(temp, 'wx', 0o600)
      await handle.writeFile(payload, 'utf8')
      await handle.sync()
      await handle.close(); handle = undefined
      await rename(temp, path)
    } catch { throw new ProviderSettingsError(503, 'settings_unavailable') }
    finally {
      await handle?.close().catch(() => {})
      await unlink(temp).catch(() => {})
    }
  }

  return {
    get: () => serial(async () => { await load(); return { ...keys } }),
    put: patch => serial(async () => {
      const safe = validateProviderSettingsPatch(patch)
      await load()
      const next = { ...keys }
      for (const [key, value] of Object.entries(safe)) {
        if (value === null) delete next[key]
        else next[key] = value
      }
      await persist(next)
      keys = next
      return { ...keys }
    }),
  }
}
