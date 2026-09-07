import type { Coords, PlaceSetting, PlaceStop, TransportMode, WeatherSnap } from './types'
import { DEFAULT_RECOMMENDATION_PREFERENCES, normalizePlaceName, samePlace, scheduleSuggestion } from './recommendation'
import type { PlannedPlace, RecommendationPreferences } from './recommendation'
import { ticketSearchUrl } from './geo'

export type DaySuggestion = { title: string; vibe: string; rainFriendly: boolean; places: Omit<PlaceStop, 'id'>[] }
type LocalPlace = Omit<PlaceStop, 'id'> & { englishName: string }
type LocalSuggestion = Omit<DaySuggestion, 'places'> & { englishTitle: string; englishVibe: string; places: LocalPlace[] }
type SuggestInput = {
  city: string
  date?: string
  weather?: WeatherSnap
  existing?: string[]
  planned?: PlannedPlace[]
  apiUrl?: string
  locale?: 'zh' | 'en'
  preferences?: RecommendationPreferences
  signal?: AbortSignal
  anchor?: PlaceStop
}
export type SuggestionError = 'offline' | 'failed' | 'empty' | 'timeout' | 'unavailable'
export type SuggestionResult = { items: DaySuggestion[]; source: 'local' | 'api'; error?: SuggestionError }

function place(name: [string, string], coords: [number, number], time: string, durationMin: number, setting: PlaceSetting = 'outdoor', category = '景点'): LocalPlace {
  return { name: name[0], englishName: name[1], coords: { lat: coords[0], lng: coords[1] }, time, durationMin, category, setting, priority: 'want', transportToNext: 'public' }
}
function pack(title: [string, string], vibe: [string, string], places: LocalPlace[]): LocalSuggestion {
  return { title: title[0], englishTitle: title[1], vibe: vibe[0], englishVibe: vibe[1], rainFriendly: places.every((p) => p.setting === 'indoor'), places }
}

