<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-row items-center gap-2">
      <i v-if="status === 'completed'" class="pi pi-check text-green-500" />
      <i v-if="status === 'failed'" class="pi pi-times text-red-500" />

      <div class="flex-1">
        <div>
          <span :title="hint">{{ label }}</span>
        </div>
        <Message
          v-if="props.error || errorMessage"
          severity="error"
          icon="pi pi-exclamation-triangle"
          size="small"
          variant="outlined"
          class="my-2 h-min max-w-xs px-1"
        >
          {{ props.error || errorMessage }}
        </Message>
      </div>

      <div>
        <Button
          v-if="!status || status === 'failed'"
          :label="t('g.download') + (fileSize ? ` (${fileSize})` : '')"
          size="small"
          outlined
          icon="pi pi-download"
          :disabled="!!props.error || isDownloading"
          @click="startDownload"
        />

        <Button
          v-if="status === 'downloading'"
          label="Cancel"
          size="small"
          outlined
          icon="pi pi-times"
          severity="danger"
          @click="cancelDownload"
        />

        <Button
          v-if="status === 'completed'"
          label="Downloaded"
          size="small"
          outlined
          icon="pi pi-check"
          disabled
        />
      </div>

      <div>
        <Button
          :label="t('g.copyURL')"
          size="small"
          outlined
          :disabled="!!props.error"
          @click="copyURL"
        />
      </div>
    </div>

    <!-- Progress bar -->
    <ProgressBar
      v-if="status === 'downloading'"
      :value="progressPercent"
      class="mt-2"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useDownload } from '@/composables/useDownload'
import { formatSize } from '@/utils/formatUtil'

const props = defineProps<{
  url: string
  label: string
  modelType: string
  filename: string
  hint?: string
  error?: string
}>()

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()

// Get file size from HEAD request (for display only)
const download = useDownload(props.url)
const fileSize = computed(() =>
  download.fileSize.value ? formatSize(download.fileSize.value) : ''
)

const hint = computed(() => props.hint || props.url)

// Download state
const status = ref<string | null>(null)
const progressPercent = ref(0)
const downloadId = ref<string | null>(null)
const errorMessage = ref('')
const isDownloading = computed(() => status.value === 'downloading')

// Polling interval
let pollInterval: number | null = null

const copyURL = async () => {
  await copyToClipboard(props.url)
}

const startDownload = async () => {
  try {
    status.value = 'downloading'
    errorMessage.value = ''

    // Call backend API
    const response = await fetch('/bagel/models/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: props.url,
        model_type: props.modelType,
        filename: props.filename
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Download failed')
    }

    // Check if already exists
    if (data.status === 'already_exists') {
      status.value = 'completed'
      progressPercent.value = 100
      return
    }

    downloadId.value = data.download_id

    // Start polling for progress
    pollInterval = window.setInterval(checkProgress, 2000) // Poll every 2s
  } catch (error: any) {
    status.value = 'failed'
    errorMessage.value = error.message || 'Download failed'
    console.error('Download error:', error)
  }
}

const cancelDownload = async () => {
  if (!downloadId.value) return

  try {
    await fetch(`/bagel/models/download/${downloadId.value}/cancel`, {
      method: 'POST'
    })

    status.value = null
    progressPercent.value = 0

    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  } catch (error) {
    console.error('Cancel error:', error)
  }
}

const checkProgress = async () => {
  if (!downloadId.value) return

  try {
    const response = await fetch(
      `/bagel/models/download/${downloadId.value}/status`
    )
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to check progress')
    }

    status.value = data.status
    progressPercent.value = data.progress_percent || 0

    if (data.status === 'completed') {
      // Stop polling
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    } else if (data.status === 'failed') {
      errorMessage.value = data.error_message || 'Download failed'
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }
  } catch (error: any) {
    console.error('Progress check error:', error)
    status.value = 'failed'
    errorMessage.value = error.message

    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script>
