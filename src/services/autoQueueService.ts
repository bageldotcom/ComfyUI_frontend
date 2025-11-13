import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'

export function setupAutoQueueHandler() {
  const queueCountStore = useQueuePendingTaskCountStore()
  const queueSettingsStore = useQueueSettingsStore()

  let graphHasChanged = false
  let internalCount = 0 // Use an internal counter here so it is instantly updated when re-queuing
  api.addEventListener('graphChanged', () => {
    console.log(`[DEBUG_QUEUE_BUG] graphChanged event: mode=${queueSettingsStore.mode}, internalCount=${internalCount}`)
    if (queueSettingsStore.mode === 'change') {
      if (internalCount) {
        graphHasChanged = true
        console.log(`[DEBUG_QUEUE_BUG] graphChanged: set graphHasChanged=true`)
      } else {
        graphHasChanged = false
        console.log(`[DEBUG_QUEUE_BUG] graphChanged: triggering queuePrompt()`)
        // Queue the prompt in the background
        void app.queuePrompt(0, queueSettingsStore.batchCount)
        internalCount++
        console.log(`[DEBUG_QUEUE_BUG] graphChanged: incremented internalCount to ${internalCount}`)
      }
    }
  })

  queueCountStore.$subscribe(
    async () => {
      internalCount = queueCountStore.count
      console.log(`[DEBUG_QUEUE_BUG] autoQueue callback: count=${internalCount}, mode=${queueSettingsStore.mode}, graphHasChanged=${graphHasChanged}, lastError=${app.lastExecutionError}`)

      if (!internalCount && !app.lastExecutionError) {
        if (
          queueSettingsStore.mode === 'instant' ||
          (queueSettingsStore.mode === 'change' && graphHasChanged)
        ) {
          console.log(`[DEBUG_QUEUE_BUG] autoQueue triggering queuePrompt()`)
          graphHasChanged = false
          await app.queuePrompt(0, queueSettingsStore.batchCount)
        }
      }
    },
    { detached: true }
  )
}
