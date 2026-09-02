import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { STATUS } from '../catalog'
import { money } from '../lib'
import { Tone } from '../ui'
import { statusLabel, useT } from '../i18n'

export default function Compare() {
  const { id } = useParams()
  const trip = useTrip(id)
  const toggleVote = useApp((s) => s.toggleVote)
  const updateSaved = useApp((s) => s.updateSaved)
  const { t } = useT()
  if (!trip) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-4xl">{t('compare.title')}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {t('compare.blurb')}
        </p>
      </div>
      {trip.compares.map((board) => {
        const items = board.itemIds.map((i) => trip.saved.find((s) => s.id === i)).filter(Boolean)
        return (
          <section key={board.id} className="paper overflow-x-auto p-5">
            <h2 className="display text-2xl">{board.title}</h2>
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
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label={t('compare.price')} items={items.map((it) => (it!.price ? money(it!.price.amount, it!.price.currency) : '—'))} />
                <Row label={t('compare.rating')} items={items.map((it) => (it!.rating ? String(it!.rating) : '—'))} />
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
                        <button className="btn px-2 py-1 text-xs" onClick={() => updateSaved(trip.id, it!.id, { status: 'chosen' })}>
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
    </div>
  )
}

function Row({ label, items }: { label: string; items: string[] }) {
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
