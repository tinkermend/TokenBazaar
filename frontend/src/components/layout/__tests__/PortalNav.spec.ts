import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import PortalNav from '../PortalNav.vue'
import { PRICEAI_PORTAL_MODULES } from '@/utils/portalHome'

const ORIGIN_KEY = 'VITE_PRICEAI_PUBLIC_ORIGIN'

const currentRoute = ref({ path: '/dashboard', fullPath: '/dashboard' })

vi.mock('vue-router', () => ({
  useRoute: () => currentRoute.value,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

function mountNav(path: string) {
  currentRoute.value = { path, fullPath: path }
  return mount(PortalNav, { global: { stubs: { Icon: true } } })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('PortalNav visibility', () => {
  it('renders flat module links when the origin is configured', () => {
    vi.stubEnv(ORIGIN_KEY, 'http://127.0.0.1:3000')
    const wrapper = mountNav('/dashboard')
    expect(wrapper.find('nav').exists()).toBe(true)
    expect(wrapper.findAll('a')).toHaveLength(PRICEAI_PORTAL_MODULES.length)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders nothing when the portal origin is not configured', () => {
    vi.stubEnv(ORIGIN_KEY, '')
    expect(mountNav('/dashboard').find('nav').exists()).toBe(false)
  })

  it('also renders flat links on admin routes', () => {
    vi.stubEnv(ORIGIN_KEY, 'http://127.0.0.1:3000')
    for (const path of ['/admin', '/admin/dashboard', '/admin/channels/pricing']) {
      const wrapper = mountNav(path)
      expect(wrapper.find('nav').exists()).toBe(true)
      expect(wrapper.findAll('a')).toHaveLength(PRICEAI_PORTAL_MODULES.length)
      expect(wrapper.find('button').exists()).toBe(false)
    }
  })
})

describe('PortalNav links', () => {
  it('lists every frozen module as a same-tab flat link', () => {
    vi.stubEnv(ORIGIN_KEY, 'http://127.0.0.1:3000')
    const wrapper = mountNav('/dashboard')
    const links = wrapper.findAll('a')
    expect(links.map((link) => link.attributes('href'))).toEqual([
      'http://127.0.0.1:3000/channels',
      'http://127.0.0.1:3000/official-prices',
      'http://127.0.0.1:3000/official-api',
      'http://127.0.0.1:3000/api-transit',
      'http://127.0.0.1:3000/api-transit/detector',
    ])
    expect(links.every((link) => link.attributes('target') === undefined)).toBe(true)
  })

  it('uses relative paths when the portal is same-origin', () => {
    vi.stubEnv(ORIGIN_KEY, window.location.origin)
    const wrapper = mountNav('/dashboard')
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual([
      '/channels',
      '/official-prices',
      '/official-api',
      '/api-transit',
      '/api-transit/detector',
    ])
  })
})
