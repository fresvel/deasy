<template>
  <div class="min-h-[100vh] bg-slate-100 font-sans flex flex-col">
    <app-workspace-header :menu-open="showMenu" current-section="dashboard" @menu-toggle="handleHeaderToggle" @notify="toggleNotify" @sign="navigateTo('firmar')">
        <div v-if="unitGroups.length" class="flex items-stretch gap-2 overflow-x-auto p-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
          <AppButton
            variant="plain"
            class-name="deasy-nav-chip min-w-[44px] sm:min-w-[100px] lg:min-w-[198px] group"
            :class="selectedGroupId === null ? 'deasy-nav-chip--active' : 'deasy-nav-chip--idle'"
            type="button"
            @click="selectConsolidated"
          >
            <span class="deasy-nav-chip__icon" :class="selectedGroupId === null ? 'deasy-nav-chip__icon--active' : 'deasy-nav-chip__icon--idle'">
              <IconGlobe class="w-5 h-5" />
            </span>
            <div class="min-w-0 hidden lg:block flex-1">
              <div class="text-sm font-semibold leading-tight inline-flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">Consolidado</div>
            </div>
          </AppButton>

          <AppButton
            v-for="group in unitGroups"
            :key="group.id"
            variant="plain"
            class-name="deasy-nav-chip min-w-[44px] sm:min-w-[100px] lg:min-w-[198px] group"
            :class="group.id === selectedGroupId ? 'deasy-nav-chip--active' : 'deasy-nav-chip--idle'"
            type="button"
            @click="selectGroup(group)"
          >
            <span class="deasy-nav-chip__icon" :class="group.id === selectedGroupId ? 'deasy-nav-chip__icon--active' : 'deasy-nav-chip__icon--idle'">
              <component :is="iconForUnitGroup(group)" class="w-5 h-5" />
            </span>
            <div class="min-w-0 hidden lg:block flex-1">
              <div class="text-sm font-semibold leading-tight inline-flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis" :title="group.name">
                {{ group.label || group.name }}
              </div>
            </div>
          </AppButton>
        </div>
        <span v-if="!userUnits.length && !menuLoading" class="text-white/50 text-sm font-medium">
          Sin unidades
        </span>
    </app-workspace-header>

    <div class="flex flex-col xl:flex-row w-full flex-1 max-w-[2560px] mx-auto items-stretch">
      <app-workspace-sidebar :show="showMenu" :photo="userPhoto" :username="userFullName" @close-mobile="showMenu = false">
        <div class="deasy-nav-group">
          <div class="deasy-nav-meta mt-3 mb-2">
            {{ menuContextLabel }}
          </div>

          <div v-if="menuLoading" class="deasy-nav-feedback deasy-nav-feedback--info my-2">
            Cargando menú...
          </div>
          <div v-else-if="menuError" class="deasy-nav-feedback deasy-nav-feedback--info my-2">
            {{ menuError }}
          </div>
          <div v-else-if="!menuCargos.length" class="deasy-nav-feedback deasy-nav-feedback--muted my-2">
            No hay cargos asignados para mostrar.
          </div>

          <div v-else class="deasy-nav-group mt-2">
            <div v-for="cargo in menuCargos" :key="cargo.id" class="deasy-nav-shell">
              <AppButton
                variant="plain"
                class-name="deasy-nav-group-title"
                :class="{ 'deasy-nav-item--subtle-active': cargo.open }"
                type="button"
                @click="toggleCargo(cargo)"
              >
                <span class="flex items-center gap-3 text-sm font-semibold">
                  <component :is="iconForCargo(cargo.name)" class="w-5 h-5 shrink-0 opacity-90" />
                  <span class="truncate">{{ cargo.name }}</span>
                </span>
              </AppButton>

              <div v-show="cargo.open" class="deasy-nav-tree">
                <AppButton
                  v-for="process in cargo.processes"
                  :key="process.id"
                  variant="plain"
                  class-name="deasy-nav-item"
                  :class="selectedProcessKey === String(process.process_definition_id) ? 'deasy-nav-item--active' : ''"
                  type="button"
                  @click="handleProcessSelect(process, cargo)"
                >
                  <component :is="iconForProcess(process.name)" class="w-4 h-4 shrink-0" />
                  <span class="truncate block w-full">{{ process.name }}</span>
                  <span
                    v-if="process.access_source === 'flow'"
                    class="ml-auto inline-flex items-center rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white/90 shrink-0"
                  >
                    Derivado
                  </span>
                </AppButton>
                <div v-if="!cargo.processes.length" class="text-sm text-white/50 italic px-3 py-1">
                  Sin procesos asignados.
                </div>
              </div>
            </div>
          </div>
        </div>
      </app-workspace-sidebar>

      <s-body :showmenu="showMenu" :shownotify="showNotify">
        <template v-if="isSigningView">
        <section class="p-6">
          <FirmarPdf />
        </section>
        </template>
        <template v-else-if="!selectedProcessKey && !processPanelLoading">
        <section class="bg-sky-700 bg-gradient-to-br from-sky-800 via-sky-700 to-sky-600 text-white rounded-[1.5rem] p-6 md:p-8 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 md:gap-8 shadow-2xl shadow-slate-300/50 relative overflow-hidden">
          <div class="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
            <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white blur-3xl opacity-50"></div>
            <div class="absolute top-1/2 right-0 w-64 h-64 rounded-full bg-sky-300 blur-3xl opacity-40"></div>
            <div class="absolute -bottom-24 -left-12 w-80 h-80 rounded-full bg-sky-900 blur-3xl opacity-50"></div>
          </div>
          <div class="relative z-10 flex-1">
            <h1 class="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Bienvenido(a), {{ userFullName }}</h1>
            <p class="max-w-2xl text-sky-100/90 text-sm md:text-base font-medium">
              Este es tu panel general. Revisa el estado de tus módulos, firmas pendientes y completa tu perfil académico.
            </p>
          </div>
          <AppButton variant="secondary" size="md" class-name="relative z-10 whitespace-nowrap" @click="navigateTo('perfil')">
            Ir a mi perfil
          </AppButton>
        </section>

        <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-3 min-h-[160px]" v-for="card in summaryCards" :key="card.title">
            <header class="flex justify-between items-start gap-4">
              <h3 class="text-base font-bold text-slate-800 leading-tight">{{ card.title }}</h3>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm whitespace-nowrap shrink-0" :class="getStatusTailwindClass(card.statusClass)">{{ card.status }}</span>
            </header>
            <p class="text-slate-500 text-xs md:text-sm font-medium flex-1 m-0">{{ card.description }}</p>
            <footer class="flex justify-between items-center mt-1">
              <span class="font-extrabold text-slate-800 leading-none">{{ card.count }}</span>
              <AppButton variant="softPrimary" size="sm" class-name="group border-0 bg-transparent p-0 shadow-none hover:bg-transparent" @click="navigateTo(card.route)">
                {{ card.action }} <IconArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </AppButton>
            </footer>
          </article>
        </section>

        <section class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 overflow-hidden mb-6">
          <header class="flex items-center justify-between gap-4 mb-5">
            <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Resumen rápido</h2>
            <AppButton variant="secondary" size="md" class-name="hidden sm:inline-flex" @click="navigateTo('perfil')">
              Gestionar perfil
            </AppButton>
          </header>

          <!-- Vista móvil: Tarjetas -->
          <div class="flex flex-col gap-3 sm:hidden">
            <div v-for="row in summaryRows" :key="'mob-' + row.section" class="bg-white border border-slate-100 rounded-[1rem] p-4 shadow-sm flex flex-col gap-3">
              <div class="flex justify-between items-start gap-2">
                <div class="flex flex-col gap-0.5">
                  <span class="font-bold text-slate-800 text-sm leading-tight">{{ row.section }}</span>
                  <span class="text-slate-500 font-medium text-xs">{{ row.count }} registros</span>
                </div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm shrink-0" :class="getStatusTailwindClass(row.statusClass)">{{ row.status }}</span>
              </div>
              <AppButton variant="softPrimary" size="sm" class-name="mt-1 w-full" @click="navigateTo(row.route)">
                Gestionar sección
              </AppButton>
            </div>
            <AppButton variant="secondary" size="md" class-name="mt-2 w-full" @click="navigateTo('perfil')">
              Gestionar perfil completo
            </AppButton>
          </div>

          <!-- Vista desktop: Tabla -->
          <AppDataTable
            class="hidden sm:block"
            responsive-class="deasy-table-responsive hidden sm:block"
            :fields="summaryTableFields"
            :rows="summaryRows"
            :row-key="(row) => `desk-${row.section}`"
            empty-text="No hay secciones disponibles."
            actions-label="ACCIÓN"
          >
            <template #cell="{ row, field }">
              <template v-if="field.name === 'status'">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm" :class="getStatusTailwindClass(row.statusClass)">
                  {{ row.status }}
                </span>
              </template>
              <template v-else>
                {{ row[field.name] }}
              </template>
            </template>
            <template #actions="{ row }">
              <div class="text-right">
                <AppButton variant="softPrimary" size="sm" @click="navigateTo(row.route)">
                  Gestionar
                </AppButton>
              </div>
            </template>
          </AppDataTable>
        </section>
        </template>

        <template v-else>
          <section class="flex flex-col gap-8">
            <section class="bg-gradient-to-br from-sky-800 via-sky-700 to-sky-600 p-6 md:p-8 rounded-[1.5rem] text-white shadow-2xl shadow-sky-900/20 flex flex-col md:flex-row justify-between gap-5 md:gap-7 relative overflow-hidden">
               <div class="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                  <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white blur-3xl opacity-50"></div>
                  <div class="absolute top-1/2 right-0 w-64 h-64 rounded-full bg-sky-300 blur-3xl opacity-40"></div>
                  <div class="absolute -bottom-24 -left-12 w-80 h-80 rounded-full bg-sky-900 blur-3xl opacity-50"></div>
              </div>
              <div class="flex flex-col gap-3 relative z-10">
                <div class="text-sky-200 text-sm uppercase tracking-widest font-bold">
                  {{ selectedProcessPanel?.definition?.process_name || selectedProcessContext?.name || 'Proceso' }}
                </div>
                <h1 class="text-2xl md:text-3xl font-bold leading-tight m-0">{{ selectedProcessPanel?.definition?.name || selectedProcessContext?.name || 'Definición de proceso' }}</h1>
                <p class="max-w-3xl opacity-90 text-sm md:text-base font-medium m-0 mt-1">
                  Gestiona solo tus tareas y entregables de esta definición activa. Desde aquí puedes revisar dependencias,
                  documentos, firmas y lanzar tareas manuales cuando el flujo lo permita.
                </p>
              </div>
              <div class="flex flex-col sm:flex-row md:flex-col gap-3 items-start md:items-end justify-start relative z-10 shrink-0">
                <AppButton variant="secondary" size="md" class-name="w-full sm:w-auto" type="button" @click="clearSelectedProcess">
                  Volver al panel general
                </AppButton>
                <AppButton
                  variant="primary"
                  size="md"
                  class-name="w-full sm:w-auto"
                  type="button"
                  :disabled="!selectedProcessPanel?.permissions?.can_launch_manual"
                  @click="openTaskLaunchModal"
                >
                  Crear tarea
                </AppButton>
              </div>
            </section>

            <section v-if="processPanelLoading" class="bg-sky-50 border border-sky-100 text-sky-800 rounded-2xl p-5 font-semibold text-sm animate-pulse">
              Cargando la definición seleccionada...
            </section>

            <section v-else-if="processPanelError" class="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl p-5 shadow-sm">
              {{ processPanelError }}
            </section>

            <template v-else>
              <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 border border-slate-100 flex flex-col gap-1 text-sm">
                  <header class="flex justify-between items-center whitespace-nowrap gap-2"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Tareas</span><strong class="text-2xl md:text-3xl font-extrabold text-sky-800 leading-none">{{ selectedProcessPanel.summary.tasks_total }}</strong></header>
                  <p class="text-xs font-medium text-slate-500 mt-1 leading-snug">Pendientes o en curso.</p>
                </article>
                <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 border border-slate-100 flex flex-col gap-1 text-sm">
                  <header class="flex justify-between items-center whitespace-nowrap gap-2"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Entregables</span><strong class="text-2xl md:text-3xl font-extrabold text-sky-800 leading-none">{{ selectedProcessPanel.summary.task_items_pending }}</strong></header>
                  <p class="text-xs font-medium text-slate-500 mt-1 leading-snug">Pendientes de tus tareas.</p>
                </article>
                <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 border border-slate-100 flex flex-col gap-1 text-sm">
                  <header class="flex justify-between items-center whitespace-nowrap gap-2"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Documentos</span><strong class="text-2xl md:text-3xl font-extrabold text-sky-800 leading-none">{{ selectedProcessPanel.summary.documents_total }}</strong></header>
                  <p class="text-xs font-medium text-slate-500 mt-1 leading-snug">Ligados a entregables.</p>
                </article>
                <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 border border-slate-100 flex flex-col gap-1 text-sm">
                  <header class="flex justify-between items-center whitespace-nowrap gap-2"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Llenado</span><strong class="text-2xl md:text-3xl font-extrabold text-sky-800 leading-none">{{ selectedProcessPanel.summary.fill_requests_pending || 0 }}</strong></header>
                  <p class="text-xs font-medium text-slate-500 mt-1 leading-snug">Solicitudes pendientes.</p>
                </article>
                <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 border border-slate-100 flex flex-col gap-1 text-sm">
                  <header class="flex justify-between items-center whitespace-nowrap gap-2"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Firmas</span><strong class="text-2xl md:text-3xl font-extrabold text-sky-800 leading-none">{{ selectedProcessPanel.summary.signatures_pending }}</strong></header>
                  <p class="text-xs font-medium text-slate-500 mt-1 leading-snug">Solicitudes pendientes.</p>
                </article>
              </section>

              <section v-if="processActionMessage" class="rounded-2xl p-5 font-bold text-sm shadow-sm" :class="processActionMessage.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'">
                {{ processActionMessage.text }}
              </section>

              <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Tareas -->
                <article class="lg:col-span-8 bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                  <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Tareas asignadas</h2>
                      <p class="text-slate-500 text-sm mt-1 mb-0 font-medium">Solo se muestran las tareas donde participas o que creaste manualmente.</p>
                    </div>
                    <AppButton
                      variant="primary"
                      size="md"
                      class-name="shrink-0"
                      type="button"
                      :disabled="!selectedProcessPanel?.permissions?.can_launch_manual"
                      @click="openTaskLaunchModal"
                    >
                      Crear tarea
                    </AppButton>
                  </header>

                  <div v-if="!selectedProcessPanel.tasks.length" class="border-2 border-dashed border-slate-200 rounded-[1.5rem] p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    No tienes tareas activas o históricas para esta definición.
                  </div>

                  <div v-else class="flex flex-col gap-4">
                    <article v-for="task in selectedProcessPanel.tasks" :key="task.id" class="border border-slate-200 rounded-[1.5rem] p-5 lg:p-6 bg-slate-50/30">
                      <header class="flex flex-col sm:flex-row justify-between gap-4 items-start mb-3">
                        <div class="flex flex-col gap-2">
                          <h3 class="text-base font-bold text-slate-800 m-0 leading-tight">{{ task.term_name }}</h3>
                          <div class="flex flex-wrap gap-2">
                            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200/70 text-slate-700">{{ task.term_type_name }}</span>
                            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold" :class="task.launch_mode === 'manual' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200/70 text-slate-700'">
                              {{ task.launch_mode === 'manual' ? 'Manual' : 'Automática' }}
                            </span>
                            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200/70 text-slate-700">{{ task.status }}</span>
                          </div>
                        </div>
                        <div class="flex flex-col gap-1 text-slate-500 text-sm font-semibold sm:text-right shrink-0">
                          <span>{{ formatDate(task.start_date) }}</span>
                          <span v-if="task.end_date">hasta {{ formatDate(task.end_date) }}</span>
                        </div>
                      </header>

                      <p v-if="task.description" class="text-slate-600 text-sm mt-3 mb-0 font-medium leading-relaxed">{{ task.description }}</p>

                      <div class="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-sm font-semibold text-slate-500">
                        <span>• {{ task.task_item_count }} entregables</span>
                        <span>• {{ task.pending_task_items }} pendientes</span>
                        <span v-if="task.responsible_position_title">• Responsable general: {{ task.responsible_position_title }}</span>
                        <span v-if="task.is_current_user_creator" class="text-sky-600">• Creada por ti</span>
                      </div>

                      <div v-if="task.items.length" class="flex flex-col gap-2.5 mt-5">
                        <div v-for="item in task.items" :key="item.id" class="flex flex-col gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-sky-200 transition-colors">
                          <div class="flex flex-col sm:flex-row justify-between gap-3">
                            <div class="flex flex-col gap-1.5 flex-1 min-w-0">
                              <strong class="block text-[0.95rem] font-bold text-slate-800 leading-tight">{{ item.template_artifact_name || `Entregable #${item.id}` }}</strong>
                              <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 mt-1">
                                <span>{{ item.template_usage_role }}</span>
                                <span class="text-slate-400">|</span>
                                <span :class="item.status === 'completado' ? 'text-emerald-600' : 'text-amber-600'">{{ item.status }}</span>
                                <template v-if="item.responsible_position_title">
                                  <span class="text-slate-400">|</span>
                                  <span>Responsable: {{ item.responsible_position_title }}</span>
                                </template>
                              </div>
                              <div class="flex flex-wrap gap-2 mt-2 text-[11px] font-bold">
                                <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                                  {{ item.document_id ? (item.document_status || 'Documento creado') : 'Sin documento generado' }}
                                </span>
                                <span
                                  class="px-2 py-1 rounded-md"
                                  :class="getDeliverableAccessSource(item) === 'Derivado'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-emerald-50 text-emerald-700'"
                                >
                                  {{ getDeliverableAccessSource(item) }}
                                </span>
                                <span v-if="item.pending_fill_count" class="bg-sky-50 text-sky-700 px-2 py-1 rounded-md">
                                  Llenado pendiente: {{ item.pending_fill_count }}
                                </span>
                                <span v-if="item.pending_signature_count" class="bg-amber-50 text-amber-700 px-2 py-1 rounded-md">
                                  Firmas pendientes: {{ item.pending_signature_count }}
                                </span>
                              </div>
                            </div>
                            <div class="flex flex-col gap-1.5 sm:items-end text-sm font-semibold text-slate-500 shrink-0">
                              <span class="inline-flex items-center gap-1.5" :class="item.document_id ? 'text-sky-700' : 'text-slate-400'">
                                <IconSignature v-if="item.document_id" class="w-4 h-4" />
                                {{ item.document_id ? (item.document_version ? `Doc v${item.document_version}` : 'Doc creado') : 'Sin doc' }}
                              </span>
                              <span v-if="item.workflow?.current_fill_step_order" class="text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md text-xs">
                                Paso de llenado: {{ item.workflow.current_fill_step_order }}
                              </span>
                              <span v-if="item.workflow?.current_signature_step_order" class="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-xs">
                                Paso de firma: {{ item.workflow.current_signature_step_order }}
                              </span>
                            </div>
                          </div>
                          <div class="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                            <AppButton
                              v-if="shouldShowStartDeliverable(item)"
                              variant="softPrimary"
                              size="sm"
                              type="button"
                              :disabled="processingFillItemId === item.id"
                              @click="startDeliverableFlow(item)"
                            >
                              {{ processingFillItemId === item.id ? 'Iniciando...' : 'Iniciar' }}
                            </AppButton>
                            <AppButton
                              v-if="shouldShowUploadDeliverable(item)"
                              variant="softNeutral"
                              size="sm"
                              :class="item.actions?.can_upload_deliverable && !isUploadingDeliverable ? '' : 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed'"
                              type="button"
                              :disabled="!item.actions?.can_upload_deliverable || isUploadingDeliverable"
                              @click="handleDeliverableFutureAction('upload_deliverable', item)"
                            >
                              {{ isUploadingDeliverable ? 'Subiendo archivo...' : getUploadActionLabel(item) }}
                            </AppButton>
                            <AppButton
                              v-if="getDeliverableSubject(item).preloadFilePath"
                              variant="softNeutral"
                              size="sm"
                              type="button"
                              @click="previewDeliverableFile(item)"
                            >
                              Ver archivo
                            </AppButton>
                            <AppButton
                              v-if="getDeliverableSubject(item).preloadFilePath"
                              variant="softNeutral"
                              size="sm"
                              type="button"
                              @click="downloadDeliverableFile(item)"
                            >
                              Descargar archivo
                            </AppButton>
                            <AppButton
                              v-if="shouldShowTemplateDownload(item)"
                              variant="softNeutral"
                              size="sm"
                              :class="item.actions?.can_download_template ? '' : 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed'"
                              type="button"
                              :disabled="!item.actions?.can_download_template"
                              @click="handleDeliverableFutureAction('download_template', item)"
                            >
                              Descargar plantilla
                            </AppButton>
                            <AppButton
                              v-if="shouldShowManageFill(item)"
                              variant="softPrimary"
                              size="sm"
                              :class="item.actions?.can_manage_fill && processingFillItemId !== item.id ? '' : 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed'"
                              type="button"
                              :disabled="!item.actions?.can_manage_fill || processingFillItemId === item.id"
                              @click="handleDeliverableFutureAction('manage_fill', item)"
                            >
                              {{ processingFillItemId === item.id ? 'Procesando llenado...' : 'Gestionar llenado' }}
                            </AppButton>
                            <AppButton
                              v-if="shouldShowSignatureFlow(item)"
                              variant="softNeutral"
                              size="sm"
                              :class="item.actions?.can_review_signature_flow ? '' : 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed'"
                              type="button"
                              :disabled="!item.actions?.can_review_signature_flow"
                              @click="handleDeliverableFutureAction('review_signature_flow', item)"
                            >
                              Flujo de firmas
                            </AppButton>
                            <AppButton
                              v-if="shouldShowSign(item)"
                              variant="softWarning"
                              size="sm"
                              :class="item.actions?.can_sign && item.actions?.implemented?.sign && getDeliverableSubject(item).preloadPdfPath ? '' : 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed'"
                              type="button"
                              :disabled="!(item.actions?.can_sign && item.actions?.implemented?.sign && getDeliverableSubject(item).preloadPdfPath)"
                              @click="openDocumentSignFlow(item)"
                            >
                              Firmar
                            </AppButton>
                            <span
                              v-if="shouldShowPdfRequiredHint(item)"
                              class="inline-flex items-center px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-500"
                            >
                              La firma requiere PDF
                            </span>
                            <AppButton
                              variant="softNeutral"
                              size="sm"
                              :class="item.actions?.can_open_process_chat ? 'border-dashed' : 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed'"
                              type="button"
                              :disabled="!item.actions?.can_open_process_chat"
                              @click="handleDeliverableFutureAction('process_chat', item)"
                            >
                              Chat del proceso
                            </AppButton>
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                </article>

                <div class="lg:col-span-4 flex flex-col gap-6">
                  <!-- Llenado -->
                  <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                    <header class="flex flex-col gap-4">
                      <div>
                        <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Flujo de llenado</h2>
                        <p class="text-slate-500 text-sm mt-1 mb-0 font-medium leading-snug">Solicitudes de llenado o revisión que te corresponden.</p>
                      </div>
                    </header>
                    <div v-if="!selectedProcessPanel.fill_requests?.length" class="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-slate-500 bg-slate-50 text-center text-sm font-medium">
                      No tienes solicitudes de llenado activas.
                    </div>
                    <div v-else class="flex flex-col gap-3">
                      <div v-for="fillRequest in selectedProcessPanel.fill_requests" :key="fillRequest.id" class="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100 relative overflow-hidden group">
                        <div v-if="!fillRequest.responded_at" class="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
                        <strong class="text-sm font-bold text-slate-800 leading-tight pl-1 block truncate">{{ fillRequest.template_artifact_name || 'Documento' }}</strong>
                        <div class="flex flex-wrap justify-between items-center gap-2 pl-1 mt-1 text-xs font-semibold">
                          <span class="text-slate-500">Paso {{ fillRequest.step_order || 1 }}</span>
                          <span :class="fillRequest.responded_at ? 'text-emerald-600' : 'text-sky-700'">{{ fillRequest.status_name || (fillRequest.responded_at ? 'Respondida' : 'Pendiente') }}</span>
                        </div>
                      </div>
                    </div>
                  </article>

                  <!-- Paquetes -->
                  <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                    <header class="flex flex-col gap-2">
                      <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Mis paquetes</h2>
                      <p class="text-slate-500 text-sm m-0 font-medium leading-snug">Paquetes de usuario asociados a tu cuenta.</p>
                    </header>
                    <div v-if="!selectedProcessPanel.user_packages.length" class="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-slate-500 bg-slate-50 text-center text-sm font-medium">
                      Aún no tienes paquetes registrados.
                    </div>
                    <div v-else class="flex flex-col gap-3">
                      <div v-for="item in selectedProcessPanel.user_packages" :key="item.id" class="flex justify-between items-center gap-3 p-3.5 rounded-xl bg-slate-50/50 border border-slate-100">
                        <strong class="text-sm font-bold text-slate-800 leading-tight">{{ item.display_name }}</strong>
                        <span class="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 shrink-0">{{ item.artifact_stage }}</span>
                      </div>
                    </div>
                  </article>

                  <!-- Firmas -->
                  <article class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                    <header class="flex flex-col gap-4">
                      <div>
                        <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Flujo de firmas</h2>
                        <p class="text-slate-500 text-sm mt-1 mb-0 font-medium leading-snug">Solicitudes de firma que te corresponden.</p>
                      </div>
                      <AppButton variant="secondary" size="md" class-name="self-start" type="button" @click="navigateTo('firmar')">
                        Ir a firmas
                      </AppButton>
                    </header>
                    <div v-if="!selectedProcessPanel.signatures.length" class="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-slate-500 bg-slate-50 text-center text-sm font-medium">
                      No tienes solicitudes de firma activas.
                    </div>
                    <div v-else class="flex flex-col gap-3">
                      <div v-for="signature in selectedProcessPanel.signatures" :key="signature.id" class="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50/50 border border-slate-100 relative overflow-hidden group">
                        <div v-if="!signature.responded_at" class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                        <strong class="text-sm font-bold text-slate-800 leading-tight pl-1 block truncate">{{ signature.template_artifact_name || 'Documento' }}</strong>
                        <div class="flex flex-wrap justify-between items-center gap-2 pl-1 mt-1 text-xs font-semibold">
                          <span class="text-slate-500">{{ signature.signature_type_name || 'Firma' }} · Paso {{ signature.step_order || 1 }}</span>
                          <span :class="signature.responded_at ? 'text-emerald-600' : 'text-amber-600'">{{ signature.status_name || (signature.responded_at ? 'Respondida' : 'Pendiente') }}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>

                <!-- Documentos (Wide) -->
                <article class="lg:col-span-8 bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                  <header class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
                    <div class="flex flex-col gap-2">
                      <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Documentos</h2>
                      <p class="text-slate-500 text-sm m-0 font-medium">Centro documental general de esta definición. Aquí luego podrás filtrar y consultar todos tus documentos.</p>
                    </div>
                    <AppButton
                      variant="secondary"
                      size="md"
                      class-name="self-start"
                      type="button"
                      @click="openDocumentCenter"
                    >
                      Abrir gestor documental
                    </AppButton>
                  </header>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div class="text-xs uppercase tracking-wider font-bold text-slate-500">Total</div>
                      <div class="mt-2 text-3xl font-extrabold text-slate-800 leading-none">{{ selectedProcessPanel.summary.documents_total }}</div>
                      <p class="mt-2 text-sm font-medium text-slate-500 m-0">Documentos generados para esta definición.</p>
                    </div>
                    <div class="rounded-2xl border border-slate-200 bg-sky-50/70 p-4">
                      <div class="text-xs uppercase tracking-wider font-bold text-sky-700">Pendientes de llenado</div>
                      <div class="mt-2 text-3xl font-extrabold text-sky-900 leading-none">{{ selectedProcessPanel.summary.fill_requests_pending }}</div>
                      <p class="mt-2 text-sm font-medium text-sky-800/80 m-0">Solicitudes de llenado o revisión activas en tu bandeja.</p>
                    </div>
                    <div class="rounded-2xl border border-slate-200 bg-amber-50/70 p-4">
                      <div class="text-xs uppercase tracking-wider font-bold text-amber-700">Pendientes de firma</div>
                      <div class="mt-2 text-3xl font-extrabold text-amber-900 leading-none">{{ selectedProcessPanel.summary.signatures_pending }}</div>
                      <p class="mt-2 text-sm font-medium text-amber-800/80 m-0">Solicitudes de firma visibles para tu usuario.</p>
                    </div>
                  </div>
                </article>

                <!-- Dependencies (Full width) -->
                <article class="lg:col-span-12 bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                  <header class="flex flex-col gap-2">
                    <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Dependencias de la definición</h2>
                    <p class="text-slate-500 text-sm m-0 font-medium">Resumen de reglas, disparadores y paquetes del sistema que hacen operativa esta definición.</p>
                  </header>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <section class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200">
                      <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><IconSquareCheck class="w-4 h-4 text-slate-400"/> Reglas</h3>
                      <div v-if="!selectedProcessPanel.dependencies.rules.length" class="text-sm text-slate-500 font-medium italic">
                        Sin reglas activas para tu alcance.
                      </div>
                      <ul v-else class="flex flex-col gap-2.5 m-0 p-0 list-none">
                        <li v-for="rule in selectedProcessPanel.dependencies.rules" :key="rule.id" class="text-sm font-medium text-slate-600 flex items-start gap-2">
                          <span class="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0"></span> {{ rule.display_label }}
                        </li>
                      </ul>
                    </section>
                    <section class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200">
                      <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><IconGlobe class="w-4 h-4 text-slate-400"/> Disparadores</h3>
                      <div v-if="!selectedProcessPanel.dependencies.triggers.length" class="text-sm text-slate-500 font-medium italic">
                        Sin disparadores activos.
                      </div>
                      <ul v-else class="flex flex-col gap-2.5 m-0 p-0 list-none">
                        <li v-for="trigger in selectedProcessPanel.dependencies.triggers" :key="trigger.id" class="text-sm font-medium text-slate-600 flex items-start gap-2">
                          <span class="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0"></span> {{ formatTriggerLabel(trigger) }}
                        </li>
                      </ul>
                    </section>
                    <section class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200">
                      <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><IconBuildingMonument class="w-4 h-4 text-slate-400"/> Paquetes</h3>
                      <div v-if="!selectedProcessPanel.dependencies.templates.length" class="text-sm text-slate-500 font-medium italic">
                        Sin paquetes vinculados.
                      </div>
                      <ul v-else class="flex flex-col gap-3 m-0 p-0 list-none">
                        <li v-for="template in selectedProcessPanel.dependencies.templates" :key="template.id" class="text-sm font-bold text-slate-700 flex flex-col gap-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span>{{ template.template_artifact_name }}</span>
                          <span class="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                            <span class="bg-slate-100 px-2 py-0.5 rounded">{{ template.usage_role }}</span>
                            <span :class="template.creates_task ? 'text-sky-600' : 'text-slate-400'">{{ template.creates_task ? 'Genera tarea' : 'Soporte' }}</span>
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

      <s-message :show="showNotify" @close="showNotify = false" />
      
      <s-nav-menu :show="showNavMenu" :is-admin="false" @close="showNavMenu = false" />
    </div>

    <div v-if="showTaskLaunchModal" class="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" @click.self="closeTaskLaunchModal">
      <div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <header class="px-6 lg:px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div>
            <h2 class="text-2xl font-bold text-slate-800 m-0 tracking-tight">Crear tarea manual</h2>
            <p class="text-slate-500 text-sm font-medium mt-1 mb-0">{{ selectedProcessPanel?.definition?.name || 'Definición seleccionada' }}</p>
          </div>
          <AppButton variant="close" class-name="bg-slate-200/50 hover:bg-slate-200" type="button" @click="closeTaskLaunchModal">
            <IconX class="w-5 h-5" />
          </AppButton>
        </header>

        <div class="p-6 lg:p-8 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
          <div v-if="taskLaunchError" class="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl p-5 shadow-sm">
            {{ taskLaunchError }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
            <label class="flex flex-col gap-2 md:col-span-2">
              <span class="font-bold text-slate-700 text-sm">Descripción</span>
              <textarea
                v-model="taskLaunchForm.description"
                class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium placeholder-slate-400 resize-none"
                rows="3"
                placeholder="Describe brevemente la tarea manual que vas a lanzar."
              />
            </label>

            <label class="flex flex-col gap-2">
              <span class="font-bold text-slate-700 text-sm">Periodo existente</span>
              <div class="relative">
                <select v-model="taskLaunchForm.term_id" class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium appearance-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="taskLaunchUseCustomTerm">
                  <option value="">Seleccionar</option>
                  <option v-for="term in selectedProcessPanel?.available_terms || []" :key="term.id" :value="String(term.id)">
                    {{ term.name }} · {{ term.term_type_name }}
                  </option>
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg fill="none" stroke="currentColor" class="h-4 w-4" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/></svg>
                </div>
              </div>
            </label>

            <label v-if="selectedProcessPanel?.permissions?.can_launch_custom_term" class="flex flex-row items-center justify-between md:justify-end gap-3 mt-1 md:mt-7 p-3 rounded-2xl border border-slate-100 bg-slate-50/50 cursor-pointer">
              <span class="font-bold text-slate-700 text-sm select-none">Crear periodo custom</span>
              <input v-model="taskLaunchUseCustomTerm" type="checkbox" class="w-5 h-5 rounded text-sky-600 focus:ring-sky-500 border-slate-300 transition-colors" />
            </label>

            <template v-if="taskLaunchUseCustomTerm">
              <label class="flex flex-col gap-2 md:col-span-2">
                <span class="font-bold text-slate-700 text-sm">Nombre del periodo custom</span>
                <input v-model="taskLaunchForm.custom_name" class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium placeholder-slate-400" type="text" placeholder="Ejemplo: Seguimiento extraordinario abril" />
              </label>
              <label class="flex flex-col gap-2">
                <span class="font-bold text-slate-700 text-sm">Fecha inicial</span>
                <input v-model="taskLaunchForm.custom_start_date" class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium" type="date" />
              </label>
              <label class="flex flex-col gap-2">
                <span class="font-bold text-slate-700 text-sm">Fecha final</span>
                <input v-model="taskLaunchForm.custom_end_date" class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium" type="date" />
              </label>
            </template>
          </div>
        </div>

        <footer class="px-6 lg:px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4 shrink-0">
          <AppButton variant="secondary" size="lg" type="button" :disabled="taskLaunchSubmitting" @click="closeTaskLaunchModal">
            Cancelar
          </AppButton>
          <AppButton variant="primary" size="lg" type="button" :disabled="!canSubmitTaskLaunch" @click="submitTaskLaunch">
            {{ taskLaunchSubmitting ? 'Creando tarea...' : 'Crear tarea' }}
          </AppButton>
        </footer>
      </div>
    </div>

    <AdminModalShell
      ref="documentSignModal"
      labelled-by="document-sign-modal-title"
      title="Firmar documento"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <FirmarPdf ref="embeddedSignerRef" embedded />
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="documentCenterModal"
      labelled-by="document-center-modal-title"
      title="Gestor documental"
      size="lg"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-4">
        <p class="text-sm text-slate-600 m-0">
          Este espacio quedará para la consulta general de documentos con filtros. Por ahora muestra un resumen básico de los documentos generados en esta definición.
        </p>
        <div v-if="!selectedProcessPanel?.documents?.length" class="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-slate-500 bg-slate-50 text-center text-sm font-medium">
          No hay documentos generados todavía.
        </div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="doc in selectedProcessPanel.documents"
            :key="`document-center-${doc.document_id}`"
            class="flex flex-col gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
          >
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <strong class="text-sm font-bold text-slate-800">{{ doc.template_artifact_name || `Documento #${doc.document_id}` }}</strong>
              <span class="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
                {{ doc.document_version ? `v${doc.document_version}` : `#${doc.document_version_id}` }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2 text-[11px] font-bold">
              <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{{ doc.document_status || 'Inicial' }}</span>
              <span v-if="doc.pending_fill_count" class="bg-sky-50 text-sky-700 px-2 py-1 rounded-md">Llenado pendiente: {{ doc.pending_fill_count }}</span>
              <span v-if="doc.pending_signature_count" class="bg-amber-50 text-amber-700 px-2 py-1 rounded-md">Firmas pendientes: {{ doc.pending_signature_count }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="fillWorkflowModal"
      labelled-by="fill-workflow-modal-title"
      title="Flujo de llenado"
      size="lg"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-5">
        <div v-if="fillWorkflowState.subject" class="flex flex-col gap-3">
          <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div class="flex flex-col gap-2">
              <strong class="text-base font-bold text-slate-800">{{ fillWorkflowState.subject.title }}</strong>
              <div class="flex flex-wrap gap-2 text-[11px] font-bold">
                <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                  Paso {{ fillWorkflowState.request?.step_order || 1 }}
                </span>
                <span class="bg-sky-50 text-sky-700 px-2 py-1 rounded-md">
                  Estado: {{ fillWorkflowState.request?.status_name || fillWorkflowState.request?.status || 'pending' }}
                </span>
                <span
                  class="px-2 py-1 rounded-md"
                  :class="fillWorkflowState.subject.preloadFilePath ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                >
                  {{ fillWorkflowState.subject.preloadFilePath ? `Archivo: ${getFileNameFromPath(fillWorkflowState.subject.preloadFilePath)}` : 'Sin archivo de trabajo' }}
                </span>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Secuencia del flujo</h3>
            <div v-if="!fillWorkflowState.subject?.workflow?.fill_steps?.length" class="text-sm text-slate-500">
              Este entregable todavía no tiene una secuencia de llenado visible.
            </div>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="step in fillWorkflowState.subject.workflow.fill_steps"
                :key="`fill-step-${step.id}-${step.request_id || 'na'}`"
                class="rounded-2xl border p-4"
                :class="getFillStepCardClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"
              >
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div class="flex flex-col gap-1">
                    <strong class="text-sm font-bold text-slate-800">Paso {{ step.step_order }}</strong>
                    <span class="text-sm font-semibold text-slate-600">{{ step.display_label }}</span>
                    <span class="text-xs font-medium text-slate-500">
                      {{ getFillStepResolverLabel(step) }}
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-2 text-[11px] font-bold">
                    <span class="px-2 py-1 rounded-md" :class="getFillStepStatusBadgeClass(step.request_status)">
                      {{ getFillStepStatusLabel(step.request_status) }}
                    </span>
                    <span
                      v-if="fillWorkflowState.subject.workflow.fill_flow?.current_step_order === step.step_order"
                      class="px-2 py-1 rounded-md bg-sky-100 text-sky-800"
                    >
                      Actual
                    </span>
                  </div>
                </div>
                <p v-if="step.response_note" class="mt-3 mb-0 text-xs font-medium text-slate-600">
                  Nota: {{ step.response_note }}
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Historial de notas operativas</h3>
            <div v-if="!fillWorkflowNotes.length" class="text-sm text-slate-500">
              Aún no existen notas operativas registradas en este flujo.
            </div>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="noteEntry in fillWorkflowNotes"
                :key="`fill-note-${noteEntry.stepId}-${noteEntry.requestId || noteEntry.stepOrder}`"
                class="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div class="flex flex-col gap-1">
                    <strong class="text-sm font-bold text-slate-800">
                      Paso {{ noteEntry.stepOrder }} · {{ noteEntry.label }}
                    </strong>
                    <span class="text-xs font-semibold text-slate-500">
                      {{ noteEntry.statusLabel }}
                    </span>
                  </div>
                  <span v-if="noteEntry.respondedAtLabel" class="text-xs font-medium text-slate-500">
                    {{ noteEntry.respondedAtLabel }}
                  </span>
                </div>
                <p class="mt-3 mb-0 text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {{ noteEntry.note }}
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Acciones disponibles</h3>
            <p
              v-if="fillWorkflowState.request && !canOperateCurrentFillRequest"
              class="mb-3 text-sm font-medium text-slate-600"
            >
              Este paso corresponde a otro responsable. Desde aquí solo puedes revisar el estado del flujo.
            </p>
            <div class="flex flex-wrap gap-2">
              <AppButton
                v-if="canReplaceFillFile"
                variant="softNeutral"
                size="sm"
                :class="isUploadingDeliverable ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="isUploadingDeliverable"
                @click="triggerFillWorkflowFileReplace"
              >
                {{ isUploadingDeliverable ? 'Subiendo archivo...' : getUploadActionLabel(fillWorkflowState.subject) }}
              </AppButton>
              <AppButton
                v-if="canApproveFillRequest"
                variant="softSuccess"
                size="sm"
                :class="fillWorkflowSubmitting ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="fillWorkflowSubmitting"
                @click="submitFillWorkflowAction('approve')"
              >
                {{ fillApproveActionLabel }}
              </AppButton>
              <AppButton
                v-if="canReturnFillRequest"
                variant="softWarning"
                size="sm"
                :class="fillWorkflowSubmitting ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="fillWorkflowSubmitting"
                @click="submitFillWorkflowAction('return')"
              >
                Devolver
              </AppButton>
              <AppButton
                v-if="canRejectFillRequest"
                variant="softDanger"
                size="sm"
                :class="fillWorkflowSubmitting ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="fillWorkflowSubmitting"
                @click="submitFillWorkflowAction('reject')"
              >
                Rechazar
              </AppButton>
              <AppButton
                v-if="canCancelFillRequest"
                variant="softNeutral"
                size="sm"
                :class="fillWorkflowSubmitting ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="fillWorkflowSubmitting"
                @click="submitFillWorkflowAction('cancel')"
              >
                Cancelar solicitud
              </AppButton>
            </div>
          </div>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-slate-700">Nota operativa</span>
            <textarea
              v-model="fillWorkflowState.note"
              rows="3"
              class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium placeholder-slate-400 resize-none"
              placeholder="Agrega una nota para esta acción."
            />
          </label>

          <div v-if="fillWorkflowState.error" class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {{ fillWorkflowState.error }}
          </div>
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverableOperationModal"
      labelled-by="deliverable-operation-modal-title"
      :title="deliverableOperationState.title"
      size="md"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-4">
        <div
          class="rounded-2xl px-4 py-3 text-sm font-semibold"
          :class="deliverableOperationState.type === 'error'
            ? 'bg-rose-50 border border-rose-200 text-rose-700'
            : deliverableOperationState.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-sky-50 border border-sky-200 text-sky-800'"
        >
          {{ deliverableOperationState.message }}
        </div>
        <p v-if="deliverableOperationState.detail" class="text-sm text-slate-600 m-0">
          {{ deliverableOperationState.detail }}
        </p>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverablePreviewModal"
      labelled-by="deliverable-preview-modal-title"
      :title="deliverablePreviewName || 'Vista previa del archivo'"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="min-h-[60vh]">
        <iframe
          v-if="deliverablePreviewUrl && deliverablePreviewIsPdf"
          :src="deliverablePreviewUrl"
          class="w-full min-h-[70vh] rounded-2xl border border-slate-200 bg-white"
          title="Vista previa del archivo"
        />
        <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          El archivo no se puede previsualizar en línea. Usa la opción de descarga.
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
        <AppButton variant="primary" @click="downloadPreviewedFile">
          Descargar archivo
        </AppButton>
      </template>
    </AdminModalShell>

    <input
      ref="deliverableUploadInput"
      type="file"
      accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      class="hidden"
      @change="handleDeliverableUploadSelected"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppWorkspaceHeader from '@/layouts/AppWorkspaceHeader.vue';
import AppWorkspaceSidebar from '@/layouts/AppWorkspaceSidebar.vue';
import SBody from '@/layouts/SBody.vue';
import SMessage from '@/layouts/SNotify.vue';
import SNavMenu from '@/layouts/SNavMenu.vue';
import AppDataTable from '@/components/AppDataTable.vue';
import FirmarPdf from '@/views/funciones/FirmarPdf.vue';
import UserMenuService from '@/services/logged/UserMenuService.js';
import ProcessDefinitionPanelService from '@/services/logged/ProcessDefinitionPanelService.js';
import { API_ROUTES } from '@/services/apiConfig';
import { Modal } from '@/utils/modalController';
import AdminModalShell from '@/views/admin/components/AdminModalShell.vue';
import AppButton from '@/components/AppButton.vue';

import {
  IconGlobe,
  IconLock,
  IconCertificate,
  IconIdBadge,
  IconMapPins,
  IconUser,
  IconCircleCheck,
  IconSquareCheck,
  IconSignature,
  IconX,
  IconArrowRight,
  IconBuildingMonument
} from '@tabler/icons-vue';

const router = useRouter();
const route = useRoute();
const menuService = new UserMenuService();
const processPanelService = new ProcessDefinitionPanelService();

const currentUser = ref(null);
const userPhoto = ref('/images/avatar.png');

const isClient = typeof window !== 'undefined';
let isDesktopStatus = isClient ? window.innerWidth >= 1280 : true; // xl en Tailwind es 1280px

const showMenu = ref(isClient ? window.innerWidth >= 1280 : true);
const showNotify = ref(false);
const showNavMenu = ref(false);

const handleResize = () => {
  if (!isClient) return;
  const isNowDesktop = window.innerWidth >= 1280;
  if (isDesktopStatus !== isNowDesktop) {
    isDesktopStatus = isNowDesktop;
    showMenu.value = isNowDesktop;
  }
};

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
const documentSignModal = ref(null);
const documentCenterModal = ref(null);
const fillWorkflowModal = ref(null);
const deliverableOperationModal = ref(null);
const deliverablePreviewModal = ref(null);
const embeddedSignerRef = ref(null);
const deliverableUploadInput = ref(null);
const pendingDeliverableUploadTarget = ref(null);
const isUploadingDeliverable = ref(false);
const processingFillItemId = ref(null);
const startedDeliverableIds = ref(new Set());
const fillWorkflowSubmitting = ref(false);
const deliverablePreviewUrl = ref('');
const deliverablePreviewName = ref('');
const deliverablePreviewPath = ref('');
const deliverablePreviewSource = ref(null);
const deliverablePreviewIsPdf = ref(false);
const deliverableOperationState = ref({
  title: 'Proceso del entregable',
  type: 'info',
  message: '',
  detail: ''
});
const fillWorkflowState = ref({
  subject: null,
  request: null,
  note: '',
  error: ''
});
let documentSignModalInstance = null;
let documentCenterModalInstance = null;
let fillWorkflowModalInstance = null;
let deliverableOperationModalInstance = null;
let deliverablePreviewModalInstance = null;
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

const isSigningView = computed(() => route.query?.view === 'firmar');

const summaryTableFields = [
  { name: 'section', label: 'Sección' },
  { name: 'count', label: 'Registros' },
  { name: 'status', label: 'Estado' }
];

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

const getStatusTailwindClass = (statusClass) => {
  if (statusClass === 'status--warning') return 'bg-amber-500';
  if (statusClass === 'status--danger') return 'bg-rose-500';
  if (statusClass === 'status--success') return 'bg-emerald-500';
  return 'bg-slate-500';
};

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
      (cargo.processes ?? []).forEach((process) => {
        const uniqueKey = Number(process.process_definition_id || process.id || 0);
        const existingIndex = target.processes.findIndex(
          (proc) => Number(proc.process_definition_id || proc.id || 0) === uniqueKey
        );
        if (existingIndex >= 0) {
          const existing = target.processes[existingIndex];
          if (existing.access_source !== 'process' && process.access_source === 'process') {
            target.processes.splice(existingIndex, 1, { ...existing, ...process });
          }
        } else {
          target.processes.push(process);
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
  if (normalized.includes('docen')) return IconCertificate;
  if (normalized.includes('coord')) return IconIdBadge;
  if (normalized.includes('admin')) return IconLock;
  return IconIdBadge;
};

const iconForProcess = (name = '') => {
  const normalized = name.toLowerCase();
  if (normalized.includes('firma')) return IconCircleCheck;
  if (normalized.includes('perfil')) return IconUser;
  if (normalized.includes('academ')) return IconCertificate;
  if (normalized.includes('unidad')) return IconGlobe;
  return IconSquareCheck;
};

const iconForUnitGroup = (group) => {
  const label = `${group?.label ?? ''} ${group?.name ?? ''}`.toLowerCase();
  if (label.includes('univers')) return IconGlobe;
  if (label.includes('facult')) return IconMapPins;
  if (label.includes('carrera')) return IconCertificate;
  if (label.includes('depart')) return IconIdBadge;
  return IconIdBadge;
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
    if (panel?.definition && process?.access_source) {
      panel.definition.access_source = process.access_source;
    }
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
  if (window.innerWidth < 1024) {
    showMenu.value = false;
  }
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
  
  if (isClient) {
    window.addEventListener('resize', handleResize);
  }

  if (documentSignModal.value?.el) {
    documentSignModalInstance = Modal.getOrCreateInstance(documentSignModal.value.el);
    documentSignModal.value.el.addEventListener('hidden.bs.modal', () => {
      embeddedSignerRef.value?.resetToStart?.();
    });
  }
  if (fillWorkflowModal.value?.el) {
    fillWorkflowModalInstance = Modal.getOrCreateInstance(fillWorkflowModal.value.el);
    fillWorkflowModal.value.el.addEventListener('hidden.bs.modal', () => {
      fillWorkflowState.value = {
        subject: null,
        request: null,
        note: '',
        error: ''
      };
    });
  }
  if (deliverablePreviewModal.value?.el) {
    deliverablePreviewModalInstance = Modal.getOrCreateInstance(deliverablePreviewModal.value.el);
    deliverablePreviewModal.value.el.addEventListener('hidden.bs.modal', () => {
      if (deliverablePreviewUrl.value) {
        URL.revokeObjectURL(deliverablePreviewUrl.value);
      }
      deliverablePreviewUrl.value = '';
      deliverablePreviewName.value = '';
      deliverablePreviewPath.value = '';
      deliverablePreviewSource.value = null;
      deliverablePreviewIsPdf.value = false;
    });
  }
  
  await loadUserMenu();
});

onBeforeUnmount(() => {
  if (isClient) {
    window.removeEventListener('resize', handleResize);
  }
  if (deliverablePreviewUrl.value) {
    URL.revokeObjectURL(deliverablePreviewUrl.value);
  }
  deliverablePreviewSource.value = null;
});

const navigateTo = (destination) => {
  switch (destination) {
    case 'dashboard':
      router.push('/dashboard');
      break;
    case 'firmar':
      router.push({ path: '/dashboard', query: { view: 'firmar' } });
      break;
    case 'perfil':
    default:
      router.push('/perfil');
      break;
  }
};

const setProcessActionInfo = (text, type = 'success') => {
  processActionMessage.value = { text, type };
};

const openDeliverableOperationModal = (payload = {}) => {
  deliverableOperationState.value = {
    title: payload.title || 'Proceso del entregable',
    type: payload.type || 'info',
    message: payload.message || '',
    detail: payload.detail || ''
  };
  deliverableOperationModalInstance = Modal.getOrCreateInstance(deliverableOperationModal.value?.el);
  deliverableOperationModalInstance?.show();
};

const openFillWorkflowModal = (payload = {}) => {
  const subject = getDeliverableSubject(payload);
  const request = getCurrentFillWorkflowRequest(payload);
  fillWorkflowState.value = {
    subject,
    request,
    note: '',
    error: ''
  };
  fillWorkflowModalInstance = Modal.getOrCreateInstance(fillWorkflowModal.value?.el);
  fillWorkflowModalInstance?.show();
};

const getDeliverableSubject = (payload = {}) => {
  const documentPayload = payload?.document || payload;
  const workingFilePath = documentPayload?.working_file_path || documentPayload?.workingFilePath || '';
  const finalFilePath = documentPayload?.final_file_path || documentPayload?.finalFilePath || '';
  const preloadFilePath = finalFilePath || workingFilePath;
  const preloadPdfPath = canPreviewInline(workingFilePath) ? workingFilePath : '';
  return {
    itemId: payload?.id || documentPayload?.task_item_id || null,
    documentId: documentPayload?.document_id || null,
    documentVersionId: documentPayload?.document_version_id || null,
    title: payload?.template_artifact_name || documentPayload?.template_artifact_name || `Entregable #${payload?.id || documentPayload?.document_id || 's/n'}`,
    actions: payload?.actions || documentPayload?.actions || {},
    workflow: payload?.workflow || documentPayload?.workflow || {},
    workingFilePath,
    finalFilePath,
    preloadFilePath,
    preloadPdfPath
  };
};

const getFileNameFromPath = (filePath = '') => filePath.split('/').pop() || 'archivo';

const getFileExtension = (filePath = '') => {
  const fileName = getFileNameFromPath(filePath);
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
};

const canPreviewInline = (filePath = '') => getFileExtension(filePath) === 'pdf';

const isPdfWorkingFile = (payload) => {
  const subject = getDeliverableSubject(payload);
  return canPreviewInline(subject.workingFilePath);
};

const subjectHasWorkingArtifact = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(subject.workingFilePath || subject.finalFilePath || subject.preloadFilePath);
};

const getCurrentFillStepCandidates = (payload) => {
  const subject = getDeliverableSubject(payload);
  const currentStepOrder = Number(subject.workflow?.fill_flow?.current_step_order || subject.workflow?.current_fill_step_order || 0);
  return (subject.workflow?.fill_steps || []).filter((item) => Number(item.step_order) === currentStepOrder);
};

const getCurrentFillWorkflowRequest = (payload) => {
  const subject = getDeliverableSubject(payload);
  const currentUser = Number(currentUserId.value || 0);
  const currentStepCandidates = getCurrentFillStepCandidates(payload);
  const unresolvedCurrentStepCandidates = currentStepCandidates.filter((item) => !item.responded_at);
  const preferredCurrentStepRequest =
    unresolvedCurrentStepCandidates.find((item) => Number(item.assigned_person_id || 0) === currentUser)
    || unresolvedCurrentStepCandidates.find((item) => Number(item.assigned_person_id || 0) > 0)
    || unresolvedCurrentStepCandidates.find((item) => item.is_manual)
    || currentStepCandidates.find((item) => Number(item.assigned_person_id || 0) === currentUser)
    || currentStepCandidates[0];

  return (
    preferredCurrentStepRequest
    || (subject.workflow?.fill_requests || []).find((item) => !item.responded_at && Number(item.assigned_person_id || 0) === currentUser)
    || (subject.workflow?.fill_requests || []).find((item) => !item.responded_at)
    || subject.workflow?.fill_steps?.[0]
    || subject.workflow?.fill_requests?.[0]
    || null
  );
};

const getFillRequestStatusCode = (request) =>
  String(request?.status_name || request?.status || request?.request_status || '').trim().toLowerCase();

const getFillRequestId = (request) => Number(request?.request_id || request?.id || 0) || null;

const isReviewLikeFillStep = (request) => {
  const resolverType = String(request?.resolver_type || '').trim().toLowerCase();
  return ['cargo_in_scope', 'position', 'specific_person'].includes(resolverType);
};

const getDeliverableAccessSource = (payload) => {
  const selectedAccessSource =
    String(selectedProcessPanel.value?.definition?.access_source || selectedProcessContext.value?.access_source || '')
      .trim()
      .toLowerCase();
  if (selectedAccessSource === 'flow') {
    return 'Derivado';
  }

  const subject = getDeliverableSubject(payload);
  const currentUser = Number(currentUserId.value || 0);
  const currentFillRequest = getCurrentFillWorkflowRequest(payload);
  const fillAssignedPersonId = Number(currentFillRequest?.assigned_person_id || 0);
  const fillResolverType = String(currentFillRequest?.resolver_type || '').trim().toLowerCase();

  if (fillAssignedPersonId > 0 && fillAssignedPersonId === currentUser) {
    if (['cargo_in_scope', 'position', 'specific_person', 'manual_pick'].includes(fillResolverType)) {
      return 'Derivado';
    }
    return 'Directo';
  }

  const currentUserPendingSignature = (subject.workflow?.signature_requests || []).some((request) => {
    const assignedPersonId = Number(request?.assigned_person_id || 0);
    return assignedPersonId === currentUser && !request.responded_at;
  });
  if (currentUserPendingSignature) {
    return 'Derivado';
  }

  return 'Directo';
};

const isFillRequestActionableByCurrentUser = (request) => {
  if (!request) return false;
  const currentUser = Number(currentUserId.value || 0);
  const assignedPersonId = Number(request.assigned_person_id || 0);
  if (assignedPersonId > 0) {
    return assignedPersonId === currentUser;
  }
  return Boolean(request.is_manual);
};

const currentUserCanOperateFillStep = (payload) => {
  const currentUser = Number(currentUserId.value || 0);
  const candidates = getCurrentFillStepCandidates(payload);
  return candidates.some((request) => {
    const assignedPersonId = Number(request?.assigned_person_id || 0);
    if (assignedPersonId > 0) {
      return assignedPersonId === currentUser;
    }
    return Boolean(request?.is_manual);
  });
};

const hasDeliverableBeenStarted = (payload) => {
  const subject = getDeliverableSubject(payload);
  if (subject.itemId && startedDeliverableIds.value.has(Number(subject.itemId))) return true;
  if (subjectHasWorkingArtifact(payload)) return true;
  const request = getCurrentFillWorkflowRequest(payload);
  const code = getFillRequestStatusCode(request);
  return ['in_progress', 'approved', 'returned', 'rejected', 'cancelled'].includes(code);
};

const shouldShowStartDeliverable = (payload) => {
  const subject = getDeliverableSubject(payload);
  if (subject.itemId && startedDeliverableIds.value.has(Number(subject.itemId))) return false;
  if (subjectHasWorkingArtifact(payload)) return false;
  const request = getCurrentFillWorkflowRequest(payload);
  const code = getFillRequestStatusCode(request);
  return Boolean(
    subject.documentId
    && code === 'pending'
    && currentUserCanOperateFillStep(payload)
    && !isReviewLikeFillStep(request)
  );
};

const shouldShowUploadDeliverable = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(
    subject.actions?.can_upload_deliverable
    && currentUserCanOperateFillStep(payload)
    && hasDeliverableBeenStarted(payload)
  );
};

const shouldShowTemplateDownload = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(subject.actions?.can_download_template && hasDeliverableBeenStarted(payload));
};

const shouldShowManageFill = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(subject.actions?.can_manage_fill && subject.preloadFilePath);
};

