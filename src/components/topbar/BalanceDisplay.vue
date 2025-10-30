<!-- Balance display component matching Bagel frontend design -->
<template>
  <div
    v-if="!balanceLoading"
    class="laptop:px-3 laptop:py-2 flex cursor-default items-center gap-1 rounded-lg px-2 py-1.5 transition-all duration-200"
    :style="{
      backgroundColor: 'var(--p-content-background)',
      border: '1px solid var(--p-panel-border-color)'
    }"
  >
    <!-- Dollar icon using PrimeVue Tag component for consistency -->
    <Tag
      severity="secondary"
      icon="pi pi-dollar"
      rounded
      class="p-1"
      :style="{ color: 'rgb(251, 191, 36)' }"
    />
    <!-- Balance amount -->
    <span
      class="cursor-text text-sm font-semibold"
      :style="{ color: 'var(--p-text-color)' }"
    >
      {{ formattedBalance }}
    </span>
    <!-- Top up button -->
    <Button
      icon="pi pi-plus"
      text
      size="small"
      severity="secondary"
      class="laptop:ml-2 laptop:w-8 laptop:h-8 ml-1 flex h-7 w-7 items-center justify-center transition-all duration-200"
      :style="{
        backgroundColor: 'var(--p-primary-color)',
        color: 'white',
        borderRadius: '0.5rem'
      }"
      aria-label="Buy more bagels"
      @click="handleTopUp"
    />
  </div>
  <!-- Loading skeleton -->
  <div v-else class="flex items-center gap-1 px-3 py-2">
    <Skeleton shape="circle" width="1.5rem" height="1.5rem" />
    <Skeleton width="3rem" height="1rem" />
    <Skeleton shape="circle" width="2rem" height="2rem" class="ml-2" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import { computed } from 'vue'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useUserStore } from '@/stores/userStore'
import { formatMetronomeCurrency } from '@/utils/formatUtil'

const authStore = useFirebaseAuthStore()
const userStore = useUserStore()

const balanceLoading = computed(() => authStore.isFetchingBalance)

const formattedBalance = computed(() => {
  // Check Bagel user balance first (already in USD cents from backend)
  if (userStore.bagelUser) {
    // creditBalance is in USD cents, display as dollars
    const dollars = userStore.bagelUser.creditBalance / 100
    return dollars.toFixed(2)
  }
  // Fallback to ComfyUI balance (in micros)
  if (!authStore.balance) return '0.00'
  return formatMetronomeCurrency(authStore.balance.amount_micros, 'usd')
})

const isBagelUser = computed(() => userStore.bagelUser !== null)

const handleTopUp = async () => {
  if (isBagelUser.value) {
    // Fetch runtime config from backend to get correct frontend URL
    try {
      const response = await fetch('/bagel/config')
      const config = await response.json()
      const bagelUrl = config.frontend_url || 'https://app.bagel.com'
      window.location.href = `${bagelUrl}/buy-bagels`
    } catch (error) {
      // Fallback to default
      console.warn('[Bagel] Failed to fetch config, using default URL:', error)
      window.location.href = 'https://app.bagel.com/buy-bagels'
    }
  } else {
    // For ComfyUI users, redirect to ComfyUI top-up page
    // You can import and use dialogService if preferred
    window.open('https://docs.comfy.org/tutorials/api-nodes/pricing', '_blank')
  }
}
</script>

<style scoped>
/* Ensure styles adapt to theme (dark/light mode) */
.laptop\:px-3 {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.laptop\:py-2 {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.laptop\:w-8 {
  width: 2rem;
}

.laptop\:h-8 {
  height: 2rem;
}

.laptop\:ml-2 {
  margin-left: 0.5rem;
}

@media (min-width: 1024px) {
  .laptop\:px-3 {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .laptop\:py-2 {
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .laptop\:w-8 {
    width: 2rem;
  }

  .laptop\:h-8 {
    height: 2rem;
  }

  .laptop\:ml-2 {
    margin-left: 0.5rem;
  }
}
</style>
