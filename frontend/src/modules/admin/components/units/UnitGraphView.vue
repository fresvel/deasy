<template>
  <div class="flex flex-col gap-3">
    <!-- UNA SOLA FILA DE CONTROLES (2026-11-23). Eran dos —una con el título, el contador y los
         botones, otra con buscar, resaltar y exportar—, y todo cabe en una. Todo lo que hay aquí
         mide lo mismo de alto: los que eran una casilla suelta («Resaltar pendientes») y un icono
         pequeño (la ayuda) son ahora botones como sus vecinos. El rótulo «Organigrama · N unidades ·
         N relaciones» se fue: repetía la pestaña en la que ya estás. -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <!-- Izquierda: volver, ayuda y buscar. -->
      <div class="flex flex-wrap items-center gap-2">
        <AppButton variant="neutral-outline" icon-only title="Regresar" aria-label="Regresar" @click="$emit('go-back')">
          <IconArrowLeft class="h-4 w-4" />
        </AppButton>
        <AppInfoTip as-button placement="bottom-start" aria-label="Ayuda del organigrama">
          <template v-if="editable">
            Pulsa una unidad para abrirla: sus datos, su vigencia, sus puestos y sus procesos. Pasa el cursor
            sobre ella para agregarle hijas, o arrastra desde su punto inferior al superior de otra para crear
            una relación. Usa los botones de cada relación para cambiar su tipo o quitarla.
          </template>
          <template v-else>
            Pulsa una unidad para ver sus datos, su vigencia, sus puestos y sus procesos. Vista de solo
            lectura: no tienes permisos para editar.
          </template>
        </AppInfoTip>
        <input v-model="searchTerm" type="text" aria-label="Buscar unidad" placeholder="Buscar unidad…" class="deasy-control w-52" @keyup.enter="searchAndCenter" />
        <AppButton variant="neutral-outline" icon-only title="Buscar y centrar" aria-label="Buscar y centrar" @click="searchAndCenter">
          <IconSearch class="h-4 w-4" />
        </AppButton>
      </div>
      <!-- Derecha: qué se ve, crear, y las dos acciones sobre el grafo entero. -->
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="activeRelationType" class="deasy-control deasy-control--select w-44" aria-label="Tipo de relación" title="Tipo de relación">
          <option v-for="rt in relationTypes" :key="rt.id" :value="rt.code">{{ rt.name }}</option>
          <option value="all">Todos los tipos</option>
        </select>
        <!-- «Resaltar pendientes» como un botón que se queda pulsado: es un interruptor, y así mide
             y se pinta como sus vecinos. El tono cambia al activarlo, y además lo dice `aria-pressed`. -->
        <AppButton
          :variant="healthOnly ? 'warning-soft' : 'neutral-outline'"
          :aria-pressed="healthOnly"
          title="Resaltar las unidades con pendientes"
          @click="healthOnly = !healthOnly"
        >
          <IconAlertTriangle class="mr-1 h-4 w-4" /> Pendientes<span v-if="pendingCount" class="ml-1 font-semibold">· {{ pendingCount }}</span>
        </AppButton>
        <!-- Los dos botones con rótulo miden lo mismo porque van en una rejilla de columnas iguales:
             el patrón del mapa de procesos. -->
        <div class="grid auto-cols-fr grid-flow-col gap-2">
          <AppCheckMenu v-model="vistaActiva" label="Mostrar" :options="OPCIONES_DE_VISTA" />
          <AppButton v-if="editable" variant="primary-outline" :disabled="loading" @click="$emit('create-unit')">
            <IconPlus class="mr-1 h-4 w-4" /> Unidad
          </AppButton>
        </div>
        <AppButton variant="neutral-outline" icon-only :disabled="loading" title="Refrescar" aria-label="Refrescar" @click="loadGraph">
          <IconRefresh class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        </AppButton>
        <AppButton variant="neutral-outline" icon-only :disabled="exporting" title="Exportar PNG" aria-label="Exportar PNG" @click="exportPng">
          <IconDownload class="h-4 w-4" />
        </AppButton>
      </div>
    </div>

    <!-- Leyenda de tipos de relación presentes -->
    <div v-if="legend.length > 1" class="flex flex-wrap items-center gap-3">
      <span v-for="item in legend" :key="item.code" class="inline-flex items-center gap-2 text-xs font-medium text-icon">
        <span class="inline-block h-2.5 w-4 rounded-full" :style="{ backgroundColor: item.color }"></span>
        {{ item.name }}
      </span>
    </div>

    <AppAlert v-if="feedback.message" :variant="feedback.kind === 'error' ? 'danger' : 'success'">
      {{ feedback.message }}
    </AppAlert>

    <div ref="graphCanvas" class="deasy-card graph-canvas">
      <div v-if="loading" class="flex h-full items-center justify-center text-sm text-muted">Cargando organigrama…</div>
      <div v-else-if="error" class="flex h-full items-center justify-center px-6 text-center text-sm text-danger">{{ error }}</div>
      <AppEmpty class="h-full" v-else-if="!nodes.length">No hay unidades para mostrar.</AppEmpty>
      <VueFlow
        v-else
        v-model:nodes="nodes"
        v-model:edges="edges"
        :min-zoom="0.2"
        :max-zoom="2"
        :nodes-connectable="editable"
        :edges-updatable="editable"
        :delete-key-code="null"
        :only-render-visible-elements="true"
        fit-view-on-init
        class="h-full"
        @connect="onConnect"
        @node-click="onNodeClick"
        @edge-update="onEdgeUpdate"
      >
        <Background pattern-color="#cbd5e1" :gap="20" />
        <Controls />
        <template #node-unit="nodeProps">
          <UnitNode :data="nodeProps.data" />
        </template>
        <template #edge-unit="edgeProps">
          <UnitEdge v-bind="edgeProps" />
        </template>
      </VueFlow>
    </div>

    <!-- Confirmar quitar relación -->
    <!-- SUPRIMIR DE UNA VEZ LOS PUESTOS DE LA UNIDAD: la suma de lo que se cierra, y una sola confirmación. -->
    <AppModalShell
      v-if="Boolean(puestosEnBloque)"
      controlled
      :open="Boolean(puestosEnBloque)"
      title="Suprimir los puestos de la unidad"
      content-class="max-w-md"
      @close="puestosEnBloque = null"
    >
      <div class="flex flex-col gap-3">
        <p class="m-0 text-sm text-icon">
          Los <strong>{{ puestosEnBloque.n }}</strong> puestos que rigen en <strong>{{ detailUnit?.name }}</strong>
          dejarán de regir el <strong>{{ puestosEnBloque.hasta }}</strong>.
        </p>
        <AppAlert v-if="puestosEnBloque.error" variant="danger">{{ puestosEnBloque.error }}</AppAlert>
        <AppAlert v-if="puestosEnBloque.yaRige" variant="warning">
          <template v-if="puestosEnBloque.efectos.length">
            Al confirmar se cerrarán <strong>{{ fraseDeEfectos(puestosEnBloque.efectos) }}</strong>. No se recuperan al reactivar, y un fin que ya ocurrió no se puede quitar.
          </template>
          <template v-else>Un fin que ya ocurrió no se puede quitar: para que vuelvan a regir habrá que reactivarlos uno por uno.</template>
        </AppAlert>
        <AppAlert v-else variant="info">Hasta ese día no se cierra nada, y la fecha de cada puesto se puede cambiar o quitar.</AppAlert>
        <label v-if="puestosEnBloque.yaRige" class="flex items-center gap-2 text-sm text-strong">
          <input v-model="puestosEnBloque.confirma" type="checkbox" />
          Entiendo que no se puede deshacer
        </label>
      </div>
      <template #footer>
        <AppButton variant="danger-outline" :disabled="puestosEnBloque.guardando" @click="puestosEnBloque = null">Cancelar</AppButton>
        <AppButton
          variant="primary-outline"
          :disabled="puestosEnBloque.guardando || (puestosEnBloque.yaRige && !puestosEnBloque.confirma)"
          @click="confirmarSuprimirPuestos"
        >{{ puestosEnBloque.guardando ? "Suprimiendo…" : "Suprimir los puestos" }}</AppButton>
      </template>
    </AppModalShell>

    <NodeMoverModal :mover="moverUnidad" :acto-options="vigencia.actoOptions.value" />

    <AppModalShell
      v-if="Boolean(selectedEdge)"
      controlled
      :open="Boolean(selectedEdge)"
      title="Quitar relación"
      content-class="max-w-md"
      @close="selectedEdge = null"
    >
      <p class="m-0 text-sm text-icon">
        ¿Quitar la relación <strong>{{ selectedEdgeLabel }}</strong>? La unidad hija quedará sin padre en este tipo de relación.
      </p>
      <template #footer>
        <AppButton variant="danger-outline" @click="selectedEdge = null">Cancelar</AppButton>
        <AppButton variant="danger-outline" @click="confirmDeleteEdge">Quitar</AppButton>
      </template>
    </AppModalShell>

    <!-- Cambiar el tipo de una relación existente -->
    <AppModalShell
      v-if="Boolean(editingEdge)"
      controlled
      :open="Boolean(editingEdge)"
      title="Cambiar tipo de relación"
      content-class="max-w-md"
      @close="editingEdge = null"
    >
      <p class="m-0 mb-3 text-sm text-icon">Relación <strong>{{ editingEdgeLabel }}</strong>.</p>
      <label class="deasy-form-label">
        Tipo de relación
        <select v-model="editingTypeCode" class="deasy-control deasy-control--select">
          <option v-for="rt in relationTypes" :key="rt.id" :value="rt.code">{{ rt.name }}</option>
        </select>
      </label>
      <template #footer>
        <AppButton variant="danger-outline" @click="editingEdge = null">Cancelar</AppButton>
        <AppButton variant="primary-outline" @click="confirmEditEdge">Guardar</AppButton>
      </template>
    </AppModalShell>

    <!-- Crear unidad hija/hermana (con su relación) en un paso -->
    <AppModalShell
      v-if="Boolean(createContext)"
      controlled
      :open="Boolean(createContext)"
      :title="createDialogTitle"
      content-class="max-w-md"
      @close="createContext = null"
    >
      <p class="m-0 mb-3 text-sm text-icon">{{ createDialogHint }}</p>
      <div class="flex flex-col gap-3">
        <label class="deasy-form-label">
          Nombre
          <input v-model="createForm.name" type="text" class="deasy-control" placeholder="Nombre de la unidad" />
        </label>
        <label class="deasy-form-label">
          Tipo de unidad
          <select v-model="createForm.unit_type_id" class="deasy-control deasy-control--select">
            <option value="">Selecciona…</option>
            <option v-for="ut in unitTypes" :key="ut.id" :value="ut.id">{{ ut.name }}</option>
          </select>
        </label>
        <label class="deasy-form-label">
          Slug <span class="font-normal text-muted">(opcional)</span>
          <input v-model="createForm.slug" type="text" class="deasy-control" placeholder="se deriva del nombre" />
        </label>
      </div>
      <template #footer>
        <AppButton variant="danger-outline" @click="createContext = null">Cancelar</AppButton>
        <AppButton variant="primary-outline" :disabled="!createForm.name.trim() || !createForm.unit_type_id" @click="confirmCreateUnit">Crear</AppButton>
      </template>
    </AppModalShell>

    <!-- LA UNIDAD, EN UN SOLO MODAL CON PESTAÑAS (2026-11-23), como el proceso en su mapa. Eran dos
         sitios: un panel lateral con puestos y procesos y, aparte, el editor genérico al que mandaba
         un lápiz flotante sobre el nodo. Ahora pulsar la unidad abre esto, y sus datos y su vigencia
         son dos pestañas más. Lo que falla aquí dentro se dice aquí dentro. -->
    <AppModalShell
      v-if="Boolean(detailUnit)"
      controlled
      :open="Boolean(detailUnit)" :title="detailUnit.name || 'Unidad'" content-class="deasy-dialog-panel--viewport max-w-3xl" body-class="flex min-h-0 flex-col" footer-class="shrink-0" @close="closeDetail">
      <!-- EL MODAL NO CRECE MÁS QUE LA PANTALLA, y lo que se desplaza es el contenido de la pestaña:
           las pestañas, el aviso y los botones se quedan siempre a la vista. Sin esto, una pestaña
           larga (diez puestos) empujaba la cabecera fuera de la pantalla y no había forma de volver. -->
      <div class="deasy-inline-tabs shrink-0" role="tablist">
        <button
          v-for="pestana in PESTANAS_DE_LA_UNIDAD"
          :key="pestana.id"
          type="button"
          role="tab"
          class="deasy-inline-tab"
          :class="detailTab === pestana.id ? 'deasy-inline-tab--active' : ''"
          :aria-selected="detailTab === pestana.id"
          @click="setDetailTab(pestana.id)"
        >
          <component :is="pestana.icono" class="h-4 w-4" />
          {{ pestana.rotulo }}
        </button>
      </div>

      <AppAlert v-if="modalError" variant="danger" class="mt-3 shrink-0">{{ modalError }}</AppAlert>

      <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
        <!-- Pestaña: Datos — la identidad de la unidad -->
        <div v-show="detailTab === 'datos'" class="flex flex-col gap-3">
          <AppAlert v-if="cambioProgramado" variant="info">{{ cambioProgramado }}</AppAlert>
          <label class="deasy-form-label">
            Nombre
            <input v-model="unidadForm.name" type="text" class="deasy-control" placeholder="Nombre de la unidad" :disabled="!editable" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="deasy-form-label">
              Etiqueta
              <input v-model="unidadForm.label" type="text" class="deasy-control" placeholder="Sigla o nombre corto" :disabled="!editable" />
            </label>
            <label class="deasy-form-label">
              Identificador (slug)
              <input v-model="unidadForm.slug" type="text" class="deasy-control" placeholder="identificador" :disabled="!editable" />
            </label>
          </div>
          <label class="deasy-form-label">
            Tipo de unidad
            <select v-model="unidadForm.unit_type_id" class="deasy-control deasy-control--select" :disabled="!editable">
              <option v-for="tipo in unitTypes" :key="tipo.id" :value="String(tipo.id)">{{ tipo.name }}</option>
            </select>
          </label>
        </div>

        <!-- Pestaña: Vigencia — las vidas de la unidad (frente 27, D-03). La misma pieza que el proceso. -->
        <NodeVigenciaPanel
          v-show="detailTab === 'vigencia'"
          :vigencia="vigencia"
          :estado="detailUnit.estado"
          sujeto="Unidad"
          :editable="editable"
          :candidatos="unidadesASuceder"
          @reactivar="empezarVidaNueva"
          @descartar="descartarVida"
          @suprimir-puestos="abrirSuprimirPuestos"
        />

        <!-- Pestaña: Ocupaciones -->
        <div v-show="detailTab === 'ocupaciones'">
        <!-- LAS TRES CLASES DE PUESTO, COMO SUBPESTAÑAS, EN LA MISMA FILA QUE «+ PUESTO» (2026-11-23).
             Llevan el mismo estilo que las pestañas del modal —el subrayado—, no el de grupo
             segmentado: el dueño vio las segmentadas y no las quiso. Ocupan el sitio del rótulo
             «Puestos y ocupaciones», que repetía el nombre de la pestaña.

             «Todas» va delante y es la que abre: la mayoría de las unidades tienen dos puestos, y
             partirlos en tres pestañas los escondería. En «Todas» se ven agrupados por clase; las
             otras tres filtran. Cada una dice cuántos hay. -->
        <div class="mb-3 flex items-center justify-between gap-2">
          <ProfileSubsectionTabs v-model="clasePuestos" :tabs="pestanasDeClase" aria-label="Clases de puesto" class="min-w-0" />
          <div class="flex shrink-0 items-center gap-2">
            <!-- Un interruptor, no una pestaña: se combina con la clase elegida a la izquierda. -->
            <AppButton
              :variant="soloVacantes ? 'primary-soft' : 'primary-outline'"
              icon-only
              :aria-pressed="soloVacantes"
              :title="soloVacantes ? 'Ver todos los puestos' : `Ver sólo los vacantes (${totalDeVacantes})`"
              :aria-label="soloVacantes ? 'Ver todos los puestos' : `Ver sólo los vacantes (${totalDeVacantes})`"
              @click="soloVacantes = !soloVacantes"
            >
              <IconFilter class="h-5 w-5" />
            </AppButton>
            <AppButton v-if="editable" variant="primary-outline" @click="openNewPosition">+ Puesto</AppButton>
          </div>
        </div>

        <div v-if="detailLoading" class="text-sm text-muted">Cargando…</div>
        <AppEmpty v-else-if="!detailPositions.length">
          Esta unidad no tiene puestos registrados.
        </AppEmpty>
        <template v-else>
          <AppEmpty v-if="!gruposDePuestos.length">
            {{ soloVacantes ? "No hay puestos vacantes aquí." : "Esta unidad no tiene puestos de esta clase." }}
          </AppEmpty>
          <div v-else class="flex flex-col gap-4">
            <section v-for="grupo in gruposDePuestos" :key="grupo.clase">
              <p v-if="clasePuestos === 'todas'" class="deasy-overline mb-2">{{ grupo.rotulo }} · {{ grupo.puestos.length }}</p>
              <ul class="m-0 flex list-none flex-col gap-2 p-0">
                <li v-for="pos in grupo.puestos" :key="pos.id" class="rounded-xl border border-line px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <IconCrown v-if="pos.is_unit_head" class="h-4 w-4 shrink-0 text-warning" title="Jefatura" />
                  <span class="truncate text-sm font-semibold text-strong">{{ pos.cargo_name || pos.title || 'Puesto' }}</span>
                  <span class="text-xs text-muted">#{{ pos.slot_no }}</span>
                  <div v-if="editable" class="ml-auto flex items-center gap-2">
                    <AppButton
                      :variant="pos.is_unit_head ? 'warning-soft' : 'neutral-soft'"
                      icon-only
                      title="Marcar/quitar jefatura"
                      aria-label="Marcar/quitar jefatura"
                      @click="toggleHead(pos)"
                    >
                      <IconCrown class="h-5 w-5" />
                    </AppButton>
                    <AppButton
                      variant="success-soft"
                      icon-only
                      title="Editar puesto"
                      aria-label="Editar puesto"
                      @click="openEditPosition(pos)"
                    >
                      <IconPencil class="h-5 w-5" />
                    </AppButton>
                    <!-- ELIMINAR Y SUPRIMIR NO SON LO MISMO, y sólo se ofrece el que vale. Un puesto
                         que nunca rigió —un borrador— se elimina: fue un error. Uno que rige o va a
                         regir se SUPRIME, poniéndole fecha de fin: lleva a su pestaña «Vigencia».
                         Uno ya suprimido se REACTIVA, que es lo único que le queda por hacer. -->
                    <AppButton
                      v-if="pos.estado === 'borrador'"
                      variant="danger-soft"
                      icon-only
                      title="Eliminar puesto"
                      aria-label="Eliminar puesto"
                      @click="removePosition(pos.id)"
                    >
                      <IconTrash class="h-5 w-5" />
                    </AppButton>
                    <AppButton
                      v-else-if="pos.estado !== 'suprimido'"
                      variant="danger-soft"
                      icon-only
                      title="Suprimir puesto"
                      aria-label="Suprimir puesto"
                      @click="openEditPosition(pos, 'vigencia')"
                    >
                      <IconCalendarOff class="h-5 w-5" />
                    </AppButton>
                    <AppButton
                      v-else
                      variant="primary-soft"
                      icon-only
                      title="Reactivar puesto"
                      aria-label="Reactivar puesto"
                      @click="openEditPosition(pos, 'vigencia')"
                    >
                      <IconRestore class="h-5 w-5" />
                    </AppButton>
                  </div>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <!-- UNA SOLA FILA DE PASTILLAS: en qué estado está el puesto —si no es el corriente,
                       que rija— y, si hay plaza, si está ocupada o vacante. -->
                  <AppTag v-if="pos.estado !== 'vigente'" :variant="tonoVigencia(pos.estado)" outlined>{{ etiquetaVigencia(pos.estado) }}</AppTag>
                  <template v-if="pos.person_id">
                    <AppTag variant="success" outlined>Ocupado</AppTag>
                    <span class="truncate text-icon">{{ (pos.person_name || '').trim() }} · {{ pos.cedula }}</span>
                  </template>
                  <!-- VACANTE ES UN PUESTO QUE RIGE Y NO TIENE A NADIE. Uno suprimido o en borrador no
                       tiene vacante: no hay plaza que ocupar, y su estado ya lo dice arriba. -->
                  <AppTag v-else-if="esVacante(pos)" variant="neutral" outlined>Vacante</AppTag>
                  <!-- Lo que se hace con el puesto tal como está: su perfil y quién lo ocupa. -->
                  <div v-if="editable" class="ml-auto flex items-center gap-2">
                    <AppButton
                      variant="primary-soft"
                      icon-only
                      :title="pos.profile ? 'Editar perfil' : 'Definir perfil'"
                      :aria-label="pos.profile ? 'Editar perfil' : 'Definir perfil'"
                      @click="openProfileWizard(pos)"
                    >
                      <IconFileDescription class="h-5 w-5" />
                    </AppButton>
                    <template v-if="pos.person_id">
                      <AppButton
                        variant="success-soft"
                        icon-only
                        title="Cambiar persona asignada"
                        aria-label="Cambiar persona asignada"
                        @click="openAssign(pos.id)"
                      >
                        <IconUserEdit class="h-5 w-5" />
                      </AppButton>
                      <AppButton
                        variant="danger-soft"
                        icon-only
                        title="Quitar persona del puesto"
                        aria-label="Quitar persona del puesto"
                        @click="unassign(pos.id)"
                      >
                        <IconUserMinus class="h-5 w-5" />
                      </AppButton>
                    </template>
                    <AppButton
                      v-else-if="esVacante(pos)"
                      variant="success-soft"
                      icon-only
                      title="Asignar persona al puesto"
                      aria-label="Asignar persona al puesto"
                      @click="openAssign(pos.id)"
                    >
                      <IconUserPlus class="h-5 w-5" />
                    </AppButton>
                  </div>
                </div>

                <!-- Buscador de persona para asignar -->
                <div v-if="editable && assignForId === pos.id" class="deasy-card mt-2 p-2">
                  <input v-model="personQuery" type="text" aria-label="Buscar persona por nombre o cédula" placeholder="Buscar persona (nombre o cédula)…" class="deasy-control" @input="searchPersons" />
                  <div v-if="personSearching" class="mt-1 px-1 text-theme-xs text-muted">Buscando…</div>
                  <ul v-else-if="personResults.length" class="m-0 mt-1 flex max-h-40 list-none flex-col gap-2 overflow-y-auto p-0">
                    <li v-for="per in personResults" :key="per.id">
                      <button type="button" class="deasy-option deasy-option--split" @click="pickPerson(per.id)">
                        <span class="truncate text-body">{{ per.first_name }} {{ per.last_name }}</span>
                        <span class="ml-2 shrink-0 text-muted">{{ per.cedula }}</span>
                      </button>
                    </li>
                  </ul>
                  <AppEmpty v-else-if="personQuery.trim().length >= 2" :icon="false">Sin resultados.</AppEmpty>
                </div>
              </li>
              </ul>
            </section>
          </div>
        </template>
        </div>

        <!-- Pestaña: Procesos de la unidad (alcance) -->
        <div v-show="detailTab === 'procesos'">
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="deasy-overline">Procesos de la unidad</p>
            <div class="flex items-center gap-2">
              <AppButton v-if="editable && canCreateProcess" variant="primary-outline" @click="$emit('create-process')">+ Nueva configuración</AppButton>
            </div>
          </div>
          <div v-if="detailProcessesLoading" class="text-sm text-muted">Cargando…</div>
          <AppEmpty v-else-if="!detailProcesses.length">
            Ningún proceso aplica a esta unidad.
          </AppEmpty>
          <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="proc in detailProcesses" :key="proc.rule_id" class="rounded-xl border border-line px-3 py-2.5">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold text-strong">{{ proc.process_name }}</span>
                <AppTag :variant="tonoOrigen(proc.origin)" outlined class-name="ml-auto">{{ processOriginMeta(proc.origin).label }}</AppTag>
                <AppTag :variant="tonoCicloVida(proc.status)" outlined>{{ etiquetaCicloVida(proc.status) }}</AppTag>
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span class="truncate">{{ proc.definition_name }}</span>
                <span class="inline-flex items-center rounded-xl bg-surface px-2 py-0.5 font-semibold text-icon ring-1 ring-line">{{ processScopeLabel(proc.unit_scope_type) }}</span>
              </div>
              <div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span class="text-muted">Destinatario: <span class="font-medium text-body">{{ recipientSummary(proc) }}</span></span>
                <!-- AQUI ESTABAN «Editar alcance» y «Quitar el proceso», que editaban y borraban
                     una fila de `process_target_rules`. Desde `P10` esa fila no tenía unidad, así
                     que «quitar el proceso de esta unidad» no quitaba nada de la unidad: borraba
                     el reparto de la configuración entera. La tabla se retiró en `P26`. -->
                <span class="ml-auto text-theme-xs italic text-muted">El alcance lo dice la línea del proceso</span>
              </div>
            </li>
          </ul>
          <p class="m-0 mt-3 text-theme-xs leading-snug text-muted">
            "Directo" = regla propia de esta unidad. El alcance solo se edita mientras la configuración está
            en <span class="font-semibold">borrador</span>; al activarse queda fija (cambiarla ⇒ nueva versión).
            "Por tipo"/"Global" se definen en la configuración del proceso y aplican a varias unidades.
          </p>
        </div>
      </div>

      <template #footer>
        <template v-if="detailTab === 'datos' && editable">
          <AppButton variant="danger-outline" :disabled="savingUnidad" @click="closeDetail">Cancelar</AppButton>
          <AppButton variant="primary-outline" :disabled="savingUnidad || !unidadForm.name.trim()" @click="saveUnidad">{{ savingUnidad ? "Guardando…" : "Guardar" }}</AppButton>
        </template>
        <template v-else-if="detailTab === 'vigencia' && editable && vigencia.vidaModo.value !== 'cerrada'">
          <AppButton variant="danger-outline" :disabled="savingUnidad" @click="closeDetail">Cancelar</AppButton>
          <AppButton variant="primary-outline" :disabled="savingUnidad || !vigencia.sePuedeGuardar.value" @click="saveVida">{{ savingUnidad ? "Guardando…" : vigencia.etiquetaDeGuardarVida.value }}</AppButton>
        </template>
        <AppButton v-else variant="neutral-outline" @click="closeDetail">Cerrar</AppButton>
      </template>
    </AppModalShell>

    <!-- EL PUESTO, CON DOS PESTAÑAS: sus datos y su vigencia (frente 27, D-03). El interruptor
         «Activo» se fue: un puesto ya no se apaga con una casilla, tiene vidas como la unidad y el
         proceso, y se le ponen y se le quitan con la misma pieza. Lo que falla aquí se dice aquí. -->
    <AppModalShell
      v-if="Boolean(editingPosition)"
      controlled
      :open="Boolean(editingPosition)"
      :title="editingPosition.id ? (editingPosition.cargo_name || editingPosition.title || 'Puesto') : 'Nuevo puesto'"
      content-class="deasy-dialog-panel--viewport max-w-xl"
      body-class="flex min-h-0 flex-col"
      footer-class="shrink-0"
      @close="closeEditPosition"
    >
      <div class="deasy-inline-tabs shrink-0" role="tablist">
        <button
          v-for="pestana in PESTANAS_DEL_PUESTO"
          :key="pestana.id"
          type="button"
          role="tab"
          class="deasy-inline-tab"
          :class="positionTab === pestana.id ? 'deasy-inline-tab--active' : ''"
          :aria-selected="positionTab === pestana.id"
          @click="positionTab = pestana.id"
        >
          <component :is="pestana.icono" class="h-4 w-4" />
          {{ pestana.rotulo }}
        </button>
      </div>

      <AppAlert v-if="positionError" variant="danger" class="mt-3 shrink-0">{{ positionError }}</AppAlert>

      <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
        <div v-show="positionTab === 'datos'" class="flex flex-col gap-3">
          <label class="deasy-form-label">
            Cargo
            <select v-model="editPositionForm.cargo_id" class="deasy-control deasy-control--select">
              <option value="">Selecciona…</option>
              <option v-for="c in cargos" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="deasy-form-label">
            Título <span class="font-normal text-muted">(opcional)</span>
            <input v-model="editPositionForm.title" type="text" class="deasy-control" placeholder="Título del puesto" />
          </label>
          <label class="deasy-form-label">
            Tipo
            <select v-model="editPositionForm.position_type" class="deasy-control deasy-control--select">
              <option value="real">Real</option>
              <option value="promocion">Promoción</option>
              <option value="simbolico">Simbólico</option>
            </select>
          </label>
          <SToggle v-model="editPositionForm.is_unit_head" label="Jefatura" label-position="end" />
        </div>

        <!-- Un puesto nuevo puede nacer rigiendo o en borrador: se decide aquí, antes de crearlo. -->
        <p v-if="!editingPosition.id && positionTab === 'vigencia'" class="m-0 mb-3 text-sm text-icon">
          Si le pones fecha, el puesto se crea y entra en vigor ese día. Sin fecha nace en borrador, y se pone en vigor después.
        </p>
        <NodeVigenciaPanel
          v-show="positionTab === 'vigencia'"
          :vigencia="vigenciaDelPuesto"
          :estado="editingPosition.estado"
          sujeto="Puesto"
          :editable="editable"
          :candidatos="puestosASuceder"
          @reactivar="empezarVidaDelPuesto"
          @descartar="descartarVidaDelPuesto"
        />
      </div>

      <template #footer>
        <!-- Un puesto NUEVO se crea con un solo botón, esté en la pestaña que esté. -->
        <template v-if="!editingPosition.id">
          <AppButton variant="danger-outline" :disabled="savingPosition" @click="closeEditPosition">Cancelar</AppButton>
          <AppButton variant="primary-outline" :disabled="savingPosition || !sePuedeCrearElPuesto" @click="confirmCreatePosition">{{ savingPosition ? "Creando…" : "Crear puesto" }}</AppButton>
        </template>
        <template v-else-if="positionTab === 'datos'">
          <AppButton variant="danger-outline" :disabled="savingPosition" @click="closeEditPosition">Cancelar</AppButton>
          <AppButton variant="primary-outline" :disabled="savingPosition || !editPositionForm.cargo_id" @click="confirmEditPosition">{{ savingPosition ? "Guardando…" : "Guardar" }}</AppButton>
        </template>
        <template v-else-if="vigenciaDelPuesto.vidaModo.value !== 'cerrada'">
          <AppButton variant="danger-outline" :disabled="savingPosition" @click="closeEditPosition">Cancelar</AppButton>
          <AppButton variant="primary-outline" :disabled="savingPosition || !vigenciaDelPuesto.sePuedeGuardar.value" @click="saveVidaDelPuesto">{{ savingPosition ? "Guardando…" : vigenciaDelPuesto.etiquetaDeGuardarVida.value }}</AppButton>
        </template>
        <AppButton v-else variant="neutral-outline" @click="closeEditPosition">Cerrar</AppButton>
      </template>
    </AppModalShell>

    <!-- Wizard de perfil del puesto -->
    <UnitPositionProfileWizard
      :open="Boolean(profileWizardPosition)"
      :position="profileWizardPosition"
      @close="profileWizardPosition = null"
      @save="saveProfileWizard"
 />

    <!-- AQUI ESTABA «Vincular proceso a la unidad» (frente 25, P26). Creaba una fila en
         `process_target_rules`, y desde `P10` esa fila NO TENIA UNIDAD: lo que la pantalla prometía
         —enganchar un proceso a esta unidad— no lo hacía, porque a quién alcanza una configuración
         lo dice su LÍNEA. La tabla se retiró y el modal con ella; la lista de procesos de la unidad
         se queda, que sí lee la obligación. -->
  </div>