const shouldShowSignatureFlow = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(subject.actions?.can_review_signature_flow);
};

const shouldShowSign = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(subject.actions?.can_sign && subject.preloadPdfPath);
};

const shouldShowPdfRequiredHint = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(subject.preloadFilePath && !subject.preloadPdfPath);
};

const isReviewFillStep = computed(() => {
  const resolver = String(fillWorkflowState.value.request?.resolver_type || '').trim().toLowerCase();
  return ['cargo_in_scope', 'position', 'specific_person'].includes(resolver);
});
const fillApproveActionLabel = computed(() => (isReviewFillStep.value ? 'Aprobar' : 'Enviar'));
const getFillStepStatusLabel = (status) => {
  const code = String(status || '').trim().toLowerCase();
  if (code === 'approved') return 'Aprobado';
  if (code === 'in_progress') return 'En progreso';
  if (code === 'returned') return 'Devuelto';
  if (code === 'rejected') return 'Rechazado';
  if (code === 'cancelled') return 'Cancelado';
  return 'Pendiente';
};
const getFillStepStatusBadgeClass = (status) => {
  const code = String(status || '').trim().toLowerCase();
  if (code === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (code === 'in_progress') return 'bg-sky-100 text-sky-800';
  if (code === 'returned') return 'bg-amber-100 text-amber-800';
  if (code === 'rejected') return 'bg-rose-100 text-rose-800';
  if (code === 'cancelled') return 'bg-slate-200 text-slate-700';
  return 'bg-slate-100 text-slate-700';
};
const formatWorkflowDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};
const getFillStepCardClass = (step, currentStepOrder) => {
  if (Number(currentStepOrder || 0) === Number(step?.step_order || 0)) {
    return 'border-sky-200 bg-sky-50/40';
  }
  const code = String(step?.request_status || '').trim().toLowerCase();
  if (code === 'approved') return 'border-emerald-200 bg-emerald-50/40';
  if (code === 'rejected' || code === 'returned') return 'border-amber-200 bg-amber-50/40';
  return 'border-slate-200 bg-slate-50/40';
};
const getFillStepResolverLabel = (step) => {
  const bits = [];
  if (step.resolver_type) bits.push(step.resolver_type);
  if (step.selection_mode) bits.push(step.selection_mode);
  return bits.join(' · ');
};

