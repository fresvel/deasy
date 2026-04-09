import { createApp } from 'vue'
import App from '@/App.vue'
import router from '@/core/router'

import '@/shared/styles/tailwind.css'
import '@/shared/styles/theme.css'

const app = createApp(App)
app.use(router).mount('#app')
