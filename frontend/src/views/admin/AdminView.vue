<template>
  <div class="min-h-[100vh] bg-slate-100 font-sans flex flex-col">
    <app-workspace-header :menu-open="vmenu" current-section="admin" @menu-toggle="handleHeaderToggle" @notify="toggleNotify" @sign="openSigningWorkspace" />

    <div class="flex flex-col xl:flex-row w-full flex-1 max-w-[2560px] mx-auto items-stretch">
      <app-workspace-sidebar :show="vmenu" :photo="userPhoto" :username="userFullName" :container-class="'flex flex-col gap-4 p-4 h-full xl:min-h-[calc(100vh-4rem)]'" @close-mobile="vmenu = false">
          
          <div class="bg-white/5 rounded-2xl p-2 border border-white/10 backdrop-blur-sm shrink-0">
            <button 
              type="button" 
              @click="goAdminHome" 
              class="flex items-center w-full px-3 py-2 text-sm font-semibold rounded-xl transition-all duration-200 gap-2"
              :class="isHomeActive ? 'bg-white text-sky-800 shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'"
            >
              <IconHome class="w-5 h-5 shrink-0" />
              <span>Inicio</span>
            </button>
          </div>

          <div class="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 xl:max-h-[calc(100vh-14rem)] custom-scrollbar">
            <div v-for="group in groupedTables" :key="group.key" class="bg-white/5 rounded-2xl p-2 pb-1 border border-white/10 mb-1 backdrop-blur-sm">
              <button
                class="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-white/90 hover:text-white transition-colors"
                type="button"
                @click="onGroupTitleClick(group)"
              >
                <div class="flex items-center gap-2">
                  <component :is="resolveIcon(iconForGroup(group))" class="w-5 h-5 shrink-0" />
                  <span>{{ group.label }}</span>
                </div>
                <IconChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': openCategories[group.label] }" />
              </button>

              <div v-show="openCategories[group.label]" class="flex flex-col gap-1 mt-2 pl-2">
                <template v-if="isAcademiaGroup(group)">
                  <button
                    v-for="item in academyMenuItems"
                    :key="item.key"
                    class="px-3 py-2 text-sm font-medium rounded-xl text-left transition-all duration-200 flex items-center gap-2"
                    :class="[isAcademyItemActive(item) ? 'bg-white text-sky-800 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                    type="button"
                    @click="openAcademyItem(item)"
                  >
                    <component :is="resolveIcon(item.icon)" class="w-4 h-4 shrink-0" />
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else-if="isGestionGroup(group)">
                  <button
                    v-for="item in gestionMenuItems"
                    :key="item.key"
                    class="px-3 py-2 text-sm font-medium rounded-xl text-left transition-all duration-200 flex items-center gap-2"
                    :class="[isGestionItemActive(item) ? 'bg-white text-sky-800 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                    type="button"
                    @click="openGestionItem(item)"
                  >
                    <component :is="resolveIcon(item.icon)" class="w-4 h-4 shrink-0" />
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else-if="isUsuariosGroup(group)">
                  <button
                    v-for="item in usersMenuItems"
                    :key="item.key"
                    class="px-3 py-2 text-sm font-medium rounded-xl text-left transition-all duration-200 flex items-center gap-2"
                    :class="[isUsersItemActive(item) ? 'bg-white text-sky-800 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                    type="button"
                    @click="openUsersItem(item)"
                  >
                    <component :is="resolveIcon(item.icon)" class="w-4 h-4 shrink-0" />
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else-if="isContratosGroup(group)">
                  <button
                    v-for="item in contractsMenuItems"
                    :key="item.key"
                    class="px-3 py-2 text-sm font-medium rounded-xl text-left transition-all duration-200 flex items-center gap-2"
                    :class="[isContractsItemActive(item) ? 'bg-white text-sky-800 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                    type="button"
                    @click="openContractsItem(item)"
                  >
                    <component :is="resolveIcon(item.icon)" class="w-4 h-4 shrink-0" />
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else-if="isSeguridadGroup(group)">
                  <button
                    v-for="item in securityMenuItems"
                    :key="item.key"
                    class="px-3 py-2 text-sm font-medium rounded-xl text-left transition-all duration-200 flex items-center gap-2"
                    :class="[isSecurityItemActive(item) ? 'bg-white text-sky-800 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                    type="button"
                    @click="openSecurityItem(item)"
                  >
                    <component :is="resolveIcon(item.icon)" class="w-4 h-4 shrink-0" />
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else>
                  <button
                    v-for="table in group.mainTables"
                    :key="table.table"
                    class="px-3 py-2 text-sm font-medium rounded-xl text-left transition-all duration-200 flex items-center gap-2"
                    :class="[selectedTable?.table === table.table ? 'bg-white text-sky-800 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                    type="button"
                    @click="selectTable(table)"
                  >
                    <component :is="resolveIcon(iconForTable(table.table))" class="w-4 h-4 shrink-0" />
                    <span>{{ table.label }}</span>
                  </button>
                  <div v-if="group.supportTables.length" class="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest pl-3 mt-3 mb-1">
                    Relaciones y soporte
                  </div>
                  <button
                    v-for="table in group.supportTables"
                    :key="table.table"
                    class="px-3 py-2 text-sm font-medium rounded-xl text-left transition-all duration-200 flex items-center gap-2"
                    :class="[selectedTable?.table === table.table ? 'bg-white text-sky-800 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                    type="button"
                    @click="selectTable(table)"
                  >
                    <component :is="resolveIcon(iconForTable(table.table))" class="w-4 h-4 shrink-0" />
                    <span>{{ table.label }}</span>
                  </button>
                </template>
              </div>
            </div>
          </div>
      </app-workspace-sidebar>

      <s-body class="flex-1 min-w-0 flex flex-col p-4 sm:p-6 lg:p-8" :showmenu="vmenu" :shownotify="vnotify" :shownavmenu="showNavMenu">
        
        <div v-if="!selectedTable" class="w-full max-w-6xl mx-auto space-y-6">
          <div class="bg-white rounded-[2rem] p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col min-h-[400px]">
            <div v-if="loadingMeta" class="flex-1 flex items-center justify-center">
               <div class="inline-flex items-center gap-3">
                 <div class="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                 <span class="text-slate-500 font-medium">Cargando catálogos...</span>
               </div>
            </div>
            <div v-else-if="metaError" class="text-red-500 font-medium text-center p-6 bg-red-50/50 rounded-2xl border border-red-100">{{ metaError }}</div>
            <template v-else>
               <div class="flex items-center gap-5 mb-8">
                  <div class="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100/50 shadow-inner">
                    <component :is="resolveIcon(showAcademyCrudIndex ? (selectedAcademyCrudItem?.icon || 'map-marked-alt') : showAcademiaIndex ? 'map-marked-alt' : showGestionCrudIndex ? (selectedGestionCrudItem?.icon || 'check-double') : showGestionesIndex ? 'check-double' : showUsersCrudIndex ? (selectedUsersCrudItem?.icon || 'user') : showUsersIndex ? 'user' : showContractsCrudIndex ? (selectedContractsCrudItem?.icon || 'certificate') : showContractsIndex ? 'certificate' : showSecurityCrudIndex ? (selectedSecurityCrudItem?.icon || 'lock') : showSecurityIndex ? 'lock' : showGroupCrudIndex ? iconForGroup(selectedGroup) : 'lock')" class="w-8 h-8" />
                  </div>
                  <div>
                    <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">
                      {{ 
                        showAcademyCrudIndex ? (selectedAcademyCrudItem?.label || 'Academia') :
                        showAcademiaIndex ? 'Academia' :
                        showGestionCrudIndex ? (selectedGestionCrudItem?.label || 'Gestiones') :
                        showGestionesIndex ? 'Gestiones' :
                        showUsersCrudIndex ? (selectedUsersCrudItem?.label || 'Usuarios') :
                        showUsersIndex ? 'Usuarios' :
                        showContractsCrudIndex ? (selectedContractsCrudItem?.label || 'Contratos') :
                        showContractsIndex ? 'Contratos' :
                        showSecurityCrudIndex ? (selectedSecurityCrudItem?.label || 'Seguridad') :
                        showSecurityIndex ? 'Seguridad' :
                        showGroupCrudIndex ? (selectedGroup?.label || 'Administración') :
                        'Panel de administración'
                      }}
                    </h2>
                    <p class="text-slate-500 mt-1.5 font-medium text-sm sm:text-base">
                      {{ 
                        showAcademyCrudIndex ? (selectedAcademyCrudItem?.description || 'Gestiona el CRUD de catálogos y relaciones.') :
                        showAcademiaIndex ? 'Accesos principales para administrar Unidades, Periodos y Cargos.' :
                        showGestionCrudIndex ? (selectedGestionCrudItem?.description || 'Gestiona tablas relacionadas al subgrupo.') :
                        showGestionesIndex ? 'Accesos por subgrupo para administrar procesos, tareas, plantillas, documentos y firmas.' :
                        showUsersCrudIndex ? (selectedUsersCrudItem?.description || 'Gestiona tablas relacionadas al subgrupo.') :
                        showUsersIndex ? 'Accesos por subgrupo para administrar personas del sistema.' :
                        showContractsCrudIndex ? (selectedContractsCrudItem?.description || 'Gestiona tablas relacionadas al subgrupo.') :
                        showContractsIndex ? 'Accesos por subgrupo para administrar vacantes, contratos y orígenes.' :
                        showSecurityCrudIndex ? (selectedSecurityCrudItem?.description || 'Gestiona tablas relacionadas al subgrupo.') :
                        showSecurityIndex ? 'Accesos por subgrupo para administrar roles y permisos.' :
                        showGroupCrudIndex ? 'Gestiona el CRUD de las tablas del grupo.' :
                        'Accesos organizados para crear, editar, leer y eliminar datos del sistema.'
                      }}
                    </p>
                  </div>
               </div>
               
               <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 items-start">
                 <template v-if="showAcademyCrudIndex">
                    <button v-for="table in academyCrudTables" :key="table.table" type="button" @click="selectTable(table)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[170px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(iconForTable(table.table))" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ table.label }}</h3>
                          <span class="text-sm font-medium text-slate-400">Gestionar</span>
                        </div>
                      </div>
                      <p class="mt-3 text-sm font-medium text-slate-500 leading-snug line-clamp-2">
                        {{ table.description || 'Configura la estructura, relaciones y permisos propios de este submódulo.' }}
                      </p>
                    </button>
                    <div v-if="!academyCrudTables.length" class="col-span-full py-10 text-center text-slate-500 font-medium">No hay tablas disponibles para este subgrupo.</div>
                 </template>

                 <template v-else-if="showAcademiaIndex">
                    <button v-for="item in academyMenuItems" :key="item.key" type="button" @click="openAcademyItem(item)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[140px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(item.icon)" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ item.label }}</h3>
                          <span class="text-sm font-medium text-slate-500 leading-snug line-clamp-2 mt-1">{{ item.description || 'Administra y configura los datos de esta sección.' }}</span>
                        </div>
                      </div>
                    </button>
                 </template>

                 <template v-else-if="showGestionCrudIndex">
                    <button v-for="table in gestionCrudTables" :key="table.table" type="button" @click="selectTable(table)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[170px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(iconForTable(table.table))" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ table.label }}</h3>
                          <span class="text-sm font-medium text-slate-400">Gestionar</span>
                        </div>
                      </div>
                      <p class="mt-3 text-sm font-medium text-slate-500 leading-snug line-clamp-2">
                        {{ table.description || 'Configura la estructura, relaciones y permisos propios de este submódulo.' }}
                      </p>
                    </button>
                    <button v-if="selectedGestionCrudItem?.key === 'plantillas'" type="button" @click="openTemplateArtifactDraftFromHome" class="group bg-gradient-to-br from-sky-50 to-white border border-sky-200 rounded-2xl p-5 hover:border-sky-400 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[170px]">
                      <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                          <component :is="resolveIcon('plus')" class="w-6 h-6" />
                        </div>
                        <div>
                          <h3 class="font-bold text-sky-900 text-lg leading-tight group-hover:text-sky-700 transition-colors">Nuevo paquete de usuario</h3>
                          <span class="text-sm font-medium text-slate-500">Crear desde seed o archivos</span>
                        </div>
                      </div>
                      <div class="mt-4 self-start px-3 py-1 rounded-lg text-xs font-bold leading-none bg-sky-100 text-sky-700 border border-sky-200">
                        Acción especial
                      </div>
                    </button>
                    <div v-if="!gestionCrudTables.length" class="col-span-full py-10 text-center text-slate-500 font-medium">No hay tablas disponibles para este subgrupo.</div>
                 </template>

                 <template v-else-if="showGestionesIndex">
                    <button v-for="item in gestionMenuItems" :key="item.key" type="button" @click="openGestionItem(item)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[140px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(item.icon)" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ item.label }}</h3>
                          <span class="text-sm font-medium text-slate-500 leading-snug line-clamp-2 mt-1">{{ item.description || 'Administra y configura los datos de esta sección.' }}</span>
                        </div>
                      </div>
                    </button>
                 </template>

                 <template v-else-if="showUsersCrudIndex">
                    <button v-for="table in usersCrudTables" :key="table.table" type="button" @click="selectTable(table)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[170px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(iconForTable(table.table))" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ table.label }}</h3>
                          <span class="text-sm font-medium text-slate-400">Gestionar</span>
                        </div>
                      </div>
                      <p class="mt-3 text-sm font-medium text-slate-500 leading-snug line-clamp-2">
                        {{ table.description || 'Configura la estructura, relaciones y permisos propios de este submódulo.' }}
                      </p>
                    </button>
                    <div v-if="!usersCrudTables.length" class="col-span-full py-10 text-center text-slate-500 font-medium">No hay tablas disponibles para este subgrupo.</div>
                 </template>

                 <template v-else-if="showUsersIndex">
                    <button v-for="item in usersMenuItems" :key="item.key" type="button" @click="openUsersItem(item)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[140px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(item.icon)" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ item.label }}</h3>
                          <span class="text-sm font-medium text-slate-500 leading-snug line-clamp-2 mt-1">{{ item.description || 'Administra y configura los datos de esta sección.' }}</span>
                        </div>
                      </div>
                    </button>
                 </template>

                 <template v-else-if="showContractsCrudIndex">
                    <button v-for="table in contractsCrudTables" :key="table.table" type="button" @click="selectTable(table)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[170px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(iconForTable(table.table))" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ table.label }}</h3>
                          <span class="text-sm font-medium text-slate-400">Gestionar</span>
                        </div>
                      </div>
                      <p class="mt-3 text-sm font-medium text-slate-500 leading-snug line-clamp-2">
                        {{ table.description || 'Configura la estructura, relaciones y permisos propios de este submódulo.' }}
                      </p>
                    </button>
                    <div v-if="!contractsCrudTables.length" class="col-span-full py-10 text-center text-slate-500 font-medium">No hay tablas disponibles para este subgrupo.</div>
                 </template>

                 <template v-else-if="showContractsIndex">
                    <button v-for="item in contractsMenuItems" :key="item.key" type="button" @click="openContractsItem(item)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[140px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(item.icon)" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ item.label }}</h3>
                          <span class="text-sm font-medium text-slate-500 leading-snug line-clamp-2 mt-1">{{ item.description || 'Administra y configura los datos de esta sección.' }}</span>
                        </div>
                      </div>
                    </button>
                 </template>

                 <template v-else-if="showSecurityCrudIndex">
                    <button v-for="table in securityCrudTables" :key="table.table" type="button" @click="selectTable(table)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[170px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(iconForTable(table.table))" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ table.label }}</h3>
                          <span class="text-sm font-medium text-slate-400">Gestionar</span>
                        </div>
                      </div>
                      <p class="mt-3 text-sm font-medium text-slate-500 leading-snug line-clamp-2">
                        {{ table.description || 'Configura la estructura, relaciones y permisos propios de este submódulo.' }}
                      </p>
                    </button>
                    <div v-if="!securityCrudTables.length" class="col-span-full py-10 text-center text-slate-500 font-medium">No hay tablas disponibles para este subgrupo.</div>
                 </template>

                 <template v-else-if="showSecurityIndex">
                    <button v-for="item in securityMenuItems" :key="item.key" type="button" @click="openSecurityItem(item)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[140px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(item.icon)" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ item.label }}</h3>
                          <span class="text-sm font-medium text-slate-500 leading-snug line-clamp-2 mt-1">{{ item.description || 'Administra y configura los datos de esta sección.' }}</span>
                        </div>
                      </div>
                    </button>
                 </template>

                 <template v-else-if="showGroupCrudIndex">
                    <button v-for="item in selectedGroupCrudTables" :key="item.table" type="button" @click="selectTable(item)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[170px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(iconForTable(item.table))" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ item.label }}</h3>
                          <span class="text-sm font-medium text-slate-400">{{ item.bucket }}</span>
                        </div>
                      </div>
                      <p class="mt-3 text-sm font-medium text-slate-500 leading-snug line-clamp-2">
                        {{ item.description || 'Configura la estructura, relaciones y permisos propios de este submódulo.' }}
                      </p>
                    </button>
                    <div v-if="!selectedGroupCrudTables.length" class="col-span-full py-10 text-center text-slate-500 font-medium">No hay tablas disponibles en este grupo.</div>
                 </template>
                 
                 <template v-else>
                    <button v-for="group in homeGroups" :key="group.key" type="button" @click="openGroupFromHome(group)" class="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between min-h-[140px]">
                      <div class="flex flex-col h-full w-full">
                        <div class="flex items-start justify-between mb-4">
                          <div class="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm">
                            <component :is="resolveIcon(iconForGroup(group))" class="w-6 h-6" />
                          </div>
                          <div class="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                            <IconChevronRight class="w-6 h-6" />
                          </div>
                        </div>
                        <div class="flex flex-col flex-1">
                          <h3 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors">{{ group.label }}</h3>
                          <span class="text-sm font-medium text-slate-500 leading-snug line-clamp-2 mt-1">{{ descriptionForGroup(group) }}</span>
                        </div>
                      </div>
                    </button>
                 </template>
               </div>
            </template>
          </div>
        </div>

        <div v-else class="w-full flex-1 bg-white border border-slate-200 p-0 sm:p-2 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden relative flex flex-col min-h-0">
          <div class="admin-page admin-typography w-full h-full relative overflow-y-auto">
             <AdminTableManager
               ref="adminManager"
               :table="selectedTable"
               :all-tables="tables"
               @go-back="handleManagerGoBack"
             />
          </div>
        </div>
      </s-body>

      <s-message :show="vnotify" />
    </div>
  </div>