</template>

<script setup>
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoCicloVida, tonoOrigen, etiquetaCicloVida, tonoVigencia, etiquetaVigencia } from "@/shared/utils/estadoTono.js";
import { ref, computed, watch, onMounted } from "vue";
import { VueFlow, MarkerType, useVueFlow } from "@vue-flow/core";
import { toBlob } from "html-to-image";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "dagre";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppInfoTip from "@/shared/components/widgets/AppInfoTip.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import NodeVigenciaPanel from "./NodeVigenciaPanel.vue";
import NodeMoverModal from "./NodeMoverModal.vue";
import { fraseDeEfectos } from "@/modules/admin/composables/estructura/useNodeVigencia.js";
import { useMoverNodo, fraseDelCambioProgramado } from "@/modules/admin/composables/estructura/useMoverNodo.js";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";
import AppCheckMenu from "@/shared/components/forms/AppCheckMenu.vue";
import { useNodeVigencia } from "@/modules/admin/composables/estructura/useNodeVigencia.js";
import UnitNode from "./UnitNode.vue";
import UnitEdge from "./UnitEdge.vue";
import UnitPositionProfileWizard from "./UnitPositionProfileWizard.vue";
import { IconAlertTriangle, IconArrowLeft, IconCalendarEvent, IconCalendarOff, IconCrown, IconDownload, IconFileDescription, IconFilter, IconId, IconPencil, IconPlus, IconRefresh, IconRestore, IconSearch, IconSettings, IconTrash, IconUserEdit, IconUserMinus, IconUserPlus, IconUsers } from "@tabler/icons-vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const props = defineProps({
  relationType: { type: String, default: "org" },
  editable: { type: Boolean, default: true },
  canCreateProcess: { type: Boolean, default: true }
});
defineEmits(["create-unit", "create-process", "go-back"]);

