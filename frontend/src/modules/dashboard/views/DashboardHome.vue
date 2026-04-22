<template>
  <div class="min-h-screen bg-slate-100 font-sans flex flex-col">
    <app-workspace-header :menu-open="showMenu" current-section="dashboard" @menu-toggle="handleHeaderToggle" @notify="toggleNotify" @sign="isSigningView = !isSigningView">
        <span v-if="!userUnits.length && !menuLoading" class="text-white/50 text-sm font-medium">
          Sin unidades
        </span>
    </app-workspace-header>

    <div class="flex flex-col xl:flex-row w-full flex-1 max-w-640 mx-auto items-stretch">
      <app-workspace-sidebar :show="showMenu" :photo="userPhoto" :username="userFullName" @close-mobile="showMenu = false">
        <div class="deasy-nav-group">
          <div ref="groupDropdownRef" class="px-2 mt-3 mb-2" v-if="unitGroups.length">
            <label class="flex flex-col gap-1.5 relative">
              <span class="text-xs font-bold uppercase tracking-wider text-white/50">Cargos asignados</span>
              <div class="relative">
                <button
                  type="button"
                  class="plain deasy-nav-group-title deasy-nav-item--subtle-active deasy-nav-select-trigger"
                  :aria-expanded="showGroupDropdown ? 'true' : 'false'"
                  aria-label="Seleccionar grupo de cargos"
                  @click="toggleGroupDropdown"
                >
                  <span class="flex items-center gap-3.5 text-base font-semibold">
                    <IconIdBadge class="w-6 h-6 shrink-0 opacity-90" />
                    <span class="truncate">{{ selectedGroupLabel }}</span>
                  </span>
                  <span class="inline-flex items-center text-[#486178]">
                    <IconChevronDown class="h-4 w-4 transition-transform duration-200" :class="showGroupDropdown ? 'rotate-180' : ''" />
                  </span>
                </button>
                <div v-if="showGroupDropdown" class="deasy-nav-select-panel">
                  <button
                    type="button"
                    class="deasy-nav-select-option"
                    :class="!selectedGroupId ? 'deasy-nav-select-option--active' : ''"
                    @click="selectGroupOption(null)"
                  >
                    <span class="truncate">Consolidado</span>
                  </button>
                  <button
                    v-for="group in unitGroups"
                    :key="group.id"
                    type="button"
                    class="deasy-nav-select-option"
                    :class="String(selectedGroupId) === String(group.id) ? 'deasy-nav-select-option--active' : ''"
                    @click="selectGroupOption(group)"
                  >
                    <span class="truncate">{{ group.label || group.name }}</span>
                  </button>
                </div>
              </div>
            </label>
          </div>
          <div v-else class="deasy-nav-meta mt-3 mb-2">
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
            <div class="deasy-nav-shell">
              <div v-for="cargo in menuCargos" :key="cargo.id" class="deasy-nav-section">
              <AppButton
                variant="plain"
                class-name="deasy-nav-group-title"
                :class="{ 'deasy-nav-item--subtle-active': cargo.open }"
                type="button"
                @click="toggleCargo(cargo)"
              >
                <span class="flex items-center gap-3.5 text-base font-semibold">
                  <component :is="iconForCargo(cargo.name)" class="w-6 h-6 shrink-0 opacity-90" />
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
                  :title="process.name"
                  @click="handleProcessSelect(process, cargo)"
                >
                  <span
                    class="deasy-nav-item__icon"
                    :class="process.access_source === 'flow' ? 'deasy-nav-item__icon--derived' : 'deasy-nav-item__icon--direct'"
                  >
                    <component :is="iconForProcessAccess(process)" class="h-4.5 w-4.5 shrink-0" />
                  </span>
                  <span class="deasy-nav-item__label">{{ process.name }}</span>
                </AppButton>
                <div v-if="!cargo.processes.length" class="px-4 py-1 text-sm italic text-slate-400">
                  Sin procesos asignados.
                </div>
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
        <AppPageIntro
          variant="dashboard"
          :title="userFullName"
          :meta="currentUser?.email || currentUser?.cedula || 'Sin identificador'"
          description="Selecciona una sección para continuar con la gestión de tu dossier académico, revisar el estado de tus módulos y completar tu información profesional."
          class="mb-6"
        >
          <template #actions>
            <AppButton variant="secondary" size="md" class-name="whitespace-nowrap" @click="navigateTo('perfil')">
              Ir a mi perfil
            </AppButton>
          </template>
        </AppPageIntro>

        <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <article class="bg-white rounded-3xl shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-3 min-h-40" v-for="card in summaryCards" :key="card.title">
            <header class="flex justify-between items-start gap-4">
              <h3 class="text-base font-bold text-slate-800 leading-tight">{{ card.title }}</h3>
              <AppTag :variant="getStatusTagVariant(card.statusClass)" class-name="whitespace-nowrap shrink-0">{{ card.status }}</AppTag>
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

        <section class="bg-white rounded-3xl shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 overflow-hidden mb-6">
          <header class="flex items-center justify-between gap-4 mb-5">
            <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Resumen rápido</h2>
            <AppButton variant="secondary" size="md" class-name="hidden sm:inline-flex" @click="navigateTo('perfil')">
              Gestionar perfil
            </AppButton>
          </header>

          <!-- Vista móvil: Tarjetas -->
          <div class="flex flex-col gap-3 sm:hidden">
            <div v-for="row in summaryRows" :key="'mob-' + row.section" class="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div class="flex justify-between items-start gap-2">
                <div class="flex flex-col gap-0.5">
                  <span class="font-bold text-slate-800 text-sm leading-tight">{{ row.section }}</span>
                  <span class="text-slate-500 font-medium text-xs">{{ row.count }} registros</span>
                </div>
                <AppTag :variant="getStatusTagVariant(row.statusClass)" class-name="shrink-0">{{ row.status }}</AppTag>
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
                <AppTag :variant="getStatusTagVariant(row.statusClass)">{{ row.status }}</AppTag>
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
            <section class="deasy-hero-shell">
              <div class="deasy-hero-layout">
                <div class="deasy-hero-main deasy-hero-main--with-media">
                  <div class="deasy-hero-media">
                    <div class="deasy-hero-media-card">
                      <IconChecklist class="h-10 w-10" />
                    </div>
                  </div>
                  <div class="deasy-hero-copy sm:pt-1">
                    <div class="flex flex-wrap items-center gap-2.5">
                      <div class="deasy-hero-kicker">
                        {{ selectedProcessPanel?.definition?.process_name || selectedProcessContext?.name || 'Proceso' }}
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <AppTag variant="hero">Tareas {{ selectedProcessPanel?.summary?.tasks_total || 0 }}</AppTag>
                        <AppTag variant="hero">Entregables {{ selectedProcessPanel?.summary?.task_items_pending || 0 }}</AppTag>
                        <AppTag variant="hero">Llenado {{ selectedProcessPanel?.summary?.fill_requests_pending || 0 }}</AppTag>
                      </div>
                    </div>
                    <div class="flex flex-col gap-3">
                      <h1 class="deasy-hero-title">
                        {{ selectedProcessPanel?.definition?.name || selectedProcessContext?.name || 'Definición de proceso' }}
                      </h1>
                      <p class="deasy-hero-description">
                        Gestiona solo tus tareas y entregables de esta definición activa. Desde aquí puedes revisar dependencias,
                        documentos, firmas y lanzar tareas manuales cuando el flujo lo permita.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="deasy-hero-side">
                  <button
                    type="button"
                    class="deasy-hero-stat-card"
                    @click="showProcessDeliverableInfo"
                  >
                    <div class="deasy-hero-stat-card__lead">
                      <span class="deasy-hero-stat-card__icon">
                        <IconFileDescription class="h-5 w-5" />
                      </span>
                      <div class="deasy-hero-stat-card__body">
                        <span class="deasy-hero-stat-card__eyebrow">Documentos</span>
                        <span class="deasy-hero-stat-card__title">Abrir centro</span>
                      </div>
                    </div>
                    <span class="deasy-hero-stat-card__value">{{ selectedProcessPanel?.summary?.documents_total || 0 }}</span>
                  </button>
                  <button
                    type="button"
                    class="deasy-hero-stat-card"
                    @click="showSignatureQueueInfo"
                  >
                    <div class="deasy-hero-stat-card__lead">
                      <span class="deasy-hero-stat-card__icon">
                        <IconSignature class="h-5 w-5" />
                      </span>
                      <div class="deasy-hero-stat-card__body">
                        <span class="deasy-hero-stat-card__eyebrow">Firmas</span>
                        <span class="deasy-hero-stat-card__title">Ver flujo</span>
                      </div>
                    </div>
                    <span class="deasy-hero-stat-card__value">{{ selectedProcessPanel?.summary?.signatures_pending || 0 }}</span>
                  </button>
                  <button
                    type="button"
                    class="deasy-hero-stat-card"
                    @click="clearSelectedProcess"
                  >
                    <div class="deasy-hero-stat-card__lead">
                      <span class="deasy-hero-stat-card__icon">
                        <IconArrowRight class="h-5 w-5 rotate-180" />
                      </span>
                      <div class="deasy-hero-stat-card__body">
                        <span class="deasy-hero-stat-card__eyebrow">Navegación</span>
                        <span class="deasy-hero-stat-card__title">Volver</span>
                      </div>
                    </div>
                    <span class="text-lg font-extrabold leading-none text-[#21517a]">←</span>
                  </button>
                  <button
                    type="button"
                    class="deasy-hero-stat-card disabled:cursor-not-allowed disabled:opacity-55"
                    :disabled="!selectedProcessPanel?.permissions?.can_launch_manual"
                    @click="openTaskLaunchModal"
                  >
                    <div class="deasy-hero-stat-card__lead">
                      <span class="deasy-hero-stat-card__icon">
                        <IconPlus class="h-5 w-5" />
                      </span>
                      <div class="deasy-hero-stat-card__body">
                        <span class="deasy-hero-stat-card__eyebrow">Tareas</span>
                        <span class="deasy-hero-stat-card__title">Nueva tarea</span>
                      </div>
                    </div>
                    <span class="text-lg font-extrabold leading-none text-[#21517a]">+</span>
                  </button>
                </div>
              </div>
            </section>

            <section v-if="processPanelLoading" class="bg-sky-50 border border-sky-100 text-sky-800 rounded-2xl p-5 font-semibold text-sm animate-pulse">
              Cargando la definición seleccionada...
            </section>

            <section v-else-if="processPanelError" class="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl p-5 shadow-sm">
              {{ processPanelError }}
            </section>

            <template v-else>
              <section v-if="processActionMessage" class="rounded-2xl p-5 font-bold text-sm shadow-sm" :class="processActionMessage.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'">
                {{ processActionMessage.text }}
              </section>

              <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Tareas -->
                <article class="lg:col-span-12 bg-white rounded-3xl shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                  <header class="flex flex-col gap-2">
                    <div>
                      <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Tareas asignadas</h2>
                      <p class="text-slate-500 text-sm mt-1 mb-0 font-medium">Solo se muestran las tareas donde participas o que creaste manualmente.</p>
                    </div>
                  </header>

                  <section class="overflow-hidden rounded-[2rem] border border-sky-100 bg-linear-to-br from-sky-50 via-white to-slate-50 shadow-inner shadow-sky-100/40">
                    <div class="flex flex-col gap-5 px-4 py-4 md:px-5 md:py-5">
                    <div class="flex flex-col gap-4">
                      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                          <label class="relative min-w-0 flex-1 md:min-w-[22rem]">
                            <IconSearch class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              v-model="taskListFilters.query"
                              type="text"
                              placeholder="Buscar entregables, periodos o unidades"
                              class="block w-full rounded-2xl border border-slate-200 bg-white/90 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
                            />
                          </label>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                          <AppButton
                            variant="softNeutral"
                            size="sm"
                            type="button"
                            class-name="shrink-0"
                            @click="showAdvancedTaskFilters = !showAdvancedTaskFilters"
                          >
                            <component :is="showAdvancedTaskFilters ? IconMinus : IconPlus" class="h-4 w-4" />
                            {{ showAdvancedTaskFilters ? 'Ocultar filtros' : 'Más filtros' }}
                          </AppButton>
                          <AppButton
                            variant="softNeutral"
                            size="sm"
                            type="button"
                            class-name="shrink-0"
                            @click="resetTaskListFilters"
                          >
                            Limpiar filtros
                          </AppButton>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <label class="flex flex-col gap-2">
                          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Año</span>
                          <select v-model="taskListFilters.year" class="block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all appearance-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
                            <option value="all">Todos</option>
                            <option v-for="option in taskFilterYears" :key="option" :value="option">{{ option }}</option>
                          </select>
                        </label>
                        <label class="flex flex-col gap-2">
                          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Tipo de periodo</span>
                          <select v-model="taskListFilters.termType" class="block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all appearance-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
                            <option value="all">Todos</option>
                            <option v-for="option in taskFilterTermTypes" :key="option" :value="option">{{ option }}</option>
                          </select>
                        </label>
                        <label class="flex flex-col gap-2">
                          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Unidad</span>
                          <select v-model="taskListFilters.unit" class="block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all appearance-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
                            <option value="all">Todas</option>
                            <option v-for="option in taskFilterUnits" :key="option" :value="option">{{ option }}</option>
                          </select>
                        </label>
                      </div>

                      <div v-if="showAdvancedTaskFilters" class="grid grid-cols-1 gap-3 border-t border-slate-200/80 pt-4 md:grid-cols-3">
                        <label class="flex flex-col gap-2">
                          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Proceso</span>
                          <select v-model="taskListFilters.process" class="block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all appearance-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
                            <option value="all">Todos</option>
                            <option v-for="option in taskFilterProcesses" :key="option" :value="option">{{ option }}</option>
                          </select>
                        </label>
                        <label class="flex flex-col gap-2">
                          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Periodo</span>
                          <select v-model="taskListFilters.term" class="block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all appearance-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
                            <option value="all">Todos</option>
                            <option v-for="option in taskFilterTerms" :key="option.value" :value="option.value">{{ option.label }}</option>
                          </select>
                        </label>
                        <label class="flex flex-col gap-2">
                          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Estado</span>
                          <select v-model="taskListFilters.status" class="block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all appearance-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
                            <option value="all">Todos</option>
                            <option v-for="option in taskFilterStatuses" :key="option" :value="option">{{ option }}</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    </div>
                  </section>

                  <div v-if="!selectedProcessPanel.tasks.length" class="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    No tienes tareas activas o históricas para esta definición.
                  </div>

                  <div v-else-if="!filteredProcessDeliverables.length" class="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    No hay entregables que coincidan con los filtros actuales.
                  </div>

                  <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    <article
                      v-for="deliverable in filteredProcessDeliverables"
                      :key="deliverable.key"
                      class="relative overflow-hidden rounded-[5%] border bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition"
                      :class="getDeliverableCardTone(deliverable.item).card"
                    >
                      <span class="absolute inset-x-0 top-0 h-1.5" :class="getDeliverableCardTone(deliverable.item).accent"></span>

                      <div class="flex h-full flex-col gap-3 pt-2">
                        <div class="flex min-w-0 flex-col gap-2">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <span
                              class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                              :class="deliverable.item.document_id ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-500'"
                            >
                              <IconSignature class="h-3.5 w-3.5" />
                              {{ getDeliverableDocumentLabel(deliverable.item) }}
                            </span>
                            <AppTag :variant="getDeliverableStatusBadge(deliverable.item).variant">
                              {{ getDeliverableStatusBadge(deliverable.item).label }}
                            </AppTag>
                          </div>
                          <div class="min-w-0">
                            <strong class="line-clamp-2 text-base font-semibold leading-tight text-slate-800">
                              {{ deliverable.item.template_artifact_name || `Entregable #${deliverable.item.id}` }}
                            </strong>
                          </div>
                        </div>

                        <div
                          v-if="getDeliverableProgress(deliverable.item)"
                          class="rounded-[1.15rem] border border-slate-200 bg-slate-50/70 px-4 py-3"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <p class="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              {{ getDeliverableProgress(deliverable.item).label }}
                            </p>
                            <span class="text-xs font-semibold text-slate-600">
                              Paso {{ getDeliverableProgress(deliverable.item).current }} de {{ getDeliverableProgress(deliverable.item).total }}
                            </span>
                          </div>
                          <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              class="h-full rounded-full transition-all duration-300"
                              :class="getDeliverableCardTone(deliverable.item).accent"
                              :style="{ width: `${getDeliverableProgress(deliverable.item).percent}%` }"
                            ></div>
                          </div>
                        </div>

                        <div class="rounded-[1.15rem] border px-4 py-3" :class="getDeliverableCardTone(deliverable.item).responsibility">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <p class="m-0 text-[11px] font-bold uppercase tracking-[0.16em]" :class="getDeliverableCardTone(deliverable.item).responsibilityLabel">Responsable actual</p>
                            <span class="text-xs font-semibold text-slate-500">{{ getDeliverablePrimaryActionLabel(deliverable.item) }}</span>
                          </div>
                          <p class="m-0 mt-2 line-clamp-2 text-sm font-semibold leading-snug text-slate-800">
                            {{ getDeliverableCurrentResponsibility(deliverable.item).name }}
                          </p>
                        </div>

                        <div class="mt-auto border-t border-slate-100 pt-3">
                          <AppButton
                            variant="outlinePrimary"
                            size="sm"
                            class-name="w-full"
                            @click="openDeliverableWorkspaceModal(getDeliverableWorkspacePayload(deliverable))"
                          >
                            Gestionar
                          </AppButton>
                        </div>
                      </div>
                    </article>
                  </div>
                </article>

                <!-- Dependencies (Full width) -->
                <article class="lg:col-span-12 bg-white rounded-3xl shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                  <header class="flex flex-col gap-2">
                    <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Dependencias de la definición</h2>
                    <p class="text-slate-500 text-sm m-0 font-medium">Resumen de reglas, disparadores y artifacts de proceso que hacen operativa esta definición.</p>
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
                        Sin artifacts vinculados.
                      </div>
                      <ul v-else class="flex flex-col gap-3 m-0 p-0 list-none">
                        <li v-for="template in selectedProcessPanel.dependencies.templates" :key="template.id" class="text-sm font-bold text-slate-700 flex flex-col gap-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span>{{ template.template_artifact_name }}</span>
                          <span class="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                            <span class="bg-slate-100 px-2 py-0.5 rounded">{{ prettifyArtifactRole(template.usage_role) }}</span>
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

    <AdminModalShell
      controlled
      :open="showTaskLaunchModal"
      labelled-by="task-launch-modal-title"
      title="Crear tarea manual"
      size="lg"
      body-class="p-6 lg:p-8 overflow-y-auto flex flex-col gap-6 custom-scrollbar"
      footer-class="px-6 lg:px-8 gap-4"
      @close="closeTaskLaunchModal"
    >
      <template #title>
        <div>
          <div class="text-2xl font-bold tracking-tight text-slate-800">Crear tarea manual</div>
          <p class="mt-1 mb-0 text-sm font-medium text-slate-500">{{ selectedProcessPanel?.definition?.name || 'Definición seleccionada' }}</p>
        </div>
      </template>

      <div class="flex flex-col gap-6">
        <div class="flex flex-wrap items-center gap-2">
          <div
            v-for="step in taskLaunchSteps"
            :key="step.id"
            class="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition-colors"
            :class="taskLaunchStep >= step.id ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-400'"
          >
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]" :class="taskLaunchStep >= step.id ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'">
              {{ step.id }}
            </span>
            <span>{{ step.label }}</span>
          </div>
        </div>

        <div v-if="taskLaunchError" class="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl p-5 shadow-sm">
          {{ taskLaunchError }}
        </div>

        <section v-if="taskLaunchStep === 1" class="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          <div class="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
            <div class="flex flex-wrap gap-2">
              <AppTag variant="info">Tarea ligada a proceso</AppTag>
              <AppTag variant="muted">{{ selectedProcessPanel?.definition?.access_source === 'flow' ? 'Acceso derivado' : 'Acceso directo' }}</AppTag>
            </div>
            <p class="mt-3 mb-0 text-sm font-medium text-slate-600">
              Define el contexto operativo de la tarea. El backend la materializará usando los templates activos de esta definición.
            </p>
          </div>

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
        </section>

        <section v-else-if="taskLaunchStep === 2" class="flex flex-col gap-5">
          <div class="rounded-3xl border border-sky-200 bg-sky-50/70 p-5">
            <h3 class="m-0 text-base font-bold text-sky-900">Base documental de la tarea</h3>
            <p class="mt-2 mb-0 text-sm font-medium text-sky-800/80">
              Esta tarea se creará usando los templates activos de la definición. En este corte, el dashboard informa el alcance documental real antes de confirmar la creación.
            </p>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article class="rounded-3xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
              <header class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="m-0 text-base font-bold text-slate-800">Templates operativos</h3>
                  <p class="mt-1 mb-0 text-sm font-medium text-slate-500">Se materializan al crear la tarea.</p>
                </div>
                <AppTag variant="info">{{ taskLaunchSystemTemplates.length }}</AppTag>
              </header>
              <div v-if="!taskLaunchSystemTemplates.length" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
                Esta definición no tiene templates de proceso que generen tarea.
              </div>
              <div v-else class="flex flex-col gap-3">
                <article v-for="template in taskLaunchSystemTemplates" :key="template.id" class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <strong class="text-sm font-bold text-slate-800">{{ template.template_artifact_name }}</strong>
                    <AppTag variant="muted">{{ prettifyArtifactRole(template.usage_role) }}</AppTag>
                    <AppTag variant="success">Proceso</AppTag>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <AppTag variant="neutral">{{ template.signature_flow_count ? `Firmas: ${template.signature_flow_count}` : 'Sin flujo de firma activo' }}</AppTag>
                    <AppTag :variant="template.is_required ? 'warning' : 'muted'">
                      {{ template.is_required ? 'Requerido' : 'Opcional' }}
                    </AppTag>
                  </div>
                </article>
              </div>
            </article>

            <article class="rounded-3xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
              <header class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="m-0 text-base font-bold text-slate-800">Artifacts generales</h3>
                  <p class="mt-1 mb-0 text-sm font-medium text-slate-500">Disponibles para iteraciones posteriores del flujo manual.</p>
                </div>
                <AppTag variant="muted">{{ selectedProcessPanel?.user_packages?.length || 0 }}</AppTag>
              </header>
              <div v-if="!selectedProcessPanel?.user_packages?.length" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
                No tienes artifacts generales registrados en esta cuenta.
              </div>
              <div v-else class="flex flex-col gap-3">
                <article v-for="item in selectedProcessPanel.user_packages.slice(0, 4)" :key="item.id" class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <strong class="block truncate text-sm font-bold text-slate-800">{{ item.display_name }}</strong>
                    <p class="mt-1 mb-0 text-xs font-medium text-slate-500">{{ item.description || 'Artifact general registrado por el usuario.' }}</p>
                  </div>
                  <AppTag variant="muted" class-name="shrink-0">{{ item.artifact_stage }}</AppTag>
                </article>
              </div>
            </article>
          </div>
        </section>

        <section v-else class="flex flex-col gap-5">
          <div class="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
            <h3 class="m-0 text-base font-bold text-emerald-900">Confirmación</h3>
            <p class="mt-2 mb-0 text-sm font-medium text-emerald-800/80">
              Revisa el contexto antes de crear la tarea. La materialización documental se hará con los templates activos del proceso.
            </p>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article class="rounded-3xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
              <h3 class="m-0 text-base font-bold text-slate-800">Resumen operativo</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div class="text-xs font-bold uppercase tracking-wider text-slate-500">Definición</div>
                  <div class="mt-2 text-sm font-bold text-slate-800">{{ selectedProcessPanel?.definition?.name || '—' }}</div>
                </div>
                <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div class="text-xs font-bold uppercase tracking-wider text-slate-500">Periodo</div>
                  <div class="mt-2 text-sm font-bold text-slate-800">{{ taskLaunchSelectedTermLabel }}</div>
                </div>
                <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:col-span-2">
                  <div class="text-xs font-bold uppercase tracking-wider text-slate-500">Descripción</div>
                  <div class="mt-2 text-sm font-medium text-slate-700">{{ taskLaunchForm.description || 'Sin descripción adicional.' }}</div>
                </div>
              </div>
            </article>

            <article class="rounded-3xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
              <h3 class="m-0 text-base font-bold text-slate-800">Impacto documental</h3>
              <div class="flex flex-wrap gap-2">
                <AppTag variant="info">{{ taskLaunchSystemTemplates.length }} templates de proceso</AppTag>
                <AppTag variant="neutral">{{ selectedProcessPanel?.dependencies?.triggers?.length || 0 }} disparadores activos</AppTag>
                <AppTag variant="muted">{{ selectedProcessPanel?.dependencies?.rules?.length || 0 }} reglas vigentes</AppTag>
              </div>
              <ul class="m-0 pl-5 text-sm font-medium text-slate-600 flex flex-col gap-2">
                <li>La tarea se creará en modo manual dentro de esta definición.</li>
                <li>El backend generará entregables y documentos según los templates activos.</li>
                <li>Los flujos de llenado y firma dependerán de la configuración actual de cada template.</li>
              </ul>
            </article>
          </div>
        </section>
      </div>
      <template #footer>
        <AppButton variant="secondary" size="lg" type="button" :disabled="taskLaunchSubmitting" @click="closeTaskLaunchModal">
          Cancelar
        </AppButton>
        <AppButton
          v-if="taskLaunchStep > 1"
          variant="softNeutral"
          size="lg"
          type="button"
          :disabled="taskLaunchSubmitting"
          @click="goToPreviousTaskLaunchStep"
        >
          Volver
        </AppButton>
        <AppButton
          v-if="taskLaunchStep < taskLaunchSteps.length"
          variant="primary"
          size="lg"
          type="button"
          :disabled="!canAdvanceTaskLaunchStep"
          @click="goToNextTaskLaunchStep"
        >
          Continuar
        </AppButton>
        <AppButton v-else variant="primary" size="lg" type="button" :disabled="!canSubmitTaskLaunch" @click="submitTaskLaunch">
          {{ taskLaunchSubmitting ? 'Creando tarea...' : 'Crear tarea' }}
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="documentSignModal"
      labelled-by="document-sign-modal-title"
      title="Firmar documento"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <FirmarPdf ref="embeddedSignerRef" embedded @workflow-signed="handleEmbeddedWorkflowSigned" />
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
              <AppTag variant="muted" class-name="self-start sm:self-auto">
                {{ doc.document_version ? `v${doc.document_version}` : `#${doc.document_version_id}` }}
              </AppTag>
            </div>
            <div class="flex flex-wrap gap-2">
              <AppTag variant="neutral">{{ doc.document_status || 'Inicial' }}</AppTag>
              <AppTag v-if="doc.pending_fill_count" variant="info">Llenado pendiente: {{ doc.pending_fill_count }}</AppTag>
              <AppTag v-if="doc.pending_signature_count" variant="warning">Firmas pendientes: {{ doc.pending_signature_count }}</AppTag>
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
      ref="deliverableWorkspaceModal"
      labelled-by="deliverable-workspace-modal-title"
      title="Gestión del entregable"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-5">
        <div
          v-if="fillWorkflowState.subject || signatureFlowState.subject"
          class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3"
          role="tablist"
          aria-label="Secciones del entregable"
        >
          <button
            v-if="deliverableWorkspaceSubject"
            type="button"
            role="tab"
            :aria-selected="deliverableWorkspaceState.tab === 'summary'"
            :tabindex="deliverableWorkspaceState.tab === 'summary' ? 0 : -1"
            class="rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="getDeliverableWorkspaceTabClass('summary')"
            @click="deliverableWorkspaceState.tab = 'summary'"
          >
            Resumen
          </button>
          <button
            v-if="fillWorkflowState.subject && shouldShowManageFill(fillWorkflowState.subject)"
            type="button"
            role="tab"
            :aria-selected="deliverableWorkspaceState.tab === 'fill'"
            :tabindex="deliverableWorkspaceState.tab === 'fill' ? 0 : -1"
            class="rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="getDeliverableWorkspaceTabClass('fill')"
            @click="deliverableWorkspaceState.tab = 'fill'"
          >
            Flujo de llenado
          </button>
          <button
            v-if="signatureFlowState.subject && shouldShowSignatureFlow(signatureFlowState.subject)"
            type="button"
            role="tab"
            :aria-selected="deliverableWorkspaceState.tab === 'signature'"
            :tabindex="deliverableWorkspaceState.tab === 'signature' ? 0 : -1"
            class="rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="getDeliverableWorkspaceTabClass('signature')"
            @click="deliverableWorkspaceState.tab = 'signature'"
          >
            Flujo de firmas
          </button>
          <button
            v-if="deliverableWorkspaceSubject"
            type="button"
            role="tab"
            :aria-selected="deliverableWorkspaceState.tab === 'history'"
            :tabindex="deliverableWorkspaceState.tab === 'history' ? 0 : -1"
            class="rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="getDeliverableWorkspaceTabClass('history')"
            @click="deliverableWorkspaceState.tab = 'history'"
          >
            Historial
          </button>
        </div>

        <template v-if="deliverableWorkspaceState.tab === 'summary'">
          <div v-if="deliverableWorkspaceSubject" class="flex flex-col gap-5">
            <section class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
              <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div class="min-w-0 flex-1 flex flex-col gap-3">
                    <div class="flex flex-wrap items-center gap-3">
                      <span
                        class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]"
                        :class="deliverableWorkspaceSubject.documentId ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-500'"
                      >
                        <IconSignature class="h-3.5 w-3.5" />
                        {{ getDeliverableDocumentLabel(deliverableWorkspaceSubject) }}
                      </span>
                      <strong class="text-lg font-semibold leading-tight text-slate-800">{{ deliverableWorkspaceSubject.title }}</strong>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <AppTag
                        v-for="tag in getDeliverableTagGroups(deliverableWorkspaceSubject)"
                        :key="`workspace-summary-${tag.key}`"
                        :variant="tag.variant"
                      >
                        {{ tag.label }}
                      </AppTag>
                    </div>
                  </div>
                  <div class="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 px-4 py-3 lg:w-[18rem]">
                    <p class="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Siguiente acción</p>
                    <p class="m-0 mt-1 text-sm font-semibold text-slate-800">{{ getDeliverablePrimaryActionLabel(deliverableWorkspaceSubject) }}</p>
                    <p class="m-0 mt-1 text-xs font-medium text-slate-500">{{ getDeliverableNextActionText(deliverableWorkspaceSubject) }}</p>
                  </div>
                </div>

                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]">
                  <div class="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p class="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Proceso</p>
                    <p class="m-0 mt-1 text-sm font-semibold text-slate-700">{{ getDeliverableProcessLabel(null, deliverableWorkspaceSubject) }}</p>
                  </div>
                  <div class="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p class="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Unidad</p>
                    <p class="m-0 mt-1 text-sm font-semibold text-slate-700">{{ getDeliverableUnitLabel(deliverableWorkspaceSubject) }}</p>
                  </div>
                  <div class="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p class="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Periodo</p>
                    <p class="m-0 mt-1 text-sm font-semibold text-slate-700">{{ getDeliverablePeriodLabelFromSubject(deliverableWorkspaceSubject) }}</p>
                  </div>
                  <div class="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p class="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Fechas</p>
                    <p class="m-0 mt-1 text-sm font-semibold text-slate-700">{{ getDeliverableDateRangeLabel(deliverableWorkspaceSubject) }}</p>
                  </div>
                  <div class="rounded-[1.2rem] border border-sky-100 bg-linear-to-br from-sky-50 via-white to-cyan-50/70 px-4 py-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Responsable actual</p>
                      <span class="text-xs font-semibold text-slate-500">
                        {{ getDeliverableProgress(deliverableWorkspaceSubject)?.label || 'Gestión actual' }}
                      </span>
                    </div>
                    <p class="m-0 mt-2 text-sm font-semibold text-slate-800">
                      {{ getDeliverableCurrentResponsibility(deliverableWorkspaceSubject).name }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-slate-700">Acciones esenciales</h3>
                  <p class="m-0 mt-1 text-xs font-medium text-slate-500">Las acciones menos frecuentes quedaron movidas a este resumen y al historial.</p>
                </div>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <AppButton
                  v-if="shouldShowStartDeliverable(deliverableWorkspaceSubject)"
                  variant="primary"
                  :disabled="processingFillItemId === deliverableWorkspaceSubject.itemId || !canStartDeliverableAction(deliverableWorkspaceSubject)"
                  @click="startDeliverableFlow(deliverableWorkspaceSubject)"
                >
                  {{ processingFillItemId === deliverableWorkspaceSubject.itemId ? 'Iniciando...' : 'Iniciar' }}
                </AppButton>
                <AppButton
                  v-else-if="shouldShowUploadDeliverable(deliverableWorkspaceSubject)"
                  variant="primary"
                  :disabled="!deliverableWorkspaceSubject.actions?.can_upload_deliverable || isUploadingDeliverable"
                  @click="openDeliverableUploadModal(deliverableWorkspaceSubject)"
                >
                  {{ getUploadActionLabel(deliverableWorkspaceSubject) }}
                </AppButton>
                <AppButton
                  v-else-if="shouldShowSign(deliverableWorkspaceSubject)"
                  variant="warning"
                  :disabled="!deliverableWorkspaceSubject.actions?.implemented?.sign"
                  @click="openDocumentSignFlow(deliverableWorkspaceSubject)"
                >
                  Firmar
                </AppButton>
                <AppButton
                  v-if="shouldShowOpenWorkspacePrimary(deliverableWorkspaceSubject)"
                  variant="outlinePrimary"
                  @click="deliverableWorkspaceState.tab = shouldShowManageFill(deliverableWorkspaceSubject) ? 'fill' : 'signature'"
                >
                  Ir al detalle operativo
                </AppButton>
                <AppButton
                  variant="softNeutral"
                  :disabled="!deliverableWorkspaceSubject.actions?.can_open_process_chat"
                  @click="handleDeliverableFutureAction('process_chat', deliverableWorkspaceSubject)"
                >
                  Chat
                </AppButton>
                <AppButton
                  v-if="getDeliverableSubject(deliverableWorkspaceSubject).preloadFilePath"
                  variant="softNeutral"
                  @click="previewDeliverableFile(deliverableWorkspaceSubject)"
                >
                  Ver archivo
                </AppButton>
                <AppButton
                  v-if="getDeliverableSubject(deliverableWorkspaceSubject).preloadFilePath"
                  variant="softNeutral"
                  @click="downloadDeliverableFile(deliverableWorkspaceSubject)"
                >
                  Descargar archivo
                </AppButton>
                <AppButton
                  v-if="shouldShowTemplateDownload(deliverableWorkspaceSubject)"
                  variant="softNeutral"
                  :disabled="!deliverableWorkspaceSubject.actions?.can_download_template"
                  @click="handleDeliverableFutureAction('download_template', deliverableWorkspaceSubject)"
                >
                  Descargar plantilla
                </AppButton>
                <AppButton
                  v-if="shouldShowResetWorkflow(deliverableWorkspaceSubject)"
                  variant="softWarning"
                  :disabled="deliverableResetState.submitting"
                  @click="openDeliverableResetModal(deliverableWorkspaceSubject)"
                >
                  Resetear flujo
                </AppButton>
              </div>
            </section>
          </div>
        </template>

        <template v-else-if="deliverableWorkspaceState.tab === 'fill'">
          <div v-if="fillWorkflowState.subject" class="flex flex-col gap-5">
            <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div class="flex flex-col gap-2">
                <strong class="text-base font-bold text-slate-800">{{ fillWorkflowState.subject.title }}</strong>
                <div class="flex flex-wrap gap-2">
                  <AppTag variant="neutral">
                    Paso {{ fillWorkflowState.request?.step_order || 1 }}
                  </AppTag>
                  <AppTag variant="info">
                    Estado: {{ fillWorkflowState.request?.status_name || fillWorkflowState.request?.status || 'pending' }}
                  </AppTag>
                  <AppTag :variant="fillWorkflowState.subject.preloadFilePath ? 'success' : 'warning'">
                    {{ fillWorkflowState.subject.preloadFilePath ? `Archivo: ${getFileNameFromPath(fillWorkflowState.subject.preloadFilePath)}` : 'Sin archivo de trabajo' }}
                  </AppTag>
                </div>
              </div>
            </div>

            <div class="rounded-[1.8rem] border border-slate-200 bg-linear-to-br from-slate-50 via-white to-slate-100/70 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Secuencia del flujo</h3>
                <AppTag variant="muted">Vista operativa</AppTag>
              </div>
              <div v-if="!fillWorkflowState.subject?.workflow?.fill_steps?.length" class="text-sm text-slate-500">
                Este entregable todavía no tiene una secuencia de llenado visible.
              </div>
              <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div
                  v-for="step in fillWorkflowState.subject.workflow.fill_steps"
                  :key="`fill-step-combined-${step.id}-${step.request_id || 'na'}`"
                  class="relative overflow-hidden rounded-[5%] border bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition"
                  :class="getFillStepCardClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"
                >
                  <div class="absolute inset-x-0 top-0 h-3" :class="getFillStepAccentClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"></div>
                  <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-slate-100 px-3 text-sm font-extrabold text-slate-700">
                        {{ step.step_order }}
                      </span>
                      <div class="flex flex-col gap-1">
                        <strong class="text-sm font-bold text-slate-800">Paso {{ step.step_order }}</strong>
                        <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Llenado</span>
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-2 justify-end">
                      <AppTag :variant="getFillStepStatusTagVariant(step.request_status)">
                        {{ getFillStepStatusLabel(step.request_status) }}
                      </AppTag>
                      <AppTag
                        v-if="fillWorkflowState.subject.workflow.fill_flow?.current_step_order === step.step_order"
                        variant="accent"
                      >
                        Actual
                      </AppTag>
                    </div>
                  </div>
                  <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Responsable</p>
                    <p class="mt-1 text-sm font-semibold text-slate-700 m-0 leading-snug">{{ step.display_label }}</p>
                  </div>
                  <div class="mt-3 rounded-2xl bg-slate-50/60 px-4 py-3">
                    <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Regla</p>
                    <p class="mt-1 text-xs font-medium text-slate-500 m-0">{{ getFillStepResolverLabel(step) }}</p>
                  </div>
                  <div v-if="step.response_note" class="mt-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Nota</p>
                    <p class="mt-1 mb-0 text-xs font-medium text-slate-600">{{ step.response_note }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Acciones disponibles</h3>
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
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="deliverableWorkspaceState.tab === 'signature'">
          <div v-if="signatureFlowState.loading" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
            Consultando la secuencia de firmas...
          </div>
          <div v-else-if="signatureFlowState.error" class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
            {{ signatureFlowState.error }}
          </div>
          <div v-else-if="signatureFlowState.snapshot" class="flex flex-col gap-5">
            <section class="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Resumen del flujo</h3>
                  <p class="text-xs text-slate-500 m-0">Documento y estado actual de firmas.</p>
                </div>
                <AppTag :variant="signatureFlowState.snapshot?.canOperate ? 'success' : 'warning'">
                  {{ signatureFlowState.snapshot?.signatureFlow?.statusCode ? signatureFlowState.snapshot.signatureFlow.statusCode : capitalize(signatureFlowState.snapshot?.currentStatus) || 'Pendiente' }}
                </AppTag>
              </div>
              <div class="grid gap-3 md:grid-cols-3">
                <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p class="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Documento</p>
                  <p class="text-sm font-semibold text-slate-800 m-0">{{ signatureFlowState.subject?.title || 'Documento sin título' }}</p>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p class="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Paso actual</p>
                  <p class="text-sm font-semibold text-slate-800 m-0">{{ getCurrentSignatureStepOrder(signatureFlowState.snapshot) || '—' }}</p>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p class="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Solicitudes</p>
                  <p class="text-sm font-semibold text-slate-800 m-0">{{ signatureFlowState.snapshot.signatureRequests?.length || 0 }}</p>
                </div>
              </div>
            </section>

            <section class="rounded-[1.8rem] border border-slate-200 bg-linear-to-br from-slate-50 via-white to-slate-100/70 p-4 flex flex-col gap-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Pasos del flujo</h3>
                <AppTag variant="muted">
                  {{ (signatureFlowState.snapshot.signatureSteps || []).length }} pasos
                </AppTag>
              </div>
              <div v-if="!signatureFlowState.snapshot.signatureSteps?.length" class="text-sm text-slate-500">
                La definición todavía no tiene pasos de firma visibles.
              </div>
              <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div
                  v-for="step in signatureFlowState.snapshot.signatureSteps"
                  :key="`combined-signature-step-${step.id || step.step_order}`"
                  class="relative overflow-hidden rounded-[5%] border bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition"
                  :class="getSignatureStepCardClass(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))"
                >
                  <div class="absolute inset-x-0 top-0 h-3" :class="getSignatureStepAccentClass(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))"></div>
                  <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-slate-100 px-3 text-sm font-extrabold text-slate-700">
                        {{ step.step_order || '—' }}
                      </span>
                      <div class="flex flex-col gap-1">
                        <p class="text-sm font-bold text-slate-800 m-0">Paso {{ step.step_order || '—' }}</p>
                        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 m-0">Firma</p>
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-2 justify-end">
                      <AppTag
                        :variant="getSignatureStepStatusVariant(getSignatureStepStatusCode(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot)))"
                      >
                        {{ getSignatureStepStatusLabel(getSignatureStepStatusCode(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))) }}
                      </AppTag>
                      <AppTag :variant="step.assignees?.length ? 'success' : 'warning'">
                        {{ step.assignees?.length ? `${step.assignees.length} firmante(s)` : 'Sin responsables' }}
                      </AppTag>
                    </div>
                  </div>
                  <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Firmante</p>
                    <p class="mt-1 text-sm font-semibold text-slate-700 m-0 leading-snug">
                      {{ getSignatureStepAssignedSummary(step, signatureFlowState.snapshot.signatureRequests) }}
                    </p>
                  </div>
                  <div class="mt-3 rounded-2xl bg-slate-50/60 px-4 py-3">
                    <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Regla</p>
                    <p class="mt-1 text-xs font-medium text-slate-500 m-0">
                      {{ getSignatureStepResolverLabel(step) }}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600 text-center">
            No hay datos de firmas disponibles para este entregable.
          </div>
        </template>
        <template v-else-if="deliverableWorkspaceState.tab === 'history'">
          <div class="flex flex-col gap-5">
            <section class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="flex items-center justify-between gap-2">
                <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-slate-700">Historial de llenado</h3>
                <AppTag variant="muted">{{ fillWorkflowNotes.length }} registro{{ fillWorkflowNotes.length === 1 ? '' : 's' }}</AppTag>
              </div>
              <div v-if="!fillWorkflowNotes.length" class="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
                No hay notas ni respuestas registradas en el flujo de llenado.
              </div>
              <div v-else class="mt-4 flex flex-col gap-3">
                <div
                  v-for="noteEntry in fillWorkflowNotes"
                  :key="`workspace-fill-note-${noteEntry.stepId}-${noteEntry.requestId || noteEntry.stepOrder}`"
                  class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="m-0 text-sm font-bold text-slate-800">Paso {{ noteEntry.stepOrder }} · {{ noteEntry.label }}</p>
                      <p class="m-0 mt-1 text-xs font-medium text-slate-500">{{ noteEntry.statusLabel }}</p>
                    </div>
                    <span v-if="noteEntry.respondedAtLabel" class="text-xs font-medium text-slate-500">{{ noteEntry.respondedAtLabel }}</span>
                  </div>
                  <p class="m-0 mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">{{ noteEntry.note }}</p>
                </div>
              </div>
            </section>

            <section class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="flex items-center justify-between gap-2">
                <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-slate-700">Historial de firmas</h3>
                <AppTag variant="muted">{{ signatureFlowState.snapshot?.signatureRequests?.length || 0 }} registro{{ (signatureFlowState.snapshot?.signatureRequests?.length || 0) === 1 ? '' : 's' }}</AppTag>
              </div>
              <div v-if="!(signatureFlowState.snapshot?.signatureRequests?.length)" class="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
                No hay solicitudes de firma registradas para este entregable.
              </div>
              <div v-else class="mt-4 flex flex-col gap-3">
                <div
                  v-for="request in signatureFlowState.snapshot.signatureRequests"
                  :key="`workspace-history-signature-${request.id}`"
                  class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="m-0 text-sm font-bold text-slate-800">Paso {{ request.stepOrder }}</p>
                      <p class="m-0 mt-1 text-xs font-medium text-slate-500">
                        {{ request.assignedPerson ? `${request.assignedPerson.firstName || ''} ${request.assignedPerson.lastName || ''}`.trim() : 'Firmante no resuelto' }}
                        <span v-if="request.cargoName"> · {{ request.cargoName }}</span>
                      </p>
                    </div>
                    <AppTag :variant="signatureRequestTagVariant(request.requestStatusCode)">
                      {{ signatureRequestStatusLabel(request.requestStatusCode) }}
                    </AppTag>
                  </div>
                  <p class="m-0 mt-3 text-xs font-medium text-slate-500">
                    {{ request.respondedAt ? formatDateTime(request.respondedAt) : formatDateTime(request.requestedAt) }}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </template>
        <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600 text-center">
          No hay una sección disponible para este entregable.
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
              <div class="flex flex-wrap gap-2">
                <AppTag variant="neutral">
                  Paso {{ fillWorkflowState.request?.step_order || 1 }}
                </AppTag>
                <AppTag variant="info">
                  Estado: {{ fillWorkflowState.request?.status_name || fillWorkflowState.request?.status || 'pending' }}
                </AppTag>
                <AppTag :variant="fillWorkflowState.subject.preloadFilePath ? 'success' : 'warning'">
                  {{ fillWorkflowState.subject.preloadFilePath ? `Archivo: ${getFileNameFromPath(fillWorkflowState.subject.preloadFilePath)}` : 'Sin archivo de trabajo' }}
                </AppTag>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Secuencia del flujo</h3>
            <div v-if="!fillWorkflowState.subject?.workflow?.fill_steps?.length" class="text-sm text-slate-500">
              Este entregable todavía no tiene una secuencia de llenado visible.
            </div>
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="step in fillWorkflowState.subject.workflow.fill_steps"
                :key="`fill-step-${step.id}-${step.request_id || 'na'}`"
                class="relative overflow-hidden rounded-[1.6rem] border bg-white p-4 shadow-sm transition"
                :class="getFillStepCardClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"
              >
                <div class="absolute inset-x-0 top-0 h-3" :class="getFillStepAccentClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"></div>
                <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-slate-100 px-3 text-sm font-extrabold text-slate-700">
                      {{ step.step_order }}
                    </span>
                    <div class="flex flex-col gap-1">
                      <strong class="text-sm font-bold text-slate-800">Paso {{ step.step_order }}</strong>
                      <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Llenado</span>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2 justify-end">
                    <AppTag :variant="getFillStepStatusTagVariant(step.request_status)">
                      {{ getFillStepStatusLabel(step.request_status) }}
                    </AppTag>
                    <AppTag
                      v-if="fillWorkflowState.subject.workflow.fill_flow?.current_step_order === step.step_order"
                      variant="accent"
                    >
                      Actual
                    </AppTag>
                  </div>
                </div>
                <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Responsable</p>
                  <p class="mt-1 text-sm font-semibold text-slate-700 m-0 leading-snug">{{ step.display_label }}</p>
                </div>
                <div class="mt-3 rounded-2xl bg-slate-50/60 px-4 py-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Regla</p>
                  <p class="mt-1 text-xs font-medium text-slate-500 m-0">{{ getFillStepResolverLabel(step) }}</p>
                </div>
                <div v-if="step.response_note" class="mt-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Nota</p>
                  <p class="mt-1 mb-0 text-xs font-medium text-slate-600">{{ step.response_note }}</p>
                </div>
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
      ref="signatureFlowModal"
      labelled-by="signature-flow-modal-title"
      title="Flujo de firmas"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
      @close="closeSignatureFlowModal"
    >
      <div class="flex flex-col gap-5">
        <div v-if="signatureFlowState.loading" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
          Consultando la secuencia de firmas...
        </div>
        <div v-else-if="signatureFlowState.error" class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
          {{ signatureFlowState.error }}
        </div>
        <div v-else-if="signatureFlowState.snapshot" class="flex flex-col gap-5">
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
              <p class="text-xs uppercase tracking-wider font-semibold text-slate-500">Documento</p>
              <h3 class="text-lg font-bold text-slate-800 m-0">{{ signatureFlowState.subject?.title || 'Documento sin título' }}</h3>
              <div class="flex flex-wrap gap-2">
                <AppTag variant="neutral">
                  {{ signatureFlowState.subject?.documentId ? `Documento #${signatureFlowState.subject.documentId}` : 'Sin documento' }}
                </AppTag>
                <AppTag variant="muted">
                  {{ signatureFlowState.subject?.documentVersion ? `Versión v${signatureFlowState.subject.documentVersion}` : `v${signatureFlowState.subject?.documentVersionId || '—'}` }}
                </AppTag>
                <AppTag :variant="signatureFlowState.snapshot?.canOperate ? 'success' : 'warning'">
                  {{ signatureFlowState.snapshot?.signatureFlow?.statusCode ? signatureFlowState.snapshot.signatureFlow.statusCode : capitalize(signatureFlowState.snapshot?.currentStatus) || 'Pendiente' }}
                </AppTag>
              </div>
              <p class="text-xs text-slate-500">
                Estado documental: {{ capitalize(signatureFlowState.snapshot?.currentStatus) || 'Pendiente de firma' }}
              </p>
              <p v-if="!signatureFlowState.snapshot.readiness?.ok" class="text-xs text-rose-600">
                Motivo: {{ signatureFlowState.snapshot.readiness?.reason || 'Revisa el PDF o los firmantes.' }}
              </p>
            </section>
            <section class="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2 shadow-sm">
              <p class="text-xs uppercase tracking-wider font-semibold text-slate-500">Responsable actual</p>
              <p class="text-sm font-semibold text-slate-800 mb-0">
                {{ signatureFlowState.snapshot?.responsableActual
                  ? `${signatureFlowState.snapshot.responsableActual.firstName || ''} ${signatureFlowState.snapshot.responsableActual.lastName || ''}`.trim()
                  : 'Sin responsable resuelto' }}
              </p>
              <AppTag :variant="signatureFlowState.snapshot?.canOperate ? 'success' : 'muted'">
                {{ signatureFlowState.snapshot?.canOperate ? 'Puedes operar este paso' : 'Solo visualización' }}
              </AppTag>
              <p class="text-xs text-slate-500">
                Paso actual: {{ getCurrentSignatureStepOrder(signatureFlowState.snapshot) || '—' }}
              </p>
            </section>
            <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
              <p class="text-xs uppercase tracking-wider font-semibold text-slate-500">Secuencia</p>
              <p class="text-sm font-semibold text-slate-800 mb-0">{{ (signatureFlowState.snapshot.signatureSteps || []).length }} pasos sincronizados</p>
              <p class="text-xs text-slate-500">
                {{ signatureFlowState.snapshot.signatureRequests?.length || 0 }} solicitudes registradas
              </p>
              <p v-if="signatureFlowState.snapshot.readiness?.unresolvedRequiredSteps?.length" class="text-xs text-rose-600">
                Pasos sin firmantes: {{ signatureFlowState.snapshot.readiness.unresolvedRequiredSteps.map((step) => step.stepOrder).join(', ') }}
              </p>
            </section>
          </div>

          <section class="rounded-[1.8rem] border border-slate-200 bg-linear-to-br from-slate-50 via-white to-slate-100/70 p-4 flex flex-col gap-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Pasos del flujo</h3>
              <AppTag variant="muted">
                {{ (signatureFlowState.snapshot.signatureSteps || []).length }} pasos
              </AppTag>
            </div>
            <div v-if="!signatureFlowState.snapshot.signatureSteps?.length" class="text-sm text-slate-500">
              La definición todavía no tiene pasos de firma visibles.
            </div>
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="step in signatureFlowState.snapshot.signatureSteps"
                :key="`signature-step-${step.id || step.step_order}`"
                class="relative overflow-hidden rounded-[5%] border bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition"
                :class="getSignatureStepCardClass(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))"
              >
                <div class="absolute inset-x-0 top-0 h-3" :class="getSignatureStepAccentClass(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))"></div>
                <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-slate-100 px-3 text-sm font-extrabold text-slate-700">
                      {{ step.step_order || '—' }}
                    </span>
                    <div class="flex flex-col gap-1">
                      <p class="text-sm font-bold text-slate-800 m-0">Paso {{ step.step_order || '—' }}</p>
                      <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 m-0">Firma</p>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2 justify-end">
                    <AppTag
                      :variant="getSignatureStepStatusVariant(getSignatureStepStatusCode(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot)))"
                    >
                      {{ getSignatureStepStatusLabel(getSignatureStepStatusCode(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))) }}
                    </AppTag>
                    <AppTag :variant="step.assignees?.length ? 'success' : 'warning'">
                      {{ step.assignees?.length ? `${step.assignees.length} firmante(s)` : 'Sin responsables' }}
                    </AppTag>
                  </div>
                </div>
                <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Firmante</p>
                  <p class="mt-1 text-sm font-semibold text-slate-700 m-0 leading-snug">
                    {{ getSignatureStepAssignedSummary(step, signatureFlowState.snapshot.signatureRequests) }}
                  </p>
                </div>
                <div class="mt-3 rounded-2xl bg-slate-50/60 px-4 py-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Regla</p>
                  <p class="mt-1 text-xs font-medium text-slate-500 m-0">
                    {{ getSignatureStepResolverLabel(step) }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Historial y trazabilidad</h3>
              <AppTag variant="neutral">
                {{ signatureFlowState.snapshot.signatureRequests?.length || 0 }} registros
              </AppTag>
            </div>
            <div v-if="!signatureFlowState.snapshot.signatureRequests?.length" class="text-sm text-slate-500">
              Aún no se ha registrado actividad sobre este flujo.
            </div>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="request in signatureFlowState.snapshot.signatureRequests"
                :key="`flow-request-${request.id}`"
                class="rounded-2xl border border-slate-100 bg-white p-3 flex flex-col gap-1"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-slate-800 m-0">Paso {{ request.stepOrder }}</p>
                  <AppTag :variant="signatureRequestTagVariant(request.requestStatusCode)">
                    {{ signatureRequestStatusLabel(request.requestStatusCode) }}
                  </AppTag>
                </div>
                <p class="text-xs text-slate-500 m-0">
                  {{ request.assignedPerson ? `${request.assignedPerson.firstName || ''} ${request.assignedPerson.lastName || ''}`.trim() : 'Firmante no resuelto' }}
                  · Cargo {{ request.cargoName || '—' }}
                </p>
                <p class="text-xs text-slate-500 m-0">
                  {{ request.respondedAt ? formatDateTime(request.respondedAt) : formatDateTime(request.requestedAt) }}
                </p>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-4">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Firmar documento</h3>
                <p class="text-xs text-slate-500 m-0">Utiliza el visor integrado para completar tu paso actual.</p>
              </div>
              <AppTag :variant="signatureFlowState.snapshot?.canOperate ? 'success' : 'muted'">
                {{ signatureFlowState.snapshot?.canOperate ? 'Listo para operar' : 'Acceso en modo lectura' }}
              </AppTag>
            </div>
            <div v-if="signatureFlowState.snapshot?.canOperate">
              <FirmarPdf ref="signatureFlowSignerRef" embedded @workflow-signed="handleEmbeddedWorkflowSigned" />
            </div>
            <div v-else class="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              No hay firmas pendientes para tu usuario o el paso aún no está listo para operar.
            </div>
          </section>
        </div>
        <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600 text-center">
          Selecciona una solicitud de firma para revisar su flujo.
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverableUploadModal"
      labelled-by="deliverable-upload-modal-title"
      :title="deliverableUploadModalTitle"
      size="md"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {{ deliverableUploadModalHelp }}
        </div>

        <PdfDropField
          variant="card"
          title="Archivo de trabajo"
          action-text="Seleccionar o arrastrar archivo"
          help-text="Formatos permitidos: PDF, Word y Excel."
          :icon="IconUpload"
          accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          :disabled="isUploadingDeliverable"
          :selected-file="selectedDeliverableUploadFile"
          input-id="dashboard-deliverable-upload"
          @files-selected="handleDeliverableFilesSelected"
          @clear="clearDeliverableUploadSelection"
        />
      </div>
      <template #footer>
        <AppButton variant="secondary" :disabled="isUploadingDeliverable" @click="closeDeliverableUploadModal">
          Cancelar
        </AppButton>
        <AppButton variant="primary" :disabled="!selectedDeliverableUploadFile || isUploadingDeliverable" @click="submitDeliverableUpload">
          {{ isUploadingDeliverable ? 'Subiendo archivo...' : 'Subir archivo' }}
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
      ref="deliverableSignResultModal"
      labelled-by="deliverable-sign-result-modal-title"
      :title="deliverableSignResultState.success ? 'Documento firmado' : 'Error al firmar'"
      size="md"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div v-if="deliverableSignResultState.success" class="flex flex-col gap-4">
        <p class="mb-0 text-sm text-emerald-700 font-medium">
          {{ deliverableSignResultState.message || 'La firma del entregable se registró correctamente.' }}
        </p>
        <div v-if="deliverableSignResultState.signedPath" class="flex flex-wrap gap-3">
          <AppButton variant="outlinePrimary" @click="viewSignedDeliverableResult">
            Visualizar documento
          </AppButton>
          <AppButton variant="primary" @click="downloadSignedDeliverableResult">
            Descargar documento
          </AppButton>
        </div>
      </div>
      <p v-else class="mb-0 text-sm text-rose-700 font-medium">
        {{ deliverableSignResultState.message || 'No se pudo completar la firma.' }}
      </p>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverableResetModal"
      labelled-by="deliverable-reset-modal-title"
      title="Resetear flujo del entregable"
      size="md"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
      @close="closeDeliverableResetModal"
    >
      <div class="flex flex-col gap-4">
        <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Este reset cancelará el intento actual y creará una nueva versión documental para volver al inicio del flujo.
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p class="m-0 font-semibold text-slate-700">
            {{ deliverableResetState.target?.title || 'Entregable seleccionado' }}
          </p>
          <p class="mt-2 mb-0">
            La versión actual quedará como histórico cancelado. La nueva versión empezará desde cero y el documento no conservará el archivo de trabajo previo.
          </p>
        </div>
        <p v-if="deliverableResetState.error" class="m-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {{ deliverableResetState.error }}
        </p>
      </div>
      <template #footer>
        <AppButton variant="secondary" :disabled="deliverableResetState.submitting" @click="closeDeliverableResetModal">
          Cancelar
        </AppButton>
        <AppButton variant="warning" :disabled="deliverableResetState.submitting" @click="submitDeliverableReset">
          {{ deliverableResetState.submitting ? 'Reseteando...' : 'Resetear flujo' }}
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

    <WorkspaceChatLauncher :current-person-id="currentUser?.id || currentUser?._id || null" />

  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppWorkspaceHeader from '@/layouts/headers/AppWorkspaceHeader.vue';
import AppWorkspaceSidebar from '@/layouts/menus/AppWorkspaceSidebar.vue';
import SBody from '@/layouts/core/SBody.vue';
import SMessage from '@/layouts/core/SNotify.vue';
import SNavMenu from '@/layouts/menus/SNavMenu.vue';
import AppDataTable from '@/shared/components/data/AppDataTable.vue';
import AppPageIntro from '@/shared/components/layout/AppPageIntro.vue';
import AppTag from '@/shared/components/data/AppTag.vue';
import FirmarPdf from '@/modules/firmas/components/FirmarPdf.vue';
import UserMenuService from '@/core/services/UserMenuService.js';
import ProcessDefinitionPanelService from '@/core/services/ProcessDefinitionPanelService.js';
import SignatureFlowService from '@/modules/firmas/services/SignatureFlowService.js';
import { API_ROUTES } from '@/core/config/apiConfig';
import { Modal } from '@/shared/utils/modalController';
import AdminModalShell from '@/shared/components/modals/AppModalShell.vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';
import PdfDropField from '@/modules/firmas/components/PdfDropField.vue';
import WorkspaceChatLauncher from '@/shared/components/widgets/WorkspaceChatLauncher.vue';

import {
  IconGlobe,
  IconLock,
  IconCertificate,
  IconIdBadge,
  IconMapPins,
  IconUser,
  IconCircleCheck,
  IconDownload,
  IconFileDescription,
  IconEye,
  IconSquareCheck,
  IconSignature,
  IconUpload,
  IconArrowRight,
  IconBuildingMonument,
  IconChevronDown,
  IconMessages,
  IconMinus,
  IconPlayerPlayFilled,
  IconPlus,
  IconChecklist,
  IconSearch
} from '@tabler/icons-vue';

const router = useRouter();
const route = useRoute();
const menuService = new UserMenuService();
const processPanelService = new ProcessDefinitionPanelService();
const signatureFlowService = new SignatureFlowService();
const WORKSPACE_CHAT_CONTEXT_KEY = 'deasy_workspace_chat_context';

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
const showGroupDropdown = ref(false);
const groupDropdownRef = ref(null);
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
const signatureFlowModal = ref(null);
const documentCenterModal = ref(null);
const fillWorkflowModal = ref(null);
const deliverableUploadModal = ref(null);
const deliverableWorkspaceModal = ref(null);
const deliverableOperationModal = ref(null);
const deliverableSignResultModal = ref(null);
const deliverablePreviewModal = ref(null);
const deliverableResetModal = ref(null);
const embeddedSignerRef = ref(null);
const signatureFlowSignerRef = ref(null);
const pendingDeliverableUploadTarget = ref(null);
const selectedDeliverableUploadFile = ref(null);
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
const deliverableSignResultState = ref({
  success: true,
  message: '',
  signedPath: '',
  fileName: 'documento_firmado.pdf',
});
const deliverableResetState = ref({
  target: null,
  submitting: false,
  error: '',
});
const fillWorkflowState = ref({
  subject: null,
  request: null,
  note: '',
  error: ''
});
const deliverableWorkspaceState = ref({
  tab: 'summary'
});
const signatureFlowState = ref({
  loading: false,
  error: '',
  subject: null,
  documentVersionId: null,
  snapshot: null
});
let documentSignModalInstance = null;
let signatureFlowModalInstance = null;
let documentCenterModalInstance = null;
let fillWorkflowModalInstance = null;
let deliverableUploadModalInstance = null;
let deliverableWorkspaceModalInstance = null;
let deliverableOperationModalInstance = null;
let deliverableSignResultModalInstance = null;
let deliverablePreviewModalInstance = null;
let deliverableResetModalInstance = null;
const taskLaunchForm = ref({
  description: '',
  term_id: '',
  custom_name: '',
  custom_start_date: '',
  custom_end_date: ''
});
const taskLaunchStep = ref(1);
const taskLaunchSteps = [
  { id: 1, label: 'Contexto' },
  { id: 2, label: 'Base documental' },
  { id: 3, label: 'Confirmación' }
];
const taskListFilters = ref({
  query: '',
  year: 'all',
  term: 'all',
  termType: 'all',
  unit: 'all',
  process: 'all',
  status: 'all'
});
const showAdvancedTaskFilters = ref(false);

const userFullName = computed(() => {
  if (!currentUser.value) return 'Usuario';
  const firstName = currentUser.value.first_name ?? '';
  const lastName = currentUser.value.last_name ?? '';
  return `${firstName} ${lastName}`.trim() || 'Usuario';
});
const deliverableWorkspaceSubject = computed(() => fillWorkflowState.value.subject || signatureFlowState.value.subject || null);

const menuContextLabel = computed(() => {
  if (selectedGroupId.value) {
    const group = unitGroups.value.find((item) => item.id === selectedGroupId.value);
    return group ? `Área: ${group.label || group.name}` : 'Área seleccionada';
  }
  return 'Cargos consolidados';
});

const selectedGroupLabel = computed(() => {
  if (!selectedGroupId.value) return 'Consolidado';
  const group = unitGroups.value.find((item) => String(item.id) === String(selectedGroupId.value));
  return group?.label || group?.name || 'Área seleccionada';
});

const deliverableUploadSubject = computed(() => getDeliverableSubject(pendingDeliverableUploadTarget.value));
const deliverableUploadModalTitle = computed(() => {
  const subject = deliverableUploadSubject.value;
  return subject?.title ? `Cargar archivo · ${subject.title}` : 'Cargar archivo del entregable';
});
const deliverableUploadModalHelp = computed(() => {
  const subject = deliverableUploadSubject.value;
  if (!subject) {
    return 'Selecciona el archivo de trabajo que quieres cargar para el entregable.';
  }
  return `Carga el archivo de trabajo para ${subject.title || subject.template_artifact_name || `#${subject.itemId || subject.id}`}.`;
});

const isSigningView = ref(false);

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

const getStatusTagVariant = (statusClass) => {
  if (statusClass === 'status--warning') return 'warning';
  if (statusClass === 'status--danger') return 'danger';
  if (statusClass === 'status--success') return 'success';
  return 'neutral';
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
  isSigningView.value = false;
  selectedGroupId.value = null;
  showGroupDropdown.value = false;
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
  isSigningView.value = false;
  selectedGroupId.value = group?.id ?? null;
  showGroupDropdown.value = false;
  applyMenuCargos(buildGroupCargos(group));
  if (!showMenu.value) {
    showMenu.value = true;
  }
};

const toggleGroupDropdown = () => {
  showGroupDropdown.value = !showGroupDropdown.value;
};

const selectGroupOption = (group) => {
  if (!group) {
    selectConsolidated();
    return;
  }
  selectGroup(group);
};

const handleGroupDropdownOutsideClick = (event) => {
  if (!showGroupDropdown.value) return;
  if (!groupDropdownRef.value) return;
  if (groupDropdownRef.value.contains(event.target)) return;
  showGroupDropdown.value = false;
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

const iconForProcessAccess = (process = {}) => {
  if (process?.access_source === 'flow') return IconArrowRight;
  return iconForProcess(process?.name || '');
};

const iconForUnitGroup = (group) => {
  const label = `${group?.label ?? ''} ${group?.name ?? ''}`.toLowerCase();
  if (label.includes('univers')) return IconGlobe;
  if (label.includes('facult')) return IconMapPins;
  if (label.includes('carrera')) return IconCertificate;
  if (label.includes('depart')) return IconIdBadge;
  return IconIdBadge;
};

const resolveUnitNameById = (unitId) => {
  const normalized = Number(unitId || 0);
  if (!normalized) return '';
  const directUnit = userUnits.value.find((unit) => Number(unit.id) === normalized);
  if (directUnit) {
    return directUnit.label || directUnit.name || '';
  }
  for (const group of unitGroups.value) {
    const nestedUnit = (group?.units || []).find((unit) => Number(unit.id) === normalized);
    if (nestedUnit) {
      return nestedUnit.label || nestedUnit.name || '';
    }
  }
  return '';
};

const resetTaskLaunchForm = () => {
  taskLaunchForm.value = {
    description: '',
    term_id: '',
    custom_name: '',
    custom_start_date: '',
    custom_end_date: ''
  };
  taskLaunchStep.value = 1;
  taskLaunchUseCustomTerm.value = false;
  taskLaunchSubmitting.value = false;
  taskLaunchError.value = '';
};

const resetTaskListFilters = () => {
  taskListFilters.value = {
    query: '',
    year: 'all',
    term: 'all',
    termType: 'all',
    unit: 'all',
    process: 'all',
    status: 'all'
  };
  showAdvancedTaskFilters.value = false;
};

const clearSelectedProcess = () => {
  selectedProcessKey.value = null;
  selectedProcessContext.value = null;
  selectedProcessPanel.value = null;
  processPanelError.value = '';
  processActionMessage.value = null;
  showTaskLaunchModal.value = false;
  resetTaskListFilters();
  resetTaskLaunchForm();
};

const currentUserId = computed(() => currentUser.value?.id ?? currentUser.value?._id ?? null);

const taskLaunchSystemTemplates = computed(() =>
  (selectedProcessPanel.value?.dependencies?.templates || [])
    .filter((template) =>
      Number(template.creates_task) === 1
      && String(template.artifact_origin || '').trim().toLowerCase() === 'process'
    )
);

const taskLaunchSelectedTermLabel = computed(() => {
  if (taskLaunchUseCustomTerm.value) {
    return taskLaunchForm.value.custom_name || 'Periodo custom';
  }
  const currentTermId = Number(taskLaunchForm.value.term_id || 0);
  if (!currentTermId) {
    return 'Sin periodo seleccionado';
  }
  const term = (selectedProcessPanel.value?.available_terms || []).find((item) => Number(item.id) === currentTermId);
  if (!term) {
    return 'Periodo seleccionado';
  }
  return `${term.name} · ${term.term_type_name}`;
});

const taskFilterYears = computed(() => {
  const years = new Set();
  (selectedProcessPanel.value?.tasks || []).forEach((task) => {
    const source = String(task.term_name || task.start_date || task.end_date || '');
    const match = source.match(/(20\d{2})/);
    if (match?.[1]) {
      years.add(match[1]);
    }
  });
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
});

const taskFilterTerms = computed(() => {
  const map = new Map();
  (selectedProcessPanel.value?.tasks || []).forEach((task) => {
    const value = String(task.term_id || task.term_name || task.id);
    const label = task.term_name || `Tarea ${task.id}`;
    if (!map.has(value)) {
      map.set(value, { value, label });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
});

const taskFilterTermTypes = computed(() => {
  const types = new Set(
    (selectedProcessPanel.value?.tasks || [])
      .map((task) => String(task.term_type_name || '').trim())
      .filter(Boolean)
  );
  return Array.from(types).sort((a, b) => a.localeCompare(b));
});

const taskFilterUnits = computed(() => {
  const values = new Set();
  (selectedProcessPanel.value?.tasks || []).forEach((task) => {
    const taskUnitName = resolveUnitNameById(selectedProcessContext.value?.unit_id);
    if (taskUnitName) values.add(taskUnitName);
    (task.items || []).forEach((item) => {
      const itemUnitName = resolveUnitNameById(item.scope_unit_id || selectedProcessContext.value?.unit_id);
      if (itemUnitName) values.add(itemUnitName);
    });
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
});

const taskFilterProcesses = computed(() => {
  const processName = String(
    selectedProcessPanel.value?.definition?.process_name
    || selectedProcessContext.value?.name
    || ''
  ).trim();
  return processName ? [processName] : [];
});

const taskFilterStatuses = computed(() => {
  const statuses = new Set(
    (selectedProcessPanel.value?.tasks || [])
      .map((task) => String(task.status || '').trim())
      .filter(Boolean)
  );
  return Array.from(statuses).sort((a, b) => a.localeCompare(b));
});

const filteredProcessTasks = computed(() => {
  const query = String(taskListFilters.value.query || '').trim().toLowerCase();
  return (selectedProcessPanel.value?.tasks || []).filter((task) => {
    const taskYearSource = String(task.term_name || task.start_date || task.end_date || '');
    const yearMatch = taskYearSource.match(/(20\d{2})/);
    const taskYear = yearMatch?.[1] || '';
    const matchesYear = taskListFilters.value.year === 'all' || taskYear === taskListFilters.value.year;
    const matchesTerm = taskListFilters.value.term === 'all' || String(task.term_id || task.term_name || task.id) === taskListFilters.value.term;
    const matchesTermType = taskListFilters.value.termType === 'all' || String(task.term_type_name || '').trim() === taskListFilters.value.termType;
    const unitLabels = [
      resolveUnitNameById(selectedProcessContext.value?.unit_id),
      ...(task.items || []).map((item) => resolveUnitNameById(item.scope_unit_id || selectedProcessContext.value?.unit_id))
    ]
      .filter(Boolean)
      .map((value) => String(value).trim());
    const matchesUnit = taskListFilters.value.unit === 'all' || unitLabels.includes(taskListFilters.value.unit);
    const processLabel = String(selectedProcessPanel.value?.definition?.process_name || selectedProcessContext.value?.name || '').trim();
    const matchesProcess = taskListFilters.value.process === 'all' || processLabel === taskListFilters.value.process;
    const matchesStatus = taskListFilters.value.status === 'all' || String(task.status || '').trim() === taskListFilters.value.status;
    const haystack = [
      task.term_name,
      task.term_type_name,
      task.description,
      ...(task.items || []).map((item) => item.template_artifact_name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesYear && matchesTerm && matchesTermType && matchesUnit && matchesProcess && matchesStatus && matchesQuery;
  });
});

const filteredProcessDeliverables = computed(() =>
  filteredProcessTasks.value.flatMap((task) =>
    (task.items || []).map((item) => ({
      key: `${task.id}-${item.id}`,
      task,
      item
    }))
  )
);

const canAdvanceTaskLaunchStep = computed(() => {
  if (taskLaunchSubmitting.value) {
    return false;
  }
  if (taskLaunchStep.value === 1) {
    if (taskLaunchUseCustomTerm.value) {
      return Boolean(
        taskLaunchForm.value.custom_name
        && taskLaunchForm.value.custom_start_date
        && taskLaunchForm.value.custom_end_date
      );
    }
    return Boolean(taskLaunchForm.value.term_id);
  }
  return true;
});

const canSubmitTaskLaunch = computed(() => {
  if (
    !selectedProcessPanel.value?.permissions?.can_launch_manual
    || taskLaunchSubmitting.value
    || taskLaunchStep.value !== taskLaunchSteps.length
  ) {
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

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const capitalize = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};

const signatureRequestStatusLabel = (statusCode) => {
  const normalized = String(statusCode || '').trim().toLowerCase();
  switch (normalized) {
    case 'completado':
      return 'Firmado';
    case 'rechazado':
      return 'Rechazado';
    case 'cancelado':
      return 'Cancelado';
    case 'en_progreso':
      return 'En progreso';
    case 'pendiente':
      return 'Pendiente';
    default:
      return capitalize(normalized) || 'Pendiente';
  }
};

const signatureRequestTagVariant = (statusCode) => {
  const normalized = String(statusCode || '').trim().toLowerCase();
  if (['completado'].includes(normalized)) {
    return 'success';
  }
  if (['rechazado', 'cancelado'].includes(normalized)) {
    return 'danger';
  }
  if (['en_progreso', 'pendiente'].includes(normalized)) {
    return 'warning';
  }
  return 'muted';
};

const getCurrentSignatureStepOrder = (snapshot) => {
  const explicit = Number(snapshot?.currentSignatureStepOrder || 0);
  if (explicit > 0) return explicit;

  const requests = Array.isArray(snapshot?.signatureRequests) ? snapshot.signatureRequests : [];
  const pendingLike = requests
    .filter((request) => ['pendiente', 'en_progreso'].includes(String(request?.requestStatusCode || '').trim().toLowerCase()))
    .sort((a, b) => Number(a?.stepOrder || 0) - Number(b?.stepOrder || 0));
  if (pendingLike.length) {
    return Number(pendingLike[0]?.stepOrder || 0) || null;
  }

  const completed = requests
    .filter((request) => String(request?.requestStatusCode || '').trim().toLowerCase() === 'completado')
    .sort((a, b) => Number(b?.stepOrder || 0) - Number(a?.stepOrder || 0));
  if (completed.length) {
    return Number(completed[0]?.stepOrder || 0) || null;
  }

  return null;
};

const getSignatureStepStatusCode = (step, requests = [], currentStepOrder = null) => {
  const stepOrder = Number(step?.step_order || step?.stepOrder || 0);
  const relatedRequests = (requests || []).filter((request) => Number(request?.stepOrder || 0) === stepOrder);
  if (!relatedRequests.length) {
    return 'unresolved';
  }

  const codes = relatedRequests.map((request) => String(request?.requestStatusCode || '').trim().toLowerCase());
  if (codes.some((code) => ['rechazado', 'cancelado'].includes(code))) {
    return 'rejected';
  }
  if (codes.every((code) => code === 'completado')) {
    return 'completed';
  }
  if (currentStepOrder && stepOrder === Number(currentStepOrder)) {
    return 'current';
  }
  if (codes.some((code) => code === 'en_progreso')) {
    return 'current';
  }
  return 'pending';
};

const getSignatureStepStatusLabel = (statusCode) => {
  switch (String(statusCode || '').trim().toLowerCase()) {
    case 'completed':
      return 'Firmado';
    case 'current':
      return 'En curso';
    case 'rejected':
      return 'Rechazado';
    case 'pending':
      return 'Pendiente';
    case 'unresolved':
      return 'Sin responsables';
    default:
      return 'Pendiente';
  }
};

const getSignatureStepStatusVariant = (statusCode) => {
  switch (String(statusCode || '').trim().toLowerCase()) {
    case 'completed':
      return 'success';
    case 'current':
      return 'info';
    case 'rejected':
      return 'danger';
    case 'pending':
    case 'unresolved':
      return 'warning';
    default:
      return 'muted';
  }
};

const getSignatureStepCardClass = (step, requests = [], currentStepOrder = null) => {
  const statusCode = getSignatureStepStatusCode(step, requests, currentStepOrder);
  switch (statusCode) {
    case 'completed':
      return 'border-emerald-200 bg-linear-to-br from-emerald-50/80 via-white to-emerald-100/40';
    case 'current':
      return 'border-sky-200 bg-linear-to-br from-sky-50/80 via-white to-sky-100/50';
    case 'rejected':
      return 'border-rose-200 bg-linear-to-br from-rose-50/80 via-white to-rose-100/40';
    case 'pending':
    case 'unresolved':
      return 'border-amber-200 bg-linear-to-br from-amber-50/80 via-white to-amber-100/35';
    default:
      return 'border-slate-200 bg-linear-to-br from-slate-50/90 via-white to-slate-100/60';
  }
};

const getSignatureStepAccentClass = (step, requests = [], currentStepOrder = null) => {
  const statusCode = getSignatureStepStatusCode(step, requests, currentStepOrder);
  switch (statusCode) {
    case 'completed':
      return 'bg-linear-to-r from-emerald-300 via-emerald-400 to-green-300';
    case 'current':
      return 'bg-linear-to-r from-sky-300 via-sky-400 to-cyan-300';
    case 'rejected':
      return 'bg-linear-to-r from-rose-300 via-rose-400 to-red-300';
    case 'pending':
    case 'unresolved':
      return 'bg-linear-to-r from-amber-300 via-amber-400 to-orange-300';
    default:
      return 'bg-linear-to-r from-slate-200 via-slate-300 to-slate-200';
  }
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

const prettifyArtifactRole = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'primary') return 'Principal';
  if (normalized === 'attachment') return 'Adjunto';
  if (normalized === 'support') return 'Soporte';
  return value || 'Principal';
};

const getDeliverableProcessLabel = (_task = null, item = null) =>
  item?.process_label
  || item?.processLabel
  || selectedProcessPanel.value?.definition?.process_name
  || selectedProcessContext.value?.name
  || 'Proceso';

const getDeliverableUnitLabel = (item) =>
  resolveUnitNameById(item?.scope_unit_id || item?.scopeUnitId || selectedProcessContext.value?.unit_id)
  || selectedProcessContext.value?.label
  || selectedProcessContext.value?.name
  || 'Unidad no definida';

const getDeliverablePeriodLabel = (task) => task?.term_name || 'Periodo no definido';

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
    resetTaskListFilters();
  } catch (error) {
    console.error('Error al cargar el panel operativo de la definición:', error);
    selectedProcessPanel.value = null;
    processPanelError.value = error?.response?.data?.message || 'No se pudo cargar la definición seleccionada.';
  } finally {
    processPanelLoading.value = false;
  }
};

const handleProcessSelect = async (process) => {
  isSigningView.value = false;
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

const showGeneralTaskInfo = () => {
  setProcessActionInfo(
    'La creación de tareas generales todavía no tiene backend habilitado en este dashboard. El siguiente paso es conectar este botón al flujo de artifacts generales y entregables personalizados.',
    'error'
  );
};

const showProcessDeliverableInfo = () => {
  setProcessActionInfo(
    'La creación personalizada de entregables dentro de una definición de proceso quedó visible como punto de entrada, pero aún falta su backend y el flujo de artifact general asociado.',
    'error'
  );
};

const showSignatureQueueInfo = () => {
  setProcessActionInfo(
    'El acceso consolidado a la bandeja de firmas de esta definición todavía no está conectado desde este hero. Por ahora el ingreso operativo sigue ocurriendo desde cada entregable.',
    'error'
  );
};

const goToNextTaskLaunchStep = () => {
  if (!canAdvanceTaskLaunchStep.value) {
    return;
  }
  taskLaunchStep.value = Math.min(taskLaunchStep.value + 1, taskLaunchSteps.length);
};

const goToPreviousTaskLaunchStep = () => {
  taskLaunchStep.value = Math.max(taskLaunchStep.value - 1, 1);
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
    document.addEventListener('click', handleGroupDropdownOutsideClick);
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
  if (deliverableWorkspaceModal.value?.el) {
    deliverableWorkspaceModalInstance = Modal.getOrCreateInstance(deliverableWorkspaceModal.value.el);
    deliverableWorkspaceModal.value.el.addEventListener('hidden.bs.modal', () => {
      fillWorkflowState.value = {
        subject: null,
        request: null,
        note: '',
        error: ''
      };
      signatureFlowState.value = {
        loading: false,
        error: '',
        subject: null,
        documentVersionId: null,
        snapshot: null
      };
      deliverableWorkspaceState.value = { tab: 'summary' };
    });
  }
  if (deliverableUploadModal.value?.el) {
    deliverableUploadModalInstance = Modal.getOrCreateInstance(deliverableUploadModal.value.el);
    deliverableUploadModal.value.el.addEventListener('hidden.bs.modal', () => {
      selectedDeliverableUploadFile.value = null;
      pendingDeliverableUploadTarget.value = null;
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
  if (deliverableSignResultModal.value?.el) {
    deliverableSignResultModalInstance = Modal.getOrCreateInstance(deliverableSignResultModal.value.el);
    deliverableSignResultModal.value.el.addEventListener('hidden.bs.modal', () => {
      deliverableSignResultState.value = {
        success: true,
        message: '',
        signedPath: '',
        fileName: 'documento_firmado.pdf',
      };
    });
  }
  
  await loadUserMenu();
});

watch(
  taskLaunchUseCustomTerm,
  (enabled) => {
    if (enabled) {
      taskLaunchForm.value.term_id = '';
      return;
    }
    taskLaunchForm.value.custom_name = '';
    taskLaunchForm.value.custom_start_date = '';
    taskLaunchForm.value.custom_end_date = '';
  }
);

watch(
  () => route.fullPath,
  async () => {
    if (route.path !== '/dashboard') return;
    await loadUserMenu();
  }
);

onBeforeUnmount(() => {
  if (isClient) {
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('click', handleGroupDropdownOutsideClick);
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
      isSigningView.value = true;
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

const sanitizeEmbeddedSignSuccessMessage = (message) => {
  const raw = String(message || '').trim();
  if (!raw) {
    return 'La firma del entregable se registró correctamente.';
  }
  const warningIndex = raw.indexOf(' Advertencia: ');
  if (warningIndex > -1) {
    return raw.slice(0, warningIndex).trim();
  }
  return raw;
};

const openDeliverableSignResultModal = (payload = {}) => {
  deliverableSignResultState.value = {
    success: payload.success !== false,
    message: payload.message || 'La firma del entregable se registró correctamente.',
    signedPath: payload.signedPath || '',
    fileName: payload.fileName || 'documento_firmado.pdf',
  };
  deliverableSignResultModalInstance = Modal.getOrCreateInstance(deliverableSignResultModal.value?.el);
  deliverableSignResultModalInstance?.show();
};

const openDeliverableResetModal = (payload) => {
  deliverableResetState.value = {
    target: getDeliverableSubject(payload),
    submitting: false,
    error: '',
  };
  deliverableResetModalInstance = Modal.getOrCreateInstance(deliverableResetModal.value?.el);
  deliverableResetModalInstance?.show();
};

const closeDeliverableResetModal = () => {
  deliverableResetState.value = {
    target: null,
    submitting: false,
    error: '',
  };
  deliverableResetModalInstance?.hide();
};

const openDeliverableUploadModal = (payload) => {
  pendingDeliverableUploadTarget.value = payload;
  selectedDeliverableUploadFile.value = null;
  deliverableUploadModalInstance = Modal.getOrCreateInstance(deliverableUploadModal.value?.el);
  deliverableUploadModalInstance?.show();
};

const closeDeliverableUploadModal = () => {
  deliverableUploadModalInstance?.hide();
};

const loadFillWorkflowState = (payload = {}) => {
  const subject = getDeliverableSubject(payload);
  const request = getCurrentFillWorkflowRequest(payload);
  fillWorkflowState.value = {
    subject,
    request,
    note: '',
    error: ''
  };
};

const openFillWorkflowModal = (payload = {}) => {
  loadFillWorkflowState(payload);
  fillWorkflowModalInstance = Modal.getOrCreateInstance(fillWorkflowModal.value?.el);
  fillWorkflowModalInstance?.show();
};

const getDeliverableSubject = (payload = {}) => {
  const documentPayload = payload?.document || payload;
  const workingFilePath = documentPayload?.working_file_path || documentPayload?.workingFilePath || payload?.workingFilePath || '';
  const finalFilePath = documentPayload?.final_file_path || documentPayload?.finalFilePath || payload?.finalFilePath || '';
  const preloadFilePath = finalFilePath || workingFilePath;
  const preloadPdfPath = [finalFilePath, workingFilePath].find((value) => canPreviewInline(value)) || '';
  return {
    id: payload?.id || documentPayload?.id || documentPayload?.task_item_id || null,
    itemId: payload?.id || payload?.itemId || documentPayload?.task_item_id || documentPayload?.itemId || null,
    taskId: payload?.task_id || payload?.taskId || documentPayload?.task_id || documentPayload?.taskId || null,
    documentId: documentPayload?.document_id || documentPayload?.documentId || payload?.documentId || null,
    documentVersionId: documentPayload?.document_version_id || documentPayload?.documentVersionId || payload?.documentVersionId || null,
    documentVersion: documentPayload?.document_version || documentPayload?.documentVersion || payload?.documentVersion || null,
    processId:
      payload?.process_id
      || payload?.processId
      || payload?.workflow?.process_id
      || payload?.workflow?.processId
      || selectedProcessPanel.value?.definition?.chat_context?.process_id
      || selectedProcessPanel.value?.definition?.process_id
      || null,
    scopeUnitId:
      payload?.scope_unit_id
      || documentPayload?.scope_unit_id
      || payload?.scopeUnitId
      || documentPayload?.scopeUnitId
      || selectedProcessContext.value?.unit_id
      || null,
    title: payload?.title || payload?.template_artifact_name || documentPayload?.title || documentPayload?.template_artifact_name || `Entregable #${payload?.id || documentPayload?.document_id || 's/n'}`,
    templateArtifactName: payload?.template_artifact_name || payload?.templateArtifactName || documentPayload?.template_artifact_name || documentPayload?.templateArtifactName || '',
    actions: payload?.actions || documentPayload?.actions || {},
    workflow: payload?.workflow || documentPayload?.workflow || {},
    status: payload?.status || payload?.status_name || payload?.statusName || documentPayload?.status || documentPayload?.status_name || documentPayload?.statusName || '',
    documentStatus: payload?.document_status || payload?.documentStatus || documentPayload?.document_status || documentPayload?.documentStatus || '',
    pendingFillCount: payload?.pending_fill_count || payload?.pendingFillCount || documentPayload?.pending_fill_count || documentPayload?.pendingFillCount || 0,
    pendingSignatureCount: payload?.pending_signature_count || payload?.pendingSignatureCount || documentPayload?.pending_signature_count || documentPayload?.pendingSignatureCount || 0,
    taskStartDate: payload?.task_start_date || payload?.taskStartDate || payload?.start_date || payload?.startDate || null,
    taskEndDate: payload?.task_end_date || payload?.taskEndDate || payload?.end_date || payload?.endDate || null,
    periodLabel: payload?.period_label || payload?.periodLabel || '',
    unitLabel: payload?.unit_label || payload?.unitLabel || '',
    processLabel: payload?.process_label || payload?.processLabel || '',
    workingFilePath,
    finalFilePath,
    preloadFilePath,
    preloadPdfPath
  };
};

const resolvePreferredChatScopeUnitId = (payload = null) => {
  const subject = payload ? getDeliverableSubject(payload) : null;
  if (subject?.scopeUnitId) {
    return Number(subject.scopeUnitId);
  }
  const scopeIds = Array.isArray(selectedProcessPanel.value?.definition?.chat_context?.accessible_scope_unit_ids)
    ? selectedProcessPanel.value.definition.chat_context.accessible_scope_unit_ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  if (scopeIds.length === 1) {
    return scopeIds[0];
  }
  return null;
};

const persistWorkspaceChatContext = ({ processId, scopeUnitId = null, title = '', accessibleScopeUnitIds = [] } = {}) => {
  if (typeof window === 'undefined') return;
  const normalizedProcessId = Number(processId || 0) || null;
  if (!normalizedProcessId) {
    window.sessionStorage.removeItem(WORKSPACE_CHAT_CONTEXT_KEY);
    return;
  }

  const nextValue = {
    processId: normalizedProcessId,
    scopeUnitId: Number(scopeUnitId || 0) || null,
    title: String(title || ''),
    accessibleScopeUnitIds: Array.isArray(accessibleScopeUnitIds) ? accessibleScopeUnitIds : []
  };

  window.sessionStorage.setItem(WORKSPACE_CHAT_CONTEXT_KEY, JSON.stringify(nextValue));
  window.dispatchEvent(new CustomEvent('workspace-chat:context-updated', { detail: nextValue }));
};

const openWorkspaceProcessChat = ({ processId, scopeUnitId = null, openConversation = false } = {}) => {
  const normalizedProcessId = Number(processId || 0) || null;
  if (!normalizedProcessId) {
    setProcessActionInfo('No se pudo resolver el proceso asociado al chat.', 'error');
    return;
  }

  const detail = {
    processId: normalizedProcessId,
    scopeUnitId: Number(scopeUnitId || 0) || null,
    title: selectedProcessPanel.value?.definition?.name || selectedProcessContext.value?.name || 'Proceso',
    accessibleScopeUnitIds: Array.isArray(selectedProcessPanel.value?.definition?.chat_context?.accessible_scope_unit_ids)
      ? selectedProcessPanel.value.definition.chat_context.accessible_scope_unit_ids
      : [],
    openConversation
  };

  persistWorkspaceChatContext(detail);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workspace-chat:open-process', { detail }));
  }
};

watch(
  () => [
    selectedProcessPanel.value?.definition?.chat_context?.process_id,
    selectedProcessPanel.value?.definition?.chat_context?.accessible_scope_unit_ids,
    selectedProcessPanel.value?.definition?.name,
    selectedProcessContext.value?.name
  ],
  () => {
    persistWorkspaceChatContext({
      processId: selectedProcessPanel.value?.definition?.chat_context?.process_id,
      scopeUnitId: resolvePreferredChatScopeUnitId(),
      title: selectedProcessPanel.value?.definition?.name || selectedProcessContext.value?.name || 'Proceso',
      accessibleScopeUnitIds: selectedProcessPanel.value?.definition?.chat_context?.accessible_scope_unit_ids || []
    });
  },
  { immediate: true, deep: true }
);

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
  if (!currentStepOrder) {
    const pendingRequests = (subject.workflow?.fill_requests || []).filter((item) => !item.responded_at);
    if (pendingRequests.length) {
      return pendingRequests;
    }
  }
  const stepCandidates = (subject.workflow?.fill_steps || []).filter((item) => Number(item.step_order) === currentStepOrder);
  if (stepCandidates.length) {
    return stepCandidates;
  }
  return (subject.workflow?.fill_requests || []).filter((item) => Number(item.step_order || 0) === currentStepOrder);
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
  if (!resolverType) {
    return false;
  }
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
  if (!candidates.length) {
    const fallbackRequest = getCurrentFillWorkflowRequest(payload);
    return isFillRequestActionableByCurrentUser(fallbackRequest);
  }
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
  const request = getCurrentFillWorkflowRequest(payload);
  const code = getFillRequestStatusCode(request);
  return Boolean(
    subject.documentId
    && code === 'pending'
    && !hasDeliverableBeenStarted(payload)
  );
};

const canStartDeliverableAction = (payload) => {
  const subject = getDeliverableSubject(payload);
  if (subject.itemId && startedDeliverableIds.value.has(Number(subject.itemId))) return false;
  if (subjectHasWorkingArtifact(payload)) return false;
  const request = getCurrentFillWorkflowRequest(payload);
  const code = getFillRequestStatusCode(request);
  if (code !== 'pending') {
    return false;
  }
  return currentUserCanOperateFillStep(payload) || isFillRequestActionableByCurrentUser(request);
};

const shouldShowUploadDeliverable = (payload) => {
  const subject = getDeliverableSubject(payload);
  const request = getCurrentFillWorkflowRequest(payload);
  const code = getFillRequestStatusCode(request);
  return Boolean(
    subject.actions?.can_upload_deliverable
    && currentUserCanOperateFillStep(payload)
    && hasDeliverableBeenStarted(payload)
    && ['pending', 'in_progress', 'returned'].includes(code)
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

const hasPendingFillWorkflow = (payload) => {
  const subject = getDeliverableSubject(payload);
  const requests = Array.isArray(subject.workflow?.fill_requests) ? subject.workflow.fill_requests : [];
  return requests.some((request) => !request?.responded_at);
};

const hasSignatureWorkflowActivity = (payload) => {
  const subject = getDeliverableSubject(payload);
  const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
  return requests.length > 0
    || Number(subject.workflow?.signature_flow?.current_step_order || subject.workflow?.current_signature_step_order || 0) > 0;
};

const resolveDeliverableWorkspaceTab = () => 'summary';

const getDeliverableWorkspaceTabClass = (tab) => {
  if (deliverableWorkspaceState.value.tab === tab) {
    return 'border-slate-200 bg-white text-slate-900 shadow-[0_-1px_0_rgba(255,255,255,0.9)]';
  }
  return 'border-transparent bg-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700';
};

const shouldShowResetWorkflow = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(subject.actions?.can_reset_workflow && subject.actions?.implemented?.reset_workflow);
};

const getCurrentSignatureStepOrderFromSubject = (payload) => {
  const subject = getDeliverableSubject(payload);
  const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
  const explicit = Number(
    subject.workflow?.signature_flow?.current_step_order
    || subject.workflow?.current_signature_step_order
    || 0
  );
  if (explicit > 0) {
    const matchesExplicitPendingStep = requests.some((request) => {
      const code = String(request?.request_status_code || request?.status_name || request?.status || '').trim().toLowerCase();
      return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code)
        && !request?.responded_at
        && Number(request?.step_order || 0) === explicit;
    });
    if (matchesExplicitPendingStep) return explicit;
  }

  const pendingLike = requests
    .filter((request) => {
      const code = String(request?.request_status_code || request?.status_name || request?.status || '').trim().toLowerCase();
      return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code) && !request?.responded_at;
    })
    .sort((a, b) => Number(a?.step_order || 0) - Number(b?.step_order || 0));
  if (pendingLike.length) {
    return Number(pendingLike[0]?.step_order || 0) || null;
  }

  return null;
};

const getCurrentSignatureRequestsFromSubject = (payload) => {
  const subject = getDeliverableSubject(payload);
  const currentStepOrder = Number(getCurrentSignatureStepOrderFromSubject(payload) || 0);
  const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
  if (!currentStepOrder) {
    return requests.filter((request) => !request?.responded_at);
  }
  return requests.filter((request) => Number(request?.step_order || 0) === currentStepOrder);
};

const currentUserCanOperateSignatureStep = (payload) => {
  const currentUser = Number(currentUserId.value || 0);
  if (!currentUser) return false;

  const requests = getCurrentSignatureRequestsFromSubject(payload);
  return requests.some((request) => {
    const code = String(request?.request_status_code || request?.status_name || request?.status || '').trim().toLowerCase();
    const isPendingLike = ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code);
    return isPendingLike
      && !request?.responded_at
      && Number(request?.assigned_person_id || 0) === currentUser;
  });
};

const shouldShowSign = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(
    subject.actions?.can_sign
    && currentUserCanOperateSignatureStep(payload)
    && isPdfWorkingFile(payload)
  );
};

const shouldShowOpenWorkspacePrimary = (payload) => Boolean(
  !shouldShowStartDeliverable(payload)
  && !shouldShowUploadDeliverable(payload)
  && !shouldShowSign(payload)
  && (shouldShowManageFill(payload) || shouldShowSignatureFlow(payload))
);

const getDeliverableCardTone = (payload) => {
  if (shouldShowSign(payload) || hasSignatureWorkflowActivity(payload)) {
    return {
      card: 'border-rose-200/80 hover:border-rose-300 hover:shadow-[0_18px_36px_rgba(244,114,182,0.14)]',
      accent: 'bg-rose-300',
      responsibility: 'border-rose-100 bg-linear-to-br from-rose-50 via-white to-orange-50/50',
      responsibilityLabel: 'text-rose-700'
    };
  }

  if (shouldShowUploadDeliverable(payload) || hasPendingFillWorkflow(payload)) {
    return {
      card: 'border-sky-200/80 hover:border-sky-300 hover:shadow-[0_18px_36px_rgba(14,165,233,0.12)]',
      accent: 'bg-sky-500',
      responsibility: 'border-sky-100 bg-linear-to-br from-sky-50 via-white to-cyan-50/70',
      responsibilityLabel: 'text-sky-700'
    };
  }

  const subject = getDeliverableSubject(payload);
  const variant = getWorkflowStateTagVariant(subject.status || subject.documentStatus, 'neutral');
  if (variant === 'success') {
    return {
      card: 'border-emerald-200/80 hover:border-emerald-300 hover:shadow-[0_18px_36px_rgba(16,185,129,0.12)]',
      accent: 'bg-emerald-500',
      responsibility: 'border-emerald-100 bg-linear-to-br from-emerald-50 via-white to-emerald-50/70',
      responsibilityLabel: 'text-emerald-700'
    };
  }

  return {
    card: 'border-slate-200 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.09)]',
    accent: 'bg-slate-300',
    responsibility: 'border-slate-200 bg-slate-50/70',
    responsibilityLabel: 'text-slate-600'
  };
};

const getWorkflowStateTagVariant = (value, fallback = 'neutral') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['completado', 'completed', 'aprobado', 'approved', 'firmado', 'signed'].includes(normalized)) return 'success';
  if (['en proceso', 'in_progress', 'in progress', 'procesando', 'listo para firma', 'pendiente de firma'].includes(normalized)) return 'info';
  if (['pendiente', 'pending', 'devuelto', 'returned'].includes(normalized)) return 'warning';
  if (['rechazado', 'rejected', 'cancelado', 'cancelled', 'error'].includes(normalized)) return 'danger';
  return fallback;
};

const getDeliverableAccessTagVariant = (accessSource) => {
  const normalized = String(accessSource || '').trim().toLowerCase();
  if (normalized === 'directo') return 'success';
  if (normalized === 'derivado') return 'accent';
  return 'muted';
};

const getDeliverableDocumentTagVariant = (subject) => {
  if (!subject?.documentId) return 'warning';
  return getWorkflowStateTagVariant(subject.documentStatus, 'info');
};

const getDeliverableTagGroups = (payload) => {
  const subject = getDeliverableSubject(payload);
  const accessSource = getDeliverableAccessSource(payload);
  return [
    {
      key: 'access-source',
      variant: getDeliverableAccessTagVariant(accessSource),
      label: `Acceso: ${accessSource}`
    },
    {
      key: 'deliverable-status',
      variant: getWorkflowStateTagVariant(subject.status || subject.documentStatus, 'neutral'),
      label: `Entregable: ${capitalize(subject.status || subject.documentStatus || 'pendiente')}`
    },
    {
      key: 'document-status',
      variant: getDeliverableDocumentTagVariant(subject),
      label: subject.documentId
        ? `Documento: ${subject.documentStatus || 'Creado'}`
        : 'Documento: sin generar'
    }
  ];
};

const getDeliverableStatusBadge = (payload) => {
  const subject = getDeliverableSubject(payload);
  return {
    variant: getWorkflowStateTagVariant(subject.status || subject.documentStatus, 'neutral'),
    label: capitalize(subject.status || subject.documentStatus || 'pendiente') || 'Pendiente'
  };
};

const getDeliverableDocumentLabel = (payload) => {
  const subject = getDeliverableSubject(payload);
  if (!subject.documentId) return 'Sin doc';
  return subject.documentVersion ? `Doc v${subject.documentVersion}` : 'Doc creado';
};

const getDeliverablePrimaryActionLabel = (payload) => {
  if (shouldShowStartDeliverable(payload)) return 'Iniciar';
  if (shouldShowUploadDeliverable(payload)) return getUploadActionLabel(payload);
  if (shouldShowSign(payload)) return 'Firmar';
  if (shouldShowOpenWorkspacePrimary(payload)) return 'Abrir';
  return 'Sin acción inmediata';
};

const getDeliverableNextActionText = (payload) => {
  if (shouldShowStartDeliverable(payload)) return 'El entregable aún no ha sido iniciado.';
  if (shouldShowUploadDeliverable(payload)) return 'El flujo espera un archivo de trabajo actualizado.';
  if (shouldShowSign(payload)) return 'El documento ya está listo para completar la firma.';
  if (shouldShowManageFill(payload) || shouldShowSignatureFlow(payload)) return 'El detalle operativo está disponible en el workspace del entregable.';
  return 'No hay una acción inmediata disponible en este momento.';
};

const getFillResponsibleName = (payload) => {
  const request = getCurrentFillWorkflowRequest(payload);
  const explicitLabel = String(request?.display_label || request?.label || '').trim();
  if (explicitLabel) return explicitLabel;
  const assignedPersonName = String(request?.assigned_person_name || request?.assignedPersonName || '').trim();
  if (assignedPersonName) return assignedPersonName;
  const cargoName = String(request?.cargo_name || request?.cargoName || '').trim();
  if (cargoName) return cargoName;
  const assignedPersonId = Number(request?.assigned_person_id || 0);
  if (assignedPersonId > 0 && assignedPersonId === Number(currentUserId.value || 0)) {
    return userFullName.value;
  }
  return 'Responsable no resuelto';
};

const getSignatureRequestAssignedSummary = (request) => {
  const personName = request?.assignedPerson
    ? `${request.assignedPerson.firstName || ''} ${request.assignedPerson.lastName || ''}`.trim()
    : String(request?.assigned_person_name || request?.assignedPersonName || '').trim();
  const cargoName = String(request?.cargoName || request?.cargo_name || '').trim();
  const explicitLabel = String(request?.display_label || request?.label || '').trim();
  if (personName && cargoName) {
    return `${personName} · ${cargoName}`;
  }
  return personName || cargoName || explicitLabel || 'Responsable no resuelto';
};

const getCurrentSignatureWorkflowRequest = (payload) => {
  const currentUser = Number(currentUserId.value || 0);
  const requests = getCurrentSignatureRequestsFromSubject(payload);
  return requests.find((request) => Number(request?.assigned_person_id || 0) === currentUser && !request?.responded_at)
    || requests.find((request) => Number(request?.assigned_person_id || 0) > 0 && !request?.responded_at)
    || requests.find((request) => !request?.responded_at)
    || requests[0]
    || null;
};

const getSignatureResponsibleName = (payload) => {
  const request = getCurrentSignatureWorkflowRequest(payload);
  if (!request) return 'Responsable no resuelto';
  const summary = getSignatureRequestAssignedSummary(request);
  if (summary && summary !== 'Responsable no resuelto') return summary;
  const assignedPersonId = Number(request?.assigned_person_id || 0);
  if (assignedPersonId > 0 && assignedPersonId === Number(currentUserId.value || 0)) {
    return userFullName.value;
  }
  return 'Responsable no resuelto';
};

const getDeliverableCurrentResponsibility = (payload) => {
  if (shouldShowStartDeliverable(payload) || shouldShowUploadDeliverable(payload) || hasPendingFillWorkflow(payload)) {
    return {
      type: 'fill',
      name: getFillResponsibleName(payload),
      variant: 'info'
    };
  }
  if (shouldShowSign(payload) || hasSignatureWorkflowActivity(payload)) {
    return {
      type: 'signature',
      name: getSignatureResponsibleName(payload),
      variant: 'warning'
    };
  }
  return {
    type: 'none',
    name: 'no resuelto',
    variant: 'muted'
  };
};

const getDeliverableProgress = (payload) => {
  const subject = getDeliverableSubject(payload);

  if (hasSignatureWorkflowActivity(payload)) {
    const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
    const stepOrders = [...new Set(
      requests
        .map((request) => Number(request?.step_order || request?.stepOrder || 0))
        .filter((value) => value > 0)
    )].sort((a, b) => a - b);
    const total = stepOrders.length || Number(subject.pendingSignatureCount || 0) || 0;
    if (!total) return null;
    const current = Number(getCurrentSignatureStepOrderFromSubject(payload) || 0) || total;
    const completedSteps = stepOrders.filter((stepOrder) => {
      const relatedRequests = requests.filter((request) => Number(request?.step_order || request?.stepOrder || 0) === stepOrder);
      if (!relatedRequests.length) return false;
      return relatedRequests.every((request) => {
        const code = String(request?.request_status_code || request?.requestStatusCode || request?.status_name || request?.status || '').trim().toLowerCase();
        return ['completado', 'completed'].includes(code);
      });
    }).length;
    const hasActivePendingStep = requests.some((request) => {
      const code = String(request?.request_status_code || request?.requestStatusCode || request?.status_name || request?.status || '').trim().toLowerCase();
      return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code) && !request?.responded_at;
    });
    const progressUnits = Math.min(total, completedSteps + (hasActivePendingStep ? 0.5 : 0));
    return {
      label: 'Paso de firma',
      current: Math.min(Math.max(current, 1), total),
      total,
      percent: Math.min(100, Math.max(8, (progressUnits / total) * 100))
    };
  }

  const fillSteps = Array.isArray(subject.workflow?.fill_steps) ? subject.workflow.fill_steps : [];
  const total = fillSteps.length || Number(subject.pendingFillCount || 0) || 0;
  if (!total) return null;
  const current = Number(subject.workflow?.fill_flow?.current_step_order || subject.workflow?.current_fill_step_order || getCurrentFillWorkflowRequest(payload)?.step_order || 0) || total;
  const completedSteps = fillSteps.filter((step) => {
    const code = String(step?.request_status || '').trim().toLowerCase();
    return code === 'approved';
  }).length;
  const hasActivePendingStep = fillSteps.some((step) => {
    const code = String(step?.request_status || '').trim().toLowerCase();
    return ['pending', 'in_progress', 'returned'].includes(code);
  });
  const progressUnits = Math.min(total, completedSteps + (hasActivePendingStep ? 0.5 : 0));
  return {
    label: 'Paso de llenado',
    current: Math.min(Math.max(current, 1), total),
    total,
    percent: Math.min(100, Math.max(8, (progressUnits / total) * 100))
  };
};

const getDeliverablePeriodLabelFromSubject = (payload) => {
  const subject = getDeliverableSubject(payload);
  if (subject.periodLabel) return subject.periodLabel;
  return 'Periodo no resuelto';
};

const getDeliverableDateRangeLabel = (payload) => {
  const subject = getDeliverableSubject(payload);
  if (!subject.taskStartDate && !subject.taskEndDate) return 'Fechas no resueltas';
  return `${formatDate(subject.taskStartDate)}${subject.taskEndDate ? ` - ${formatDate(subject.taskEndDate)}` : ''}`;
};

const getDeliverableWorkspacePayload = (deliverable) => ({
  ...(deliverable?.item || {}),
  period_label: getDeliverablePeriodLabel(deliverable?.task),
  process_label: getDeliverableProcessLabel(deliverable?.task, deliverable?.item),
  unit_label: getDeliverableUnitLabel(deliverable?.item),
  task_start_date: deliverable?.task?.start_date || null,
  task_end_date: deliverable?.task?.end_date || null,
});

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
const getFillStepStatusTagVariant = (status) => {
  const code = String(status || '').trim().toLowerCase();
  if (code === 'approved') return 'success';
  if (code === 'in_progress') return 'info';
  if (code === 'returned') return 'warning';
  if (code === 'rejected') return 'danger';
  if (code === 'cancelled') return 'neutral';
  return 'neutral';
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
    return 'border-sky-200 bg-linear-to-br from-sky-50/80 via-white to-sky-100/50';
  }
  const code = String(step?.request_status || '').trim().toLowerCase();
  if (code === 'approved') return 'border-emerald-200 bg-linear-to-br from-emerald-50/80 via-white to-emerald-100/40';
  if (code === 'rejected') return 'border-rose-200 bg-linear-to-br from-rose-50/80 via-white to-rose-100/40';
  if (code === 'returned') return 'border-amber-200 bg-linear-to-br from-amber-50/80 via-white to-amber-100/40';
  return 'border-slate-200 bg-linear-to-br from-slate-50/90 via-white to-slate-100/60';
};

const getFillStepAccentClass = (step, currentStepOrder) => {
  if (Number(currentStepOrder || 0) === Number(step?.step_order || 0)) {
    return 'bg-linear-to-r from-sky-300 via-sky-400 to-cyan-300';
  }
  const code = String(step?.request_status || '').trim().toLowerCase();
  if (code === 'approved') return 'bg-linear-to-r from-emerald-300 via-emerald-400 to-green-300';
  if (code === 'rejected') return 'bg-linear-to-r from-rose-300 via-rose-400 to-red-300';
  if (code === 'returned') return 'bg-linear-to-r from-amber-300 via-amber-400 to-orange-300';
  return 'bg-linear-to-r from-slate-200 via-slate-300 to-slate-200';
};
const getFillStepResolverLabel = (step) => {
  const bits = [];
  if (step.resolver_type) bits.push(step.resolver_type);
  if (step.selection_mode) bits.push(step.selection_mode);
  return bits.join(' · ');
};

const getSignatureStepResolverLabel = (step) => {
  const bits = [];
  if (step?.resolverType) bits.push(step.resolverType);
  if (step?.selection_mode) bits.push(step.selection_mode);
  if (step?.selectionMode) bits.push(step.selectionMode);
  return bits.join(' · ') || 'cargo_in_scope';
};

const getSignatureStepAssignedSummary = (step, requests = []) => {
  const stepOrder = Number(step?.step_order || step?.stepOrder || 0);
  const relatedRequests = (requests || []).filter((request) => Number(request?.stepOrder || 0) === stepOrder);
  if (!relatedRequests.length) {
    return 'Firmante no resuelto';
  }

  const labels = relatedRequests.map((request) => getSignatureRequestAssignedSummary(request)).filter(Boolean);

  return labels.join(' | ') || 'Firmante no resuelto';
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

const fetchSignedDeliverableResultBlob = async () => {
  const signedPath = String(deliverableSignResultState.value.signedPath || '').trim();
  if (!signedPath) {
    throw new Error('No se encontró el documento firmado para descargar.');
  }
  const response = await fetch(`${API_ROUTES.SIGN}/download?path=${encodeURIComponent(signedPath)}`, {
    headers: {
      ...processPanelService.getAuthHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error('No se pudo descargar el documento firmado.');
  }
  return response.blob();
};

const viewSignedDeliverableResult = async () => {
  try {
    const blob = await fetchSignedDeliverableResultBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    setProcessActionInfo(
      error?.message || 'No se pudo visualizar el documento firmado.',
      'error'
    );
  }
};

const downloadSignedDeliverableResult = async () => {
  try {
    const blob = await fetchSignedDeliverableResultBlob();
    downloadBlob(blob, deliverableSignResultState.value.fileName || 'documento_firmado.pdf');
  } catch (error) {
    setProcessActionInfo(
      error?.message || 'No se pudo descargar el documento firmado.',
      'error'
    );
  }
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
    openDeliverableUploadModal(payload);
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
  if (action === 'review_signature_flow') {
    openSignatureFlowModal(payload);
    return;
  }
  if (action === 'process_chat') {
    openWorkspaceProcessChat({
      processId: Number(subject.processId || 0),
      scopeUnitId: resolvePreferredChatScopeUnitId(payload),
      openConversation: true
    });
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
  openDeliverableUploadModal(fillWorkflowState.value.subject);
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
    closeDeliverableWorkspaceModal();
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

const clearDeliverableUploadSelection = () => {
  selectedDeliverableUploadFile.value = null;
};

const handleDeliverableFilesSelected = (files) => {
  selectedDeliverableUploadFile.value = files?.[0] || null;
};

const handleInlineDeliverableUpload = async (payload, files) => {
  if (!files?.length || isUploadingDeliverable.value) return;
  pendingDeliverableUploadTarget.value = payload;
  selectedDeliverableUploadFile.value = files[0] || null;
  await uploadSelectedDeliverableFile(files[0]);
};

const uploadSelectedDeliverableFile = async (file) => {
  const target = pendingDeliverableUploadTarget.value;
  if (!file || !target) {
    pendingDeliverableUploadTarget.value = null;
    selectedDeliverableUploadFile.value = null;
    return;
  }

  const lowerName = file.name.toLowerCase();
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
  const isAllowed = allowedExtensions.some((extension) => lowerName.endsWith(extension));
  if (!isAllowed) {
    setProcessActionInfo('Solo puedes cargar archivos PDF, Word o Excel para el entregable.', 'error');
    pendingDeliverableUploadTarget.value = null;
    selectedDeliverableUploadFile.value = null;
    return;
  }

  try {
    isUploadingDeliverable.value = true;
    closeDeliverableUploadModal();
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
    selectedDeliverableUploadFile.value = null;
  }
};

const submitDeliverableUpload = async () => {
  if (!selectedDeliverableUploadFile.value || isUploadingDeliverable.value) return;
  await uploadSelectedDeliverableFile(selectedDeliverableUploadFile.value);
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
  const pendingSignatureRequest = getCurrentSignatureRequestsFromSubject(doc).find((request) => {
    const code = String(request?.request_status_code || request?.status_name || request?.status || '').trim().toLowerCase();
    return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code)
      && !request?.responded_at
      && Number(request?.assigned_person_id || 0) === Number(currentUserId.value || 0);
  });
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

const signatureRequestPendingCodes = new Set(['pendiente', 'en_progreso']);

const resetSignatureFlowState = () => {
  signatureFlowState.value = {
    loading: false,
    error: '',
    subject: null,
    documentVersionId: null,
    snapshot: null
  };
  signatureFlowSignerRef.value?.resetToStart?.();
};

const closeSignatureFlowModal = () => {
  signatureFlowModalInstance?.hide();
  resetSignatureFlowState();
};

const prepareSignatureSession = async () => {
  const snapshot = signatureFlowState.value.snapshot;
  if (!snapshot?.canOperate) {
    signatureFlowSignerRef.value?.resetToStart?.();
    return;
  }
  const pendingRequest = (snapshot.signatureRequests || []).find((request) => {
    const code = String(request.requestStatusCode || "").trim().toLowerCase();
    return signatureRequestPendingCodes.has(code);
  });
  if (!pendingRequest) {
    signatureFlowSignerRef.value?.resetToStart?.();
    return;
  }
  await nextTick(() => {
    signatureFlowSignerRef.value?.resetToStart?.();
    signatureFlowSignerRef.value?.initializeWorkflowSignatureSession?.({
      signatureRequestId: pendingRequest.id,
      documentVersionId: signatureFlowState.value.documentVersionId,
      taskItemId: signatureFlowState.value.subject?.itemId,
      processDefinitionId: Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value || 0),
      documentTitle: signatureFlowState.value.subject?.title,
      documentVersionLabel: signatureFlowState.value.subject?.documentVersion ? `v${signatureFlowState.value.subject.documentVersion}` : `#${signatureFlowState.value.documentVersionId}`,
      preloadPdfPath: signatureFlowState.value.subject?.preloadPdfPath
    });
  });
};

const loadSignatureFlowState = async (payload) => {
  const subject = getDeliverableSubject(payload);
  const documentVersionId = subject.documentVersionId;
  if (!documentVersionId) {
    setProcessActionInfo(`No se encontró la versión documental asociada a ${subject.title}.`, 'error');
    return false;
  }
  signatureFlowState.value = {
    loading: true,
    error: '',
    subject,
    documentVersionId,
    snapshot: null
  };
  try {
    const snapshot = await signatureFlowService.getSignatureFlow(documentVersionId);
    signatureFlowState.value.snapshot = snapshot;
    signatureFlowState.value.error = '';
    await prepareSignatureSession();
    return true;
  } catch (error) {
    signatureFlowState.value.error = error?.response?.data?.message || error?.message || 'No se pudo cargar el flujo de firmas.';
    return false;
  } finally {
    signatureFlowState.value.loading = false;
  }
};

const openSignatureFlowModal = async (payload) => {
  const loaded = await loadSignatureFlowState(payload);
  if (!loaded) return;
  signatureFlowModalInstance = Modal.getOrCreateInstance(signatureFlowModal.value?.el);
  signatureFlowModalInstance?.show();
};

const handleEmbeddedWorkflowSigned = async (payload = {}) => {
  const documentVersionId = Number(payload?.documentVersionId || 0);
  const currentSignatureFlowDocumentVersionId = Number(signatureFlowState.value?.documentVersionId || 0);
  const signedPath = String(payload?.signedPath || '').trim();
  const successMessage = sanitizeEmbeddedSignSuccessMessage(payload?.message);
  const resultFileName = `documento_firmado_${documentVersionId || 'flujo'}.pdf`;

  documentSignModalInstance?.hide();

  if (selectedProcessContext.value) {
    await loadSelectedProcessPanel(selectedProcessContext.value);
  }

  if (documentVersionId && currentSignatureFlowDocumentVersionId && documentVersionId === currentSignatureFlowDocumentVersionId) {
    const refreshed = await loadSignatureFlowState(signatureFlowState.value.subject);
    if (!refreshed) {
      closeSignatureFlowModal();
    }
  }

  processActionMessage.value = null;
  openDeliverableSignResultModal({
    success: true,
    message: successMessage,
    signedPath,
    fileName: resultFileName,
  });
};

const openDeliverableWorkspaceModal = async (payload) => {
  const canManageFill = shouldShowManageFill(payload);
  const canReviewSignatureFlow = shouldShowSignatureFlow(payload);

  loadFillWorkflowState(payload);
  deliverableWorkspaceState.value = {
    tab: resolveDeliverableWorkspaceTab(payload)
  };

  if (canReviewSignatureFlow) {
    await loadSignatureFlowState(payload);
  } else {
    signatureFlowState.value = {
      loading: false,
      error: '',
      subject: null,
      documentVersionId: null,
      snapshot: null
    };
  }

  deliverableWorkspaceModalInstance = Modal.getOrCreateInstance(deliverableWorkspaceModal.value?.el);
  deliverableWorkspaceModalInstance?.show();
};

const closeDeliverableWorkspaceModal = () => {
  deliverableWorkspaceModalInstance?.hide();
};

const submitDeliverableReset = async () => {
  const target = deliverableResetState.value.target;
  if (!target || deliverableResetState.value.submitting) return;

  try {
    deliverableResetState.value.submitting = true;
    deliverableResetState.value.error = '';
    const userId = currentUserId.value;
    const definitionId = Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
    const taskItemId = Number(target.itemId || 0);

    if (!userId || !definitionId || !taskItemId) {
      throw new Error('No se pudo resolver el contexto del reset del entregable.');
    }

    openDeliverableOperationModal({
      title: 'Reseteando flujo',
      type: 'info',
      message: `Se está creando una nueva versión para ${target.title}...`,
      detail: 'El intento actual quedará cancelado.'
    });

    const result = await processPanelService.resetDeliverableWorkflow(userId, definitionId, taskItemId);

    closeDeliverableResetModal();
    fillWorkflowModalInstance?.hide();
    signatureFlowModalInstance?.hide();
    deliverableWorkspaceModalInstance?.hide();
    documentSignModalInstance?.hide();
    resetSignatureFlowState();

    if (selectedProcessContext.value) {
      await loadSelectedProcessPanel(selectedProcessContext.value);
    }

    openDeliverableOperationModal({
      title: 'Flujo reseteado',
      type: 'success',
      message: `Se creó la versión v${result?.new_document_version ?? 'nueva'} para ${target.title}.`,
      detail: 'La versión anterior quedó cancelada y el flujo volvió al inicio.'
    });
    setProcessActionInfo(`El flujo de ${target.title} se reseteó correctamente.`, 'success');
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'No se pudo resetear el flujo del entregable.';
    deliverableResetState.value.error = message;
    openDeliverableOperationModal({
      title: 'Error al resetear flujo',
      type: 'error',
      message,
      detail: target.title
    });
    setProcessActionInfo(message, 'error');
  } finally {
    deliverableResetState.value.submitting = false;
  }
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