</template>

<script setup>

import { computed, nextTick, onMounted, ref } from "vue";

import { 
  IconSchool, 
  IconChecklist, 
  IconUser, 
  IconAddressBook, 
  IconLock,
  IconCircle,
  IconCheckbox,
  IconCertificate,
  IconInfoCircle,
  IconPlus,
  IconBell,
  IconChevronDown,
  IconChevronRight,
  IconHome,
} from '@tabler/icons-vue'

import axios from "axios";
import { useRouter } from "vue-router";
import AppWorkspaceSidebar from "@/layouts/AppWorkspaceSidebar.vue";
import SMessage from "@/layouts/SNotify.vue";
import SBody from "@/layouts/SBody.vue";
import AppWorkspaceHeader from "@/layouts/AppWorkspaceHeader.vue";
import AdminTableManager from "./components/AdminTableManager.vue";
import { API_ROUTES } from "@/services/apiConfig";

const vmenu = ref(true);
const vnotify = ref(false);
const showNavMenu = ref(false);
const tables = ref([]);
const loadingMeta = ref(false);
const metaError = ref("");
const selectedTable = ref(null);
const selectedSection = ref("");
const selectedAcademyItem = ref("");
const selectedGestionItem = ref("");
const selectedUsuarioItem = ref("");
const selectedContratoItem = ref("");
const selectedSeguridadItem = ref("");
const openCategories = ref({});
const adminManager = ref(null);

