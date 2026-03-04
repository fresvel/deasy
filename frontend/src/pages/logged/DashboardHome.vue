<template>
  <div class="dashboard-page dashboard-typography">
    <s-header :menu-open="showMenu" @onclick="handleHeaderToggle">
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
            <span class="group-icon">
              <font-awesome-icon icon="globe" />
            </span>
            <div class="group-content">
              <div class="group-title">Consolidado</div>
            </div>
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
            <span class="group-icon">
              <font-awesome-icon :icon="iconForUnitGroup(group)" />
            </span>
            <div class="group-content">
              <div class="group-title" :title="group.name">
                {{ group.label || group.name }}
              </div>
            </div>
          </div>
        </div>
        <span v-if="!userUnits.length && !menuLoading" class="nav-link text-white-50">
          Sin unidades
        </span>
      </div>

      <div class="header-right">
        <router-link to="/logout" class="nav-link text-white p-0 ms-lg-3" title="Cerrar sesión">
          <img class="avatar" src="/images/logout.svg" alt="Cerrar sesión" />
        </router-link>

        <button class="nav-link text-white p-0" type="button" @click="navigateTo('firmar')" title="Firmar documentos">
          <img class="avatar" src="/images/pen_line.svg" alt="Firmar" />
        </button>

        <button class="nav-link text-white p-0" type="button" @click="toggleNotify" title="Notificaciones">
          <font-awesome-icon icon="bell" class="avatar" />
        </button>
        <button class="nav-link text-white p-0" type="button" @click="toggleNavMenu" title="Menú de navegación">
          <font-awesome-icon icon="bars" class="avatar" />
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
                <span class="menu-title-left">
                  <font-awesome-icon :icon="iconForCargo(cargo.name)" class="menu-title-icon" />
                  <span>{{ cargo.name }}</span>
                </span>
              </button>

              <div v-show="cargo.open" class="menu-section-body">
                <div class="list-group list-group-flush">
                  <button
                    v-for="process in cargo.processes"
                    :key="process.id"
                    class="list-group-item list-group-item-action"
                    :class="{ active: selectedProcessKey === String(process.process_definition_id) }"
                    type="button"
                    @click="handleProcessSelect(process, cargo)"
                  >
                    <span class="menu-item-content">
                      <font-awesome-icon :icon="iconForProcess(process.name)" class="menu-item-icon" />
                      <span>{{ process.name }}</span>
                    </span>
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
        <template v-if="!selectedProcessKey && !processPanelLoading">
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
        </template>

        <template v-else>
          <section class="process-console-shell">
            <section class="process-console-hero">
              <div class="process-console-hero-main">
                <div class="process-console-kicker">
                  {{ selectedProcessPanel?.definition?.process_name || selectedProcessContext?.name || 'Proceso' }}
                </div>
                <h1>{{ selectedProcessPanel?.definition?.name || selectedProcessContext?.name || 'Definición de proceso' }}</h1>
                <p>
                  Gestiona solo tus tareas y entregables de esta definición activa. Desde aquí puedes revisar dependencias,
                  documentos, firmas y lanzar tareas manuales cuando el flujo lo permita.
                </p>
                <div class="process-console-badges">
                  <span v-if="selectedProcessPanel?.definition?.series_code || selectedProcessPanel?.definition?.variation_key" class="console-pill">
                    {{ selectedProcessPanel?.definition?.series_code || selectedProcessPanel?.definition?.variation_key }}
                  </span>
                  <span v-if="selectedProcessPanel?.definition?.definition_version" class="console-pill">
                    Versión {{ selectedProcessPanel.definition.definition_version }}
                  </span>
                  <span v-if="selectedProcessPanel?.definition?.execution_mode" class="console-pill">
                    {{ selectedProcessPanel.definition.execution_mode || 'manual' }}
                  </span>
                  <span class="console-pill" :class="{ 'console-pill--accent': selectedProcessPanel?.permissions?.has_document }">
                    {{ selectedProcessPanel?.permissions?.has_document ? 'Con documento' : 'Sin documento' }}
                  </span>
                </div>
              </div>
              <div class="process-console-hero-actions">
                <button class="secondary-btn" type="button" @click="clearSelectedProcess">
                  Volver al panel general
                </button>
                <button
                  class="primary-btn"
                  type="button"
                  :disabled="!selectedProcessPanel?.permissions?.can_launch_manual"
                  @click="openTaskLaunchModal"
                >
                  Crear tarea
                </button>
              </div>
            </section>

            <section v-if="processPanelLoading" class="console-feedback-card">
              Cargando la definición seleccionada...
            </section>

            <section v-else-if="processPanelError" class="console-feedback-card console-feedback-card--error">
              {{ processPanelError }}
            </section>

            <template v-else>
              <section class="process-summary-grid">
                <article class="process-summary-card">
                  <header><span>Tareas</span><strong>{{ selectedProcessPanel.summary.tasks_total }}</strong></header>
                  <p>{{ selectedProcessPanel.summary.tasks_pending }} pendientes o en curso.</p>
                </article>
                <article class="process-summary-card">
                  <header><span>Entregables</span><strong>{{ selectedProcessPanel.summary.task_items_pending }}</strong></header>
                  <p>Items pendientes ligados a tus tareas.</p>
                </article>
                <article class="process-summary-card">
                  <header><span>Documentos</span><strong>{{ selectedProcessPanel.summary.documents_total }}</strong></header>
                  <p>Documentos vinculados a tus entregables.</p>
                </article>
                <article class="process-summary-card">
                  <header><span>Firmas</span><strong>{{ selectedProcessPanel.summary.signatures_pending }}</strong></header>
                  <p>Solicitudes de firma pendientes para ti.</p>
                </article>
              </section>

              <section v-if="processActionMessage" class="console-feedback-card" :class="{
                'console-feedback-card--error': processActionMessage.type === 'error',
                'console-feedback-card--success': processActionMessage.type === 'success'
              }">
                {{ processActionMessage.text }}
              </section>

              <section class="process-console-grid">
                <article class="console-card console-card--span-2">
                  <header class="console-card-header">
                    <div>
                      <h2>Tareas asignadas</h2>
                      <p>Solo se muestran las tareas donde participas o que creaste manualmente.</p>
                    </div>
                    <button
                      class="tiny-btn"
                      type="button"
                      :disabled="!selectedProcessPanel?.permissions?.can_launch_manual"
                      @click="openTaskLaunchModal"
                    >
                      Crear tarea
                    </button>
                  </header>

                  <div v-if="!selectedProcessPanel.tasks.length" class="console-empty">
                    No tienes tareas activas o históricas para esta definición.
                  </div>

                  <div v-else class="task-stack">
                    <article v-for="task in selectedProcessPanel.tasks" :key="task.id" class="task-card">
                      <header class="task-card-header">
                        <div>
                          <h3>{{ task.term_name }}</h3>
                          <div class="task-meta-line">
                            <span class="console-chip">{{ task.term_type_name }}</span>
                            <span class="console-chip" :class="task.launch_mode === 'manual' ? 'console-chip--accent' : ''">
                              {{ task.launch_mode === 'manual' ? 'Manual' : 'Automática' }}
                            </span>
                            <span class="console-chip">{{ task.status }}</span>
                          </div>
                        </div>
                        <div class="task-card-meta">
                          <span>{{ formatDate(task.start_date) }}</span>
                          <span v-if="task.end_date">hasta {{ formatDate(task.end_date) }}</span>
                        </div>
                      </header>

                      <p v-if="task.description" class="task-description">{{ task.description }}</p>

                      <div class="task-inline-stats">
                        <span>{{ task.task_item_count }} entregables</span>
                        <span>{{ task.pending_task_items }} pendientes</span>
                        <span v-if="task.responsible_position_title">Responsable general: {{ task.responsible_position_title }}</span>
                        <span v-if="task.is_current_user_creator">Creada por ti</span>
                      </div>

                      <div v-if="task.items.length" class="task-items-list">
                        <div v-for="item in task.items" :key="item.id" class="task-item-row">
                          <div class="task-item-main">
                            <strong>{{ item.template_artifact_name || `Entregable #${item.id}` }}</strong>
                            <div class="task-item-meta">
                              <span>{{ item.template_usage_role }}</span>
                              <span>{{ item.status }}</span>
                              <span v-if="item.responsible_position_title">Responsable específico: {{ item.responsible_position_title }}</span>
                            </div>
                          </div>
                          <div class="task-item-doc">
                            <span v-if="item.document_id">Documento {{ item.document_version ? `v${item.document_version}` : 'creado' }}</span>
                            <span v-else>Sin documento</span>
                            <span v-if="item.pending_signature_count">Firmas pendientes: {{ item.pending_signature_count }}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                </article>

                <article class="console-card">
                  <header class="console-card-header">
                    <div>
                      <h2>Mis paquetes</h2>
                      <p>Paquetes de usuario asociados a tu cuenta.</p>
                    </div>
                  </header>
                  <div v-if="!selectedProcessPanel.user_packages.length" class="console-empty">
                    Aún no tienes paquetes de usuario registrados.
                  </div>
                  <div v-else class="simple-list">
                    <div v-for="item in selectedProcessPanel.user_packages" :key="item.id" class="simple-list-item">
                      <strong>{{ item.display_name }}</strong>
                      <span>{{ item.artifact_stage }}</span>
                    </div>
                  </div>
                </article>

                <article class="console-card console-card--wide">
                  <header class="console-card-header">
                    <div>
                      <h2>Documentos</h2>
                      <p>Documentos de tus entregables en esta definición.</p>
                    </div>
                  </header>
                  <div v-if="!selectedProcessPanel.documents.length" class="console-empty">
                    No hay documentos generados todavía.
                  </div>
                  <div v-else class="simple-list">
                    <div v-for="doc in selectedProcessPanel.documents" :key="doc.document_id" class="simple-list-item simple-list-item--stacked">
                      <strong>{{ doc.template_artifact_name || `Documento #${doc.document_id}` }}</strong>
                      <span>{{ doc.document_status || 'Inicial' }}</span>
                      <span v-if="doc.document_version">Versión {{ doc.document_version }}</span>
                      <span v-if="doc.pending_signature_count">Firmas pendientes: {{ doc.pending_signature_count }}</span>
                    </div>
                  </div>
                </article>

                <article class="console-card">
                  <header class="console-card-header">
                    <div>
                      <h2>Flujo de firmas</h2>
                      <p>Solicitudes de firma que te corresponden dentro de esta definición.</p>
                    </div>
                    <button class="tiny-btn" type="button" @click="navigateTo('firmar')">
                      Ir a firmas
                    </button>
                  </header>
                  <div v-if="!selectedProcessPanel.signatures.length" class="console-empty">
                    No tienes solicitudes de firma para esta definición.
                  </div>
                  <div v-else class="simple-list">
                    <div v-for="signature in selectedProcessPanel.signatures" :key="signature.id" class="simple-list-item simple-list-item--stacked">
                      <strong>{{ signature.template_artifact_name || 'Documento' }}</strong>
                      <span>{{ signature.signature_type_name || 'Firma' }} · Paso {{ signature.step_order || 1 }}</span>
                      <span>{{ signature.status_name || (signature.responded_at ? 'Respondida' : 'Pendiente') }}</span>
                    </div>
                  </div>
                </article>

                <article class="console-card console-card--full">
                  <header class="console-card-header">
                    <div>
                      <h2>Dependencias de la definición</h2>
                      <p>Resumen de reglas, disparadores y paquetes del sistema que hacen operativa esta definición.</p>
                    </div>
                  </header>
                  <div class="dependencies-grid">
                    <section class="dependency-block">
                      <h3>Reglas</h3>
                      <div v-if="!selectedProcessPanel.dependencies.rules.length" class="console-empty console-empty--inline">
                        Sin reglas activas para tu alcance.
                      </div>
                      <ul v-else class="dependency-list">
                        <li v-for="rule in selectedProcessPanel.dependencies.rules" :key="rule.id">
                          {{ rule.display_label }}
                        </li>
                      </ul>
                    </section>
                    <section class="dependency-block">
                      <h3>Disparadores</h3>
                      <div v-if="!selectedProcessPanel.dependencies.triggers.length" class="console-empty console-empty--inline">
                        Sin disparadores activos.
                      </div>
                      <ul v-else class="dependency-list">
                        <li v-for="trigger in selectedProcessPanel.dependencies.triggers" :key="trigger.id">
                          {{ formatTriggerLabel(trigger) }}
                        </li>
                      </ul>
                    </section>
                    <section class="dependency-block">
                      <h3>Paquetes</h3>
                      <div v-if="!selectedProcessPanel.dependencies.templates.length" class="console-empty console-empty--inline">
                        Sin paquetes vinculados.
                      </div>
                      <ul v-else class="dependency-list">
                        <li v-for="template in selectedProcessPanel.dependencies.templates" :key="template.id">
                          {{ template.template_artifact_name }}
                          <span class="dependency-inline-meta">
                            · {{ template.usage_role }} · {{ template.creates_task ? 'Genera tarea' : 'Soporte' }}
                          </span>
                        </li>
                      </ul>
                    </section>
                  </div>
                </article>
              </section>
            </template>
          </section>
        </template>
      </s-body>

      <s-message :show="showNotify" />
      
      <s-nav-menu :show="showNavMenu" :is-admin="false" @close="showNavMenu = false" />
    </div>

    <div v-if="showTaskLaunchModal" class="floating-dialog-backdrop" @click.self="closeTaskLaunchModal">
      <div class="floating-dialog">
        <header class="floating-dialog-header">
          <div>
            <h2>Crear tarea manual</h2>
            <p>{{ selectedProcessPanel?.definition?.name || 'Definición seleccionada' }}</p>
          </div>
          <button class="dialog-close-btn" type="button" @click="closeTaskLaunchModal">×</button>
        </header>

        <div class="floating-dialog-body">
          <div v-if="taskLaunchError" class="console-feedback-card console-feedback-card--error">
            {{ taskLaunchError }}
          </div>

          <div class="dialog-grid">
            <label class="dialog-field dialog-field--full">
              <span>Descripción</span>
              <textarea
                v-model="taskLaunchForm.description"
                class="form-control"
                rows="3"
                placeholder="Describe brevemente la tarea manual que vas a lanzar."
              />
            </label>

            <label class="dialog-field">
              <span>Periodo existente</span>
              <select v-model="taskLaunchForm.term_id" class="form-select" :disabled="taskLaunchUseCustomTerm">
                <option value="">Seleccionar</option>
                <option v-for="term in selectedProcessPanel?.available_terms || []" :key="term.id" :value="String(term.id)">
                  {{ term.name }} · {{ term.term_type_name }}
                </option>
              </select>
            </label>

            <label v-if="selectedProcessPanel?.permissions?.can_launch_custom_term" class="dialog-field dialog-field--switch">
              <span>Crear periodo custom</span>
              <input v-model="taskLaunchUseCustomTerm" type="checkbox" />
            </label>

            <template v-if="taskLaunchUseCustomTerm">
              <label class="dialog-field dialog-field--full">
                <span>Nombre del periodo custom</span>
                <input v-model="taskLaunchForm.custom_name" class="form-control" type="text" placeholder="Ejemplo: Seguimiento extraordinario abril" />
              </label>
              <label class="dialog-field">
                <span>Fecha inicial</span>
                <input v-model="taskLaunchForm.custom_start_date" class="form-control" type="date" />
              </label>
              <label class="dialog-field">
                <span>Fecha final</span>
                <input v-model="taskLaunchForm.custom_end_date" class="form-control" type="date" />
              </label>
            </template>
          </div>
        </div>

        <footer class="floating-dialog-footer">
          <button class="secondary-btn" type="button" :disabled="taskLaunchSubmitting" @click="closeTaskLaunchModal">
            Cancelar
          </button>
          <button class="primary-btn" type="button" :disabled="!canSubmitTaskLaunch" @click="submitTaskLaunch">
            {{ taskLaunchSubmitting ? 'Creando tarea...' : 'Crear tarea' }}
          </button>
        </footer>
      </div>
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
import SNavMenu from '@/layouts/SNavMenu.vue';
import UserProfile from '@/components/UserProfile.vue';
import UserMenuService from '@/services/logged/UserMenuService.js';
import ProcessDefinitionPanelService from '@/services/logged/ProcessDefinitionPanelService.js';
import { API_ROUTES } from '@/services/apiConfig';