const canStartFillRequest = computed(() => getFillRequestStatusCode(fillWorkflowState.value.request) === 'pending');
const canOperateCurrentFillRequest = computed(() =>
  currentUserCanOperateFillStep(fillWorkflowState.value.subject)
  || isFillRequestActionableByCurrentUser(fillWorkflowState.value.request)
);
const fillWorkflowNotes = computed(() => {
  const steps = fillWorkflowState.value.subject?.workflow?.fill_steps || [];
  return steps
    .filter((step) => String(step?.response_note || '').trim())
    .map((step) => ({
      stepId: Number(step.id || 0),
      requestId: getFillRequestId(step),
      stepOrder: Number(step.step_order || 0),
      label: step.display_label || 'Responsable no resuelto',
      note: String(step.response_note || '').trim(),
      statusLabel: getFillStepStatusLabel(step.request_status),
      respondedAt: step.responded_at || null,
      respondedAtLabel: formatWorkflowDateTime(step.responded_at)
    }))
    .sort((a, b) => {
      const timeA = a.respondedAt ? new Date(a.respondedAt).getTime() : 0;
      const timeB = b.respondedAt ? new Date(b.respondedAt).getTime() : 0;
      return timeB - timeA;
    });
});
const canReplaceFillFile = computed(() => {
  const subject = fillWorkflowState.value.subject;
  if (!subject) return false;
  return Boolean(
    subject.actions?.can_upload_deliverable
    && canOperateCurrentFillRequest.value
    && subjectHasWorkingArtifact(subject)
  );
});
const canApproveFillRequest = computed(() => {
  const code = getFillRequestStatusCode(fillWorkflowState.value.request);
  return canOperateCurrentFillRequest.value
    && ['pending', 'in_progress'].includes(code)
    && subjectHasWorkingArtifact(fillWorkflowState.value.subject);
});
const canReturnFillRequest = computed(() =>
  canOperateCurrentFillRequest.value
  && isReviewFillStep.value
  && ['pending', 'in_progress'].includes(getFillRequestStatusCode(fillWorkflowState.value.request))
);
const canRejectFillRequest = computed(() =>
  canOperateCurrentFillRequest.value
  && isReviewFillStep.value
  && ['pending', 'in_progress'].includes(getFillRequestStatusCode(fillWorkflowState.value.request))
);
const canCancelFillRequest = computed(() =>
  canOperateCurrentFillRequest.value && ['pending', 'in_progress'].includes(getFillRequestStatusCode(fillWorkflowState.value.request))
);

