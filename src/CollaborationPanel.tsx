import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from './store'
import { useShared } from './collaborationState'
import { accessCode, createSharedRoom, inviteSharedMember, parseAccessCode, readSharedRoom } from './collaborationClient'
import { applySharedRoom } from './useSharedTrip'
import { normalizeBackendUrl, resolveBackend } from './llm'
import { uid } from './lib'
import { useT } from './i18n'
import type { Trip } from './types'

export function CollaborationJoin() {
  const { t } = useT(), profile = useApp((state) => state.profile), nav = useNavigate()
  const [backend, setBackend] = useState(resolveBackend(profile).baseUrl)
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function join() {
    setBusy(true); setError('')
    try {
      const credentials = parseAccessCode(code), base = normalizeBackendUrl(backend)
      const room = await readSharedRoom(base, credentials.roomId, credentials.token)
      const local = useApp.getState().trips.find((trip) => trip.id === room.trip.id)
      if (local) useApp.setState({ trips: [{ ...local, id: uid(), name: local.name + (profile.locale === 'en' ? ' · local copy' : ' · 本机副本') }, ...useApp.getState().trips] })
      useShared.getState().put(room.trip.id, { ...room, base: room.trip, backend: base, token: credentials.token, status: 'synced' })
      applySharedRoom(room); setCode(''); nav(`/trip/${room.trip.id}/group`)
    } catch { setError(t('collab.failed')) }
    finally { setBusy(false) }
  }
  return <section className="paper space-y-3 p-5"><h2 className="display text-2xl">{t('collab.join')}</h2><p className="text-sm">{t('collab.hint')}</p><label className="block text-sm">{t('profile.apiUrl')}<input className="field mt-1" value={backend} onChange={(e) => setBackend(e.target.value)} /></label><label className="block text-sm">{t('collab.code')}<textarea className="field mt-1" value={code} autoComplete="off" onChange={(e) => setCode(e.target.value)} /></label><button className="btn" disabled={busy || !code.trim() || !normalizeBackendUrl(backend)} onClick={() => void join()}>{t('collab.join')}</button>{error && <p role="alert">{error}</p>}</section>
}

export default function CollaborationPanel({ trip }: { trip: Trip }) {
  const { t, locale } = useT(), profile = useApp((state) => state.profile)
  const session = useShared((state) => state.sessions[trip.id])
  const [backend, setBackend] = useState(resolveBackend(profile).baseUrl), [token, setToken] = useState('')
  const [member, setMember] = useState(trip.members.find((entry) => entry.role !== 'owner')?.id || '')
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function create() {
    setBusy(true); setError('')
    try {
      const base = normalizeBackendUrl(backend), result = await createSharedRoom(base, token.trim(), trip)
      useShared.getState().put(trip.id, { ...result.room, base: result.room.trip, backend: base, token: result.token, status: 'synced' })
      setToken(''); setCode(accessCode(result.room.roomId, result.token))
    } catch { setError(t('collab.failed')) }
    finally { setBusy(false) }
  }
  async function invite() {
    if (!session) return
    setBusy(true); setError('')
    try { setCode(await inviteSharedMember(session.backend, session.roomId, session.token, member)) }
    catch { setError(t('collab.failed')) }
    finally { setBusy(false) }
  }
  return <section className="paper space-y-3 p-5"><h2 className="display text-2xl">{t('collab.title')}</h2><p className="text-sm">{t('collab.hint')}</p>
    {!session ? <><label className="block text-sm">{t('profile.apiUrl')}<input className="field mt-1" value={backend} onChange={(e) => setBackend(e.target.value)} /></label><label className="block text-sm">{t('collab.ownerToken')}<input className="field mt-1" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /></label><button className="btn" disabled={busy || token.trim().length < 32 || !normalizeBackendUrl(backend)} onClick={() => void create()}>{t('collab.create')}</button></> : <>
      <p>{t('collab.connected', { name: trip.members.find((entry) => entry.id === session.memberId)?.name || '', role: t('role.' + session.role) })}</p>
      <p className="text-sm" role="status">{session.status === 'synced' ? t('collab.synced', { n: session.revision }) : t('collab.' + session.status)}</p>
      <div className="flex flex-wrap gap-2"><button className="btn btn-ghost" onClick={() => { useShared.getState().patch(trip.id, { status: session.status === 'conflict' ? 'conflict' : 'synced' }); window.dispatchEvent(new Event('boomvoy-sync')) }}>{t('collab.retry')}</button><button className="btn btn-ghost" onClick={() => setCode(accessCode(session.roomId, session.token))}>{t('collab.access')}</button><button className="btn btn-ghost" onClick={() => { useShared.getState().disconnect(trip.id); setCode('') }}>{t('collab.leave')}</button></div>
      {session.role === 'owner' && <div className="space-y-2"><label className="block text-sm">{t('collab.member')}<select className="field mt-1" value={member} onChange={(e) => setMember(e.target.value)}><option value="">—</option>{trip.members.filter((entry) => entry.id !== session.memberId).map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {t('role.' + entry.role)}</option>)}</select></label><button className="btn" disabled={busy || !member || session.status !== 'synced'} onClick={() => void invite()}>{t('collab.invite')}</button><p className="text-xs">{t('collab.expiry')}</p></div>}
      {!!session.changes.length && <details><summary className="cursor-pointer text-sm">{t('collab.updates')}</summary><ul className="mt-2 text-xs">{session.changes.slice(0, 8).map((change) => <li key={change.revision}>{trip.members.find((entry) => entry.id === change.memberId)?.name || '—'} · {new Date(change.at).toLocaleString(locale === 'en' ? 'en-AU' : 'zh-CN')} · v{change.revision}</li>)}</ul></details>}
    </>}
    {code && <div className="space-y-2"><p className="text-sm">{t('collab.codeHint')}</p><label className="block text-sm">{t('collab.code')}<textarea className="field mt-1" aria-label={t('collab.code')} readOnly value={code} /></label><p className="text-xs">{t('collab.session')}</p></div>}{error && <p role="alert">{error}</p>}
  </section>
}

export function SharedStatus({ trip }: { trip: Trip }) {
  const { t, locale } = useT(), session = useShared((state) => state.sessions[trip.id])
  if (!session) return null
  return <aside className="paper mb-4 space-y-2 p-3 text-sm" role="status"><p>{session.status === 'synced' ? t('collab.synced', { n: session.revision }) : t('collab.' + session.status)}</p>{session.role === 'viewer' && <p>{t('collab.viewer')}</p>}{session.status === 'conflict' && <button className="btn btn-soft text-sm" onClick={async () => {
    try {
      const room = await readSharedRoom(session.backend, session.roomId, session.token)
      const local = useApp.getState().trips.find((item) => item.id === trip.id)
      if (local) useApp.setState({ trips: [{ ...local, id: uid(), name: local.name + (locale === 'en' ? ' · local copy' : ' · 本机副本') }, ...useApp.getState().trips] })
      applySharedRoom(room)
    } catch { useShared.getState().patch(trip.id, { status: 'conflict' }) }
  }}>{t('collab.resolve')}</button>}</aside>
}