const router = useRouter();
const menuService = new UserMenuService();
const processPanelService = new ProcessDefinitionPanelService();

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
const selectedProcessKey = ref(null);
const selectedProcessContext = ref(null);
const selectedProcessPanel = ref(null);
const processPanelLoading = ref(false);
const processPanelError = ref('');
const processActionMessage = ref(null);
const showTaskLaunchModal = ref(false);
const taskLaunchSubmitting = ref(false);
const taskLaunchError = ref('');
const taskLaunchUseCustomTerm = ref(false);
const taskLaunchForm = ref({
  description: '',
  term_id: '',
  custom_name: '',
  custom_start_date: '',
  custom_end_date: ''
});

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

const iconForCargo = (name = '') => {
  const normalized = name.toLowerCase();
  if (normalized.includes('docen')) return 'certificate';
  if (normalized.includes('coord')) return 'id-card';
  if (normalized.includes('admin')) return 'lock';
  return 'id-card';
};

const iconForProcess = (name = '') => {
  const normalized = name.toLowerCase();
  if (normalized.includes('firma')) return 'check-circle';
  if (normalized.includes('perfil')) return 'user';
  if (normalized.includes('academ')) return 'certificate';
  if (normalized.includes('unidad')) return 'globe';
  return 'square-check';
};