const currentUser = ref(null);
const router = useRouter();
const defaultPhoto = "/images/avatar.png";
const userPhoto = ref(defaultPhoto);
const userFullName = computed(() => {
  if (currentUser.value) {
    const firstName = currentUser.value.first_name ?? "";
    const lastName = currentUser.value.last_name ?? "";
    return `${firstName} ${lastName}`.trim() || "Administrador";
  }
  return "Administrador";
});

const openSigningWorkspace = () => {
  router.push({ path: "/perfil", query: { view: "firmar" } });
};

const handleHeaderToggle = () => {
  vmenu.value = !vmenu.value;
};

const GROUP_DEFS = [
  {
    key: "estructura_academico",
    label: "Academia",
    main: ["unit_types", "units", "relation_unit_types", "unit_relations", "cargos", "unit_positions", "position_assignments", "term_types", "terms"],
    support: []
  },
  {
    key: "procesos",
    label: "Gestiones",
    main: [
      "processes",
      "process_definition_triggers",
      "process_definition_versions",
      "process_target_rules",
      "process_runs",
      "tasks",
      "task_items",
      "task_assignments",
      "template_seeds",
      "template_artifacts",
      "process_definition_templates",
      "documents",
      "document_versions"
    ],
    support: ["signature_flow_templates", "signature_flow_steps", "signature_flow_instances", "signature_requests", "document_signatures", "signature_types", "signature_statuses", "signature_request_statuses"]
      .concat(["fill_flow_templates", "fill_flow_steps", "document_fill_flows", "fill_requests"])
  },
  {
    key: "usuarios",
    label: "Usuarios",
    main: ["persons"],
    support: []
  },
  {
    key: "contratacion",
    label: "Contratos",
    main: ["vacancies", "vacancy_visibility", "aplications", "offers", "contracts"],
    support: ["contract_origins", "contract_origin_recruitment", "contract_origin_renewal"]
  },
  {
    key: "seguridad",
    label: "Seguridad",
    main: [
      "roles",
      "role_assignments",
      "cargo_role_map",
      "role_assignment_relation_types",
      "permissions",
      "role_permissions",
      "actions",
      "resources"
    ],
    support: []
  },
];

