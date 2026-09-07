import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './Shell'
import TripShell from './TripShell'
import GuideCat from './GuideCat'
import { useT } from './i18n'
import { useApp } from './store'

const Home = lazy(() => import('./pages/Home'))
const Explore = lazy(() => import('./pages/Explore'))
const CreateTrip = lazy(() => import('./pages/CreateTrip'))
const Profile = lazy(() => import('./pages/Profile'))
const Overview = lazy(() => import('./pages/Overview'))
const Plan = lazy(() => import('./pages/Plan'))
const MapPage = lazy(() => import('./pages/MapPage'))
const Saved = lazy(() => import('./pages/Saved'))
const Compare = lazy(() => import('./pages/Compare'))
const Bookings = lazy(() => import('./pages/Bookings'))
const Budget = lazy(() => import('./pages/Budget'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Weather = lazy(() => import('./pages/Weather'))
const Group = lazy(() => import('./pages/Group'))
const Notes = lazy(() => import('./pages/Notes'))
const Journal = lazy(() => import('./pages/Journal'))
const Pack = lazy(() => import('./pages/Pack'))
const Share = lazy(() => import('./pages/Share'))

function LocaleDoc() {
  const { locale } = useT()
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])
  return null
}

function ThemeDoc() {
  const pref = useApp((s) => s.profile.themePref)
  const theme = pref === 'auto' ? 'cream' : pref
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-cream', 'theme-ocean', 'theme-forest')
    root.classList.add(`theme-${theme}`)
  }, [theme])
  return null
}

export default function App() {
  return (
    <>
      <LocaleDoc />
      <ThemeDoc />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/new" element={<CreateTrip />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/trip/:id" element={<TripShell />}>
            <Route index element={<Overview />} />
            <Route path="plan" element={<Plan />} />
            <Route path="map" element={<MapPage />} />
            <Route path="saved" element={<Saved />} />
            <Route path="compare" element={<Compare />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="budget" element={<Budget />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="weather" element={<Weather />} />
            <Route path="group" element={<Group />} />
            <Route path="notes" element={<Notes />} />
            <Route path="journal" element={<Journal />} />
            <Route path="pack" element={<Pack />} />
          </Route>
          <Route path="/share/:id" element={<Share />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <GuideCat />
    </>
  )
}

function RouteLoading() {
  const { t } = useT()
  return <div className="grid min-h-screen place-items-center text-sm" style={{ color: 'var(--muted)' }}>{t('ui.loading')}</div>
}