const iconForUnitGroup = (group) => {
  const label = `${group?.label ?? ''} ${group?.name ?? ''}`.toLowerCase();
  if (label.includes('univers')) return 'globe';
  if (label.includes('facult')) return 'map-marked-alt';
  if (label.includes('carrera')) return 'certificate';
  if (label.includes('depart')) return 'id-card';
  return 'id-card';
};

const resetTaskLaunchForm = () => {
  taskLaunchForm.value = {
    description: '',
    term_id: '',
    custom_name: '',
    custom_start_date: '',
    custom_end_date: ''
  };
  taskLaunchUseCustomTerm.value = false;
  taskLaunchSubmitting.value = false;
  taskLaunchError.value = '';
};

const clearSelectedProcess = () => {
  selectedProcessKey.value = null;
  selectedProcessContext.value = null;
  selectedProcessPanel.value = null;
  processPanelError.value = '';
  processActionMessage.value = null;
  showTaskLaunchModal.value = false;
  resetTaskLaunchForm();
};

const currentUserId = computed(() => currentUser.value?.id ?? currentUser.value?._id ?? null);

const canSubmitTaskLaunch = computed(() => {
  if (!selectedProcessPanel.value?.permissions?.can_launch_manual || taskLaunchSubmitting.value) {
    return false;
  }
  if (taskLaunchUseCustomTerm.value) {
    return Boolean(
      taskLaunchForm.value.custom_name
      && taskLaunchForm.value.custom_start_date
      && taskLaunchForm.value.custom_end_date
    );
  }
  return Boolean(taskLaunchForm.value.term_id);
});

