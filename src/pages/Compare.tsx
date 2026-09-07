import { useState, type ReactNode } from 'react'
import DecisionAssistant from '../DecisionAssistant'
import { safeDecisionUrl } from '../decision'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { KINDS, STATUS } from '../catalog'
import { money } from '../lib'
import { Label, Modal, Tone } from '../ui'
import { kindLabel, statusLabel, useT } from '../i18n'
import type { SavedItem, SavedKind } from '../types'

export default function Compare() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { toggleVote, updateSaved, addCompareBoard, updateCompareBoard, removeCompareBoard, addBooking } = useApp()
  const { t, locale } = useT()
  const decisionApiUrl = useApp((state) => state.profile.decisionApiUrl)
  const [open, setOpen] = useState(false)
  const [bookingCandidate, setBookingCandidate] = useState<SavedItem | undefined>()
  if (!trip) return null

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl">{t('compare.title')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {t('compare.blurb')}
          </p>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>{t('compare.create')}</button>
      </div>
      <DecisionAssistant key={`${trip.id}-${locale}-${decisionApiUrl || ''}`} trip={trip} />
      {trip.compares.map((board) => {
        const items = board.itemIds.map((i) => trip.saved.find((s) => s.id === i)).filter(Boolean)
        return (
          <section key={board.id} className="paper overflow-x-auto p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                className="field max-w-sm text-lg font-medium"
                value={board.title}
                onChange={(e) => updateCompareBoard(trip.id, board.id, { title: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <select
                  className="field w-auto text-xs"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) updateCompareBoard(trip.id, board.id, { itemIds: [...board.itemIds, e.target.value] })
                  }}
                >
                  <option value="">{t('compare.addItem')}</option>
                  {trip.saved.filter((item) => item.kind === board.kind && !board.itemIds.includes(item.id)).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <button className="btn btn-ghost px-3 py-1 text-xs" onClick={() => removeCompareBoard(trip.id, board.id)}>{t('compare.deleteBoard')}</button>
              </div>
            </div>
            <table className="mt-4 w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="pb-3 font-medium">{t('compare.col')}</th>
                  {items.map((it) => (
                    <th key={it!.id} className="pb-3 font-medium">
                      {it!.name}
                      <div className="mt-1">
                        <Tone tone={STATUS[it!.status].tone}>{statusLabel(t, it!.status)}</Tone>
                      </div>
                      <button className="mt-2 text-xs underline" style={{ color: 'var(--muted)' }} onClick={() => updateCompareBoard(trip.id, board.id, { itemIds: board.itemIds.filter((id) => id !== it!.id) })}>
                        {t('compare.removeItem')}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label={t('compare.price')} items={items.map((it) => (it!.price ? money(it!.price.amount, it!.price.currency) : '—'))} />
                <Row label={t('compare.rating')} items={items.map((it) => (it!.rating ? t('decision.legacyRating', { n: it!.rating }) : t('decision.noRating')))} />
                <Row label={t('decision.source')} items={items.map((it) => safeDecisionUrl(it!.url) ? <a className="underline" href={safeDecisionUrl(it!.url)} target="_blank" rel="noreferrer">{t('decision.detail')}</a> : '—')} />
                {board.kind === 'hotel' && <Row label={t('decision.seaView')} items={items.map((it) => it!.decision?.seaView === 'room' ? t('decision.viewRoom') : t('decision.unknown'))} />}
                {board.kind === 'restaurant' && <Row label={t('decision.cuisine')} items={items.map((it) => it!.decision?.cuisines?.map((cuisine) => t('decision.cuisine.' + cuisine)).join(' · ') || '—')} />}
                <Row label="👍" items={items.map((it) => it!.pros?.join('、') || '—')} />
                <Row label="👎" items={items.map((it) => it!.cons?.join('、') || '—')} />
                {board.kind === 'hotel' && (
                  <>
                    <Row label={t('compare.breakfast')} items={items.map((it) => it!.meta?.breakfast || '—')} />
                    <Row label={t('compare.parking')} items={items.map((it) => it!.meta?.parking || '—')} />
                    <Row label={t('compare.cancel')} items={items.map((it) => it!.meta?.cancel || '—')} />
                    <Row label={t('compare.room')} items={items.map((it) => it!.meta?.size || '—')} />
                  </>
                )}
                {board.kind === 'flight' && (
                  <>
                    <Row label={t('compare.airline')} items={items.map((it) => it!.meta?.airline || '—')} />
                    <Row label={t('compare.bags')} items={items.map((it) => it!.meta?.bags || '—')} />
                    <Row label={t('compare.refund')} items={items.map((it) => it!.meta?.refund || '—')} />
                  </>
                )}
                <Row label={t('compare.notes')} items={items.map((it) => it!.notes || it!.rejectReason || '—')} />
                <tr>
                  <td className="py-3">{t('compare.vote')}</td>
                  {items.map((it) => {
                    const votes = Object.values(it!.votes).filter(Boolean).length
                    return (
                      <td key={it!.id} className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {trip.members.map((m) => (
                            <button
                              key={m.id}
                              className="rounded-full px-2 py-0.5 text-xs"
                              style={{
                                background: it!.votes[m.id] ? m.color : 'var(--bg-2)',
                                color: it!.votes[m.id] ? 'white' : 'var(--ink)',
                              }}
                              onClick={() => toggleVote(trip.id, it!.id, m.id)}
                            >
                              {m.name}
                            </button>
                          ))}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                          {t('compare.votes', { n: votes })}
                        </div>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="py-3">{t('compare.decide')}</td>
                  {items.map((it) => (
                    <td key={it!.id} className="py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          className="btn px-2 py-1 text-xs"
                          onClick={() => {
                            updateSaved(trip.id, it!.id, { status: 'chosen' })
                            const exists = trip.bookings.some((booking) => booking.sourceSavedId === it!.id)
                            if (!exists) setBookingCandidate(it!)
                          }}
                        >
                          {t('compare.choose')}
                        </button>
                        <button
                          className="btn btn-ghost px-2 py-1 text-xs"
                          onClick={() =>
                            updateSaved(trip.id, it!.id, {
                              status: 'rejected',
                              rejectReason: it!.rejectReason || t('compare.rejectReason'),
                            })
                          }
                        >
                          {t('compare.reject')}
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        )
      })}
      {trip.compares.length === 0 && (
        <div className="paper p-8 text-sm" style={{ color: 'var(--muted)' }}>
          {t('compare.empty')}
        </div>
      )}
      <CreateBoard
        open={open}
        saved={trip.saved}
        onClose={() => setOpen(false)}
        onCreate={(board) => {
          addCompareBoard(trip.id, board)
          setOpen(false)
        }}
      />
      <Modal open={!!bookingCandidate} title={t('compare.createBookingTitle')} onClose={() => setBookingCandidate(undefined)}>
        <p className="text-sm leading-6">{t('compare.createBookingAsk')}</p>
        <div className="mt-4 flex gap-2">
          <button
            className="btn"
            onClick={() => {
              if (!bookingCandidate) return
              addBooking(trip.id, {
                kind: bookingCandidate.kind,
                name: bookingCandidate.name,
                status: 'need',
                url: bookingCandidate.url,
                cost: bookingCandidate.price,
                notes: bookingCandidate.notes,
                sourceSavedId: bookingCandidate.id,
              })
              setBookingCandidate(undefined)
            }}
          >
            {t('compare.createBooking')}
          </button>
          <button className="btn btn-ghost" onClick={() => setBookingCandidate(undefined)}>{t('compare.bookingLater')}</button>
        </div>
      </Modal>
    </div>
  )
}

function CreateBoard({
  open,
  saved,
  onClose,
  onCreate,
}: {
  open: boolean
  saved: Array<{ id: string; name: string; kind: SavedKind }>
  onClose: () => void
  onCreate: (board: { kind: SavedKind; title: string; itemIds: string[] }) => void
}) {
  const { t } = useT()
  const [kind, setKind] = useState<SavedKind>('hotel')
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const candidates = saved.filter((item) => item.kind === kind)
  return (
    <Modal open={open} title={t('compare.create')} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>{t('saved.kind')}</Label>
          <select className="field" value={kind} onChange={(e) => { setKind(e.target.value as SavedKind); setPicked([]) }}>
            {(Object.keys(KINDS) as SavedKind[]).map((value) => <option key={value} value={value}>{kindLabel(t, value)}</option>)}
          </select>
        </div>
        <div>
          <Label>{t('compare.boardTitle')}</Label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('compare.autoTitle', { kind: kindLabel(t, kind) })} />
        </div>
        <div>
          <Label>{t('compare.pickItems')}</Label>
          <div className="space-y-2">
            {candidates.map((item) => (
              <label key={item.id} className="flex items-center gap-2 rounded-xl p-3 text-sm" style={{ background: 'var(--bg-2)' }}>
                <input
                  type="checkbox"
                  checked={picked.includes(item.id)}
                  onChange={() => setPicked((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])}
                />
                {item.name}
              </label>
            ))}
            {candidates.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('compare.noCandidates')}</p>}
          </div>
        </div>
        <button
          className="btn w-full"
          disabled={picked.length === 0}
          onClick={() => onCreate({ kind, title: title.trim() || t('compare.autoTitle', { kind: kindLabel(t, kind) }), itemIds: picked })}
        >
          {t('compare.create')}
        </button>
      </div>
    </Modal>
  )
}

function Row({ label, items }: { label: string; items: ReactNode[] }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--line)' }}>
      <td className="py-3" style={{ color: 'var(--muted)' }}>
        {label}
      </td>
      {items.map((v, i) => (
        <td key={i} className="py-3">
          {v}
        </td>
      ))}
    </tr>
  )
}
