import { useTimeoutFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { inject, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type {
  ExecutedWsMessage,
  ResultItem,
  ResultItemType
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { parseFilePath } from '@/utils/formatUtil'
import { isVideoNode } from '@/utils/litegraphUtil'

const PREVIEW_REVOKE_DELAY_MS = 400

const createOutputs = (
  filenames: string[],
  type: ResultItemType,
  isAnimated: boolean
): ExecutedWsMessage['output'] => {
  return {
    images: filenames.map((image) => ({ type, ...parseFilePath(image) })),
    animated: filenames.map(
      (image) =>
        isAnimated && (image.endsWith('.webp') || image.endsWith('.png'))
    )
  }
}

interface SetOutputOptions {
  merge?: boolean
}

export const useNodeOutputStore = defineStore('nodeOutput', () => {
  const { nodeIdToNodeLocatorId, nodeToNodeLocatorId } = useWorkflowStore()
  const { executionIdToNodeLocatorId } = useExecutionStore()
  const executionStore = useExecutionStore()
  const scheduledRevoke: Record<NodeLocatorId, { stop: () => void }> = {}

  function scheduleRevoke(locator: NodeLocatorId, cb: () => void) {
    scheduledRevoke[locator]?.stop()

    const { stop } = useTimeoutFn(() => {
      delete scheduledRevoke[locator]
      cb()
    }, PREVIEW_REVOKE_DELAY_MS)

    scheduledRevoke[locator] = { stop }
  }

  // NEW STRUCTURE (ONLY source of truth) - promptId-scoped storage
  const workflowNodeOutputs = ref<
    Map<string, Record<string, ExecutedWsMessage['output']>>
  >(new Map())
  // Map<promptId, Record<nodeId, Output>>

  const workflowPreviewImages = ref<Map<string, Record<string, string[]>>>(
    new Map()
  )
  // Map<promptId, Record<nodeId, blobUrls[]>>

  function getNodeOutputsByLocatorId(
    nodeLocatorId: string
  ): ExecutedWsMessage['output'] | undefined {
    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value

    if (!promptId) {
      console.error('getNodeOutputsByLocatorId: No workflowPromptId')
      return undefined
    }

    return workflowNodeOutputs.value.get(promptId)?.[nodeLocatorId]
  }

  function getNodeOutputs(
    node: LGraphNode
  ): ExecutedWsMessage['output'] | undefined {
    const locatorId = nodeToNodeLocatorId(node)
    return getNodeOutputsByLocatorId(locatorId)
  }

  function getNodePreviewImages(nodeId: string): string[] | undefined {
    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value

    if (!promptId) return undefined

    return workflowPreviewImages.value.get(promptId)?.[nodeId]
  }

  function getNodePreviews(node: LGraphNode): string[] | undefined {
    const locatorId = nodeToNodeLocatorId(node)
    return getNodePreviewImages(locatorId)
  }

  /**
   * Check if a node's outputs includes images that should/can be loaded normally
   * by PIL.
   */
  const isImageOutputs = (
    node: LGraphNode,
    outputs: ExecutedWsMessage['output']
  ): boolean => {
    // If animated webp/png or video outputs, return false
    if (node.animatedImages || isVideoNode(node)) return false

    // If no images, return false
    if (!outputs?.images?.length) return false

    // If svg images, return false
    if (outputs.images.some((image) => image.filename?.endsWith('svg')))
      return false

    return true
  }

  /**
   * Get the preview param for the node's outputs.
   *
   * If the output is an image, use the user's preferred format (from settings).
   * For non-image outputs, return an empty string, as including the preview param
   * will force the server to load the output file as an image.
   */
  function getPreviewParam(
    node: LGraphNode,
    outputs: ExecutedWsMessage['output']
  ): string {
    return isImageOutputs(node, outputs) ? app.getPreviewFormatParam() : ''
  }

  function getNodeImageUrls(node: LGraphNode): string[] | undefined {
    const previews = getNodePreviews(node)
    if (previews?.length) return previews

    const outputs = getNodeOutputs(node)
    if (!outputs?.images?.length) return

    const rand = app.getRandParam()
    const previewParam = getPreviewParam(node, outputs)

    return outputs.images.map((image) => {
      const imgUrlPart = new URLSearchParams(image)
      return api.apiURL(`/view?${imgUrlPart}${previewParam}${rand}`)
    })
  }

  /**
   * Internal function to set outputs by NodeLocatorId.
   * Handles the merge logic when needed.
   */
  function setOutputsByLocatorId(
    nodeLocatorId: NodeLocatorId,
    outputs: ExecutedWsMessage['output'] | ResultItem,
    options: SetOutputOptions = {}
  ) {
    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value

    // STRICT: promptId is mandatory
    if (!promptId) {
      console.error(
        'setOutputsByLocatorId: No workflowPromptId - cannot store outputs'
      )
      return
    }

    // Ensure promptId map exists
    if (!workflowNodeOutputs.value.has(promptId)) {
      workflowNodeOutputs.value.set(promptId, {})
    }

    // Store scoped by promptId
    const workflowOutputs = workflowNodeOutputs.value.get(promptId)!

    if (options.merge) {
      const existingOutput = workflowOutputs[nodeLocatorId]
      if (existingOutput && outputs) {
        for (const k in outputs) {
          const existingValue = existingOutput[k]
          const newValue = (outputs as Record<NodeLocatorId, any>)[k]

          if (Array.isArray(existingValue) && Array.isArray(newValue)) {
            existingOutput[k] = existingValue.concat(newValue)
          } else {
            existingOutput[k] = newValue
          }
        }
        return
      }
    }

    workflowOutputs[nodeLocatorId] = outputs
  }

  function setNodeOutputs(
    node: LGraphNode,
    filenames: string | string[] | ResultItem,
    {
      folder = 'input',
      isAnimated = false
    }: { folder?: ResultItemType; isAnimated?: boolean } = {}
  ) {
    if (!filenames || !node) return

    const locatorId = nodeToNodeLocatorId(node)
    if (!locatorId) return
    if (typeof filenames === 'string') {
      setOutputsByLocatorId(
        locatorId,
        createOutputs([filenames], folder, isAnimated)
      )
    } else if (!Array.isArray(filenames)) {
      setOutputsByLocatorId(locatorId, filenames)
    } else {
      const resultItems = createOutputs(filenames, folder, isAnimated)
      if (!resultItems?.images?.length) return
      setOutputsByLocatorId(locatorId, resultItems)
    }
  }

  /**
   * Set node outputs by execution ID (hierarchical ID from backend).
   * Converts the execution ID to a NodeLocatorId before storing.
   *
   * @param executionId - The execution ID (e.g., "123:456:789" or "789")
   * @param outputs - The outputs to store
   * @param options - Options for setting outputs
   * @param options.merge - If true, merge with existing outputs (arrays are concatenated)
   */
  function setNodeOutputsByExecutionId(
    executionId: string,
    outputs: ExecutedWsMessage['output'] | ResultItem,
    options: SetOutputOptions = {}
  ) {
    const nodeLocatorId = executionIdToNodeLocatorId(executionId)
    if (!nodeLocatorId) return

    setOutputsByLocatorId(nodeLocatorId, outputs, options)
  }

  function setNodePreviewImagesByLocatorId(nodeId: string, blobUrls: string[]) {
    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value

    if (!promptId) {
      console.error('setNodePreviewImages: No workflowPromptId')
      return
    }

    if (!workflowPreviewImages.value.has(promptId)) {
      workflowPreviewImages.value.set(promptId, {})
    }

    const workflowPreviews = workflowPreviewImages.value.get(promptId)!

    // Revoke old blob URLs before overwriting (prevent memory leak)
    if (workflowPreviews[nodeId]) {
      workflowPreviews[nodeId].forEach((url) => URL.revokeObjectURL(url))
    }

    workflowPreviews[nodeId] = blobUrls
  }

  /**
   * Set node preview images by execution ID (hierarchical ID from backend).
   * Converts the execution ID to a NodeLocatorId before storing.
   *
   * @param executionId - The execution ID (e.g., "123:456:789" or "789")
   * @param previewImages - Array of preview image URLs to store
   */
  function setNodePreviewsByExecutionId(
    executionId: string,
    previewImages: string[]
  ) {
    const nodeLocatorId = executionIdToNodeLocatorId(executionId)
    if (!nodeLocatorId) return
    if (scheduledRevoke[nodeLocatorId]) {
      scheduledRevoke[nodeLocatorId].stop()
      delete scheduledRevoke[nodeLocatorId]
    }
    setNodePreviewImagesByLocatorId(nodeLocatorId, previewImages)
  }

  /**
   * Set node preview images by node ID.
   * Uses the current graph context to create the appropriate NodeLocatorId.
   *
   * @param nodeId - The node ID
   * @param previewImages - Array of preview image URLs to store
   */
  function setNodePreviewsByNodeId(
    nodeId: string | number,
    previewImages: string[]
  ) {
    const nodeLocatorId = nodeIdToNodeLocatorId(nodeId)
    if (scheduledRevoke[nodeLocatorId]) {
      scheduledRevoke[nodeLocatorId].stop()
      delete scheduledRevoke[nodeLocatorId]
    }
    setNodePreviewImagesByLocatorId(nodeLocatorId, previewImages)
  }

  /**
   * Revoke preview images by execution ID.
   * Frees memory allocated to image preview blobs by revoking the URLs.
   *
   * @param executionId - The execution ID
   */
  function revokePreviewsByExecutionId(executionId: string) {
    const nodeLocatorId = executionIdToNodeLocatorId(executionId)
    if (!nodeLocatorId) return
    scheduleRevoke(nodeLocatorId, () =>
      revokePreviewsByLocatorId(nodeLocatorId)
    )
  }

  /**
   * Revoke preview images by node locator ID.
   * Frees memory allocated to image preview blobs by revoking the URLs.
   *
   * @param nodeLocatorId - The node locator ID
   */
  function revokePreviewsByLocatorId(nodeLocatorId: NodeLocatorId) {
    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value
    if (!promptId) return

    const previews = workflowPreviewImages.value.get(promptId)?.[nodeLocatorId]
    if (!previews?.[Symbol.iterator]) return

    for (const url of previews) {
      URL.revokeObjectURL(url)
    }

    const workflowPreviews = workflowPreviewImages.value.get(promptId)
    if (workflowPreviews) {
      delete workflowPreviews[nodeLocatorId]
    }
  }

  /**
   * Revoke all preview images.
   * Frees memory allocated to all image preview blobs.
   */
  function revokeAllPreviews() {
    for (const [_promptId, previews] of workflowPreviewImages.value.entries()) {
      for (const nodeId of Object.keys(previews)) {
        const urls = previews[nodeId]
        if (!urls?.[Symbol.iterator]) continue

        for (const url of urls) {
          URL.revokeObjectURL(url)
        }
      }
    }
    workflowPreviewImages.value.clear()
    workflowNodeOutputs.value.clear()
  }

  // Cleanup on workflow completion
  function cleanupWorkflow(promptId: string) {
    // Cleanup outputs
    workflowNodeOutputs.value.delete(promptId)

    // Cleanup preview images + revoke blob URLs
    const previews = workflowPreviewImages.value.get(promptId)
    if (previews) {
      Object.values(previews)
        .flat()
        .forEach((url) => {
          URL.revokeObjectURL(url)
        })
      workflowPreviewImages.value.delete(promptId)
    }
  }

  // Watch for workflow completion and cleanup
  watch(
    () => executionStore.promptExecutions,
    (executions) => {
      executions.forEach((state, promptId) => {
        // Cleanup on any terminal status to prevent memory leaks
        if (
          ['completed', 'error', 'cancelled', 'interrupted'].includes(
            state.status
          )
        ) {
          cleanupWorkflow(promptId)
        }
      })
    },
    { deep: true }
  )

  /**
   * Revoke all preview of a subgraph node and the graph it contains.
   * Does not recurse to contents of nested subgraphs.
   */
  function revokeSubgraphPreviews(subgraphNode: SubgraphNode) {
    const graphId = subgraphNode.graph.isRootGraph
      ? ''
      : subgraphNode.graph.id + ':'
    revokePreviewsByLocatorId(graphId + subgraphNode.id)
    for (const node of subgraphNode.subgraph.nodes) {
      revokePreviewsByLocatorId(subgraphNode.subgraph.id + node.id)
    }
  }

  /**
   * Remove node outputs for a specific node
   * Clears both outputs and preview images
   */
  function removeNodeOutputs(nodeId: number | string) {
    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value
    if (!promptId) return false

    const nodeLocatorId = nodeIdToNodeLocatorId(Number(nodeId))
    if (!nodeLocatorId) return false

    const workflowOutputs = workflowNodeOutputs.value.get(promptId)
    const hadOutputs = !!workflowOutputs?.[nodeLocatorId]

    if (workflowOutputs) {
      delete workflowOutputs[nodeLocatorId]
    }

    // Clear preview images
    const workflowPreviews = workflowPreviewImages.value.get(promptId)
    if (workflowPreviews?.[nodeLocatorId]) {
      workflowPreviews[nodeLocatorId].forEach((url) => URL.revokeObjectURL(url))
      delete workflowPreviews[nodeLocatorId]
    }

    return hadOutputs
  }

  function restoreOutputs(
    outputs: Record<string, ExecutedWsMessage['output']>
  ) {
    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value
    if (!promptId) {
      console.error('restoreOutputs: No workflowPromptId')
      return
    }

    workflowNodeOutputs.value.set(promptId, outputs)
  }

  function updateNodeImages(node: LGraphNode) {
    if (!node.images?.length) return

    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value
    if (!promptId) return

    const nodeLocatorId = nodeIdToNodeLocatorId(node.id)

    if (nodeLocatorId) {
      const workflowOutputs = workflowNodeOutputs.value.get(promptId)
      const existingOutputs = workflowOutputs?.[nodeLocatorId]

      if (existingOutputs && workflowOutputs) {
        const updatedOutputs = {
          ...existingOutputs,
          images: node.images
        }

        workflowOutputs[nodeLocatorId] = updatedOutputs
      }
    }
  }

  function resetAllOutputsAndPreviews() {
    const promptId = inject<Ref<string | undefined>>('workflowPromptId')?.value
    if (!promptId) return

    workflowNodeOutputs.value.delete(promptId)

    const previews = workflowPreviewImages.value.get(promptId)
    if (previews) {
      Object.values(previews)
        .flat()
        .forEach((url) => {
          URL.revokeObjectURL(url)
        })
      workflowPreviewImages.value.delete(promptId)
    }
  }

  return {
    // Getters
    getNodeOutputs,
    getNodeOutputsByLocatorId,
    getNodeImageUrls,
    getNodePreviews,
    getNodePreviewImages,
    getPreviewParam,

    // Setters
    setNodeOutputs,
    setNodeOutputsByExecutionId,
    setNodePreviewsByExecutionId,
    setNodePreviewsByNodeId,
    updateNodeImages,

    // Cleanup
    revokePreviewsByExecutionId,
    revokeAllPreviews,
    revokeSubgraphPreviews,
    removeNodeOutputs,
    restoreOutputs,
    resetAllOutputsAndPreviews,
    cleanupWorkflow,

    // State (new promptId-scoped storage)
    workflowNodeOutputs,
    workflowPreviewImages
  }
})
