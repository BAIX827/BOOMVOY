export function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = []
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(toISODate(d))
  }
  return out
}

export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(iso: string) {
  return new Date(iso + 'T00:00:00')
}

type DateLocale = 'zh' | 'en'

const WEEK_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatDay(iso: string, locale: DateLocale = 'zh') {
  const d = parseISO(iso)
  if (locale === 'en') {
    return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatDayLong(iso: string, locale: DateLocale = 'zh') {
  const d = parseISO(iso)
  if (locale === 'en') {
    return d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_ZH[d.getDay()]}`
}

export function formatRange(start: string, end: string, locale: DateLocale = 'zh') {
  return `${formatDay(start, locale)} – ${formatDay(end, locale)}`
}

export function nightCount(start: string, end: string) {
  const a = parseISO(start).getTime()
  const b = parseISO(end).getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}

export function money(amount: number, currency = 'AUD') {
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(0)}`
  }
}

export function approxFromJpy(jpy: number, rate = 0.0102) {
  return jpy * rate
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function estimateMinutes(km: number, mode: string) {
  const kph =
    mode === 'walking' ? 4.5 : mode === 'cycling' ? 16 : mode === 'public' ? 28 : mode === 'taxi' ? 32 : 45
  return Math.max(8, Math.round((km / kph) * 60))
}

export function nearestNeighbor<T extends { coords?: { lat: number; lng: number } }>(items: T[]): T[] {
  if (items.length < 3) return items
  const withCoords = items.filter((i) => i.coords)
  const without = items.filter((i) => !i.coords)
  if (withCoords.length < 2) return items
  const remaining = [...withCoords]
  const start = remaining.shift()!
  const ordered = [start]
  while (remaining.length) {
    const last = ordered[ordered.length - 1]
    let best = 0
    let bestD = Infinity
    remaining.forEach((p, i) => {
      const d = haversineKm(last.coords!, p.coords!)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    ordered.push(remaining.splice(best, 1)[0])
  }
  return [...ordered, ...without]
}

export function copyJSON<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}
