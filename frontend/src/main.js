import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import './styles/tailwind.css'
import './styles/theme.css'

import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';


const app = createApp(App)
app.component('font-awesome-icon', FontAwesomeIcon);
app.use(router).mount('#app')
