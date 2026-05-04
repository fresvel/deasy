import { createApp } from 'vue'
import App from '@/App.vue'
import router from '@/core/router'
import FontAwesomeIcon from '@/shared/components/icons/FontAwesomeIcon.vue'

import '@/shared/styles/tailwind.css'
import '@/shared/styles/theme.css'

const localDevHosts = new Set(['localhost', '127.0.0.1', '::1'])

if (typeof window !== 'undefined' && localDevHosts.has(window.location.hostname)) {
  document.documentElement.dataset.environment = 'local-dev'
}

const app = createApp(App)
app.component('font-awesome-icon', FontAwesomeIcon)
app.use(router).mount('#app')
