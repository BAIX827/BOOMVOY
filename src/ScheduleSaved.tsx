import { TripButton, TripInput, TripSelect } from './TripControls'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { SavedItem, Trip } from './types'
import { useApp } from './store'
import { Modal, Label } from './ui'
import { useT } from './i18n'
import { useTripContext } from './useTripContext'
import { formatDayLong } from './lib'
import { tripHref } from './journey'

export default function ScheduleSaved({ trip, item, onClose }: { trip: Trip; item: SavedItem; onClose: () => void }) {
  const { t, locale } = useT()
  const { day: current, selectDay } = useTripContext(trip)
  const schedule = useApp((state) => state.scheduleSaved)
  const [dayId, setDayId] = useState(current?.id || trip.days[0]?.id || '')
  const [time, setTime] = useState('10:00')
  const [checkout, setCheckout] = useState(trip.days[trip.days.findIndex((day) => day.id === dayId) + 1]?.date || trip.endDate)
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState('')
  const day = trip.days.find((entry) => entry.id === dayId)
  const hotel = item.kind === 'hotel'
  const existingStays = [...new Set(trip.days.filter((entry) => day && entry.date >= day.date && entry.date < checkout && entry.stay && entry.stay !== item.name).map((entry) => entry.stay!))]
  return <Modal open title={t('journey.scheduleTitle', { name: item.name })} onClose={onClose}>
    {added && day ? <div role="status" className="space-y-4"><p>{t('journey.scheduled', { city: day.city, date: formatDayLong(day.date, locale) })}</p><Link className="btn no-underline" to={tripHref(trip.id, hotel ? 'bookings' : 'plan', day.id, hotel ? undefined : added)} onClick={onClose}>{t(hotel ? 'journey.order' : 'journey.viewDay')}</Link></div> : <div className="space-y-4">
      <div><Label>{t(hotel ? 'journey.checkin' : 'journey.day')}</Label><TripSelect className="field" value={dayId} onChange={(event) => { setDayId(event.target.value); setError(''); const index = trip.days.findIndex((entry) => entry.id === event.target.value); setCheckout(trip.days[index + 1]?.date || trip.endDate) }}>{trip.days.map((entry, index) => <option key={entry.id} value={entry.id}>Day {index + 1} · {entry.city} · {formatDayLong(entry.date, locale)}</option>)}</TripSelect></div>
      {hotel ? <><div><Label>{t('journey.checkout')}</Label><TripInput className="field" type="date" min={day?.date} max={trip.endDate} value={checkout} onChange={(event) => setCheckout(event.target.value)} /></div><p className="text-sm" style={{ color: 'var(--muted)' }}>{t('journey.hotelHint')}</p></> : <div><Label>{t('journey.time')}</Label><TripInput className="field" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></div>}
      {hotel && existingStays.length > 0 && <p className="text-sm" style={{ color: 'var(--warn)' }}>{t('journey.replaceStay', { names: existingStays.join(' · ') })}</p>}
      {error && <p role="alert" style={{ color: 'var(--warn)' }}>{error}</p>}
      <TripButton className="btn" disabled={!day || (!hotel && !time)} onClick={() => { const id = schedule(trip.id, item.id, dayId, time, hotel ? checkout : undefined); if (id) { selectDay(dayId); setAdded(id) } else setError(t(hotel && trip.bookings.some((booking) => booking.sourceSavedId === item.id && booking.date === day?.date && (booking.status === 'booked' || booking.status === 'paid')) ? 'settings.stayLocked' : hotel ? 'journey.invalidStay' : 'create.errorDates')) }}>{t('journey.schedule')}</TripButton>
    </div>}
  </Modal>
}
