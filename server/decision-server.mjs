import http from 'node:http'
import { pathToFileURL } from 'node:url'

const GOOGLE_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const FIELDS = ['id', 'displayName', 'formattedAddress', 'addressComponents', 'googleMapsUri', 'websiteUri', 'rating', 'userRatingCount', 'businessStatus', 'types', 'parkingOptions', 'priceRange', 'attributions'].map(field => `places.${field}`).join(',')
const CUISINES = ['any', 'mexican', 'japanese', 'italian', 'thai', 'chinese', 'indian', 'korean', 'vietnamese', 'local']
const HOTEL_TYPES = new Set(['hotel', 'lodging', 'guest_house', 'motel', 'resort_hotel', 'hostel', 'bed_and_breakfast', 'extended_stay_hotel'])
const LOCAL_ORIGINS = [5173, 5174, 5175, 4173, 8787].flatMap(port => [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`])
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']
const BODY_LIMIT = 16 * 1024
const GEOGRAPHY_ALIASES = [
  ['Melbourne', '墨尔本', '墨爾本'], ['Sydney', '悉尼', '雪梨'], ['Brisbane', '布里斯班'],
  ['Gold Coast', '黄金海岸', '黃金海岸'], ['Cairns', '凯恩斯', '凱恩斯'], ['Perth', '珀斯'], ['Adelaide', '阿德莱德'],
  ['Tokyo', 'Tokyo Metropolis', '东京', '東京', '東京都', '东京都'], ['Osaka', '大阪', '大阪市', '大阪府'], ['Kyoto', '京都', '京都市', '京都府'],
  ['Seoul', '首尔', '首爾', '서울', '서울특별시'], ['Singapore', '新加坡'], ['Hong Kong', '香港'],
  ['Bangkok', '曼谷', 'Krung Thep Maha Nakhon', 'กรุงเทพมหานคร'], ['Paris', '巴黎'], ['London', '伦敦', '倫敦'],
  ['New York', 'New York City', '纽约', '紐約'], ['Auckland', '奥克兰', '奧克蘭'],
  ['Wellington', '惠灵顿'], ['Queenstown', '皇后镇'], ['Bali', '巴厘岛', '巴厘', '峇里島'], ['Canggu', '仓古', '倉古', '坎古'],
]
const COUNTRY_ALIASES = [
  ['AU', 'Australia', '澳大利亚', '澳大利亞', '澳洲'], ['JP', 'Japan', '日本'], ['ID', 'Indonesia', '印度尼西亚', '印度尼西亞', '印尼'],
  ['NZ', 'New Zealand', '新西兰', '紐西蘭'], ['US', 'USA', 'United States', 'United States of America', '美国', '美國'],
  ['GB', 'UK', 'United Kingdom', '英国', '英國'], ['FR', 'France', '法国', '法國'], ['CN', 'China', '中国', '中國'],
  ['KR', 'South Korea', '韩国', '韓國'], ['SG', 'Singapore', '新加坡'], ['TH', 'Thailand', '泰国', '泰國'],
  ['CA', 'Canada', '加拿大'], ['HK', 'Hong Kong', '香港'],
]
const geographicName = value => typeof value === 'string' ? value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\s\p{P}]/gu, '') : ''
const aliasLookup = groups => new Map(groups.flatMap(aliases => aliases.map(alias => [geographicName(alias), geographicName(aliases[0])])))
const geographicAliases = aliasLookup(GEOGRAPHY_ALIASES), countryAliases = aliasLookup(COUNTRY_ALIASES)
const canonicalGeography = value => geographicAliases.get(geographicName(value)) || geographicName(value)
const canonicalCountry = value => countryAliases.get(geographicName(value)) || geographicName(value)

/** Match complete geographic components, including parent regions; never infer city from a business name. */
export function matchesRequestedGeography(components, requestedCity) {
  if (!Array.isArray(components) || !cleanText(requestedCity, 120)) return false
  const regions = new Set(), countries = new Set()
  for (const component of components) {
    if (!object(component) || !Array.isArray(component.types)) continue
    const values = [component.longText, component.shortText].filter(value => cleanText(value, 250))
    if (component.types.includes('country')) values.forEach(value => countries.add(canonicalCountry(value)))
    if (component.types.some(type => ['locality', 'postal_town', 'sublocality', 'neighborhood'].includes(type)
      || /^administrative_area_level_[1-7]$/.test(type) || /^sublocality_level_[1-5]$/.test(type))) {
      values.forEach(value => regions.add(canonicalGeography(value)))
    }
  }
  // City-states can be returned as a country component alone.
  if (countries.has('sg')) regions.add(canonicalGeography('Singapore'))
  if (countries.has('hk')) regions.add(canonicalGeography('Hong Kong'))
  const parts = requestedCity.split(/[,，/|]/).map(value => value.trim()).filter(Boolean)
  let matchedRegion = false
  const matched = parts.length > 0 && parts.every(part => {
    const region = canonicalGeography(part)
    if (regions.has(region)) { matchedRegion = true; return true }
    return countries.has(canonicalCountry(part))
  })
  return matched && matchedRegion
}

class RequestError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const cleanText = (value, max) => typeof value === 'string' && value.trim() && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : undefined
const date = value => value === '' || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

export function validateDecisionRequest(body) {
  const p = body?.preferences
  if (!object(body) || !object(p) || !['zh', 'en'].includes(body.locale)
    || !['hotel', 'restaurant'].includes(p.kind) || !cleanText(p.city, 120)
    || typeof p.currency !== 'string' || !/^[A-Z]{3}$/.test(p.currency)
    || !CUISINES.includes(p.cuisine) || !finite(p.minRating, 0, 5)
    || !Number.isInteger(p.minReviews) || !finite(p.minReviews, 0, 100000000)
    || !Number.isInteger(p.travellers) || !finite(p.travellers, 1, 30)
    || !['seaView', 'parking', 'freeParking', 'variety'].every(key => typeof p[key] === 'boolean')
    || p.budgetMax !== undefined && !finite(p.budgetMax, 0.01, 1000000)
    || !date(p.checkin) || !date(p.checkout)
    || p.kind === 'hotel' && (Boolean(p.checkin) !== Boolean(p.checkout) || p.checkin && p.checkout <= p.checkin)
    || p.excludedCuisines !== undefined && (!Array.isArray(p.excludedCuisines) || p.excludedCuisines.length > CUISINES.length || p.excludedCuisines.some(cuisine => !CUISINES.includes(cuisine)))) {
    throw new RequestError(400, 'invalid_request')
  }
  return { preferences: { kind: p.kind, city: p.city.trim(), currency: p.currency, cuisine: p.cuisine,
    seaView: p.seaView, parking: p.parking, freeParking: p.freeParking, variety: p.variety,
    minRating: p.minRating, minReviews: p.minReviews, travellers: p.travellers,
    ...(p.excludedCuisines ? { excludedCuisines: [...new Set(p.excludedCuisines)] } : {}),
    checkin: p.checkin, checkout: p.checkout, ...(p.budgetMax === undefined ? {} : { budgetMax: p.budgetMax }) }, locale: body.locale }
}

function webUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}
function googleMapsUrl(value) {
  const safe = webUrl(value)
  if (!safe) return undefined
  const url = new URL(safe)
  return url.protocol === 'https:' && (url.hostname === 'maps.google.com' || url.hostname === 'www.google.com' && url.pathname.startsWith('/maps') || url.hostname === 'maps.app.goo.gl') ? safe : undefined
}
function parking(options) {
  if (!object(options)) return 'unknown'
  if (options.freeParkingLot === true || options.freeGarageParking === true) return 'free'
  if (options.paidParkingLot === true || options.paidGarageParking === true) return 'paid'
  // Street parking and valet alone do not establish an on-site parking lot.
  const onsite = ['freeParkingLot', 'paidParkingLot', 'freeGarageParking', 'paidGarageParking']
  return onsite.every(key => options[key] === false) ? 'none' : 'unknown'
}
function money(value) {
  if (!object(value) || !/^[A-Z]{3}$/.test(value.currencyCode ?? '') || !/^(0|[1-9]\d{0,8})$/.test(String(value.units ?? '0'))
    || !Number.isInteger(value.nanos ?? 0) || !finite(value.nanos ?? 0, 0, 999999999)) return undefined
  return { value: Number(value.units ?? 0) + (value.nanos ?? 0) / 1e9, currency: value.currencyCode }
}
function restaurantPrice(range) {
  const min = money(range?.startPrice), max = money(range?.endPrice)
  // An open-ended range cannot confirm a maximum budget.
  if (!max || max.value <= 0 || min && (min.currency !== max.currency || min.value > max.value)) return undefined
  return { ...(min ? { min: min.value } : {}), max: max.value, currency: max.currency, basis: 'person' }
}

export function mapGooglePlace(place, preferences, fetchedAt) {
  if (!object(place) || place.businessStatus !== 'OPERATIONAL') return undefined
  if (!matchesRequestedGeography(place.addressComponents, preferences.city)) return undefined
  const name = cleanText(place.displayName?.text, 250), id = cleanText(place.id, 250)
  const types = Array.isArray(place.types) ? place.types.filter(type => typeof type === 'string') : []
  if (!name || !id || !/^[A-Za-z0-9_-]+$/.test(id)) return undefined
  if (preferences.kind === 'hotel' ? !types.some(type => HOTEL_TYPES.has(type)) : !types.some(type => type === 'restaurant' || type.endsWith('_restaurant'))) return undefined
  const sourceUrl = googleMapsUrl(place.googleMapsUri) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(id)}`
  const rating = finite(place.rating, 1, 5) ? { value: place.rating, sourceUrl,
    ...(Number.isInteger(place.userRatingCount) && finite(place.userRatingCount, 0, 100000000) ? { count: place.userRatingCount } : {}) } : undefined
  const attributions = Array.isArray(place.attributions) ? place.attributions.slice(0, 20).flatMap(item => {
    const name = cleanText(item?.provider, 250)
    return name ? [{ name, ...(webUrl(item.providerUri) ? { url: webUrl(item.providerUri) } : {}) }] : []
  }) : []
  // city is the verified requested search area; formattedAddress retains the more specific locality.
  return { id: `google:${id}`, kind: preferences.kind, name, city: preferences.city,
    address: cleanText(place.formattedAddress, 500), source: 'google', sourceUrl, mapsUrl: sourceUrl,
    websiteUrl: webUrl(place.websiteUri), checkedAt: fetchedAt, rating, attributions,
    cuisines: preferences.kind === 'restaurant' ? CUISINES.filter(cuisine => types.includes(`${cuisine}_restaurant`)) : [],
    parking: parking(place.parkingOptions), seaView: 'unknown',
    price: preferences.kind === 'restaurant' ? restaurantPrice(place.priceRange) : undefined }
}

async function readBody(req) {
  if (Number(req.headers['content-length'] || 0) > BODY_LIMIT) throw new RequestError(413, 'request_too_large')
  const chunks = []; let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) throw new RequestError(413, 'request_too_large')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new RequestError(400, 'invalid_request') }
}