/* LA RUEDA DE SERIES vive en `tokens.css` desde F8 (2026-08-20). Aqui solo queda el NOMBRE del
   token, que es lo mismo que hace `estadoTono.js` con los tonos: JavaScript nombra, el CSS pinta.
   Vue Flow recibe `style: { stroke }`, y un `var()` resuelve igual en un `<path>` de SVG. */
const EDGE_PALETTE = [
  "var(--color-serie-uno)", "var(--color-serie-dos)", "var(--color-serie-tres)", "var(--color-serie-cuatro)",
  "var(--color-serie-cinco)", "var(--color-serie-seis)", "var(--color-serie-siete)"
];

const nodes = ref([]);
const edges = ref([]);
const rawGraph = ref({ nodes: [], edges: [] });
const relationTypes = ref([]);
const activeRelationType = ref(props.relationType);
const loading = ref(false);
const error = ref("");
// QUÉ SE MUESTRA, como una lista de casillas: los cuatro estados de vigencia de una unidad. El
// mismo desplegable que el mapa de procesos; antes era una casilla suelta «Mostrar inactivas».
const ESTADOS_CON_CASILLA = ["vigente", "borrador", "programado", "suprimido"];
const estadosVisibles = ref(new Set(ESTADOS_CON_CASILLA));
const OPCIONES_DE_VISTA = [
  { value: "vigente", label: "Unidades activas" },
  { value: "borrador", label: "Borradores" },
  { value: "programado", label: "Programadas" },
  { value: "suprimido", label: "Unidades suprimidas" }
];
const vistaActiva = computed({
  get: () => ESTADOS_CON_CASILLA.filter((estado) => estadosVisibles.value.has(estado)),
  set: (marcados) => { estadosVisibles.value = new Set(marcados); }
});
const selectedEdge = ref(null);
const editingEdge = ref(null);
const editingTypeCode = ref("");
const unitTypes = ref([]);
const createContext = ref(null);
const createForm = ref({ name: "", slug: "", unit_type_id: "" });
const detailUnit = ref(null);
const detailPositions = ref([]);
// LAS CLASES DE PUESTO como subpestañas de «Ocupaciones». El orden es el de la tabla que explicó el
// dueño: la plaza con contrato, la jefatura por designación, y la función sin contrato propio.
const CLASES_DE_PUESTO = [
  { clase: "real", rotulo: "Reales" },
  { clase: "promocion", rotulo: "Promoción" },
  { clase: "simbolico", rotulo: "Simbólicas" }
];
const claseDe = (pos) => pos.position_type || "real";
const clasePuestos = ref("todas");
const pestanasDeClase = computed(() => [
  { key: "todas", label: "Todas", count: detailPositions.value.length },
  ...CLASES_DE_PUESTO.map(({ clase, rotulo }) => ({
    key: clase,
    label: rotulo,
    count: detailPositions.value.filter((pos) => claseDe(pos) === clase).length
  }))
]);
// Los grupos que se pintan: todos en «Todas», uno solo al filtrar; y nunca un grupo vacío.
const gruposDePuestos = computed(() =>
  CLASES_DE_PUESTO
    .filter(({ clase }) => clasePuestos.value === "todas" || clasePuestos.value === clase)
    .map((grupo) => ({
      ...grupo,
      puestos: detailPositions.value.filter((pos) => claseDe(pos) === grupo.clase && (!soloVacantes.value || esVacante(pos)))
    }))
    .filter((grupo) => grupo.puestos.length)
);
// SÓLO LOS VACANTES: los mismos que la lista rotula «Vacante» —un puesto que rige, o va a regir, y
// no tiene ocupante—. Uno suprimido o en borrador no lo es: no hay plaza que ocupar. La cifra del
// botón es la de la clase elegida, que es lo que se va a ver al pulsarlo.
const soloVacantes = ref(false);
const esVacante = (pos) => !pos.person_id && (pos.estado === "vigente" || pos.estado === "programado");
const totalDeVacantes = computed(() =>
  detailPositions.value.filter((pos) => (clasePuestos.value === "todas" || claseDe(pos) === clasePuestos.value) && esVacante(pos)).length
);
const detailLoading = ref(false);
const detailTab = ref("datos");
// El error de lo que se intenta DENTRO del modal se enseña dentro: en la página quedaba tapado.
const modalError = ref("");
const PESTANAS_DE_LA_UNIDAD = [
  { id: "datos", rotulo: "Datos", icono: IconId },
  { id: "vigencia", rotulo: "Vigencia", icono: IconCalendarEvent },
  { id: "ocupaciones", rotulo: "Ocupaciones", icono: IconUsers },
  { id: "procesos", rotulo: "Procesos", icono: IconSettings }
];
const unidadForm = ref({ name: "", label: "", slug: "", unit_type_id: "" });
const savingUnidad = ref(false);
// LAS VIDAS de la unidad abierta (frente 27, D-03): el composable que comparte con el mapa de procesos.
const vigencia = useNodeVigencia({ tabla: "unit_vigencias", claveDelNodo: "unit_id" });
const empezarVidaNueva = () => {
  vigencia.empezarVidaNueva();
  modalError.value = "";
};
const detailProcesses = ref([]);
const detailProcessesLoading = ref(false);
const detailProcessesLoaded = ref(false);
// Gestión de puestos/ocupaciones en el drawer.
const cargos = ref([]);
const assignForId = ref(null);
const personQuery = ref("");
const personResults = ref([]);
const personSearching = ref(false);
const editingPosition = ref(null);
const editPositionForm = ref({ cargo_id: "", title: "", position_type: "real", is_unit_head: false });
// El modal del puesto: dos pestañas, su error dentro, y sus vidas con el mismo composable que la
// unidad —otra instancia, porque son dos modales que pueden estar abiertos a la vez—.
const positionTab = ref("datos");
const positionError = ref("");
const savingPosition = ref(false);
const PESTANAS_DEL_PUESTO = [
  { id: "datos", rotulo: "Datos", icono: IconId },
  { id: "vigencia", rotulo: "Vigencia", icono: IconCalendarEvent }
];
const vigenciaDelPuesto = useNodeVigencia({ tabla: "position_vigencias", claveDelNodo: "position_id" });
// ENTRE QUIÉNES SE ELIGE UN SUCESOR (frente 27, D-05). Las unidades ya están en el grafo; los puestos
// no —el grafo sólo trae los de la unidad abierta, y una reorganización los mueve entre unidades—,
// así que se piden cada vez que se abre un puesto.
const unidadesASuceder = computed(() =>
  (rawGraph.value.nodes || [])
    .filter((u) => u.estado && u.estado !== "borrador")
    .map((u) => ({ id: u.id, etiqueta: u.name }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"))
);
const puestosASuceder = ref([]);
const cargarPuestosASuceder = async () => {
  try {
    const { data } = await adminSqlService.getPuestosCandidatosASuceder();
    puestosASuceder.value = data?.puestos || [];
  } catch {
    puestosASuceder.value = [];
  }
};
const empezarVidaDelPuesto = () => {
  vigenciaDelPuesto.empezarVidaNueva();
  positionError.value = "";
};
// Wizard de perfil del puesto (formación/experiencia/capacitación/investigación) → columna JSON `profile`.
const profileWizardPosition = ref(null);
const feedback = ref({ kind: "", message: "" });
// F-E: buscar/centrar, colapsar ramas, salud, exportar.
const { fitView } = useVueFlow();
const searchTerm = ref("");
const collapsedIds = ref(new Set());
const highlightId = ref(null);
const healthOnly = ref(false);
const exporting = ref(false);
let feedbackTimer = null;

const NODE_W = 210;
const NODE_H = 64;

const relationColorMap = computed(() => {
  const map = new Map();
  relationTypes.value.forEach((rt, idx) => map.set(rt.code, EDGE_PALETTE[idx % EDGE_PALETTE.length]));
  return map;
});
const colorForCode = (code) => relationColorMap.value.get(code) || "var(--color-serie-none)";

const nodeNameById = computed(() => {
  const map = new Map();
  (rawGraph.value.nodes || []).forEach((u) => map.set(String(u.id), u.name));
  return map;
});
const edgeLabel = (edge) => {
  if (!edge) return "";
  const p = nodeNameById.value.get(String(edge.source)) || edge.source;
  const c = nodeNameById.value.get(String(edge.target)) || edge.target;
  return `${p} → ${c}`;
};
const selectedEdgeLabel = computed(() => edgeLabel(selectedEdge.value));
const editingEdgeLabel = computed(() => edgeLabel(editingEdge.value));
const legend = computed(() => {
  const codes = new Set((rawGraph.value.edges || []).map((e) => e.relation_type_code));
  return relationTypes.value
    .filter((rt) => codes.has(rt.code))
    .map((rt) => ({ code: rt.code, name: rt.name, color: colorForCode(rt.code) }));
});

// Salud: una unidad tiene pendientes si no tiene jefatura, no tiene puestos, o le quedan puestos en
// borrador —creados y sin poner en vigor—, que es trabajo a medias y no se ve desde fuera.
const healthIssues = (u) => {
  const issues = [];
  if (!Number(u.head_count)) issues.push("Sin jefatura");
  if (!Number(u.positions_count)) issues.push("Sin puestos");
  const borradores = Number(u.draft_positions_count) || 0;
  if (borradores) issues.push(`${borradores} ${borradores === 1 ? "puesto" : "puestos"} en borrador`);
  return issues;
};
const pendingCount = computed(
  () => (rawGraph.value.nodes || []).filter((u) => healthIssues(u).length).length
);
// Mapa padre→hijos (tipo de relación activo) para colapsar ramas.
const childrenMap = computed(() => {
  const map = new Map();
  (rawGraph.value.edges || []).forEach((e) => {
    const p = String(e.parent_unit_id);
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(String(e.child_unit_id));
  });
  return map;
});
const hiddenByCollapse = computed(() => {
  const hidden = new Set();
  const walk = (id) => {
    (childrenMap.value.get(String(id)) || []).forEach((childId) => {
      if (!hidden.has(childId)) {
        hidden.add(childId);
        walk(childId);
      }
    });
  };
  collapsedIds.value.forEach((id) => walk(id));
  return hidden;
});

const toggleCollapse = (unitId) => {
  const id = String(unitId);
  const next = new Set(collapsedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedIds.value = next;
  buildGraph();
};

// Buscar y centrar una unidad por nombre.
const searchAndCenter = () => {
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) return;
  const match = (rawGraph.value.nodes || []).find((u) =>
    String(u.name || "").toLowerCase().includes(term)
  );
  if (!match) {
    setFeedback("error", "No se encontró ninguna unidad con ese nombre.");
    return;
  }
  // Si está oculta por colapso, expande sus ancestros (simple: limpia colapsados).
  if (hiddenByCollapse.value.has(String(match.id))) {
    collapsedIds.value = new Set();
    buildGraph();
  }
  highlightId.value = String(match.id);
  buildGraph();
  fitView({ nodes: [{ id: String(match.id) }], duration: 600, maxZoom: 1.2, padding: 0.6 });
};

const graphCanvas = ref(null);

const exportPng = async () => {
  // Acotado a la raiz propia (no document.*): evita chocar con el canvas de ProcessGraph, que compartia clase.
  const root = graphCanvas.value;
  const target = root?.querySelector(".vue-flow") || root?.querySelector(".vue-flow__viewport");
  if (!target) {
    setFeedback("error", "No se encontró el lienzo para exportar.");
    return;
  }
  exporting.value = true;
  try {
    // toBlob + reintento sin fuentes: la incrustación de webfonts es la causa más común de fallo (CORS/caché).
          /* ⚠️ ESTE BLANCO NO PUEDE SER UN TOKEN, Y NO ES UN OLVIDO DE F8 (2026-08-20).
         `html-to-image` pinta el PNG sobre un lienzo y necesita un COLOR RESUELTO: un
         `var(--color-white)` aqui llegaria como cadena sin resolver y el fondo saldria
         transparente. Es el mismo motivo por el que un color de canvas nunca es CSS.
         Los otros once colores de este grafo si salieron a `tokens.css`. */
      const opts = { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true };
    let blob = null;
    try {
      blob = await toBlob(target, opts);
    } catch {
      blob = await toBlob(target, { ...opts, skipFonts: true });
    }
    if (!blob) {
      throw new Error("el lienzo no devolvió imagen");
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = `organigrama-${activeRelationType.value}.png`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback("success", "Organigrama exportado.");
  } catch (e) {
    setFeedback("error", `No se pudo exportar la imagen: ${e?.message || e}`);
  } finally {
    exporting.value = false;
  }
};

const setFeedback = (kind, message) => {
  feedback.value = { kind, message };
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.value = { kind: "", message: "" }; }, 4000);
};

// UN ERROR SE ENSEÑA DONDE ESTÁ QUIEN LO PROVOCÓ. El aviso de la página queda DETRÁS del modal de la
// unidad: lo que falle con él abierto —eliminar un puesto, retirar a su ocupante— se dice dentro.
const avisarDeError = (mensaje) => {
  if (detailUnit.value) modalError.value = mensaje;
  else setFeedback("error", mensaje);
};

// Auto-layout jerárquico (top-down) con dagre.
const layout = (rawNodes, rawEdges) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 45, ranksep: 75 });
  g.setDefaultEdgeLabel(() => ({}));
  rawNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rawEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return rawNodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
};