const formatDate = (value) => {
  if (!value) return '—';
  const normalized = String(value).slice(0, 10);
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }
  return date.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatTriggerLabel = (trigger) => {
  if (!trigger) return 'Disparador';
  if (trigger.trigger_mode === 'automatic_by_term_type') {
    return `Automatico por ${trigger.term_type_name || 'tipo de periodo'}`;
  }
  if (trigger.trigger_mode === 'manual_custom_term') {
    return 'Manual con periodo custom';
  }
  return 'Manual sobre periodo existente';
};

const loadSelectedProcessPanel = async (process) => {
  const userId = currentUserId.value;
  const definitionId = Number(process?.process_definition_id);
  if (!userId || !definitionId) {
    processPanelError.value = 'No se pudo identificar la definición del proceso seleccionada.';
    return;
  }
  processPanelLoading.value = true;
  processPanelError.value = '';
  processActionMessage.value = null;
  try {
    const panel = await processPanelService.getPanel(userId, definitionId);
    selectedProcessPanel.value = panel;
    selectedProcessKey.value = `${definitionId}`;
  } catch (error) {
    console.error('Error al cargar el panel operativo de la definición:', error);
    selectedProcessPanel.value = null;
    processPanelError.value = error?.response?.data?.message || 'No se pudo cargar la definición seleccionada.';
  } finally {
    processPanelLoading.value = false;
  }
};