const ACADEMY_GROUP_KEY = "estructura_academico";
const ACADEMY_GROUP_LABEL = "Academia";
const ACADEMY_INDEX_ITEMS = [
  {
    key: "unidades",
    label: "Unidades",
    icon: "id-card",
    description: "Gestiona el CRUD de catálogos y relaciones de unidades.",
    tables: ["unit_types", "units", "relation_unit_types", "unit_relations"]
  },
  {
    key: "cargos",
    label: "Cargos",
    icon: "user",
    description: "Gestiona el catálogo de cargos, puestos y ocupaciones.",
    tables: ["cargos", "unit_positions", "position_assignments"]
  },
  {
    key: "periodos",
    label: "Periodos",
    icon: "square-check",
    description: "Gestiona catálogos y periodos académicos.",
    tables: ["term_types", "terms"]
  }
];
const GESTION_GROUP_KEY = "procesos";
const GESTION_GROUP_LABEL = "Gestiones";
const GESTION_INDEX_ITEMS = [
  {
    key: "procesos",
    label: "Procesos",
    icon: "check-double",
    description: "Gestiona procesos base, definiciones y reglas de alcance.",
    tables: ["processes", "process_definition_series", "process_definition_versions", "process_definition_triggers", "process_target_rules"]
  },
  {
    key: "plantillas",
    label: "Plantillas",
    icon: "certificate",
    description: "Gestiona seeds, artifacts y plantillas de definicion.",
    tables: ["template_seeds", "template_artifacts", "process_definition_templates"]
  },
  {
    key: "tareas",
    label: "Tareas",
    icon: "square-check",
    description: "Administra corridas, tareas, entregables y asignaciones.",
    tables: ["process_runs", "tasks", "task_items", "task_assignments"]
  },
  {
    key: "documentos",
    label: "Documentos",
    icon: "info-circle",
    description: "Administra documentos y versiones de documentos.",
    tables: ["documents", "document_versions"]
  },
  {
    key: "llenado",
    label: "Llenado",
    icon: "check-double",
    description: "Gestiona flujos, pasos e instancias de llenado documental.",
    tables: [
      "fill_flow_templates",
      "fill_flow_steps",
      "document_fill_flows",
      "fill_requests"
    ]
  },
  {
    key: "firmas",
    label: "Firmas",
    icon: "check",
    description: "Gestiona flujos, solicitudes, estados y firmas documentales.",
    tables: [
      "signature_flow_templates",
      "signature_flow_steps",
      "signature_flow_instances",
      "signature_requests",
      "document_signatures",
      "signature_types",
      "signature_statuses",
      "signature_request_statuses"
    ]
  }
];
const USERS_GROUP_KEY = "usuarios";
const USERS_GROUP_LABEL = "Usuarios";
const USERS_INDEX_ITEMS = [
  {
    key: "personas",
    label: "Personas",
    icon: "user",
    description: "Gestiona personas registradas en el sistema.",
    tables: ["persons"]
  }
];
const CONTRACT_GROUP_KEY = "contratacion";
const CONTRACT_GROUP_LABEL = "Contratos";
const CONTRACT_INDEX_ITEMS = [
  {
    key: "vacantes",
    label: "Vacantes",
    icon: "id-card",
    description: "Gestiona vacantes, postulaciones y ofertas.",
    tables: ["vacancies", "vacancy_visibility", "aplications", "offers"]
  },
  {
    key: "contratos",
    label: "Contratos",
    icon: "certificate",
    description: "Gestiona contratos del sistema.",
    tables: ["contracts"]
  },
  {
    key: "origenes",
    label: "Origenes",
    icon: "check-double",
    description: "Gestiona catálogos y relaciones de origen contractual.",
    tables: ["contract_origins", "contract_origin_recruitment", "contract_origin_renewal"]
  }
];
const SECURITY_GROUP_KEY = "seguridad";
const SECURITY_GROUP_LABEL = "Seguridad";
const SECURITY_INDEX_ITEMS = [
  {
    key: "roles",
    label: "Roles",
    icon: "lock",
    description: "Gestiona roles y asignaciones de rol.",
    tables: ["roles", "role_assignments", "cargo_role_map", "role_assignment_relation_types"]
  },
  {
    key: "permisos",
    label: "Permisos",
    icon: "square-check",
    description: "Gestiona permisos, recursos y acciones.",
    tables: ["permissions", "role_permissions", "actions", "resources"]
  }
];