const buildGraph = () => {
  const hidden = hiddenByCollapse.value;
  const apiNodes = (rawGraph.value.nodes || []).filter(
    (u) => estadosVisibles.value.has(u.estado) && !hidden.has(String(u.id))
  );
  const visibleIds = new Set(apiNodes.map((u) => String(u.id)));
  const rawNodes = apiNodes.map((u) => {
    const issues = healthIssues(u);
    return {
      id: String(u.id),
      type: "unit",
      position: { x: 0, y: 0 },
      data: {
        ...u,
        editable: props.editable,
        onAddChild,
        onAddSibling,
        onToggleCollapse: toggleCollapse,
        healthIssues: issues,
        hasChildren: childrenMap.value.has(String(u.id)),
        collapsed: collapsedIds.value.has(String(u.id)),
        highlighted: highlightId.value === String(u.id),
        dimmed: healthOnly.value && !issues.length
      }
    };
  });
  const rawEdges = (rawGraph.value.edges || [])
    .filter((e) => visibleIds.has(String(e.parent_unit_id)) && visibleIds.has(String(e.child_unit_id)))
    .map((e) => {
      const color = colorForCode(e.relation_type_code);
      return {
        id: `e${e.id}`,
        type: "unit",
        source: String(e.parent_unit_id),
        target: String(e.child_unit_id),
        updatable: props.editable,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 1.6 },
        data: {
          relationId: e.id,
          relationTypeId: e.relation_type_id,
          code: e.relation_type_code,
          editable: props.editable,
          onEdit: openEditEdge,
          onDelete: openDeleteEdge
        }
      };
    });
  nodes.value = rawNodes.length ? layout(rawNodes, rawEdges) : [];
  edges.value = rawEdges;
};

