<template>
  <div class="dashboard-page">
    <s-header @onclick="handleHeaderToggle">
      <div class="header-left">
        <button class="nav-link text-white p-0" type="button" @click="handleUserIconClick" title="Ir al perfil">
          <img class="avatar" :src="userPhoto" alt="Perfil" />
        </button>

        <div v-if="unitGroups.length" class="group-menu">
          <div
            class="group-item"
            :class="{ active: selectedGroupId === null }"
            role="button"
            tabindex="0"
            @click="selectConsolidated"
            @keydown.enter="selectConsolidated"
          >
            <div class="group-title">Consolidado</div>
            <div class="group-meta">Todos los cargos</div>
          </div>

          <div
            v-for="group in unitGroups"
            :key="group.id"
            class="group-item"
            :class="{ active: group.id === selectedGroupId }"
            role="button"
            tabindex="0"
            @click="selectGroup(group)"
            @keydown.enter="selectGroup(group)"
          >
            <div class="group-title" :title="group.name">{{ group.label || group.name }}</div>
            <div class="group-units">
              <span v-for="unit in group.units" :key="unit.id" class="unit-pill" :title="unit.name">
                {{ unit.label || getUnitChipLabel(unit) }}
              </span>
            </div>
          </div>
        </div>
        <span v-if="!userUnits.length && !menuLoading" class="nav-link text-white-50">
          Sin unidades
        </span>
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
          <UserProfile :photo="userPhoto" :username="userFullName" />
          <div class="menu-context text-white">
            {{ menuContextLabel }}
          </div>

          <div v-if="menuLoading" class="menu-feedback text-white">
            Cargando menú...
          </div>
          <div v-else-if="menuError" class="menu-feedback text-white">
            {{ menuError }}
          </div>
          <div v-else-if="!menuCargos.length" class="menu-feedback text-white">
            No hay cargos asignados para mostrar.
          </div>

          <div v-else>
            <div v-for="cargo in menuCargos" :key="cargo.id" class="menu-section">
              <button
                class="menu-section-title text-white w-100"
                type="button"
                :class="{ 'is-open': cargo.open }"
                @click="toggleCargo(cargo)"
              >
                {{ cargo.name }}
              </button>

              <div v-show="cargo.open" class="menu-section-body">
                <div class="list-group list-group-flush">
                  <button
                    v-for="process in cargo.processes"
                    :key="process.id"
                    class="list-group-item list-group-item-action"
                    type="button"
                    @click="handleProcessSelect(process, cargo)"
                  >
                    {{ process.name }}
                  </button>
                  <div v-if="!cargo.processes.length" class="menu-empty">
                    Sin procesos asignados.
                  </div>
                </div>
              </div>
            </div>
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
import UserMenuService from '@/services/logged/UserMenuService.js';
import { API_ROUTES } from '@/services/apiConfig';

const router = useRouter();
const menuService = new UserMenuService();

const currentUser = ref(null);
const userPhoto = ref('/images/avatar.png');

const showMenu = ref(true);
const showNotify = ref(false);

const menuLoading = ref(false);
const menuError = ref('');
const userUnits = ref([]);
const unitGroups = ref([]);
const consolidatedCargos = ref([]);
const menuCargos = ref([]);
const selectedGroupId = ref(null);

const userFullName = computed(() => {
  if (!currentUser.value) return 'Usuario';
  const firstName = currentUser.value.first_name ?? '';
  const lastName = currentUser.value.last_name ?? '';
  return `${firstName} ${lastName}`.trim() || 'Usuario';
});

const menuContextLabel = computed(() => {
  if (selectedGroupId.value) {
    const group = unitGroups.value.find((item) => item.id === selectedGroupId.value);
    return group ? `Área: ${group.label || group.name}` : 'Área seleccionada';
  }
  return 'Cargos consolidados';
});

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

const resolvePhotoUrl = (value) => {
  if (!value) {
    return '/images/avatar.png';
  }
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const sanitized = value.replace(/^\/+/, '');
  return `${API_ROUTES.BASE.replace(/\/$/, '')}/${sanitized}`;
};

const applyMenuCargos = (cargos) => {
  menuCargos.value = (cargos ?? []).map((cargo, index) => ({
    ...cargo,
    open: index === 0
  }));
};

const getUnitChipLabel = (unit) => {
  if (unit?.label) {
    return unit.label;
  }
  const name = unit?.name ?? '';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return 'U';
  }
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }
  return words.map((word) => word[0]).join('').slice(0, 5).toUpperCase();
};

const selectConsolidated = () => {
  selectedGroupId.value = null;
  applyMenuCargos(consolidatedCargos.value);
};

