import { TripButton, TripInput } from './TripControls'
import { useState } from 'react'
import type { Trip } from './types'
import { scheduleDraft, rescheduleTrip } from './tripSchedule'
import { useApp } from './store'
import { useT } from './i18n'
import { Modal } from './ui'

export default function ScheduleEditor({ trip }: { trip: Trip }) {
  const { t } = useT()
  const updateTrip = useApp((state) => state.updateTrip)
  const [draft, setDraft] = useState(() => scheduleDraft(trip))
  const [preview, setPreview] = useState<ReturnType<typeof rescheduleTrip> | null>(null)
  const [fingerprint, setFingerprint] = useState('')
  const [error, setError] = useState('')
  return <section className="paper space-y-4 p-5">
    <h2 className="display text-2xl">{t('settings.route')}</h2><p className="text-sm" style={{ color: 'var(--muted)' }}>{t('settings.keep')}</p>
    <label className="block text-sm">{t('settings.origin')}<TripInput className="field mt-1" value={draft.origin} maxLength={250} onChange={(e) => setDraft({ ...draft, origin: e.target.value })} /></label>
    <div className="grid grid-cols-2 gap-3">{(['startDate', 'endDate'] as const).map((key) => <label key={key} className="text-sm">{t(key === 'startDate' ? 'settings.start' : 'settings.end')}<TripInput className="field mt-1" type="date" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
    {draft.cities.map((item, index) => <div key={index} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm">{t('settings.city')}<TripInput className="field mt-1" value={item.city} maxLength={250} onChange={(e) => setDraft({ ...draft, cities: draft.cities.map((entry, i) => i === index ? { ...entry, city: e.target.value } : entry) })} /></label><label className="w-20 text-sm">{t('settings.days')}<TripInput className="field mt-1" type="number" min={1} max={730} value={item.days} onChange={(e) => setDraft({ ...draft, cities: draft.cities.map((entry, i) => i === index ? { ...entry, days: Number(e.target.value) } : entry) })} /></label><TripButton className="btn btn-ghost px-2" disabled={draft.cities.length === 1} onClick={() => setDraft({ ...draft, cities: draft.cities.filter((_, i) => i !== index) })}>{t('settings.removeCity')}</TripButton></div>)}
    <div className="flex flex-wrap gap-2"><TripButton className="btn btn-ghost" onClick={() => setDraft({ ...draft, cities: [...draft.cities, { city: '', days: 1 }] })}>{t('settings.addCity')}</TripButton><TripButton className="btn" onClick={() => { const next = rescheduleTrip(trip, draft); setError(next.ok ? '' : t(`settings.${next.reason}`, { dates: next.dates?.join('、') || '' })); setPreview(next.ok ? next : null); setFingerprint(JSON.stringify(trip)) }}>{t('settings.preview')}</TripButton></div>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {preview?.ok && <Modal open title={t('settings.previewTitle')} onClose={() => setPreview(null)}><div className="space-y-4"><p>{draft.startDate} → {draft.endDate}</p><ol>{preview.trip.days.map((day, i) => <li key={day.id}>Day {i + 1} · {day.date} · {day.city} · {day.planA.length + day.planB.length} {t('settings.places')}</li>)}</ol>{preview.changedCities.length > 0 && <p>{t('settings.review', { dates: preview.changedCities.join('、') })}</p>}{preview.confirmed.length > 0 && <p>{t('settings.bookings', { names: preview.confirmed.join('、') })}</p>}<TripButton className="btn w-full" onClick={() => { if (JSON.stringify(useApp.getState().trips.find((item) => item.id === trip.id)) !== fingerprint) { setPreview(null); setError(t('settings.stale')); return } updateTrip(trip.id, preview.trip); setPreview(null) }}>{t('settings.apply')}</TripButton></div></Modal>}
  </section>
}
