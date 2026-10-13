import { TripButton, TripInput, TripTextarea } from '../TripControls'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { THEMES, TRANSPORT } from '../catalog'
import type { ThemeId, TransportMode } from '../types'
import { Label } from '../ui'
import { transportLabel, useT } from '../i18n'
import ScheduleEditor from '../ScheduleEditor'
import { ThemePreview } from '../ThemeDecor'

const modes: TransportMode[] = ['self-drive', 'public', 'walking', 'taxi', 'cycling', 'mixed', 'flight']

export default function Notes() {
  const { id } = useParams()
  const trip = useTrip(id)
  const updateTrip = useApp((s) => s.updateTrip)
  const deleteTrip = useApp((s) => s.deleteTrip)
  const nav = useNavigate()
  const { t } = useT()
  if (!trip) return null
  const current = trip

  function toggleMode(m: TransportMode) {
    const next = current.transportModes.includes(m)
      ? current.transportModes.filter((x) => x !== m)
      : [...current.transportModes, m]
    updateTrip(current.id, { transportModes: next.length ? next : ['mixed'] })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="display text-4xl">{t('journey.settings')}</h1>
      <div className="paper space-y-4 p-5">
        <div>
          <Label>{t('notes.name')}</Label>
          <TripInput className="field" value={trip.name} onChange={(e) => updateTrip(trip.id, { name: e.target.value })} />
        </div>
        <div>
          <Label>{t('notes.notes')}</Label>
          <TripTextarea
            className="field min-h-[140px]"
            value={trip.notes}
            onChange={(e) => updateTrip(trip.id, { notes: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>{t('create.people')}</Label><TripInput className="field" type="number" min={1} max={100} step={1} value={trip.travellers} onChange={(event) => { const count = Number(event.target.value); if (Number.isInteger(count) && count >= 1 && count <= 100 && count * trip.budgetPerPerson <= 1_000_000_000_000) updateTrip(trip.id, { travellers: count, totalBudget: count * trip.budgetPerPerson }) }} /><Link className="mt-2 inline-block text-xs" to={`/trip/${trip.id}/group`}>{t('trip.group')} →</Link></div>
          <div><Label>{t('create.budget', { currency: trip.homeCurrency })}</Label><TripInput className="field" type="number" min={0} max={1_000_000_000_000 / trip.travellers} step="0.01" value={trip.budgetPerPerson} onChange={(event) => { const amount = Number(event.target.value); if (Number.isFinite(amount) && amount >= 0 && amount * trip.travellers <= 1_000_000_000_000) updateTrip(trip.id, { budgetPerPerson: amount, totalBudget: amount * trip.travellers }) }} /></div>
        </div>
        <div><Label>{t('trip.share')}</Label><Link className="btn btn-ghost mt-2 no-underline" to={`/share/${trip.id}`}>{t('journey.exportTrip')}</Link></div>
        <div>
          <Label>{t('notes.theme')}</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(Object.keys(THEMES) as ThemeId[]).map((th) => (
              <ThemePreview
                key={th}
                theme={th}
                selected={trip.theme === th}
                onSelect={() => updateTrip(trip.id, { theme: th, cover: trip.cover === 'cream' || trip.cover === 'ocean' || trip.cover === 'forest' ? th : trip.cover })}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>{t('notes.modes')}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {modes.map((m) => (
              <TripButton key={m} className={trip.transportModes.includes(m) ? 'btn' : 'btn btn-ghost'} onClick={() => toggleMode(m)}>
                {TRANSPORT[m].icon} {transportLabel(t, m)}
              </TripButton>
            ))}
          </div>
        </div>
      </div>
      <ScheduleEditor key={trip.startDate + trip.endDate + trip.destinations.join()} trip={trip} />
      <TripButton
        className="btn btn-ghost"
        onClick={() => {
          if (confirm(t('notes.deleteConfirm'))) {
            deleteTrip(current.id)
            nav('/')
          }
        }}
      >
        {t('notes.delete')}
      </TripButton>
    </div>
  )
}
