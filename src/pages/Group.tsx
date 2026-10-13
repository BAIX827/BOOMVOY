import CollaborationPanel from '../CollaborationPanel'
import { useShared } from '../collaborationState'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { MEMBER_COLORS } from '../catalog'
import type { Role } from '../types'
import { uid } from '../lib'
import { useT } from '../i18n'

export default function Group() {
  const { id } = useParams()
  const trip = useTrip(id)
  const updateTrip = useApp((s) => s.updateTrip)
  const toggleVote = useApp((s) => s.toggleVote)
  const { t } = useT()
  const [name, setName] = useState('')
  const session = useShared((state) => id ? state.sessions[id] : undefined)
  const owner = !session || session.role === 'owner'
  if (!trip) return null

  const nextCount = Math.max(trip.travellers, trip.members.length + 1)
  const hotelVote = trip.saved.filter((s) => s.kind === 'hotel' && (s.status === 'comparing' || s.status === 'shortlisted' || s.status === 'chosen' || s.status === 'booked'))

  return (
    <div className="space-y-6">
      <h1 className="display text-4xl">{t('group.title')}</h1>
      <CollaborationPanel trip={trip} />
      {!owner && <p className="text-sm">{t('collab.ownerOnly')}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {trip.members.map((m) => (
          <div key={m.id} className="paper flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: m.color }}>
              {m.name.slice(0, 1)}
            </span>
            <div className="flex-1">
              <input
                className="field"
                disabled={!owner}
                value={m.name}
                onChange={(e) =>
                  updateTrip(trip.id, {
                    members: trip.members.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
                  })
                }
              />
            </div>
            <select
              className="field w-auto"
              disabled={!owner || !!session && m.role === 'owner'}
              value={m.role}
              onChange={(e) =>
                updateTrip(trip.id, {
                  members: trip.members.map((x) => (x.id === m.id ? { ...x, role: e.target.value as Role } : x)),
                })
              }
            >
              <option disabled={!!session} value="owner">{t('role.owner')}</option>
              <option value="editor">{t('role.editor')}</option>
              <option value="viewer">{t('role.viewer')}</option>
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="field" placeholder={t('group.invite')} value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn"
          disabled={!owner || !name.trim() || trip.members.length >= 100 || nextCount > 100 || nextCount * trip.budgetPerPerson > 1_000_000_000_000}
          onClick={() => {
            updateTrip(trip.id, {
              members: [
                ...trip.members,
                { id: uid(), name: name.trim(), role: 'editor', color: MEMBER_COLORS[trip.members.length % MEMBER_COLORS.length] },
              ],
              travellers: nextCount,
              totalBudget: nextCount * trip.budgetPerPerson,
            })
            setName('')
          }}
        >
          {t('group.add')}
        </button>
      </div>

      <section className="paper p-5">
        <h2 className="display text-2xl">{t('group.hotel')}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {t('group.hotelHint')}
        </p>
        <div className="mt-4 space-y-3">
          {hotelVote.map((h) => {
            const votes = Object.values(h.votes).filter(Boolean).length
            return (
              <div key={h.id}>
                <div className="flex justify-between text-sm">
                  <span>{h.name}</span>
                  <span>{t('group.votes', { n: votes })}</span>
                </div>
                <div className="mt-1 flex gap-1">
                  {trip.members.map((m) => (
                    <button
                      key={m.id}
                      disabled={!!session && session.memberId !== m.id}
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{ background: h.votes[m.id] ? m.color : 'var(--bg-2)', color: h.votes[m.id] ? 'white' : 'inherit' }}
                      onClick={() => toggleVote(trip.id, h.id, m.id)}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
