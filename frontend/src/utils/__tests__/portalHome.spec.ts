import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  PRICEAI_PORTAL_MODULES,
  getPriceAiModuleHref,
  getPriceAiPortalHomeUrl,
  getPriceAiPublicOrigin,
  resolveLogoutDestination,
} from '../portalHome'

const ORIGIN_KEY = 'VITE_PRICEAI_PUBLIC_ORIGIN'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getPriceAiPublicOrigin', () => {
  it('returns null when unset or blank', () => {
    vi.stubEnv(ORIGIN_KEY, '')
    expect(getPriceAiPublicOrigin()).toBeNull()

    vi.stubEnv(ORIGIN_KEY, '   ')
    expect(getPriceAiPublicOrigin()).toBeNull()
  })

  it('rejects non-http(s) and unparseable values', () => {
    for (const value of ['javascript:alert(1)', 'ftp://example.com', 'not a url', '//evil.com']) {
      vi.stubEnv(ORIGIN_KEY, value)
      expect(getPriceAiPublicOrigin()).toBeNull()
    }
  })

  it('normalizes to the origin', () => {
    vi.stubEnv(ORIGIN_KEY, 'https://www.example.com/portal/?a=1')
    expect(getPriceAiPublicOrigin()).toBe('https://www.example.com')
  })
})

describe('PRICEAI_PORTAL_MODULES', () => {
  // Frozen in spec §4.2; mirrors PriceAI src/components/SiteHeader.tsx NAV_ITEMS.
  it('matches the frozen key/path table', () => {
    expect(PRICEAI_PORTAL_MODULES.map((m) => [m.key, m.path])).toEqual([
      ['channels', '/channels'],
      ['official', '/official-prices'],
      ['api', '/official-api'],
      ['transit', '/api-transit'],
      ['detector', '/api-transit/detector'],
    ])
  })

  it('gives every module both a full and a short label key', () => {
    for (const module of PRICEAI_PORTAL_MODULES) {
      expect(module.labelKey).toMatch(/^nav\.portal/)
      expect(module.shortLabelKey).toMatch(/^nav\.portal.+Short$/)
    }
  })
})

describe('getPriceAiModuleHref', () => {
  it('returns null when the portal origin is not configured', () => {
    vi.stubEnv(ORIGIN_KEY, '')
    for (const module of PRICEAI_PORTAL_MODULES) {
      expect(getPriceAiModuleHref(module.path)).toBeNull()
    }
  })

  it('returns an absolute URL for a cross-origin portal', () => {
    vi.stubEnv(ORIGIN_KEY, 'http://127.0.0.1:3000')
    expect(getPriceAiModuleHref('/channels')).toBe('http://127.0.0.1:3000/channels')
    expect(getPriceAiModuleHref('/api-transit/detector')).toBe('http://127.0.0.1:3000/api-transit/detector')
  })

  it('returns a relative path when the portal is same-origin (reverse proxy)', () => {
    vi.stubEnv(ORIGIN_KEY, window.location.origin)
    expect(getPriceAiModuleHref('/channels')).toBe('/channels')
    expect(getPriceAiModuleHref('/api-transit/detector')).toBe('/api-transit/detector')
  })

  it('rejects paths that could escape the configured origin', () => {
    vi.stubEnv(ORIGIN_KEY, 'https://www.example.com')
    for (const path of [
      '//evil.com/channels',
      'channels',
      '',
      'https://evil.com',
      '/channels:8080',
      '\\evil.com',
      '/\\evil.com',
    ]) {
      expect(getPriceAiModuleHref(path)).toBeNull()
    }
  })
})

describe('logout destination', () => {
  it('goes to PriceAI federated logout when portal origin is configured', () => {
    vi.stubEnv(ORIGIN_KEY, 'https://www.example.com')
    expect(getPriceAiPortalHomeUrl()).toBe('https://www.example.com/')
    expect(resolveLogoutDestination()).toEqual({
      type: 'external',
      url: 'https://www.example.com/auth/tokenbazaar/logout',
    })
  })

  it('falls back to in-app login in standalone mode', () => {
    vi.stubEnv(ORIGIN_KEY, '')
    expect(getPriceAiPortalHomeUrl()).toBeNull()
    expect(resolveLogoutDestination()).toEqual({ type: 'route', path: '/login' })
  })
})
