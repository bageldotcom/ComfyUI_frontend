import { defineStore } from 'pinia'
import { computed, ref, watchEffect } from 'vue'

import type { User as UserConfig } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

export interface User {
  userId: string
  username: string
}

export const useUserStore = defineStore('user', () => {
  /**
   * The user config. null if not loaded.
   */
  const userConfig = ref<UserConfig | null>(null)
  /**
   * The current user id. null if not logged in or in single user mode.
   */
  const currentUserId = ref<string | null>(null)

  // Bagel user integration
  const bagelUser = ref<{
    userId: string
    username: string
    email: string
    apiKey: string
    creditBalance: number
    photoUrl?: string
  } | null>(null)
  const isMultiUserServer = computed(
    () => userConfig.value && 'users' in userConfig.value
  )
  const needsLogin = computed(
    () => !currentUserId.value && isMultiUserServer.value
  )
  const users = computed<User[]>(() =>
    Object.entries(userConfig.value?.users ?? {}).map(([userId, username]) => ({
      userId,
      username
    }))
  )
  const currentUser = computed<User | null>(
    () =>
      users.value.find((user) => user.userId === currentUserId.value) ?? null
  )
  const initialized = computed(() => userConfig.value !== null)

  /**
   * Sync user from Bagel backend
   * Called on initialization to auto-login Bagel users
   */
  async function syncBagelUser(): Promise<boolean> {
    try {
      const response = await fetch('/bagel/current_user', {
        credentials: 'include',
        headers: {
          Accept: 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()

        // Store Bagel user data
        bagelUser.value = {
          userId: data.comfy_user_id,
          username: data.username,
          email: data.email,
          apiKey: data.api_key,
          creditBalance: data.creditBalance,
          photoUrl: data.photo_url
        }

        // Set ComfyUI user to match
        currentUserId.value = data.comfy_user_id

        // Persist to localStorage
        localStorage['Comfy.userId'] = data.comfy_user_id
        localStorage['Comfy.userName'] = data.username
        localStorage['Bagel.userEmail'] = data.email
        localStorage['Bagel.creditBalance'] = data.creditBalance.toString()

        return true
      } else {
        console.warn('[Bagel] No active Bagel session')
        return false
      }
    } catch (error) {
      console.error('[Bagel] Failed to sync user:', error)
      return false
    }
  }

  /**
   * Initialize the user store.
   */
  async function initialize() {
    // Try Bagel sync FIRST
    const bagelSynced = await syncBagelUser()

    if (!bagelSynced) {
      // Fallback to ComfyUI auth
      userConfig.value = await api.getUserConfig()
      currentUserId.value = localStorage['Comfy.userId']
    }
  }

  /**
   * Create a new user.
   *
   * @param username - The username.
   * @returns The new user.
   */
  async function createUser(username: string): Promise<User> {
    const resp = await api.createUser(username)
    const data = await resp.json()
    if (resp.status >= 300) {
      throw new Error(
        data.error ??
          'Error creating user: ' + resp.status + ' ' + resp.statusText
      )
    }
    return {
      userId: data,
      username
    }
  }

  /**
   * Login the current user.
   *
   * @param user - The user.
   */
  async function login({
    userId,
    username
  }: {
    userId: string
    username: string
  }) {
    currentUserId.value = userId
    localStorage['Comfy.userId'] = userId
    localStorage['Comfy.userName'] = username
  }

  watchEffect(() => {
    if (isMultiUserServer.value && currentUserId.value) {
      api.user = currentUserId.value
    }
  })

  /**
   * Logout the current user.
   */
  async function logout() {
    delete localStorage['Comfy.userId']
    delete localStorage['Comfy.userName']
  }

  return {
    users,
    currentUser,
    isMultiUserServer,
    needsLogin,
    initialized,
    initialize,
    createUser,
    login,
    logout,
    bagelUser,
    syncBagelUser
  }
})