const hiddenTables = new Set([]);
const visibleTables = computed(() => tables.value.filter((table) => !hiddenTables.has(table.table)));
const tableMap = computed(() =>
  Object.fromEntries(visibleTables.value.map((table) => [table.table, table]))
);

const groupedTables = computed(() => {
  const knownTables = new Set();
  const groups = GROUP_DEFS.map((group) => {
    const mainTables = group.main.map((name) => tableMap.value[name]).filter(Boolean);
    const supportTables = group.support.map((name) => tableMap.value[name]).filter(Boolean);
    mainTables.forEach((table) => knownTables.add(table.table));
    supportTables.forEach((table) => knownTables.add(table.table));
    return {
      ...group,
      mainTables,
      supportTables
    };
  });

  const orphanTables = visibleTables.value.filter((table) => !knownTables.has(table.table));
  if (orphanTables.length) {
    groups.push({
      key: "otros",
      label: "Otros",
      mainTables: orphanTables,
      supportTables: []
    });
  }

  return groups;
});

const homeGroups = computed(() =>
  groupedTables.value.filter((group) => (group.mainTables.length + group.supportTables.length) > 0)
);

const academyMenuItems = computed(() =>
  ACADEMY_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);
const gestionMenuItems = computed(() =>
  GESTION_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);
