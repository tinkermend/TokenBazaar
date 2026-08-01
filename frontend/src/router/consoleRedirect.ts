/**
 * Where /console lands.
 *
 * The PriceAI portal links its "控制台" entry at a fixed path, but TokenBazaar's
 * post-login page depends on the role. /console is the stable contract; this
 * resolves it. See docs/PRICEAI_PORTAL_NAV_SPEC.md.
 */
export function resolveConsoleDestination(isAdmin: boolean): string {
  return isAdmin ? '/admin/dashboard' : '/dashboard'
}
