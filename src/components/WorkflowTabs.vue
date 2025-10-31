<template>
  <div v-if="activeExecutions.length > 0" class="workflow-tabs">
    <div class="tabs-header">
      <button
        v-for="execution in activeExecutions"
        :key="execution.promptId"
        :class="['tab', { active: selectedPromptId === execution.promptId }]"
        @click="selectPrompt(execution.promptId)"
      >
        <span class="status-indicator" :class="execution.status"></span>
        <span class="prompt-id">{{ execution.promptId.slice(0, 8) }}</span>
        <span class="timestamp">{{ formatTime(execution.startedAt) }}</span>
        <button
          class="close"
          :title="`Cancel workflow ${execution.promptId.slice(0, 8)}`"
          @click.stop="cancelPrompt(execution.promptId)"
        >
          ×
        </button>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'

const executionStore = useExecutionStore()
const selectedPromptId = ref<string | null>(null)

const activeExecutions = computed(() => {
  return Array.from(executionStore.activePromptIds)
    .map((promptId) => executionStore.promptExecutions.get(promptId))
    .filter((state) => state != null)
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
})

// Auto-select first active execution
watch(
  activeExecutions,
  (executions) => {
    if (!selectedPromptId.value && executions.length > 0) {
      selectedPromptId.value = executions[0].promptId
    }
    // Clear selection if prompt no longer active
    if (
      selectedPromptId.value &&
      !executions.some((e) => e.promptId === selectedPromptId.value)
    ) {
      selectedPromptId.value = executions[0]?.promptId || null
    }
  },
  { immediate: true }
)

function selectPrompt(promptId: string) {
  selectedPromptId.value = promptId
}

async function cancelPrompt(promptId: string) {
  try {
    await api.interrupt(promptId)
  } catch (error) {
    console.error(`Failed to cancel workflow ${promptId}:`, error)
  }
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return 'queued'
  const elapsed = Date.now() - timestamp
  const seconds = Math.floor(elapsed / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}
</script>

<style scoped>
.workflow-tabs {
  position: fixed;
  top: 60px;
  right: 20px;
  z-index: 1000;
  max-width: 600px;
}

.tabs-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: var(--bg-color, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  background: var(--bg-secondary, #2a2a2a);
  color: var(--text-color, #e0e0e0);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: monospace;
  font-size: 12px;
}

.tab:hover {
  background: var(--bg-hover, #333);
  border-color: var(--accent-color, #0066cc);
}

.tab.active {
  background: var(--bg-active, #0066cc);
  border-color: var(--accent-color, #0088ff);
  color: white;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.queued {
  background: #888;
}

.status-indicator.running {
  background: #00cc66;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-indicator.completed {
  background: #0088ff;
}

.status-indicator.error {
  background: #ff3366;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.9);
  }
}

.prompt-id {
  font-weight: 600;
}

.timestamp {
  color: var(--text-secondary, #999);
  font-size: 11px;
}

.close {
  margin-left: 4px;
  padding: 0 6px;
  background: transparent;
  border: none;
  color: var(--text-secondary, #999);
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: color 0.2s;
  line-height: 1;
}

.close:hover {
  color: #ff3366;
}

.tab.active .close {
  color: rgba(255, 255, 255, 0.8);
}

.tab.active .close:hover {
  color: white;
}
</style>
