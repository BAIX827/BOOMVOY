import { useState } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { Modal } from '../ui'
import { toISODate } from '../lib'
import type { Trip } from '../types'
import { validTripDate, shiftDate } from '../tripSchedule'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import DestinationArt from '../DestinationArt'
import { ILLUSTRATION_DESTINATIONS } from '../illustrationDestinations'
import { formatRange } from '../lib'
import { THEMES } from '../catalog'
import { themeLabel, useT } from '../i18n'
import { normalizeDestination } from '../illustrationCatalog'

const landscapes = ['city', 'mountain', 'coast', 'countryside'] as const
const cities = ILLUSTRATION_DESTINATIONS.filter((entry) => entry.kind === 'cities')
const landmarks = ILLUSTRATION_DESTINATIONS.filter((entry) => entry.kind === 'landmarks')
const counts = { cities: cities.length, landmarks: landmarks.length, generic: landscapes.length }

export default function Explore() {
  const templates = useApp((s) => s.trips).filter((tr) => tr.template)
  const cloneTrip = useApp((s) => s.cloneTrip)
  const nav = useNavigate()
  const { t, locale } = useT()
  const [copying, setCopying] = useState<Trip | null>(null)
  const [start, setStart] = useState(toISODate(new Date()))
  const [section, setSection] = useState<keyof typeof counts>('cities')
  const [query, setQuery] = useState('')
  const search = normalizeDestination(query)
  const entries = (section === 'cities' ? cities : landmarks).filter((entry) => [entry.city, entry.name.zh, entry.name.en].some((value) => normalizeDestination(value).includes(search)))
  const scenery = landscapes.filter((id) => normalizeDestination(t(`atlas.${id}`)).includes(search) || id.includes(search))
  const resultCount = section === 'generic' ? scenery.length : entries.length

  return (
    <div className="atlas-page">
      <header className="library-heading"><h1 className="display shelf-title">{t('shelf.atlas')}</h1>
        <label className="journal-search"><Search size={17} /><span className="sr-only">{t('atlas.search')}</span><input type="search" placeholder={t('atlas.search')} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </header>
      <section className="destination-library mb-10" aria-label={t('shelf.atlas')}>
        <div className="atlas-toolbar"><div className="journal-filters" role="group" aria-label={t('shelf.atlas')}>
          {(['cities', 'landmarks', 'generic'] as const).map((key) => <button key={key} type="button" aria-pressed={key === section} onClick={() => { setSection(key); setQuery('') }}>{t(`atlas.${key}`)} <small>{counts[key]}</small></button>)}
        </div>{templates.length > 0 && <a className="notebook-link" href="#trip-templates">{t('atlas.templates')} ↓</a>}</div>
        <div className="atlas-grid">
          {section === 'generic' ? scenery.map((id) => <figure key={id} className="atlas-tile"><DestinationArt landscape={id} /><figcaption>{t(`atlas.${id}`)}</figcaption></figure>) :
            entries.map((entry) => <button key={entry.id} type="button" className="atlas-tile" onClick={() => nav(`/new?destination=${encodeURIComponent(entry.city)}`)}><DestinationArt city={entry.city} /><span className="atlas-caption">{entry.name[locale]}<ArrowUpRight size={15} /></span></button>)}
        </div>
        {resultCount === 0 && <p className="notebook-empty" role="status">{t('atlas.noResults')}</p>}
      </section>
      {templates.length > 0 && <h2 className="display mb-5 scroll-mt-24 text-2xl" id="trip-templates">{t('atlas.templates')}</h2>}
      <div className="grid gap-8 lg:grid-cols-2" data-guide="template-list">
        {templates.map((tr) => (
          <article key={tr.id} className="scrap">
            <div className="paper p-5"><DestinationArt city={tr.destinations[0]} theme={tr.theme} sizes="(max-width: 1023px) calc(100vw - 72px), 560px" /><h2 className="display mt-3 text-2xl">{tr.name}</h2></div>
            <div className="px-2 pt-4">
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {formatRange(tr.startDate, tr.endDate, locale)} · {tr.origin} → {tr.destinations.join(' → ')}
              </div>
              <p className="mt-3 text-sm leading-6">{tr.notes}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip">
                  {themeLabel(t, tr.theme)} {THEMES[tr.theme].name}
                </span>
                <span className="chip">{t('explore.days', { n: tr.days.length })}</span>
                <span className="chip">{t('explore.copyable')}</span>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    setCopying(tr)
                  }}
                >
                  {t('explore.copy')}
                </button>
                <button className="btn btn-ghost" onClick={() => nav(`/share/${tr.id}`)}>
                  {t('explore.peek')}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {copying && <Modal open title={t('explore.copyTitle')} onClose={() => setCopying(null)}><div className="space-y-4"><label className="block">{t('explore.start')}<input className="field mt-2" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>{validTripDate(start) && <p>{start} → {shiftDate(start, copying.days.length - 1)} · {copying.days.length} {t('settings.days')}</p>}<button className="btn" disabled={!validTripDate(start)} onClick={() => { const id = cloneTrip(copying.id, true, start); nav(`/trip/${id}`) }}>{t('explore.copy')}</button></div></Modal>}
    </div>
  )
}
