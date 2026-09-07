import type { Profile, Trip } from './types'

export type SyncSnapshot = {
  schemaVersion: 1
  profile: Pick<Profile, 'name' | 'homeCity' | 'homeCurrency' | 'themePref' | 'locale'>
  trips: Trip[]
}

type JsonRecord = Record<string, unknown>
type Check = (value: unknown) => boolean
type SnapshotValidationOptions = { allowLocalFields?: boolean }

const MAX_TEXT_LENGTH = 20_000
const MAX_COLLECTION_ITEMS = 10_000
const MAX_LOCAL_PHOTO_LENGTH = 64 * 1024 * 1024
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
const PRICE_BASES = new Set(['night', 'person'])
const GIFT_STATUSES = new Set(['need', 'bought', 'packed'])
const PACK_PHASES = new Set(['out', 'back'])
const PACK_GROUPS = new Set(['category', 'bag'])
const PACK_CATEGORIES = new Set(['docs', 'money', 'keys', 'tech', 'clothes', 'toiletries', 'health', 'other'])
const PACK_BAGS = new Set(['suitcase', 'carryon', 'personal'])
const PLAN_VARIANTS = new Set(['A', 'B'])
const VISIBILITIES = new Set(['private', 'friends', 'public'])
const LOCALES = new Set(['zh', 'en'])

