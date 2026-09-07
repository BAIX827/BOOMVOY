import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

export const SNAPSHOT_SCHEMA_VERSION = 1
export const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024

const STORE_FORMAT_VERSION = 1
const IDEMPOTENCY_HISTORY_LIMIT = 128
const PROFILE_FIELDS = ['name', 'homeCity', 'homeCurrency', 'themePref', 'locale']
const PLAN_FIELDS = ['planA', 'planB']
const MEMBER_FIELDS = ['id', 'name', 'role', 'color']
const MONEY_FIELDS = ['amount', 'currency']
const WEATHER_FIELDS = ['condition', 'tMin', 'tMax', 'rainProb', 'rainWindow', 'summary', 'source', 'precipMm']
const COORDS_FIELDS = ['lat', 'lng']
const PLACE_FIELDS = [
  'id', 'locationPending', 'name', 'category', 'setting', 'time', 'durationMin', 'notes', 'cost',
  'ticketNeeded', 'ticketUrl', 'booked', 'priority', 'transportToNext', 'coords', 'address',
  'socialBuzz', 'checkedIn', 'checkedInAt', 'feeling',
]
const PLACE_COST_FIELDS = [...MONEY_FIELDS, 'status']
const DAY_FIELDS = ['id', 'date', 'city', 'weather', ...PLAN_FIELDS, 'activePlan', 'notes', 'transportMode', 'stay']
const DECISION_PRICE_FIELDS = ['min', 'max', 'currency', 'basis']
const DECISION_RATING_FIELDS = ['value', 'count', 'sourceUrl']
const ATTRIBUTION_FIELDS = ['name', 'url']
const DECISION_FIELDS = [
  'id', 'kind', 'name', 'city', 'address', 'source', 'sourceUrl', 'checkedAt', 'websiteUrl',
  'bookingUrl', 'mapsUrl', 'cuisines', 'parking', 'seaView', 'price', 'rating', 'reservable', 'attributions',
]
const SAVED_FIELDS = [
  'id', 'kind', 'name', 'subtitle', 'status', 'price', 'rating', 'url', 'notes', 'pros', 'cons',
  'rejectReason', 'votes', 'watchTarget', 'priceHistory', 'meta', 'decision',
]
const GOOGLE_SAVED_FIELDS = SAVED_FIELDS.filter((field) => !['subtitle', 'price', 'rating', 'decision'].includes(field))
const GOOGLE_META_FIELDS = ['decisionSource', 'decisionId', 'city']
const PRICE_HISTORY_FIELDS = ['date', 'amount']
const COMPARE_FIELDS = ['id', 'city', 'kind', 'title', 'itemIds']
const BOOKING_FIELDS = [
  'id', 'kind', 'name', 'status', 'date', 'checkout', 'confirmation', 'url', 'cost', 'homeAmount',
  'exchangeRate', 'notes', 'sourceSavedId',
]
const BUDGET_FIELDS = ['id', 'name', 'estimated', 'booked', 'paid']
const EXPENSE_FIELDS = [
  'id', 'title', 'amount', 'currency', 'homeAmount', 'category', 'date', 'paidBy', 'split', 'excluded',
  'status', 'notes', 'exchangeRate', 'bookingId',
]
const GIFT_FIELDS = ['id', 'forWhom', 'item', 'city', 'status']
const PACK_ITEM_FIELDS = ['id', 'name', 'catalogId', 'category', 'bag', 'qty', 'packedOut', 'packedBack', 'suggested']
const PACKING_FIELDS = ['phase', 'groupBy', 'dismissed', 'items']
const SHARE_FIELDS = ['visibility']
const DECISION_PREFERENCE_FIELDS = [
  'kind', 'city', 'budgetMax', 'currency', 'seaView', 'parking', 'freeParking', 'cuisine',
  'excludedCuisines', 'variety', 'minRating', 'minReviews', 'checkin', 'checkout', 'travellers',
]
const MEAL_SELECTION_FIELDS = ['date', 'city', 'cuisine', 'savedId']
const TRIP_FIELDS = [
  'id', 'name', 'origin', 'destinations', 'startDate', 'endDate', 'travellers', 'members',
  'budgetPerPerson', 'totalBudget', 'homeCurrency', 'theme', 'cover', 'transportModes', 'days', 'saved',
  'compares', 'bookings', 'budget', 'expenses', 'gifts', 'packing', 'notes', 'share', 'createdAt',
  'template', 'weatherUpdatedAt', 'decisionPreferences', 'mealSelections',
]
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const THEMES = new Set(['cream', 'ocean', 'forest'])
const THEME_PREFERENCES = new Set(['auto', ...THEMES])
const TRANSPORT_MODES = new Set(['self-drive', 'public', 'walking', 'taxi', 'cycling', 'mixed', 'flight'])
const PLACE_SETTINGS = new Set(['indoor', 'outdoor', 'mixed'])
const SAVED_KINDS = new Set(['flight', 'hotel', 'restaurant', 'place', 'activity', 'rental-car', 'souvenir', 'route'])
const DECISION_STATUSES = new Set(['interested', 'comparing', 'shortlisted', 'chosen', 'booked', 'rejected'])
const BOOKING_STATUSES = new Set(['need', 'booked', 'paid', 'cancelled', 'refunded'])
const EXPENSE_STATUSES = new Set(['estimated', 'booked', 'paid'])
const MEMBER_ROLES = new Set(['owner', 'editor', 'viewer'])
const WEATHER_CONDITIONS = new Set(['sunny', 'cloudy', 'rain', 'storm', 'snow', 'wind'])
const WEATHER_SOURCES = new Set(['forecast', 'seasonal', 'archive', 'placeholder'])
const PRIORITIES = new Set(['must', 'want', 'optional'])
const CUISINES = new Set(['any', 'mexican', 'japanese', 'italian', 'thai', 'chinese', 'indian', 'korean', 'vietnamese', 'local'])
const DECISION_KINDS = new Set(['hotel', 'restaurant'])
const DECISION_SOURCES = new Set(['google', 'curated', 'saved'])
const PARKING_VALUES = new Set(['free', 'paid', 'available', 'none', 'unknown'])
const SEA_VIEW_VALUES = new Set(['room', 'property', 'none', 'unknown'])
const PACK_PHASES = new Set(['out', 'back'])
const PACK_GROUPS = new Set(['category', 'bag'])
const PACK_CATEGORIES = new Set(['docs', 'money', 'keys', 'tech', 'clothes', 'toiletries', 'health', 'other'])
const PACK_BAGS = new Set(['suitcase', 'carryon', 'personal'])
const MAX_TEXT_LENGTH = 20_000
const MAX_COLLECTION_ITEMS = 10_000

