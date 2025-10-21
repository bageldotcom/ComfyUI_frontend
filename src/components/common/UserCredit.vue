<template>
  <div v-if="balanceLoading" class="flex items-center gap-1">
    <div class="flex items-center gap-2">
      <Skeleton shape="circle" width="1.5rem" height="1.5rem" />
    </div>
    <div class="flex-1"></div>
    <Skeleton width="8rem" height="2rem" />
  </div>
  <div v-else class="flex items-center gap-1">
    <Tag
      severity="secondary"
      icon="pi pi-dollar"
      rounded
      class="p-1 text-amber-400"
    />
    <div :class="textClass">{{ formattedBalance }}</div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import { computed } from 'vue'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useUserStore } from '@/stores/userStore'
import { formatMetronomeCurrency } from '@/utils/formatUtil'

const { textClass } = defineProps<{
  textClass?: string
}>()

const authStore = useFirebaseAuthStore()
const userStore = useUserStore()
const balanceLoading = computed(() => authStore.isFetchingBalance)

const formattedBalance = computed(() => {
  // Check Bagel user balance first (in cents)
  if (userStore.bagelUser) {
    // Convert cents to micros: cents * 10,000 = micros
    return formatMetronomeCurrency(
      userStore.bagelUser.creditBalance * 10000,
      'usd'
    )
  }
  // Fallback to ComfyUI balance (in micros)
  if (!authStore.balance) return '0.00'
  return formatMetronomeCurrency(authStore.balance.amount_micros, 'usd')
})
</script>
