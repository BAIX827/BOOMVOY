import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Briefcase, Check, Receipt } from 'lucide-react'
import type { PackItem, Trip } from './types'
import { useApp } from './store'
import { activePlaces } from './domain'
import { bookingStatusLabel, kindLabel, useT } from './i18n'
import { formatDay, money } from './lib'
import { TripInput, TripTextarea } from './TripControls'
import { Tone } from './ui'
import { BOOKING_STATUS } from './catalog'
import DestinationArt from './DestinationArt'
import { emptyPacking, PACK_CATS } from './packing'

type NotebookTab = 'checklist' | 'tickets' | 'notes'
const tabs: NotebookTab[] = ['checklist', 'tickets', 'notes']

export default function Notebook({ trip, compact = false }: { trip: Trip; compact?: boolean }) {
  const { t, locale } = useT()
  const [params, setParams] = useSearchParams()
  const [previewTab, setPreviewTab] = useState<NotebookTab>('checklist')
  const notebookRef = useRef<HTMLElement>(null)
  const requested = params.get('tab') as NotebookTab
  const tab = compact ? previewTab : tabs.includes(requested) ? requested : 'checklist'
  const updateTrip = useApp((state) => state.updateTrip)
  const packing = trip.packing
  useEffect(() => {
    if (!compact && tab === 'checklist' && !trip.packing) updateTrip(trip.id, { packing: emptyPacking(trip) })
  }, [compact, tab, trip.id, trip.packing, updateTrip])
  const packedKey = packing?.phase === 'back' ? 'packedBack' : 'packedOut'
  const packed = packing?.items.filter((item) => item[packedKey]).length || 0
  const visits = trip.days.flatMap((day) => activePlaces(day).filter((place) => place.checkedIn).map((place) => ({ day, place })))
  function selectTab(value: NotebookTab) {
    if (compact) setPreviewTab(value)
    else {
      const next = new URLSearchParams(params)
      next.set('tab', value)
      setParams(next, { replace: true, preventScrollReset: true })
      const book = notebookRef.current
      if (book && book.getBoundingClientRect().top < (window.innerWidth < 1024 ? 69 : 0)) book.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }
  function packingRow(item: PackItem) {
    if (!packing) return null
    const translated = item.catalogId ? t(`pack.item.${item.catalogId}`) : item.name
    const name = translated.startsWith('pack.item.') ? item.name : translated
    return <label key={item.id} className={item[packedKey] ? 'is-packed' : ''}><TripInput type="checkbox" checked={item[packedKey]} onChange={(event) => updateTrip(trip.id, { packing: { ...packing, items: packing.items.map((entry) => entry.id === item.id ? { ...entry, [packedKey]: event.target.checked } : entry) } })} /><span>{name}</span><small>×{item.qty}</small></label>
  }
  return <section ref={notebookRef} className={`travel-notebook ${compact ? 'notebook-preview' : ''}`} aria-label={t('notebook.title')}>
    <div className="notebook-heading"><BookOpen size={21} /><h2 className="display">{t('notebook.title')}</h2><span className="notebook-bookmark" aria-hidden="true" /></div>
    <div className="notebook-tabs" role="tablist" aria-label={t('notebook.title')}>
      {tabs.map((value, index) => <button key={value} type="button" id={`${compact ? 'preview' : 'full'}-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`${compact ? 'preview' : 'full'}-notebook-content`} tabIndex={tab === value ? 0 : -1} onClick={() => selectTab(value)} onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[2] : tabs[(index + (event.key === 'ArrowRight' ? 1 : 2)) % 3]; selectTab(next); document.getElementById(`${compact ? 'preview' : 'full'}-tab-${next}`)?.focus() } }}>{t(`notebook.${value}`)}</button>)}
    </div>
    <div id={`${compact ? 'preview' : 'full'}-notebook-content`} className="notebook-content" role="tabpanel" tabIndex={0} aria-labelledby={`${compact ? 'preview' : 'full'}-tab-${tab}`}>
      {tab === 'checklist' && <>
        <div className="notebook-section-title"><Briefcase size={17} /><h3>{compact ? t('notebook.packing') : t(packing?.phase === 'back' ? 'pack.backTitle' : 'pack.outTitle')}</h3></div>
        <p className="notebook-caption">{packing ? t('notebook.packed', { done: packed, total: packing.items.length }) : t('notebook.noPacking')}</p>
        <Link className="notebook-link" to={`/trip/${trip.id}/${compact ? 'notebook?tab=checklist' : 'pack'}`}>{t('notebook.managePacking')}<ArrowRight size={16} /></Link>
        <div className="notebook-checks">{compact ? packing?.items.slice(0, 5).map(packingRow) : PACK_CATS.map((category) => {
          const items = packing?.items.filter((item) => item.category === category) || []
          return items.length ? <div className="notebook-pack-group" key={category}><h4 className="notebook-caption">{t(`pack.cat.${category}`)}</h4>{items.map(packingRow)}</div> : null
        })}</div>
      </>}
      {tab === 'tickets' && <>
        <Link className="btn btn-ghost mb-5 no-underline" to={`/trip/${trip.id}/bookings`}><Receipt size={16} />{t('notebook.manageTickets')}</Link>
        {trip.bookings.length === 0 && <div className="notebook-empty"><h3>{t('notebook.noTickets')}</h3><p>{t('notebook.noTicketsHint')}</p></div>}
        <div className="notebook-tickets">{(compact ? trip.bookings.slice(0, 2) : trip.bookings).map((booking) => <details className="notebook-ticket" key={booking.id}>
          <summary><div className="ticket-top"><span>{kindLabel(t, booking.kind)}</span><Tone tone={BOOKING_STATUS[booking.status].tone}>{bookingStatusLabel(t, booking.status)}</Tone></div><h3 className="display">{booking.name}</h3><div className="ticket-date">{booking.date ? formatDay(booking.date, locale) : '—'}{booking.checkout && ` → ${formatDay(booking.checkout, locale)}`}</div><span className="ticket-details">{t('notebook.details')}<ArrowRight size={15} /></span></summary>
          <div className="ticket-record">{booking.confirmation && <p>{t('notebook.reference')} · <strong>{booking.confirmation}</strong></p>}{booking.cost && <p>{money(booking.cost.amount, booking.cost.currency)}</p>}{booking.notes && <p className="whitespace-pre-wrap">{booking.notes}</p>}<Link className="notebook-link" to={`/trip/${trip.id}/bookings`}>{t('notebook.manageTickets')}<ArrowRight size={15} /></Link></div>
        </details>)}</div>
      </>}
      {tab === 'notes' && <>
        {compact ? <><h3 className="notebook-section-title">{t('notebook.tripNotes')}</h3><p className="notebook-note-preview">{trip.notes || t('notebook.noNotes')}</p><Link className="notebook-link" to={`/trip/${trip.id}/notebook?tab=notes`}>{t('notebook.notes')}<ArrowRight size={16} /></Link></> : <>
          <label className="block" htmlFor="notebook-trip-notes">{t('notebook.tripNotes')}</label><TripTextarea id="notebook-trip-notes" className="field notebook-writing mt-3" value={trip.notes} placeholder={t('notebook.noNotes')} onChange={(event) => updateTrip(trip.id, { notes: event.target.value })} />
          <div className="notebook-section-title mt-7"><Check size={17} /><h3>{t('notebook.memories')}</h3></div>
          {visits.length === 0 && <p className="notebook-caption mt-3">{t('notebook.noMemories')}</p>}
          {visits.map(({ day, place }) => <article className="notebook-memory" key={`${day.id}-${place.id}`}><p className="notebook-caption">{formatDay(day.date, locale)} · {day.city}</p><h3 className="display text-2xl">{place.name}</h3>{place.feeling && <p className="mt-2 whitespace-pre-wrap">{place.feeling}</p>}{!!place.photos?.length && <div className="mt-3 flex flex-wrap gap-3">{place.photos.map((src, index) => <img src={src} key={index} alt={`${place.name} · ${index + 1}`} className="h-24 w-24 rounded-lg object-cover" loading="lazy" />)}</div>}</article>)}
          <Link className="notebook-link mt-5" to={`/trip/${trip.id}/journal`}>{t('trip.journal')}<ArrowRight size={16} /></Link>
        </>}
      </>}
    </div>
    {compact && <DestinationArt city={trip.destinations[0]} theme={trip.theme} className="notebook-footer-art" />}
  </section>
}