const isRecord = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export class SnapshotValidationError extends Error {
  constructor(code, message = code, status = 422, cause) {
    super(message, cause ? { cause } : undefined)
    this.name = 'SnapshotValidationError'
    this.code = code
    this.status = status
  }
}

export class SnapshotStoreError extends Error {
  constructor(code, message = code, cause) {
    super(message, cause ? { cause } : undefined)
    this.name = 'SnapshotStoreError'
    this.code = code
    this.status = 500
  }
}

function invalid(message, code = 'invalid_snapshot', status = 422) {
  throw new SnapshotValidationError(code, message, status)
}

/** Validate that a direct caller supplied ordinary JSON, not class instances or cycles. */
function assertJsonValue(value, path = '$', ancestors = new WeakSet(), depth = 0) {
  if (depth > 64) invalid(`${path} exceeds the maximum nesting depth`)
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid(`${path} must be a finite number`)
    return
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) invalid(`${path} must not contain a cycle`)
    ancestors.add(value)
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`, ancestors, depth + 1))
    ancestors.delete(value)
    return
  }
  if (!isRecord(value)) invalid(`${path} must contain JSON values only`)
  if (ancestors.has(value)) invalid(`${path} must not contain a cycle`)
  ancestors.add(value)
  for (const [key, entry] of Object.entries(value)) {
    if (key.length > 512) invalid(`${path} contains an overlong property name`)
    if (entry === undefined) invalid(`${path}.${key} must not be undefined`)
    assertJsonValue(entry, `${path}.${key}`, ancestors, depth + 1)
  }
  ancestors.delete(value)
}

function cloneJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value
  if (Array.isArray(value)) return value.map(cloneJson)
  const copy = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!UNSAFE_KEYS.has(key)) copy[key] = cloneJson(entry)
  }
  return copy
}

function projectRecord(value, fields, projectors = {}) {
  // Preserve invalid known values so validation can reject them with a useful
  // path. Only well-shaped records are projected onto their schema fields.
  if (!isRecord(value)) return cloneJson(value)
  const clean = {}
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) continue
    clean[field] = projectors[field] ? projectors[field](value[field]) : cloneJson(value[field])
  }
  return clean
}

function projectArray(value, projector) {
  if (!Array.isArray(value)) return cloneJson(value)
  return value.map(projector)
}

const projectMoney = (value) => projectRecord(value, MONEY_FIELDS)
const projectWeather = (value) => projectRecord(value, WEATHER_FIELDS)
const projectCoords = (value) => projectRecord(value, COORDS_FIELDS)
const projectMember = (value) => projectRecord(value, MEMBER_FIELDS)
const projectDecisionPrice = (value) => projectRecord(value, DECISION_PRICE_FIELDS)
const projectDecisionRating = (value) => projectRecord(value, DECISION_RATING_FIELDS)
const projectAttribution = (value) => projectRecord(value, ATTRIBUTION_FIELDS)
const projectPriceHistory = (value) => projectRecord(value, PRICE_HISTORY_FIELDS)
const projectCompare = (value) => projectRecord(value, COMPARE_FIELDS)
const projectBudget = (value) => projectRecord(value, BUDGET_FIELDS)
const projectGift = (value) => projectRecord(value, GIFT_FIELDS)
const projectPackItem = (value) => projectRecord(value, PACK_ITEM_FIELDS)
const projectShare = (value) => projectRecord(value, SHARE_FIELDS)
const projectDecisionPreferences = (value) => projectRecord(value, DECISION_PREFERENCE_FIELDS)
const projectMealSelection = (value) => projectRecord(value, MEAL_SELECTION_FIELDS)

function projectPlace(value) {
  return projectRecord(value, PLACE_FIELDS, {
    cost: (entry) => projectRecord(entry, PLACE_COST_FIELDS),
    coords: projectCoords,
  })
}

function projectDay(value) {
  return projectRecord(value, DAY_FIELDS, {
    weather: projectWeather,
    planA: (entry) => projectArray(entry, projectPlace),
    planB: (entry) => projectArray(entry, projectPlace),
  })
}

function projectDecision(value) {
  return projectRecord(value, DECISION_FIELDS, {
    price: projectDecisionPrice,
    rating: projectDecisionRating,
    attributions: (entry) => projectArray(entry, projectAttribution),
  })
}

function projectSaved(value) {
  if (!isRecord(value)) return cloneJson(value)
  const google = (isRecord(value.meta) && value.meta.decisionSource === 'google')
    || (isRecord(value.decision) && value.decision.source === 'google')
  return projectRecord(value, google ? GOOGLE_SAVED_FIELDS : SAVED_FIELDS, {
    price: projectMoney,
    priceHistory: (entry) => projectArray(entry, projectPriceHistory),
    meta: (entry) => google ? projectRecord(entry, GOOGLE_META_FIELDS) : cloneJson(entry),
    decision: projectDecision,
  })
}

function projectBooking(value) {
  return projectRecord(value, BOOKING_FIELDS, { cost: projectMoney })
}

function projectExpense(value) {
  return projectRecord(value, EXPENSE_FIELDS)
}

function projectPacking(value) {
  return projectRecord(value, PACKING_FIELDS, {
    items: (entry) => projectArray(entry, projectPackItem),
  })
}

function sanitizeTrip(value) {
  return projectRecord(value, TRIP_FIELDS, {
    members: (entry) => projectArray(entry, projectMember),
    days: (entry) => projectArray(entry, projectDay),
    saved: (entry) => projectArray(entry, projectSaved),
    compares: (entry) => projectArray(entry, projectCompare),
    bookings: (entry) => projectArray(entry, projectBooking),
    budget: (entry) => projectArray(entry, projectBudget),
    expenses: (entry) => projectArray(entry, projectExpense),
    gifts: (entry) => projectArray(entry, projectGift),
    packing: projectPacking,
    share: projectShare,
    decisionPreferences: projectDecisionPreferences,
    mealSelections: (entry) => projectArray(entry, projectMealSelection),
  })
}

/**
 * Produce the server-owned sync representation. Forbidden fields are discarded
 * instead of being trusted merely because a client omitted them previously.
 */
export function sanitizeSnapshot(input) {
  if (!isRecord(input)) invalid('snapshot must be an object')
  if (!isRecord(input.profile)) invalid('profile must be an object')
  if (!Array.isArray(input.trips)) invalid('trips must be an array')

  const profile = projectRecord(input.profile, PROFILE_FIELDS)

  const trips = input.trips
    .filter((trip) => !(isRecord(trip) && trip.template === true))
    .map((trip, index) => {
      if (!isRecord(trip)) invalid(`trips[${index}] must be an object`)
      return sanitizeTrip(trip)
    })

  return { schemaVersion: input.schemaVersion, profile, trips }
}

function recordValue(value, path) {
  if (!isRecord(value)) invalid(`${path} must be an object`)
  return value
}

function arrayValue(value, path, max = MAX_COLLECTION_ITEMS) {
  if (!Array.isArray(value) || value.length > max) invalid(`${path} must be an array with at most ${max} items`)
  return value
}

function stringValue(value, path, max = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string' || value.length > max) invalid(`${path} must be a string with at most ${max} characters`)
  return value
}

function numberValue(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${path} must be a finite number`)
  return value
}