const getUploadActionLabel = (payload) => {
  const subject = getDeliverableSubject(payload);
  if (!subject.preloadFilePath) {
    return 'Subir archivo';
  }
  return canPreviewInline(subject.preloadFilePath) ? 'Cambiar PDF' : 'Cambiar archivo';
};

const fetchDeliverableFileBlob = async (payload, kind = 'best') => {
  const subject = getDeliverableSubject(payload);
  const userId = currentUserId.value;
  const definitionId = Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
  return processPanelService.downloadDeliverableFile(userId, definitionId, subject.itemId, kind);
};

const downloadBlob = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};

const downloadDeliverableFile = async (payload) => {
  const subject = getDeliverableSubject(payload);
  if (!subject.preloadFilePath) {
    setProcessActionInfo(`El entregable ${subject.title} todavía no tiene un archivo vinculado.`, 'error');
    return;
  }
  try {
    const preferredKind = subject.finalFilePath ? 'final' : 'working';
    const blob = await fetchDeliverableFileBlob(payload, preferredKind);
    downloadBlob(blob, getFileNameFromPath(subject.preloadFilePath));
  } catch (error) {
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo descargar el archivo del entregable.',
      'error'
    );
  }
};

const previewDeliverableFile = async (payload) => {
  const subject = getDeliverableSubject(payload);
  if (!subject.preloadFilePath) {
    setProcessActionInfo(`El entregable ${subject.title} todavía no tiene un archivo vinculado.`, 'error');
    return;
  }
  if (!canPreviewInline(subject.preloadFilePath)) {
    await downloadDeliverableFile(payload);
    return;
  }
  try {
    const preferredKind = subject.finalFilePath ? 'final' : 'working';
    const blob = await fetchDeliverableFileBlob(payload, preferredKind);
    if (deliverablePreviewUrl.value) {
      URL.revokeObjectURL(deliverablePreviewUrl.value);
    }
    deliverablePreviewUrl.value = URL.createObjectURL(blob);
    deliverablePreviewName.value = getFileNameFromPath(subject.preloadFilePath);
    deliverablePreviewPath.value = subject.preloadFilePath;
    deliverablePreviewSource.value = payload;
    deliverablePreviewIsPdf.value = true;
    deliverablePreviewModalInstance = Modal.getOrCreateInstance(deliverablePreviewModal.value?.el);
    deliverablePreviewModalInstance?.show();
  } catch (error) {
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo abrir la vista previa del archivo.',
      'error'
    );
  }
};

