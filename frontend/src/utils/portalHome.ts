/**
 * PriceAI portal links: post-logout return plus the portal module menu.
 * Sibling project: /Users/tinker/src/fuye/PriceAI
 * Spec: docs/PRICEAI_PORTAL_NAV_SPEC.md
 *
 * Set VITE_PRICEAI_PUBLIC_ORIGIN=http://localhost:3000 (dev) or production portal origin.
 * When unset, logout falls back to in-app /login and the portal menu is not rendered
 * (standalone console mode).
 */

function readOrigin(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

export function getPriceAiPublicOrigin(): string | null {
  return readOrigin(import.meta.env.VITE_PRICEAI_PUBLIC_ORIGIN as string | undefined)
}

/** Absolute URL of the PriceAI homepage, or null when portal origin is not configured. */
export function getPriceAiPortalHomeUrl(): string | null {
  const origin = getPriceAiPublicOrigin()
  if (!origin) return null
  const path = (import.meta.env.VITE_PRICEAI_PUBLIC_HOME_PATH as string | undefined)?.trim() || '/'
  const normalized = path.startsWith('/') && !path.startsWith('//') ? path : '/'
  return new URL(normalized, `${origin}/`).toString()
}

export interface PriceAiPortalModule {
  /** Matches the key used by PriceAI's SiteHeader NAV_ITEMS. */
  key: string
  /** Path on the portal origin. Frozen in spec §4.2 — change PriceAI routes, change this. */
  path: string
  labelKey: string
  /** Shortened label for narrow screens, mirroring PriceAI's mobileLabel. */
  shortLabelKey: string
}

/** Portal modules shown in the "explore" menu. Single source of truth (spec §4.2). */
export const PRICEAI_PORTAL_MODULES: readonly PriceAiPortalModule[] = [
  { key: 'channels', path: '/channels', labelKey: 'nav.portalChannels', shortLabelKey: 'nav.portalChannelsShort' },
  { key: 'official', path: '/official-prices', labelKey: 'nav.portalOfficial', shortLabelKey: 'nav.portalOfficialShort' },
  { key: 'api', path: '/official-api', labelKey: 'nav.portalApi', shortLabelKey: 'nav.portalApiShort' },
  { key: 'transit', path: '/api-transit', labelKey: 'nav.portalTransit', shortLabelKey: 'nav.portalTransitShort' },
  { key: 'detector', path: '/api-transit/detector', labelKey: 'nav.portalDetector', shortLabelKey: 'nav.portalDetectorShort' },
] as const

/**
 * Portal mount prefix. Spec §4.4 pins PriceAI to the origin root, so this is always ''.
 * The seam exists so a future sub-path mount only changes here.
 */
function getPriceAiBasePath(): string {
  return ''
}

/** Reject anything that could escape the configured portal origin. */
function isSafeModulePath(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('\\')) return false
  if (path.includes(':')) return false
  return true
}

/**
 * Href for a portal module, or null when the portal origin is unset/invalid
 * (caller must then render nothing).
 *
 * Same-origin production (reverse proxy) yields a relative path so the link
 * carries no "leaving this site" hint; cross-origin yields an absolute URL.
 */
export function getPriceAiModuleHref(path: string): string | null {
  const origin = getPriceAiPublicOrigin()
  if (!origin) return null
  if (!isSafeModulePath(path)) return null

  const target = `${getPriceAiBasePath()}${path}`
  if (typeof window !== 'undefined' && origin === window.location.origin) {
    return target
  }
  return new URL(target, `${origin}/`).toString()
}

/**
 * Where C-end logout should send the browser.
 *
 * Hub mode: PriceAI federated logout (`/auth/tokenbazaar/logout`), which clears
 * `priceai_cend_session` and then returns via TB `/logout` to the portal home.
 * Jumping straight to the portal homepage leaves the PA cookie intact (shared-device leak).
 *
 * Standalone (portal origin unset): TokenBazaar `/login`.
 */
export function resolveLogoutDestination(): { type: 'external'; url: string } | { type: 'route'; path: string } {
  const origin = getPriceAiPublicOrigin()
  if (origin) {
    return { type: 'external', url: new URL('/auth/tokenbazaar/logout', `${origin}/`).toString() }
  }
  return { type: 'route', path: '/login' }
}