function boundedNumber(value, min, max, path) {
  numberValue(value, path)
  if (value < min || value > max) invalid(`${path} must be between ${min} and ${max}`)
  return value
}

function boundedInteger(value, min, max, path) {
  boundedNumber(value, min, max, path)
  if (!Number.isInteger(value)) invalid(`${path} must be an integer`)
  return value
}

function dateValue(value, path) {
  stringValue(value, path, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) invalid(`${path} must be a valid YYYY-MM-DD date`)
  return value
}

function webUrlValue(value, path) {
  stringValue(value, path, 4096)
  if (!value) return value
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw new Error('invalid')
  } catch {
    invalid(`${path} must be an HTTP(S) URL`)
  }
  return value
}

function booleanValue(value, path) {
  if (typeof value !== 'boolean') invalid(`${path} must be a boolean`)
  return value
}

function enumValue(value, values, path) {
  if (!values.has(value)) invalid(`${path} is invalid`)
  return value
}

function optional(record, field, path, validator) {
  if (Object.hasOwn(record, field)) validator(record[field], `${path}.${field}`)
}

function uniqueId(record, path, ids, collectionPath) {
  const id = stringValue(record.id, `${path}.id`)
  if (!id.trim() || id.length > 300) invalid(`${path}.id is invalid`)
  if (ids.has(id)) invalid(`${collectionPath} contains duplicate id ${id}`)
  ids.add(id)
  return id
}

function validateStringArray(value, path, max = MAX_COLLECTION_ITEMS) {
  arrayValue(value, path, max).forEach((entry, index) => stringValue(entry, `${path}[${index}]`))
}

function validateStringRecord(value, path) {
  const record = recordValue(value, path)
  for (const [key, entry] of Object.entries(record)) stringValue(entry, `${path}.${key}`)
}

function validateBooleanRecord(value, path) {
  const record = recordValue(value, path)
  for (const [key, entry] of Object.entries(record)) booleanValue(entry, `${path}.${key}`)
}

function validateMoney(value, path) {
  const money = recordValue(value, path)
  boundedNumber(money.amount, 0, 1_000_000_000_000, `${path}.amount`)
  stringValue(money.currency, `${path}.currency`, 12)
  return money
}

