import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The service worker (registered by the PWA plugin's registerSW.js) precaches
// the whole app and uses skipWaiting/clientsClaim, so an updated worker takes
// control immediately — but the *already-open* page keeps running the old
// bundle until it reloads. On an installed mobile PWA that reload may never
// happen on its own, so new releases (e.g. an added tuning) stay invisible.
// Reload exactly once when an updated worker takes over so fresh content shows.
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