const downloadPreviewedFile = async () => {
  if (!deliverablePreviewPath.value || !deliverablePreviewSource.value) return;
  try {
    const subject = getDeliverableSubject(deliverablePreviewSource.value);
    const preferredKind = subject.finalFilePath ? 'final' : 'working';
    const blob = await fetchDeliverableFileBlob(deliverablePreviewSource.value, preferredKind);
    downloadBlob(blob, deliverablePreviewName.value || getFileNameFromPath(deliverablePreviewPath.value));
  } catch (error) {
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo descargar el archivo.',
      'error'
    );
  }
};

const handleDeliverableFutureAction = (action, payload) => {
  const subject = getDeliverableSubject(payload);
  if (action === 'upload_deliverable') {
    if (isUploadingDeliverable.value) {
      return;
    }
    pendingDeliverableUploadTarget.value = payload;
    deliverableUploadInput.value?.click();
    return;
  }
  if (action === 'manage_fill') {
    openFillWorkflowModal(payload);
    return;
  }
  if (action === 'download_template') {
    downloadDeliverableTemplate(payload);
    return;
  }
  const actionLabels = {
    manage_fill: 'La gestión operativa del llenado',
    download_template: 'La descarga de la plantilla',
    upload_deliverable: 'La subida del archivo del entregable',
    review_signature_flow: 'La revisión del flujo de firmas',
    process_chat: 'El chat del proceso'
  };
  setProcessActionInfo(
    `${actionLabels[action] || 'Esta acción'} todavía no está implementada en este panel. Entregable: ${subject.title}.`,
    'error'
  );
};

