<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="draftArtifactModalLabel"
    :title="draftArtifactEditId ? 'Editar plantilla de documento' : 'Crear plantilla de documento'"
    size="xl"
    dialog-class="max-w-7xl"
    content-class="border-0 shadow"
    close-action
    @close="$emit('close')"
  >
    <div v-if="draftArtifactError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ draftArtifactError }}</div>
    <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Este flujo {{ draftArtifactEditId ? "actualiza" : "crea" }} la plantilla de documento y la sube directamente a <strong>MinIO</strong>. Solo cuando la carga termine correctamente se guarda el registro en el sistema.
    </div>
    <div v-if="draftArtifactLoading" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Subiendo archivos a <strong>MinIO</strong>. Espera a que termine la carga para continuar.
    </div>

    <!-- Gobierno del ciclo de vida: stage + nueva versión (solo al editar) -->
    <div v-if="draftArtifactEditId" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 py-3">
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</span>
        <span class="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-bold capitalize" :class="stageBadgeClass">{{ draftArtifactForm.artifact_stage || 'draft' }}</span>
        <span v-if="draftArtifactForm.storage_version" class="text-xs font-medium text-slate-400">· {{ draftArtifactForm.storage_version }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AdminButton
          v-for="next in nextStages"
          :key="next.value"
          variant="outlinePrimary"
          @click="$emit('change-stage', next.value)"
        >{{ next.label }}</AdminButton>
        <AdminButton variant="cancel" @click="$emit('new-version')">Nueva versión</AdminButton>
      </div>
    </div>

    <!-- Pestañas con indicadores de avance -->
    <div class="mt-3">
      <ProfileSubsectionTabs v-model="activeTab" :tabs="tabDescriptors" aria-label="Secciones de la plantilla" />
    </div>

    <!-- Pestaña: General -->
    <div v-show="activeTab === 'general'" class="mt-4 grid gap-3 md:grid-cols-12">
      <AdminFieldGroup label="Semilla (base)" group-class="md:col-span-6">
        <AdminSelectField
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
        <p class="m-0 mt-1 text-xs font-medium text-slate-500">Toda plantilla nace de una semilla; por defecto se usa la general.</p>
      </AdminFieldGroup>
      <AdminFieldGroup label="Version fuente" group-class="md:col-span-3">
        <AdminInputField
          :model-value="draftArtifactForm.source_version"
          placeholder="1.0.0"
          @update:model-value="updateField('source_version', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Tipo de plantilla" group-class="md:col-span-3">
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="isAdHoc ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="isAdHoc ? 'bg-amber-500' : 'bg-indigo-500'"></span>
          {{ isAdHoc ? "De usuario (ad-hoc)" : "De proceso (oficial)" }}
        </span>
        <p class="m-0 mt-1 text-xs font-medium text-slate-500">{{ isAdHoc ? "Extensión puntual de usuario: permite persona concreta; sin tipo de unidad." : "Desde admin solo se crean oficiales: permiten tipo de unidad; sin persona concreta." }}</p>
      </AdminFieldGroup>
      <AdminFieldGroup label="Nombre de la plantilla" group-class="md:col-span-6">
        <AdminInputField
          :model-value="draftArtifactForm.display_name"
          placeholder="Nombre de la plantilla"
          @update:model-value="updateField('display_name', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Descripcion" group-class="md:col-span-6">
        <AdminInputField
          :model-value="draftArtifactForm.description"
          placeholder="Descripcion breve"
          @update:model-value="updateField('description', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Configuración destino" group-class="md:col-span-12">
        <div class="flex gap-2">
          <AdminSelectField
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
        <p class="mt-1 text-xs text-slate-400">La plantilla quedará vinculada a esta configuración de proceso (o 'default' para tareas libres). ¿No existe? Créala con el wizard guiado.</p>
      </AdminFieldGroup>
    </div>

    <!-- Pestaña: Formatos -->
    <div v-show="activeTab === 'formatos'" class="mt-4 grid gap-3 md:grid-cols-12">
      <div v-if="!isFormatosComplete" class="md:col-span-12 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
        Adjunta al menos un documento de referencia (PDF, Word, Excel o PowerPoint) para poder crear la plantilla.
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">PDF</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('pdf')" accept=".pdf" input-id="draft-upload-pdf" @files-selected="emitDraftFiles('pdf', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Word</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('docx')" accept=".doc,.docx" input-id="draft-upload-docx" @files-selected="emitDraftFiles('docx', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Excel</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('xlsx')" accept=".xls,.xlsx" input-id="draft-upload-xlsx" @files-selected="emitDraftFiles('xlsx', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">PowerPoint</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('pptx')" accept=".ppt,.pptx" input-id="draft-upload-pptx" @files-selected="emitDraftFiles('pptx', $event)" />
      </div>
      <div v-if="draftArtifactPreviewStatus !== 'idle'" class="md:col-span-12">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Preview del seed</label>
        <div v-if="draftArtifactPreviewStatus === 'loading'" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-500">
          Cargando preview…
        </div>
        <iframe v-else-if="draftArtifactPreviewStatus === 'ready' && draftArtifactPreviewUrl" :src="draftArtifactPreviewUrl" class="min-h-105 w-full rounded-xl border border-slate-200 bg-white" title="Preview del seed"></iframe>
        <div v-else class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-500">
          Este seed no tiene un PDF de preview publicado.
        </div>
      </div>
    </div>

    <!-- Pestaña: Campos del formulario (schema.json) -->
    <div v-show="activeTab === 'campos'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h4 class="m-0 text-sm font-bold text-slate-800">Campos del formulario</h4>
          <p class="m-0 mt-0.5 text-xs font-medium text-slate-500">Definen los datos que el usuario llenará en el entregable (schema.json).</p>
        </div>
        <AdminButton variant="outlinePrimary" @click="addSchemaField">+ Añadir campo</AdminButton>
      </div>
      <div v-if="!schemaFields.length" class="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-500">
        Aún no hay campos. Añade al menos uno para generar el formulario del entregable.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div v-for="(field, index) in schemaFields" :key="index" class="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div class="col-span-3">
            <label class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Clave</label>
            <input :value="field.key" placeholder="ej. semestre" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSchemaField(index, 'key', $event.target.value)" />
          </div>
          <div class="col-span-3">
            <label class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Etiqueta</label>
            <input :value="field.title" placeholder="ej. Semestre" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSchemaField(index, 'title', $event.target.value)" />
          </div>
          <div class="col-span-2">
            <label class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Componente</label>
            <select :value="field.component" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateSchemaField(index, 'component', $event.target.value)">
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
            <label class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Grupo</label>
            <input :value="field.group" placeholder="general" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSchemaField(index, 'group', $event.target.value)" />
          </div>
          <div class="col-span-1 flex items-center justify-center pb-1.5">
            <label class="inline-flex flex-col items-center gap-0.5 text-[0.6rem] font-semibold text-slate-400">
              Req.
              <input type="checkbox" :checked="field.required" class="h-4 w-4" @change="updateSchemaField(index, 'required', $event.target.checked)" />
            </label>
          </div>
          <div class="col-span-1 flex items-center justify-end pb-1">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar campo" @click="removeSchemaField(index)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pestaña: Flujo de ENTREGA -->
    <div v-show="activeTab === 'entrega'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h4 class="m-0 text-sm font-bold text-slate-800">Flujo de entrega</h4>
          <p class="m-0 mt-0.5 text-xs font-medium text-slate-500">Dentro de este documento, quién hace cada paso. (A quién le toca el proceso lo deciden las reglas objetivo, no aquí.)</p>
        </div>
        <AdminButton variant="outlinePrimary" @click="addFillStep">+ Añadir paso</AdminButton>
      </div>
      <div v-if="draftArtifactForm.process_definition_id && !processHasRules && !processScopeLoading" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700">
        El proceso vinculado aún no tiene <strong>reglas objetivo</strong>. Los ámbitos “Unidad del proceso” quedan deshabilitados (resolverían a nadie); define primero las reglas o usa una unidad específica.
      </div>
      <div v-if="!fillSteps.length" class="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-medium text-slate-500">
        Sin pasos de entrega.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div v-for="(step, index) in fillSteps" :key="index" class="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div class="grid grid-cols-12 items-end gap-2">
            <div class="col-span-1">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Orden</label>
              <input type="number" min="1" :value="step.order" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateFillStep(index, 'order', Number($event.target.value))" />
            </div>
            <div class="col-span-4">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Nombre</label>
              <input :value="step.name" placeholder="ej. Entrega del docente" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateFillStep(index, 'name', $event.target.value)" />
            </div>
            <div class="col-span-3">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Quién hace el paso</label>
              <select :value="stepWhoMode(step)" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateFillStepWho(index, $event.target.value)">
                <option value="task_assignee">Responsable del entregable</option>
                <option value="scope">Por cargo</option>
                <option v-if="isAdHoc" value="person">Persona concreta</option>
              </select>
            </div>
            <div v-if="fillStepShowsMode(step)" class="col-span-2">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Modo</label>
              <select :value="step.selection_mode" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateFillStep(index, 'selection_mode', $event.target.value)">
                <option value="auto_one">Uno cualquiera</option>
                <option value="auto_all">Todas</option>
              </select>
            </div>
            <div class="col-span-2 flex items-center justify-end pb-1">
              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar paso" @click="removeFillStep(index)">✕</button>
            </div>
          </div>
          <!-- "Por cargo": la revisión sube por la jerarquía o se queda en la misma unidad; nunca baja. Por eso
               no hay subárbol ni "todas las unidades" (eso es distribución y vive en las reglas del proceso). -->
          <!-- Primero la UBICACIÓN; el cargo se ofrece solo entre los que tienen titular vigente ahí (mismo
               criterio que el resolver de runtime), así no se autoriza un revisor que no resolvería a nadie. -->
          <div v-if="stepWhoMode(step) === 'scope'" class="mt-2 grid grid-cols-12 gap-2">
            <div class="col-span-4">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Ubicación</label>
              <select :value="step.unit_scope_type" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateFillStepUbicacion(index, $event.target.value)">
                <option value="context_exact" :disabled="!processHasRules">En la misma unidad del entregable{{ processHasRules ? "" : " — requiere reglas" }}</option>
                <option value="unit_exact">En una unidad específica…</option>
                <option v-if="!isAdHoc" value="unit_type">En un tipo de unidad…</option>
              </select>
            </div>
            <!-- Unidad fija (ruteo a una oficina concreta; puede estar fuera del alcance del proceso). Filtro
                 opcional por tipo de unidad para acortar la lista. El paso guarda la unidad fija (unit_id). -->
            <template v-if="fillStepNeedsUnit(step)">
              <div class="col-span-4">
                <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Tipo (filtro)</label>
                <select :value="step.filter_unit_type_id || ''" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="onUnitTypeFilterChange(index, Number($event.target.value) || null)">
                  <option value="">Todos los tipos</option>
                  <option v-for="t in unitTypeOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
              <div class="col-span-4">
                <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Unidad</label>
                <select :value="step.unit_id || ''" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="onUnitExactUnitChange(index, Number($event.target.value) || null)">
                  <option value="">— Selecciona unidad —</option>
                  <option v-for="u in fillStepUnitOptions(step)" :key="u.id" :value="u.id">{{ u.name }}</option>
                </select>
              </div>
            </template>
            <!-- Tipo de unidad (solo plantillas de proceso): el cargo resuelve en TODAS las unidades de ese tipo
                 (p. ej. el coordinador de cada carrera). Distribución de la revisión a muchas unidades. -->
            <div v-else-if="fillStepNeedsUnitType(step)" class="col-span-4">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Tipo de unidad</label>
              <select :value="step.unit_type_id || ''" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="onUnitTypeScopeChange(index, Number($event.target.value) || null)">
                <option value="">— Selecciona tipo —</option>
                <option v-for="t in unitTypeOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="col-span-4">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Cargo</label>
              <select :value="step.cargo_id || ''" :disabled="!fillStepCargoReady(step)" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400" @change="updateFillStep(index, 'cargo_id', Number($event.target.value) || null)">
                <option value="">{{ fillStepCargoPlaceholder(step) }}</option>
                <option v-for="c in fillStepCargoOptions(step)" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
          </div>
          <!-- Persona concreta (solo plantillas de usuario / ad-hoc): ruteo directo a una persona. -->
          <div v-else-if="stepWhoMode(step) === 'person'" class="mt-2 grid grid-cols-12 gap-2">
            <div class="col-span-6">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Persona</label>
              <select :value="step.person_id || ''" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateFillStep(index, 'person_id', Number($event.target.value) || null)">
                <option value="">— Selecciona persona —</option>
                <option v-for="p in personOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pestaña: Flujo de FIRMAS -->
    <div v-show="activeTab === 'firmas'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h4 class="m-0 text-sm font-bold text-slate-800">Flujo de firmas</h4>
          <p class="m-0 mt-0.5 text-xs font-medium text-slate-500">Pasos de firma electrónica y anclas por token (campo que marca la posición en el PDF).</p>
        </div>
        <div class="flex gap-2">
          <AdminButton variant="cancel" @click="addSignatureAnchor">+ Ancla</AdminButton>
          <AdminButton variant="outlinePrimary" @click="addSignatureStep">+ Añadir paso</AdminButton>
        </div>
      </div>

      <div v-if="signatureAnchors.length" class="mt-3 flex flex-col gap-2">
        <p class="m-0 text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">Anclas</p>
        <div v-for="(anchor, index) in signatureAnchors" :key="`anchor-${index}`" class="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div class="col-span-4">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Código ancla</label>
            <input :value="anchor.code" placeholder="ej. firma_aprobado" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureAnchor(index, 'code', $event.target.value)" />
          </div>
          <div class="col-span-6">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Campo token (field code)</label>
            <input :value="anchor.token_field_ref" placeholder="ej. signatures.aprobado.token" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureAnchor(index, 'token_field_ref', $event.target.value)" />
          </div>
          <div class="col-span-2 flex items-center justify-end pb-1">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar ancla" @click="removeSignatureAnchor(index)">✕</button>
          </div>
        </div>
      </div>

      <div v-if="!signatureSteps.length" class="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-medium text-slate-500">
        Sin pasos de firma.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div v-for="(step, index) in signatureSteps" :key="`sig-${index}`" class="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div class="col-span-1">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Orden</label>
            <input type="number" min="1" :value="step.order" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureStep(index, 'order', Number($event.target.value))" />
          </div>
          <div class="col-span-4">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Nombre</label>
            <input :value="step.name" placeholder="ej. Firma del director" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureStep(index, 'name', $event.target.value)" />
          </div>
          <div class="col-span-3">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Cargo firmante</label>
            <input :value="step.required_cargo_code" placeholder="ej. director" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureStep(index, 'required_cargo_code', $event.target.value)" />
          </div>
          <div class="col-span-3">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Ancla</label>
            <select :value="(step.anchor_refs && step.anchor_refs[0]) || ''" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateSignatureStep(index, 'anchor_refs', $event.target.value ? [$event.target.value] : [])">
              <option value="">(sin ancla)</option>
              <option v-for="anchor in signatureAnchors" :key="anchor.code" :value="anchor.code">{{ anchor.code }}</option>
            </select>
          </div>
          <div class="col-span-1 flex items-center justify-end pb-1">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar paso" @click="removeSignatureStep(index)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <AdminButton variant="cancel" @click="$emit('close')">Cancelar</AdminButton>
      <AdminButton v-if="!isFirstTab" variant="secondary" @click="goPrevTab">Atrás</AdminButton>
      <AdminButton v-if="!isLastTab" variant="primary" @click="goNextTab">Siguiente →</AdminButton>
      <AdminButton
        variant="outlinePrimary"
        :disabled="draftArtifactLoading || !canSubmit"
        :title="canSubmit ? '' : 'Faltan: proceso destino, documento de referencia y al menos un paso de flujo de entrega.'"
        @click="$emit('submit')"
      >
        {{ draftArtifactLoading ? "Subiendo a MinIO..." : (draftArtifactEditId ? "Guardar cambios" : "Crear plantilla") }}
      </AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import PdfDropField from "@/modules/firmas/components/PdfDropField.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";

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
  preselectProcessDefinitionId: { type: [String, Number], default: "" }
});

