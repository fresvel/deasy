import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

// Importar los íconos específicos que deseas utilizar
import { faEdit, faCheck, faTrash, faCertificate, faCheckDouble, faSquareCheck} from '@fortawesome/free-solid-svg-icons';

// Agregar íconos a la biblioteca
library.add(faEdit, faCheck, faTrash, faCertificate, faCheckDouble, faSquareCheck);


const app=createApp(App)
app.component('font-awesome-icon', FontAwesomeIcon);
app.use(router).mount('#app')
