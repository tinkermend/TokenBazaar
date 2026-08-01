<template>
  <div class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fbfcfe] px-4 py-10 font-sans dark:bg-dark-950">
    <!-- Aurora Lumen stage -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        class="absolute inset-0"
        style="background:
          radial-gradient(920px 520px at 12% -8%, rgba(139, 92, 246, 0.18), transparent 62%),
          radial-gradient(780px 480px at 92% 8%, rgba(167, 139, 250, 0.12), transparent 58%),
          radial-gradient(640px 420px at 55% 110%, rgba(196, 181, 253, 0.10), transparent 55%);"
      ></div>
      <div
        class="absolute inset-0 opacity-40"
        style="
          background-image: radial-gradient(circle at 1px 1px, rgba(26, 24, 40, 0.07) 1px, transparent 0);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse 90% 70% at 50% 30%, #000 20%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 30%, #000 20%, transparent 75%);
        "
      ></div>
    </div>

    <!-- Top-right locale switcher -->
    <div class="absolute right-4 top-4 z-20 sm:right-6 sm:top-5">
      <div
        class="rounded-xl border border-[#e3e4ee]/80 bg-white/80 p-0.5 shadow-[0_8px_24px_rgba(26,24,40,0.06)] backdrop-blur-md dark:border-dark-700/80 dark:bg-dark-800/80"
      >
        <LocaleSwitcher />
      </div>
    </div>

    <div class="relative z-10 w-full max-w-md">
      <div class="mb-7 text-center">
        <template v-if="settingsLoaded">
          <div
            class="mb-4 inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_rgba(26,24,40,0.06)] ring-1 ring-[#e3e4ee] dark:bg-dark-800"
          >
            <img :src="siteLogo || '/logo.svg'" alt="Logo" class="h-full w-full object-contain" />
          </div>
          <p class="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#65607a] dark:text-dark-400">
            {{ t('auth.secureSessionBadge') }}
          </p>
          <h1 class="mb-1.5 text-2xl font-bold tracking-[-0.03em] text-[#14121f] dark:text-white">
            {{ siteName }}
          </h1>
          <p class="text-sm leading-6 text-[#65607a] dark:text-dark-400">
            {{ siteSubtitle }}
          </p>
        </template>
      </div>

      <div
        class="relative overflow-hidden rounded-2xl border border-[#e3e4ee] bg-white p-6 shadow-[0_18px_50px_rgba(26,24,40,0.06)] dark:border-dark-700 dark:bg-dark-800 sm:p-8"
      >
        <div class="absolute inset-y-0 left-0 w-[3px] bg-[#8b5cf6]" aria-hidden="true"></div>
        <slot />
      </div>

      <div class="mt-5 text-center text-sm text-[#65607a] dark:text-dark-400">
        <slot name="footer" />
      </div>

      <div class="mt-8 text-center text-xs text-[#7a7590] dark:text-dark-500">
        &copy; {{ currentYear }} {{ siteName }}. {{ t('auth.allRightsReserved') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'

const { t } = useI18n()
const appStore = useAppStore()

const siteName = computed(() => appStore.siteName || '词元集市')
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteSubtitle = computed(
  () => appStore.cachedPublicSettings?.site_subtitle || t('auth.signInToAccount')
)
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)
const currentYear = computed(() => new Date().getFullYear())

onMounted(() => {
  appStore.fetchPublicSettings()
})
</script>