const loadGraph = async () => {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await adminSqlService.getUnitGraph(activeRelationType.value);
    rawGraph.value = { nodes: data.nodes || [], edges: data.edges || [] };
    relationTypes.value = data.relationTypes || [];
    buildGraph();
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo cargar el organigrama.";
  } finally {
    loading.value = false;
  }
};

const rawUnitById = (unitId) =>
  (rawGraph.value.nodes || []).find((u) => String(u.id) === String(unitId)) || null;

// Clic en el nodo: abre el modal de la unidad, con sus datos, su vigencia, sus puestos y sus procesos.
const onNodeClick = ({ node }) => {
  if (!node?.data) return;
  openDetail(node.data.id);
};

// Detalle de unidad (drawer): puestos y ocupaciones.
// `mantener`: al refrescar tras cambiar un puesto se vuelve a la MISMA pestaña y subpestaña en que
// se estaba; sin él, guardar un puesto devolvía a «Datos» y había que volver a buscarlo.
const openDetail = async (unitId, { mantener = false } = {}) => {
  const pestanaPrevia = detailTab.value;
  const clasePrevia = clasePuestos.value;
  const u = rawUnitById(unitId);
  detailUnit.value = u ? { id: u.id, name: u.name, estado: u.estado } : { id: unitId, name: "", estado: "borrador" };
  unidadForm.value = {
    name: u?.name || "",
    label: u?.label || "",
    slug: u?.slug || "",
    unit_type_id: u?.unit_type_id ? String(u.unit_type_id) : ""
  };
  // La pestaña «Vigencia» se prepara ya con lo que trae el grafo, y se completa con el detalle.
  vigencia.prepararVida(u, []);
  modalError.value = "";
  clasePuestos.value = mantener ? clasePrevia : "todas";
  if (props.editable) vigencia.cargarActos();
  detailTab.value = mantener ? pestanaPrevia : "datos";
  detailProcesses.value = [];
  detailProcessesLoaded.value = false;
  detailPositions.value = [];
  detailLoading.value = true;
  try {
    const { data } = await adminSqlService.getUnitDetail(unitId);
    // El detalle no trae el estado: lo trae el grafo. Se conserva el que ya se tenía.
    detailUnit.value = { ...(data.unit || {}), id: unitId, name: data.unit?.name ?? detailUnit.value?.name ?? "", estado: u?.estado || "borrador" };
    vigencia.prepararVida(u, data.vigencias || [], data.antecesores || []);
    detailPositions.value = data.positions || [];
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo cargar el detalle.");
    detailUnit.value = null;
  } finally {
    detailLoading.value = false;
  }
};
const closeDetail = () => {
  detailUnit.value = null;
  detailPositions.value = [];
  assignForId.value = null;
  editingPosition.value = null;
  profileWizardPosition.value = null;
  detailTab.value = "datos";
};

