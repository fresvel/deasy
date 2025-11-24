<template>
  <div class="dashboard-page">
    <s-header @onclick="handleHeaderToggle">
      <a class="item large" @click="navigateTo('perfil')" title="Ir al perfil">
        <img class="avatar" src="/images/avatar.png" alt="Perfil" />
      </a>

      <a
        v-for="item in headerAreas"
        :key="item.code"
        class="item large"
        :class="{ active: item.active }"
        @click="switchArea(item)"
      >
        {{ item.name }}
      </a>

      <router-link to="/logout" class="item large right aligned" title="Cerrar sesión">
        <img class="avatar" src="/images/logout.svg" alt="Cerrar sesión" />
      </router-link>

      <a class="item large" @click="navigateTo('firmar')" title="Firmar documentos">
        <img class="avatar" src="/images/pen_line.svg" alt="Firmar" />
      </a>

      <a class="item large" @click="toggleNotify" title="Notificaciones">
        <img class="avatar" src="/images/message.svg" alt="Notificaciones" />
      </a>
    </s-header>

    <div class="ui grid">
      <s-menu :show="showMenu">
        <UserProfile photo="/images/avatar.png" :username="userFullName" />
        <a class="large item labeled center">Coordinación</a>

        <a
          v-for="item in quickStats"
          :key="item.label"
          class="right medium item labeled"
          @click="navigateTo(item.route)"
        >
          {{ item.label }}
          <div class="ui left pointing blue label">
            <div class="medium">{{ item.count }}</div>
          </div>
        </a>

        <a class="item large center">Docencia</a>
      </s-menu>

      <s-body :showmenu="showMenu" :shownotify="showNotify">
        <section class="overview-card">
          <div>
            <h1>Bienvenido(a), {{ userFullName }}</h1>
            <p>
              Este es tu panel general. Revisa el estado de tus módulos, firmas pendientes y completa tu perfil académico.
            </p>
          </div>
          <button class="primary-btn" @click="navigateTo('perfil')">
            Ir a mi perfil
          </button>
        </section>

        <section class="summary-grid">
          <article class="summary-card" v-for="card in summaryCards" :key="card.title">
            <header>
              <h3>{{ card.title }}</h3>
              <span :class="['status-pill', card.statusClass]">{{ card.status }}</span>
            </header>
            <p>{{ card.description }}</p>
            <footer>
              <span class="summary-count">{{ card.count }}</span>
              <button class="link-btn" @click="navigateTo(card.route)">
                {{ card.action }} →
              </button>
            </footer>
          </article>
        </section>

        <section class="table-card">
          <header>
            <h2>Resumen rápido</h2>
            <button class="secondary-btn" @click="navigateTo('perfil')">
              Gestionar perfil
            </button>
          </header>

          <table class="ui celled table">
            <thead>
              <tr>
                <th>Sección</th>
                <th>Registros</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in summaryRows" :key="row.section">
                <td>{{ row.section }}</td>
                <td>{{ row.count }}</td>
                <td>
                  <span :class="['status-pill', row.statusClass]">{{ row.status }}</span>
                </td>
                <td>
                  <button class="tiny-btn" @click="navigateTo(row.route)">
                    Gestionar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </s-body>

      <s-message :show="showNotify" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SHeader from '@/components/main/SHeader.vue';
import SMenu from '@/components/main/SMenu.vue';
import SBody from '@/components/main/SBody.vue';
import SMessage from '@/components/main/SNotify.vue';
import UserProfile from '@/components/general/UserProfile.vue';

const router = useRouter();
const currentUser = ref(null);

const userFullName = computed(() => {
  if (!currentUser.value) return 'Usuario';
  const { nombre, apellido } = currentUser.value;
  return `${nombre ?? ''} ${apellido ?? ''}`.trim() || 'Usuario';
});

const showMenu = ref(true);
const showNotify = ref(false);

const headerAreas = ref([
  { code: 'perfil', name: 'Perfil', active: true, route: 'perfil' },
  { code: 'academia', name: 'Academia', active: false, route: 'perfil' },
  { code: 'firmar', name: 'Firmar', active: false, route: 'firmar' }
]);