const handleProcessSelect = async (process) => {
  selectedProcessKey.value = process?.process_definition_id ? String(process.process_definition_id) : null;
  selectedProcessContext.value = process || null;
  await loadSelectedProcessPanel(process);
};

const openTaskLaunchModal = () => {
  if (!selectedProcessPanel.value?.permissions?.can_launch_manual) {
    return;
  }
  resetTaskLaunchForm();
  showTaskLaunchModal.value = true;
};

const closeTaskLaunchModal = () => {
  showTaskLaunchModal.value = false;
  resetTaskLaunchForm();
};

const submitTaskLaunch = async () => {
  if (!selectedProcessPanel.value || !canSubmitTaskLaunch.value) {
    return;
  }
  taskLaunchSubmitting.value = true;
  taskLaunchError.value = '';
  try {
    const payload = {
      description: taskLaunchForm.value.description || null
    };
    if (taskLaunchUseCustomTerm.value) {
      payload.custom_term = {
        name: taskLaunchForm.value.custom_name,
        start_date: taskLaunchForm.value.custom_start_date,
        end_date: taskLaunchForm.value.custom_end_date
      };
    } else {
      payload.term_id = Number(taskLaunchForm.value.term_id);
    }

    await processPanelService.createTask(
      currentUserId.value,
      selectedProcessPanel.value.definition.id,
      payload
    );

    processActionMessage.value = {
      type: 'success',
      text: 'La tarea manual se creó correctamente para esta definición.'
    };
    closeTaskLaunchModal();
    await loadSelectedProcessPanel({
      process_definition_id: selectedProcessPanel.value.definition.id
    });
  } catch (error) {
    console.error('Error al crear la tarea manual:', error);
    taskLaunchError.value = error?.response?.data?.message || 'No se pudo crear la tarea manual.';
  } finally {
    taskLaunchSubmitting.value = false;
  }
};

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
  if (showNavMenu.value) {
    showNavMenu.value = false;
  }
  showNotify.value = !showNotify.value;
};