const triggerFillWorkflowFileReplace = () => {
  if (!fillWorkflowState.value.subject || isUploadingDeliverable.value) return;
  pendingDeliverableUploadTarget.value = fillWorkflowState.value.subject;
  deliverableUploadInput.value?.click();
};

const startDeliverableFlow = async (payload) => {
  const subject = getDeliverableSubject(payload);
  const request = getCurrentFillWorkflowRequest(payload);
  const requestId = getFillRequestId(request);
  if (!requestId) {
    setProcessActionInfo(`No se encontró una solicitud inicial de llenado para ${subject.title}.`, 'error');
    return;
  }
  try {
    processingFillItemId.value = Number(subject.itemId || 0);
    if (subject.itemId) {
      startedDeliverableIds.value = new Set([...startedDeliverableIds.value, Number(subject.itemId)]);
    }
    openDeliverableOperationModal({
      title: 'Iniciando entregable',
      type: 'info',
      message: `Se está iniciando el trabajo sobre ${subject.title}...`,
      detail: `Paso ${request.step_order || 1}`
    });
    await processPanelService.startFillRequest(requestId, {
      note: 'Inicio del flujo desde el panel del entregable.'
    });
    if (selectedProcessContext.value) {
      await loadSelectedProcessPanel(selectedProcessContext.value);
    }
    openDeliverableOperationModal({
      title: 'Entregable iniciado',
      type: 'success',
      message: `El entregable ${subject.title} quedó iniciado.`,
      detail: 'Ahora ya puedes descargar la plantilla y subir el archivo de trabajo.'
    });
    setProcessActionInfo(`El entregable ${subject.title} quedó iniciado correctamente.`, 'success');
  } catch (error) {
    if (subject.itemId) {
      const nextSet = new Set(startedDeliverableIds.value);
      nextSet.delete(Number(subject.itemId));
      startedDeliverableIds.value = nextSet;
    }
    const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'No se pudo iniciar el entregable.';
    openDeliverableOperationModal({
      title: 'Error al iniciar entregable',
      type: 'error',
      message,
      detail: subject.title
    });
    setProcessActionInfo(message, 'error');
  } finally {
    processingFillItemId.value = null;
  }
};