// Each route uses named places in one neighbourhood or nearby districts.
const PACKS: Record<string, LocalSuggestion[]> = {
  tokyo: [
    pack(['原宿到涩谷', 'Harajuku to Shibuya'], ['神社、竹下通、涩谷街景和傍晚观景台', 'Shrine grounds, Takeshita Street and an evening Shibuya viewpoint'], [
      place(['明治神宫', 'Meiji Jingu'], [35.6764, 139.6993], '09:00', 90),
      place(['竹下通', 'Takeshita Street'], [35.6716, 139.7031], '11:00', 60, 'outdoor', '购物'),
      place(['涩谷 PARCO', 'Shibuya PARCO'], [35.6618, 139.6983], '13:00', 75, 'indoor', '购物'),
      place(['涩谷十字路口', 'Shibuya Crossing'], [35.6595, 139.7004], '15:00', 30),
      { ...place(['涩谷天空', 'Shibuya Sky'], [35.658, 139.7026], '17:00', 80, 'mixed'), ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=Shibuya%20Sky' },
    ]),
    pack(['上野室内文化路线', 'Ueno museums'], ['上野公园周边的三座博物馆；馆际需步行', 'Three museums around Ueno Park; outdoor walks between venues'], [
      place(['东京国立博物馆', 'Tokyo National Museum'], [35.7188, 139.7765], '09:30', 120, 'indoor'),
      place(['国立科学博物馆', 'National Museum of Nature and Science'], [35.7163, 139.7765], '12:30', 90, 'indoor'),
      place(['国立西洋美术馆', 'National Museum of Western Art'], [35.7154, 139.7758], '14:30', 75, 'indoor'),
    ]),
    pack(['浅草与上野', 'Asakusa and Ueno'], ['浅草寺、仲见世通、上野公园和阿美横丁', 'Senso-ji, Nakamise Street, Ueno Park and Ameyoko'], [
      place(['浅草寺', 'Senso-ji'], [35.7148, 139.7967], '09:00', 75),
      place(['仲见世通', 'Nakamise Street'], [35.7117, 139.7963], '10:30', 45, 'outdoor', '购物'),
      place(['上野公园', 'Ueno Park'], [35.7148, 139.7714], '13:00', 75),
      place(['阿美横丁', 'Ameyoko'], [35.7107, 139.7745], '15:00', 60, 'mixed', '购物'),
    ]),
  ],
  kyoto: [
    pack(['东山步行路线', 'Higashiyama walk'], ['清水寺、二三年坂到祇园', 'Kiyomizu-dera, Ninenzaka and Sannenzaka, then Gion'], [
      place(['清水寺', 'Kiyomizu-dera'], [34.9949, 135.785], '09:00', 90),
      place(['二年坂 / 三年坂', 'Ninenzaka and Sannenzaka'], [34.9965, 135.7825], '11:00', 75),
      place(['祇园', 'Gion'], [35.0036, 135.7784], '14:00', 90),
    ]),
    pack(['京都站西侧室内路线', 'Museums near Kyoto Station'], ['铁道博物馆、水族馆和龙谷博物馆；馆际需步行', 'Railway museum, aquarium and Ryukoku Museum; outdoor walks between venues'], [
      place(['京都铁道博物馆', 'Kyoto Railway Museum'], [34.9873, 135.7441], '10:00', 120, 'indoor'),
      place(['京都水族馆', 'Kyoto Aquarium'], [34.9876, 135.7475], '12:30', 90, 'indoor'),
      place(['龙谷博物馆', 'Ryukoku Museum'], [34.9905, 135.7524], '15:00', 60, 'indoor'),
    ]),
    pack(['岚山半日', 'Arashiyama half-day'], ['竹林、天龙寺和渡月桥', 'Bamboo grove, Tenryu-ji and Togetsukyo Bridge'], [
      place(['岚山竹林', 'Arashiyama Bamboo Grove'], [35.017, 135.672], '09:00', 50),
      place(['天龙寺', 'Tenryu-ji'], [35.0159, 135.6736], '10:15', 75),
      place(['渡月桥', 'Togetsukyo Bridge'], [35.0126, 135.6778], '12:00', 45),
    ]),
  ],
  osaka: [
    pack(['难波与心斋桥', 'Namba and Shinsaibashi'], ['黑门市场、心斋桥和道顿堀', 'Kuromon Market, Shinsaibashi and Dotonbori'], [
      place(['黑门市场', 'Kuromon Market'], [34.6653, 135.5063], '10:00', 75, 'mixed', '餐饮'),
      place(['心斋桥', 'Shinsaibashi'], [34.6731, 135.5012], '13:00', 90, 'mixed', '购物'),
      place(['道顿堀', 'Dotonbori'], [34.6687, 135.5013], '17:00', 90, 'outdoor', '餐饮'),
    ]),
    pack(['中之岛室内路线', 'Nakanoshima museums'], ['科学馆与两座美术馆；馆际需步行', 'Science and art museums; outdoor walks between venues'], [
      place(['大阪市立科学馆', 'Osaka Science Museum'], [34.6913, 135.4915], '10:00', 90, 'indoor'),
      place(['国立国际美术馆', 'National Museum of Art, Osaka'], [34.6919, 135.492], '12:00', 90, 'indoor'),
      place(['大阪中之岛美术馆', 'Nakanoshima Museum of Art, Osaka'], [34.6922, 135.4908], '14:00', 90, 'indoor'),
    ]),
  ],
  fuji: [
    pack(['河口湖湖畔', 'Lake Kawaguchi'], ['大石公园和富士山全景缆车', 'Oishi Park and the Mt. Fuji Panoramic Ropeway'], [
      place(['大石公园', 'Oishi Park'], [35.5224, 138.7458], '10:00', 75),
      place(['富士山全景缆车', 'Mt. Fuji Panoramic Ropeway'], [35.5015, 138.766], '13:00', 90, 'mixed', '活动'),
    ]),
    pack(['河口湖北岸艺术路线', 'North-shore art museums'], ['久保田一竹与音乐森林；含室外园区', 'Itchiku Kubota and Music Forest museums; includes outdoor grounds'], [
      place(['久保田一竹美术馆', 'Itchiku Kubota Art Museum'], [35.5322, 138.7612], '10:00', 90, 'indoor'),
      place(['河口湖音乐森林美术馆', 'Kawaguchiko Music Forest Museum'], [35.5245, 138.7688], '12:00', 90, 'mixed'),
    ]),
  ],
  canggu: [
    pack(['Canggu 海边半日', 'Canggu beach afternoon'], ['Batu Bolong 到 Echo Beach；海滩沿线', 'Batu Bolong to Echo Beach along the coast'], [
      place(['Batu Bolong Beach', 'Batu Bolong Beach'], [-8.6595, 115.1305], '15:00', 75),
      place(['Echo Beach', 'Echo Beach'], [-8.655, 115.1256], '17:30', 60),
    ]),
  ],
  ubud: [
    pack(['Ubud 室内艺术路线', 'Ubud art museums'], ['Neka 与 Blanco 两座艺术馆；馆际需乘车', 'Neka and Blanco art museums; travel between venues'], [
      place(['Neka Art Museum', 'Neka Art Museum'], [-8.492, 115.2541], '10:00', 90, 'indoor'),
      place(['Blanco Renaissance Museum', 'Blanco Renaissance Museum'], [-8.5056, 115.2536], '13:00', 75, 'indoor'),
    ]),
  ],
}

function keyOf(city: string): string {
  const c = city.toLowerCase().trim()
  if (/\btokyo\b|东京|東京/.test(c)) return 'tokyo'
  if (/\bkyoto\b|京都/.test(c)) return 'kyoto'
  if (/\bosaka\b|大阪/.test(c)) return 'osaka'
  if (/\bfuji\b|\bkawaguchiko\b|河口湖|富士/.test(c)) return 'fuji'
  if (/\bcanggu\b|仓古|倉古/.test(c)) return 'canggu'
  if (/\bubud\b|乌布|烏布/.test(c)) return 'ubud'
  if (/\bbali\b|巴厘|峇里/.test(c)) return 'bali'
  return ''
}
function cityKey(city: string): string { return keyOf(city) || normalizePlaceName(city) }
function localPack(city: string): LocalSuggestion[] { return keyOf(city) === 'bali' ? [...PACKS.canggu, ...PACKS.ubud] : PACKS[keyOf(city)] || [] }

function prepared(items: DaySuggestion[], input: SuggestInput): DaySuggestion[] {
  const preferences = input.preferences || DEFAULT_RECOMMENDATION_PREFERENCES
  const existing = [...(input.existing || []).map((name) => ({ name })), ...(input.planned || []).filter((p) => !p.city || cityKey(p.city) === cityKey(input.city))]
  const rain = preferences.indoorOnly || (input.weather?.source === 'forecast' && (input.weather.rainProb || 0) >= 50)
  return items.map((suggestion) => {
    const places: Omit<PlaceStop, 'id'>[] = []
    for (const candidate of suggestion.places) {
      if (preferences.indoorOnly && candidate.setting !== 'indoor') continue
      if (existing.some((p) => samePlace(p, candidate)) || places.some((p) => samePlace(p, candidate))) continue
      places.push({ ...candidate, transportToNext: preferences.transportMode })
    }
    const filtered = places.length !== suggestion.places.length
    return {
      ...suggestion,
      title: filtered ? `${suggestion.title}${input.locale === 'en' ? ' · Selected stops' : ' · 精选'}` : suggestion.title,
      vibe: filtered ? places.map((p) => p.name).join(' → ') : suggestion.vibe,
      places,
      rainFriendly: places.length > 0 && places.every((p) => p.setting === 'indoor'),
    }
  }).filter((s) => s.places.length > 0).sort((a, b) => {
    const fitA = scheduleSuggestion(a.places, preferences, input.anchor)
    const fitB = scheduleSuggestion(b.places, preferences, input.anchor)
    const hasRoom = Number(fitB.places.length > 0) - Number(fitA.places.length > 0)
    if (hasRoom) return hasRoom
    const weatherRank = Number(b.rainFriendly === rain) - Number(a.rainFriendly === rain)
    if (weatherRank) return weatherRank
    return fitB.places.length - fitA.places.length || fitA.travelMinutes - fitB.travelMinutes
  }).slice(0, 3)
}

function localSuggestions(input: SuggestInput): DaySuggestion[] {
  return prepared(localPack(input.city).map((s) => ({
    title: input.locale === 'en' ? s.englishTitle : s.title,
    vibe: input.locale === 'en' ? s.englishVibe : s.vibe,
    rainFriendly: s.rainFriendly,
    places: s.places.map(({ englishName, ...p }) => ({ ...p, name: input.locale === 'en' ? englishName : p.name, coords: p.coords ? { ...p.coords } : undefined })),
  })), input)
}

function abortError() { return new DOMException('Recommendation cancelled', 'AbortError') }
function checkCancelled(signal?: AbortSignal) { if (signal?.aborted) throw abortError() }
class RequestTimeout extends Error { constructor() { super('Recommendation timed out'); this.name = 'TimeoutError' } }

// The deadline also covers response-body reads; cancellation listeners are always detached.
async function requestJson(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  checkCancelled(signal)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: (() => void) | undefined
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => { reject(abortError()); controller.abort() }
    signal?.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { reject(new RequestTimeout()); controller.abort() }, timeoutMs)
  })
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<unknown>
      })(), interrupted,
    ])
  } finally {
    clearTimeout(timer)
    if (cancel) signal?.removeEventListener('abort', cancel)
  }
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function cleanText(value: unknown, max: number): string { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '' }
function groundedText(value: unknown, max: number): string {
  return cleanText(value, max).split(/(?<=[!?。！？;；]|\.(?!\d))\s*/).filter((s) => !/小红书|小紅書|instagram|tiktok|social media|viral|网红|網紅|人气|人氣|爆红|爆紅|热度|熱度|评分|評分|热门|熱門|排队|排隊|top.rated|most popular|google.*review|\d(?:\.\d)?\s*(?:stars?|\/5)/i.test(s)).join(' ').trim()
}
function parseSuggestions(data: unknown, input: SuggestInput): DaySuggestion[] {
  if (!record(data)) return []
  let decoded: unknown = data
  if (!Array.isArray(data.suggestions)) {
    const choices = Array.isArray(data.choices) ? data.choices : []
    const choice = choices[0]
    const message = record(choice) && record(choice.message) ? choice.message : undefined
    const content = typeof message?.content === 'string' ? message.content : data.output_text
    if (typeof content !== 'string' || content.length > 100_000) return []
    decoded = JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim())
  }
  const list = Array.isArray(decoded) ? decoded : record(decoded) ? decoded.suggestions : undefined
  if (!Array.isArray(list)) return []
  const categories: Record<string, string> = { '景点': '景点', '餐饮': '餐饮', '活动': '活动', '购物': '购物', sight: '景点', attraction: '景点', restaurant: '餐饮', cafe: '餐饮', activity: '活动', shopping: '购物' }
  const settings: PlaceSetting[] = ['indoor', 'outdoor', 'mixed']
  const modes: TransportMode[] = ['walking', 'public', 'taxi', 'self-drive', 'cycling', 'mixed']
  const result: DaySuggestion[] = []
  for (const s of list.slice(0, 3)) {
    if (!record(s) || !Array.isArray(s.places) || !cleanText(s.title, 100)) continue
    const places: Omit<PlaceStop, 'id'>[] = []
    for (const pl of s.places.slice(0, 8)) {
      if (!record(pl)) continue
      const name = cleanText(pl.name, 120)
      if (!name || /主景点|主景點|博物馆或|博物館或|咖啡馆躲|咖啡館躲|当地餐厅|當地餐廳|local (?:cafe|restaurant)|main (?:sight|attraction)|restaurant of (?:your )?choice/i.test(name)) continue
      const ticketNeeded = pl.ticketNeeded === true
      const category = cleanText(pl.category, 40).toLowerCase()
      places.push({
        name,
        category: Object.hasOwn(categories, category) ? categories[category] : '景点',
        setting: settings.includes(pl.setting as PlaceSetting) ? pl.setting as PlaceSetting : 'mixed',
        time: typeof pl.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(pl.time) ? pl.time : undefined,
        durationMin: typeof pl.durationMin === 'number' && Number.isFinite(pl.durationMin) && pl.durationMin > 0 ? Math.max(15, Math.min(480, Math.round(pl.durationMin))) : 60,
        notes: groundedText(pl.notes, 400) || undefined,
        ticketNeeded,
        ticketUrl: ticketNeeded ? ticketSearchUrl(name, input.city) : undefined,
        priority: pl.priority === 'must' || pl.priority === 'optional' ? pl.priority : 'want',
        transportToNext: modes.includes(pl.transportToNext as TransportMode) ? pl.transportToNext as TransportMode : 'public',
      })
    }
    if (places.length) result.push({ title: groundedText(s.title, 100) || input.city, vibe: groundedText(s.vibe, 240), rainFriendly: false, places })
  }
  return prepared(result, input)
}