const emit = defineEmits(["update:form", "file-change", "drop", "close", "submit", "change-stage", "new-version", "create-process"]);
const modalRef = ref(null);

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
const activeTab = ref("general");

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
  return isGeneralComplete.value && isFormatosComplete.value && isEntregaComplete.value;
});

const tabState = {
  general: isGeneralComplete,
  formatos: isFormatosComplete,
  campos: isCamposComplete,
  entrega: isEntregaComplete,
  firmas: isFirmasComplete,
};
const TAB_LABELS = { general: "General", formatos: "Formatos", entrega: "Entrega", firmas: "Firmas", campos: "Campos (documento)" };
const tabDescriptors = computed(() => TAB_KEYS.map((key) => ({
  key,
  label: `${TAB_LABELS[key]}${tabState[key].value ? " ✓" : ""}`,
})));

const currentTabIndex = computed(() => TAB_KEYS.indexOf(activeTab.value));
const isFirstTab = computed(() => currentTabIndex.value <= 0);
const isLastTab = computed(() => currentTabIndex.value >= TAB_KEYS.length - 1);
const goNextTab = () => {
  const next = TAB_KEYS[currentTabIndex.value + 1];
  if (next) activeTab.value = next;
};
const goPrevTab = () => {
  const prev = TAB_KEYS[currentTabIndex.value - 1];
  if (prev) activeTab.value = prev;
};
// Reinicia a la primera pestaña al cambiar entre crear/editar.
watch(() => props.draftArtifactEditId, () => { activeTab.value = "general"; });

