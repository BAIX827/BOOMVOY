import type { Coords, PlaceStop, TransportMode } from './types'

export type RecommendationPreferences = {
  pace: 'relaxed' | 'balanced' | 'full'
  startTime: string
  endTime: string
  transportMode: TransportMode
  indoorOnly: boolean
}

export type PlannedPlace = { name: string; date: string; city?: string; coords?: Coords }

export const DEFAULT_RECOMMENDATION_PREFERENCES: RecommendationPreferences = {
  pace: 'balanced', startTime: '09:00', endTime: '19:00', transportMode: 'public', indoorOnly: false,
}

function nameKey(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

// Explicit aliases avoid treating nearby but distinct landmarks as duplicates.
const PLACE_ALIASES = [
  ['明治神宫', '明治神宮', 'Meiji Jingu', 'Meiji Shrine', 'Meiji Jingu Shrine'],
  ['原宿 Takeshita', '竹下通', 'Takeshita Street', 'Takeshita Dori'],
  ['涩谷十字路口', '澀谷十字路口', 'Shibuya Crossing', 'Shibuya Scramble Crossing'],
  ['涩谷 Sky', '涩谷天空', 'Shibuya Sky'],
  ['涩谷 PARCO', 'Shibuya PARCO'],
  ['浅草寺', '淺草寺', 'Sensoji', 'Senso-ji', 'Senso-ji Temple', 'Sensoji Temple'],
  ['仲见世通', '仲見世通', 'Nakamise Street', 'Nakamise Shopping Street', 'Nakamise Dori'],
  ['上野公园', '上野公園', 'Ueno Park'],
  ['Ameyoko 吃喝', '阿美横丁', '阿美橫丁', 'Ameyoko', 'Ameyoko Shopping Street'],
  ['东京国立博物馆', '東京國立博物館', 'Tokyo National Museum'],
  ['国立科学博物馆', '國立科學博物館', 'National Museum of Nature and Science'],
  ['国立西洋美术馆', '國立西洋美術館', 'National Museum of Western Art'],
  ['伏见稻荷大社', '伏見稻荷大社', 'Fushimi Inari', 'Fushimi Inari Taisha', 'Fushimi Inari Shrine'],
  ['清水寺', 'Kiyomizu-dera', 'Kiyomizu-dera Temple', 'Kiyomizu Temple'],
  ['二年坂 / 三年坂', '二年坂三年坂', 'Ninenzaka and Sannenzaka'],
  ['祇园', '祇園', 'Gion'],
  ['京都铁道博物馆', '京都鐵道博物館', 'Kyoto Railway Museum'],
  ['京都水族馆', '京都水族館', 'Kyoto Aquarium'],
  ['龙谷博物馆', '龍谷博物館', 'Ryukoku Museum'],
  ['锦市场', '錦市場', 'Nishiki Market'],
  ['京都国立博物馆', '京都國立博物館', 'Kyoto National Museum'],
  ['岚山竹林', '嵐山竹林', 'Arashiyama Bamboo Grove', 'Arashiyama Bamboo Forest'],
  ['天龙寺', '天龍寺', 'Tenryu-ji', 'Tenryuji Temple'],
  ['渡月桥', '渡月橋', 'Togetsukyo Bridge'],
  ['金阁寺', '金閣寺', 'Kinkaku-ji', 'Kinkakuji', 'Golden Pavilion'],
  ['大阪城', 'Osaka Castle'],
  ['道顿堀', '道頓堀', 'Dotonbori'],
  ['心斋桥', '心齋橋', 'Shinsaibashi', 'Shinsaibashi-suji Shopping Street'],
  ['黑门市场', '黑門市場', 'Kuromon Market', 'Kuromon Ichiba Market'],
  ['海游馆', '海遊館', 'Osaka Aquarium', 'Osaka Aquarium Kaiyukan', 'Kaiyukan'],
  ['大阪市立科学馆', '大阪市立科學館', 'Osaka Science Museum'],
  ['大阪中之岛美术馆', '大阪中之島美術館', 'Nakanoshima Museum of Art, Osaka'],
  ['国立国际美术馆', '國立國際美術館', 'National Museum of Art, Osaka'],
  ['忍野八海', 'Oshino Hakkai'],
  ['大石公园', '大石公園', 'Oishi Park'],
  ['富士山全景缆车', '富士山全景纜車', 'Mt. Fuji Panoramic Ropeway', 'Mt Fuji Panoramic Ropeway'],
  ['久保田一竹美术馆', '久保田一竹美術館', 'Itchiku Kubota Art Museum'],
  ['河口湖音乐森林美术馆', '河口湖音樂森林美術館', 'Kawaguchiko Music Forest Museum'],
  ['Echo Beach 日落', 'Echo Beach'],
]
const aliases = new Map(PLACE_ALIASES.flatMap((names) => names.map((name) => [nameKey(name), nameKey(names[0])])))

export function normalizePlaceName(name: string): string {
  const key = nameKey(name)
  return aliases.get(key) || key
}

function validCoords(coords?: Coords): coords is Coords {
  return !!coords && Number.isFinite(coords.lat) && Math.abs(coords.lat) <= 90 && Number.isFinite(coords.lng) && Math.abs(coords.lng) <= 180
}

function distance(a: Coords, b: Coords): number {
  const rad = Math.PI / 180
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

export function samePlace(a: { name: string; coords?: Coords }, b: { name: string; coords?: Coords }): boolean {
  const name = normalizePlaceName(a.name)
  if (!name || name !== normalizePlaceName(b.name)) return false
  return !validCoords(a.coords) || !validCoords(b.coords) || distance(a.coords, b.coords) <= 1
}

export function recommendationTravelMinutes(a: { coords?: Coords }, b: { coords?: Coords }, mode: TransportMode): number {
  if (!validCoords(a.coords) || !validCoords(b.coords)) return mode === 'walking' ? 35 : 30
  const km = distance(a.coords, b.coords) * 1.3
  if (km < 0.03) return 0
  if (mode === 'walking' || (mode === 'mixed' && km < 1)) return Math.ceil(km / 4.3 * 60)
  if (mode === 'cycling') return Math.ceil(km / 13 * 60 + 5)
  if (mode === 'taxi' || mode === 'self-drive') return Math.ceil(km / 25 * 60 + 8)
  return Math.ceil(km / 18 * 60 + 12)
}

function minutes(time?: string): number | undefined {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function formatTime(value: number): string {
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}

export function scheduleSuggestion(places: Omit<PlaceStop, 'id'>[], preferences: RecommendationPreferences, anchor?: PlaceStop) {
  const start = minutes(preferences.startTime)
  const end = minutes(preferences.endTime)
  const out: Omit<PlaceStop, 'id'>[] = []
  const empty = { places: out, omitted: places.length, travelMinutes: 0, totalMinutes: 0, distanceKm: 0, unlocated: 0 }
  if (start === undefined || end === undefined || start >= end) return empty
  const pace = { relaxed: { limit: 3, buffer: 15, duration: 75 }, balanced: { limit: 5, buffer: 10, duration: 60 }, full: { limit: 7, buffer: 5, duration: 45 } }[preferences.pace] || { limit: 5, buffer: 10, duration: 60 }
  const anchorDuration = anchor && Number.isFinite(anchor.durationMin) && anchor.durationMin! > 0 ? Math.round(anchor.durationMin!) : 60
  const initial = anchor ? Math.max(start, (minutes(anchor.time) ?? start) + anchorDuration) : start
  let cursor = initial
  let previous: Omit<PlaceStop, 'id'> | undefined = anchor
  let travelMinutes = 0
  let distanceKm = 0
  for (const candidate of places) {
    if (out.length >= pace.limit) break
    if (!candidate.name.trim() || (preferences.indoorOnly && candidate.setting !== 'indoor')) continue
    if ((anchor && samePlace(anchor, candidate)) || out.some((place) => samePlace(place, candidate))) continue
    const travel = previous ? recommendationTravelMinutes(previous, candidate, preferences.transportMode) : 0
    const buffer = previous ? pace.buffer : 0
    const from = Math.max(cursor + travel + buffer, minutes(candidate.time) ?? start)
    const duration = Number.isFinite(candidate.durationMin) && candidate.durationMin! > 0 ? Math.max(15, Math.min(480, Math.round(candidate.durationMin!))) : pace.duration
    if (from + duration > end) continue
    const place = { ...candidate, time: formatTime(from), durationMin: duration, transportToNext: preferences.transportMode }
    out.push(place)
    travelMinutes += travel
    if (validCoords(previous?.coords) && validCoords(place.coords)) distanceKm += distance(previous.coords, place.coords) * 1.3
    previous = place
    cursor = from + duration
  }
  return {
    places: out,
    omitted: places.length - out.length,
    travelMinutes,
    totalMinutes: out.length ? cursor - (anchor ? initial : minutes(out[0].time)!) : 0,
    distanceKm: Math.round(distanceKm * 10) / 10,
    unlocated: out.filter((place) => !validCoords(place.coords)).length,
  }
}
