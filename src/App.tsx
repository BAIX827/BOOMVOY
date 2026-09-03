import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './Shell'
import TripShell from './TripShell'
import Home from './pages/Home'
import Explore from './pages/Explore'
import CreateTrip from './pages/CreateTrip'
import Profile from './pages/Profile'
import Overview from './pages/Overview'
import Plan from './pages/Plan'
import MapPage from './pages/MapPage'
import Saved from './pages/Saved'
import Compare from './pages/Compare'
import Bookings from './pages/Bookings'
import Budget from './pages/Budget'
import Expenses from './pages/Expenses'
import Weather from './pages/Weather'
import Group from './pages/Group'
import Notes from './pages/Notes'
import Journal from './pages/Journal'
import Share from './pages/Share'
import GuideCat from './GuideCat'
import { useT } from './i18n'
import { useApp } from './store'

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
        </Route>
        <Route path="/share/:id" element={<Share />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <GuideCat />
    </>
  )
}
