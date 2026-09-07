import { createHash } from 'node:crypto'

export class ApiControlError extends Error {
  constructor(code, retryAfter) {
    super(code)
    this.name = 'ApiControlError'
    this.code = code
    this.retryAfter = retryAfter
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
  }
  return value
}

export function stableProviderKey(scope, value) {
  const json = JSON.stringify(stableValue(value))
  return `${scope}:${createHash('sha256').update(json).digest('base64url')}`
}

/**
 * Process-local protection for all outbound provider calls.
 * Concurrent identical work shares one promise, so only the creator consumes
 * concurrency and call-budget capacity. Settled results are never cached.
 */
export function createApiControl({ maxConcurrent = 4, callLimit = 60, callWindowMs = 60_000, now = Date.now } = {}) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1
    || !Number.isInteger(callLimit) || callLimit < 1
    || !Number.isInteger(callWindowMs) || callWindowMs < 1
    || typeof now !== 'function') throw new TypeError('invalid api control options')

  const inFlight = new Map()
  let active = 0
  let calls = 0
  let windowStartedAt = now()

  const refreshWindow = time => {
    if (time < windowStartedAt || time - windowStartedAt >= callWindowMs) {
      calls = 0
      windowStartedAt = time
    }
  }

  function run(key, work) {
    const shared = inFlight.get(key)
    if (shared) return shared

    const execution = (async () => {
      const time = now()
      refreshWindow(time)
      if (active >= maxConcurrent) throw new ApiControlError('upstream_busy', 1)
      if (calls >= callLimit) {
        throw new ApiControlError('budget_exhausted', Math.max(1, Math.ceil((callWindowMs - time + windowStartedAt) / 1000)))
      }
      active += 1
      calls += 1
      try {
        return await work()
      } finally {
        active -= 1
      }
    })()

    inFlight.set(key, execution)
    const remove = () => { if (inFlight.get(key) === execution) inFlight.delete(key) }
    execution.then(remove, remove)
    return execution
  }

  return {
    run,
    snapshot() {
      const time = now()
      refreshWindow(time)
      return { active, inFlight: inFlight.size, calls, callLimit, resetAt: windowStartedAt + callWindowMs }
    },
  }
}