const usersMenuItems = computed(() =>
  USERS_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);
const contractsMenuItems = computed(() =>
  CONTRACT_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);
const securityMenuItems = computed(() =>
  SECURITY_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);

const showAcademiaIndex = computed(
  () => selectedSection.value === ACADEMY_GROUP_KEY
    && !selectedAcademyItem.value
    && !selectedTable.value
);
const showAcademyCrudIndex = computed(
  () => selectedSection.value === ACADEMY_GROUP_KEY
    && Boolean(selectedAcademyItem.value)
    && !selectedTable.value
);
const selectedAcademyCrudItem = computed(() =>
  academyMenuItems.value.find((item) => item.key === selectedAcademyItem.value) || null
);
const academyCrudTables = computed(() =>
  selectedAcademyCrudItem.value?.availableTables || []
);
const showGestionesIndex = computed(
  () => selectedSection.value === GESTION_GROUP_KEY
    && !selectedGestionItem.value
    && !selectedTable.value
);
const showGestionCrudIndex = computed(
  () => selectedSection.value === GESTION_GROUP_KEY
    && Boolean(selectedGestionItem.value)
    && !selectedTable.value
);
const selectedGestionCrudItem = computed(() =>
  gestionMenuItems.value.find((item) => item.key === selectedGestionItem.value) || null
);
const gestionCrudTables = computed(() =>
  selectedGestionCrudItem.value?.availableTables || []
);
const showUsersIndex = computed(
  () => selectedSection.value === USERS_GROUP_KEY
    && !selectedUsuarioItem.value
    && !selectedTable.value
);
const showUsersCrudIndex = computed(
  () => selectedSection.value === USERS_GROUP_KEY
    && Boolean(selectedUsuarioItem.value)
    && !selectedTable.value
);
const selectedUsersCrudItem = computed(() =>
  usersMenuItems.value.find((item) => item.key === selectedUsuarioItem.value) || null
);
const usersCrudTables = computed(() =>
  selectedUsersCrudItem.value?.availableTables || []
);
const showContractsIndex = computed(
  () => selectedSection.value === CONTRACT_GROUP_KEY
    && !selectedContratoItem.value
    && !selectedTable.value
);
const showContractsCrudIndex = computed(
  () => selectedSection.value === CONTRACT_GROUP_KEY
    && Boolean(selectedContratoItem.value)
    && !selectedTable.value
);
const selectedContractsCrudItem = computed(() =>
  contractsMenuItems.value.find((item) => item.key === selectedContratoItem.value) || null
);
const contractsCrudTables = computed(() =>
  selectedContractsCrudItem.value?.availableTables || []
);
const showSecurityIndex = computed(
  () => selectedSection.value === SECURITY_GROUP_KEY
    && !selectedSeguridadItem.value
    && !selectedTable.value
);
const showSecurityCrudIndex = computed(
  () => selectedSection.value === SECURITY_GROUP_KEY
    && Boolean(selectedSeguridadItem.value)
    && !selectedTable.value
);
const selectedSecurityCrudItem = computed(() =>
  securityMenuItems.value.find((item) => item.key === selectedSeguridadItem.value) || null
);
const securityCrudTables = computed(() =>
  selectedSecurityCrudItem.value?.availableTables || []
);
const selectedGroup = computed(() =>
  groupedTables.value.find((group) => group.key === selectedSection.value) || null
);
const showGroupCrudIndex = computed(
  () => Boolean(selectedGroup.value)
    && selectedGroup.value.key !== ACADEMY_GROUP_KEY
    && selectedGroup.value.key !== GESTION_GROUP_KEY
    && selectedGroup.value.key !== USERS_GROUP_KEY
    && selectedGroup.value.key !== CONTRACT_GROUP_KEY
    && selectedGroup.value.key !== SECURITY_GROUP_KEY
    && !selectedTable.value
);
const selectedGroupCrudTables = computed(() => {
  if (!selectedGroup.value) {
    return [];
  }
  const mainTables = selectedGroup.value.mainTables.map((table) => ({ ...table, bucket: "Principal" }));
  const supportTables = selectedGroup.value.supportTables.map((table) => ({ ...table, bucket: "Soporte" }));
  return [...mainTables, ...supportTables];
});