function record(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const stringValue = (value: unknown, max = MAX_TEXT_LENGTH): value is string => typeof value === 'string' && value.length <= max
const numberValue = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const numberIn = (value: unknown, min: number, max: number): value is number => numberValue(value) && value >= min && value <= max
const integerIn = (value: unknown, min: number, max: number): value is number => numberIn(value, min, max) && Number.isInteger(value)
const booleanValue = (value: unknown): value is boolean => typeof value === 'boolean'
const enumValue = (value: unknown, values: Set<string>) => typeof value === 'string' && values.has(value)
const optional = (value: JsonRecord, key: string, check: Check) => !Object.hasOwn(value, key) || check(value[key])
const arrayOf = (value: unknown, check: Check, max = MAX_COLLECTION_ITEMS) => Array.isArray(value) && value.length <= max && value.every((entry) => check(entry))
const stringArray = (value: unknown, max = MAX_COLLECTION_ITEMS) => arrayOf(value, (entry) => stringValue(entry), max)

function recordOf(value: unknown, check: Check) {
  return record(value) && Object.values(value).every((entry) => check(entry))
}

function dateValue(value: unknown): value is string {
  if (!stringValue(value, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function webUrlValue(value: unknown): value is string {
  if (!stringValue(value, 4096)) return false
  if (!value) return true
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && Boolean(url.hostname)
  } catch {
    return false
  }
}

function addUniqueId(value: JsonRecord, ids: Set<string>) {
  if (!stringValue(value.id, 300) || !value.id.trim() || ids.has(value.id)) return false
  ids.add(value.id)
  return true
}

function uniqueArray(value: unknown, check: (item: JsonRecord, ids: Set<string>) => boolean, max = MAX_COLLECTION_ITEMS) {
  if (!Array.isArray(value) || value.length > max) return false
  const ids = new Set<string>()
  return value.every((item) => record(item) && check(item, ids))
}

function pickKnown(value: unknown, fields: readonly string[]): unknown {
  if (!record(value)) return value
  const clean: JsonRecord = {}
  for (const field of fields) if (Object.hasOwn(value, field)) clean[field] = value[field]
  return clean
}

function mapKnown(value: unknown, sanitize: (entry: unknown) => unknown): unknown {
  return Array.isArray(value) ? value.map(sanitize) : value
}

function sanitizeMoney(value: unknown, includeStatus = false) {
  return pickKnown(value, includeStatus ? ['amount', 'currency', 'status'] : ['amount', 'currency'])
}

function sanitizeCandidate(value: unknown) {
  const clean = pickKnown(value, ['id', 'kind', 'name', 'city', 'address', 'source', 'sourceUrl', 'checkedAt', 'websiteUrl',
    'bookingUrl', 'mapsUrl', 'cuisines', 'parking', 'seaView', 'price', 'rating', 'reservable', 'attributions'])
  if (!record(clean)) return clean
  if (Object.hasOwn(clean, 'price')) clean.price = pickKnown(clean.price, ['min', 'max', 'currency', 'basis'])
  if (Object.hasOwn(clean, 'rating')) clean.rating = pickKnown(clean.rating, ['value', 'count', 'sourceUrl'])
  if (Object.hasOwn(clean, 'attributions')) {
    clean.attributions = mapKnown(clean.attributions, (entry) => pickKnown(entry, ['name', 'url']))
  }
  return clean
}

function sanitizeSaved(value: unknown) {
  const clean = pickKnown(value, ['id', 'kind', 'name', 'subtitle', 'status', 'price', 'rating', 'url', 'notes', 'pros', 'cons',
    'rejectReason', 'votes', 'watchTarget', 'priceHistory', 'meta', 'decision'])
  if (!record(clean)) return clean
  if (Object.hasOwn(clean, 'price')) clean.price = sanitizeMoney(clean.price)
  if (Object.hasOwn(clean, 'priceHistory')) {
    clean.priceHistory = mapKnown(clean.priceHistory, (entry) => pickKnown(entry, ['date', 'amount']))
  }
  if (Object.hasOwn(clean, 'decision')) clean.decision = sanitizeCandidate(clean.decision)
  const google = record(clean.meta) && clean.meta.decisionSource === 'google'
    || record(clean.decision) && clean.decision.source === 'google'
  if (google) {
    delete clean.decision
    delete clean.rating
    delete clean.price
    delete clean.subtitle
    clean.meta = pickKnown(clean.meta, ['decisionSource', 'decisionId', 'city'])
  }
  return clean
}

function sanitizePlace(value: unknown) {
  const clean = pickKnown(value, ['id', 'locationPending', 'name', 'category', 'setting', 'time', 'durationMin', 'notes', 'cost',
    'ticketNeeded', 'ticketUrl', 'booked', 'priority', 'transportToNext', 'coords', 'address', 'socialBuzz', 'checkedIn',
    'checkedInAt', 'feeling'])
  if (!record(clean)) return clean
  if (Object.hasOwn(clean, 'cost')) clean.cost = sanitizeMoney(clean.cost, true)
  if (Object.hasOwn(clean, 'coords')) clean.coords = pickKnown(clean.coords, ['lat', 'lng'])
  return clean
}

function sanitizeDay(value: unknown) {
  const clean = pickKnown(value, ['id', 'date', 'city', 'weather', 'planA', 'planB', 'activePlan', 'notes', 'transportMode', 'stay'])
  if (!record(clean)) return clean
  if (Object.hasOwn(clean, 'weather')) {
    clean.weather = pickKnown(clean.weather, ['condition', 'tMin', 'tMax', 'rainProb', 'rainWindow', 'summary', 'source', 'precipMm'])
  }
  for (const field of ['planA', 'planB']) if (Object.hasOwn(clean, field)) clean[field] = mapKnown(clean[field], sanitizePlace)
  return clean
}

/** Create the browser-owned cloud representation using the same v1 field allowlist as the server. */
export function sanitizeTripForSync(value: Trip): Trip {
  const clean = pickKnown(value, ['id', 'name', 'origin', 'destinations', 'startDate', 'endDate', 'travellers', 'members',
    'budgetPerPerson', 'totalBudget', 'homeCurrency', 'theme', 'cover', 'transportModes', 'days', 'saved', 'compares',
    'bookings', 'budget', 'expenses', 'gifts', 'packing', 'notes', 'share', 'createdAt', 'template', 'weatherUpdatedAt',
    'decisionPreferences', 'mealSelections'])
  if (!record(clean)) return value
  if (Object.hasOwn(clean, 'members')) clean.members = mapKnown(clean.members, (entry) => pickKnown(entry, ['id', 'name', 'role', 'color']))
  if (Object.hasOwn(clean, 'days')) clean.days = mapKnown(clean.days, sanitizeDay)
  if (Object.hasOwn(clean, 'saved')) clean.saved = mapKnown(clean.saved, sanitizeSaved)
  if (Object.hasOwn(clean, 'compares')) clean.compares = mapKnown(clean.compares, (entry) => pickKnown(entry, ['id', 'city', 'kind', 'title', 'itemIds']))
  if (Object.hasOwn(clean, 'bookings')) {
    clean.bookings = mapKnown(clean.bookings, (entry) => {
      const booking = pickKnown(entry, ['id', 'kind', 'name', 'status', 'date', 'checkout', 'confirmation', 'url', 'cost',
        'homeAmount', 'exchangeRate', 'notes', 'sourceSavedId'])
      if (record(booking) && Object.hasOwn(booking, 'cost')) booking.cost = sanitizeMoney(booking.cost)
      return booking
    })
  }
  if (Object.hasOwn(clean, 'budget')) clean.budget = mapKnown(clean.budget, (entry) => pickKnown(entry, ['id', 'name', 'estimated', 'booked', 'paid']))
  if (Object.hasOwn(clean, 'expenses')) {
    clean.expenses = mapKnown(clean.expenses, (entry) => pickKnown(entry, ['id', 'title', 'amount', 'currency', 'homeAmount',
      'category', 'date', 'paidBy', 'split', 'excluded', 'status', 'notes', 'exchangeRate', 'bookingId']))
  }
  if (Object.hasOwn(clean, 'gifts')) clean.gifts = mapKnown(clean.gifts, (entry) => pickKnown(entry, ['id', 'forWhom', 'item', 'city', 'status']))
  if (Object.hasOwn(clean, 'packing')) {
    clean.packing = pickKnown(clean.packing, ['phase', 'groupBy', 'dismissed', 'items'])
    if (record(clean.packing) && Object.hasOwn(clean.packing, 'items')) {
      clean.packing.items = mapKnown(clean.packing.items, (entry) => pickKnown(entry,
        ['id', 'name', 'catalogId', 'category', 'bag', 'qty', 'packedOut', 'packedBack', 'suggested']))
    }
  }
  if (Object.hasOwn(clean, 'share')) clean.share = pickKnown(clean.share, ['visibility'])
  if (Object.hasOwn(clean, 'decisionPreferences')) {
    clean.decisionPreferences = pickKnown(clean.decisionPreferences, ['kind', 'city', 'budgetMax', 'currency', 'seaView',
      'parking', 'freeParking', 'cuisine', 'excludedCuisines', 'variety', 'minRating', 'minReviews', 'checkin', 'checkout', 'travellers'])
  }
  if (Object.hasOwn(clean, 'mealSelections')) {
    clean.mealSelections = mapKnown(clean.mealSelections, (entry) => pickKnown(entry, ['date', 'city', 'cuisine', 'savedId']))
  }
  return JSON.parse(JSON.stringify(clean)) as Trip
}

/** Merge a legacy/local backup profile without silently repairing fields that are present but invalid. */
export function mergeImportedProfile(value: unknown, fallback: Profile): SyncSnapshot['profile'] {
  if (value !== undefined && !record(value)) throw new Error('invalid profile')
  const source = record(value) ? value : {}
  const readString = (key: string, defaultValue: string, max: number) => {
    if (!Object.hasOwn(source, key)) return defaultValue
    const candidate = source[key]
    if (!stringValue(candidate, max)) throw new Error('invalid profile')
    return candidate
  }
  const themePref = Object.hasOwn(source, 'themePref') ? source.themePref : fallback.themePref
  const locale = Object.hasOwn(source, 'locale') ? source.locale : fallback.locale
  if (!enumValue(themePref, THEME_PREFERENCES) || locale !== undefined && !enumValue(locale, LOCALES)) {
    throw new Error('invalid profile')
  }
  return {
    name: readString('name', fallback.name, 250),
    homeCity: readString('homeCity', fallback.homeCity, 250),
    homeCurrency: readString('homeCurrency', fallback.homeCurrency, 12),
    themePref: themePref as SyncSnapshot['profile']['themePref'],
    ...(locale === undefined ? {} : { locale: locale as SyncSnapshot['profile']['locale'] }),
  }
}

function money(value: unknown) {
  return record(value) && numberIn(value.amount, 0, 1_000_000_000_000) && stringValue(value.currency, 12)
}

function weather(value: unknown) {
  return record(value)
    && enumValue(value.condition, WEATHER_CONDITIONS)
    && numberIn(value.tMin, -100, 100)
    && numberIn(value.tMax, -100, 100)
    && value.tMin <= value.tMax
    && numberIn(value.rainProb, 0, 100)
    && stringValue(value.summary)
    && optional(value, 'rainWindow', stringValue)
    && optional(value, 'source', (entry) => enumValue(entry, WEATHER_SOURCES))
    && optional(value, 'precipMm', (entry) => numberIn(entry, 0, 10_000))
}

function coords(value: unknown) {
  return record(value) && numberIn(value.lat, -90, 90) && numberIn(value.lng, -180, 180)
}

function place(value: JsonRecord, ids: Set<string>, allowLocalFields: boolean) {
  return addUniqueId(value, ids)
    && stringValue(value.name)
    && stringValue(value.category)
    && enumValue(value.setting, PLACE_SETTINGS)
    && optional(value, 'locationPending', booleanValue)
    && optional(value, 'time', stringValue)
    && optional(value, 'durationMin', (entry) => integerIn(entry, 1, 1440))
    && optional(value, 'notes', stringValue)
    && optional(value, 'cost', (entry) => record(entry) && money(entry) && enumValue(entry.status, EXPENSE_STATUSES))
    && optional(value, 'ticketNeeded', booleanValue)
    && optional(value, 'ticketUrl', webUrlValue)
    && optional(value, 'booked', booleanValue)
    && optional(value, 'priority', (entry) => enumValue(entry, PRIORITIES))
    && optional(value, 'transportToNext', (entry) => enumValue(entry, TRANSPORT_MODES))
    && optional(value, 'coords', coords)
    && optional(value, 'address', stringValue)
    && optional(value, 'socialBuzz', stringValue)
    && optional(value, 'checkedIn', booleanValue)
    && optional(value, 'checkedInAt', stringValue)
    && optional(value, 'feeling', stringValue)
    && (!Object.hasOwn(value, 'photos') || allowLocalFields && arrayOf(value.photos, (photo) => stringValue(photo, MAX_LOCAL_PHOTO_LENGTH)))
}

function member(value: JsonRecord, ids: Set<string>) {
  return addUniqueId(value, ids) && stringValue(value.name) && enumValue(value.role, MEMBER_ROLES) && stringValue(value.color)
}

function decisionCandidate(value: unknown) {
  return record(value)
    && stringValue(value.id)
    && enumValue(value.kind, DECISION_KINDS)
    && stringValue(value.name)
    && stringValue(value.city)
    && enumValue(value.source, DECISION_SOURCES)
    && webUrlValue(value.sourceUrl)
    && ['address', 'checkedAt'].every((key) => optional(value, key, stringValue))
    && ['websiteUrl', 'bookingUrl', 'mapsUrl'].every((key) => optional(value, key, webUrlValue))
    && optional(value, 'cuisines', (entry) => arrayOf(entry, (item) => enumValue(item, CUISINES), 20))
    && optional(value, 'parking', (entry) => enumValue(entry, PARKING_VALUES))
    && optional(value, 'seaView', (entry) => enumValue(entry, SEA_VIEW_VALUES))
    && optional(value, 'price', (entry) => record(entry)
      && optional(entry, 'min', (item) => numberIn(item, 0, 1_000_000_000_000))
      && numberIn(entry.max, 0, 1_000_000_000_000)
      && (entry.min === undefined || numberValue(entry.min) && entry.min <= entry.max)
      && stringValue(entry.currency, 12)
      && enumValue(entry.basis, PRICE_BASES))
    && optional(value, 'rating', (entry) => record(entry)
      && numberIn(entry.value, 0, 5)
      && optional(entry, 'count', (item) => integerIn(item, 0, 1_000_000_000))
      && webUrlValue(entry.sourceUrl))
    && optional(value, 'reservable', booleanValue)
    && optional(value, 'attributions', (entry) => arrayOf(entry, (item) => record(item)
      && stringValue(item.name) && optional(item, 'url', webUrlValue), 50))
}

function savedItem(value: JsonRecord, ids: Set<string>, allowLocalFields: boolean) {
  if (!addUniqueId(value, ids)
    || !enumValue(value.kind, SAVED_KINDS)
    || !stringValue(value.name)
    || !enumValue(value.status, DECISION_STATUSES)
    || !recordOf(value.votes, booleanValue)
    || !['subtitle', 'notes', 'rejectReason'].every((key) => optional(value, key, stringValue))
    || !optional(value, 'url', webUrlValue)
    || !optional(value, 'price', money)
    || !optional(value, 'rating', (entry) => numberIn(entry, 0, 10))
    || !optional(value, 'pros', (entry) => stringArray(entry, 200))
    || !optional(value, 'cons', (entry) => stringArray(entry, 200))
    || !optional(value, 'watchTarget', (entry) => numberIn(entry, 0, 1_000_000_000_000))
    || !optional(value, 'priceHistory', (entry) => arrayOf(entry, (item) => record(item)
      && dateValue(item.date) && numberIn(item.amount, 0, 1_000_000_000_000), 5000))
    || !optional(value, 'meta', (entry) => recordOf(entry, stringValue))
    || !optional(value, 'decision', decisionCandidate)) return false

  if (allowLocalFields) return true
  const google = record(value.meta) && value.meta.decisionSource === 'google'
    || record(value.decision) && value.decision.source === 'google'
  return !google || !Object.hasOwn(value, 'decision') && !Object.hasOwn(value, 'rating')
    && !Object.hasOwn(value, 'price') && !Object.hasOwn(value, 'subtitle')
}

function compareBoard(value: JsonRecord, ids: Set<string>) {
  return addUniqueId(value, ids) && enumValue(value.kind, SAVED_KINDS) && stringValue(value.title)
    && stringArray(value.itemIds, 5000) && optional(value, 'city', stringValue)
}

function booking(value: JsonRecord, ids: Set<string>) {
  return addUniqueId(value, ids) && enumValue(value.kind, SAVED_KINDS) && stringValue(value.name)
    && enumValue(value.status, BOOKING_STATUSES)
    && ['date', 'checkout'].every((key) => optional(value, key, dateValue))
    && ['confirmation', 'notes', 'sourceSavedId'].every((key) => optional(value, key, stringValue))
    && optional(value, 'url', webUrlValue)
    && optional(value, 'cost', money)
    && optional(value, 'homeAmount', (entry) => numberIn(entry, 0, 1_000_000_000_000))
    && optional(value, 'exchangeRate', (entry) => numberIn(entry, 0, 1_000_000))
}

function budgetCategory(value: JsonRecord, ids: Set<string>) {
  return addUniqueId(value, ids) && stringValue(value.name)
    && numberIn(value.estimated, 0, 1_000_000_000_000)
    && numberIn(value.booked, 0, 1_000_000_000_000)
    && numberIn(value.paid, 0, 1_000_000_000_000)
}

function expense(value: JsonRecord, ids: Set<string>) {
  return addUniqueId(value, ids) && stringValue(value.title)
    && numberIn(value.amount, 0, 1_000_000_000_000)
    && stringValue(value.currency) && stringValue(value.category) && dateValue(value.date)
    && stringValue(value.paidBy)
    && (value.split === 'equal' || recordOf(value.split, (entry) => numberIn(entry, 0, 1_000_000_000_000)))
    && stringArray(value.excluded, 100) && enumValue(value.status, EXPENSE_STATUSES)
    && optional(value, 'homeAmount', (entry) => numberIn(entry, 0, 1_000_000_000_000))
    && optional(value, 'notes', stringValue)
    && optional(value, 'exchangeRate', (entry) => numberIn(entry, 0, 1_000_000))
    && optional(value, 'bookingId', stringValue)
}

function gift(value: JsonRecord, ids: Set<string>) {
  return addUniqueId(value, ids) && stringValue(value.forWhom) && stringValue(value.item)
    && enumValue(value.status, GIFT_STATUSES) && optional(value, 'city', stringValue)
}

function packing(value: unknown) {
  return record(value) && enumValue(value.phase, PACK_PHASES)
    && enumValue(value.groupBy, PACK_GROUPS) && stringArray(value.dismissed, 2000)
    && uniqueArray(value.items, (item, ids) => addUniqueId(item, ids) && stringValue(item.name)
      && optional(item, 'catalogId', stringValue)
      && enumValue(item.category, PACK_CATEGORIES)
      && enumValue(item.bag, PACK_BAGS)
      && integerIn(item.qty, 1, 10_000) && booleanValue(item.packedOut) && booleanValue(item.packedBack)
      && optional(item, 'suggested', booleanValue), 2000)
}

function decisionPreferences(value: unknown) {
  return record(value) && enumValue(value.kind, DECISION_KINDS) && stringValue(value.city)
    && optional(value, 'budgetMax', (entry) => numberIn(entry, 0, 1_000_000_000_000))
    && stringValue(value.currency)
    && booleanValue(value.seaView) && booleanValue(value.parking) && booleanValue(value.freeParking)
    && enumValue(value.cuisine, CUISINES)
    && optional(value, 'excludedCuisines', (entry) => arrayOf(entry, (item) => enumValue(item, CUISINES), 20))
    && booleanValue(value.variety) && numberIn(value.minRating, 0, 5)
    && integerIn(value.minReviews, 0, 1_000_000_000)
    && dateValue(value.checkin) && dateValue(value.checkout)
    && integerIn(value.travellers, 1, 100)
}

function trip(value: JsonRecord, ids: Set<string>, allowLocalFields: boolean) {
  if (!addUniqueId(value, ids) || !stringValue(value.name) || !stringValue(value.origin)
    || !stringArray(value.destinations, 100) || !dateValue(value.startDate) || !dateValue(value.endDate)
    || value.endDate < value.startDate || !integerIn(value.travellers, 1, 100)
    || !uniqueArray(value.members, member, 100)
    || !numberIn(value.budgetPerPerson, 0, 1_000_000_000_000)
    || !numberIn(value.totalBudget, 0, 1_000_000_000_000) || !stringValue(value.homeCurrency, 12)
    || !enumValue(value.theme, THEMES) || !stringValue(value.cover)
    || !arrayOf(value.transportModes, (entry) => enumValue(entry, TRANSPORT_MODES), 20)) return false

  const dayIds = new Set<string>(), placeIds = new Set<string>()
  if (!arrayOf(value.days, (entry) => {
    if (!record(entry) || !addUniqueId(entry, dayIds) || !dateValue(entry.date) || !stringValue(entry.city)
      || !weather(entry.weather) || !Array.isArray(entry.planA) || !Array.isArray(entry.planB)) return false
    const plansValid = arrayOf(entry.planA, (item) => record(item) && place(item, placeIds, allowLocalFields), 200)
      && arrayOf(entry.planB, (item) => record(item) && place(item, placeIds, allowLocalFields), 200)
    return plansValid && enumValue(entry.activePlan, PLAN_VARIANTS) && enumValue(entry.transportMode, TRANSPORT_MODES)
      && optional(entry, 'notes', stringValue) && optional(entry, 'stay', stringValue)
  }, 730)) return false

  return uniqueArray(value.saved, (item, itemIds) => savedItem(item, itemIds, allowLocalFields), 5000)
    && uniqueArray(value.compares, compareBoard, 500)
    && uniqueArray(value.bookings, booking, 5000)
    && uniqueArray(value.budget, budgetCategory, 500)
    && uniqueArray(value.expenses, expense, 10_000)
    && uniqueArray(value.gifts, gift, 5000)
    && stringValue(value.notes)
    && record(value.share) && enumValue(value.share.visibility, VISIBILITIES)
    && dateValue(value.createdAt)
    && optional(value, 'packing', packing)
    && optional(value, 'template', booleanValue)
    && (allowLocalFields || value.template !== true)
    && optional(value, 'weatherUpdatedAt', stringValue)
    && optional(value, 'decisionPreferences', decisionPreferences)
    && optional(value, 'mealSelections', (entry) => arrayOf(entry, (item) => record(item)
      && dateValue(item.date) && stringValue(item.city) && enumValue(item.cuisine, CUISINES) && stringValue(item.savedId), 2000))
}

export function isSyncSnapshot(value: unknown, { allowLocalFields = false }: SnapshotValidationOptions = {}): value is SyncSnapshot {
  if (!record(value) || value.schemaVersion !== 1 || !record(value.profile)) return false
  const profile = value.profile
  const profileKeys = new Set(['name', 'homeCity', 'homeCurrency', 'themePref', 'locale'])
  return Object.keys(profile).every((key) => profileKeys.has(key))
    && stringValue(profile.name, 250)
    && stringValue(profile.homeCity, 250)
    && stringValue(profile.homeCurrency, 12)
    && enumValue(profile.themePref, THEME_PREFERENCES)
    && optional(profile, 'locale', (entry) => enumValue(entry, LOCALES))
    && uniqueArray(value.trips, (entry, ids) => trip(entry, ids, allowLocalFields), 100)
}
