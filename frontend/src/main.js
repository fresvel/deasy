import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Bootstrap imports
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap/dist/js/bootstrap.bundle.js'
import './scss/theme.scss'

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

// Importar los íconos específicos que deseas utilizar
import {    faEdit, faCheck, faTrash, faCertificate,
            faCheckDouble, faSquareCheck, faForward,
            faBackward, faUser, faLock, faUserPlus,
            faIdCard, faEnvelope, faPhone, faMapMarkerAlt,
            faGlobe, faCheckCircle, faExclamationTriangle,
            faSignInAlt, faEye, faEyeSlash, faTimesCircle, faListCheck,
            faCircle, faPlus, faTimes, faMapMarkedAlt, faInfoCircle, faEllipsis, faEllipsisVertical, faRotateRight, faSearch} from '@fortawesome/free-solid-svg-icons';
import { faBell } from '@fortawesome/free-solid-svg-icons';

// Agregar íconos a la biblioteca
library.add(faEdit, faCheck, faTrash, faCertificate, faCheckDouble, faSquareCheck,faForward,
    faBackward, faUser, faLock, faUserPlus, faIdCard, faEnvelope,
    faPhone, faMapMarkerAlt, faGlobe, faCheckCircle, faExclamationTriangle, faSignInAlt,
    faEye, faEyeSlash, faTimesCircle, faListCheck, faCircle, faPlus, faTimes, faMapMarkedAlt, faInfoCircle, faEllipsis, faEllipsisVertical, faRotateRight, faSearch, faBell);


const app=createApp(App)
app.component('font-awesome-icon', FontAwesomeIcon);
app.use(router).mount('#app')
