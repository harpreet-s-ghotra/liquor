import { describe, expect, it } from 'vitest'

import { normalizeApiPathname } from './api'

describe('catalog-admin server route normalization', () => {
  it('accepts vite middleware paths after the /api mount prefix is stripped', () => {
    expect(normalizeApiPathname('/merchants')).toBe('/merchants')
    expect(normalizeApiPathname('/catalog-products/by-ttb')).toBe('/catalog-products/by-ttb')
  })

  it('accepts raw request paths that still include the /api prefix', () => {
    expect(normalizeApiPathname('/api/merchants')).toBe('/merchants')
    expect(normalizeApiPathname('/api/curation/promote')).toBe('/curation/promote')
  })
})
