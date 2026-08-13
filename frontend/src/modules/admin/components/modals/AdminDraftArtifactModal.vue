<template>
  <component
    :is="shellComponent"
    ref="modalRef"
    labelled-by="draftArtifactModalLabel"
    :title="draftArtifactEditId ? 'Editar plantilla de documento' : 'Crear plantilla de documento'"
    size="xl"
    dialog-class="max-w-7xl"
    content-class="border-0 shadow"
    close-action
    @close="$emit('close')"
  >
    <template #title>
      <span class="inline-flex items-center gap-1.5">
        {{ draftArtifactEditId ? 'Editar plantilla de documento' : 'Crear plantilla de documento' }}
        <AppInfoTip placement="bottom">
          Este flujo {{ draftArtifactEditId ? "actualiza" : "crea" }} la plantilla de documento y la sube directamente a MinIO. Solo cuando la carga termine correctamente se guarda el registro en el sistema.
        </AppInfoTip>
      </span>
    </template>
    <AppAlert v-if="draftArtifactError">{{ draftArtifactError }}</AppAlert>
    <div v-if="draftArtifactLoading" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Subiendo archivos a <strong>MinIO</strong>. Espera a que termine la carga para continuar.
    </div>

    <!-- Gobierno del ciclo de vida: estado (draft/published/retired) + publicar/retirar/versionar (solo al editar) -->
    <div v-if="draftArtifactEditId" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3" :class="guidedConfigId ? 'border-brand-300 bg-brand-50' : 'border-brand-200 bg-brand-50/50'">
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted">Estado</span>
        <span class="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-bold" :class="lifecycleBadgeClass">{{ lifecycleLabel }}</span>
        <span v-if="draftArtifactForm.storage_version" class="text-xs font-medium text-muted">· {{ draftArtifactForm.storage_version }}</span>
        <span v-if="guidedConfigId" class="text-xs font-medium text-primary">· Actualización guiada: al publicar se activa la nueva configuración</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AdminButton v-if="lifecycleState === 'draft' && guidedConfigId" variant="primary" @click="$emit('finish-guided')">Publicar y activar config</AdminButton>
        <AdminButton v-else-if="lifecycleState === 'draft'" variant="primary" @click="$emit('publish')">Publicar</AdminButton>
        <AdminButton v-if="lifecycleState === 'published'" variant="cancel" @click="$emit('retire')">Retirar</AdminButton>
        <AdminButton v-if="!guidedConfigId" variant="outlinePrimary" @click="openVersionDialog">Nueva versión</AdminButton>
      </div>
    </div>

    <!-- Diálogo de nueva versión: elige el nivel de cambio semver. Anidado sobre el modal de la plantilla. -->
    <AppDialogOverlay
      :open="showVersionDialog"
      title="Crear nueva versión"
      panel-class="max-w-md"
      @close="showVersionDialog = false"
    >
      <p class="mb-3 mt-0 text-sm text-icon">
        Elige el tipo de cambio. La nueva versión nace <strong>inactiva</strong>, clonada de la versión actual<span v-if="draftArtifactForm.storage_version"> ({{ draftArtifactForm.storage_version }})</span>.
      </p>
      <div class="flex flex-col gap-2">
        <label
          v-for="opt in versionBumpOptions"
          :key="opt.value"
          class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors"
          :class="versionBumpLevel === opt.value ? 'border-brand-400 bg-brand-50/60' : 'border-line hover:border-line-strong'"
        >
          <input v-model="versionBumpLevel" type="radio" name="bump-level" :value="opt.value" class="mt-1" />
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-strong">{{ opt.label }} <span class="font-mono text-xs font-normal text-muted">{{ opt.example }}</span></span>
            <span class="block text-xs text-muted">{{ opt.hint }}</span>
          </span>
        </label>
      </div>
      <template #footer>
        <AdminButton variant="cancel" @click="showVersionDialog = false">Cancelar</AdminButton>
        <AdminButton variant="primary" @click="confirmNewVersion">Crear versión</AdminButton>
      </template>
    </AppDialogOverlay>

    <!-- Aviso de solo lectura: versión publicada/retirada (inmutable). -->
    <div v-if="isReadOnly" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      Esta versión está <strong>{{ lifecycleLabel.toLowerCase() }}</strong> y es de <strong>solo lectura</strong>.
      Usa <strong>“Nueva versión”</strong> (arriba) para crear una versión editable.
    </div>

    <!-- Pestañas con indicadores de avance -->
    <div class="mt-3">
      <ProfileSubsectionTabs v-model="activeTab" :tabs="tabDescriptors" aria-label="Secciones de la plantilla" />
    </div>

    <!-- Paneles: en solo lectura, fieldset disabled inhabilita todos los controles (se ve pero no se edita). -->
    <fieldset class="m-0 min-w-0 border-0 p-0" :disabled="isReadOnly">

    <!-- Pestaña: General -->
    <div v-show="activeTab === 'general'" class="mt-4 grid gap-3 md:grid-cols-12">
      <AdminFieldGroup label="Semilla (base)" :label-for="fieldId('template-seed-id')" group-class="md:col-span-6">
        <template #labelSuffix>
          <AppInfoTip>Toda plantilla nace de una semilla; por defecto se usa la general.</AppInfoTip>
        </template>
        <AdminSelectField
          :id="fieldId('template-seed-id')"
          :model-value="draftArtifactForm.template_seed_id"
          @update:model-value="updateField('template_seed_id', $event)"
        >
          <option
            v-for="row in draftArtifactSeedOptions"
            :key="row.id"
            :value="String(row.id)"
          >
            {{ row.display_name }}{{ row.seed_code === DEFAULT_SEED_CODE ? " (por defecto)" : "" }}
          </option>
        </AdminSelectField>
      </AdminFieldGroup>
      <!-- Badge de solo lectura: redundante al crear (desde admin siempre es oficial). Solo en edición/consulta. -->
      <AdminFieldGroup v-if="draftArtifactEditId" label="Tipo de plantilla" group-class="md:col-span-6">
        <template #labelSuffix>
          <AppInfoTip>{{ isAdHoc ? "Extensión puntual de usuario: permite persona concreta; sin tipo de unidad." : "Desde admin solo se crean oficiales: permiten tipo de unidad; sin persona concreta." }}</AppInfoTip>
        </template>
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="isAdHoc ? 'bg-amber-100 text-warning' : 'bg-brand-100 text-primary'"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="isAdHoc ? 'bg-amber-500' : 'bg-brand-500'"></span>
          {{ isAdHoc ? "De usuario (ad-hoc)" : "De proceso (oficial)" }}
        </span>
      </AdminFieldGroup>
      <AdminFieldGroup label="Nombre de la plantilla" :label-for="fieldId('display-name')" group-class="md:col-span-6">
        <AdminInputField
          :id="fieldId('display-name')"
          :model-value="draftArtifactForm.display_name"
          placeholder="Nombre de la plantilla"
          @update:model-value="updateField('display_name', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Descripcion" :label-for="fieldId('description')" group-class="md:col-span-6">
        <AdminInputField
          :id="fieldId('description')"
          :model-value="draftArtifactForm.description"
          placeholder="Descripcion breve"
          @update:model-value="updateField('description', $event)"
        />
      </AdminFieldGroup>
      <!-- El vínculo a proceso se gestiona DESDE el proceso: no se muestra si viene por contexto ni al editar
           (el link se conserva). Solo aparecería en un alta standalone (hoy deshabilitada). -->
      <AdminFieldGroup v-if="!hasPreselectedProcess && !draftArtifactEditId" label="Configuración destino" :label-for="fieldId('process-definition-id')" group-class="md:col-span-12">
        <template #labelSuffix>
          <AppInfoTip>La plantilla quedará vinculada a esta configuración de proceso (o 'default' para tareas libres). ¿No existe? Créala con el wizard guiado.</AppInfoTip>
        </template>
        <div class="flex gap-2">
          <AdminSelectField
            :id="fieldId('process-definition-id')"
            class="flex-1"
            :model-value="draftArtifactForm.process_definition_id"
            @update:model-value="updateField('process_definition_id', $event)"
          >
            <option value="">{{ requireProcessLink ? 'Selecciona una configuración (obligatorio)' : 'Sin vincular (opcional)' }}</option>
            <option
              v-for="proc in processDefinitionOptions"
              :key="proc.id"
              :value="String(proc.id)"
            >
              {{ proc.label }}
            </option>
          </AdminSelectField>
          <AdminButton variant="cancel" @click="$emit('create-process')">+ Nueva configuración</AdminButton>
        </div>
      </AdminFieldGroup>
      <!-- Modo de emisión del vínculo a proceso. Solo al crear; en edición se ajusta desde el proceso. -->
      <AdminFieldGroup v-if="!draftArtifactEditId" label="Modo de emisión" :label-for="fieldId('item-mode')" group-class="md:col-span-12">
        <template #labelSuffix>
          <AppInfoTip>Cómo se emiten los entregables de esta plantilla en el proceso. Se puede reajustar luego desde la configuración del proceso.</AppInfoTip>
        </template>
        <AdminSelectField
          :id="fieldId('item-mode')"
          :model-value="draftArtifactForm.item_mode || 'single'"
          @update:model-value="updateField('item_mode', $event)"
        >
          <option value="single">Simple (1 entregable)</option>
          <option value="replicated">Replicado (N con etiqueta)</option>
          <option value="routed">Ruteado (endosar a alguien)</option>
        </AdminSelectField>
        <p v-if="isRouted" class="mt-1 m-0 text-xs font-medium text-amber-600">
          El flujo (entrega/firma) de un routed se define AL ENVIAR, no aquí.
        </p>
      </AdminFieldGroup>
    </div>

    <!-- Pestaña: Formatos -->
    <div v-show="activeTab === 'formatos'" class="mt-4 grid gap-3 md:grid-cols-12">
      <div v-if="!isFormatosComplete" class="md:col-span-12 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
        Adjunta al menos un documento de referencia (PDF, Word, Excel o PowerPoint) para poder crear la plantilla.
      </div>
      <div class="md:col-span-3">
        <label :for="fieldId('upload-pdf')" class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-body">PDF</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('pdf')" :filled="isDraftFileSelected('pdf')" accept=".pdf" :input-id="fieldId('upload-pdf')" @files-selected="emitDraftFiles('pdf', $event)" />
      </div>
      <div class="md:col-span-3">
        <label :for="fieldId('upload-docx')" class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-body">Word</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('docx')" :filled="isDraftFileSelected('docx')" accept=".doc,.docx" :input-id="fieldId('upload-docx')" @files-selected="emitDraftFiles('docx', $event)" />
      </div>
      <div class="md:col-span-3">
        <label :for="fieldId('upload-xlsx')" class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-body">Excel</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('xlsx')" :filled="isDraftFileSelected('xlsx')" accept=".xls,.xlsx" :input-id="fieldId('upload-xlsx')" @files-selected="emitDraftFiles('xlsx', $event)" />
      </div>
      <div class="md:col-span-3">
        <label :for="fieldId('upload-pptx')" class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-body">PowerPoint</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('pptx')" :filled="isDraftFileSelected('pptx')" accept=".ppt,.pptx" :input-id="fieldId('upload-pptx')" @files-selected="emitDraftFiles('pptx', $event)" />
      </div>
      <div v-if="draftArtifactPreviewStatus !== 'idle'" class="md:col-span-12">
        <!-- Rotulo del preview: no es un <label> porque no hay control que etiquetar (es un iframe). -->
        <span class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-body">Preview del seed</span>
        <div v-if="draftArtifactPreviewStatus === 'loading'" class="rounded-xl border border-line bg-surface px-4 py-5 text-center text-sm font-medium text-muted">
          Cargando preview…
        </div>
        <iframe v-else-if="draftArtifactPreviewStatus === 'ready' && draftArtifactPreviewUrl" :src="draftArtifactPreviewUrl" class="min-h-105 w-full rounded-xl border border-line bg-white" title="Preview del seed"></iframe>
        <div v-else class="rounded-xl border border-dashed border-line bg-surface px-4 py-5 text-center text-sm font-medium text-muted">
          Este seed no tiene un PDF de preview publicado.
        </div>
      </div>
    </div>

    <!-- Pestaña: Campos del formulario (schema.json) -->
    <div v-show="activeTab === 'campos'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div class="inline-flex items-center gap-1.5">
          <h4 class="m-0 text-sm font-bold text-strong">Campos del formulario</h4>
          <AppInfoTip>Definen los datos que el usuario llenará en el entregable (schema.json).</AppInfoTip>
        </div>
        <AdminButton variant="outlinePrimary" @click="addSchemaField">+ Añadir campo</AdminButton>
      </div>
      <div v-if="!schemaFields.length" class="mt-3 rounded-xl border border-dashed border-line bg-surface px-4 py-5 text-center text-sm font-medium text-muted">
        Aún no hay campos. Añade al menos uno para generar el formulario del entregable.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div v-for="(field, index) in schemaFields" :key="index" class="grid grid-cols-12 items-end gap-2 rounded-xl border border-line bg-white px-3 py-2.5">
          <div class="col-span-3">
            <label :for="fieldId(`field-key-${index}`)" class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-muted">Clave</label>
            <input :id="fieldId(`field-key-${index}`)" :value="field.key" placeholder="ej. semestre" class="w-full rounded-2xl border border-line px-2.5 py-1.5 text-sm outline-none" @input="updateSchemaField(index, 'key', $event.target.value)" />
          </div>
          <div class="col-span-3">
            <label :for="fieldId(`field-title-${index}`)" class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-muted">Etiqueta</label>
            <input :id="fieldId(`field-title-${index}`)" :value="field.title" placeholder="ej. Semestre" class="w-full rounded-2xl border border-line px-2.5 py-1.5 text-sm outline-none" @input="updateSchemaField(index, 'title', $event.target.value)" />
          </div>
          <div class="col-span-2">
            <label :for="fieldId(`field-component-${index}`)" class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-muted">Componente</label>
            <select :id="fieldId(`field-component-${index}`)" :value="field.component" class="w-full rounded-2xl border border-line px-2.5 py-1.5 text-sm outline-none" @change="updateSchemaField(index, 'component', $event.target.value)">
              <option value="text">Texto</option>
              <option value="textarea">Área de texto</option>
              <option value="richtext">Texto enriquecido</option>
              <option value="number">Número</option>
              <option value="switch">Interruptor</option>
              <option value="date">Fecha</option>
              <option value="select">Selección</option>
              <option value="hidden">Oculto</option>
            </select>
          </div>
          <div class="col-span-2">
            <label :for="fieldId(`field-group-${index}`)" class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-muted">Grupo</label>
            <input :id="fieldId(`field-group-${index}`)" :value="field.group" placeholder="general" class="w-full rounded-2xl border border-line px-2.5 py-1.5 text-sm outline-none" @input="updateSchemaField(index, 'group', $event.target.value)" />
          </div>
          <div class="col-span-1 flex flex-col items-center justify-center gap-1 pb-1.5">
            <span class="text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Req.</span>
            <SToggle :model-value="!!field.required" @change="(value) => updateSchemaField(index, 'required', value)" />
          </div>
          <div class="col-span-1 flex items-center justify-end pb-1">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-line text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar campo" @click="removeSchemaField(index)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pestaña: Flujo de ENTREGA -->
    <div v-show="activeTab === 'entrega'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div class="inline-flex items-center gap-1.5">
          <h4 class="m-0 text-sm font-bold text-strong">Flujo de entrega</h4>
          <AppInfoTip>Dentro de este documento, quién hace cada paso. (A quién le toca el proceso lo deciden las reglas objetivo, no aquí.)</AppInfoTip>
        </div>
        <AdminButton variant="outlinePrimary" @click="addFillStep">+ Añadir paso</AdminButton>
      </div>
      <div v-if="draftArtifactForm.process_definition_id && !processHasRules && !processScopeLoading" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-warning">
        El proceso vinculado aún no tiene <strong>reglas objetivo</strong>. Los ámbitos “Unidad del proceso” quedan deshabilitados (resolverían a nadie); define primero las reglas o usa una unidad específica.
      </div>
      <div v-if="!fillSteps.length" class="mt-3 rounded-xl border border-dashed border-line bg-surface px-4 py-4 text-center text-sm font-medium text-muted">
        Sin pasos de entrega.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div
          v-for="(step, index) in fillSteps"
          :key="index"
          class="overflow-hidden rounded-xl border-l-4 border bg-white"
          :class="stepToneClass(index)"
          draggable="true"
          @dragstart="onStepDragStart('fill', index)"
          @dragover.prevent
          @drop="onStepDrop('fill', index)"
          @dragend="onStepDragEnd"
        >
          <!-- Cabecera (resumen): arrastra para reordenar; Editar expande; cada paso con su tono. -->
          <div class="flex items-center gap-2 px-3 py-2">
            <span class="cursor-grab select-none px-1 text-gray-300" title="Arrastra para reordenar" aria-hidden="true">⠿</span>
            <span class="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-bold" :class="stepBadgeClass(index)">{{ index + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-sm font-semibold text-strong">{{ step.name || "Paso sin nombre" }}</p>
              <p class="m-0 truncate text-xs text-muted">{{ fillWhoSummary(step) }}</p>
            </div>
            <AdminButton
              variant="secondary"
              size="sm"
              icon-only
              :class-name="expandedFillStep === index ? 'hope-action-btn hope-action-select' : 'hope-action-btn hope-action-edit'"
              :title="expandedFillStep === index ? 'Listo' : 'Editar paso'"
              :aria-label="expandedFillStep === index ? 'Listo' : 'Editar paso'"
              @click="toggleFillStep(index)"
            >
              <font-awesome-icon :icon="expandedFillStep === index ? 'check' : 'edit'" />
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              icon-only
              class-name="hope-action-btn hope-action-delete"
              title="Eliminar paso"
              aria-label="Eliminar paso"
              @click="removeFillStep(index)"
            >
              <font-awesome-icon icon="trash" />
            </AdminButton>
          </div>
          <!-- Editor (expandido). El orden lo define el arrastre; aquí no se edita el número. -->
          <div v-show="expandedFillStep === index" class="border-t border-line px-3 py-2.5">
            <div class="grid grid-cols-12 items-end gap-2">
              <div class="col-span-6">
                <label :for="fieldId(`fill-name-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Nombre</label>
                <input :id="fieldId(`fill-name-${index}`)" :value="step.name" placeholder="ej. Entrega del docente" class="w-full rounded-2xl border border-line px-2.5 py-1.5 text-sm outline-none" @input="updateFillStep(index, 'name', $event.target.value)" />
              </div>
              <div class="col-span-3">
                <label :for="fieldId(`fill-who-mode-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Quién hace el paso</label>
                <select :id="fieldId(`fill-who-mode-${index}`)" :value="stepWhoMode(step)" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="updateFillStepWho(index, $event.target.value)">
                  <option value="task_assignee">Responsable del entregable</option>
                  <option value="scope">Por cargo</option>
                  <option v-if="isAdHoc" value="person">Persona concreta</option>
                </select>
              </div>
              <div v-if="fillStepShowsMode(step)" class="col-span-3">
                <label :for="fieldId(`fill-selection-mode-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Modo</label>
                <select :id="fieldId(`fill-selection-mode-${index}`)" :value="step.selection_mode" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="updateFillStep(index, 'selection_mode', $event.target.value)">
                  <option value="auto_one">Uno cualquiera</option>
                  <option value="auto_all">Todas</option>
                </select>
              </div>
            </div>
            <!-- "Por cargo": primero la UBICACIÓN; el cargo se ofrece solo entre los que tienen titular vigente ahí. -->
            <div v-if="stepWhoMode(step) === 'scope'" class="mt-2 grid grid-cols-12 gap-2">
              <div class="col-span-4">
                <label :for="fieldId(`fill-unit-scope-type-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Ubicación</label>
                <select :id="fieldId(`fill-unit-scope-type-${index}`)" :value="step.unit_scope_type" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="updateFillStepUbicacion(index, $event.target.value)">
                  <option value="context_exact" :disabled="!processHasRules">En la misma unidad del entregable{{ processHasRules ? "" : " — requiere reglas" }}</option>
                  <option value="unit_exact">En una unidad específica…</option>
                  <option v-if="!isAdHoc" value="unit_type">En un tipo de unidad…</option>
                </select>
              </div>
              <template v-if="fillStepNeedsUnit(step)">
                <div class="col-span-4">
                  <label :for="fieldId(`fill-filter-unit-type-id-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Tipo (filtro)</label>
                  <select :id="fieldId(`fill-filter-unit-type-id-${index}`)" :value="step.filter_unit_type_id || ''" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="onUnitTypeFilterChange(index, Number($event.target.value) || null)">
                    <option value="">Todos los tipos</option>
                    <option v-for="t in unitTypeOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
                  </select>
                </div>
                <div class="col-span-4">
                  <label :for="fieldId(`fill-unit-id-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Unidad</label>
                  <select :id="fieldId(`fill-unit-id-${index}`)" :value="step.unit_id || ''" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="onUnitExactUnitChange(index, Number($event.target.value) || null)">
                    <option value="">— Selecciona unidad —</option>
                    <option v-for="u in fillStepUnitOptions(step)" :key="u.id" :value="u.id">{{ u.name }}</option>
                  </select>
                </div>
              </template>
              <div v-else-if="fillStepNeedsUnitType(step)" class="col-span-4">
                <label :for="fieldId(`fill-unit-type-id-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Tipo de unidad</label>
                <select :id="fieldId(`fill-unit-type-id-${index}`)" :value="step.unit_type_id || ''" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="onUnitTypeScopeChange(index, Number($event.target.value) || null)">
                  <option value="">— Selecciona tipo —</option>
                  <option v-for="t in unitTypeOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
              <div class="col-span-4">
                <label :for="fieldId(`fill-cargo-id-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Cargo</label>
                <select :id="fieldId(`fill-cargo-id-${index}`)" :value="step.cargo_id || ''" :disabled="!fillStepCargoReady(step)" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none disabled:bg-surface disabled:text-muted" @change="updateFillStep(index, 'cargo_id', Number($event.target.value) || null)">
                  <option value="">{{ fillStepCargoPlaceholder(step) }}</option>
                  <option v-for="c in fillStepCargoOptions(step)" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </div>
            <div v-else-if="stepWhoMode(step) === 'person'" class="mt-2 grid grid-cols-12 gap-2">
              <div class="col-span-6">
                <label :for="fieldId(`fill-person-id-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Persona</label>
                <select :id="fieldId(`fill-person-id-${index}`)" :value="step.person_id || ''" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="updateFillStep(index, 'person_id', Number($event.target.value) || null)">
                  <option value="">— Selecciona persona —</option>
                  <option v-for="p in personOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pestaña: Flujo de FIRMAS — mismo modelo que entrega. Pasos SECUENCIALES; dentro de un paso varios
         firmantes en paralelo según "Aprobación". El token de cada firmante se prepara para el render (futuro);
         hoy se firma por coordenadas vía el firmador. Sin anclas manuales: el slot de token se deriva del paso. -->
    <div v-show="activeTab === 'firmas'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div class="inline-flex items-center gap-1.5">
          <h4 class="m-0 text-sm font-bold text-strong">Flujo de firmas</h4>
          <AppInfoTip>Quién firma cada paso (mismo modelo que entrega). Los pasos van en orden; dentro de un paso, la “Aprobación” define si firman todas, cualquiera o un mínimo.</AppInfoTip>
        </div>
        <AdminButton variant="outlinePrimary" @click="addSignatureStep">+ Añadir paso</AdminButton>
      </div>

      <div v-if="!signatureSteps.length" class="mt-3 rounded-xl border border-dashed border-line bg-surface px-4 py-4 text-center text-sm font-medium text-muted">
        Sin pasos de firma.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div
          v-for="(step, index) in signatureSteps"
          :key="`sig-${index}`"
          class="overflow-hidden rounded-xl border-l-4 border bg-white"
          :class="stepToneClass(index)"
          draggable="true"
          @dragstart="onStepDragStart('signature', index)"
          @dragover.prevent
          @drop="onStepDrop('signature', index)"
          @dragend="onStepDragEnd"
        >
          <!-- Cabecera (resumen): arrastra para reordenar; Editar expande; cada paso con su tono. -->
          <div class="flex items-center gap-2 px-3 py-2">
            <span class="cursor-grab select-none px-1 text-gray-300" title="Arrastra para reordenar" aria-hidden="true">⠿</span>
            <span class="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-bold" :class="stepBadgeClass(index)">{{ index + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-sm font-semibold text-strong">{{ step.name || "Paso sin nombre" }}</p>
              <p class="m-0 truncate text-xs text-muted">{{ signatureSummary(step) }}</p>
            </div>
            <AdminButton
              variant="secondary"
              size="sm"
              icon-only
              :class-name="expandedSignatureStep === index ? 'hope-action-btn hope-action-select' : 'hope-action-btn hope-action-edit'"
              :title="expandedSignatureStep === index ? 'Listo' : 'Editar paso'"
              :aria-label="expandedSignatureStep === index ? 'Listo' : 'Editar paso'"
              @click="toggleSignatureStep(index)"
            >
              <font-awesome-icon :icon="expandedSignatureStep === index ? 'check' : 'edit'" />
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              icon-only
              class-name="hope-action-btn hope-action-delete"
              title="Eliminar paso"
              aria-label="Eliminar paso"
              @click="removeSignatureStep(index)"
            >
              <font-awesome-icon icon="trash" />
            </AdminButton>
          </div>
          <!-- Editor (expandido). El orden lo define el arrastre; aquí no se edita el número. -->
          <div v-show="expandedSignatureStep === index" class="border-t border-line px-3 py-2.5">
          <div class="grid grid-cols-12 items-end gap-2">
            <div class="col-span-7">
              <label :for="fieldId(`sig-name-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Nombre</label>
              <input :id="fieldId(`sig-name-${index}`)" :value="step.name" placeholder="ej. Firma de dirección" class="w-full rounded-2xl border border-line px-2.5 py-1.5 text-sm outline-none" @input="updateSignatureStep(index, 'name', $event.target.value)" />
            </div>
            <div class="col-span-5">
              <label :for="fieldId(`sig-approval-mode-${index}`)" class="mb-1 inline-flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Aprobación <AppInfoTip>Cómo se cierra el paso entre sus firmantes: Todas (todos firman), Cualquiera (basta uno) o Al menos N.</AppInfoTip></label>
              <select :id="fieldId(`sig-approval-mode-${index}`)" :value="step.approval_mode || 'and'" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="updateSignatureStep(index, 'approval_mode', $event.target.value)">
                <option value="and">Todas</option>
                <option value="or">Cualquiera</option>
                <option value="at_least">Al menos…</option>
              </select>
            </div>
          </div>
          <!-- "Al menos N": mínimo de firmas requerido del conjunto de firmantes del paso. -->
          <div v-if="step.approval_mode === 'at_least'" class="mt-2 grid grid-cols-12 gap-2">
            <div class="col-span-3">
              <label :for="fieldId(`sig-required-signers-min-${index}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Mínimo de firmas</label>
              <input :id="fieldId(`sig-required-signers-min-${index}`)" type="number" min="1" :value="step.required_signers_min || 1" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @input="updateSignatureStep(index, 'required_signers_min', Number($event.target.value) || 1)" />
            </div>
          </div>

          <!-- Firmantes del paso: cada uno con su propio resolutor; el cupo entre ellos lo define "Aprobación". -->
          <div class="mt-3 border-t border-line pt-2">
            <div class="flex items-center justify-between">
              <span class="inline-flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Firmantes <AppInfoTip>Varias personas pueden firmar en este paso. Configura cada firmante; el orden entre pasos es secuencial, los firmantes de un mismo paso van en paralelo.</AppInfoTip></span>
              <button type="button" class="rounded-2xl border border-brand-200 px-2 py-1 text-xs font-semibold text-primary transition hover:bg-brand-50" @click="addSignatureSigner(index)">+ Añadir firmante</button>
            </div>
            <div v-for="(signer, si) in stepSigners(step)" :key="`sig-${index}-${si}`" class="mt-2 rounded-2xl border border-line bg-surface/60 px-2.5 py-2">
              <div class="grid grid-cols-12 items-end gap-2">
                <div :class="stepSigners(step).length > 1 ? 'col-span-11' : 'col-span-12'">
                  <label :for="fieldId(`signer-who-mode-${index}-${si}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Quién firma</label>
                  <select :id="fieldId(`signer-who-mode-${index}-${si}`)" :value="stepWhoMode(signer)" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="updateSignatureWho(index, si, $event.target.value)">
                    <option value="task_assignee">Responsable del entregable</option>
                    <option value="scope">Por cargo</option>
                    <option v-if="isAdHoc" value="person">Persona concreta</option>
                  </select>
                </div>
                <div v-if="stepSigners(step).length > 1" class="col-span-1 flex items-center justify-end pb-1">
                  <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-line text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar firmante" @click="removeSignatureSigner(index, si)">✕</button>
                </div>
              </div>
              <div v-if="stepWhoMode(signer) === 'scope'" class="mt-2 grid grid-cols-12 gap-2">
                <div class="col-span-4">
                  <label :for="fieldId(`signer-unit-scope-type-${index}-${si}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Ubicación</label>
                  <select :id="fieldId(`signer-unit-scope-type-${index}-${si}`)" :value="signer.unit_scope_type" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="updateSignatureUbicacion(index, si, $event.target.value)">
                    <option value="context_exact" :disabled="!processHasRules">En la misma unidad del entregable{{ processHasRules ? "" : " — requiere reglas" }}</option>
                    <option value="unit_exact">En una unidad específica…</option>
                    <option v-if="!isAdHoc" value="unit_type">En un tipo de unidad…</option>
                  </select>
                </div>
                <template v-if="fillStepNeedsUnit(signer)">
                  <div class="col-span-4">
                    <label :for="fieldId(`signer-filter-unit-type-id-${index}-${si}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Tipo (filtro)</label>
                    <select :id="fieldId(`signer-filter-unit-type-id-${index}-${si}`)" :value="signer.filter_unit_type_id || ''" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="onSignatureUnitTypeFilterChange(index, si, Number($event.target.value) || null)">
                      <option value="">Todos los tipos</option>
                      <option v-for="t in unitTypeOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
                    </select>
                  </div>
                  <div class="col-span-4">
                    <label :for="fieldId(`signer-unit-id-${index}-${si}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Unidad</label>
                    <select :id="fieldId(`signer-unit-id-${index}-${si}`)" :value="signer.unit_id || ''" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="onSignatureUnitExactChange(index, si, Number($event.target.value) || null)">
                      <option value="">— Selecciona unidad —</option>
                      <option v-for="u in fillStepUnitOptions(signer)" :key="u.id" :value="u.id">{{ u.name }}</option>
                    </select>
                  </div>
                </template>
                <div v-else-if="fillStepNeedsUnitType(signer)" class="col-span-4">
                  <label :for="fieldId(`signer-unit-type-id-${index}-${si}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Tipo de unidad</label>
                  <select :id="fieldId(`signer-unit-type-id-${index}-${si}`)" :value="signer.unit_type_id || ''" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="onSignatureUnitTypeScopeChange(index, si, Number($event.target.value) || null)">
                    <option value="">— Selecciona tipo —</option>
                    <option v-for="t in unitTypeOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
                  </select>
                </div>
                <div class="col-span-4">
                  <label :for="fieldId(`signer-cargo-id-${index}-${si}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Cargo</label>
                  <select :id="fieldId(`signer-cargo-id-${index}-${si}`)" :value="signer.cargo_id || ''" :disabled="!fillStepCargoReady(signer)" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none disabled:bg-surface disabled:text-muted" @change="updateSignatureSigner(index, si, 'cargo_id', Number($event.target.value) || null)">
                    <option value="">{{ fillStepCargoPlaceholder(signer) }}</option>
                    <option v-for="c in fillStepCargoOptions(signer)" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                </div>
              </div>
              <div v-else-if="stepWhoMode(signer) === 'person'" class="mt-2 grid grid-cols-12 gap-2">
                <div class="col-span-6">
                  <label :for="fieldId(`signer-person-id-${index}-${si}`)" class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-muted">Persona</label>
                  <select :id="fieldId(`signer-person-id-${index}-${si}`)" :value="signer.person_id || ''" class="w-full rounded-2xl border border-line px-2 py-1.5 text-sm outline-none" @change="updateSignatureSigner(index, si, 'person_id', Number($event.target.value) || null)">
                    <option value="">— Selecciona persona —</option>
                    <option v-for="p in personOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
    </fieldset>

    <template #footer>
      <AdminButton variant="cancel" @click="$emit('close')">{{ isReadOnly ? "Cerrar" : "Cancelar" }}</AdminButton>
      <AdminButton v-if="!isFirstTab" variant="secondary" @click="goPrevTab">Atrás</AdminButton>
      <AdminButton v-if="!isLastTab" variant="primary" @click="goNextTab">Siguiente →</AdminButton>
      <AdminButton
        v-if="!isReadOnly"
        variant="outlinePrimary"
        :disabled="draftArtifactLoading || !canSubmit"
        :title="submitBlockReason"
        @click="$emit('submit')"
      >
        {{ draftArtifactLoading ? "Subiendo a MinIO..." : (draftArtifactEditId ? "Guardar cambios" : "Crear plantilla") }}
      </AdminButton>
    </template>
  </component>
</template>

<script setup>
import { ref, computed, watch, onMounted, useId } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppInlineShell from "@/shared/components/modals/AppInlineShell.vue";
import AppDialogOverlay from "@/shared/components/modals/AppDialogOverlay.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import PdfDropField from "@/shared/components/forms/PdfDropField.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";
import AppInfoTip from "@/shared/components/widgets/AppInfoTip.vue";


// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;
// Configuraciones de proceso destino (para vincular la plantilla).
const processDefinitionOptions = ref([]);
const loadProcessDefinitionOptions = async () => {
  try {
    const { data } = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_versions"), {
      params: { orderBy: "name", order: "asc", limit: 500 },
    });
    const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
    const STATUS_LABEL = { draft: "borrador", active: "activa", retired: "retirada" };
    // Se incluyen borrador + activa: una configuración nueva nace en borrador y necesita plantillas
    // asignadas para poder activarse, así que debe poder elegirse aquí. Se excluyen las retiradas.
    processDefinitionOptions.value = rows
      .filter((r) => String(r.status || "").toLowerCase() !== "retired")
      .map((r) => {
        const status = String(r.status || "").toLowerCase();
        const statusText = STATUS_LABEL[status] || status || "—";
        const name = r.name || r.variation_key || `Def ${r.id}`;
        return {
          id: r.id,
          name,
          label: `${name} (v${r.definition_version || "?"} · ${statusText})`,
        };
      });
  } catch {
    processDefinitionOptions.value = [];
  }
};
// Toda plantilla debe pertenecer a un proceso: el vínculo es obligatorio para todos los roles.
const requireProcessLink = computed(() => true);
// Cuando el modal se abre DESDE un proceso, la configuración destino llega por contexto: el campo de
// selección se omite (redundante en la creación). El vínculo se resuelve por preselectProcessDefinitionId.
const hasPreselectedProcess = computed(() => Boolean(props.preselectProcessDefinitionId));
onMounted(loadProcessDefinitionOptions);

// ── Catálogos para resolver el responsable/ámbito de cada paso (controlados contra la DB) ──
// Se cargan desde el endpoint genérico de tablas; así la UI solo permite referenciar entidades existentes.
const cargoOptions = ref([]);
const unitOptions = ref([]);
const unitTypeOptions = ref([]);
const personOptions = ref([]);
const workflowCatalogsLoaded = ref(false);
const toRows = (data) => (Array.isArray(data) ? data : (data?.rows || data?.data || []));
const loadWorkflowCatalogs = async () => {
  if (workflowCatalogsLoaded.value) {
    return;
  }
  try {
    const [cargoRes, unitRes, unitTypeRes, personRes] = await Promise.all([
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("cargos"), { params: { filter_is_active: 1, orderBy: "name", order: "asc", limit: 500 } }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), { params: { filter_is_active: 1, orderBy: "name", order: "asc", limit: 1000 } }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_types"), { params: { orderBy: "name", order: "asc", limit: 500 } }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("persons"), { params: { orderBy: "first_name", order: "asc", limit: 1000 } }),
    ]);
    cargoOptions.value = toRows(cargoRes.data).map((r) => ({ id: r.id, code: r.code || "", name: r.name || r.code || `Cargo ${r.id}` }));
    unitOptions.value = toRows(unitRes.data).map((r) => ({ id: r.id, name: r.label || r.name || `Unidad ${r.id}`, unit_type_id: r.unit_type_id ?? null }));
    unitTypeOptions.value = toRows(unitTypeRes.data).map((r) => ({ id: r.id, name: r.name || `Tipo ${r.id}` }));
    personOptions.value = toRows(personRes.data).map((r) => ({ id: r.id, name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || `Persona ${r.id}` }));
    workflowCatalogsLoaded.value = true;
  } catch {
    cargoOptions.value = [];
    unitOptions.value = [];
    unitTypeOptions.value = [];
    personOptions.value = [];
  }
};

const props = defineProps({
  draftArtifactEditId: { type: String, default: "" },
  draftArtifactError: { type: String, default: "" },
  draftArtifactLoading: { type: Boolean, default: false },
  draftArtifactForm: { type: Object, default: () => ({}) },
  draftArtifactSeedOptions: { type: Array, default: () => [] },
  draftArtifactPreviewUrl: { type: String, default: "" },
  draftArtifactPreviewStatus: { type: String, default: "idle" },
  getDraftArtifactFileLabel: { type: Function, required: true },
  // Cuando el wizard crea un proceso desde este modal, se pasa su id para seleccionarlo y refrescar opciones.
  newProcessDefinitionId: { type: [String, Number], default: "" },
  // Configuración de origen al crear una plantilla desde el flujo de edición de configuración:
  // se preselecciona en el select (y se refrescan las opciones para incluirla aunque sea borrador).
  preselectProcessDefinitionId: { type: [String, Number], default: "" },
  // Embebido: renderiza el wizard sin su propio overlay (para hospedarlo como pestaña dentro de otro modal).
  embedded: { type: Boolean, default: false },
  // Actualización guiada (F2): si está presente, esta plantilla borrador tiene una config borrador asociada;
  // "Publicar" pasa a "Publicar y activar config" (emite finish-guided) y se oculta "Nueva versión".
  guidedConfigId: { type: [String, Number], default: null }
});

const emit = defineEmits(["update:form", "file-change", "drop", "close", "submit", "change-active", "new-version", "create-process", "publish", "retire", "finish-guided"]);

// Ciclo de vida de la versión: gobierna el strip (publicar/retirar) y el badge.
const lifecycleState = computed(() => String(props.draftArtifactForm.lifecycle_state || "published"));
const lifecycleLabel = computed(() => ({ draft: "Borrador", published: "Publicada", retired: "Retirada" }[lifecycleState.value] || lifecycleState.value));
const lifecycleBadgeClass = computed(() => {
  if (lifecycleState.value === "published") return "text-emerald-600";
  if (lifecycleState.value === "draft") return "text-amber-600";
  return "text-muted";
});
// Solo lectura: editando una versión publicada/retirada (inmutable). Se ve el contenido pero no se edita ni
// se guarda; el strip ofrece "Nueva versión" para crear una versión editable.
const isReadOnly = computed(() => !!props.draftArtifactEditId && lifecycleState.value !== "draft");
const modalRef = ref(null);
const shellComponent = computed(() => (props.embedded ? AppInlineShell : AppModalShell));

// Tipo de plantilla: 'official' (de proceso) | 'ad_hoc' (de usuario). Gatea las opciones de autoría de pasos.
const templateScope = computed(() => (String(props.draftArtifactForm.template_scope || "official") === "ad_hoc" ? "ad_hoc" : "official"));
const isAdHoc = computed(() => templateScope.value === "ad_hoc");

// Cada vez que el modal se muestra, refresca las configuraciones (para incluir borradores recién creados)
// y, si se abrió desde el flujo de edición de una configuración, la preselecciona en el select.
const refreshDefinitionOptionsOnShow = async () => {
  await loadProcessDefinitionOptions();
  if (
    !props.draftArtifactEditId
    && props.preselectProcessDefinitionId
    && !props.draftArtifactForm.process_definition_id
  ) {
    updateField("process_definition_id", String(props.preselectProcessDefinitionId));
  }
};
onMounted(() => {
  modalRef.value?.el?.addEventListener("shown.bs.modal", refreshDefinitionOptionsOnShow);
  modalRef.value?.el?.addEventListener("shown.bs.modal", loadWorkflowCatalogs);
  // En modo embebido (pestaña Crear dentro del picker) no hay evento shown.bs.modal: los catálogos de
  // tipos/unidades/cargos/personas se cargan al montar para que los selectores "Por cargo" funcionen.
  if (props.embedded) {
    refreshDefinitionOptionsOnShow();
    loadWorkflowCatalogs();
  }
});

// Código de la semilla por defecto (debe coincidir con DEFAULT_TEMPLATE_SEED_CODE del backend).
const DEFAULT_SEED_CODE = "latex/informe-general";

// Al crear (sin editar), preselecciona la semilla por defecto (o la primera) en cuanto cargan las opciones,
// para no mostrar una opción "General" separada que duplique a la semilla real.
watch(
  () => [props.draftArtifactSeedOptions, props.draftArtifactEditId, props.draftArtifactForm.template_seed_id],
  () => {
    if (props.draftArtifactEditId) {
      return;
    }
    const options = props.draftArtifactSeedOptions || [];
    if (!options.length || props.draftArtifactForm.template_seed_id) {
      return;
    }
    const fallback = options.find((row) => row.seed_code === DEFAULT_SEED_CODE) || options[0];
    if (fallback?.id) {
      updateField("template_seed_id", String(fallback.id));
    }
  },
  { immediate: true, deep: true }
);

// Al volver del wizard con un proceso nuevo: recarga opciones y selecciona el creado.
watch(() => props.newProcessDefinitionId, async (id) => {
  if (!id) {
    return;
  }
  await loadProcessDefinitionOptions();
  updateField("process_definition_id", String(id));
  activeTab.value = "general";
});

// ── Pestañas ──
// Flujo guiado: semilla/base → documento de referencia → entrega → firmas → campos del documento (schema).
const TAB_KEYS = ["general", "formatos", "entrega", "firmas", "campos"];
// 'routed' NO autora flujo (se define al enviar) → se ocultan las pestañas de entrega y firmas.
const isRouted = computed(() => String(props.draftArtifactForm.item_mode || "single") === "routed");
const visibleTabKeys = computed(() =>
  (isRouted.value ? TAB_KEYS.filter((key) => key !== "entrega" && key !== "firmas") : TAB_KEYS)
);
const activeTab = ref("general");
// Si el modo cambia a routed estando en una pestaña de flujo ya oculta, regresa a General.
watch(isRouted, () => {
  if (!visibleTabKeys.value.includes(activeTab.value)) activeTab.value = "general";
});

const isGeneralComplete = computed(() => {
  const hasName = Boolean(String(props.draftArtifactForm.display_name || "").trim());
  const hasProcess = !requireProcessLink.value || Boolean(props.draftArtifactForm.process_definition_id);
  return hasName && hasProcess;
});
// Al crear se exige al menos un documento de referencia (pdf/docx/xlsx/pptx); el seed ya no basta.
// En edición se considera completo si ya hay formatos existentes en la plantilla.
const isFormatosComplete = computed(() => {
  const labels = ["pdf", "docx", "xlsx", "pptx"].map((k) => props.getDraftArtifactFileLabel(k));
  const hasUploadedDoc = labels.some((l) => l && l !== "Sin archivo");
  if (hasUploadedDoc) return true;
  return Boolean(props.draftArtifactEditId);
});
const isCamposComplete = computed(() => schemaFields.value.length > 0);
const isEntregaComplete = computed(() => fillSteps.value.length > 0);
const isFirmasComplete = computed(() => signatureSteps.value.length > 0);

// Requisitos para crear: proceso destino + documento de referencia + >=1 paso de entrega.
// (Campos y firmas son opcionales). En edición no se bloquea el guardado.
const canSubmit = computed(() => {
  if (props.draftArtifactEditId) return true;
  // routed no autora flujo de entrega: no se exige ≥1 paso (se define al enviar).
  const flowOk = isRouted.value || isEntregaComplete.value;
  return isGeneralComplete.value && isFormatosComplete.value && flowOk;
});

// Motivo dinámico de bloqueo (tooltip del botón "Crear"): lista SOLO lo que falta según el modo y el
// contexto (p. ej. un routed desde el proceso no pide "proceso destino" ni "flujo de entrega").
const submitBlockReason = computed(() => {
  if (canSubmit.value) return "";
  const missing = [];
  if (!String(props.draftArtifactForm.display_name || "").trim()) missing.push("nombre");
  if (requireProcessLink.value && !props.draftArtifactForm.process_definition_id) missing.push("proceso destino");
  if (!isFormatosComplete.value) missing.push("documento de referencia");
  if (!isRouted.value && !isEntregaComplete.value) missing.push("al menos un paso de flujo de entrega");
  return missing.length ? `Faltan: ${missing.join(", ")}.` : "";
});

const tabState = {
  general: isGeneralComplete,
  formatos: isFormatosComplete,
  campos: isCamposComplete,
  entrega: isEntregaComplete,
  firmas: isFirmasComplete,
};
const TAB_LABELS = { general: "General", formatos: "Formatos", entrega: "Entrega", firmas: "Firmas", campos: "Campos (documento)" };
const tabDescriptors = computed(() => visibleTabKeys.value.map((key) => ({
  key,
  label: `${TAB_LABELS[key]}${tabState[key].value ? " ✓" : ""}`,
})));

const currentTabIndex = computed(() => visibleTabKeys.value.indexOf(activeTab.value));
const isFirstTab = computed(() => currentTabIndex.value <= 0);
const isLastTab = computed(() => currentTabIndex.value >= visibleTabKeys.value.length - 1);
const goNextTab = () => {
  const next = visibleTabKeys.value[currentTabIndex.value + 1];
  if (next) activeTab.value = next;
};
const goPrevTab = () => {
  const prev = visibleTabKeys.value[currentTabIndex.value - 1];
  if (prev) activeTab.value = prev;
};
// Reinicia a la primera pestaña al cambiar entre crear/editar.
watch(() => props.draftArtifactEditId, () => { activeTab.value = "general"; });

// Nueva versión (semver): el usuario elige el nivel en un diálogo y el back calcula la nueva versión.
const versionBumpLevel = ref("minor");
const showVersionDialog = ref(false);
const versionBumpOptions = [
  { value: "patch", label: "Parche", example: "X.Y.Z+1", hint: "Correcciones o ajustes menores." },
  { value: "minor", label: "Menor", example: "X.Y+1.0", hint: "Cambios compatibles (nuevos campos, mejoras)." },
  { value: "major", label: "Mayor", example: "X+1.0.0", hint: "Cambios importantes o incompatibles." }
];
const openVersionDialog = () => {
  versionBumpLevel.value = "minor";
  showVersionDialog.value = true;
};
const confirmNewVersion = () => {
  showVersionDialog.value = false;
  emit("new-version", versionBumpLevel.value);
};

const updateField = (fieldName, value) => {
  emit("update:form", { ...props.draftArtifactForm, [fieldName]: value });
};

const schemaFields = computed(() => Array.isArray(props.draftArtifactForm.schema_fields) ? props.draftArtifactForm.schema_fields : []);
const commitSchemaFields = (next) => {
  emit("update:form", { ...props.draftArtifactForm, schema_fields: next });
};
const addSchemaField = () => {
  commitSchemaFields([...schemaFields.value, { key: "", title: "", component: "text", group: "general", required: false }]);
};
const updateSchemaField = (index, prop, value) => {
  commitSchemaFields(schemaFields.value.map((f, i) => (i === index ? { ...f, [prop]: value } : f)));
};
const removeSchemaField = (index) => {
  commitSchemaFields(schemaFields.value.filter((_, i) => i !== index));
};

// ── Flujo de entrega ──
const fillSteps = computed(() => props.draftArtifactForm.fill_workflow?.steps || []);
const commitFillSteps = (steps) => {
  emit("update:form", { ...props.draftArtifactForm, fill_workflow: { required: true, ...props.draftArtifactForm.fill_workflow, steps } });
};
const addFillStep = () => {
  // El nuevo paso se agrega al final, así que su índice es la longitud ACTUAL (antes del commit). Leer la
  // longitud después de commit daría el valor viejo (el prop no se actualiza de forma síncrona).
  const newIndex = fillSteps.value.length;
  commitFillSteps([...fillSteps.value, {
    order: newIndex + 1,
    name: "",
    resolver_type: "task_assignee",
    selection_mode: "auto_one",
    cargo_id: null,
    cargo_code: "",
    unit_scope_type: "context_exact",
    unit_id: null,
    unit_type_id: null,
    filter_unit_type_id: null,
    person_id: null,
    position_id: null,
    field_refs: [],
    required: true
  }]);
  expandedFillStep.value = newIndex; // auto-expande el nuevo
};
const updateFillStep = (index, prop, value) => {
  commitFillSteps(fillSteps.value.map((s, i) => (i === index ? { ...s, [prop]: value } : s)));
};
const patchFillStep = (index, patch) => {
  commitFillSteps(fillSteps.value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
};
const removeFillStep = (index) => {
  commitFillSteps(renumberSteps(fillSteps.value.filter((_, i) => i !== index)));
  if (expandedFillStep.value === index) expandedFillStep.value = null;
};

// ── Resúmenes colapsables + reordenar (drag) + tonos por paso (entrega y firmas) ──
const expandedFillStep = ref(null);
const expandedSignatureStep = ref(null);
const toggleFillStep = (index) => { expandedFillStep.value = expandedFillStep.value === index ? null : index; };
const toggleSignatureStep = (index) => { expandedSignatureStep.value = expandedSignatureStep.value === index ? null : index; };

// Paleta de tonos para diferenciar pasos (se cicla por índice).
const STEP_TONES = [
  { card: "border-brand-200", badge: "bg-brand-100 text-primary" },
  { card: "border-emerald-200", badge: "bg-emerald-100 text-success" },
  { card: "border-amber-200", badge: "bg-amber-100 text-warning" },
  { card: "border-blue-light-200", badge: "bg-blue-light-100 text-info" },
  { card: "border-rose-200", badge: "bg-rose-100 text-rose-700" },
  { card: "border-brand-200", badge: "bg-brand-100 text-primary" }
];
const stepToneClass = (index) => STEP_TONES[index % STEP_TONES.length].card;
const stepBadgeClass = (index) => STEP_TONES[index % STEP_TONES.length].badge;

// Etiquetas legibles desde los catálogos cargados.
const cargoName = (id) => cargoOptions.value.find((c) => Number(c.id) === Number(id))?.name || "";
const personName = (id) => personOptions.value.find((p) => Number(p.id) === Number(id))?.name || "";
const unitName = (id) => unitOptions.value.find((u) => Number(u.id) === Number(id))?.name || "";
const unitTypeName = (id) => unitTypeOptions.value.find((t) => Number(t.id) === Number(id))?.name || "";
const scopeSummary = (obj) => {
  const scope = String(obj?.unit_scope_type || "");
  if (scope === "unit_exact") return unitName(obj?.unit_id) || "unidad específica";
  if (scope === "unit_type") return `tipo: ${unitTypeName(obj?.unit_type_id) || "—"}`;
  return "misma unidad del entregable";
};
// Resumen de "quién" para un objeto con resolutor (paso de entrega o firmante).
const whoSummary = (obj) => {
  const who = stepWhoMode(obj);
  if (who === "task_assignee") return "Responsable del entregable";
  if (who === "person") return personName(obj?.person_id) ? `Persona: ${personName(obj?.person_id)}` : "Persona concreta";
  const cargo = cargoName(obj?.cargo_id);
  return `${cargo ? `Cargo: ${cargo}` : "Por cargo"} · ${scopeSummary(obj)}`;
};
const fillWhoSummary = (step) => whoSummary(step);
const APPROVAL_LABEL = { and: "Todas", or: "Cualquiera", at_least: "Al menos N" };
const signatureSummary = (step) => {
  const n = stepSigners(step).length;
  const approval = APPROVAL_LABEL[String(step?.approval_mode || "and")] || "Todas";
  return `${n} firmante${n === 1 ? "" : "s"} · ${approval}`;
};

// Reordenar pasos por drag (DnD nativo). Renumera `order` para mantener 1..N.
const renumberSteps = (arr) => arr.map((s, i) => ({ ...s, order: i + 1 }));
const moveInArray = (arr, from, to) => {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};
const stepDrag = ref({ kind: null, index: null });
const onStepDragStart = (kind, index) => { stepDrag.value = { kind, index }; };
const onStepDragEnd = () => { stepDrag.value = { kind: null, index: null }; };
const onStepDrop = (kind, index) => {
  const { kind: fromKind, index: from } = stepDrag.value;
  onStepDragEnd();
  if (fromKind !== kind || from === null || from === index) return;
  if (kind === "fill") {
    commitFillSteps(renumberSteps(moveInArray(fillSteps.value, from, index)));
    if (expandedFillStep.value === from) expandedFillStep.value = index;
  } else {
    commitSignature({ steps: renumberSteps(moveInArray(signatureSteps.value, from, index)) });
    if (expandedSignatureStep.value === from) expandedSignatureStep.value = index;
  }
};
// "Quién hace el paso": 'task_assignee' (responsable del entregable) | 'scope' (cargo por ubicación) |
// 'person' (persona concreta, SOLO en plantillas de usuario/ad-hoc). El conjunto de opciones lo gatea el
// tipo de plantilla (template_scope), tanto en front como en back.
const stepWhoMode = (step) => {
  const type = String(step?.resolver_type || "task_assignee");
  if (type === "task_assignee") return "task_assignee";
  if (type === "specific_person") return "person";
  return "scope";
};
const updateFillStepWho = (index, value) => {
  if (value === "task_assignee") {
    patchFillStep(index, { resolver_type: "task_assignee", cargo_id: null, unit_id: null, unit_type_id: null, person_id: null });
    return;
  }
  if (value === "person") {
    patchFillStep(index, { resolver_type: "specific_person", cargo_id: null, unit_id: null, unit_type_id: null, filter_unit_type_id: null });
    return;
  }
  const scopeType = processHasRules.value ? "context_exact" : "unit_exact";
  // Se primero la ubicación: al entrar a "por cargo" se limpia el cargo (se ofrecerá según la ubicación).
  patchFillStep(index, {
    resolver_type: "cargo_in_scope",
    unit_scope_type: scopeType,
    cargo_id: null,
    unit_id: null,
    unit_type_id: null,
    filter_unit_type_id: null,
    person_id: null
  });
  if (scopeType === "context_exact") loadResolvableCargos({});
};
const updateFillStepUbicacion = (index, value) => {
  // Cambiar de ubicación invalida el cargo elegido (el conjunto resoluble cambia).
  patchFillStep(index, {
    unit_scope_type: value,
    cargo_id: null,
    unit_id: value === "unit_exact" ? (fillSteps.value[index]?.unit_id ?? null) : null,
    unit_type_id: null,
    filter_unit_type_id: null
  });
  if (value === "context_exact") loadResolvableCargos({});
};
// Elegir el tipo de unidad (ámbito) recarga los cargos resolubles en cualquier unidad de ese tipo.
const onUnitTypeScopeChange = (index, value) => {
  patchFillStep(index, { unit_type_id: value, cargo_id: null });
  if (value) loadResolvableCargos({ unitTypeId: value });
};
// El "Modo" (uno cualquiera / todas) solo aplica con cargo (puede resolver varias personas).
const fillStepShowsMode = (step) => String(step?.resolver_type || "") === "cargo_in_scope";
const fillStepNeedsUnit = (step) => String(step?.unit_scope_type || "") === "unit_exact";
const fillStepNeedsUnitType = (step) => String(step?.unit_scope_type || "") === "unit_type";

// Unidad fija = ruteo a una oficina concreta (puede estar fuera del alcance). El filtro por tipo es solo un
// atajo de navegación para acortar la lista; no se persiste (el paso guarda únicamente unit_id).
const fillStepUnitOptions = (step) => {
  if (step?.filter_unit_type_id) {
    return unitOptions.value.filter((u) => Number(u.unit_type_id) === Number(step.filter_unit_type_id));
  }
  return unitOptions.value;
};
const onUnitTypeFilterChange = (index, value) => {
  patchFillStep(index, { filter_unit_type_id: value, unit_id: null, cargo_id: null });
};
// Elegir la unidad fija recarga los cargos resolubles de ESA unidad e invalida el cargo previo.
const onUnitExactUnitChange = (index, value) => {
  patchFillStep(index, { unit_id: value, cargo_id: null });
  if (value) loadResolvableCargos({ unitId: value });
};

// Cargos resolubles por ubicación (con titular vigente): el back es la fuente, así no se ofrece un cargo que
// el paso no podría resolver. Cacheado por clave 'ctx' (alcance del proceso, para "misma unidad") o
// 'u:<id>' (unidad fija). 'ctx' sirve a TODOS los pasos context_exact; cada unidad fija tiene su entrada.
const resolvableCargos = ref({});
const loadResolvableCargos = async ({ unitId = null, unitTypeId = null } = {}) => {
  const defId = props.draftArtifactForm.process_definition_id;
  if (!defId) return;
  const key = unitTypeId ? `ut:${unitTypeId}` : (unitId ? `u:${unitId}` : "ctx");
  if (resolvableCargos.value[key]) return;
  resolvableCargos.value = { ...resolvableCargos.value, [key]: { loading: true, cargos: [] } };
  try {
    const params = {};
    if (unitTypeId) params.unit_type_id = unitTypeId;
    else if (unitId) params.unit_id = unitId;
    const { data } = await axios.get(API_ROUTES.ADMIN_SQL_PROCESS_RESOLVABLE_CARGOS(defId), { params });
    resolvableCargos.value = { ...resolvableCargos.value, [key]: { loading: false, cargos: data?.cargos || [] } };
  } catch {
    resolvableCargos.value = { ...resolvableCargos.value, [key]: { loading: false, cargos: [] } };
  }
};
const fillStepCargoKey = (step) => {
  const scope = String(step?.unit_scope_type || "");
  if (scope === "unit_exact") return step?.unit_id ? `u:${step.unit_id}` : null;
  if (scope === "unit_type") return step?.unit_type_id ? `ut:${step.unit_type_id}` : null;
  return "ctx";
};
// El cargo solo es elegible cuando la ubicación está definida: con reglas (misma unidad), con unidad elegida
// (unidad específica) o con tipo de unidad elegido.
const fillStepCargoReady = (step) => {
  const scope = String(step?.unit_scope_type || "");
  if (scope === "unit_exact") return Boolean(step?.unit_id);
  if (scope === "unit_type") return Boolean(step?.unit_type_id);
  return processHasRules.value;
};
const fillStepCargoOptions = (step) => {
  const key = fillStepCargoKey(step);
  const list = (key && resolvableCargos.value[key]?.cargos) || [];
  // Si el cargo ya elegido no está en la lista (p. ej. perdió titular tras guardarse), se conserva visible
  // para no vaciar el select en silencio; el guardado lo validará en back.
  if (step?.cargo_id && !list.some((c) => Number(c.id) === Number(step.cargo_id))) {
    const known = cargoOptions.value.find((c) => Number(c.id) === Number(step.cargo_id));
    if (known) return [...list, { id: known.id, name: `${known.name} (sin puesto aquí)` }];
  }
  return list;
};
const fillStepCargoPlaceholder = (step) => {
  if (!fillStepCargoReady(step)) {
    const scope = String(step?.unit_scope_type || "");
    if (scope === "unit_exact") return "Elige primero la unidad";
    if (scope === "unit_type") return "Elige primero el tipo de unidad";
    return "— Selecciona cargo —";
  }
  const entry = resolvableCargos.value[fillStepCargoKey(step)];
  if (entry?.loading) return "Cargando cargos…";
  if (entry && !entry.cargos.length) return "Sin cargos con puesto aquí";
  return "— Selecciona cargo —";
};
// Precarga las listas de cargos necesarias al abrir/editar (pasos ya guardados) o al cargar el alcance.
const ensureResolvableCargosLoaded = () => {
  let needsCtx = false;
  // Mismos cargos resolubles sirven a entrega (un resolutor por paso) y firmas (varios firmantes por paso).
  const considerScopeObject = (obj) => {
    if (String(obj?.resolver_type || "") !== "cargo_in_scope") return;
    const scope = String(obj?.unit_scope_type || "");
    if (scope === "unit_exact") {
      if (obj?.unit_id) loadResolvableCargos({ unitId: obj.unit_id });
    } else if (scope === "unit_type") {
      if (obj?.unit_type_id) loadResolvableCargos({ unitTypeId: obj.unit_type_id });
    } else {
      needsCtx = true;
    }
  };
  for (const step of fillSteps.value) considerScopeObject(step);
  for (const step of (props.draftArtifactForm.signature_workflow?.steps || [])) {
    const signers = Array.isArray(step?.signers) && step.signers.length ? step.signers : [step];
    for (const signer of signers) considerScopeObject(signer);
  }
  if (needsCtx && processHasRules.value) loadResolvableCargos({});
};

// Ámbito resoluble del proceso vinculado (sus reglas objetivo): habilita los ámbitos de contexto y
// acota el select de unidades. Sin reglas, los ámbitos de contexto resolverían a nadie.
const processScope = ref(null);
const processScopeLoading = ref(false);
const loadProcessScope = async (definitionId) => {
  if (!definitionId) {
    processScope.value = null;
    return;
  }
  processScopeLoading.value = true;
  try {
    const { data } = await axios.get(API_ROUTES.ADMIN_SQL_PROCESS_TARGET_SCOPE(definitionId));
    processScope.value = data || null;
  } catch {
    processScope.value = null;
  } finally {
    processScopeLoading.value = false;
  }
};
watch(() => props.draftArtifactForm.process_definition_id, (id) => { loadProcessScope(id); }, { immediate: true });
const processHasRules = computed(() => Boolean(processScope.value?.has_rules));
const processSupportsContext = computed(() => Boolean(processScope.value?.supports_context));
// Precarga los cargos resolubles de los pasos por cargo (al abrir/editar o cuando llega el alcance). Va aquí
// para que processHasRules ya esté declarado al ejecutarse de inmediato.
watch([fillSteps, processHasRules], ensureResolvableCargosLoaded, { immediate: true });

// ── Flujo de firmas ── Mismo modelo que entrega (resolver "Quién firma"). Sin anclas: el slot de token por
// paso se deriva del code. selection_mode siempre auto_all (resuelve candidatos); el quórum lo da approval_mode.
const signatureSteps = computed(() => props.draftArtifactForm.signature_workflow?.steps || []);
watch(signatureSteps, ensureResolvableCargosLoaded);
const commitSignature = (patch) => {
  emit("update:form", {
    ...props.draftArtifactForm,
    signature_workflow: {
      required: true,
      steps: signatureSteps.value,
      ...props.draftArtifactForm.signature_workflow,
      ...patch,
    },
  });
};
// Firmante por defecto (resolutor inicial = responsable del entregable).
const newSignatureSigner = () => ({
  resolver_type: "task_assignee",
  selection_mode: "auto_all",
  cargo_id: null,
  unit_scope_type: "context_exact",
  unit_id: null,
  unit_type_id: null,
  filter_unit_type_id: null,
  person_id: null
});
// Firmantes del paso (lista). Back-compat: si un paso llega sin lista, se trata como vacío (se podrá añadir).
const stepSigners = (step) => (Array.isArray(step?.signers) ? step.signers : []);

const addSignatureStep = () => {
  const newIndex = signatureSteps.value.length; // índice del nuevo paso (se agrega al final)
  commitSignature({ steps: [...signatureSteps.value, {
    order: newIndex + 1,
    name: "",
    approval_mode: "and",
    required_signers_min: 1,
    required: true,
    signers: [newSignatureSigner()]
  }] });
  expandedSignatureStep.value = newIndex; // auto-expande el nuevo
};
const updateSignatureStep = (index, prop, value) => {
  commitSignature({ steps: signatureSteps.value.map((s, i) => (i === index ? { ...s, [prop]: value } : s)) });
};
const patchSignatureStep = (index, patch) => {
  commitSignature({ steps: signatureSteps.value.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
};
const removeSignatureStep = (index) => {
  commitSignature({ steps: signatureSteps.value.filter((_, i) => i !== index) });
};

// ── Firmantes de un paso ── Cada firmante tiene su propio resolutor; el cupo entre ellos lo da approval_mode.
const addSignatureSigner = (index) => {
  const step = signatureSteps.value[index];
  if (!step) return;
  patchSignatureStep(index, { signers: [...stepSigners(step), newSignatureSigner()] });
};
const removeSignatureSigner = (index, si) => {
  const step = signatureSteps.value[index];
  if (!step) return;
  const current = stepSigners(step);
  if (current.length <= 1) return;
  patchSignatureStep(index, { signers: current.filter((_, i) => i !== si) });
};
const patchSignatureSigner = (index, si, patch) => {
  const step = signatureSteps.value[index];
  if (!step) return;
  const signers = stepSigners(step).map((s, i) => (i === si ? { ...s, ...patch } : s));
  patchSignatureStep(index, { signers });
};
const updateSignatureSigner = (index, si, prop, value) => patchSignatureSigner(index, si, { [prop]: value });

// "Quién firma" por firmante; los handlers de escritura commitean al firmante correspondiente.
const updateSignatureWho = (index, si, value) => {
  if (value === "task_assignee") {
    patchSignatureSigner(index, si, { resolver_type: "task_assignee", cargo_id: null, unit_id: null, unit_type_id: null, person_id: null });
    return;
  }
  if (value === "person") {
    patchSignatureSigner(index, si, { resolver_type: "specific_person", cargo_id: null, unit_id: null, unit_type_id: null, filter_unit_type_id: null });
    return;
  }
  const scopeType = processHasRules.value ? "context_exact" : "unit_exact";
  patchSignatureSigner(index, si, { resolver_type: "cargo_in_scope", unit_scope_type: scopeType, cargo_id: null, unit_id: null, unit_type_id: null, filter_unit_type_id: null, person_id: null });
  if (scopeType === "context_exact") loadResolvableCargos({});
};
const updateSignatureUbicacion = (index, si, value) => {
  const current = stepSigners(signatureSteps.value[index])[si];
  patchSignatureSigner(index, si, {
    unit_scope_type: value,
    cargo_id: null,
    unit_id: value === "unit_exact" ? (current?.unit_id ?? null) : null,
    unit_type_id: null,
    filter_unit_type_id: null
  });
  if (value === "context_exact") loadResolvableCargos({});
};
const onSignatureUnitTypeFilterChange = (index, si, value) => {
  patchSignatureSigner(index, si, { filter_unit_type_id: value, unit_id: null, cargo_id: null });
};
const onSignatureUnitExactChange = (index, si, value) => {
  patchSignatureSigner(index, si, { unit_id: value, cargo_id: null });
  if (value) loadResolvableCargos({ unitId: value });
};
const onSignatureUnitTypeScopeChange = (index, si, value) => {
  patchSignatureSigner(index, si, { unit_type_id: value, cargo_id: null });
  if (value) loadResolvableCargos({ unitTypeId: value });
};

const emitDraftFiles = (type, files) => {
  emit("file-change", type, { target: { files } });
};

// El archivo se gestiona en el padre (solo llega su etiqueta), así que el resaltado "lleno" del dropzone
// se deriva de que la etiqueta no sea el placeholder vacío.
const isDraftFileSelected = (kind) => {
  const label = props.getDraftArtifactFileLabel(kind);
  return Boolean(label) && label !== "Sin archivo";
};

defineExpose({ el: modalRef });
</script>