const toggleNavMenu = () => {
  if (showNotify.value) {
    showNotify.value = false;
  }
  showNavMenu.value = !showNavMenu.value;
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
  gap: 0.52rem;
  overflow-x: auto;
  padding: 0.12rem 0.2rem;
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
  display: inline-flex;
  align-items: center;
  gap: 0.58rem;
  min-width: 198px;
  padding: 0.46rem 0.72rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: rgba(255, 255, 255, 0.94);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
  flex-shrink: 0;
}

.group-item:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.2);
}

.group-item.active {
  background: rgba(255, 255, 255, 0.96);
  color: var(--brand-primary);
  box-shadow: 0 10px 20px rgba(var(--brand-primary-rgb), 0.26);
}

.group-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.18);
  border: none;
  font-size: 1rem;
  flex: 0 0 auto;
}

.group-item.active .group-icon {
  background: rgba(var(--color-puce-light-rgb), 0.12);
}

.group-content {
  min-width: 0;
  display: block;
}

.group-title {
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.2;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.process-console-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.process-console-hero {
  display: flex;
  justify-content: space-between;
  gap: 1.4rem;
  padding: 2rem;
  border-radius: 24px;
  background:
    linear-gradient(140deg, rgba(var(--brand-primary-rgb), 0.97), rgba(var(--brand-accent-rgb), 0.86)),
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.18), transparent 36%);
  color: var(--brand-white);
  box-shadow: 0 24px 50px rgba(var(--brand-primary-rgb), 0.2);
}