const STAGE_TRANSITIONS = {
  draft: [{ value: "review", label: "Enviar a revisión" }, { value: "archived", label: "Archivar" }],
  review: [{ value: "approved", label: "Aprobar" }, { value: "draft", label: "Devolver a borrador" }, { value: "archived", label: "Archivar" }],
  approved: [{ value: "published", label: "Publicar" }, { value: "review", label: "Volver a revisión" }, { value: "archived", label: "Archivar" }],
  published: [{ value: "archived", label: "Archivar" }, { value: "approved", label: "Despublicar" }],
  archived: [{ value: "draft", label: "Restaurar a borrador" }],
};
const STAGE_BADGE = {
  draft: "text-slate-600", review: "text-amber-600", approved: "text-sky-600",
  published: "text-emerald-600", archived: "text-rose-500",
};
const nextStages = computed(() => STAGE_TRANSITIONS[props.draftArtifactForm.artifact_stage || "draft"] || []);
const stageBadgeClass = computed(() => STAGE_BADGE[props.draftArtifactForm.artifact_stage || "draft"] || "text-slate-600");

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
  commitFillSteps([...fillSteps.value, {
    order: fillSteps.value.length + 1,
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
};
const updateFillStep = (index, prop, value) => {
  commitFillSteps(fillSteps.value.map((s, i) => (i === index ? { ...s, [prop]: value } : s)));
};
const patchFillStep = (index, patch) => {
  commitFillSteps(fillSteps.value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
};
const removeFillStep = (index) => {
  commitFillSteps(fillSteps.value.filter((_, i) => i !== index));
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
  for (const step of fillSteps.value) {
    if (String(step?.resolver_type || "") !== "cargo_in_scope") continue;
    const scope = String(step?.unit_scope_type || "");
    if (scope === "unit_exact") {
      if (step?.unit_id) loadResolvableCargos({ unitId: step.unit_id });
    } else if (scope === "unit_type") {
      if (step?.unit_type_id) loadResolvableCargos({ unitTypeId: step.unit_type_id });
    } else {
      needsCtx = true;
    }
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

// ── Flujo de firmas ──
const signatureSteps = computed(() => props.draftArtifactForm.signature_workflow?.steps || []);
const signatureAnchors = computed(() => props.draftArtifactForm.signature_workflow?.anchors || []);
const commitSignature = (patch) => {
  emit("update:form", {
    ...props.draftArtifactForm,
    signature_workflow: {
      required: true,
      anchors: signatureAnchors.value,
      steps: signatureSteps.value,
      ...props.draftArtifactForm.signature_workflow,
      ...patch,
    },
  });
};
const addSignatureStep = () => {
  commitSignature({ steps: [...signatureSteps.value, { order: signatureSteps.value.length + 1, name: "", step_type_code: "electronic", required_cargo_code: "", selection_mode: "auto_all", required_signers_min: 1, required_signers_max: 1, required: true, anchor_refs: [] }] });
};
const updateSignatureStep = (index, prop, value) => {
  commitSignature({ steps: signatureSteps.value.map((s, i) => (i === index ? { ...s, [prop]: value } : s)) });
};
const removeSignatureStep = (index) => {
  commitSignature({ steps: signatureSteps.value.filter((_, i) => i !== index) });
};
const addSignatureAnchor = () => {
  commitSignature({ anchors: [...signatureAnchors.value, { code: "", token_field_ref: "", width: 124, height: 48 }] });
};
const updateSignatureAnchor = (index, prop, value) => {
  commitSignature({ anchors: signatureAnchors.value.map((a, i) => (i === index ? { ...a, [prop]: value } : a)) });
};
const removeSignatureAnchor = (index) => {
  commitSignature({ anchors: signatureAnchors.value.filter((_, i) => i !== index) });
};

const emitDraftFiles = (type, files) => {
  emit("file-change", type, { target: { files } });
};

defineExpose({ el: modalRef });
</script>
