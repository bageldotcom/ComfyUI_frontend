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

    <!-- Back to Bagel App button for Bagel users -->
    <template v-if="isBagelUser">
      <Button
        class="justify-start"
        label="Back to Bagel App"
        icon="pi pi-arrow-left"
        text
        fluid
        severity="secondary"
        @click="handleBackToBagel"
      />
      <Divider class="my-2" />
    </template>

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
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { computed, onMounted } from 'vue'

import UserAvatar from '@/components/common/UserAvatar.vue'
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

const handleBackToBagel = () => {
  const bagelUrl =
    import.meta.env.VITE_BAGEL_FRONTEND_URL || 'https://app.bagel.com'
  window.location.href = `${bagelUrl}/dashboard`
  emit('close')
}

onMounted(() => {
  // Only fetch balance for non-Bagel users (Firebase/API Key users)
  // Bagel users already have balance synced from backend
  if (!isBagelUser.value) {
    void authActions.fetchBalance()
  }
})
</script>
