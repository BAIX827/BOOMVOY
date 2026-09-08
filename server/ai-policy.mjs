// Only normalized, successful AI responses enter this bounded process-local cache.
// No provider payloads, credentials, or Google Places facts are retained here.
export function createAiResultCache({ ttlMs = 600_000, maxEntries = 80, now = Date.now } = {}) {
  if (!Number.isInteger(ttlMs) || ttlMs < 0 || ttlMs > 3_600_000
    || !Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 500) throw new TypeError('invalid AI cache options')
  const entries = new Map()
  const prune = () => {
    const time = now()
    for (const [key, entry] of entries) if (entry.expiresAt <= time || entry.createdAt > time) entries.delete(key)
  }
  return {
    get(key) {
      prune()
      const entry = entries.get(key)
      if (!entry) return undefined
      entries.delete(key)
      entries.set(key, entry)
      return structuredClone(entry.value)
    },
    set(key, value) {
      if (!ttlMs) return
      prune()
      entries.delete(key)
      while (entries.size >= maxEntries) entries.delete(entries.keys().next().value)
      entries.set(key, { value: structuredClone(value), createdAt: now(), expiresAt: now() + ttlMs })
    },
  }
}

const strictObject = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })

// Stable schema, with deterministic UI defaults omitted from model output.
export const DAY_ROUTE_SCHEMA = strictObject({
  suggestions: { type: 'array', minItems: 0, maxItems: 2, items: strictObject({
    title: { type: 'string', maxLength: 70 },
    vibe: { type: 'string', maxLength: 140 },
    places: { type: 'array', minItems: 1, maxItems: 7, items: strictObject({
      name: { type: 'string', maxLength: 120 },
      category: { type: 'string', enum: ['景点', '餐饮', '活动', '购物'] },
      setting: { type: 'string', enum: ['indoor', 'outdoor', 'mixed'] },
      time: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
      durationMin: { type: 'integer', minimum: 15, maximum: 480 },
      notes: { type: 'string', maxLength: 120 },
      ticketNeeded: { type: 'boolean' },
    }) },
  }) },
})

export function recommendationFormat(mode, url, model) {
  // Compatible gateways must explicitly opt in; never spend a second request
  // probing whether a provider supports strict schemas.
  const knownModel = /^(?:gpt-4o(?:-mini)?(?:-\d{4}-\d{2}-\d{2})?|gpt-4\.1(?:-mini|-nano)?(?:-\d{4}-\d{2}-\d{2})?)$/.test(model)
    && model !== 'gpt-4o-2024-05-13'
  const strict = mode === 'json_schema' || mode === 'auto' && new URL(url).hostname === 'api.openai.com' && knownModel
  return strict ? { type: 'json_schema', json_schema: { name: 'boomvoy_day_routes', strict: true, schema: DAY_ROUTE_SCHEMA } }
    : { type: 'json_object' }
}
