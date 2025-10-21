<template>
  <NoResultsPlaceholder
    class="pb-0"
    icon="pi pi-exclamation-circle"
    :title="t('missingModelsDialog.missingModels')"
    :message="t('missingModelsDialog.missingModelsMessage')"
  />
  <div class="mb-4 flex gap-1">
    <Checkbox v-model="doNotAskAgain" binary input-id="doNotAskAgain" />
    <label for="doNotAskAgain">{{
      t('missingModelsDialog.doNotAskAgain')
    }}</label>
  </div>
  <ListBox :options="missingModels" class="comfy-missing-models">
    <template #option="{ option }">
      <ServerFileDownload
        :url="option.url"
        :label="option.label"
        :error="option.error"
        :model-type="option.modelType"
        :filename="option.filename"
      />
    </template>
  </ListBox>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import ListBox from 'primevue/listbox'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import ServerFileDownload from '@/components/common/ServerFileDownload.vue'
import { useSettingStore } from '@/platform/settings/settingStore'

// TODO: Read this from server internal API rather than hardcoding here
// as some installations may wish to use custom sources
const allowedSources = [
  'https://civitai.com/',
  'https://huggingface.co/',
  'http://localhost:' // Included for testing usage only
]
const allowedSuffixes = ['.safetensors', '.sft']
// Models that fail above conditions but are still allowed
const whiteListedUrls = new Set([
  'https://huggingface.co/stabilityai/stable-zero123/resolve/main/stable_zero123.ckpt',
  'https://huggingface.co/TencentARC/T2I-Adapter/resolve/main/models/t2iadapter_depth_sd14v1.pth?download=true',
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
])

interface ModelInfo {
  name: string
  directory: string
  directory_invalid?: boolean
  url: string
}

const props = defineProps<{
  missingModels: ModelInfo[]
  paths: Record<string, string[]>
}>()

const { t } = useI18n()

const doNotAskAgain = ref(false)

const missingModels = computed(() => {
  return props.missingModels.map((model) => {
    const paths = props.paths[model.directory]

    if (model.directory_invalid || !paths) {
      return {
        label: `${model.directory} / ${model.name}`,
        url: model.url,
        error: 'Invalid directory specified (does this require custom nodes?)',
        modelType: model.directory,
        filename: model.name
      }
    }

    if (!whiteListedUrls.has(model.url)) {
      if (!allowedSources.some((source) => model.url.startsWith(source))) {
        return {
          label: `${model.directory} / ${model.name}`,
          url: model.url,
          error: `Download not allowed from source '${model.url}', only allowed from '${allowedSources.join("', '")}'`,
          modelType: model.directory,
          filename: model.name
        }
      }
      if (!allowedSuffixes.some((suffix) => model.name.endsWith(suffix))) {
        return {
          label: `${model.directory} / ${model.name}`,
          url: model.url,
          error: `Only allowed suffixes are: '${allowedSuffixes.join("', '")}'`,
          modelType: model.directory,
          filename: model.name
        }
      }
    }

    return {
      url: model.url,
      label: `${model.directory} / ${model.name}`,
      modelType: model.directory,
      filename: model.name,
      error: null
    }
  })
})

onBeforeUnmount(async () => {
  if (doNotAskAgain.value) {
    await useSettingStore().set(
      'Comfy.Workflow.ShowMissingModelsWarning',
      false
    )
  }
})
</script>

<style scoped>
.comfy-missing-models {
  max-height: 300px;
  overflow-y: auto;
}
</style>
