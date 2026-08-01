<!--
  PriceAI portal module nav — flat header links (not a dropdown).
  Spec: docs/PRICEAI_PORTAL_NAV_SPEC.md §4–§5
-->
<template>
  <nav
    v-if="visible"
    class="portal-nav flex min-w-0 items-center gap-0.5 overflow-x-auto md:gap-1"
    :aria-label="t('nav.portal')"
  >
    <a
      v-for="item in items"
      :key="item.key"
      :href="item.href"
      class="portal-nav-link shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-semibold text-[#65607a] transition hover:bg-[#eef0f7] hover:text-[#14121f] dark:text-dark-400 dark:hover:bg-dark-800 dark:hover:text-white md:px-3"
    >
      <span class="hidden xl:inline">{{ t(item.labelKey) }}</span>
      <span class="xl:hidden">{{ t(item.shortLabelKey) }}</span>
    </a>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PRICEAI_PORTAL_MODULES, getPriceAiModuleHref } from '@/utils/portalHome'

const { t } = useI18n()

/** Modules with a resolvable href; empty when the portal origin is unset (spec §4.3). */
const items = computed(() =>
  PRICEAI_PORTAL_MODULES.map((module) => ({ ...module, href: getPriceAiModuleHref(module.path) })).filter(
    (item): item is (typeof PRICEAI_PORTAL_MODULES)[number] & { href: string } => item.href !== null
  )
)

// Show whenever portal origin is configured (C-end and admin header both use AppHeader).
const visible = computed(() => items.value.length > 0)
</script>

<style scoped>
.portal-nav {
  scrollbar-width: none;
}
.portal-nav::-webkit-scrollbar {
  display: none;
}
</style>