async function readGoogleJson(response) {
  if (Number(response.headers.get('content-length') || 0) > 512 * 1024) throw new RequestError(502, 'provider_invalid_response')
  const reader = response.body?.getReader()
  if (!reader) throw new RequestError(502, 'provider_invalid_response')
  const chunks = []; let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 512 * 1024) throw new RequestError(502, 'provider_invalid_response')
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { await reader.cancel().catch(() => {}) }
}

export function createDecisionServer({ apiKey = process.env.GOOGLE_PLACES_API_KEY || '', fetchImpl = globalThis.fetch,
  allowedOrigins = [...LOCAL_ORIGINS, ...(process.env.DECISION_ALLOWED_ORIGINS || '').split(',').filter(Boolean)],
  allowedHosts = [...LOCAL_HOSTS, ...(process.env.DECISION_ALLOWED_HOSTS || '').split(',').filter(Boolean)],
  timeoutMs = 10000, rateLimit = 30, rateWindowMs = 60000, now = Date.now } = {}) {
  const origins = new Set(allowedOrigins.map(value => value.trim()))
  const hosts = new Set(allowedHosts.map(value => value.trim()))
  const requests = new Map()
  const send = (res, status, body) => {
    if (res.destroyed || res.writableEnded) return
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(JSON.stringify(body))
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Vary', 'Origin')
    let controller, timer
    const disconnect = () => { if (!res.writableEnded) controller?.abort() }
    try {
      let host
      try { host = new URL(`http://${req.headers.host}`).hostname } catch { /* rejected below */ }
      if (!hosts.has(host)) throw new RequestError(403, 'host_not_allowed')
      const origin = req.headers.origin
      if (origin && !origins.has(origin)) throw new RequestError(403, 'origin_not_allowed')
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
      if (req.url !== '/api/decisions/search') throw new RequestError(404, 'not_found')
      if (req.method === 'OPTIONS') {
        if (!origin || req.headers['access-control-request-method'] !== 'POST'
          || String(req.headers['access-control-request-headers'] || '').split(',').some(header => header.trim() && header.trim().toLowerCase() !== 'content-type')) throw new RequestError(403, 'origin_not_allowed')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        send(res, 204, undefined); return
      }
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); throw new RequestError(405, 'method_not_allowed') }
      if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type'] || '')) throw new RequestError(415, 'json_required')
      const time = now(), address = req.socket.remoteAddress || 'unknown'
      for (const [key, entry] of requests) if (time - entry.start >= rateWindowMs) requests.delete(key)
      const entry = requests.get(address) || { count: 0, start: time }
      if (++entry.count > rateLimit) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rateWindowMs - time + entry.start) / 1000))))
        throw new RequestError(429, 'rate_limited')
      }
      if (requests.size >= 10000 && !requests.has(address)) throw new RequestError(429, 'rate_limited')
      requests.set(address, entry)
      const { preferences: p, locale } = validateDecisionRequest(await readBody(req))
      if (!apiKey.trim()) throw new RequestError(503, 'provider_not_configured')
      controller = new AbortController()
      let timedOut = false
      timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      res.on('close', disconnect)
      const category = p.kind === 'hotel' ? `${p.seaView ? 'sea view ' : ''}hotels` : `${!['any', 'local'].includes(p.cuisine) ? `${p.cuisine} ` : ''}restaurants`
      const body = { textQuery: `${category} in ${p.city}${p.parking || p.freeParking ? ' with parking' : ''}`, pageSize: 20, languageCode: locale === 'zh' ? 'zh-CN' : 'en',
        ...(p.kind === 'restaurant' ? { includedType: 'restaurant', strictTypeFiltering: true } : {}) }
      let data
      try {
        const upstream = await fetchImpl(GOOGLE_SEARCH_URL, { method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS }, body: JSON.stringify(body) })
        if (!upstream.ok) { await upstream.body?.cancel().catch(() => {}); throw new RequestError(upstream.status === 429 ? 429 : 502, upstream.status === 429 ? 'rate_limited' : 'provider_failed') }
        data = await readGoogleJson(upstream)
      } catch (error) {
        if (timedOut) throw new RequestError(504, 'provider_timeout')
        if (error instanceof RequestError) throw error
        throw new RequestError(502, 'provider_failed')
      }
      if (!object(data) || data.places !== undefined && !Array.isArray(data.places)) throw new RequestError(502, 'provider_invalid_response')
      const fetchedAt = new Date(now()).toISOString()
      const seen = new Set()
      const candidates = (data.places || []).slice(0, 20).map(place => mapGooglePlace(place, p, fetchedAt)).filter(candidate => {
        if (!candidate || seen.has(candidate.id)) return false
        seen.add(candidate.id); return true
      })
      send(res, 200, { candidates, source: 'google', fetchedAt })
    } catch (error) {
      send(res, error instanceof RequestError ? error.status : 500, { error: error instanceof RequestError ? error.code : 'internal_error' })
    } finally { clearTimeout(timer); res.off('close', disconnect) }
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  server.keepAliveTimeout = 5000
  server.maxRequestsPerSocket = 100
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DECISION_PORT || 8787)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DECISION_PORT must be between 1 and 65535')
  // Keep the private-key service on loopback. Publish through an authenticated reverse proxy.
  const server = createDecisionServer()
  server.listen(port, '127.0.0.1', () => {
    console.info(`Decision provider listening on http://127.0.0.1:${port}`)
    if (!process.env.GOOGLE_PLACES_API_KEY) console.info('Live search is disabled until GOOGLE_PLACES_API_KEY is configured.')
  })
}
