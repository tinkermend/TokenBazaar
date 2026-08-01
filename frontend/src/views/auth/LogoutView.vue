<template>
  <AuthLayout>
    <div class="space-y-4 text-center">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">正在退出…</h2>
      <p class="text-sm text-gray-500 dark:text-dark-400">正在清除本站登录状态</p>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AuthLayout } from '@/components/layout'
import { useAuthStore } from '@/stores/auth'
import { clearLocalAuthStorage } from '@/utils/priceai-bridge'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

function safeReturnUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

onMounted(async () => {
  try {
    await authStore.logout()
  } catch {
    // still clear local
  }
  await clearLocalAuthStorage()

  const from = typeof route.query.from === 'string' ? route.query.from : ''
  const returnUrl = safeReturnUrl(route.query.return_url)
  if (from === 'priceai' && returnUrl) {
    window.location.assign(returnUrl)
    return
  }
  await router.replace('/login')
})
</script>
