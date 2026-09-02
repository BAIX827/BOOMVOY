import type { DayPlan, Expense, PlaceStop, TransportMode, Trip } from './types'
import { DAY_COLORS } from './catalog'
import { haversineKm, estimateMinutes } from './lib'
import type { TFn } from './i18n'

export function activePlaces(day: DayPlan): PlaceStop[] {
  return day.activePlan === 'A' ? day.planA : day.planB
}

export function outdoorRatio(places: PlaceStop[]) {
  if (!places.length) return 0
  return places.filter((p) => p.setting !== 'indoor').length / places.length
}

export function weatherAdvice(day: DayPlan, tFn: TFn) {
  const places = activePlaces(day)
  const ratio = outdoorRatio(places)
  const rain = day.weather.rainProb
  if (rain >= 60 && ratio >= 0.5) {
    return {
      level: 'warn' as const,
      title: tFn('wx.warnTitle'),
      text: tFn('wx.warnText', {
        city: day.city,
        rain,
        window: day.weather.rainWindow ? tFn('wx.warnWindow', { window: day.weather.rainWindow }) : '',
      }),
      suggestSwitch: day.activePlan === 'A' && day.planB.length > 0,
    }
  }
  if (rain >= 40 && ratio >= 0.4) {
    return {
      level: 'info' as const,
      title: tFn('wx.infoTitle'),
      text: tFn('wx.infoText'),
      suggestSwitch: false,
    }
  }
  return null
}

export function bookingProgress(trip: Trip) {
  const kinds = ['flight', 'hotel', 'activity', 'rental-car'] as const
  return kinds.map((kind) => {
    const items = trip.bookings.filter((b) => b.kind === kind)
    const done = items.filter((b) => b.status === 'booked' || b.status === 'paid').length
    return { kind, done, total: items.length }
  })
}

export function itineraryProgress(trip: Trip) {
  const days = trip.days.filter((d) => activePlaces(d).length > 0).length
  return { done: days, total: trip.days.length }
}

export interface RouteNode {
  city: string
  start: string
  end: string
  nights: number
  stay?: string
  mode: TransportMode
  weather?: DayPlan['weather']
  color: string
}

export function cityRoute(trip: Trip): RouteNode[] {
  const nodes: RouteNode[] = []
  for (const day of trip.days) {
    const last = nodes[nodes.length - 1]
    if (last && last.city === day.city) {
      last.end = day.date
      last.nights += 1
      last.stay = day.stay || last.stay
    } else {
      nodes.push({
        city: day.city,
        start: day.date,
        end: day.date,
        nights: 1,
        stay: day.stay,
        mode: day.transportMode,
        weather: day.weather,
        color: DAY_COLORS[nodes.length % DAY_COLORS.length],
      })
    }
  }
  return nodes
}

export function dayDistance(places: PlaceStop[]) {
  let km = 0
  let minutes = 0
  for (let i = 0; i < places.length - 1; i++) {
    const a = places[i]
    const b = places[i + 1]
    if (a.coords && b.coords) {
      const d = haversineKm(a.coords, b.coords)
      km += d
      minutes += estimateMinutes(d, a.transportToNext || 'public')
    }
  }
  return { km, minutes }
}

export function budgetTotals(trip: Trip) {
  return trip.budget.reduce(
    (acc, c) => ({
      estimated: acc.estimated + c.estimated,
      booked: acc.booked + c.booked,
      paid: acc.paid + c.paid,
    }),
    { estimated: 0, booked: 0, paid: 0 },
  )
}

export function settle(trip: Trip) {
  const bal: Record<string, number> = {}
  trip.members.forEach((m) => (bal[m.id] = 0))
  for (const e of trip.expenses) {
    const amount = homeAmount(trip, e)
    const included = trip.members.filter((m) => !e.excluded.includes(m.id))
    if (!included.length) continue
    if (e.split === 'equal') {
      const share = amount / included.length
      included.forEach((m) => (bal[m.id] -= share))
    } else {
      const custom = e.split
      included.forEach((m) => (bal[m.id] -= custom[m.id] ?? 0))
    }
    if (bal[e.paidBy] !== undefined) bal[e.paidBy] += amount
  }
  const debtors = Object.entries(bal)
    .filter(([, v]) => v < -0.5)
    .map(([id, v]) => ({ id, v: -v }))
  const creditors = Object.entries(bal)
    .filter(([, v]) => v > 0.5)
    .map(([id, v]) => ({ id, v }))
  const transfers: { from: string; to: string; amount: number }[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].v, creditors[j].v)
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay })
    debtors[i].v -= pay
    creditors[j].v -= pay
    if (debtors[i].v < 0.5) i++
    if (creditors[j].v < 0.5) j++
  }
  return { balances: bal, transfers }
}

function homeAmount(trip: Trip, e: Expense) {
  if (e.homeAmount != null) return e.homeAmount
  if (e.currency === trip.homeCurrency) return e.amount
  if (e.currency === 'JPY') return e.amount * 0.0102
  if (e.currency === 'USD') return e.amount * 1.52
  if (e.currency === 'IDR') return e.amount * 0.000095
  return e.amount
}

export function suggestedSwap(day: DayPlan): PlaceStop[] | null {
  if (day.weather.rainProb < 55) return null
  const places = [...day.planA]
  if (places.length < 3) return null
  const indoor = places.filter((p) => p.setting === 'indoor')
  const outdoor = places.filter((p) => p.setting !== 'indoor')
  if (!indoor.length || !outdoor.length) return null
  const next = [...indoor, ...outdoor]
  return next.map((p, i) => ({ ...p, time: places[i]?.time || p.time }))
}