// Guarda la identidad de la unidad (pestaña «Datos»). Al ir bien cierra, y el aviso sale en la página.
const saveUnidad = async () => {
  const unidad = detailUnit.value;
  if (!props.editable || !unidad?.id || !unidadForm.value.name.trim()) return;
  savingUnidad.value = true;
  modalError.value = "";
  try {
    await adminSqlService.update("units", { id: unidad.id }, {
      name: unidadForm.value.name.trim(),
      label: unidadForm.value.label.trim() || null,
      slug: unidadForm.value.slug.trim(),
      unit_type_id: Number(unidadForm.value.unit_type_id)
    });
    setFeedback("success", "Unidad actualizada.");
    closeDetail();
    await loadGraph();
  } catch (e) {
    modalError.value = e?.response?.data?.message || "No se pudo actualizar la unidad.";
  } finally {
    savingUnidad.value = false;
  }
};
// Descarta la vida programada de la unidad: aún no ha empezado, así que se borra entera.
const descartarVida = async () => {
  if (!props.editable || !vigencia.sePuedeDescartar.value) return;
  savingUnidad.value = true;
  modalError.value = "";
  try {
    await vigencia.descartarVida();
    setFeedback("success", "Vida programada descartada.");
    closeDetail();
    await loadGraph();
  } catch (e) {
    modalError.value = e?.response?.data?.message || "No se pudo descartar la vida.";
  } finally {
    savingUnidad.value = false;
  }
};
// SUPRIMIR DE UNA VEZ LOS PUESTOS DE LA UNIDAD. Una unidad no se suprime mientras tenga puestos que
// rijan; esto es el paso previo, con la fecha y el origen que ya están escritos en su pestaña
// «Vigencia». Enseña la SUMA de lo que se cierra y pide una sola confirmación. La unidad no se
// suprime aquí: al volver, su aviso ya no cuenta puestos y se guarda como siempre.
const puestosEnBloque = ref(null);
const abrirSuprimirPuestos = async () => {
  const unidad = detailUnit.value;
  const f = vigencia.vidaForm.value;
  if (!props.editable || !unidad?.id || !f.vigente_hasta || !f.fin_origen) return;
  let efectos = [];
  try {
    const { data } = await adminSqlService.getEfectosDeSuprimir("puestos_de_unidad", unidad.id);
    efectos = data?.efectos || [];
  } catch {
    efectos = [];
  }
  puestosEnBloque.value = {
    n: vigencia.efectosQueSeQuedan.value.find((e) => e.clave === "puestos")?.n || 0,
    hasta: f.vigente_hasta,
    yaRige: f.vigente_hasta <= vigencia.hoy(),
    efectos,
    confirma: false,
    guardando: false,
    error: ""
  };
};
const confirmarSuprimirPuestos = async () => {
  const peticion = puestosEnBloque.value;
  const f = vigencia.vidaForm.value;
  if (!peticion || !detailUnit.value?.id) return;
  peticion.guardando = true;
  peticion.error = "";
  try {
    await adminSqlService.suprimirPuestosDeUnidad(detailUnit.value.id, {
      vigente_hasta: f.vigente_hasta,
      fin_origen: f.fin_origen,
      fin_acto_id: f.fin_origen === "reorganizacion" && f.fin_acto_id ? Number(f.fin_acto_id) : null
    });
    puestosEnBloque.value = null;
    // El aviso de la unidad se vuelve a contar: ya no debería haber puestos que impidan suprimirla.
    await vigencia.cargarEfectos();
  } catch (e) {
    peticion.error = e?.response?.data?.message || "No se pudieron suprimir los puestos.";
    peticion.guardando = false;
  }
};
// Guarda la vida que enseña la pestaña «Vigencia»: poner en vigor, mover fechas, suprimir o reactivar.
const saveVida = async () => {
  const unidad = detailUnit.value;
  if (!props.editable || !unidad?.id || !vigencia.sePuedeGuardar.value) return;
  savingUnidad.value = true;
  modalError.value = "";
  try {
    await vigencia.guardarVida(unidad.id);
    setFeedback("success", "Vigencia actualizada.");
    closeDetail();
    await loadGraph();
  } catch (e) {
    modalError.value = e?.response?.data?.message || "No se pudo guardar la vigencia.";
  } finally {
    savingUnidad.value = false;
  }
};

// Pestaña "Procesos" del drawer: procesos que aplican a la unidad (carga perezosa).
const loadUnitProcesses = async () => {
  if (!detailUnit.value?.id || detailProcessesLoaded.value) return;
  detailProcessesLoading.value = true;
  try {
    const { data } = await adminSqlService.getUnitProcesses(detailUnit.value.id);
    detailProcesses.value = data.processes || [];
    detailProcessesLoaded.value = true;
  } catch (e) {
    avisarDeError(e?.response?.data?.message || "No se pudieron cargar los procesos.");
  } finally {
    detailProcessesLoading.value = false;
  }
};
const setDetailTab = (tab) => {
  detailTab.value = tab;
  if (tab === "procesos") loadUnitProcesses();
};
const PROCESS_SCOPE_LABELS = {
  unit_exact: "Esta unidad",
  unit_type: "Por tipo de unidad",
  all_units: "Todas las unidades"
};
const processScopeLabel = (code) => PROCESS_SCOPE_LABELS[code] || code || "—";


