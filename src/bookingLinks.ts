import type { Trip } from './types'
import { cityRoute } from './domain'
import { formatDay } from './lib'
import { t, type Locale } from './i18n'

type Air = { iata: string; sky: string; label: string }

const AIRPORTS: Record<string, Air> = {
  melbourne: { iata: 'MEL', sky: 'mel', label: 'Melbourne' },
  tokyo: { iata: 'TYO', sky: 'tyoa', label: 'Tokyo' },
  osaka: { iata: 'OSA', sky: 'osaa', label: 'Osaka' },
  kyoto: { iata: 'KIX', sky: 'osaa', label: 'Kyoto / Osaka' },
  fuji: { iata: 'TYO', sky: 'tyoa', label: 'Tokyo (for Fuji)' },
  kawaguchiko: { iata: 'TYO', sky: 'tyoa', label: 'Tokyo' },
  bali: { iata: 'DPS', sky: 'dps', label: 'Bali' },
  canggu: { iata: 'DPS', sky: 'dps', label: 'Bali' },
  ubud: { iata: 'DPS', sky: 'dps', label: 'Bali' },
  sydney: { iata: 'SYD', sky: 'syd', label: 'Sydney' },
  brisbane: { iata: 'BNE', sky: 'bne', label: 'Brisbane' },
  singapore: { iata: 'SIN', sky: 'sin', label: 'Singapore' },
  seoul: { iata: 'SEL', sky: 'sela', label: 'Seoul' },
  bangkok: { iata: 'BKK', sky: 'bkkt', label: 'Bangkok' },
  hongkong: { iata: 'HKG', sky: 'hkg', label: 'Hong Kong' },
  'hong kong': { iata: 'HKG', sky: 'hkg', label: 'Hong Kong' },
  taipei: { iata: 'TPE', sky: 'tpet', label: 'Taipei' },
  shanghai: { iata: 'SHA', sky: 'csha', label: 'Shanghai' },
  beijing: { iata: 'BJS', sky: 'bjsa', label: 'Beijing' },
  london: { iata: 'LON', sky: 'lond', label: 'London' },
  paris: { iata: 'PAR', sky: 'pari', label: 'Paris' },
}

export function lookupAir(city: string): Air | null {
  const key = city.trim().toLowerCase().replace(/\s+/g, ' ')
  return AIRPORTS[key] || AIRPORTS[key.replace(/[^a-z]/g, '')] || null
}

function skyDate(iso: string) {
  return iso.replace(/-/g, '').slice(2)
}

function au(trip: Trip) {
  return trip.homeCurrency === 'AUD' || /melbourne|sydney|brisbane|perth/i.test(trip.origin)
}

export type ShopLink = { name: string; href: string; hint?: string }

export function flightLinks(fromCity: string, toCity: string, date: string, trip: Trip, back?: string, locale: Locale = 'zh'): ShopLink[] {
  const from = lookupAir(fromCity)
  const to = lookupAir(toCity)
  const adults = Math.max(1, trip.travellers)
  const host = au(trip) ? 'www.skyscanner.com.au' : 'www.skyscanner.com'
  const kayak = au(trip) ? 'www.kayak.com.au' : 'www.kayak.com'
  const q = back
    ? `Flights from ${fromCity} to ${toCity} on ${date} through ${back}`
    : `Flights from ${fromCity} to ${toCity} on ${date}`
  const hl = locale === 'zh' ? 'zh-CN' : 'en'

  const links: ShopLink[] = [
    {
      name: 'Google Flights',
      href: `https://www.google.com/travel/flights?hl=${hl}&q=${encodeURIComponent(q)}`,
      hint: '比价清楚，适合开口票',
    },
  ]

  if (from && to) {
    const skyPath = back
      ? `${from.sky}/${to.sky}/${skyDate(date)}/${skyDate(back)}`
      : `${from.sky}/${to.sky}/${skyDate(date)}`
    links.unshift({
      name: 'Skyscanner',
      href: `https://${host}/transport/flights/${skyPath}/?adultsv1=${adults}&cabinclass=economy`,
      hint: '澳洲常用',
    })
    const kayakPath = back ? `${from.iata}-${to.iata}/${date}/${back}` : `${from.iata}-${to.iata}/${date}`
    links.push({
      name: 'Kayak',
      href: `https://${kayak}/flights/${kayakPath}?adults=${adults}&sort=bestflight_a`,
    })
    links.push({
      name: 'Trip.com',
      href: `https://au.trip.com/flights/${from.label.toLowerCase()}-to-${to.label.toLowerCase()}/tickets-${from.iata.toLowerCase()}-${to.iata.toLowerCase()}/?dcity=${from.iata.toLowerCase()}&acity=${to.iata.toLowerCase()}&ddate=${date}${back ? `&rdate=${back}` : ''}&adult=${adults}`,
    })
  } else {
    links.push({
      name: t(locale, 'shop.skySearch'),
      href: `https://${host}/?adultsv1=${adults}&locale=en-AU`,
    })
  }

  return links
}