.process-console-hero-main {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.process-console-kicker {
  font-size: 0.92rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.78;
  font-weight: 700;
}

.process-console-hero h1 {
  font-size: 2.2rem;
  margin: 0;
}

.process-console-hero p {
  margin: 0;
  max-width: 760px;
  opacity: 0.94;
  font-size: 1.02rem;
  line-height: 1.65;
}

.process-console-hero-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-end;
  justify-content: flex-start;
}

.process-console-badges,
.task-meta-line,
.task-inline-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.console-pill,
.console-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.42rem 0.9rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.16);
  color: inherit;
}

.console-pill--accent,
.console-chip--accent {
  background: rgba(var(--color-puce-light-rgb), 0.22);
}

.console-feedback-card {
  background: rgba(var(--brand-primary-rgb), 0.08);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.18);
  color: var(--brand-navy);
  border-radius: 16px;
  padding: 1rem 1.1rem;
  font-weight: 600;
  font-size: 0.98rem;
}

.console-feedback-card--error {
  background: rgba(220, 53, 69, 0.08);
  border-color: rgba(220, 53, 69, 0.2);
  color: #9a2330;
}

.console-feedback-card--success {
  background: rgba(25, 135, 84, 0.08);
  border-color: rgba(25, 135, 84, 0.2);
  color: #1f6a47;
}

.process-summary-grid,
.process-console-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1.1rem;
}

.process-summary-card,
.console-card {
  grid-column: span 3;
  background: var(--brand-white);
  border-radius: 20px;
  padding: 1.35rem 1.4rem;
  border: 1px solid rgba(var(--brand-primary-rgb), 0.08);
  box-shadow: 0 14px 30px rgba(28, 43, 61, 0.06);
}

.process-summary-card header,
.console-card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.process-summary-card header strong {
  font-size: 1.65rem;
  color: var(--brand-navy);
}

.process-summary-card p,
.console-card-header p {
  margin: 0.6rem 0 0;
  color: #5c6b7a;
  font-size: 1rem;
  line-height: 1.55;
}

.process-summary-card header span {
  font-size: 0.98rem;
  font-weight: 700;
  color: #44566b;
}

.console-card {
  grid-column: span 4;
}

.console-card--span-2 {
  grid-column: span 8;
}

.console-card--wide {
  grid-column: span 8;
}

.console-card--full {
  grid-column: 1 / -1;
}

.console-card h2,
.console-card h3 {
  margin: 0;
  font-size: 1.28rem;
  color: var(--brand-navy);
}

.console-empty {
  border: 1px dashed rgba(var(--brand-primary-rgb), 0.18);
  border-radius: 14px;
  padding: 1rem 1.05rem;
  color: #708295;
  background: rgba(var(--brand-primary-rgb), 0.03);
  font-size: 0.98rem;
  line-height: 1.55;
}

.console-empty--inline {
  padding: 0.7rem 0.8rem;
}

.task-stack,
.simple-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.task-card,
.simple-list-item {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.12);
  border-radius: 18px;
  padding: 1.05rem 1.1rem;
  background: rgba(var(--brand-primary-rgb), 0.02);
}

.task-card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.task-card-header h3 {
  margin: 0;
  font-size: 1.14rem;
}

.task-card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: #607285;
  text-align: right;
  font-size: 0.96rem;
}

.task-description {
  margin: 0.9rem 0 0;
  color: #4b5c6f;
  font-size: 0.98rem;
  line-height: 1.6;
}

.task-inline-stats {
  margin-top: 0.8rem;
  color: #5e7185;
  font-size: 0.95rem;
  line-height: 1.5;
}