const quickStats = ref([
  { label: 'Formación', count: 0, route: 'perfil' },
  { label: 'Experiencia', count: 0, route: 'perfil' },
  { label: 'Referencias', count: 0, route: 'perfil' },
  { label: 'Capacitación', count: 0, route: 'perfil' },
  { label: 'Certificación', count: 0, route: 'perfil' }
]);

const summaryCards = ref([
  {
    title: 'Perfil profesional',
    description: 'Completa la información de formación y experiencia para habilitar todos los módulos.',
    status: 'En progreso',
    statusClass: 'status--warning',
    count: '60%',
    action: 'Completar perfil',
    route: 'perfil'
  },
  {
    title: 'Documentos por firmar',
    description: 'Tienes documentos pendientes en la bandeja de firmas electrónicas.',
    status: 'Pendiente',
    statusClass: 'status--danger',
    count: quickStats.value[0].count,
    action: 'Ir a firmas',
    route: 'firmar'
  },
  {
    title: 'Tutorías y seguimiento',
    description: 'Consulta tutorías, reuniones y actividades asignadas.',
    status: 'Al día',
    statusClass: 'status--success',
    count: 0,
    action: 'Ver tutorías',
    route: 'perfil'
  }
]);

const summaryRows = ref([
  { section: 'Formación', count: 0, status: 'Incompleto', statusClass: 'status--warning', route: 'perfil' },
  { section: 'Experiencia', count: 0, status: 'Pendiente', statusClass: 'status--danger', route: 'perfil' },
  { section: 'Firmas electrónicas', count: 0, status: 'Acción requerida', statusClass: 'status--warning', route: 'firmar' }
]);

onMounted(() => {
  const userDataString = localStorage.getItem('user');
  if (userDataString) {
    try {
      currentUser.value = JSON.parse(userDataString);
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  }
});

const navigateTo = (destination) => {
  switch (destination) {
    case 'firmar':
      router.push('/firmar');
      break;
    case 'perfil':
    default:
      router.push('/perfil');
      break;
  }
};

const switchArea = (item) => {
  headerAreas.value.forEach((area) => {
    area.active = area.code === item.code;
  });
  navigateTo(item.route);
};

const handleHeaderToggle = (target) => {
  if (target === 'User') {
    showMenu.value = !showMenu.value;
  }
};

const toggleNotify = () => {
  showNotify.value = !showNotify.value;
};
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: #f0f2f8;
}

.ui.grid {
  margin: 0;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.overview-card {
  background: linear-gradient(90deg, #16245a 0%, #2f52c0 100%);
  color: #ffffff;
  border-radius: 22px;
  padding: 2rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  box-shadow: 0 18px 32px rgba(16, 28, 74, 0.25);
}

.overview-card h1 {
  font-size: 1.9rem;
  margin-bottom: 0.5rem;
}

.overview-card p {
  max-width: 540px;
  font-size: 1rem;
  opacity: 0.9;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 18px;
  box-shadow: 0 14px 32px rgba(16, 28, 74, 0.12);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 170px;
}

.summary-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-card footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-count {
  font-size: 1.8rem;
  font-weight: 700;
  color: #16245a;
}

.table-card {
  background: #ffffff;
  border-radius: 18px;
  padding: 1.75rem;
  box-shadow: 0 12px 28px rgba(16, 28, 74, 0.15);
}

.table-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.status-pill {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
}

.status--warning {
  background: #f59e0b;
}

.status--danger {
  background: #dc2626;
}

.status--success {
  background: #16a34a;
}

.primary-btn {
  background: linear-gradient(90deg, #0d1b4d 0%, #1f3fa9 100%);
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1.75rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(16, 28, 74, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(16, 28, 74, 0.28);
}

.secondary-btn {
  background: rgba(16, 28, 74, 0.08);
  color: #10214a;
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1.25rem;
  font-weight: 600;
  cursor: pointer;
}

.tiny-btn {
  background: #1f3fa9;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.link-btn {
  background: transparent;
  color: #1f3fa9;
  border: none;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.center {
  text-align: center !important;
}

@media (max-width: 960px) {
  .overview-card {
    flex-direction: column;
  }
}
</style>