const geoCache = new Map<string, { coords: Coords; address?: string }>()
async function enrichApi(items: DaySuggestion[], input: SuggestInput): Promise<DaySuggestion[]> {
  const known = localPack(input.city).flatMap((s) => s.places)
  const work = new Map<string, Omit<PlaceStop, 'id'>[]>()
  for (const item of items) for (const p of item.places) {
    const local = known.find((k) => samePlace(p, k) || samePlace(p, { ...k, name: k.englishName }))
    if (local?.coords) { p.coords = { ...local.coords }; continue }
    const cacheKey = `${cityKey(input.city)}:${normalizePlaceName(p.name)}`
    const cached = geoCache.get(cacheKey)
    if (cached) { Object.assign(p, cached); continue }
    if (work.has(cacheKey)) work.get(cacheKey)!.push(p)
    else if (work.size < 8) work.set(cacheKey, [p])
  }
  const queue = [...work]
  const run = async () => {
    while (queue.length) {
      checkCancelled(input.signal)
      const [cacheKey, places] = queue.shift()!
      try {
        const data = await requestJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(`${places[0].name}, ${input.city}`)}&limit=3`, {}, 3_500, input.signal)
        if (!record(data) || !Array.isArray(data.features)) continue
        for (const feature of data.features) {
          if (!record(feature) || !record(feature.geometry) || !record(feature.properties) || !Array.isArray(feature.geometry.coordinates)) continue
          const [lng, lat] = feature.geometry.coordinates
          if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) continue
          const properties = feature.properties
          if (typeof properties.name !== 'string' || !samePlace(places[0], { name: properties.name })) continue
          const region = [properties.city, properties.county, properties.state, properties.district].filter((v): v is string => typeof v === 'string')
          if (!region.some((r) => cityKey(r) === cityKey(input.city))) continue
          const hit = { coords: { lat, lng }, address: [properties.name, properties.street, properties.city, properties.country].filter((v) => typeof v === 'string').join(', ') }
          if (geoCache.size >= 100) geoCache.delete(geoCache.keys().next().value!)
          geoCache.set(cacheKey, hit)
          places.forEach((p) => Object.assign(p, hit))
          break
        }
      } catch (error) { checkCancelled(input.signal); if (error instanceof Error && error.name === 'AbortError') throw error }
    }
  }
  await Promise.all([run(), run()])
  checkCancelled(input.signal)
  for (const item of items) for (const p of item.places) if (!p.coords) p.locationPending = true
  return items
}

export async function enrichSuggestedPlaces(places: Omit<PlaceStop, 'id'>[], input: Pick<SuggestInput, 'city' | 'signal'>) {
  const copy = places.map((place) => ({ ...place, coords: place.coords ? { ...place.coords } : undefined }))
  const items = await enrichApi([{ title: '', vibe: '', rainFriendly: false, places: copy }], { city: input.city, signal: input.signal })
  return items[0]?.places || copy
}

async function fromBackend(input: SuggestInput): Promise<DaySuggestion[]> {
  const preferences = input.preferences || DEFAULT_RECOMMENDATION_PREFERENCES
  const existing: string[] = []
  for (const name of input.existing || []) {
    if (!existing.some((saved) => samePlace({ name: saved }, { name }))) existing.push(name)
    if (existing.length === 100) break
  }
  const planned: PlannedPlace[] = []
  for (const place of input.planned || []) {
    if (place.city && cityKey(place.city) !== cityKey(input.city)) continue
    if (existing.some((name) => samePlace({ name }, place)) || planned.some((saved) => samePlace(saved, place))) continue
    planned.push({ name: place.name, date: place.date, city: place.city })
    if (planned.length === 150) break
  }
  const data = await requestJson(input.apiUrl!, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', credentials: 'same-origin',
    body: JSON.stringify({
      city: input.city.slice(0, 160), date: input.date,
      weather: input.weather?.source === 'placeholder' ? undefined : input.weather,
      existing,
      planned,
      locale: input.locale || 'zh', preferences,
      anchor: input.anchor ? { name: input.anchor.name, time: input.anchor.time, durationMin: input.anchor.durationMin } : undefined,
    }),
  }, 35_000, input.signal)
  return parseSuggestions(data, input)
}

export async function suggestDays(input: SuggestInput): Promise<SuggestionResult> {
  checkCancelled(input.signal)
  if (!input.apiUrl?.trim()) {
    const items = localSuggestions(input)
    return { items, source: 'local', error: items.length ? undefined : localPack(input.city).length ? 'empty' : 'unavailable' }
  }
  try {
    const items = await fromBackend(input)
    checkCancelled(input.signal)
    if (items.length) return { items, source: 'api' }
    return { items: localSuggestions(input), source: 'local', error: 'empty' }
  } catch (error) {
    checkCancelled(input.signal)
    if (error instanceof Error && error.name === 'AbortError') throw error
    return { items: localSuggestions(input), source: 'local', error: error instanceof RequestTimeout ? 'timeout' : error instanceof TypeError ? 'offline' : 'failed' }
  }
}
