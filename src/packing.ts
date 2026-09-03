import { uid } from './lib'
import type { PackBag, PackCategory, PackItem, PackingState, Trip } from './types'

export const PACK_CATS: PackCategory[] = ['docs', 'money', 'keys', 'tech', 'clothes', 'toiletries', 'health', 'other']
export const PACK_BAGS: PackBag[] = ['suitcase', 'carryon', 'personal']
export const FLIGHT_TIPS = ['powerBank', 'liquids', 'lighter', 'knife', 'battery'] as const

type Seed = {
  catalogId: string
  category: PackCategory
  bag: PackBag
  qty?: number
  suggested?: boolean
}

const ESSENTIALS: Seed[] = [
  { catalogId: 'passport', category: 'docs', bag: 'personal' },
  { catalogId: 'idCard', category: 'docs', bag: 'personal' },
  { catalogId: 'bankCards', category: 'money', bag: 'personal' },
  { catalogId: 'wallet', category: 'money', bag: 'personal' },
  { catalogId: 'cash', category: 'money', bag: 'personal' },
  { catalogId: 'houseKeys', category: 'keys', bag: 'personal' },
  { catalogId: 'carKeys', category: 'keys', bag: 'personal' },
  { catalogId: 'phone', category: 'tech', bag: 'personal' },
  { catalogId: 'charger', category: 'tech', bag: 'carryon' },
  { catalogId: 'powerBank', category: 'tech', bag: 'carryon' },
  { catalogId: 'earphones', category: 'tech', bag: 'personal' },
  { catalogId: 'adapter', category: 'tech', bag: 'carryon' },
  { catalogId: 'toothbrush', category: 'toiletries', bag: 'carryon' },
  { catalogId: 'toothpaste', category: 'toiletries', bag: 'carryon' },
  { catalogId: 'skincare', category: 'toiletries', bag: 'suitcase' },
  { catalogId: 'meds', category: 'health', bag: 'carryon' },
  { catalogId: 'sunglasses', category: 'other', bag: 'personal' },
]

const RETURN_SEEDS: Seed[] = [
  { catalogId: 'souvenirs', category: 'other', bag: 'suitcase', qty: 1, suggested: true },
  { catalogId: 'hotelCharger', category: 'tech', bag: 'personal', qty: 1, suggested: true },
]

export function tripNights(trip: Trip) {
  return Math.max(1, trip.days.length)
}

export function weatherRange(trip: Trip) {
  if (!trip.days.length) return { tMin: 16, tMax: 24, rain: false, snow: false }
  return {
    tMin: Math.min(...trip.days.map((d) => d.weather.tMin)),
    tMax: Math.max(...trip.days.map((d) => d.weather.tMax)),
    rain: trip.days.some(
      (d) => d.weather.rainProb >= 45 || d.weather.condition === 'rain' || d.weather.condition === 'storm',
    ),
    snow: trip.days.some((d) => d.weather.condition === 'snow'),
  }
}

export function tripFlies(trip: Trip) {
  return (
    trip.transportModes.includes('flight') ||
    trip.days.some((d) => d.transportMode === 'flight') ||
    trip.bookings.some((b) => b.kind === 'flight') ||
    trip.saved.some((s) => s.kind === 'flight')
  )
}

function toItem(s: Seed): PackItem {
  return {
    id: uid(),
    catalogId: s.catalogId,
    name: '',
    category: s.category,
    bag: s.bag,
    qty: s.qty ?? 1,
    packedOut: false,
    packedBack: false,
    suggested: !!s.suggested,
  }
}

export function clothingSeeds(trip: Trip): Seed[] {
  const n = tripNights(trip)
  const w = weatherRange(trip)
  const out: Seed[] = [
    { catalogId: 'underwear', category: 'clothes', bag: 'suitcase', qty: n + 1, suggested: true },
    { catalogId: 'socks', category: 'clothes', bag: 'suitcase', qty: n + 1, suggested: true },
    { catalogId: 'pants', category: 'clothes', bag: 'suitcase', qty: Math.max(2, Math.ceil(n * 0.5)), suggested: true },
  ]
  if (w.tMax >= 20) {
    out.push({ catalogId: 'tees', category: 'clothes', bag: 'suitcase', qty: Math.max(2, Math.ceil(n * 0.7)), suggested: true })
  }
  if (w.tMin <= 18) {
    out.push({
      catalogId: 'longSleeve',
      category: 'clothes',
      bag: 'suitcase',
      qty: Math.max(1, Math.ceil(n * (w.tMin <= 12 ? 0.8 : 0.5))),
      suggested: true,
    })
  }
  if (w.tMin <= 14) {
    out.push({ catalogId: 'sweater', category: 'clothes', bag: 'suitcase', qty: w.tMin <= 8 ? 2 : 1, suggested: true })
  }
  if (w.tMin <= 8 || w.snow) {
    out.push({ catalogId: 'coat', category: 'clothes', bag: 'suitcase', qty: 1, suggested: true })
  }
  if (w.rain) {
    out.push({ catalogId: 'rainJacket', category: 'clothes', bag: 'carryon', qty: 1, suggested: true })
    out.push({ catalogId: 'umbrella', category: 'other', bag: 'personal', qty: 1, suggested: true })
  }
  if (w.tMax >= 26) {
    out.push({ catalogId: 'sunscreen', category: 'toiletries', bag: 'carryon', qty: 1, suggested: true })
    out.push({ catalogId: 'hat', category: 'other', bag: 'personal', qty: 1, suggested: true })
  }
  return out
}

function mergeSeeds(packing: PackingState, seeds: Seed[]): PackingState {
  const have = new Set(packing.items.map((i) => i.catalogId).filter(Boolean) as string[])
  const dismissed = new Set(packing.dismissed || [])
  const add = seeds.filter((s) => !have.has(s.catalogId) && !dismissed.has(s.catalogId)).map(toItem)
  const items = packing.items.map((item) => {
    if (!item.suggested || item.packedOut || !item.catalogId) return item
    const seed = seeds.find((s) => s.catalogId === item.catalogId)
    if (seed?.qty && seed.qty !== item.qty) return { ...item, qty: seed.qty }
    return item
  })
  return { ...packing, items: add.length ? [...items, ...add] : items }
}

export function emptyPacking(trip: Trip): PackingState {
  return {
    phase: 'out',
    groupBy: 'category',
    dismissed: [],
    items: [...ESSENTIALS.map(toItem), ...clothingSeeds(trip).map(toItem)],
  }
}

export function applyWeather(trip: Trip, packing: PackingState): PackingState {
  return mergeSeeds(packing, clothingSeeds(trip))
}

export function applyReturnExtras(packing: PackingState): PackingState {
  return mergeSeeds(packing, RETURN_SEEDS)
}

export function customPackItem(name: string, category: PackCategory, bag: PackBag): PackItem {
  return {
    id: uid(),
    name: name.trim(),
    category,
    bag,
    qty: 1,
    packedOut: false,
    packedBack: false,
  }
}