// --- Administración de procesos de la unidad (vía reglas de alcance) ---
const RECIPIENT_POLICY_LABELS = {
  all_matches: "Todos los del cargo",
  unit_head: "Jefatura de la unidad"
};
/* El ORIGEN de la regla ya no lleva su clase: solo la etiqueta. El tono lo pone `tonoOrigen`. */
const PROCESS_ORIGIN_META = {
  direct: { label: "Directa" },
  type: { label: "Por tipo" },
  global: { label: "Global" },
  other: { label: "Heredada" }
};
const recipientPolicyLabel = (code) => RECIPIENT_POLICY_LABELS[code] || code || "—";
const processOriginMeta = (origin) => PROCESS_ORIGIN_META[origin] || PROCESS_ORIGIN_META.other;
const recipientSummary = (proc) =>
  `${proc.cargo_name || 'Cargo no definido'} · ${recipientPolicyLabel(proc.recipient_policy)}`;

// AQUI VIVIA LA VINCULACION DE PROCESOS A LA UNIDAD (frente 25, P26): el formulario, las
// configuraciones enganchables, el alta, la edicion y el desenganche. Las cuatro escribian
// `process_target_rules`, que se retiro — y que desde `P10` ya no tenia unidad, asi que esta
// pantalla prometia un enganche que no existia. La LISTA se queda: lee la obligacion.

const loadCargos = async () => {
  try {
    const { data } = await adminSqlService.list("cargos", { limit: 300 });
    cargos.value = Array.isArray(data) ? data : (data?.rows || []);
  } catch {
    cargos.value = [];
  }
};

// Tras cambiar puestos/ocupaciones: recarga el detalle (drawer) y el grafo (badges).
const refreshAfterPositionChange = async () => {
  // Primero el grafo: `openDetail` saca de él el estado y la vigencia de la unidad.
  await loadGraph();
  if (detailUnit.value?.id) {
    await openDetail(detailUnit.value.id, { mantener: true });
  }
};

// UN PUESTO NUEVO SE CREA EN EL MISMO MODAL EN QUE SE EDITA, con sus dos pestañas: así se ve —y se
// decide— su vigencia antes de crearlo. Antes era un formulario desplegado en la lista, que sólo
// pedía los datos: el puesto nacía siempre en borrador y había que abrirlo otra vez para que rigiera.
const openNewPosition = () => {
  editingPosition.value = { id: null, estado: "borrador" };
  editPositionForm.value = { cargo_id: "", title: "", position_type: "real", is_unit_head: false };
  positionTab.value = "datos";
  positionError.value = "";
  vigenciaDelPuesto.prepararVida({ estado: "borrador" }, [], []);
  vigenciaDelPuesto.cargarActos();
};
// Con fecha de inicio, la vigencia tiene que estar completa; sin ella, basta el cargo.
const sePuedeCrearElPuesto = computed(() =>
  Boolean(editPositionForm.value.cargo_id)
  && (!vigenciaDelPuesto.vidaForm.value.vigente_desde || vigenciaDelPuesto.sePuedeGuardar.value)
);
const confirmCreatePosition = async () => {
  if (!detailUnit.value?.id || !sePuedeCrearElPuesto.value) return;
  const form = editPositionForm.value;
  const vida = { ...vigenciaDelPuesto.vidaForm.value };
  savingPosition.value = true;
  positionError.value = "";
  let creadoId = null;
  try {
    const { data } = await adminSqlService.addUnitPosition(detailUnit.value.id, { ...form });
    creadoId = data?.id ?? null;
    if (vida.vigente_desde && creadoId) await vigenciaDelPuesto.guardarVida(creadoId);
    editingPosition.value = null;
    setFeedback("success", "Puesto creado.");
    await refreshAfterPositionChange();
  } catch (e) {
    const mensaje = e?.response?.data?.message || "No se pudo crear el puesto.";
    if (!creadoId) {
      positionError.value = mensaje;
    } else {
      // El puesto SÍ se creó; lo que falló fue ponerlo en vigor. Se queda abierto, ya como puesto
      // existente y con lo que se había escrito, para corregirlo sin crear otro.
      await refreshAfterPositionChange();
      const creado = detailPositions.value.find((pos) => pos.id === creadoId);
      if (creado) {
        openEditPosition(creado, "vigencia");
        Object.assign(vigenciaDelPuesto.vidaForm.value, vida);
      } else {
        editingPosition.value = null;
      }
      positionError.value = `El puesto se creó, en borrador, pero no se pudo poner en vigor: ${mensaje}`;
    }
  } finally {
    savingPosition.value = false;
  }
};

const removePosition = async (positionId) => {
  modalError.value = "";
  try {
    await adminSqlService.removeUnitPosition(positionId);
    setFeedback("success", "Puesto eliminado.");
    await refreshAfterPositionChange();
  } catch (e) {
    avisarDeError(e?.response?.data?.message || "No se pudo eliminar el puesto.");
  }
};

const openEditPosition = (pos, pestana = "datos") => {
  editingPosition.value = pos;
  editPositionForm.value = {
    cargo_id: pos.cargo_id || "",
    title: pos.title || "",
    position_type: pos.position_type || "real",
    is_unit_head: Number(pos.is_unit_head) === 1
  };
  positionTab.value = pestana;
  positionError.value = "";
  // El puesto ya trae consigo su periodo de hoy y todas sus vidas: llegan con el detalle de la unidad.
  vigenciaDelPuesto.prepararVida(pos, pos.vigencias || [], pos.antecesores || []);
  vigenciaDelPuesto.cargarActos();
  cargarPuestosASuceder();
};
const closeEditPosition = () => { editingPosition.value = null; };
const confirmEditPosition = async () => {
  const pos = editingPosition.value;
  const form = editPositionForm.value;
  if (!pos) return;
  savingPosition.value = true;
  positionError.value = "";
  try {
    await adminSqlService.updateUnitPosition(pos.id, {
      cargo_id: form.cargo_id ? Number(form.cargo_id) : undefined,
      title: form.title,
      position_type: form.position_type,
      is_unit_head: form.is_unit_head ? 1 : 0
    });
    editingPosition.value = null;
    setFeedback("success", "Puesto actualizado.");
    await refreshAfterPositionChange();
  } catch (e) {
    positionError.value = e?.response?.data?.message || "No se pudo actualizar el puesto.";
  } finally {
    savingPosition.value = false;
  }
};
const descartarVidaDelPuesto = async () => {
  if (!props.editable || !vigenciaDelPuesto.sePuedeDescartar.value) return;
  savingPosition.value = true;
  positionError.value = "";
  try {
    await vigenciaDelPuesto.descartarVida();
    editingPosition.value = null;
    setFeedback("success", "Vida programada del puesto descartada.");
    await refreshAfterPositionChange();
  } catch (e) {
    positionError.value = e?.response?.data?.message || "No se pudo descartar la vida del puesto.";
  } finally {
    savingPosition.value = false;
  }
};
// Guarda la vida que enseña la pestaña «Vigencia» del puesto: ponerlo en vigor, suprimirlo o reactivarlo.
const saveVidaDelPuesto = async () => {
  const pos = editingPosition.value;
  if (!props.editable || !pos?.id || !vigenciaDelPuesto.sePuedeGuardar.value) return;
  savingPosition.value = true;
  positionError.value = "";
  try {
    await vigenciaDelPuesto.guardarVida(pos.id);
    editingPosition.value = null;
    setFeedback("success", "Vigencia del puesto actualizada.");
    await refreshAfterPositionChange();
  } catch (e) {
    positionError.value = e?.response?.data?.message || "No se pudo guardar la vigencia del puesto.";
  } finally {
    savingPosition.value = false;
  }
};

// Wizard de perfil: abre/guarda el JSON de perfil del puesto.
const openProfileWizard = (pos) => {
  profileWizardPosition.value = pos;
};
const saveProfileWizard = async (profile) => {
  const pos = profileWizardPosition.value;
  profileWizardPosition.value = null;
  if (!pos) return;
  try {
    await adminSqlService.updateUnitPosition(pos.id, { profile });
    setFeedback("success", "Perfil del puesto guardado.");
    await refreshAfterPositionChange();
  } catch (e) {
    avisarDeError(e?.response?.data?.message || "No se pudo guardar el perfil.");
  }
};

const toggleHead = async (pos) => {
  modalError.value = "";
  try {
    await adminSqlService.updateUnitPosition(pos.id, { is_unit_head: pos.is_unit_head ? 0 : 1 });
    await refreshAfterPositionChange();
  } catch (e) {
    avisarDeError(e?.response?.data?.message || "No se pudo cambiar la jefatura.");
  }
};

const unassign = async (positionId) => {
  modalError.value = "";
  try {
    await adminSqlService.unassignUnitPosition(positionId);
    setFeedback("success", "Ocupante retirado.");
    await refreshAfterPositionChange();
  } catch (e) {
    avisarDeError(e?.response?.data?.message || "No se pudo retirar el ocupante.");
  }
};

