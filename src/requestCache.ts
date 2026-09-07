type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export type RequestCacheOptions = {
  ttlMs: number
  maxEntries: number
  now?: () => number
}

function abortError() {
  return new DOMException('Request cancelled', 'AbortError')
}

function waitForCaller<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort)
      reject(abortError())
    }
    signal.addEventListener('abort', abort, { once: true })
    request.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
}

/** Exact-key, success-only cache. A caller may cancel its wait without cancelling other callers sharing the request. */
export class RequestCache<T> {
  private readonly values = new Map<string, CacheEntry<T>>()
  private readonly inFlight = new Map<string, Promise<T>>()
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly now: () => number

  constructor({ ttlMs, maxEntries, now = Date.now }: RequestCacheOptions) {
    if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new Error('ttlMs must be non-negative')
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error('maxEntries must be positive')
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    this.now = now
  }

  getOrCreate(key: string, load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return this.request(key, load, signal, true)
  }

  /** Force a fresh load while still sharing an identical request already in flight. */
  refresh(key: string, load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    this.values.delete(key)
    return this.request(key, load, signal, false)
  }

  private request(key: string, load: () => Promise<T>, signal: AbortSignal | undefined, readCache: boolean): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortError())
    const cached = readCache ? this.read(key) : undefined
    if (cached) return Promise.resolve(cached.value)

    let shared = this.inFlight.get(key)
    if (!shared) {
      try {
        shared = Promise.resolve(load())
      } catch (error) {
        shared = Promise.reject(error)
      }
      const tracked = shared.then((value) => {
        this.write(key, value)
        return value
      })
      shared = tracked.finally(() => {
        this.inFlight.delete(key)
      })
      this.inFlight.set(key, shared)
    }
    return waitForCaller(shared, signal)
  }

  clear() {
    this.values.clear()
  }

  private read(key: string): CacheEntry<T> | undefined {
    this.pruneExpired()
    const entry = this.values.get(key)
    if (!entry) return undefined
    this.values.delete(key)
    this.values.set(key, entry)
    return entry
  }

  private write(key: string, value: T) {
    this.pruneExpired()
    this.values.delete(key)
    this.values.set(key, { value, expiresAt: this.now() + this.ttlMs })
    while (this.values.size > this.maxEntries) {
      const oldest = this.values.keys().next().value
      if (oldest === undefined) break
      this.values.delete(oldest)
    }
  }

  private pruneExpired() {
    const now = this.now()
    for (const [key, entry] of this.values) {
      if (entry.expiresAt <= now) this.values.delete(key)
    }
  }
}
