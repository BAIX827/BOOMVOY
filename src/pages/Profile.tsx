import { useEffect, useRef, useState } from 'react'
import { replaceTravelData, useApp } from '../store'
import { THEMES } from '../catalog'
import { Label, LangSwitch } from '../ui'
import type { ThemeId } from '../types'
import { resolveBackend } from '../llm'
import { themeLabel, useT } from '../i18n'
import { ThemeBadge } from '../ThemeDecor'
import { acceptDownloadedSnapshot, createSyncSnapshot, downloadSnapshot, restoreLocalPhotos, uploadSnapshot, type SyncConflict } from '../syncClient'
import { isSyncSnapshot, mergeImportedProfile } from '../syncSchema'

const MAX_IMPORT_BYTES = 64 * 1024 * 1024
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

export default function Profile() {
  const profile = useApp((s) => s.profile)
  const trips = useApp((s) => s.trips)
  const setProfile = useApp((s) => s.setProfile)
  const resetDemo = useApp((s) => s.resetDemo)
  const backend = resolveBackend(profile)
  const { t } = useT()
  const [syncToken, setSyncToken] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')
  const [syncConflict, setSyncConflict] = useState<SyncConflict | null>(null)
  const syncRequest = useRef<AbortController | null>(null)

  useEffect(() => () => syncRequest.current?.abort(), [])

  function beginSync() {
    syncRequest.current?.abort()
    const controller = new AbortController()
    syncRequest.current = controller
    return controller
  }

  function changeSyncScope() {
    syncRequest.current?.abort()
    syncRequest.current = null
    setSyncBusy(false)
    setSyncConflict(null)
    setSyncStatus('')
  }

  async function upload() {
    if (!backend.ready || !syncToken.trim() || syncBusy) { setSyncStatus(t('sync.needConfig')); return }
    const controller = beginSync()
    setSyncBusy(true); setSyncStatus('')
    try {
      const result = await uploadSnapshot(backend, syncToken, createSyncSnapshot(profile, trips), controller.signal)
      if (controller.signal.aborted) return
      setSyncConflict(result.ok ? null : result)
      setSyncStatus(result.ok ? t('sync.uploaded', { n: result.revision }) : t('sync.conflict', { n: result.revision }))
    } catch {
      if (controller.signal.aborted) return
      setSyncStatus(t('sync.failed'))
    } finally {
      if (syncRequest.current === controller) syncRequest.current = null
      if (!controller.signal.aborted) setSyncBusy(false)
    }
  }

  async function download() {
    if (!backend.ready || !syncToken.trim() || syncBusy) { setSyncStatus(t('sync.needConfig')); return }
    const controller = beginSync()
    setSyncBusy(true); setSyncStatus('')
    try {
      const result = syncConflict ? { ok: true as const, revision: syncConflict.revision, etag: syncConflict.etag, updatedAt: null, snapshot: syncConflict.snapshot }
        : await downloadSnapshot(backend, syncToken, controller.signal)
      if (controller.signal.aborted) return
      if (!result.snapshot) {
        acceptDownloadedSnapshot(backend, result.revision, result.etag)
        setSyncConflict(null)
        setSyncStatus(t('sync.empty'))
        return
      }
      if (!window.confirm(t('sync.downloadConfirm'))) return
      const current = useApp.getState()
      const templates = current.trips.filter((trip) => trip.template)
      replaceTravelData({
        trips: [...restoreLocalPhotos(result.snapshot.trips, current.trips), ...templates],
        profile: { ...current.profile, ...result.snapshot.profile, backendUrl: current.profile.backendUrl },
      })
      acceptDownloadedSnapshot(backend, result.revision, result.etag)
      setSyncConflict(null)
      setSyncStatus(t('sync.downloaded', { n: result.revision }))
    } catch {
      if (controller.signal.aborted) return
      setSyncStatus(t('sync.failed'))
    } finally {
      if (syncRequest.current === controller) syncRequest.current = null
      if (!controller.signal.aborted) setSyncBusy(false)
    }
  }

  function exportData() {
    const safeProfile = {
      name: profile.name,
      homeCity: profile.homeCity,
      homeCurrency: profile.homeCurrency,
      themePref: profile.themePref,
      locale: profile.locale,
    }
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), profile: safeProfile, trips }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `boomvoy-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('too large')
      const data: unknown = JSON.parse(await file.text())
      if (!record(data) || data.schemaVersion !== undefined && data.schemaVersion !== 1 || !Array.isArray(data.trips)) throw new Error('invalid')
      const importedProfile = mergeImportedProfile(data.profile, profile)
      const snapshot: unknown = { schemaVersion: 1, profile: importedProfile, trips: data.trips }
      if (!isSyncSnapshot(snapshot, { allowLocalFields: true })) throw new Error('invalid')
      replaceTravelData({
        trips: snapshot.trips,
        profile: {
          ...profile,
          ...snapshot.profile,
        },
      })
      window.alert(t('profile.importDone', { n: snapshot.trips.length }))
    } catch {
      window.alert(t('profile.importFail'))
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display mb-6 text-4xl">{t('profile.title')}</h1>
      <div className="paper mb-6 space-y-4 p-6">
        <div>
          <Label>{t('profile.language')}</Label>
          <LangSwitch />
        </div>
      </div>
      <div className="paper space-y-4 p-6">
        <div>
          <Label>{t('profile.name')}</Label>
          <input className="field" maxLength={250} value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
        </div>
        <div>
          <Label>{t('profile.origin')}</Label>
          <input className="field" maxLength={250} value={profile.homeCity} onChange={(e) => setProfile({ homeCity: e.target.value })} />
        </div>
        <div>
          <Label>{t('profile.currency')}</Label>
          <select className="field" value={profile.homeCurrency} onChange={(e) => setProfile({ homeCurrency: e.target.value })}>
            {['AUD', 'CNY', 'USD', 'JPY', 'EUR'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>{t('profile.theme')}</Label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              className={profile.themePref === 'auto' ? 'btn' : 'btn btn-ghost'}
              onClick={() => setProfile({ themePref: 'auto' })}
            >
              {t('profile.followTrip')}
            </button>
            {(Object.keys(THEMES) as ThemeId[]).map((id) => (
              <button
                key={id}
                className={`paper theme-preview theme-${id} p-3 text-left`}
                style={{ outline: profile.themePref === id ? '2px solid var(--ink)' : undefined }}
                onClick={() => setProfile({ themePref: id })}
              >
                <div className="mb-2 flex gap-1">
                  {THEMES[id].swatches.map((c) => (
                    <span key={c} className="h-5 flex-1 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <div className="font-medium">{themeLabel(t, id)}</div>
                <ThemeBadge theme={id} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="paper mt-6 space-y-4 p-6">
        <h2 className="display text-2xl">{t('profile.api')}</h2>
        <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
          {backend.fromEnv ? t('profile.apiEnv') : t('profile.apiHint')}
        </p>
        <div>
          <Label>{t('profile.apiUrl')}</Label>
          <input
            className="field"
            placeholder="/api"
            value={profile.backendUrl || ''}
            onChange={(e) => { changeSyncScope(); setProfile({ backendUrl: e.target.value }) }}
          />
        </div>
      </div>
      <div className="paper mt-6 space-y-3 p-6">
        <h2 className="display text-2xl">{t('profile.data')}</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('profile.dataHint')}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={exportData}>{t('profile.export')}</button>
          <label className="btn btn-ghost cursor-pointer">
            {t('profile.import')}
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importData(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
      <div className="paper mt-6 space-y-3 p-6">
        <h2 className="display text-2xl">{t('sync.title')}</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('sync.hint')}</p>
        <label className="block space-y-2 text-sm">
          <span>{t('sync.token')}</span>
          <input className="field" type="password" autoComplete="off" value={syncToken} onChange={(event) => { changeSyncScope(); setSyncToken(event.target.value) }} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={syncBusy} onClick={() => void upload()}>{t('sync.upload')}</button>
          <button className="btn btn-ghost" disabled={syncBusy} onClick={() => void download()}>{t('sync.download')}</button>
        </div>
        {syncStatus && <p role="status" className="text-sm">{syncStatus}</p>}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-ghost" onClick={() => { if (window.confirm(t('profile.resetConfirm'))) resetDemo() }}>
          {t('profile.resetDemo')}
        </button>
        <button className="btn" onClick={() => window.dispatchEvent(new Event('boomvoy-start-guide'))}>
          {t('profile.replayGuide')}
        </button>
      </div>
    </div>
  )
}
