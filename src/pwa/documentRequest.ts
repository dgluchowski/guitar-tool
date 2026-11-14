const DOCUMENT_ACCEPT = 'text/html,application/xhtml+xml'

/**
 * Rebuild a document request so the browser HTTP cache cannot answer it.
 * GitHub Pages sends `Cache-Control: max-age=600` on index.html. Workbox does
 * not apply `fetchOptions` to navigation requests, so a normal fetch would
 * replay that cached shell for up to ten minutes after a deploy.
 * The URL stays the same so the runtime cache key still matches the
 * navigation, which is what offline reloads look up.
 */
export function freshDocumentRequest(request: Request): Request {
  return new Request(request.url, {
    cache: 'reload',
    credentials: 'same-origin',
    redirect: 'follow',
    headers: { Accept: DOCUMENT_ACCEPT },
  })
}

/**
 * NetworkFirst treats any completed fetch as success, including a 404 or 500.
 * Fail those so the strategy can use the cached shell instead: unknown paths
 * keep opening the app, and a down origin does not replace a stored page.
 */
export function requireOkDocument(response: Response): Response {
  if (!response.ok) throw new Error(`document status ${response.status}`)
  return response
}
