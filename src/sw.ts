/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute, PrecacheFallbackPlugin } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { freshDocumentRequest, requireOkDocument } from './pwa/documentRequest'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

// Activate the updated worker as soon as it finishes installing so it can
// drop precached files from the previous build. The open page reloads once
// from main.tsx when this worker takes control.
self.skipWaiting()
clientsClaim()

const HTML_CACHE = 'html-pages'

// Document loads go to the network before any precache match. precacheAndRoute
// answers index.html, and "/" via its directory index, from the previous
// build's cache. Registering this route first is what makes the next visit
// after a deploy show the new shell while the network is up.
const appShell = new NetworkFirst({
  cacheName: HTML_CACHE,
  // A hung connection falls back to the last shell instead of spinning.
  networkTimeoutSeconds: 3,
  // GitHub Pages sets Vary: Accept-Encoding. Ignore it so an offline
  // navigation still matches the response stored from the previous visit.
  matchOptions: { ignoreVary: true },
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({
      maxEntries: 8,
      maxAgeSeconds: 30 * 24 * 60 * 60,
    }),
    // Until a controlled navigation has filled the runtime cache, the copy
    // precached at install time is the offline shell.
    new PrecacheFallbackPlugin({ fallbackURL: 'index.html' }),
    {
      requestWillFetch: async ({ request }) => freshDocumentRequest(request),
      fetchDidSucceed: async ({ response }) => requireOkDocument(response),
    },
  ],
})

registerRoute(new NavigationRoute(appShell))
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.endsWith('/index.html'),
  appShell,
)

// Hashed JS and CSS stay cache-first. Their URLs change when the contents do.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
