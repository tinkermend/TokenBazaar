#!/usr/bin/env node
/**
 * Compare / push the hub contract against the PriceAI sibling checkout.
 *
 *   node contracts/sync.mjs check    exit 1 when the copies differ
 *   node contracts/sync.mjs push     overwrite PriceAI's copy from this repo
 *
 * PriceAI location: $PRICEAI_REPO, else ../PriceAI relative to this repo.
 * See contracts/README.md — PriceAI's own CI cannot see this repo, so this
 * cross-repo comparison only runs where both checkouts exist.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SOURCE = resolve(here, 'hub-contract.json')
const priceaiRepo = process.env.PRICEAI_REPO || resolve(here, '../../PriceAI')
const TARGET = resolve(priceaiRepo, 'src/lib/hub-contract.json')

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

const mode = process.argv[2] || 'check'
if (!['check', 'push'].includes(mode)) {
  console.error(`usage: node contracts/sync.mjs [check|push]`)
  process.exit(2)
}

if (!existsSync(TARGET)) {
  console.error(`PriceAI copy not found: ${TARGET}`)
  console.error(`Set PRICEAI_REPO if the sibling checkout lives elsewhere.`)
  process.exit(mode === 'check' ? 1 : 2)
}

if (mode === 'push') {
  copyFileSync(SOURCE, TARGET)
  console.log(`pushed → ${TARGET}\n  sha256 ${sha(SOURCE)}`)
  console.log('Remember: commit BOTH repos together.')
  process.exit(0)
}

const a = sha(SOURCE)
const b = sha(TARGET)
if (a === b) {
  console.log(`hub-contract in sync  (sha256 ${a.slice(0, 16)}…)`)
  process.exit(0)
}

console.error('hub-contract OUT OF SYNC')
console.error(`  TokenBazaar ${a}`)
console.error(`  PriceAI     ${b}`)
console.error('\nRun `node contracts/sync.mjs push` after confirming this repo holds the intended version.')
process.exit(1)
