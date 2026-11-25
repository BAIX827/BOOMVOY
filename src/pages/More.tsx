import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CloudSun, Compass, NotebookPen, PiggyBank, Settings2, Share2, Users, Wallet } from 'lucide-react'
import { useTrip } from '../store'
import { useT } from '../i18n'
import { useTripContext } from '../useTripContext'

export default function More() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { t } = useT()
  const { href } = useTripContext(trip)
  if (!trip) return null
  const items = [
    { to: 'saved', label: 'trip.saved', icon: Compass },
    { to: 'compare', label: 'trip.compare', icon: NotebookPen },
    { to: 'weather', label: 'trip.weather', icon: CloudSun },
    { to: 'budget', label: 'trip.budget', icon: PiggyBank },
    { to: 'expenses', label: 'trip.expenses', icon: Wallet },
    { to: 'group', label: 'trip.group', icon: Users },
    { to: 'notes', label: 'journey.settings', icon: Settings2 },
  ]
  return <div className="more-page"><h1 className="display text-4xl">{t('trip.more')}</h1><div className="more-links paper mt-6">{items.map(({ to, label, icon: Icon }) => <Link key={to} to={href(to)}><Icon size={22} /><span>{t(label)}</span><ArrowRight size={17} /></Link>)}<Link to={`/share/${trip.id}`}><Share2 size={22} /><span>{t('trip.share')}</span><ArrowRight size={17} /></Link></div></div>
}
