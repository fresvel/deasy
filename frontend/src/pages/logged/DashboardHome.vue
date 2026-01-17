<template>
  <div class="dashboard-page">
    <s-header @onclick="handleHeaderToggle">
      <div class="header-left">
        <button class="nav-link text-white p-0" type="button" @click="navigateTo('perfil')" title="Ir al perfil">
          <img class="avatar" src="/images/avatar.png" alt="Perfil" />
        </button>

        <button
          v-for="item in headerAreas"
          :key="item.code"
          class="nav-link text-white"
          :class="{ active: item.active }"
          type="button"
          @click="switchArea(item)"
        >
          {{ item.name }}
        </button>
      </div>

      <div class="header-right">
        <router-link to="/logout" class="nav-link text-white ms-lg-3" title="Cerrar sesión">
          <img class="avatar" src="/images/logout.svg" alt="Cerrar sesión" />
        </router-link>

        <button class="nav-link text-white p-0" type="button" @click="navigateTo('firmar')" title="Firmar documentos">
          <img class="avatar" src="/images/pen_line.svg" alt="Firmar" />
        </button>

        <button class="nav-link text-white p-0" type="button" @click="toggleNotify" title="Notificaciones">
          <font-awesome-icon icon="bell" class="avatar" />
        </button>
      </div>
    </s-header>

    <div class="row g-3">
      <s-menu :show="showMenu">
        <div class="admin-menu">
          <UserProfile photo="/images/avatar.png" :username="userFullName" />
          <div class="menu-section">
            <button
              class="menu-section-title text-white w-100"
              type="button"
              :class="{ 'is-open': showCoordinacion }"
              @click="showCoordinacion = !showCoordinacion"
            >
              Coordinación
            </button>

            <div v-show="showCoordinacion" class="menu-section-body">
              <div class="list-group list-group-flush">
                <button
                  v-for="item in quickStats"
                  :key="item.label"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  type="button"
                  @click="navigateTo(item.route)"
                >
                  <span>{{ item.label }}</span>
                  <span class="badge bg-primary rounded-pill">{{ item.count }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="menu-section">
            <button
              class="menu-section-title text-white w-100"
              type="button"
              :class="{ 'is-open': showDocencia }"
              @click="showDocencia = !showDocencia"
            >
              Docencia
            </button>
            <div v-show="showDocencia" class="menu-section-body"></div>
          </div>
        </div>
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

          <table class="table table-institutional table-striped table-hover align-middle">
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
import SHeader from '@/layouts/SHeader.vue';
import SMenu from '@/layouts/SMenu.vue';
import SBody from '@/layouts/SBody.vue';
import SMessage from '@/layouts/SNotify.vue';
import UserProfile from '@/components/UserProfile.vue';

const router = useRouter();
const currentUser = ref(null);

const userFullName = computed(() => {
  if (!currentUser.value) return 'Usuario';
  const firstName = currentUser.value.first_name ?? '';
  const lastName = currentUser.value.last_name ?? '';
  return `${firstName} ${lastName}`.trim() || 'Usuario';
});

const showMenu = ref(true);
  const showNotify = ref(false);
  const showCoordinacion = ref(true);
  const showDocencia = ref(false);

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
  background: #f1f5fb;
}


.avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.overview-card {
  background: var(--brand-gradient);
  color: var(--brand-white);
  border-radius: 22px;
  padding: 2rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  box-shadow: var(--brand-shadow-strong);
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
  background: var(--brand-white);
  padding: 1.5rem;
  border-radius: 18px;
  box-shadow: var(--brand-shadow);
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
  color: var(--brand-navy);
}

.table-card {
  background: var(--brand-white);
  border-radius: 18px;
  padding: 1.75rem;
  box-shadow: var(--brand-shadow);
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
  background: var(--state-warning);
}

.status--danger {
  background: var(--state-danger);
}

.status--success {
  background: var(--state-success);
}

.primary-btn {
  background: var(--brand-gradient);
  color: var(--brand-white);
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1.75rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(var(--brand-primary-rgb), 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(var(--brand-primary-rgb), 0.28);
}

.secondary-btn {
  background: rgba(var(--brand-primary-rgb), 0.08);
  color: var(--brand-navy);
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1.25rem;
  font-weight: 600;
  cursor: pointer;
}

.tiny-btn {
  background: var(--brand-gradient);
  color: var(--brand-white);
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.link-btn {
  background: transparent;
  color: var(--brand-accent);
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
