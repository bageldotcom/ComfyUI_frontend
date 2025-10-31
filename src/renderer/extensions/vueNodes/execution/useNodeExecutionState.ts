import { storeToRefs } from 'pinia'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'

/**
 * Composable for managing execution state of Vue-based nodes
 *
 * Provides reactive access to execution state and progress for a specific node
 * by injecting execution data from the parent GraphCanvas provider.
 *
 * @param nodeLocatorIdMaybe - Locator ID (root or subgraph scoped) of the node to track
 * @param promptIdMaybe - Optional prompt ID for multi-workflow isolation
 * @returns Object containing reactive execution state and progress
 */
export const useNodeExecutionState = (
  nodeLocatorIdMaybe: MaybeRefOrGetter<string | undefined>,
  promptIdMaybe?: MaybeRefOrGetter<string | undefined>
) => {
  const locatorId = computed(() => toValue(nodeLocatorIdMaybe) ?? '')
  const promptId = computed(() => toValue(promptIdMaybe))
  const executionStore = useExecutionStore()
  const { nodeLocationProgressStates, isIdle } = storeToRefs(executionStore)

  const progressState = computed(() => {
    const id = locatorId.value
    if (!id) return undefined

    // If promptId provided, use prompt-scoped state
    if (promptId.value) {
      const execution = executionStore.promptExecutions.get(promptId.value)
      if (!execution) return undefined

      // Extract node ID from locator (format: "graph_id:node_id" or "node_id")
      const nodeId = id.includes(':') ? id.split(':').pop() : id
      return nodeId ? execution.progressStates[nodeId] : undefined
    }

    // Fall back to merged global state for backward compatibility
    return nodeLocationProgressStates.value[id]
  })

  const executing = computed(
    () => !isIdle.value && progressState.value?.state === 'running'
  )

  const progress = computed(() => {
    const state = progressState.value
    return state && state.max > 0 ? state.value / state.max : undefined
  })

  const progressPercentage = computed(() => {
    const prog = progress.value
    return prog !== undefined ? Math.round(prog * 100) : undefined
  })

  const executionState = computed(() => {
    const state = progressState.value
    if (!state) return 'idle'
    return state.state
  })

  return {
    executing,
    progress,
    progressPercentage,
    progressState,
    executionState
  }
}