function validateWeather(value, path) {
  const weather = recordValue(value, path)
  enumValue(weather.condition, WEATHER_CONDITIONS, `${path}.condition`)
  boundedNumber(weather.tMin, -100, 100, `${path}.tMin`)
  boundedNumber(weather.tMax, -100, 100, `${path}.tMax`)
  if (weather.tMin > weather.tMax) invalid(`${path}.tMin must not exceed tMax`)
  boundedNumber(weather.rainProb, 0, 100, `${path}.rainProb`)
  stringValue(weather.summary, `${path}.summary`)
  optional(weather, 'rainWindow', path, stringValue)
  optional(weather, 'source', path, (entry, entryPath) => enumValue(entry, WEATHER_SOURCES, entryPath))
  optional(weather, 'precipMm', path, (entry, entryPath) => boundedNumber(entry, 0, 10_000, entryPath))
}

function validateCoords(value, path) {
  const coords = recordValue(value, path)
  boundedNumber(coords.lat, -90, 90, `${path}.lat`)
  boundedNumber(coords.lng, -180, 180, `${path}.lng`)
}

function validatePlace(value, path, placeIds, collectionPath) {
  const place = recordValue(value, path)
  uniqueId(place, path, placeIds, collectionPath)
  stringValue(place.name, `${path}.name`)
  stringValue(place.category, `${path}.category`)
  enumValue(place.setting, PLACE_SETTINGS, `${path}.setting`)
  optional(place, 'locationPending', path, booleanValue)
  optional(place, 'time', path, stringValue)
  optional(place, 'durationMin', path, (entry, entryPath) => boundedInteger(entry, 1, 1440, entryPath))
  optional(place, 'notes', path, stringValue)
  optional(place, 'cost', path, (entry, entryPath) => {
    const cost = validateMoney(entry, entryPath)
    enumValue(cost.status, EXPENSE_STATUSES, `${entryPath}.status`)
  })
  optional(place, 'ticketNeeded', path, booleanValue)
  optional(place, 'ticketUrl', path, webUrlValue)
  optional(place, 'booked', path, booleanValue)
  optional(place, 'priority', path, (entry, entryPath) => enumValue(entry, PRIORITIES, entryPath))
  optional(place, 'transportToNext', path, (entry, entryPath) => enumValue(entry, TRANSPORT_MODES, entryPath))
  optional(place, 'coords', path, validateCoords)
  optional(place, 'address', path, stringValue)
  optional(place, 'socialBuzz', path, stringValue)
  optional(place, 'checkedIn', path, booleanValue)
  optional(place, 'checkedInAt', path, stringValue)
  optional(place, 'feeling', path, stringValue)
  optional(place, 'photos', path, validateStringArray)
}

function validateDay(value, path, dayIds, placeIds, tripPath) {
  const day = recordValue(value, path)
  uniqueId(day, path, dayIds, `${tripPath}.days`)
  dateValue(day.date, `${path}.date`)
  stringValue(day.city, `${path}.city`)
  validateWeather(day.weather, `${path}.weather`)
  for (const field of PLAN_FIELDS) {
    const planPath = `${path}.${field}`
    arrayValue(day[field], planPath, 200).forEach((place, index) => {
      validatePlace(place, `${planPath}[${index}]`, placeIds, `${tripPath}.places`)
    })
  }
  enumValue(day.activePlan, new Set(['A', 'B']), `${path}.activePlan`)
  enumValue(day.transportMode, TRANSPORT_MODES, `${path}.transportMode`)
  optional(day, 'notes', path, stringValue)
  optional(day, 'stay', path, stringValue)
}

function validateMember(value, path, ids, collectionPath) {
  const member = recordValue(value, path)
  uniqueId(member, path, ids, collectionPath)
  stringValue(member.name, `${path}.name`)
  enumValue(member.role, MEMBER_ROLES, `${path}.role`)
  stringValue(member.color, `${path}.color`)
}

function validateDecisionCandidate(value, path) {
  const candidate = recordValue(value, path)
  stringValue(candidate.id, `${path}.id`)
  enumValue(candidate.kind, DECISION_KINDS, `${path}.kind`)
  stringValue(candidate.name, `${path}.name`)
  stringValue(candidate.city, `${path}.city`)
  enumValue(candidate.source, DECISION_SOURCES, `${path}.source`)
  webUrlValue(candidate.sourceUrl, `${path}.sourceUrl`)
  for (const field of ['address', 'checkedAt']) optional(candidate, field, path, stringValue)
  for (const field of ['websiteUrl', 'bookingUrl', 'mapsUrl']) optional(candidate, field, path, webUrlValue)
  optional(candidate, 'cuisines', path, (entry, entryPath) => {
    arrayValue(entry, entryPath, 20).forEach((cuisine, index) => enumValue(cuisine, CUISINES, `${entryPath}[${index}]`))
  })
  optional(candidate, 'parking', path, (entry, entryPath) => enumValue(entry, PARKING_VALUES, entryPath))
  optional(candidate, 'seaView', path, (entry, entryPath) => enumValue(entry, SEA_VIEW_VALUES, entryPath))
  optional(candidate, 'price', path, (entry, entryPath) => {
    const price = recordValue(entry, entryPath)
    optional(price, 'min', entryPath, (item, itemPath) => boundedNumber(item, 0, 1_000_000_000_000, itemPath))
    boundedNumber(price.max, 0, 1_000_000_000_000, `${entryPath}.max`)
    if (price.min !== undefined && price.min > price.max) invalid(`${entryPath}.min must not exceed max`)
    stringValue(price.currency, `${entryPath}.currency`, 12)
    enumValue(price.basis, new Set(['night', 'person']), `${entryPath}.basis`)
  })
  optional(candidate, 'rating', path, (entry, entryPath) => {
    const rating = recordValue(entry, entryPath)
    boundedNumber(rating.value, 0, 5, `${entryPath}.value`)
    optional(rating, 'count', entryPath, (item, itemPath) => boundedInteger(item, 0, 1_000_000_000, itemPath))
    webUrlValue(rating.sourceUrl, `${entryPath}.sourceUrl`)
  })
  optional(candidate, 'reservable', path, booleanValue)
  optional(candidate, 'attributions', path, (entry, entryPath) => {
    arrayValue(entry, entryPath, 50).forEach((attribution, index) => {
      const itemPath = `${entryPath}[${index}]`
      const item = recordValue(attribution, itemPath)
      stringValue(item.name, `${itemPath}.name`)
      optional(item, 'url', itemPath, webUrlValue)
    })
  })
}