const completeDeliverableFill = async (payload) => {
  const subject = getDeliverableSubject(payload);
  const pendingFillRequest = (subject.workflow?.fill_requests || []).find((request) => !request.responded_at);
  if (!pendingFillRequest?.id) {
    setProcessActionInfo(`No se encontró una solicitud de llenado pendiente para ${subject.title}.`, 'error');
    return;
  }
  if (!subject.preloadFilePath) {
    setProcessActionInfo(`Primero debes subir el archivo del entregable ${subject.title} antes de aprobar el llenado.`, 'error');
    return;
  }
  try {
    processingFillItemId.value = Number(subject.itemId || 0);
    openDeliverableOperationModal({
      title: 'Gestionando llenado',
      type: 'info',
      message: `Validando el entregable ${subject.title}...`,
      detail: 'Se está actualizando el estado del flujo de llenado.'
    });
    await processPanelService.approveFillRequest(pendingFillRequest.id, {
      note: 'Llenado confirmado desde el panel del entregable.'
    });
    setProcessActionInfo(`El llenado del entregable ${subject.title} fue aprobado correctamente.`, 'success');
    openDeliverableOperationModal({
      title: 'Llenado actualizado',
      type: 'success',
      message: `El flujo de llenado de ${subject.title} se actualizó correctamente.`,
      detail: subject.preloadPdfPath
        ? 'El entregable ya puede avanzar hacia firma cuando exista una solicitud pendiente.'
        : 'El archivo de trabajo quedó validado. Si aún no existe un PDF, la firma seguirá bloqueada.'
    });
    if (selectedProcessContext.value) {
      await loadSelectedProcessPanel(selectedProcessContext.value);
    }
  } catch (error) {
    openDeliverableOperationModal({
      title: 'Error en llenado',
      type: 'error',
      message: error?.response?.data?.error || error?.response?.data?.message || error?.message || 'No se pudo actualizar el flujo de llenado.',
      detail: subject.title
    });
    setProcessActionInfo(
      error?.response?.data?.error || error?.response?.data?.message || error?.message || 'No se pudo actualizar el flujo de llenado.',
      'error'
    );
  } finally {
    processingFillItemId.value = null;
  }
};