const groupIconMap = {
  estructura_academico: "map-marked-alt",
  procesos: "check-double",
  usuarios: "user",
  contratacion: "id-card",
  seguridad: "lock",
  otros: "circle"
};


const resolveIcon = (iconName) => {
  const map = {
    'map-marked-alt': IconSchool,
    'check-double': IconChecklist,
    'user': IconUser,
    'id-card': IconAddressBook,
    'lock': IconLock,
    'square-check': IconCheckbox,
    'certificate': IconCertificate,
    'info-circle': IconInfoCircle,
    'plus': IconPlus,
    'circle': IconCircle,
    'bell': IconBell
  }
  return map[iconName] || IconCircle
}

const iconForGroup = (group) => groupIconMap[group?.key] || "circle";

const groupDescMap = {
  'estructura_academico': 'Administración de facultades, carreras, currículos y periodos académicos.',
  'procesos': 'Definición y control de flujos de trabajo, tareas complejas y plantillas doc.',
  'usuarios': 'Gestión de personas, perfiles, autenticación y cuenta de ingreso.',
  'contratacion': 'Manejo de requerimientos de vacantes, contratos y registros de origen.',
  'seguridad': 'Auditoría de roles, asignaciones de permisos, recursos y control de acceso.'
};
const descriptionForGroup = (group) => groupDescMap[group?.key] || 'Gestión segura de módulos del sistema.';


const iconForTable = (tableName = "") => {
  const normalized = tableName.toLowerCase();
  if (/person|user|role|permission/.test(normalized)) return "user";
  if (/unit|cargo|position|term|relation/.test(normalized)) return "id-card";
  if (/process|task|template|document|signature/.test(normalized)) return "square-check";
  if (/contract|vacanc|offer|aplication/.test(normalized)) return "certificate";
  if (/security|resource|action/.test(normalized)) return "lock";
  return "info-circle";
};


const tablesCountForGroup = (group) => (group?.mainTables?.length ?? 0) + (group?.supportTables?.length ?? 0);

const isAcademiaGroup = (group) => group?.key === ACADEMY_GROUP_KEY;
const isGestionGroup = (group) => group?.key === GESTION_GROUP_KEY;
const isUsuariosGroup = (group) => group?.key === USERS_GROUP_KEY;
const isContratosGroup = (group) => group?.key === CONTRACT_GROUP_KEY;
const isSeguridadGroup = (group) => group?.key === SECURITY_GROUP_KEY;

const resolveAcademyItemByTable = (tableName) =>
  ACADEMY_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";
const resolveGestionItemByTable = (tableName) =>
  GESTION_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";
const resolveUsersItemByTable = (tableName) =>
  USERS_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";
const resolveContractsItemByTable = (tableName) =>
  CONTRACT_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";
const resolveSecurityItemByTable = (tableName) =>
  SECURITY_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";

const isAcademyItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedAcademyItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isGestionItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedGestionItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isUsersItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedUsuarioItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isContractsItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedContratoItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isSecurityItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedSeguridadItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};

const openGroupIndex = (group) => {
  if (!group) {
    return;
  }
  if (group.key === ACADEMY_GROUP_KEY) {
    openAcademyIndex();
    return;
  }
  if (group.key === GESTION_GROUP_KEY) {
    openGestionIndex();
    return;
  }
  if (group.key === USERS_GROUP_KEY) {
    openUsersIndex();
    return;
  }
  if (group.key === CONTRACT_GROUP_KEY) {
    openContractsIndex();
    return;
  }
  if (group.key === SECURITY_GROUP_KEY) {
    openSecurityIndex();
    return;
  }
  selectedSection.value = group.key;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[group.label] = true;
};

const onGroupTitleClick = (group) => {
  if (!group) {
    return;
  }
  const isOpen = Boolean(openCategories.value[group.label]);
  openCategories.value[group.label] = !isOpen;
  if (!isOpen) {
    openGroupIndex(group);
  }
};

const selectTable = (table) => {
  if (!table) {
    return;
  }
  selectedTable.value = table;
  const group = groupedTables.value.find((candidate) =>
    [...candidate.mainTables, ...candidate.supportTables].some((item) => item.table === table.table)
  );
  const academyItemKey = resolveAcademyItemByTable(table.table);
  const gestionItemKey = resolveGestionItemByTable(table.table);
  const usersItemKey = resolveUsersItemByTable(table.table);
  const contractsItemKey = resolveContractsItemByTable(table.table);
  const securityItemKey = resolveSecurityItemByTable(table.table);
  if (academyItemKey) {
    selectedSection.value = ACADEMY_GROUP_KEY;
    selectedAcademyItem.value = academyItemKey;
    selectedGestionItem.value = "";
    selectedUsuarioItem.value = "";
    selectedContratoItem.value = "";
    selectedSeguridadItem.value = "";
  } else if (gestionItemKey) {
    selectedSection.value = GESTION_GROUP_KEY;
    selectedGestionItem.value = gestionItemKey;
    selectedAcademyItem.value = "";
    selectedUsuarioItem.value = "";
    selectedContratoItem.value = "";
    selectedSeguridadItem.value = "";
  } else if (usersItemKey) {
    selectedSection.value = USERS_GROUP_KEY;
    selectedUsuarioItem.value = usersItemKey;
    selectedAcademyItem.value = "";
    selectedGestionItem.value = "";
    selectedContratoItem.value = "";
    selectedSeguridadItem.value = "";
  } else if (contractsItemKey) {
    selectedSection.value = CONTRACT_GROUP_KEY;
    selectedContratoItem.value = contractsItemKey;
    selectedAcademyItem.value = "";
    selectedGestionItem.value = "";
    selectedUsuarioItem.value = "";
    selectedSeguridadItem.value = "";
  } else if (securityItemKey) {
    selectedSection.value = SECURITY_GROUP_KEY;
    selectedSeguridadItem.value = securityItemKey;
    selectedAcademyItem.value = "";
    selectedGestionItem.value = "";
    selectedUsuarioItem.value = "";
    selectedContratoItem.value = "";
  } else {
    selectedSection.value = group?.key || "";
    selectedAcademyItem.value = "";
    selectedGestionItem.value = "";
    selectedUsuarioItem.value = "";
    selectedContratoItem.value = "";
    selectedSeguridadItem.value = "";
  }
  if (group && !openCategories.value[group.label]) {
    openCategories.value[group.label] = true;
  }
};