function validateSavedItem(value, path, ids, collectionPath) {
  const item = recordValue(value, path)
  uniqueId(item, path, ids, collectionPath)
  enumValue(item.kind, SAVED_KINDS, `${path}.kind`)
  stringValue(item.name, `${path}.name`)
  enumValue(item.status, DECISION_STATUSES, `${path}.status`)
  validateBooleanRecord(item.votes, `${path}.votes`)
  for (const field of ['subtitle', 'notes', 'rejectReason']) optional(item, field, path, stringValue)
  optional(item, 'url', path, webUrlValue)
  optional(item, 'price', path, validateMoney)
  // SavedItem.rating is the legacy 10-point user/import scale. Provider
  // DecisionCandidate ratings below remain on Google's 5-point scale.
  optional(item, 'rating', path, (entry, entryPath) => boundedNumber(entry, 0, 10, entryPath))
  optional(item, 'pros', path, (entry, entryPath) => validateStringArray(entry, entryPath, 200))
  optional(item, 'cons', path, (entry, entryPath) => validateStringArray(entry, entryPath, 200))
  optional(item, 'watchTarget', path, (entry, entryPath) => boundedNumber(entry, 0, 1_000_000_000_000, entryPath))
  optional(item, 'priceHistory', path, (entry, entryPath) => {
    arrayValue(entry, entryPath, 5000).forEach((history, index) => {
      const itemPath = `${entryPath}[${index}]`
      const itemValue = recordValue(history, itemPath)
      dateValue(itemValue.date, `${itemPath}.date`)
      boundedNumber(itemValue.amount, 0, 1_000_000_000_000, `${itemPath}.amount`)
    })
  })
  optional(item, 'meta', path, validateStringRecord)
  optional(item, 'decision', path, validateDecisionCandidate)
}

function validateCompareBoard(value, path, ids, collectionPath) {
  const board = recordValue(value, path)
  uniqueId(board, path, ids, collectionPath)
  enumValue(board.kind, SAVED_KINDS, `${path}.kind`)
  stringValue(board.title, `${path}.title`)
  validateStringArray(board.itemIds, `${path}.itemIds`, 5000)
  optional(board, 'city', path, stringValue)
}

function validateBooking(value, path, ids, collectionPath) {
  const booking = recordValue(value, path)
  uniqueId(booking, path, ids, collectionPath)
  enumValue(booking.kind, SAVED_KINDS, `${path}.kind`)
  stringValue(booking.name, `${path}.name`)
  enumValue(booking.status, BOOKING_STATUSES, `${path}.status`)
  for (const field of ['date', 'checkout']) optional(booking, field, path, dateValue)
  for (const field of ['confirmation', 'notes', 'sourceSavedId']) optional(booking, field, path, stringValue)
  optional(booking, 'url', path, webUrlValue)
  optional(booking, 'cost', path, validateMoney)
  optional(booking, 'homeAmount', path, (entry, entryPath) => boundedNumber(entry, 0, 1_000_000_000_000, entryPath))
  optional(booking, 'exchangeRate', path, (entry, entryPath) => boundedNumber(entry, 0, 1_000_000, entryPath))
}

function validateBudgetCategory(value, path, ids, collectionPath) {
  const category = recordValue(value, path)
  uniqueId(category, path, ids, collectionPath)
  stringValue(category.name, `${path}.name`)
  boundedNumber(category.estimated, 0, 1_000_000_000_000, `${path}.estimated`)
  boundedNumber(category.booked, 0, 1_000_000_000_000, `${path}.booked`)
  boundedNumber(category.paid, 0, 1_000_000_000_000, `${path}.paid`)
}

function validateExpense(value, path, ids, collectionPath) {
  const expense = recordValue(value, path)
  uniqueId(expense, path, ids, collectionPath)
  stringValue(expense.title, `${path}.title`)
  boundedNumber(expense.amount, 0, 1_000_000_000_000, `${path}.amount`)
  stringValue(expense.currency, `${path}.currency`)
  stringValue(expense.category, `${path}.category`)
  dateValue(expense.date, `${path}.date`)
  stringValue(expense.paidBy, `${path}.paidBy`)
  if (expense.split !== 'equal') {
    const split = recordValue(expense.split, `${path}.split`)
    for (const [key, entry] of Object.entries(split)) boundedNumber(entry, 0, 1_000_000_000_000, `${path}.split.${key}`)
  }
  validateStringArray(expense.excluded, `${path}.excluded`, 100)
  enumValue(expense.status, EXPENSE_STATUSES, `${path}.status`)
  optional(expense, 'homeAmount', path, (entry, entryPath) => boundedNumber(entry, 0, 1_000_000_000_000, entryPath))
  optional(expense, 'notes', path, stringValue)
  optional(expense, 'exchangeRate', path, (entry, entryPath) => boundedNumber(entry, 0, 1_000_000, entryPath))
  optional(expense, 'bookingId', path, stringValue)
}