const buildGroupCargos = (group) => {
  const cargoMap = new Map();
  (group?.units ?? []).forEach((unit) => {
    (unit.cargos ?? []).forEach((cargo) => {
      if (!cargoMap.has(cargo.id)) {
        cargoMap.set(cargo.id, { id: cargo.id, name: cargo.name, processes: [] });
      }
      const target = cargoMap.get(cargo.id);
      const seen = new Set(target.processes.map((proc) => proc.id));
      (cargo.processes ?? []).forEach((process) => {
        if (!seen.has(process.id)) {
          target.processes.push(process);
          seen.add(process.id);
        }
      });
    });
  });
  const cargos = Array.from(cargoMap.values());
  cargos.forEach((cargo) => {
    cargo.processes.sort((a, b) => a.name.localeCompare(b.name));
  });
  cargos.sort((a, b) => a.name.localeCompare(b.name));
  return cargos;
};

const selectGroup = (group) => {
  selectedGroupId.value = group?.id ?? null;
  applyMenuCargos(buildGroupCargos(group));
  if (!showMenu.value) {
    showMenu.value = true;
  }
};

const toggleCargo = (cargo) => {
  cargo.open = !cargo.open;
};

const handleProcessSelect = () => {};

const loadUserMenu = async () => {
  const userId = currentUser.value?.id ?? currentUser.value?._id;
  if (!userId) {
    return;
  }
  menuLoading.value = true;
  menuError.value = '';

  try {
    const data = await menuService.getUserMenu(userId);
    userUnits.value = Array.isArray(data?.units) ? data.units : [];
    unitGroups.value = Array.isArray(data?.unit_groups) ? data.unit_groups : [];
    consolidatedCargos.value = Array.isArray(data?.consolidated) ? data.consolidated : [];

    if (!unitGroups.value.length && userUnits.value.length) {
      unitGroups.value = [
        {
          id: 'units',
          name: 'Unidades',
          label: 'Unidades',
          units: userUnits.value
        }
      ];
    }

    if (consolidatedCargos.value.length) {
      selectConsolidated();
    } else if (unitGroups.value.length) {
      selectGroup(unitGroups.value[0]);
    } else {
      applyMenuCargos([]);
      selectedGroupId.value = null;
    }
  } catch (error) {
    console.error('Error al cargar el menú del usuario:', error);
    menuError.value = 'No se pudo cargar el menú del usuario.';
  } finally {
    menuLoading.value = false;
  }
};

onMounted(async () => {
  const userDataString = localStorage.getItem('user');
  if (userDataString) {
    try {
      currentUser.value = JSON.parse(userDataString);
      userPhoto.value = resolvePhotoUrl(currentUser.value?.photoUrl);
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  }
  await loadUserMenu();
});

const navigateTo = (destination) => {
  switch (destination) {
    case 'dashboard':
      router.push('/dashboard');
      break;
    case 'firmar':
      router.push('/firmar');
      break;
    case 'perfil':
    default:
      router.push('/perfil');
      break;
  }
};

const handleHeaderToggle = (target) => {
  if (target === 'User') {
    navigateTo('dashboard');
    selectConsolidated();
    showMenu.value = !showMenu.value;
  }
};

const handleUserIconClick = () => {
  showMenu.value = !showMenu.value;
  navigateTo('perfil');
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

.header-left {
  min-width: 0;
}

.group-menu {
  display: flex;
  align-items: stretch;
  gap: 0.85rem;
  overflow-x: auto;
  padding: 0.2rem 0.35rem;
  scrollbar-width: thin;
}

.group-menu::-webkit-scrollbar {
  height: 6px;
}

.group-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 999px;
}

.group-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 170px;
  padding: 0.55rem 0.85rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #ffffff;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  flex-shrink: 0;
}

.group-item:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.2);
}

.group-item.active {
  background: #ffffff;
  color: var(--brand-navy);
  box-shadow: 0 12px 22px rgba(0, 0, 0, 0.2);
}

.group-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.group-meta {
  font-size: 0.7rem;
  opacity: 0.75;
}

.group-units {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.unit-pill {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  color: inherit;
}

.group-item.active .unit-pill {
  background: rgba(16, 24, 39, 0.12);
  color: var(--brand-navy);
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

.menu-context {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
  opacity: 0.85;
}

.menu-feedback {
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.menu-empty {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  color: var(--brand-white);
  font-size: 0.85rem;
  margin: 0.5rem 0;
  padding: 0.5rem 0.75rem;
}

@media (max-width: 960px) {
  .overview-card {
    flex-direction: column;
  }
}
</style>
