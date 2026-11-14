import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The worker (src/sw.ts, registered by registerSW.js) serves navigations from
// the network, then activates as soon as an update finishes installing.
// The page already open is still running the previous bundles, and those
// files leave the precache when the new worker activates, so a lazy chunk
// from the old build would 404. Reload once onto the new worker. The listener
// is added only when a controller already exists, so the first install does
// not reload a page that just came from the network.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