function validateGift(value, path, ids, collectionPath) {
  const gift = recordValue(value, path)
  uniqueId(gift, path, ids, collectionPath)
  stringValue(gift.forWhom, `${path}.forWhom`)
  stringValue(gift.item, `${path}.item`)
  enumValue(gift.status, new Set(['need', 'bought', 'packed']), `${path}.status`)
  optional(gift, 'city', path, stringValue)
}

function validatePacking(value, path) {
  const packing = recordValue(value, path)
  enumValue(packing.phase, PACK_PHASES, `${path}.phase`)
  enumValue(packing.groupBy, PACK_GROUPS, `${path}.groupBy`)
  validateStringArray(packing.dismissed, `${path}.dismissed`, 2000)
  const itemIds = new Set()
  arrayValue(packing.items, `${path}.items`, 2000).forEach((value, index) => {
    const itemPath = `${path}.items[${index}]`
    const item = recordValue(value, itemPath)
    uniqueId(item, itemPath, itemIds, `${path}.items`)
    stringValue(item.name, `${itemPath}.name`)
    enumValue(item.category, PACK_CATEGORIES, `${itemPath}.category`)
    enumValue(item.bag, PACK_BAGS, `${itemPath}.bag`)
    boundedInteger(item.qty, 1, 10_000, `${itemPath}.qty`)
    booleanValue(item.packedOut, `${itemPath}.packedOut`)
    booleanValue(item.packedBack, `${itemPath}.packedBack`)
    optional(item, 'catalogId', itemPath, stringValue)
    optional(item, 'suggested', itemPath, booleanValue)
  })
}

function validateDecisionPreferences(value, path) {
  const preferences = recordValue(value, path)
  enumValue(preferences.kind, DECISION_KINDS, `${path}.kind`)
  stringValue(preferences.city, `${path}.city`)
  stringValue(preferences.currency, `${path}.currency`)
  booleanValue(preferences.seaView, `${path}.seaView`)
  booleanValue(preferences.parking, `${path}.parking`)
  booleanValue(preferences.freeParking, `${path}.freeParking`)
  enumValue(preferences.cuisine, CUISINES, `${path}.cuisine`)
  booleanValue(preferences.variety, `${path}.variety`)
  boundedNumber(preferences.minRating, 0, 5, `${path}.minRating`)
  boundedInteger(preferences.minReviews, 0, 1_000_000_000, `${path}.minReviews`)
  dateValue(preferences.checkin, `${path}.checkin`)
  dateValue(preferences.checkout, `${path}.checkout`)
  boundedInteger(preferences.travellers, 1, 100, `${path}.travellers`)
  optional(preferences, 'budgetMax', path, (entry, entryPath) => boundedNumber(entry, 0, 1_000_000_000_000, entryPath))
  optional(preferences, 'excludedCuisines', path, (entry, entryPath) => {
    arrayValue(entry, entryPath, 20).forEach((cuisine, index) => enumValue(cuisine, CUISINES, `${entryPath}[${index}]`))
  })
}

function validateProfile(profile) {
  stringValue(profile.name, 'profile.name')
  stringValue(profile.homeCity, 'profile.homeCity')
  stringValue(profile.homeCurrency, 'profile.homeCurrency')
  if (profile.name.length > 250) invalid('profile.name is too long')
  if (profile.homeCity.length > 250) invalid('profile.homeCity is too long')
  if (profile.homeCurrency.length > 12) invalid('profile.homeCurrency is too long')
  enumValue(profile.themePref, THEME_PREFERENCES, 'profile.themePref')
  optional(profile, 'locale', 'profile', (entry, entryPath) => enumValue(entry, new Set(['zh', 'en']), entryPath))
}

