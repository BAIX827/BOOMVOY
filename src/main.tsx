import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root && !root.childElementCount) {
    root.innerHTML = `<pre style="padding:24px;white-space:pre-wrap">${e.message}\n${e.filename}:${e.lineno}</pre>`
  }
})

const el = document.getElementById('root')
if (!el) throw new Error('root missing')
createRoot(el).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
