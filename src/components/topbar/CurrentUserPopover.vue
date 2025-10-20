<!-- A popover that shows current user information and actions -->
<template>
  <div class="current-user-popover w-72">
    <!-- User Info Section -->
    <div class="p-3">
      <div class="flex flex-col items-center">
        <UserAvatar
          class="mb-3"
          :photo-url="userPhotoUrl"
          :pt:icon:class="{
            'text-2xl!': !userPhotoUrl
          }"
          size="large"
        />

        <!-- User Details -->
        <h3 class="my-0 mb-1 truncate text-lg font-semibold">
          {{ userDisplayName || $t('g.user') }}
        </h3>
        <p v-if="userEmail" class="my-0 truncate text-sm text-muted">
          {{ userEmail }}
        </p>
      </div>
    </div>

    <Divider class="my-2" />

    <!-- Hide User Settings for Bagel users -->
    <template v-if="!isBagelUser">
      <Button
        class="justify-start"
        :label="$t('userSettings.title')"
        icon="pi pi-cog"
        text
        fluid
        severity="secondary"
        @click="handleOpenUserSettings"
      />
      <Divider class="my-2" />
    </template>

    <!-- Hide Sign Out for Bagel users -->
    <template v-if="!isBagelUser">
      <Button
        class="justify-start"
        :label="$t('auth.signOut.signOut')"
        icon="pi pi-sign-out"
        text
        fluid
        severity="secondary"
        @click="handleLogout"
      />
      <Divider class="my-2" />
    </template>

    <!-- Hide API Pricing for Bagel users -->
    <template v-if="!isBagelUser">
      <Button
        class="justify-start"
        :label="$t('credits.apiPricing')"
        icon="pi pi-external-link"
        text
        fluid
        severity="secondary"
        @click="handleOpenApiPricing"
      />
      <Divider class="my-2" />
    </template>

    <div class="flex w-full flex-col gap-2 p-2">
      <div class="text-sm text-muted">
        {{ $t('credits.yourCreditBalance') }}
      </div>
      <div class="flex items-center justify-between">
        <UserCredit text-class="text-2xl" />
        <Button :label="$t('credits.topUp.topUp')" @click="handleTopUp" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { computed, onMounted } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
import UserCredit from '@/components/common/UserCredit.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useDialogService } from '@/services/dialogService'
import { useUserStore } from '@/stores/userStore'

const emit = defineEmits<{
  close: []
}>()

const userStore = useUserStore()
const { userDisplayName, userEmail, userPhotoUrl, handleSignOut } =
  useCurrentUser()
const authActions = useFirebaseAuthActions()
const dialogService = useDialogService()

// Check if user is from Bagel (has bagelUser data)
const isBagelUser = computed(() => userStore.bagelUser !== null)

const handleOpenUserSettings = () => {
  dialogService.showSettingsDialog('user')
  emit('close')
}

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
      window.location.href = 'https://app.bagel.com/buy-bagels'
    }
  } else {
    dialogService.showTopUpCreditsDialog()
  }
  emit('close')
}

const handleLogout = async () => {
  if (isBagelUser.value) {
    // Redirect to Bagel logout
    const bagelUrl =
      import.meta.env.VITE_BAGEL_FRONTEND_URL || 'https://app.bagel.com'
    window.location.href = `${bagelUrl}/logout?redirect=comfyui`
  } else {
    await handleSignOut()
  }
  emit('close')
}

const handleOpenApiPricing = () => {
  window.open('https://docs.comfy.org/tutorials/api-nodes/pricing', '_blank')
  emit('close')
}

onMounted(() => {
  void authActions.fetchBalance()
})
</script>
