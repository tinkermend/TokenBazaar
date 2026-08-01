import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { resolveConsoleDestination } from '../consoleRedirect'

const routerSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../index.ts'), 'utf8')

describe('resolveConsoleDestination', () => {
  it('sends admins to the admin dashboard', () => {
    expect(resolveConsoleDestination(true)).toBe('/admin/dashboard')
  })

  it('sends regular users to the user dashboard', () => {
    expect(resolveConsoleDestination(false)).toBe('/dashboard')
  })
})

describe('/console route', () => {
  it('is declared and wired to the resolver', () => {
    expect(routerSource).toContain("path: '/console'")
    expect(routerSource).toContain('beforeEnter: () => resolveConsoleDestination(useAuthStore().isAdmin)')
  })

  it('requires auth, so anonymous visitors log in before the role split', () => {
    // Without this an anonymous visitor would be split as a non-admin and an admin
    // would land on the user dashboard after logging in.
    const consoleBlock = routerSource.slice(routerSource.indexOf("path: '/console'"))
    const metaBlock = consoleBlock.slice(0, consoleBlock.indexOf('beforeEnter'))
    expect(metaBlock).toContain('requiresAuth: true')
  })
})