const openAssign = (positionId) => {
  assignForId.value = assignForId.value === positionId ? null : positionId;
  personQuery.value = "";
  personResults.value = [];
};
const searchPersons = async () => {
  const q = personQuery.value.trim();
  if (q.length < 2) {
    personResults.value = [];
    return;
  }
  personSearching.value = true;
  try {
    const { data } = await adminSqlService.list("persons", { q, limit: 8 });
    personResults.value = Array.isArray(data) ? data : (data?.rows || []);
  } catch {
    personResults.value = [];
  } finally {
    personSearching.value = false;
  }
};
const pickPerson = async (personId) => {
  const positionId = assignForId.value;
  assignForId.value = null;
  if (!positionId) return;
  try {
    await adminSqlService.assignUnitPosition(positionId, personId);
    setFeedback("success", "Ocupante asignado.");
    await refreshAfterPositionChange();
  } catch (e) {
    avisarDeError(e?.response?.data?.message || "No se pudo asignar el ocupante.");
  }
};

// Tipo de relación a usar al crear una arista (el activo si es específico; si 'all', org o el primero).
const relationTypeIdForCreate = () => {
  if (activeRelationType.value !== "all") {
    const byActive = relationTypes.value.find((r) => r.code === activeRelationType.value);
    if (byActive) return byActive.id;
  }
  return (relationTypes.value.find((r) => r.code === "org") || relationTypes.value[0])?.id || null;
};
const parentUnitIdOf = (childId) => {
  const edge = (rawGraph.value.edges || []).find((e) => String(e.child_unit_id) === String(childId));
  return edge ? edge.parent_unit_id : null;
};

const openCreateUnit = (mode, parentUnitId, anchorName) => {
  if (!props.editable) return;
  createForm.value = { name: "", slug: "", unit_type_id: "" };
  createContext.value = { mode, parentUnitId: parentUnitId || null, anchorName: anchorName || "" };
};
const onAddChild = (unitId) => {
  openCreateUnit("child", unitId, nodeNameById.value.get(String(unitId)));
};
const onAddSibling = (unitId) => {
  const parentId = parentUnitIdOf(unitId);
  openCreateUnit("sibling", parentId, nodeNameById.value.get(String(unitId)));
};

const createDialogTitle = computed(() =>
  createContext.value?.mode === "sibling" ? "Agregar unidad hermana" : "Agregar unidad hija"
);
const createDialogHint = computed(() => {
  const ctx = createContext.value;
  if (!ctx) return "";
  if (ctx.mode === "sibling") {
    return ctx.parentUnitId
      ? `Se creará bajo el mismo padre que "${ctx.anchorName}".`
      : `"${ctx.anchorName}" es una raíz: la nueva unidad se creará sin padre.`;
  }
  return `Se creará como hija de "${ctx.anchorName}".`;
});

const confirmCreateUnit = async () => {
  const ctx = createContext.value;
  const form = createForm.value;
  if (!ctx || !form.name.trim() || !form.unit_type_id) return;
  const parentId = ctx.parentUnitId;
  try {
    await adminSqlService.createUnitWithParent({
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      unit_type_id: Number(form.unit_type_id),
      parent_unit_id: parentId || null,
      relation_type_id: parentId ? relationTypeIdForCreate() : null
    });
    createContext.value = null;
    setFeedback("success", "Unidad creada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo crear la unidad.");
  }
};

const loadUnitTypes = async () => {
  try {
    const { data } = await adminSqlService.list("unit_types", { limit: 200 });
    unitTypes.value = Array.isArray(data) ? data : (data?.rows || []);
  } catch {
    unitTypes.value = [];
  }
};

// CAMBIAR DE PADRE, por conectar, por arrastrar una arista o por quitarla (frente 27, D-04). Si la
// relación que la unidad tiene ya rige, pregunta desde cuándo; si es un borrador, la cambia sin más.
// Devuelve `false` si se canceló. El tipo de relación viaja en `tipoDelMovimiento` porque el
// composable no sabe de tipos: los procesos no los tienen.
let tipoDelMovimiento = null;
const moverUnidad = useMoverNodo({
  mover: (hijoId, padreId, extras) =>
    adminSqlService.setUnitParent(Number(hijoId), {
      ...extras,
      parent_unit_id: padreId ? Number(padreId) : null,
      relation_type_id: tipoDelMovimiento
    }),
  // Corregir arregla la relación de hoy en su sitio: le cambia el padre, con motivo.
  corregir: ({ aristaId, padreId, motivo }) =>
    adminSqlService.corregirEstructura({ tabla: "unit_relations", id: aristaId, cambios: { parent_unit_id: Number(padreId) }, motivo }),
  puedeCorregir: vigencia.puedeCorregir
});
// El cambio de padre que ya tiene fecha, dicho en el modal de la unidad: el organigrama dibuja el de hoy.
const cambioProgramado = computed(() => {
  const arista = (rawGraph.value.edges || []).find((e) => String(e.child_unit_id) === String(detailUnit.value?.id));
  if (!arista) return "";
  return fraseDelCambioProgramado({
    estado: arista.estado,
    hasta: arista.vigente_hasta,
    proximoPadre: arista.proximo_padre_id ? nodeNameById.value.get(String(arista.proximo_padre_id)) || "" : "",
    proximoDesde: arista.proximo_padre_desde
  });
});
const cambiarPadre = (hijoId, padreId, relationTypeId) => {
  tipoDelMovimiento = Number(relationTypeId);
  const arista = (rawGraph.value.edges || []).find(
    (e) => String(e.child_unit_id) === String(hijoId) && Number(e.relation_type_id) === tipoDelMovimiento
  );
  const hijo = (rawGraph.value.nodes || []).find((u) => String(u.id) === String(hijoId));
  if (!vigencia.actoOptions.value.length) vigencia.cargarActos();
  return moverUnidad.pedir({
    hijoId: Number(hijoId),
    padreId: padreId ? Number(padreId) : null,
    hijoNombre: hijo?.name || "",
    padreNombre: padreId ? nodeNameById.value.get(String(padreId)) || "" : "",
    estadoDeLaArista: arista?.estado,
    estadoDelNodo: hijo?.estado,
    aristaId: arista?.id
  });
};

// Fase 4: conectar dos nodos crea la relación padre(source)→hija(target).
const onConnect = async ({ source, target }) => {
  if (!props.editable || !source || !target || source === target) return;
  if (activeRelationType.value === "all") {
    setFeedback("error", "Elige un tipo de relación específico (no 'Todos') para crear aristas.");
    return;
  }
  const rtId = relationTypes.value.find((r) => r.code === activeRelationType.value)?.id;
  if (!rtId) {
    setFeedback("error", "No se encontró el tipo de relación para crear la arista.");
    return;
  }
  try {
    if (!(await cambiarPadre(target, source, rtId))) return;
    setFeedback("success", "Relación creada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo crear la relación.");
    await loadGraph();
  }
};

const findEdgeById = (edgeId) => edges.value.find((e) => e.id === edgeId) || null;

// Abrir diálogos desde la toolbar de la arista.
const openDeleteEdge = (edgeId) => {
  if (!props.editable) return;
  selectedEdge.value = findEdgeById(edgeId);
};
const openEditEdge = (edgeId) => {
  if (!props.editable) return;
  const edge = findEdgeById(edgeId);
  if (!edge) return;
  editingEdge.value = edge;
  editingTypeCode.value = edge.data?.code || props.relationType;
};

const confirmDeleteEdge = async () => {
  const edge = selectedEdge.value;
  selectedEdge.value = null;
  if (!edge?.data?.relationId) return;
  try {
    // Quitar una relación que ya rige no la borra: le pone fin, y pregunta desde cuándo.
    if (!(await cambiarPadre(edge.target, null, edge.data.relationTypeId))) return;
    setFeedback("success", "Relación eliminada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo eliminar la relación.");
  }
};

const confirmEditEdge = async () => {
  const edge = editingEdge.value;
  const newCode = editingTypeCode.value;
  editingEdge.value = null;
  if (!edge?.data?.relationId) return;
  const newTypeId = relationTypes.value.find((r) => r.code === newCode)?.id;
  if (!newTypeId || newTypeId === edge.data.relationTypeId) return;
  try {
    await adminSqlService.update("unit_relations", { id: edge.data.relationId }, { relation_type_id: newTypeId });
    setFeedback("success", "Tipo de relación actualizado.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo cambiar el tipo de relación.");
    await loadGraph();
  }
};

// Reparentar arrastrando el extremo de la arista a otro nodo: quita la relación vieja y crea la nueva.
const onEdgeUpdate = async ({ edge, connection }) => {
  if (!props.editable) return;
  const relationId = edge?.data?.relationId;
  const rtId = edge?.data?.relationTypeId;
  const source = connection?.source;
  const target = connection?.target;
  if (!relationId || !rtId || !source || !target || source === target) return;
  try {
    // Antes eran dos llamadas —borrar y crear— y entre las dos la unidad quedaba suelta. Ahora es
    // una, y si la relación ya rige no se borra: se cierra y se abre otra.
    if (!(await cambiarPadre(target, source, rtId))) {
      await loadGraph();
      return;
    }
    setFeedback("success", "Relación reasignada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo reasignar la relación.");
    await loadGraph();
  }
};

watch(estadosVisibles, buildGraph);
watch(healthOnly, buildGraph);
watch(activeRelationType, loadGraph);
onMounted(() => {
  loadGraph();
  loadUnitTypes();
  loadCargos();
});

// refreshProcesses: tras crear/editar una configuración en el wizard, recarga la lista de procesos del drawer.
const refreshProcessesIfOpen = async () => {
  if (detailUnit.value?.id && detailTab.value === "procesos") {
    detailProcessesLoaded.value = false;
    await loadUnitProcesses();
  } else {
    detailProcessesLoaded.value = false;
  }
};
defineExpose({ reloadGraph: loadGraph, refreshProcesses: refreshProcessesIfOpen });
</script>
