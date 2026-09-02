import { useEffect, useState } from 'react'
import type { Trip, WeatherCondition, WeatherSnap } from './types'
import { toISODate } from './lib'
import { useApp } from './store'

const cityCache = new Map<string, { lat: number; lng: number }>()

export async function geocodeCity(city: string) {
  const key = city.trim().toLowerCase()
  if (cityCache.has(key)) return cityCache.get(key)!
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`)
  if (!res.ok) throw new Error('城市定位失败')
  const data = await res.json()
  const hit = data.results?.[0]
  if (!hit) throw new Error(`找不到 ${city}`)
  const loc = { lat: hit.latitude as number, lng: hit.longitude as number }
  cityCache.set(key, loc)
  return loc
}

function wmoCondition(code: number): WeatherCondition {
  if (code <= 1) return 'sunny'
  if (code <= 3 || code === 45 || code === 48) return 'cloudy'
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 51) return 'rain'
  return 'cloudy'
}

function rainFromMm(mm: number) {
  if (mm <= 0.2) return 12
  if (mm < 2) return 35
  if (mm < 8) return 60
  return 82
}

function shiftYear(iso: string, years: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setFullYear(d.getFullYear() + years)
  return toISODate(d)
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

type Daily = {
  time: string[]
  weather_code?: number[]
  temperature_2m_max?: number[]
  temperature_2m_min?: number[]
  precipitation_probability_max?: number[]
  precipitation_sum?: number[]
}

function snapsFromDaily(daily: Daily, seasonal: boolean): Record<string, WeatherSnap> {
  const out: Record<string, WeatherSnap> = {}
  daily.time.forEach((date, i) => {
    const code = daily.weather_code?.[i] ?? 2
    const tMax = Math.round(daily.temperature_2m_max?.[i] ?? 22)
    const tMin = Math.round(daily.temperature_2m_min?.[i] ?? 16)
    const rainProb = daily.precipitation_probability_max?.[i] ?? rainFromMm(daily.precipitation_sum?.[i] ?? 0)
    out[date] = {
      condition: wmoCondition(code),
      tMin,
      tMax,
      rainProb: Math.round(rainProb),
      summary: seasonal
        ? `远期按去年同期估算：${tMin}–${tMax}°C，降水约 ${Math.round(daily.precipitation_sum?.[i] ?? 0)} mm`
        : `预报 ${tMin}–${tMax}°C，降雨概率 ${Math.round(rainProb)}%`,
    }
  })
  return out
}

async function forecastRange(lat: number, lng: number, start: string, end: string) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&start_date=${start}&end_date=${end}`
  const res = await fetch(url)
  if (!res.ok) return {} as Record<string, WeatherSnap>
  const data = await res.json()
  if (!data.daily?.time) return {}
  return snapsFromDaily(data.daily, false)
}

async function archiveRange(lat: number, lng: number, start: string, end: string, seasonal: boolean) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${start}&end_date=${end}`
  const res = await fetch(url)
  if (!res.ok) return {} as Record<string, WeatherSnap>
  const data = await res.json()
  if (!data.daily?.time) return {}
  return snapsFromDaily(data.daily, seasonal)
}

export async function weatherForCity(city: string, dates: string[]) {
  if (!dates.length) return {} as Record<string, WeatherSnap>
  const loc = await geocodeCity(city)
  const sorted = [...dates].sort()
  const today = toISODate(new Date())
  const forecastHorizon = addDays(today, 15)
  const near = sorted.filter((d) => d >= today && d <= forecastHorizon)
  const far = sorted.filter((d) => d > forecastHorizon)
  const past = sorted.filter((d) => d < today)
  const out: Record<string, WeatherSnap> = {}
  if (near.length) Object.assign(out, await forecastRange(loc.lat, loc.lng, near[0], near[near.length - 1]))
  if (far.length) {
    const analog = await archiveRange(loc.lat, loc.lng, shiftYear(far[0], -1), shiftYear(far[far.length - 1], -1), true)
    Object.entries(analog).forEach(([date, snap]) => {
      out[shiftYear(date, 1)] = snap
    })
  }
  if (past.length) Object.assign(out, await archiveRange(loc.lat, loc.lng, past[0], past[past.length - 1], false))
  return out
}

export async function refreshTripWeather(trip: Trip, force = false) {
  const stamp = trip.weatherUpdatedAt ? Date.parse(trip.weatherUpdatedAt) : 0
  if (!force && stamp && Date.now() - stamp < 6 * 60 * 60 * 1000) return null
  const byCity = new Map<string, string[]>()
  for (const d of trip.days) {
    const list = byCity.get(d.city) || []
    list.push(d.date)
    byCity.set(d.city, list)
  }
  const byKey: Record<string, WeatherSnap> = {}
  let seasonal = false
  for (const [city, dates] of byCity) {
    const snaps = await weatherForCity(city, dates)
    dates.forEach((date) => {
      const snap = snaps[date]
      if (snap) {
        byKey[`${date}|${city}`] = snap
        if (snap.summary.includes('去年')) seasonal = true
      }
    })
  }
  if (!Object.keys(byKey).length) return null
  return { byKey, fetchedAt: new Date().toISOString(), seasonal }
}

export function useLiveWeather(trip: Trip | undefined) {
  const patchDaysWeather = useApp((s) => s.patchDaysWeather)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [seasonal, setSeasonal] = useState(false)

  useEffect(() => {
    if (!trip) return
    let live = true
    setBusy(true)
    setError('')
    refreshTripWeather(trip)
      .then((r) => {
        if (!live || !r) return
        patchDaysWeather(trip.id, r.byKey, r.fetchedAt)
        setSeasonal(r.seasonal)
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : '天气获取失败')
      })
      .finally(() => {
        if (live) setBusy(false)
      })
    return () => {
      live = false
    }
  }, [trip?.id, trip?.startDate, trip?.endDate, (trip?.days ?? []).map((d) => d.city).join('|')])

  async function refresh() {
    if (!trip) return
    setBusy(true)
    setError('')
    try {
      const r = await refreshTripWeather(trip, true)
      if (r) {
        patchDaysWeather(trip.id, r.byKey, r.fetchedAt)
        setSeasonal(r.seasonal)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '天气获取失败')
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, seasonal, refresh }
}
