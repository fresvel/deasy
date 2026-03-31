<template>
  <div class="min-h-[100vh] bg-slate-100 font-sans flex flex-col">
    <app-workspace-header :menu-open="showMenu" current-section="dashboard" @menu-toggle="handleHeaderToggle" @notify="toggleNotify" @sign="navigateTo('firmar')">
        <div v-if="unitGroups.length" class="flex items-stretch gap-2 overflow-x-auto p-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
          <div
            class="inline-flex items-center justify-center lg:justify-start gap-2 min-w-[44px] sm:min-w-[100px] lg:min-w-[198px] px-2 sm:px-3 py-2 rounded-xl border-none cursor-pointer transition-all shrink-0 group hover:-translate-y-[1px]"
            :class="selectedGroupId === null ? 'bg-white/95 text-sky-700 shadow-[0_10px_20px_rgba(2,132,199,0.26)]' : 'bg-white/10 text-white/95 hover:bg-white/20'"
            role="button"
            tabindex="0"
            @click="selectConsolidated"
            @keydown.enter="selectConsolidated"
          >
            <span class="w-8 h-8 rounded-lg inline-flex items-center justify-center text-lg shrink-0 border-none" :class="selectedGroupId === null ? 'bg-sky-600/10' : 'bg-white/20'">
              <IconGlobe class="w-5 h-5" />
            </span>
            <div class="min-w-0 hidden lg:block flex-1">
              <div class="text-sm font-semibold leading-tight inline-flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">Consolidado</div>
            </div>
          </div>

          <div
            v-for="group in unitGroups"
            :key="group.id"
            class="inline-flex items-center justify-center lg:justify-start gap-2 min-w-[44px] sm:min-w-[100px] lg:min-w-[198px] px-2 sm:px-3 py-2 rounded-xl border-none cursor-pointer transition-all shrink-0 group hover:-translate-y-[1px]"
             :class="group.id === selectedGroupId ? 'bg-white/95 text-sky-700 shadow-[0_10px_20px_rgba(2,132,199,0.26)]' : 'bg-white/10 text-white/95 hover:bg-white/20'"
            role="button"
            tabindex="0"
            @click="selectGroup(group)"
            @keydown.enter="selectGroup(group)"
          >
            <span class="w-8 h-8 rounded-lg inline-flex items-center justify-center text-lg shrink-0 border-none" :class="group.id === selectedGroupId ? 'bg-sky-600/10' : 'bg-white/20'">
              <component :is="iconForUnitGroup(group)" class="w-5 h-5" />
            </span>
            <div class="min-w-0 hidden lg:block flex-1">
              <div class="text-sm font-semibold leading-tight inline-flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis" :title="group.name">
                {{ group.label || group.name }}
              </div>
            </div>
          </div>
        </div>
        <span v-if="!userUnits.length && !menuLoading" class="text-white/50 text-sm font-medium">
          Sin unidades
        </span>
    </app-workspace-header>

    <div class="flex flex-col xl:flex-row w-full flex-1 max-w-[2560px] mx-auto items-stretch">
      <app-workspace-sidebar :show="showMenu" :photo="userPhoto" :username="userFullName" @close-mobile="showMenu = false">
        <div class="flex flex-col">
          <div class="text-sm font-semibold mt-3 mb-2 opacity-85 text-white">
            {{ menuContextLabel }}
          </div>

          <div v-if="menuLoading" class="text-sm my-2 text-white">
            Cargando menú...
          </div>
          <div v-else-if="menuError" class="text-sm my-2 text-white">
            {{ menuError }}
          </div>
          <div v-else-if="!menuCargos.length" class="bg-white/20 rounded-xl text-white text-sm my-2 py-2 px-3">
            No hay cargos asignados para mostrar.
          </div>

          <div v-else class="flex flex-col gap-1 mt-2">
            <div v-for="cargo in menuCargos" :key="cargo.id" class="flex flex-col mb-1">
              <button
                class="w-full text-white bg-transparent border-none py-3 px-2 flex items-center justify-between text-left rounded-xl transition-colors hover:bg-white/10"
                :class="{ 'bg-white/10 font-bold': cargo.open }"
                type="button"
                @click="toggleCargo(cargo)"
              >
                <span class="flex items-center gap-3 text-sm font-semibold">
                  <component :is="iconForCargo(cargo.name)" class="w-5 h-5 shrink-0 opacity-90" />
                  <span class="truncate">{{ cargo.name }}</span>
                </span>
              </button>

              <div v-show="cargo.open" class="pl-4 py-2 ml-2 border-l border-white/20 mt-1 flex flex-col gap-1">
                <button
                  v-for="process in cargo.processes"
                  :key="process.id"
                  class="w-full text-left bg-transparent border-none py-2 px-3 rounded-lg text-sm transition-all focus:outline-none flex flex-row items-center gap-2 hover:bg-white/10 hover:text-white"
                  :class="selectedProcessKey === String(process.process_definition_id) ? 'bg-white text-sky-700 font-bold shadow-sm shadow-sky-900/20' : 'text-white/80'"
                  type="button"
                  @click="handleProcessSelect(process, cargo)"
                >
                  <component :is="iconForProcess(process.name)" class="w-4 h-4 shrink-0" />
                  <span class="truncate block w-full">{{ process.name }}</span>
                </button>
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
          <button class="relative z-10 bg-white text-sky-700 hover:bg-sky-50 focus:outline-none focus:ring-4 focus:ring-sky-500/30 whitespace-nowrap px-5 py-2.5 text-sm rounded-full font-bold shadow-lg shadow-sky-900/20 transition-all active:scale-[0.98]" @click="navigateTo('perfil')">
            Ir a mi perfil
          </button>
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
              <button class="text-sky-600 hover:text-sky-700 text-sm font-bold bg-transparent border-none p-0 inline-flex items-center gap-1.5 transition-colors group" @click="navigateTo(card.route)">
                {{ card.action }} <IconArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </footer>
          </article>
        </section>

        <section class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 overflow-hidden mb-6">
          <header class="flex items-center justify-between gap-4 mb-5">
            <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Resumen rápido</h2>
            <button class="hidden sm:inline-flex bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-sky-700 px-4 py-2 rounded-full text-sm font-bold transition-all focus:outline-none focus:ring-4 focus:ring-slate-100 active:scale-[0.98]" @click="navigateTo('perfil')">
              Gestionar perfil
            </button>
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
              <button class="w-full mt-1 bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white py-2 rounded-lg text-xs font-bold transition-all" @click="navigateTo(row.route)">
                Gestionar sección
              </button>
            </div>
            <button class="w-full mt-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all focus:outline-none" @click="navigateTo('perfil')">
              Gestionar perfil completo
            </button>
          </div>

          <!-- Vista desktop: Tabla -->
          <div class="hidden sm:block overflow-x-auto w-full rounded-[1rem] border border-slate-100">
            <table class="w-full text-left border-collapse min-w-[600px] text-sm">
              <thead>
                <tr class="bg-slate-50/80 border-b border-slate-100">
                  <th class="py-3.5 px-5 font-bold text-slate-600 text-[13px] uppercase tracking-wider">Sección</th>
                  <th class="py-3.5 px-5 font-bold text-slate-600 text-[13px] uppercase tracking-wider">Registros</th>
                  <th class="py-3.5 px-5 font-bold text-slate-600 text-[13px] uppercase tracking-wider">Estado</th>
                  <th class="py-3.5 px-5 font-bold text-slate-600 text-[13px] uppercase tracking-wider text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in summaryRows" :key="'desk-' + row.section" class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <td class="py-3.5 px-5 font-semibold text-slate-800">{{ row.section }}</td>
                  <td class="py-3.5 px-5 font-medium text-slate-600">{{ row.count }}</td>
                  <td class="py-3.5 px-5">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm" :class="getStatusTailwindClass(row.statusClass)">{{ row.status }}</span>
                  </td>
                  <td class="py-3.5 px-5 text-right">
                    <button class="bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all" @click="navigateTo(row.route)">
                      Gestionar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
                <button class="w-full sm:w-auto bg-white/10 hover:bg-white/20 border-2 border-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all focus:outline-none" type="button" @click="clearSelectedProcess">
                  Volver al panel general
                </button>
                <button
                  class="w-full sm:w-auto bg-white text-sky-700 hover:bg-sky-50 px-5 py-2.5 rounded-xl text-sm font-bold transition-all focus:outline-none shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  :disabled="!selectedProcessPanel?.permissions?.can_launch_manual"
                  @click="openTaskLaunchModal"
                >
                  Crear tarea
                </button>
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
                    <button
                      class="shrink-0 bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                      :disabled="!selectedProcessPanel?.permissions?.can_launch_manual"
                      @click="openTaskLaunchModal"
                    >
                      Crear tarea
                    </button>
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
                        <div v-for="item in task.items" :key="item.id" class="flex flex-col sm:flex-row justify-between gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-sky-200 transition-colors">
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
                          </div>
                          <div class="flex flex-col gap-1.5 sm:items-end text-sm font-semibold text-slate-500 shrink-0">
                            <span class="inline-flex items-center gap-1.5" :class="item.document_id ? 'text-sky-700' : 'text-slate-400'">
                              <IconSignature v-if="item.document_id" class="w-4 h-4" />
                              {{ item.document_id ? (item.document_version ? `Doc v${item.document_version}` : 'Doc creado') : 'Sin doc' }}
                            </span>
                            <span v-if="item.pending_signature_count" class="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md text-xs">Firmas pendientes: {{ item.pending_signature_count }}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                </article>

                <div class="lg:col-span-4 flex flex-col gap-6">
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
                      <button class="bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm self-start" type="button" @click="navigateTo('firmar')">
                        Ir a firmas
                      </button>
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
                  <header class="flex flex-col gap-2 mb-2">
                    <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Documentos</h2>
                    <p class="text-slate-500 text-sm m-0 font-medium">Documentos de tus entregables en esta definición.</p>
                  </header>
                  <div v-if="!selectedProcessPanel.documents.length" class="border-2 border-dashed border-slate-200 rounded-[1.5rem] p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    No hay documentos generados todavía.
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div v-for="doc in selectedProcessPanel.documents" :key="doc.document_id" class="flex flex-col gap-2 p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div class="flex items-start gap-3">
                        <IconSignature class="w-6 h-6 text-sky-600 shrink-0 mt-0.5" />
                        <div class="flex flex-col gap-1 min-w-0">
                          <strong class="text-[0.95rem] font-bold text-slate-800 leading-tight">{{ doc.template_artifact_name || `Documento #${doc.document_id}` }}</strong>
                          <span class="text-sm font-semibold text-slate-500 mt-1">{{ doc.document_status || 'Inicial' }}</span>
                        </div>
                      </div>
                      <div class="flex justify-between items-center mt-2 pt-3 border-t border-slate-100 text-xs font-bold text-slate-500">
                        <span v-if="doc.document_version" class="bg-slate-100 px-2 py-1 rounded-md">v{{ doc.document_version }}</span>
                        <span v-if="doc.pending_signature_count" class="text-amber-600 ml-auto flex items-center gap-1"><IconSignature class="w-3.5 h-3.5"/> Pendientes: {{ doc.pending_signature_count }}</span>
                      </div>
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
          <button class="w-10 h-10 rounded-full flex items-center justify-center bg-slate-200/50 hover:bg-slate-200 text-slate-600 transition-colors focus:outline-none" type="button" @click="closeTaskLaunchModal">
            <IconX class="w-5 h-5" />
          </button>
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
          <button class="bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-800 text-slate-600 px-6 py-3 rounded-full text-sm font-bold transition-all focus:outline-none" type="button" :disabled="taskLaunchSubmitting" @click="closeTaskLaunchModal">
            Cancelar
          </button>
          <button class="bg-gradient-to-br from-sky-700 to-sky-600 hover:from-sky-800 hover:to-sky-700 text-white px-6 py-3 rounded-full text-sm font-bold transition-all shadow-lg shadow-sky-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" type="button" :disabled="!canSubmitTaskLaunch" @click="submitTaskLaunch">
            {{ taskLaunchSubmitting ? 'Creando tarea...' : 'Crear tarea' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppWorkspaceHeader from '@/layouts/AppWorkspaceHeader.vue';
import AppWorkspaceSidebar from '@/layouts/AppWorkspaceSidebar.vue';
import SBody from '@/layouts/SBody.vue';
import SMessage from '@/layouts/SNotify.vue';
import SNavMenu from '@/layouts/SNavMenu.vue';
import FirmarPdf from '@/views/funciones/FirmarPdf.vue';
import UserMenuService from '@/services/logged/UserMenuService.js';
import ProcessDefinitionPanelService from '@/services/logged/ProcessDefinitionPanelService.js';
import { API_ROUTES } from '@/services/apiConfig';

import {
  IconGlobe,
  IconLock,
  IconCertificate,
  IconIdBadge,
  IconMapPins,
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
  
  await loadUserMenu();
});

onBeforeUnmount(() => {
  if (isClient) {
    window.removeEventListener('resize', handleResize);
  }
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
