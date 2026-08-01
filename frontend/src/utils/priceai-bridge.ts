import { apiClient } from '@/api/client'

const CALLBACK_PATH = '/auth/tokenbazaar/callback'

function cleanOrigin(raw: string | null | undefined): string | null {
  const text = (raw || '').trim()
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

/** Read PriceAI bridge params from current route query. */
export function readPriceAIBridgeQuery(query: Record<string, unknown>): {
  returnUrl: string | null
  state: string | null
} {
  const returnRaw =
    typeof query.return_url === 'string'
      ? query.return_url
      : typeof query.returnUrl === 'string'
        ? query.returnUrl
        : ''
  const state = typeof query.state === 'string' ? query.state.trim() : ''
  let returnUrl: string | null = null
  try {
    if (returnRaw) {
      const u = new URL(returnRaw)
      if ((u.protocol === 'http:' || u.protocol === 'https:') && u.pathname.replace(/\/$/, '') === CALLBACK_PATH) {
        returnUrl = `${u.origin}${CALLBACK_PATH}`
      }
    }
  } catch {
    returnUrl = null
  }
  return { returnUrl, state: state || null }
}

function extractBridgeIssuePayload(response: unknown): {
  code: string
  returnUrl: string
} {
  // apiClient unwraps { code:0, data } → data. Be defensive if a caller
  // receives the outer envelope or a nested shape after interceptor changes.
  const root = (response as { data?: unknown } | null)?.data ?? response
  const layer1 = (root && typeof root === 'object' ? root : {}) as Record<string, unknown>
  const layer2 =
    layer1.data && typeof layer1.data === 'object'
      ? (layer1.data as Record<string, unknown>)
      : layer1

  const codeCandidate = layer2.code ?? layer1.code
  const returnCandidate = layer2.return_url ?? layer1.return_url

  return {
    code: typeof codeCandidate === 'string' ? codeCandidate : '',
    returnUrl: typeof returnCandidate === 'string' ? returnCandidate : '',
  }
}

/**
 * After TB login succeeds: issue one-time code and hard-redirect to PriceAI callback.
 * Returns true if a bridge redirect was started.
 */
export async function completePriceAIBridgeRedirect(options: {
  returnUrl: string | null
  state: string | null
}): Promise<boolean> {
  if (!options.returnUrl) return false
  try {
    const response = await apiClient.post('/auth/priceai/bridge/issue', {
      return_url: options.returnUrl,
      state: options.state || undefined,
    })
    const { code, returnUrl: issuedReturn } = extractBridgeIssuePayload(response)
    const base = issuedReturn || options.returnUrl
    if (!code || !base) {
      console.error('PriceAI bridge issue: missing code in response', response)
      return false
    }
    const target = new URL(base)
    // Host of return_url must stay identical to the host that set state cookies
    // on /auth/tokenbazaar/start (localhost vs 127.0.0.1 are different cookies).
    target.searchParams.set('code', code)
    if (options.state) target.searchParams.set('state', options.state)
    window.location.assign(target.toString())
    return true
  } catch (error) {
    console.error('PriceAI bridge issue failed', error)
    return false
  }
}

export async function clearLocalAuthStorage(): Promise<void> {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expires_at')
    localStorage.removeItem('pending_auth_session')
  } catch {
    // ignore
  }
}

export { cleanOrigin, CALLBACK_PATH }
