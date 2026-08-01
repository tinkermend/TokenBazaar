<template>
  <div class="min-h-screen bg-[#fbfcfe] font-sans dark:bg-dark-950">
    <!-- Aurora wash (subtle for app chrome) -->
    <div class="pointer-events-none fixed inset-0" aria-hidden="true">
      <div class="absolute inset-0 bg-mesh-gradient"></div>
      <div
        class="absolute inset-0 opacity-[0.35]"
        style="
          background-image: radial-gradient(circle at 1px 1px, rgba(26, 24, 40, 0.06) 1px, transparent 0);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse 85% 60% at 50% 0%, #000 10%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 85% 60% at 50% 0%, #000 10%, transparent 70%);
        "
      ></div>
    </div>

    <AppSidebar />

    <div
      class="relative min-h-screen transition-all duration-300"
      :class="[sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64']"
    >
      <AppHeader />

      <main class="p-4 md:p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const appStore = useAppStore()
const authStore = useAuthStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const isAdmin = computed(() => authStore.user?.role === 'admin')

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)
})

defineExpose({ replayTour })
</script>
