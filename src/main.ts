import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import * as Sentry from '@sentry/vue'
import { initializeApp } from 'firebase/app'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'
import { VueFire, VueFireAuth } from 'vuefire'

import { FIREBASE_CONFIG } from '@/config/firebase'
import '@/lib/litegraph/public/css/litegraph.css'
import router from '@/router'

import App from './App.vue'
// Intentionally relative import to ensure the CSS is loaded in the right order (after litegraph.css)
import './assets/css/style.css'
import { i18n } from './i18n'

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    // @ts-expect-error fixme ts strict error
    primary: Aura['primitive'].blue
  }
})

const firebaseApp = initializeApp(FIREBASE_CONFIG)

const app = createApp(App)
const pinia = createPinia()
Sentry.init({
  app,
  dsn: __SENTRY_DSN__,
  enabled: __SENTRY_ENABLED__,
  release: __COMFYUI_FRONTEND_VERSION__,
  environment: __COMFYUI_ENV__ || 'development',

  // Session replay for error debugging
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false
    })
  ],

  // Sampling rates (matches Bagel frontend)
  tracesSampleRate: 1.0, // 100% always (matches Bagel)
  replaysSessionSampleRate: 0.5, // 50% of sessions (increased for better observability)
  replaysOnErrorSampleRate: 1.0, // 100% when errors occur

  // Session tracking
  autoSessionTracking: true,

  // Error filtering (production noise reduction)
  beforeSend(event) {
    // Filter ResizeObserver errors (browser quirk, not our bug)
    if (
      event.exception?.values?.[0]?.value
        ?.toLowerCase()
        .includes('resizeobserver')
    ) {
      return null
    }

    // Filter browser extension errors (Web3 wallets, etc.)
    const isBrowserExtension =
      event.exception?.values?.[0]?.stacktrace?.frames?.some(
        (frame) =>
          frame.filename?.includes('chrome-extension://') ||
          frame.filename?.includes('moz-extension://') ||
          frame.filename?.includes('extension://')
      )
    if (isBrowserExtension) {
      return null
    }

    return event
  },

  // Deep object normalization
  normalizeDepth: 10
})

// Enable Vue-specific error tracking
app.config.errorHandler = (err, instance, info) => {
  Sentry.captureException(err, {
    contexts: {
      vue: {
        componentName: instance?.$options?.name || 'Unknown',
        propsData: instance?.$props,
        lifecycle: info
      }
    }
  })

  // Still log to console in development
  if (__SENTRY_ENABLED__ === false) {
    console.error('[Vue Error]', err, info)
  }
}

// Set global tags
Sentry.setTag('service', 'comfyui')
Sentry.setTag('component', 'frontend')
app.directive('tooltip', Tooltip)
app
  .use(router)
  .use(PrimeVue, {
    theme: {
      preset: ComfyUIPreset,
      options: {
        prefix: 'p',
        cssLayer: {
          name: 'primevue',
          order: 'theme, base, primevue'
        },
        // This is a workaround for the issue with the dark mode selector
        // https://github.com/primefaces/primevue/issues/5515
        darkModeSelector: '.dark-theme, :root:has(.dark-theme)'
      }
    }
  })
  .use(ConfirmationService)
  .use(ToastService)
  .use(pinia)
  .use(i18n)
  .use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()]
  })
  .mount('#vue-app')
