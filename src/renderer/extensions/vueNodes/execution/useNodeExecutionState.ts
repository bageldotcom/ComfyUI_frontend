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
  const { isIdle } = storeToRefs(executionStore)

  const progressState = computed(() => {
    const id = locatorId.value
    if (!id) return undefined

    // Multi-workflow isolation: Always require promptId
    if (!promptId.value) {
      // No execution state when workflow is idle (correct behavior)
      return undefined
    }

    const execution = executionStore.promptExecutions.get(promptId.value)
    if (!execution) return undefined

    // Extract node ID from locator (format: "graph_id:node_id" or "node_id")
    const nodeId = id.includes(':') ? id.split(':').pop() : id
    return nodeId ? execution.progressStates[nodeId] : undefined
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