const submitFillWorkflowAction = async (action) => {
  const subject = fillWorkflowState.value.subject;
  const request = fillWorkflowState.value.request;
  const requestId = getFillRequestId(request);
  if (!subject || !requestId) {
    fillWorkflowState.value.error = 'No se encontró una solicitud de llenado válida.';
    return;
  }
  if (action === 'approve' && !subject.preloadFilePath) {
    fillWorkflowState.value.error = 'Primero debes cargar un archivo de trabajo para aprobar el llenado.';
    return;
  }

  const actionLabels = {
    start: 'inicio',
    approve: 'aprobación',
    return: 'devolución',
    reject: 'rechazo',
    cancel: 'cancelación'
  };

  try {
    fillWorkflowSubmitting.value = true;
    fillWorkflowState.value.error = '';
    openDeliverableOperationModal({
      title: 'Actualizando flujo de llenado',
      type: 'info',
      message: `Procesando ${actionLabels[action] || 'acción'} para ${subject.title}...`,
      detail: `Paso ${request.step_order || 1}`
    });

    const payload = fillWorkflowState.value.note ? { note: fillWorkflowState.value.note } : {};
    if (action === 'start') {
      await processPanelService.startFillRequest(requestId, payload);
    } else if (action === 'approve') {
      await processPanelService.approveFillRequest(requestId, payload);
    } else if (action === 'return') {
      await processPanelService.returnFillRequest(requestId, payload);
    } else if (action === 'reject') {
      await processPanelService.rejectFillRequest(requestId, payload);
    } else if (action === 'cancel') {
      await processPanelService.cancelFillRequest(requestId, payload);
    } else {
      throw new Error('Acción de llenado no soportada.');
    }

    openDeliverableOperationModal({
      title: 'Flujo de llenado actualizado',
      type: 'success',
      message: `La ${actionLabels[action] || 'acción'} del entregable ${subject.title} se completó correctamente.`,
      detail: 'El panel se actualizará con el nuevo estado.'
    });
    setProcessActionInfo(`El flujo de llenado de ${subject.title} se actualizó correctamente.`, 'success');
    fillWorkflowModalInstance?.hide();
    if (selectedProcessContext.value) {
      await loadSelectedProcessPanel(selectedProcessContext.value);
    }
  } catch (error) {
    const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'No se pudo actualizar el flujo de llenado.';
    fillWorkflowState.value.error = message;
    openDeliverableOperationModal({
      title: 'Error en flujo de llenado',
      type: 'error',
      message,
      detail: subject.title
    });
    setProcessActionInfo(message, 'error');
  } finally {
    fillWorkflowSubmitting.value = false;
  }
};

const downloadDeliverableTemplate = async (payload) => {
  const subject = getDeliverableSubject(payload);
  try {
    const userId = currentUserId.value;
    const definitionId = Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
    const blob = await processPanelService.downloadDeliverableTemplate(userId, definitionId, subject.itemId);
    downloadBlob(blob, `${subject.title}.pdf`);
    setProcessActionInfo(`La plantilla de ${subject.title} se descargó correctamente.`, 'success');
  } catch (error) {
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo descargar la plantilla del entregable.',
      'error'
    );
  }
};

const handleDeliverableUploadSelected = async (event) => {
  const file = event?.target?.files?.[0];
  const target = pendingDeliverableUploadTarget.value;
  if (!file || !target) {
    pendingDeliverableUploadTarget.value = null;
    if (event?.target) {
      event.target.value = '';
    }
    return;
  }

  const lowerName = file.name.toLowerCase();
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
  const isAllowed = allowedExtensions.some((extension) => lowerName.endsWith(extension));
  if (!isAllowed) {
    setProcessActionInfo('Solo puedes cargar archivos PDF, Word o Excel para el entregable.', 'error');
    pendingDeliverableUploadTarget.value = null;
    if (event?.target) {
      event.target.value = '';
    }
    return;
  }

  try {
    isUploadingDeliverable.value = true;
    openDeliverableOperationModal({
      title: 'Cargando archivo del entregable',
      type: 'info',
      message: `Subiendo ${file.name}...`,
      detail: `Entregable: ${target.title || target.template_artifact_name || `#${target.itemId || target.id}`}`
    });
    const userId = currentUserId.value;
    const definitionId = Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
    const taskItemId = Number(target.itemId || target.id || 0);
    const uploadResult = await processPanelService.uploadDeliverableFile(userId, definitionId, taskItemId, file);
    setProcessActionInfo(`El archivo del entregable ${target.title || target.template_artifact_name || `#${taskItemId}`} se cargó correctamente.`, 'success');
    openDeliverableOperationModal({
      title: 'Archivo cargado',
      type: 'success',
      message: 'El archivo del entregable se cargó correctamente.',
      detail: `Ruta de trabajo: ${uploadResult?.working_file_path || file.name}`
    });
    if (selectedProcessContext.value) {
      await loadSelectedProcessPanel(selectedProcessContext.value);
    }
  } catch (error) {
    openDeliverableOperationModal({
      title: 'Error al cargar archivo',
      type: 'error',
      message: error?.response?.data?.message || error?.message || 'No se pudo cargar el archivo del entregable.',
      detail: target.title || target.template_artifact_name || `Entregable #${target.itemId || target.id}`
    });
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo cargar el archivo del entregable.',
      'error'
    );
  } finally {
    isUploadingDeliverable.value = false;
    pendingDeliverableUploadTarget.value = null;
    if (event?.target) {
      event.target.value = '';
    }
  }
};

const openDocumentCenter = () => {
  documentCenterModalInstance = Modal.getOrCreateInstance(documentCenterModal.value?.el);
  documentCenterModalInstance?.show();
};

const openDocumentSignFlow = (payload) => {
  const doc = getDeliverableSubject(payload);
  if (!doc?.actions?.can_sign) {
    if (doc.preloadFilePath && !isPdfWorkingFile(payload)) {
      setProcessActionInfo(
        `El entregable ${doc.title} tiene un archivo de trabajo ${getFileExtension(doc.preloadFilePath).toUpperCase()}. Primero debe existir un PDF de trabajo para firmar.`,
        'error'
      );
    }
    return;
  }
  if (doc.preloadFilePath && !isPdfWorkingFile(payload)) {
    setProcessActionInfo(
      `El entregable ${doc.title} todavía no tiene un PDF listo para firma. Debes generar o cargar un PDF de trabajo antes de firmar.`,
      'error'
    );
    return;
  }
  const pendingSignatureRequest = (doc.workflow?.signature_requests || []).find((request) => !request.responded_at);
  if (!pendingSignatureRequest?.id || !doc.documentVersionId) {
    setProcessActionInfo(
      `No se encontró una solicitud de firma pendiente para ${doc.title}.`,
      'error'
    );
    return;
  }
  documentSignModalInstance = Modal.getOrCreateInstance(documentSignModal.value?.el);
  documentSignModalInstance?.show();
  nextTick(() => {
    embeddedSignerRef.value?.resetToStart?.();
    embeddedSignerRef.value?.initializeWorkflowSignatureSession?.({
      signatureRequestId: pendingSignatureRequest.id,
      documentVersionId: doc.documentVersionId,
      taskItemId: doc.itemId,
      processDefinitionId: Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value),
      documentTitle: doc.title,
      documentVersionLabel: payload?.document_version ? `v${payload.document_version}` : `#${doc.documentVersionId}`,
      preloadPdfPath: doc.preloadPdfPath
    });
  });
};

const handleHeaderToggle = () => {
  showMenu.value = !showMenu.value;
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
