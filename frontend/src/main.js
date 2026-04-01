import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import FontAwesomeCompat from './components/FontAwesomeCompat.vue';

import './styles/tailwind.css'
import './styles/theme.css'

const app = createApp(App)
app.component('font-awesome-icon', FontAwesomeCompat);
app.use(router).mount('#app')
