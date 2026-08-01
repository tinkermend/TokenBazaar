/**
 * Guards the same-origin reverse-proxy contract (docs/PRICEAI_PORTAL_NAV_SPEC.md §8.1).
 *
 * Under the contract, anything the proxy does not explicitly route to TokenBazaar
 * goes to PriceAI. So a new top-level TokenBazaar route that nobody registers in
 * deploy/same-origin/route-map.json silently 404s on the portal after go-live.
 * Upstream sub2api syncs are the usual source of such drift — this test catches it
 * in CI instead of in production.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const routerSource = readFileSync(resolve(here, '../index.ts'), 'utf8')
const routeMap = JSON.parse(readFileSync(resolve(here, '../../../../deploy/same-origin/route-map.json'), 'utf8'))

/** Paths the portal owns by design, so they need no TokenBazaar registration. */
const PORTAL_OWNED = new Set(['/'])
/** Vue Router catch-all: unreachable same-origin (PriceAI serves unknown paths). */
const CATCH_ALL = /^\/:pathMatch/

function firstSegment(path: string): string {
  return `/${path.split('/')[1] ?? ''}`
}

/** Top-level route paths declared in router/index.ts (4-space indent = top level). */
function declaredRoutePaths(): string[] {
  const matches = routerSource.matchAll(/^ {4}path: '([^']+)'/gm)
  return [...matches].map((match) => match[1])
}

const registeredSegments = new Set([
  ...routeMap.tokenbazaar.prefixes.map(firstSegment),
  ...routeMap.tokenbazaar.exact.map(firstSegment),
])

describe('same-origin route map', () => {
  it('finds the top-level routes it is meant to guard', () => {
    const paths = declaredRoutePaths()
    expect(paths.length).toBeGreaterThan(20)
    expect(paths).toContain('/dashboard')
    expect(paths).toContain('/keys')
  })

  it('registers every top-level TokenBazaar route with the reverse proxy', () => {
    const unregistered = declaredRoutePaths()
      .filter((path) => !CATCH_ALL.test(path))
      .filter((path) => !PORTAL_OWNED.has(path))
      .map(firstSegment)
      .filter((segment) => !registeredSegments.has(segment))

    // Fix by adding the prefix to deploy/same-origin/route-map.json AND spec §8.1.
    expect([...new Set(unregistered)]).toEqual([])
  })

  it('keeps every /auth/* callback on TokenBazaar', () => {
    // Constraint A: routing all of /auth/* to PriceAI breaks OAuth/OIDC/WeChat/DingTalk login.
    const authRoutes = declaredRoutePaths().filter((path) => path.startsWith('/auth/'))
    expect(authRoutes.length).toBeGreaterThan(0)
    for (const path of authRoutes) {
      expect(routeMap.tokenbazaar.exact).toContain(path)
    }
    expect(routeMap.priceai.prefixes).toContain('/auth/tokenbazaar')
  })

  it('does not claim a prefix for both apps without a recorded resolution', () => {
    const tbSegments = new Set(routeMap.tokenbazaar.prefixes.map(firstSegment))
    const contested = routeMap.priceai.prefixes
      .map(firstSegment)
      .filter((segment: string) => tbSegments.has(segment))
      .filter((segment: string) => !(segment in routeMap.resolvedConflicts))

    expect(contested).toEqual([])
  })

  it('keeps /api/v1 on TokenBazaar and bare /api on PriceAI', () => {
    // Constraint B, enforced by longest-prefix matching in the proxy.
    expect(routeMap.tokenbazaar.prefixes).toContain('/api/v1')
    expect(routeMap.priceai.prefixes).toContain('/api')
  })
})
