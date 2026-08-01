/**
 * Ties TokenBazaar's portal constants and i18n copy to contracts/hub-contract.json.
 *
 * The module table used to exist twice — here and in PriceAI's SiteHeader — with
 * nothing keeping them equal. This is the TokenBazaar half of the guard; PriceAI
 * has its own (scripts/verify-hub-contract.mjs). See contracts/README.md.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PRICEAI_PORTAL_MODULES } from '../portalHome'
import zhCommon from '@/i18n/locales/zh/common'
import enCommon from '@/i18n/locales/en/common'

const here = dirname(fileURLToPath(import.meta.url))
const contract = JSON.parse(
  readFileSync(resolve(here, '../../../../contracts/hub-contract.json'), 'utf8')
)

type ContractModule = {
  key: string
  path: string
  label: { zh: string; zhShort: string; en: string; enShort: string }
  activePrefixes: string[]
  excludePrefixes: string[]
}

const modules: ContractModule[] = contract.portalModules
const nav = (messages: Record<string, unknown>) => (messages as { nav: Record<string, string> }).nav

describe('hub contract', () => {
  it('is the version this code was written against', () => {
    // Bumping the version is a deliberate breaking change: read contracts/README.md first.
    expect(contract.version).toBe(1)
  })

  it('declares every module with the fields both apps consume', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const module of modules) {
      expect(module.key).toMatch(/^[a-z]+$/)
      expect(module.path.startsWith('/')).toBe(true)
      expect(module.path.startsWith('//')).toBe(false)
      for (const field of ['zh', 'zhShort', 'en', 'enShort'] as const) {
        expect(module.label[field], `${module.key}.${field}`).toBeTruthy()
      }
      // Highlighting is declarative so PriceAI can express it without a JS closure.
      expect(module.activePrefixes.length).toBeGreaterThan(0)
      expect(module.activePrefixes).toContain(module.path)
    }
  })
})

describe('PRICEAI_PORTAL_MODULES follows the contract', () => {
  it('has the same keys in the same order', () => {
    expect(PRICEAI_PORTAL_MODULES.map((m) => m.key)).toEqual(modules.map((m) => m.key))
  })

  it('has the same paths', () => {
    expect(PRICEAI_PORTAL_MODULES.map((m) => m.path)).toEqual(modules.map((m) => m.path))
  })
})

describe('i18n copy follows the contract', () => {
  it.each([
    ['zh', zhCommon, 'zh', 'zhShort'] as const,
    ['en', enCommon, 'en', 'enShort'] as const,
  ])('%s labels match', (_locale, messages, longField, shortField) => {
    for (const [index, module] of modules.entries()) {
      const tbModule = PRICEAI_PORTAL_MODULES[index]
      const keys = nav(messages as unknown as Record<string, unknown>)
      const longKey = tbModule.labelKey.replace(/^nav\./, '')
      const shortKey = tbModule.shortLabelKey.replace(/^nav\./, '')

      expect(keys[longKey], `${tbModule.labelKey}`).toBe(module.label[longField])
      expect(keys[shortKey], `${tbModule.shortLabelKey}`).toBe(module.label[shortField])
    }
  })
})

describe('shared paths follow the contract', () => {
  it('keeps the console entry point in sync with the router', () => {
    const routerSource = readFileSync(resolve(here, '../../router/index.ts'), 'utf8')
    expect(routerSource).toContain(`path: '${contract.paths.tokenbazaarConsole}'`)
  })

  it('keeps the reverse-proxy map in sync with the contract paths', () => {
    const routeMap = JSON.parse(
      readFileSync(resolve(here, '../../../../deploy/same-origin/route-map.json'), 'utf8')
    )
    const tbPrefixes: string[] = routeMap.tokenbazaar.prefixes
    const paPrefixes: string[] = routeMap.priceai.prefixes

    expect(tbPrefixes).toContain(contract.paths.tokenbazaarConsole)
    expect(tbPrefixes).toContain(contract.paths.tokenbazaarApi)
    expect(paPrefixes).toContain(contract.paths.priceaiBridge)
    expect(paPrefixes).toContain(contract.paths.priceaiAdmin)

    // Every portal module must land on PriceAI, i.e. never be claimed by TokenBazaar.
    const tbSegments = new Set(tbPrefixes.map((p) => `/${p.split('/')[1]}`))
    for (const module of modules) {
      expect(tbSegments.has(`/${module.path.split('/')[1]}`), module.path).toBe(false)
    }
  })
})
