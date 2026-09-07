import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { THEMES, TRANSPORT } from '../catalog'
import { useApp } from '../store'
import type { ThemeId, TransportMode } from '../types'
import { Label } from '../ui'
import { themeBlurb, themeLabel, transportLabel, useT } from '../i18n'
import { eachDate, toISODate } from '../lib'
import { ThemeBadge } from '../ThemeDecor'

const modes: TransportMode[] = ['self-drive', 'public', 'walking', 'taxi', 'cycling', 'mixed']

function futureDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

function splitDays(total: number, count: number) {
  if (!count) return []
  const base = Math.floor(total / count)
  const extra = total % count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

export default function CreateTrip() {
  const createTrip = useApp((s) => s.createTrip)
  const profile = useApp((s) => s.profile)
  const nav = useNavigate()
  const { t } = useT()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [origin, setOrigin] = useState(profile.homeCity)
  const [dest, setDest] = useState('')
  const [startDate, setStartDate] = useState(() => futureDate(30))
  const [endDate, setEndDate] = useState(() => futureDate(37))
  const [people, setPeople] = useState(2)
  const [members, setMembers] = useState(profile.name + ', ')
  const [budget, setBudget] = useState(3000)
  const [theme, setTheme] = useState<ThemeId>('cream')
  const [transport, setTransport] = useState<TransportMode[]>(['mixed'])
  const [destinationDays, setDestinationDays] = useState<number[]>([])
  const [error, setError] = useState('')

  const destinations = dest
    .split(/[,，>/→]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const tripDates = useMemo(() => eachDate(startDate, endDate, 731), [startDate, endDate])
  const memberNames = members.split(/[,，]/).map((s) => s.trim()).filter(Boolean)

  useEffect(() => {
    setDestinationDays(splitDays(tripDates.length, destinations.length))
  }, [tripDates.length, destinations.join('|')])

  function toggleMode(m: TransportMode) {
    setTransport((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  function submit() {
    const id = createTrip({
      name: name || destinations[0] || t('create.untitled'),
      origin,
      destinations: destinations.length ? destinations : [origin],
      startDate,
      endDate,
      travellers: people,
      members: memberNames,
      budgetPerPerson: budget,
      homeCurrency: profile.homeCurrency,
      theme,
      transportModes: transport.length ? transport : ['mixed'],
      destinationDays,
    })
    nav(`/trip/${id}`)
  }

  function validate(currentStep: number) {
    if (currentStep === 0 && (!origin.trim() || destinations.length === 0)) return t('create.errorRoute')
    if (currentStep === 0 && destinations.length > 100) return t('create.errorLimits')
    if (currentStep === 1) {
      if (!startDate || !endDate || tripDates.length === 0) return t('create.errorDates')
      if (tripDates.length > 730) return t('create.errorLimits')
      if (tripDates.length < destinations.length) return t('create.errorTooManyCities')
      if (destinationDays.some((n) => !Number.isInteger(n) || n < 1)) return t('create.errorCityDays')
      if (destinationDays.reduce((sum, n) => sum + n, 0) !== tripDates.length) {
        return t('create.errorAllocation', { n: tripDates.length })
      }
    }
    if (currentStep === 2 && (!Number.isInteger(people) || people < 1 || people > 100
      || !Number.isFinite(budget) || budget < 0 || budget > 1_000_000_000_000 || memberNames.length > 100)) return t('create.errorPeopleBudget')
    return ''
  }

  function next() {
    const issue = validate(step)
    setError(issue)
    if (!issue) setStep((s) => s + 1)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {t('create.progress', { n: step + 1 })}
      </p>
      <h1 className="display mt-1 mb-6 text-4xl">{t('create.title')}</h1>
      <div className="paper p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>{t('create.name')}</Label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Japan 2026" />
            </div>
            <div>
              <Label>{t('create.origin')}</Label>
              <input className="field" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </div>
            <div>
              <Label>{t('create.dest')}</Label>
              <input
                className="field"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="Tokyo → Fuji → Kyoto → Osaka"
              />
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t('create.start')}</Label>
                <input className="field" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>{t('create.end')}</Label>
                <input className="field" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            {destinations.length > 0 && (
              <div>
                <Label>{t('create.cityDays')}</Label>
                <div className="space-y-2">
                  {destinations.map((city, i) => (
                    <label key={`${city}-${i}`} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: 'var(--bg-2)' }}>
                      <span className="font-medium">{city}</span>
                      <span className="flex items-center gap-2 text-sm">
                        <input
                          className="field w-20"
                          type="number"
                          min={1}
                          value={destinationDays[i] ?? 1}
                          onChange={(e) => setDestinationDays((days) => days.map((n, x) => (x === i ? Number(e.target.value) : n)))}
                        />
                        {t('create.daysUnit')}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                  {t('create.totalDays', { n: tripDates.length })}
                </p>
              </div>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>{t('create.people')}</Label>
              <input className="field" type="number" min={1} max={100} step={1} value={people} onChange={(e) => setPeople(Number(e.target.value))} />
            </div>
            <div>
              <Label>{t('create.members')}</Label>
              <input className="field" value={members} onChange={(e) => setMembers(e.target.value)} placeholder="Ari, Bo" />
            </div>
            <div>
              <Label>{t('create.budget', { currency: profile.homeCurrency })}</Label>
              <input className="field" type="number" min={0} max={1_000_000_000_000} step="0.01" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <Label>{t('create.modes')}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {modes.map((m) => (
                  <button
                    key={m}
                    className={transport.includes(m) ? 'btn' : 'btn btn-ghost'}
                    onClick={() => toggleMode(m)}
                  >
                    {TRANSPORT[m].icon} {transportLabel(t, m)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t('create.theme')}</Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className={`paper theme-preview theme-${id} p-3 text-left`}
                    style={{ outline: theme === id ? '2px solid var(--ink)' : undefined }}
                  >
                    <div className="mb-2 flex gap-1">
                      {THEMES[id].swatches.map((c) => (
                        <span key={c} className="h-6 flex-1 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="font-medium">
                      {themeLabel(t, id)} · {THEMES[id].name}
                    </div>
                    <ThemeBadge theme={id} />
                    <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                      {themeBlurb(t, id)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {error && <p className="mt-4 text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}
        <div className="mt-6 flex justify-between">
          <button className="btn btn-ghost" disabled={step === 0} onClick={() => { setError(''); setStep((s) => s - 1) }}>
            {t('create.prev')}
          </button>
          {step < 3 ? (
            <button className="btn" onClick={next}>
              {t('create.next')}
            </button>
          ) : (
            <button className="btn btn-accent" onClick={() => { const issue = validate(2); setError(issue); if (!issue) submit() }}>
              {t('create.go')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
