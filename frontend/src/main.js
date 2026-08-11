import { createApp } from 'vue'
import App from '@/App.vue'
import router from '@/core/router'
import FontAwesomeIcon from '@/shared/components/icons/FontAwesomeIcon.vue'

import '@/shared/styles/index.css'

const app = createApp(App)
app.component('font-awesome-icon', FontAwesomeIcon)
app.use(router).mount('#app')