const openAcademyIndex = () => {
  selectedSection.value = ACADEMY_GROUP_KEY;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[ACADEMY_GROUP_LABEL] = true;
};

const openAcademyItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = ACADEMY_GROUP_KEY;
  selectedAcademyItem.value = item.key;
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  openCategories.value[ACADEMY_GROUP_LABEL] = true;
  selectedTable.value = null;
};
const openGestionIndex = () => {
  selectedSection.value = GESTION_GROUP_KEY;
  selectedGestionItem.value = "";
  selectedAcademyItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[GESTION_GROUP_LABEL] = true;
};
const openGestionItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = GESTION_GROUP_KEY;
  selectedGestionItem.value = item.key;
  selectedAcademyItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  openCategories.value[GESTION_GROUP_LABEL] = true;
  selectedTable.value = null;
};
const openTemplateArtifactDraftFromHome = async () => {
  const templateArtifactsTable = tables.value.find((table) => table.table === "template_artifacts");
  if (!templateArtifactsTable) {
    return;
  }
  selectTable(templateArtifactsTable);
  await nextTick();
  await nextTick();
  adminManager.value?.openDraftArtifactModal?.();
};
const openUsersIndex = () => {
  selectedSection.value = USERS_GROUP_KEY;
  selectedUsuarioItem.value = "";
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[USERS_GROUP_LABEL] = true;
};
const openUsersItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = USERS_GROUP_KEY;
  selectedUsuarioItem.value = item.key;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  openCategories.value[USERS_GROUP_LABEL] = true;
  selectedTable.value = null;
};
const openContractsIndex = () => {
  selectedSection.value = CONTRACT_GROUP_KEY;
  selectedContratoItem.value = "";
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[CONTRACT_GROUP_LABEL] = true;
};
const openContractsItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = CONTRACT_GROUP_KEY;
  selectedContratoItem.value = item.key;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedSeguridadItem.value = "";
  openCategories.value[CONTRACT_GROUP_LABEL] = true;
  selectedTable.value = null;
};
const openSecurityIndex = () => {
  selectedSection.value = SECURITY_GROUP_KEY;
  selectedSeguridadItem.value = "";
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedTable.value = null;
  openCategories.value[SECURITY_GROUP_LABEL] = true;
};
const openSecurityItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = SECURITY_GROUP_KEY;
  selectedSeguridadItem.value = item.key;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  openCategories.value[SECURITY_GROUP_LABEL] = true;
  selectedTable.value = null;
};

const openGroupFromHome = (group) => {
  if (!group) {
    return;
  }
  openGroupIndex(group);
};

const handleManagerGoBack = () => {
  if (!selectedTable.value) {
    return;
  }
  selectedTable.value = null;
  if (!selectedSection.value) {
    goAdminHome();
  }
};

const isHomeActive = computed(() => {
  return !selectedTable.value && !selectedSection.value && !selectedAcademyItem.value && 
         !selectedGestionItem.value && !selectedUsuarioItem.value && 
         !selectedContratoItem.value && !selectedSeguridadItem.value && 
         !showAcademiaIndex.value && !showGestionesIndex.value && !showUsersIndex.value && 
         !showContractsIndex.value && !showSecurityIndex.value && !showGroupCrudIndex.value;
});

const goAdminHome = () => {
  selectedTable.value = null;
  selectedSection.value = "";
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  Object.keys(openCategories.value).forEach((key) => {
    openCategories.value[key] = false;
  });
};

const toggleNotify = () => {
  if (showNavMenu.value) {
    showNavMenu.value = false;
  }
  vnotify.value = !vnotify.value;
};

const toggleNavMenu = () => {
  if (vnotify.value) {
    vnotify.value = false;
  }
  showNavMenu.value = !showNavMenu.value;
};

const fetchMeta = async () => {
  loadingMeta.value = true;
  metaError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_META);
    tables.value = response.data?.tables || [];
    groupedTables.value.forEach((group) => {
      if (openCategories.value[group.label] === undefined) {
        openCategories.value[group.label] = false;
      }
    });
  } catch (error) {
    metaError.value = error?.response?.data?.message || "No se pudo cargar el catalogo.";
  } finally {
    loadingMeta.value = false;
  }
};

onMounted(() => {
  const userDataString = localStorage.getItem("user");
  if (userDataString) {
    try {
      currentUser.value = JSON.parse(userDataString);
    } catch (error) {
      currentUser.value = null;
    }
  }
  fetchMeta();
});

</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}
</style>
