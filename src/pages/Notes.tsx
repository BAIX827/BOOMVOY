import { useNavigate, useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { THEMES, TRANSPORT } from '../catalog'
import type { ThemeId, TransportMode } from '../types'
import { Label } from '../ui'
import { themeLabel, transportLabel, useT } from '../i18n'

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
      <h1 className="display text-4xl">{t('notes.title')}</h1>
      <div className="paper space-y-4 p-5">
        <div>
          <Label>{t('notes.name')}</Label>
          <input className="field" value={trip.name} onChange={(e) => updateTrip(trip.id, { name: e.target.value })} />
        </div>
        <div>
          <Label>{t('notes.notes')}</Label>
          <textarea
            className="field min-h-[140px]"
            value={trip.notes}
            onChange={(e) => updateTrip(trip.id, { notes: e.target.value })}
          />
        </div>
        <div>
          <Label>{t('notes.share')}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['private', 'friends', 'public'] as const).map((v) => (
              <button
                key={v}
                className={trip.share.visibility === v ? 'btn' : 'btn btn-ghost'}
                onClick={() => updateTrip(trip.id, { share: { visibility: v } })}
              >
                {t(`share.${v}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>{t('notes.theme')}</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(Object.keys(THEMES) as ThemeId[]).map((th) => (
              <button
                key={th}
                className={`paper theme-preview theme-${th} p-3 text-left`}
                style={{ outline: trip.theme === th ? '2px solid var(--ink)' : undefined }}
                onClick={() => updateTrip(trip.id, { theme: th, cover: trip.cover === 'cream' || trip.cover === 'ocean' || trip.cover === 'forest' ? th : trip.cover })}
              >
                <div className="mb-2 flex gap-1">
                  {THEMES[th].swatches.map((c) => (
                    <span key={c} className="h-5 flex-1 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                {themeLabel(t, th)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>{t('notes.modes')}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {modes.map((m) => (
              <button key={m} className={trip.transportModes.includes(m) ? 'btn' : 'btn btn-ghost'} onClick={() => toggleMode(m)}>
                {TRANSPORT[m].icon} {transportLabel(t, m)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        className="btn btn-ghost"
        onClick={() => {
          if (confirm(t('notes.deleteConfirm'))) {
            deleteTrip(current.id)
            nav('/')
          }
        }}
      >
        {t('notes.delete')}
      </button>
    </div>
  )
}