.task-items-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.task-item-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 16px;
  background: #f5f8fd;
}

.task-item-main {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.task-item-main strong,
.simple-list-item strong {
  display: block;
  font-size: 1.04rem;
  line-height: 1.45;
  font-weight: 800;
  color: var(--brand-navy);
}

.task-item-meta,
.dependency-inline-meta {
  color: #64768a;
  font-size: 0.92rem;
  line-height: 1.45;
}

.task-item-doc {
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;
  text-align: right;
  color: #5c7086;
  font-size: 0.92rem;
  line-height: 1.45;
}

.simple-list-item {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.96rem;
}

.simple-list-item--stacked {
  align-items: flex-start;
  flex-direction: column;
}

.dependencies-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.dependency-block {
  padding: 1.1rem;
  border-radius: 18px;
  background: rgba(var(--brand-primary-rgb), 0.03);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.1);
}

.dependency-block h3 {
  font-size: 1.08rem;
}

.dependency-list {
  margin: 0.85rem 0 0;
  padding-left: 1rem;
  color: #55677b;
  font-size: 0.98rem;
  line-height: 1.6;
}

.dependency-list li + li {
  margin-top: 0.45rem;
}

.floating-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(11, 28, 45, 0.46);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.floating-dialog {
  width: min(52rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow: auto;
  background: var(--brand-white);
  border-radius: 24px;
  box-shadow: 0 36px 70px rgba(15, 32, 52, 0.24);
}

.floating-dialog-header,
.floating-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
}

.floating-dialog-header {
  border-bottom: 1px solid rgba(var(--brand-primary-rgb), 0.08);
}

.floating-dialog-header h2 {
  margin: 0;
  font-size: 1.35rem;
}

.floating-dialog-header p {
  margin: 0.2rem 0 0;
  color: #63778a;
  font-size: 0.98rem;
}

.floating-dialog-body {
  padding: 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-close-btn {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  border: none;
  background: rgba(var(--brand-primary-rgb), 0.08);
  color: var(--brand-navy);
  font-size: 1.25rem;
  line-height: 1;
}

.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.dialog-field span {
  font-weight: 700;
  color: var(--brand-navy);
  font-size: 0.96rem;
}

.dialog-field--full {
  grid-column: 1 / -1;
}

.dialog-field--switch {
  justify-content: flex-end;
}

.dialog-field--switch input {
  width: 1.1rem;
  height: 1.1rem;
}

.process-console-hero .primary-btn,
.process-console-hero .secondary-btn,
.console-card .tiny-btn,
.floating-dialog-footer .primary-btn,
.floating-dialog-footer .secondary-btn {
  min-height: 2.75rem;
  padding: 0.7rem 1.2rem;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 700;
}

.process-console-hero .primary-btn,
.console-card .tiny-btn,
.floating-dialog-footer .primary-btn {
  background: linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.96), rgba(var(--brand-accent-rgb), 0.88));
  box-shadow: 0 12px 24px rgba(var(--brand-primary-rgb), 0.16);
}

.process-console-hero .secondary-btn,
.process-console-hero .secondary-btn {
  background: rgba(255, 255, 255, 0.14);
  color: var(--brand-white);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.console-card .tiny-btn {
  color: var(--brand-navy);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.08);
}

.floating-dialog-footer .secondary-btn {
  background: rgba(var(--brand-primary-rgb), 0.08);
  color: var(--brand-navy);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.1);
}

@media (max-width: 960px) {
  .overview-card {
    flex-direction: column;
  }

  .process-console-hero,
  .task-card-header,
  .task-item-row,
  .simple-list-item,
  .floating-dialog-header,
  .floating-dialog-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .process-summary-card,
  .console-card,
  .console-card--wide,
  .console-card--full,
  .console-card--span-2 {
    grid-column: span 12;
  }

  .dependencies-grid,
  .dialog-grid {
    grid-template-columns: 1fr;
  }

  .task-item-doc {
    align-items: flex-start;
    text-align: left;
    min-width: 0;
  }
}
</style>
