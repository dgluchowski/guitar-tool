import { describe, expect, it } from 'vitest'
import { freshDocumentRequest, requireOkDocument } from './documentRequest'

describe('freshDocumentRequest', () => {
  it('reloads the same URL so the HTTP cache cannot serve a stale shell', () => {
    const request = freshDocumentRequest(new Request('https://example.com/guitar-tool/'))
    expect(request.url).toBe('https://example.com/guitar-tool/')
    expect(request.cache).toBe('reload')
    expect(request.credentials).toBe('same-origin')
    expect(request.headers.get('Accept')).toContain('text/html')
  })
})

describe('requireOkDocument', () => {
  it('returns a successful document', () => {
    const response = new Response('<html></html>', { status: 200 })
    expect(requireOkDocument(response)).toBe(response)
  })

  it('rejects an error status so the cached shell can be used', () => {
    const response = new Response('missing', { status: 404 })
    expect(() => requireOkDocument(response)).toThrow(/404/)
  })
})