function validateTrip(value, path, tripIds) {
  const trip = recordValue(value, path)
  uniqueId(trip, path, tripIds, 'trips')
  stringValue(trip.name, `${path}.name`)
  stringValue(trip.origin, `${path}.origin`)
  validateStringArray(trip.destinations, `${path}.destinations`, 100)
  dateValue(trip.startDate, `${path}.startDate`)
  dateValue(trip.endDate, `${path}.endDate`)
  if (trip.endDate < trip.startDate) invalid(`${path}.endDate must not precede startDate`)
  boundedInteger(trip.travellers, 1, 100, `${path}.travellers`)

  const memberIds = new Set()
  arrayValue(trip.members, `${path}.members`, 100).forEach((member, index) => {
    validateMember(member, `${path}.members[${index}]`, memberIds, `${path}.members`)
  })

  boundedNumber(trip.budgetPerPerson, 0, 1_000_000_000_000, `${path}.budgetPerPerson`)
  boundedNumber(trip.totalBudget, 0, 1_000_000_000_000, `${path}.totalBudget`)
  stringValue(trip.homeCurrency, `${path}.homeCurrency`, 12)
  enumValue(trip.theme, THEMES, `${path}.theme`)
  stringValue(trip.cover, `${path}.cover`)
  arrayValue(trip.transportModes, `${path}.transportModes`, 20).forEach((mode, index) => {
    enumValue(mode, TRANSPORT_MODES, `${path}.transportModes[${index}]`)
  })

  const dayIds = new Set()
  const placeIds = new Set()
  arrayValue(trip.days, `${path}.days`, 730).forEach((day, index) => {
    validateDay(day, `${path}.days[${index}]`, dayIds, placeIds, path)
  })

  const savedIds = new Set()
  arrayValue(trip.saved, `${path}.saved`, 5000).forEach((item, index) => {
    validateSavedItem(item, `${path}.saved[${index}]`, savedIds, `${path}.saved`)
  })

  const compareIds = new Set()
  arrayValue(trip.compares, `${path}.compares`, 500).forEach((board, index) => {
    validateCompareBoard(board, `${path}.compares[${index}]`, compareIds, `${path}.compares`)
  })

  const bookingIds = new Set()
  arrayValue(trip.bookings, `${path}.bookings`, 5000).forEach((booking, index) => {
    validateBooking(booking, `${path}.bookings[${index}]`, bookingIds, `${path}.bookings`)
  })

  const budgetIds = new Set()
  arrayValue(trip.budget, `${path}.budget`, 500).forEach((category, index) => {
    validateBudgetCategory(category, `${path}.budget[${index}]`, budgetIds, `${path}.budget`)
  })

  const expenseIds = new Set()
  arrayValue(trip.expenses, `${path}.expenses`, 10_000).forEach((expense, index) => {
    validateExpense(expense, `${path}.expenses[${index}]`, expenseIds, `${path}.expenses`)
  })

  const giftIds = new Set()
  arrayValue(trip.gifts, `${path}.gifts`, 5000).forEach((gift, index) => {
    validateGift(gift, `${path}.gifts[${index}]`, giftIds, `${path}.gifts`)
  })

  stringValue(trip.notes, `${path}.notes`)
  const share = recordValue(trip.share, `${path}.share`)
  enumValue(share.visibility, new Set(['private', 'friends', 'public']), `${path}.share.visibility`)
  dateValue(trip.createdAt, `${path}.createdAt`)
  optional(trip, 'packing', path, validatePacking)
  optional(trip, 'template', path, booleanValue)
  optional(trip, 'weatherUpdatedAt', path, stringValue)
  optional(trip, 'decisionPreferences', path, validateDecisionPreferences)
  optional(trip, 'mealSelections', path, (entry, entryPath) => {
    arrayValue(entry, entryPath, 2000).forEach((meal, index) => {
      const mealPath = `${entryPath}[${index}]`
      const selection = recordValue(meal, mealPath)
      dateValue(selection.date, `${mealPath}.date`)
      stringValue(selection.city, `${mealPath}.city`)
      enumValue(selection.cuisine, CUISINES, `${mealPath}.cuisine`)
      stringValue(selection.savedId, `${mealPath}.savedId`)
    })
  })
}

function validateTrips(trips) {
  const tripIds = new Set()
  arrayValue(trips, 'trips', 100).forEach((trip, index) => validateTrip(trip, `trips[${index}]`, tripIds))
}

/** Validate, bound and sanitize an untrusted parsed request body. */
export function validateSnapshot(input, { maxBytes = MAX_SNAPSHOT_BYTES } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive integer')
  assertJsonValue(input)
  let encoded
  try {
    encoded = JSON.stringify(input)
  } catch (error) {
    throw new SnapshotValidationError('invalid_snapshot', 'snapshot is not valid JSON', 422, error)
  }
  if (Buffer.byteLength(encoded, 'utf8') > maxBytes) invalid('snapshot exceeds the 4 MB request limit', 'payload_too_large', 413)
  if (input.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    invalid(`schemaVersion ${String(input.schemaVersion)} is not supported`, 'unsupported_schema', 422)
  }
  const snapshot = sanitizeSnapshot(input)
  validateProfile(snapshot.profile)
  validateTrips(snapshot.trips)
  assertJsonValue(snapshot)
  return snapshot
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
}

function fingerprint(snapshot, expectedRevision) {
  return createHash('sha256').update(`${expectedRevision}\n${stableJson(snapshot)}`).digest('hex')
}

function etag(revision) {
  return `"r${revision}"`
}

function publicSnapshot(state) {
  return {
    ok: true,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    revision: state.revision,
    updatedAt: state.updatedAt,
    snapshot: state.snapshot === null ? null : cloneJson(state.snapshot),
    etag: etag(state.revision),
  }
}

function conflict(state, code) {
  return {
    ok: false,
    conflict: true,
    code,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    revision: state.revision,
    updatedAt: state.updatedAt,
    snapshot: state.snapshot === null ? null : cloneJson(state.snapshot),
    etag: etag(state.revision),
  }
}

function validateExpectedRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) invalid('expectedRevision must be a non-negative integer', 'invalid_revision', 400)
}

function validateIdempotencyKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(value)) {
    invalid('idempotencyKey must contain 8-200 safe characters', 'invalid_idempotency_key', 400)
  }
}

function isoNow(now) {
  const value = now()
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new SnapshotStoreError('invalid_clock', 'now() returned an invalid date')
  return date.toISOString()
}

function emptyState() {
  return { formatVersion: STORE_FORMAT_VERSION, revision: 0, updatedAt: null, snapshot: null, idempotency: [] }
}