export function openJawLinks(trip: Trip, locale: Locale = 'zh'): ShopLink[] | null {
  const first = trip.destinations[0]
  const last = trip.destinations[trip.destinations.length - 1]
  if (!first || !last || first.toLowerCase() === last.toLowerCase()) return null
  const from = lookupAir(trip.origin)
  const mid = lookupAir(first)
  const back = lookupAir(last)
  if (!from || !mid || !back) return null
  const adults = Math.max(1, trip.travellers)
  const host = au(trip) ? 'www.skyscanner.com.au' : 'www.skyscanner.com'
  const q = `Flights from ${trip.origin} to ${first} on ${trip.startDate}, ${last} to ${trip.origin} on ${trip.endDate}`
  const hl = locale === 'zh' ? 'zh-CN' : 'en'
  return [
    {
      name: t(locale, 'shop.skyOpenJaw'),
      href: `https://${host}/transport/d/${from.sky}/${skyDate(trip.startDate)}/${mid.sky}/${back.sky}/${skyDate(trip.endDate)}/${from.sky}/?adultsv1=${adults}`,
      hint: `${trip.origin}→${first}，${last}→${trip.origin}`,
    },
    {
      name: t(locale, 'shop.gOpenJaw'),
      href: `https://www.google.com/travel/flights?hl=${hl}&q=${encodeURIComponent(q)}`,
    },
  ]
}

export function hotelLinks(city: string, checkin: string, checkout: string, trip: Trip, locale: Locale = 'zh'): ShopLink[] {
  const adults = Math.max(1, trip.travellers)
  const q = encodeURIComponent(city)
  const lang = locale === 'zh' ? 'zh-cn' : 'en-us'
  return [
    {
      name: 'Booking.com',
      href: `https://www.booking.com/searchresults.html?ss=${q}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=1&lang=${lang}`,
    },
    {
      name: 'Agoda',
      href: `https://www.agoda.com/search?city=0&checkIn=${checkin}&checkOut=${checkout}&rooms=1&adults=${adults}&textToSearch=${q}`,
    },
    {
      name: 'Airbnb',
      href: `https://www.airbnb.com.au/s/${q}/homes?checkin=${checkin}&checkout=${checkout}&adults=${adults}`,
    },
  ]
}

export function activityLinks(city: string, locale: Locale = 'zh'): ShopLink[] {
  const q = encodeURIComponent(city)
  return [
    { name: 'Klook', href: `https://www.klook.com/en-AU/search/?query=${q}` },
    { name: 'GetYourGuide', href: `https://www.getyourguide.com/s/?q=${q}` },
    { name: t(locale, 'shop.tripFun'), href: `https://au.trip.com/things-to-do/?keyword=${q}` },
  ]
}

export function tripFlightPlan(trip: Trip, locale: Locale = 'zh') {
  const first = trip.destinations[0] || trip.origin
  const last = trip.destinations[trip.destinations.length - 1] || first
  return {
    outbound: { from: trip.origin, to: first, date: trip.startDate },
    inbound: { from: last, to: trip.origin, date: trip.endDate },
    sameCity: first.toLowerCase() === last.toLowerCase(),
    label: `${trip.origin} → ${first} · ${formatDay(trip.startDate, locale)}`,
    backLabel: `${last} → ${trip.origin} · ${formatDay(trip.endDate, locale)}`,
  }
}

export function tripHotelStays(trip: Trip) {
  const nodes = cityRoute(trip)
  return nodes
    .map((n, i) => {
      const checkout = nodes[i + 1]?.start || trip.endDate
      return { city: n.city, checkin: n.start, checkout, stay: n.stay }
    })
    .filter((s) => s.checkin < s.checkout)
}
