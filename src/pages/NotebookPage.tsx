import { useParams } from 'react-router-dom'
import { useTrip } from '../store'
import Notebook from '../Notebook'
import { useT } from '../i18n'

export default function NotebookPage() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { t } = useT()
  return trip ? <div className="notebook-page"><h1 className="sr-only">{t('notebook.title')}</h1><Notebook trip={trip} /></div> : null
}