function loadStoredState(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new SnapshotStoreError('corrupt_store', 'snapshot store contains invalid JSON', error)
  }
  if (!isRecord(parsed) || parsed.formatVersion !== STORE_FORMAT_VERSION
    || !Number.isSafeInteger(parsed.revision) || parsed.revision < 0
    || !Array.isArray(parsed.idempotency)
    || parsed.idempotency.length > IDEMPOTENCY_HISTORY_LIMIT
    || (parsed.updatedAt !== null && (typeof parsed.updatedAt !== 'string' || !Number.isFinite(Date.parse(parsed.updatedAt))))) {
    throw new SnapshotStoreError('corrupt_store', 'snapshot store metadata is invalid')
  }
  if (parsed.revision === 0 && (parsed.snapshot !== null || parsed.updatedAt !== null)
    || parsed.revision > 0 && (parsed.snapshot === null || parsed.updatedAt === null)) {
    throw new SnapshotStoreError('corrupt_store', 'snapshot store revision and payload disagree')
  }

  let snapshot = null
  try {
    if (parsed.snapshot !== null) snapshot = validateSnapshot(parsed.snapshot)
  } catch (error) {
    throw new SnapshotStoreError('corrupt_store', 'stored snapshot is invalid', error)
  }

  const idempotencyKeys = new Set()
  const idempotency = parsed.idempotency.map((entry) => {
    if (!isRecord(entry) || typeof entry.key !== 'string' || typeof entry.fingerprint !== 'string'
      || !/^[a-f0-9]{64}$/.test(entry.fingerprint) || !Number.isSafeInteger(entry.revision)
      || entry.revision < 1 || entry.revision > parsed.revision || typeof entry.updatedAt !== 'string'
      || !Number.isFinite(Date.parse(entry.updatedAt)) || idempotencyKeys.has(entry.key)) {
      throw new SnapshotStoreError('corrupt_store', 'snapshot idempotency history is invalid')
    }
    idempotencyKeys.add(entry.key)
    return { key: entry.key, fingerprint: entry.fingerprint, revision: entry.revision, updatedAt: entry.updatedAt }
  })

  return {
    formatVersion: STORE_FORMAT_VERSION,
    revision: parsed.revision,
    updatedAt: parsed.updatedAt,
    snapshot,
    idempotency,
  }
}

async function atomicWrite(filePath, state) {
  const directory = dirname(filePath)
  await mkdir(directory, { recursive: true })
  const temporary = resolve(directory, `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`)
  let handle
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(`${JSON.stringify(state)}\n`, 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporary, filePath)
  } catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporary).catch(() => {})
    throw new SnapshotStoreError('write_failed', 'could not persist snapshot', error)
  }
}

/**
 * A single-user, file-backed snapshot store. The caller owns authentication;
 * this module owns validation, CAS, idempotency and durable write ordering.
 */
export function createSnapshotStore({ filePath, now = () => new Date(), maxPendingWrites = 4 } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new TypeError('filePath is required')
  if (typeof now !== 'function') throw new TypeError('now must be a function')
  if (!Number.isInteger(maxPendingWrites) || maxPendingWrites < 1 || maxPendingWrites > 100) throw new TypeError('maxPendingWrites must be between 1 and 100')
  const target = resolve(filePath)
  let loaded
  let loading
  let writeTail = Promise.resolve()
  let pendingWrites = 0

  async function ensureLoaded() {
    if (loaded) return loaded
    if (!loading) {
      loading = readFile(target, 'utf8')
        .then(loadStoredState)
        .catch((error) => {
          if (error?.code === 'ENOENT') return emptyState()
          if (error instanceof SnapshotStoreError) throw error
          throw new SnapshotStoreError('read_failed', 'could not read snapshot store', error)
        })
        .then((state) => {
          loaded = state
          return state
        })
        .finally(() => { loading = undefined })
    }
    return loading
  }

  function enqueueWrite(operation) {
    const result = writeTail.then(operation, operation)
    writeTail = result.then(() => undefined, () => undefined)
    return result
  }

  async function get() {
    await writeTail
    return publicSnapshot(await ensureLoaded())
  }

  function put({ snapshot, expectedRevision, idempotencyKey } = {}) {
    validateExpectedRevision(expectedRevision)
    validateIdempotencyKey(idempotencyKey)
    if (pendingWrites >= maxPendingWrites) invalid('snapshot write queue is full', 'snapshot_busy', 503)
    const clean = validateSnapshot(snapshot)
    const requestFingerprint = fingerprint(clean, expectedRevision)
    pendingWrites += 1
    const result = enqueueWrite(async () => {
      const state = await ensureLoaded()
      const replay = state.idempotency.find((entry) => entry.key === idempotencyKey)
      if (replay) {
        if (replay.fingerprint !== requestFingerprint) return conflict(state, 'idempotency_key_reused')
        return {
          ok: true,
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          revision: replay.revision,
          updatedAt: replay.updatedAt,
          etag: etag(replay.revision),
          replayed: true,
        }
      }
      if (expectedRevision !== state.revision) return conflict(state, 'revision_conflict')

      const revision = state.revision + 1
      const updatedAt = isoNow(now)
      const idempotency = [...state.idempotency, {
        key: idempotencyKey,
        fingerprint: requestFingerprint,
        revision,
        updatedAt,
      }].slice(-IDEMPOTENCY_HISTORY_LIMIT)
      const next = {
        formatVersion: STORE_FORMAT_VERSION,
        revision,
        updatedAt,
        snapshot: clean,
        idempotency,
      }
      await atomicWrite(target, next)
      loaded = next
      return {
        ok: true,
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        revision,
        updatedAt,
        etag: etag(revision),
        replayed: false,
      }
    })
    return result.finally(() => { pendingWrites -= 1 })
  }

  return { get, put }
}
