import type { Booking, DayPlan, Expense, PlaceStop, SavedKind, TransportMode, Trip } from './types'
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
  const estimated = trip.budget.reduce((sum, category) => sum + category.estimated, 0)
  const booked = trip.bookings
    .filter((booking) => booking.status === 'booked' || booking.status === 'paid')
    .reduce((sum, booking) => sum + (bookingHomeAmount(trip, booking) || 0), 0)
  const paid = trip.expenses.reduce((sum, expense) => sum + expenseHomeAmount(trip, expense), 0)
  return { estimated, booked, paid }
}

const KIND_BUDGET_CATEGORY: Record<SavedKind, string> = {
  flight: '机票',
  hotel: '住宿',
  restaurant: '餐饮',
  place: '活动',
  activity: '活动',
  'rental-car': '交通',
  souvenir: '伴手礼',
  route: '交通',
}

export function bookingBudgetCategory(kind: SavedKind) {
  return KIND_BUDGET_CATEGORY[kind]
}

export function bookingHomeAmount(trip: Trip, booking: Booking) {
  if (!booking.cost) return undefined
  if (booking.homeAmount != null) return booking.homeAmount
  if (booking.cost.currency === trip.homeCurrency) return booking.cost.amount
  if (booking.exchangeRate != null) return booking.cost.amount * booking.exchangeRate
  return undefined
}

export function budgetCategoryActuals(trip: Trip, category: string) {
  const booked = trip.bookings
    .filter((booking) => (booking.status === 'booked' || booking.status === 'paid') && bookingBudgetCategory(booking.kind) === category)
    .reduce((sum, booking) => sum + (bookingHomeAmount(trip, booking) || 0), 0)
  const paid = trip.expenses
    .filter((expense) => expense.category === category)
    .reduce((sum, expense) => sum + expenseHomeAmount(trip, expense), 0)
  return { booked, paid }
}

export function settle(trip: Trip) {
  const cents: Record<string, number> = {}
  trip.members.forEach((member) => (cents[member.id] = 0))
  for (const expense of trip.expenses) {
    const amount = Math.round(expenseHomeAmount(trip, expense) * 100)
    const included = trip.members.filter((member) => !expense.excluded.includes(member.id))
    if (!included.length || cents[expense.paidBy] === undefined) continue
    if (expense.split === 'equal') {
      const share = Math.floor(amount / included.length), remainder = amount % included.length
      included.forEach((member, index) => (cents[member.id] -= share + (index < remainder ? 1 : 0)))
    } else {
      const rate = expense.amount ? amount / expense.amount : 1
      const shares = included.map((member) => Math.round((expense.split as Record<string, number>)[member.id] * rate || 0))
      let last = shares.length - 1
      while (last >= 0 && shares[last] <= 0) last--
      if (last >= 0) shares[last] += amount - shares.reduce((sum, share) => sum + share, 0)
      included.forEach((member, index) => (cents[member.id] -= shares[index]))
    }
    cents[expense.paidBy] += amount
  }
  for (const payment of trip.settlements || []) {
    if (payment.currency !== trip.homeCurrency || cents[payment.from] === undefined || cents[payment.to] === undefined || payment.from === payment.to) continue
    cents[payment.from] += Math.round(payment.amount * 100)
    cents[payment.to] -= Math.round(payment.amount * 100)
  }
  const debtors = Object.entries(cents).filter(([, value]) => value < 0).map(([id, value]) => ({ id, value: -value }))
  const creditors = Object.entries(cents).filter(([, value]) => value > 0).map(([id, value]) => ({ id, value }))
  const transfers: { from: string; to: string; amount: number }[] = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].value, creditors[j].value)
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay / 100 })
    debtors[i].value -= pay; creditors[j].value -= pay
    if (debtors[i].value === 0) i++
    if (creditors[j].value === 0) j++
  }
  return { balances: Object.fromEntries(Object.entries(cents).map(([id, value]) => [id, value / 100])), transfers }
}

export function expenseHomeAmount(trip: Trip, e: Expense) {
  if (e.homeAmount != null) return e.homeAmount
  if (e.currency === trip.homeCurrency) return e.amount
  if (e.exchangeRate != null) return e.amount * e.exchangeRate
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
