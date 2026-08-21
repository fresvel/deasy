<template>
  <!-- ⚠️ LA RAIZ NO PONE PADDING DE PAGINA (F13.5, 2026-08-21). Aqui habia un `rootClasses`
       computado que elegia entre `p-0` (dentro de un modal) y `p-4 sm:p-6 lg:p-8` (en pagina).
       Ese segundo caso metia **32 px invisibles** —sin borde ni fondo— encima de los que ya pone
       `main`, y por eso la rejilla de firmas medía **1370 px cuando el resto de páginas tiene
       1500**: sus tarjetas salian mas estrechas que las de todas partes sin motivo visible.
       Con el padding fuera, las dos ramas del computado eran la misma cadena, asi que el
       computado sobra: la clase es estatica. -->
  <div class="flex h-full w-full flex-col gap-6">
    <div v-if="!multiOnly && workspaceMode !== 'multi' && showStartHeading" class="flex flex-col gap-2">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="deasy-title deasy-title--page leading-tight">Firmas electrónicas</h2>
          <p class="text-muted text-sm m-0 font-medium leading-snug">
            Carga documentos y define las areas de estampado para la firma.
          </p>
        </div>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:shrink-0">
          <div v-if="pdfReady">
            <PdfDropField
              variant="inline"
              title=""
              action-text="Cambiar PDF"
              help-text="Selecciona otro PDF"
              :icon="IconFileUpload"
              input-id="change-pdf-input"
              @files-selected="onPdfDropFiles($event, requestMode ? 'request' : 'sign')"
 />
          </div>
        </div>
      </div>
    </div>

    <div v-if="!multiOnly && pdfReady" class="flex flex-col gap-4 mt-4 border-b border-line pb-4">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex flex-wrap items-center gap-3">
          <AppButton
            variant="neutral-outline"
            icon-only
            title="Regresar"
            aria-label="Regresar"
            @click="goBackToStart"
          >
            <IconArrowLeft class="w-5 h-5" />
          </AppButton>
        </div>

        <div class="flex items-center justify-center gap-3 flex-wrap xl:flex-nowrap">
          <AppCounterNavigator
            label="Página"
            editable
            v-model="pageInput"
            :min="1"
            :current="currentPage"
            :total="totalPages"
            :previous-disabled="currentPage <= 1"
            :next-disabled="currentPage >= totalPages"
            previous-title="Página anterior"
            next-title="Página siguiente"
            @previous="prevPageBtn"
            @next="nextPageBtn"
            @submit="goToPage"
 />
        </div>

        <div class="flex items-center justify-start xl:justify-end gap-3 flex-wrap">
          <AdminButton
            v-if="signMode !== 'token'"
            variant="danger-outline"
            @click="openDeleteModal"
          >
            Eliminar
          </AdminButton>
          <AdminButton
            v-if="!requestMode"
            variant="primary-outline"
            @click="submitTokenAction"
          >
            Firmar por token
          </AdminButton>
          <AdminButton
            variant="primary-outline"
            @click="submitAction"
          >
            <IconSignature v-if="!requestMode" class="w-5 h-5" stroke-width="2" />
            <IconSend v-else class="w-5 h-5" stroke-width="2" />
            {{ requestMode ? 'Enviar' : 'Firmar' }}
          </AdminButton>
        </div>
      </div>
    </div>

    <div v-if="workspaceMode === 'multi'">
      <MultiSignerPanel
        ref="multiSignerPanelRef"
        :batch-job="activeMultiBatchJob"
        :is-batch-submitting="isStartingMultiBatch"
        :is-downloading-batch="isDownloadingMultiBatch"
        :initial-files="multiSignerSeedFiles"
        :initial-documents="multiSignerSeedDocuments"
        :allow-manual-upload="allowManualMultiSignerUpload"
        :enable-document-filters="enableMultiSignerDocumentFilters"
        @back="closeMultiSigner"
        @download-batch="downloadMultiBatch"
        @header-update="emit('multi-header-update', $event)"
        @start-batch="prepareMultiBatchStart"
 />
    </div>

    <div v-else-if="!multiOnly && !pdfReady && isEmbeddedWorkflowMode" class="deasy-card mt-4 p-6 lg:p-8">
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <h3 class="deasy-title deasy-title--panel">PDF del flujo de firma</h3>
          <p class="text-sm font-medium leading-snug text-muted m-0">
            Esta sesión pertenece al documento
            <span class="font-semibold text-body">{{ workflowSignContext?.documentTitle || 'seleccionado' }}</span>.
            Si el PDF no se precargó correctamente, puedes reintentar la carga o seleccionar el archivo de forma manual.
          </p>
        </div>

        <AppAlert :variant="tonoEstadoPdf" class="text-sm font-medium">
          {{ workflowPdfStatus.message || 'Preparando la sesión de firma embebida.' }}
        </AppAlert>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div class="deasy-card p-5">
            <PdfDropField
              title="Cargar PDF del entregable"
              action-text="Seleccionar documento"
              help-text="Usa este archivo si necesitas reintentar la sesión manualmente."
              :icon="CustomIconSignature"
              input-id="workflow-sign-pdf-input"
              @files-selected="onPdfDropFiles($event, 'sign')"
              class="h-full"
 />
          </div>
          <div class="flex flex-col gap-3">
            <AdminButton
              variant="primary-outline"
              :disabled="!workflowSignContext?.preloadPdfPath"
              @click="retryWorkflowPdfLoad"
            >
              Reintentar carga automática
            </AdminButton>
            <AdminButton variant="neutral-outline" @click="goBackToStart">
              Limpiar PDF actual
            </AdminButton>
          </div>
        </div>
      </div>
      <AppAlert class="flex items-center gap-3 mt-6" v-if="uploadError">
        <div class="bg-white p-1 rounded-2xl border border-rose-100 text-danger">
          <IconX class="w-5 h-5 shrink-0" />
        </div>
        {{ uploadError }}
      </AppAlert>
    </div>

    <div v-else-if="!multiOnly && !pdfReady">
      <div
        id="signature-launchers-grid"
        class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4"
      >

        <div id="signature-launcher-sign" v-if="canShowLauncher('sign')" class="deasy-card signature-workspace-card flex flex-col h-full min-h-[19rem] p-6 text-center">
          <PdfDropField
            title="Firmar documento"
            action-text="Seleccionar documento"
            help-text="Arrastra y suelta o selecciona un PDF."
            :icon="CustomIconSignature"
            input-id="sign-pdf-input"
            @files-selected="onPdfDropFiles($event, 'sign')"
            class="h-full deasy-dropzone--workspace"
 />
        </div>

        <div id="signature-launcher-request" v-if="canShowLauncher('request')" class="deasy-card signature-workspace-card flex flex-col h-full min-h-[19rem] p-6 text-center">
          <PdfDropField
            title="Solicitar firmas"
            action-text="Iniciar solicitud"
            help-text="Envía el documento a otros usuarios."
            :icon="CustomIconSend"
            input-id="request-pdf-input"
            @files-selected="onPdfDropFiles($event, 'request')"
            class="h-full deasy-dropzone--workspace"
 />
        </div>

        <div id="signature-launcher-validate" v-if="canShowLauncher('validate')" class="deasy-card signature-workspace-card flex flex-col h-full min-h-[19rem] p-6 text-center">
          <PdfDropField
            title="Validar documento"
            action-text="Validar documento"
            help-text="Verifica firmas y estado del documento."
            :icon="CustomIconShieldCheck"
            input-id="validate-pdf-input"
            @files-selected="onPdfDropFiles($event, 'validate')"
            class="h-full deasy-dropzone--workspace"
 />
        </div>

        <div
          id="signature-launcher-multi"
          v-if="canShowLauncher('multi')"
          class="deasy-card signature-workspace-card flex flex-col h-full min-h-[19rem] p-6 text-center"
        >
          <PdfDropField
            title="Multifirmador"
            action-text="Seleccionar PDFs"
            help-text="Haz clic para elegir PDFs o arrastra una carpeta (solo PDFs); se conserva su estructura interna."
            :icon="CustomIconFiles"
            input-id="multi-pdf-input"
            multiple
            @files-selected="onPdfDropFiles($event, 'multi')"
            class="h-full deasy-dropzone--workspace"
 />
        </div>

        <button
          id="signature-launcher-received"
          v-if="enableHomeShortcuts && canShowLauncher('pending')"
          type="button"
          class="deasy-tile signature-workspace-card xl:col-start-1"
          @click="emit('open-home-pending')"
        >
          <h3 class="deasy-title deasy-title--panel mb-4 text-left">Solicitudes recibidas</h3>
          <div class="flex flex-1 items-center justify-center rounded-xl border border-emerald-200/80 bg-white px-6 py-8">
            <div class="flex flex-col items-center justify-center">
              <CustomIconReceivedRequests />
              <span class="mt-5 text-base font-semibold text-body">Ver solicitudes</span>
              <p class="mt-2 max-w-[16rem] text-center text-xs leading-relaxed text-muted">
                Revisa solicitudes pendientes por atender.
              </p>
            </div>
          </div>
        </button>

        <button
          id="signature-launcher-database"
          v-if="canShowLauncher('database')"
          type="button"
          class="deasy-tile signature-workspace-card"
          :class="enableHomeShortcuts ? 'xl:col-start-2' : ''"
          @click="handleDatabaseEntry"
        >
          <h3 class="deasy-title deasy-title--panel mb-4 text-left">Buscar en BD</h3>
          <div class="flex flex-1 items-center justify-center rounded-xl border border-blue-light-200/80 bg-white px-6 py-8">
            <div class="flex flex-col items-center justify-center">
              <CustomIconSearch />
              <span class="mt-5 text-base font-semibold text-body">
                {{ enableHomeShortcuts ? 'Procesos pendientes' : 'Bandeja de Home' }}
              </span>
              <p class="mt-2 max-w-[16rem] text-center text-xs leading-relaxed text-muted">
                {{ enableHomeShortcuts
                  ? 'Consulta procesos con firma pendiente.'
                  : 'Consulta solicitudes pendientes de Home.' }}
              </p>
            </div>
          </div>
        </button>

        <button
          id="signature-launcher-pending"
          v-if="enableHomeShortcuts && canShowLauncher('pending')"
          type="button"
          class="deasy-tile signature-workspace-card xl:col-start-3"
          @click="emit('open-home-pending')"
        >
          <h3 class="deasy-title deasy-title--panel mb-4 text-left">Bandeja de pendientes</h3>
          <div class="flex flex-1 items-center justify-center rounded-xl border border-blue-light-200/80 bg-white px-6 py-8">
            <div class="flex flex-col items-center justify-center">
              <CustomIconPendingTray />
              <span class="mt-5 text-base font-semibold text-body">Tabla de procesos</span>
              <p class="mt-2 max-w-[16rem] text-center text-xs leading-relaxed text-muted">
                Revisa y selecciona procesos pendientes.
              </p>
            </div>
          </div>
        </button>

      </div>
      <AppAlert class="flex items-center gap-3 mt-6" v-if="uploadError">
        <div class="bg-white p-1 rounded-2xl border border-rose-100 text-danger">
          <IconX class="w-5 h-5 shrink-0" />
        </div>
        {{ uploadError }}
      </AppAlert>
    </div>

    <div v-else-if="!multiOnly" class="mt-4">
      <div class="deasy-card p-4 lg:p-6 w-full max-h-[80vh] overflow-y-auto overflow-x-hidden relative">
        <div class="w-full relative flex justify-center" ref="colPdf">
          <div 
            class="relative border border-line" 
            ref="pdfViewer"
            @mousemove="handleMouseMove"
            @mouseleave="handleMouseLeave"
          >
            <canvas ref="pdfCanvas" class="block cursor-crosshair relative z-(--z-capa-base) w-full"></canvas>
            
            <SignatureBox
              v-if="isMouseOverPdf && !isDragging && signMode !== 'token' && previewBoxStyle.display !== 'none' && !isHoveringField"
              :is-preview="true"
              :left="parseFloat(previewBoxStyle.left)"
              :top="parseFloat(previewBoxStyle.top)"
              :width="parseFloat(previewBoxStyle.width)"
              :height="parseFloat(previewBoxStyle.height)"
              :label="currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Firma'"
 />

            <SignatureBox
              v-for="field in currentPageFields"
              :key="field.id"
              :data-field-id="field.id"
              :field="field"
              :is-active="field.id === lastFieldId"
              :pdf-scale="pdfScale"
              :display-scale="displayScaleRef"
              :page-height-pdf="pageHeightPdf"
              :page-width-pdf="pageWidthPdf"
              :label="field.signer ? `${field.signer.first_name} ${field.signer.last_name}` : 'Sin asignar'"
              @select="selectField(field.id)"
              @delete="requestDeleteField(field.id)"
              @update:position="updateFieldCoordinates"
              @drag-start="isDragging = true"
              @drag-end="isDragging = false"
              @hover-enter="isHoveringField = true"
              @hover-leave="isHoveringField = false"
            >
              <template #actions>
                <button
                  v-if="signMode !== 'token'"
                  type="button"
                  class="deasy-pdf-action"
                  title="Firmar documento"
                  aria-label="Firmar documento"
                  @click.stop="submitAction"
                >
                  <IconSignature class="w-3.5 h-3.5" />
                </button>
              </template>
            </SignatureBox>
          </div>
        </div>
      </div>
    </div>
    
  </div>

    <AppModalShell
      controlled
      :open="showSignaturesModal"
      @close="showSignaturesModal = false"
      labelled-by="signaturesModalLabel"
      title="Campos de firma"
      size="lg"
    >
      <AppEmpty v-if="!visibleFields.length" :icon="IconSignature" title="No hay firmas">Aún no has agregado ningún campo de firma al documento. Haz clic sobre el documento PDF para insertar una.</AppEmpty>

      <div v-else class="flex flex-col gap-3 py-2">
        <div
          v-for="field in visibleFields"
          :key="field.id"
          class="deasy-card p-4 hover:border-blue-light-300 hover:transition-all relative overflow-hidden group"
          :class="{ 'deasy-firma-fila--activa': field.id === lastFieldId }"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-12">
            
            <div class="flex items-start gap-4">
              <div class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--info">
                <IconSignature class="w-5 h-5" />
              </div>
              <div>
                <div v-if="field.signer" class="font-semibold text-strong text-base mb-0.5">
                  {{ field.signer.first_name }} {{ field.signer.last_name }}
                </div>
                <div v-else class="font-semibold text-strong text-base mb-0.5">
                  Firmante no asignado
                </div>
                
                <div v-if="field.signer" class="text-sm text-muted flex flex-wrap items-center gap-x-3 gap-y-2 mt-1">
                  <span v-if="field.signer.email" class="inline-flex items-center gap-2">
                    <span class="font-medium text-muted">Email:</span> {{ field.signer.email }}
                  </span>
                  <span v-if="field.signer.cedula" class="inline-flex items-center gap-2">
                    <span class="font-medium text-muted">CI:</span> {{ field.signer.cedula }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-4 sm:border-l sm:border-line sm:pl-5">
              <div class="deasy-card px-3 py-1.5 text-center">
                <span class="deasy-overline block">Pág</span>
                <span class="block text-lg font-bold text-strong leading-none mt-0.5">{{ field.page }}</span>
              </div>
              
              <div class="text-xs text-muted grid grid-cols-2 gap-x-4 gap-y-2">
                <div>x/y: <span class="font-medium text-body">{{ formatCoord(field.x1) }}, {{ formatCoord(field.y1) }}</span></div>
                <div>w/h: <span class="font-medium text-body">{{ formatCoord(field.x2 - field.x1) }}, {{ formatCoord(field.y2 - field.y1) }}</span></div>
              </div>
            </div>
            
          </div>
          
          <AppDeleteButton
            v-if="signMode !== 'token'"
            class="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 lg:opacity-100"
            label="Eliminar campo"
            @click.stop="requestDeleteField(field.id)"
 />
        </div>
      </div>
    </AppModalShell>

  <AppModalShell
    ref="deleteModal"
    id="deleteFieldsModal"
    labelled-by="delete-fields-modal-title"
    title="Eliminar campos"
    size="md"
    body-class="p-6 overflow-y-auto max-h-[80vh]"
  >
    <AppEmpty v-if="!fields.length">No hay firmas para eliminar.</AppEmpty>
    <div v-else class="flex flex-col gap-4">
      <div class="deasy-card flex items-center justify-between p-2">
        <label :for="fieldId('filterpage')" class="deasy-form-label ml-2 mb-0">Filtrar por pagina</label>
        <select :id="fieldId('filterpage')" v-model="filterPage" class="deasy-control deasy-control--select">
          <option value="all">Todas</option>
          <option v-for="page in pagesWithFields" :key="page" :value="page">
            Pagina {{ page }}
          </option>
        </select>
      </div>
      
      <div class="flex flex-col gap-2 max-h-100 overflow-y-auto pr-2 custom-scrollbar">
        <div
          v-for="field in filteredFields"
          :key="field.id"
          class="deasy-elegible flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl gap-3"
          :class="[field.id === lastFieldId ? 'deasy-elegible--activa' : '']"
        >
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-strong">{{ field.name }}</span>
              <span class="px-2 py-0.5 bg-surface text-muted rounded-xl text-theme-xs font-bold tracking-wide">Pág {{ field.page }}</span>
            </div>
            <span class="text-muted text-xs font-medium">
              {{ field.signer ? `${field.signer.first_name} ${field.signer.last_name}` : 'Sin asignar' }}
            </span>
          </div>
          
          <div class="flex items-center gap-2 sm:self-center self-end">
            <AppButton variant="neutral-outline" @click.stop="goToFieldLocation(field.id)">
              <IconSearch class="w-3.5 h-3.5" stroke-width="2.5" />
              Ver en documento
            </AppButton>
            <AppDeleteButton label="Eliminar" @click.stop="requestDeleteField(field.id)" />
          </div>
        </div>
      </div>
    </div>
  </AppModalShell>

  <AppModalShell
    ref="assignSignerModal"
    labelled-by="assign-signer-title"
    title="Asignar firmante"
    size="lg"
    dialog-class="items-center"
    content-class="shadow border-0"
    body-class="pt-4"
  >
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col">
          <label :for="fieldId('statusfilter')" class="deasy-form-label">Estado</label>
          <select :id="fieldId('statusfilter')" v-model="statusFilter" class="deasy-control deasy-control--select">
            <option value="all">Todos</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Verificado">Verificado</option>
            <option value="Reportado">Reportado</option>
          </select>
        </div>
        <div class="flex flex-col">
          <label :for="fieldId('signerinput')" class="deasy-form-label">Buscar</label>
          <input :id="fieldId('signerinput')" v-model="signerInput" type="text" class="deasy-control" placeholder="Nombre, correo o cédula" />
        </div>
        <div class="flex flex-col">
          <label :for="fieldId('signerunittypefilter')" class="deasy-form-label">Tipo de unidad</label>
          <select :id="fieldId('signerunittypefilter')" v-model="signerUnitTypeFilter" class="deasy-control deasy-control--select">
            <option value="">Todos</option>
            <option v-for="option in signerUnitTypeOptions" :key="option.id" :value="String(option.id)">
              {{ option.label || option.name }}
            </option>
          </select>
        </div>
        <div class="flex flex-col">
          <label :for="fieldId('signerunitfilter')" class="deasy-form-label">Unidad</label>
          <select :id="fieldId('signerunitfilter')" v-model="signerUnitFilter" class="deasy-control deasy-control--select" :disabled="!signerUnitTypeFilter || isLoadingSignerOptions">
            <option value="">Todas</option>
            <option v-for="option in signerUnitOptions" :key="option.id" :value="String(option.id)">
              {{ option.label || option.name }}
            </option>
          </select>
        </div>
        <div class="flex flex-col">
          <label :for="fieldId('signercargofilter')" class="deasy-form-label">Cargo</label>
          <select :id="fieldId('signercargofilter')" v-model="signerCargoFilter" class="deasy-control deasy-control--select" :disabled="isLoadingSignerOptions">
            <option value="">Todos</option>
            <option v-for="option in signerCargoOptions" :key="option.id" :value="String(option.id)">
              {{ option.label || option.name }}
            </option>
          </select>
        </div>
        <div class="flex items-end justify-end">
          <AdminButton variant="primary-outline" class-name="w-full md:w-auto" @click="clearSignerFilters">
            Limpiar filtros
          </AdminButton>
        </div>
      </div>

      <div class="deasy-card mt-2 min-h-65 max-h-90 overflow-y-auto p-2 custom-scrollbar">
        <div v-if="isSearchingUsers" class="text-muted text-sm text-center py-10 font-medium">Buscando usuarios...</div>
        <div v-else-if="userResults.length === 0" class="text-muted text-sm text-center py-10 font-medium">
          No se han encontrado resultados.
        </div>
        <div v-else class="flex flex-col gap-2">
          <button
            v-for="user in userResults"
            :key="user.id || user._id"
            type="button"
            class="deasy-picker deasy-picker--flat flex-col items-start"
            :class="[(selectedSigner?.id === user.id || selectedSigner?._id === user._id) ? 'deasy-elegible--activa' : '']"
            @click="selectSigner(user)"
          >
            <div class="font-semibold text-strong text-sm flex items-center justify-between w-full gap-3">
              <span>{{ user.first_name }} {{ user.last_name }}</span>
              <AppTag v-if="selectedSigner?.id === user.id || selectedSigner?._id === user._id" variant="info">Seleccionado</AppTag>
            </div>
            <div class="text-xs text-muted mt-1 flex flex-wrap items-center gap-2">
              <span class="bg-surface px-1.5 py-0.5 rounded border border-line">{{ user.cedula }}</span>
              <span>{{ user.email }}</span>
            </div>
            <div v-if="user.unit_type_name || user.unit_name || user.cargo_name" class="text-xs text-icon mt-2 flex flex-wrap gap-2">
              <span v-if="user.unit_type_name" class="deasy-card px-2 py-1">{{ user.unit_type_name }}</span>
              <span v-if="user.unit_name" class="deasy-card px-2 py-1">{{ user.unit_name }}</span>
              <span v-if="user.cargo_name" class="deasy-card px-2 py-1">{{ user.cargo_name }}</span>
            </div>
          </button>
        </div>
      </div>
      <p v-if="userSearchError" class="text-danger text-sm font-medium mt-1 mb-0">{{ userSearchError }}</p>
    </div>
    <template #footer>
      <AdminButton variant="danger-outline" data-modal-dismiss>
        Cancelar
      </AdminButton>
      <AdminButton variant="primary-outline" @click="confirmSigner">
        Guardar y Asignar
      </AdminButton>
    </template>
  </AppModalShell>

  <AppModalShell
    ref="confirmDeleteModal"
    labelled-by="confirm-delete-signature-title"
    title="Eliminar firma"
    size="centered"
    content-class="shadow border-0"
    body-class="pt-4"
    footer-class="border-0 pt-0"
  >
    <p class="mb-0 text-sm text-icon">
      ¿Deseas eliminar este campo de firma? Esta acción no se puede deshacer.
    </p>
    <template #footer>
      <AdminButton variant="danger-outline" @click="confirmDeleteField">
        Eliminar
      </AdminButton>
    </template>
  </AppModalShell>

  <AppModalShell
    ref="signCertModal"
    labelled-by="sign-cert-modal-title"
    :title="multiBatchRequest ? 'Iniciar firma masiva' : signMode === 'token' ? 'Firmar documento por token' : 'Firmar documento'"
    size="lg"
    content-class="shadow border-0"
    body-class="pt-4"
  >
    <div class="flex flex-col gap-4">
      <p class="mb-0 text-sm text-icon">
        Selecciona uno de tus certificados guardados e ingresa la contraseña del `.p12`.
      </p>

      <div
        v-if="multiBatchRequest"
        class="rounded-2xl border border-blue-light-200 bg-blue-light-50 px-4 py-3 text-sm text-info"
      >
        <div class="font-semibold">Lote preparado</div>
        <div class="mt-1 text-info">
          Se iniciará una firma masiva para {{ multiBatchRequest.documents.length }} documento(s) en modo
          <span class="font-semibold">
            {{
              multiBatchRequest.mode === 'token'
                ? 'token'
                : multiBatchRequest.mode === 'per-document'
                  ? 'coordenadas por documento'
                  : 'coordenadas compartidas'
            }}
          </span>.
        </div>
      </div>

      <div
        v-if="!multiBatchRequest && signMode === 'token'"
        class="rounded-2xl border border-blue-light-200 bg-blue-light-50 px-4 py-3 text-sm text-info"
      >
        <div class="font-semibold">Firma por token</div>
        <div v-if="currentSignatureMarker" class="mt-1 text-info">
          Se buscarán todas las coincidencias del marcador <span class="font-mono font-semibold">{{ currentSignatureMarker }}</span> y se estampará la firma en cada una.
        </div>
        <div v-else class="mt-1 text-danger">
          Tu usuario no tiene un token de firma configurado.
        </div>
      </div>

      <div class="deasy-card p-4">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <div class="text-sm font-bold text-strong">Certificados disponibles</div>
            <div class="text-xs text-muted">Puedes gestionarlos aquí sin salir de la vista de firmas.</div>
          </div>
          <AdminButton variant="primary-outline" @click="openCertificatesManagerModal">
            Gestionar certificados
          </AdminButton>
        </div>

        <div v-if="isLoadingCertificates" class="text-sm text-muted font-medium py-3">
          Cargando certificados...
        </div>
        <AppEmpty v-else-if="!availableCertificates.length">
          No tienes certificados cargados.
        </AppEmpty>
        <div v-else class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
          <button
            v-for="certificate in availableCertificates"
            :key="certificate.id"
            type="button"
            class="deasy-picker deasy-picker--flat"
            :class="[selectedCertificateId === certificate.id ? 'deasy-elegible--activa' : '']"
            @click="selectedCertificateId = certificate.id"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-bold text-strong">{{ certificate.label }}</span>
              <AppTag v-if="certificate.is_default" variant="info">Predeterminado</AppTag>
            </div>
            <div class="text-xs text-muted mt-1">{{ certificate.original_filename }}</div>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col">
          <label :for="fieldId('certpassword')" class="deasy-form-label">Contraseña del certificado</label>
          <input :id="fieldId('certpassword')" v-model="certPassword" type="password" class="deasy-control" placeholder="Contraseña del .p12" autocomplete="current-password" />
        </div>
        <div class="flex flex-col">
          <label :for="fieldId('stamptext')" class="deasy-form-label">Texto del sello</label>
          <input :id="fieldId('stamptext')" v-model="stampText" type="text" class="deasy-control" placeholder="Ej: Dr. Juan Pérez" />
        </div>
      </div>

      <AppAlert variant="warning">
        <SToggle v-model="allowUntrustedSigner" label-position="end">
          <span class="text-sm text-warning">
            Permitir certificados no validados
            <span class="block text-xs text-warning">
              Solo para pruebas. Si la cadena de confianza no puede validarse, la firma continuará y se devolverá como advertencia.
            </span>
          </span>
        </SToggle>
      </AppAlert>

      <p v-if="signError" class="mb-0 text-sm font-medium text-danger">{{ signError }}</p>
    </div>
    <template #footer>
      <AdminButton variant="danger-outline" data-modal-dismiss :disabled="isSigning">
        Cancelar
      </AdminButton>
      <AdminButton variant="primary-outline" :disabled="isSigning" @click="confirmSign">
        {{ isSigning ? "Firmando..." : "Confirmar firma" }}
      </AdminButton>
    </template>
  </AppModalShell>

  <AppModalShell
    ref="signResultModal"
    labelled-by="sign-result-modal-title"
    :title="signSuccess ? 'Documento firmado' : 'Error al firmar'"
    size="md"
    content-class="shadow border-0"
    body-class="pt-4"
  >
      <div v-if="signSuccess" class="flex flex-col gap-4">
        <p class="mb-0 text-sm text-success font-medium">
          {{ signResultMessage || `El documento fue firmado correctamente con ${signedFieldsCount} campo(s).` }}
        </p>
        <div v-if="signedMinioPath" class="flex flex-wrap gap-3">
          <AdminButton variant="primary-outline" @click="viewSignedDocument">Visualizar documento</AdminButton>
          <AdminButton variant="primary-outline" @click="downloadSignedDocument">Descargar documento</AdminButton>
        </div>
    </div>
    <p v-else class="mb-0 text-sm text-danger font-medium">{{ signResultMessage || signError || 'No se pudo completar la firma. Revisa el certificado, la contraseña o el PDF del flujo.' }}</p>
    <template #footer>
      <AdminButton variant="neutral-outline" data-modal-dismiss>Cerrar</AdminButton>
    </template>
  </AppModalShell>

  <AppModalShell
    ref="certificatesManagerModal"
    labelled-by="certificates-manager-modal-title"
    title="Gestionar certificados"
    size="xl"
    content-class="shadow border-0"
    body-class="pt-4"
  >
    <UserCertificatesPanel
      ref="certificatesPanelRef"
      selectable
      :selected-id="selectedCertificateId"
      @select="handleCertificateSelected"
      @loaded="handleCertificatesLoaded"
 />
    <template #footer>
      <AdminButton variant="neutral-outline" data-modal-dismiss>Cerrar</AdminButton>
    </template>
  </AppModalShell>

  <AppModalShell
    ref="validationResultModal"
    labelled-by="validation-result-modal-title"
    title="Validar documento"
    size="xl"
    :show-close-button="false"
    content-class="rounded-xl border-0 overflow-hidden"
    body-class="p-0 bg-surface relative"
  >
    <template #title>
      <div class="flex items-center pb-0">Validar documento</div>
      <AppCloseButton
        data-modal-dismiss
        class="absolute right-5 top-4 z-(--z-capa-elemento)"
 />
    </template>
    <div class="px-6 pt-6 pb-4">
      <div class="deasy-card p-5 flex flex-col md:flex-row md:items-end gap-4 relative overflow-hidden">
        <div class="absolute -right-16 -top-16 w-32 h-32 bg-blue-light-50 rounded-full blur-2xl opacity-60"></div>
        <div class="flex-1 flex flex-col relative z-(--z-capa-base) w-full">
          <label :for="fieldId('validationcedula')" class="deasy-form-label deasy-form-label--inline gap-2">
            <IconSearch class="w-4 h-4 text-info" /> Buscar cédula en las firmas
          </label>
          <div class="relative max-w-full md:max-w-sm">
            <input :id="fieldId('validationcedula')" v-model="validationCedula" type="text" class="deasy-control" placeholder="Ej. 0999999999 (Opcional)" />
          </div>
        </div>
        <div class="relative z-(--z-capa-base) w-full md:w-auto">
          <AppButton
            variant="primary-outline"
            class-name="w-full md:w-auto"
            :disabled="isValidatingDocument || !validationFile"
            @click="validateDocument"
          >
            <IconRefresh v-if="isValidatingDocument" class="w-4 h-4 animate-spin" />
            <IconShieldCheck v-else class="w-4 h-4" />
            {{ isValidatingDocument ? 'Validando...' : 'Revalidar documento' }}
          </AppButton>
        </div>
      </div>

      <AppAlert class="mt-4 flex items-start gap-3" v-if="validationError">
        <IconAlertCircle class="w-5 h-5 shrink-0 text-danger mt-0.5" />
        <p class="font-medium leading-relaxed m-0">{{ validationError }}</p>
      </AppAlert>

      <div v-if="validationResult" class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="deasy-card p-4 flex flex-col items-start gap-2 relative overflow-hidden">
          <div class="flex items-center gap-2 text-muted mb-1 z-(--z-capa-base)">
            <div class="p-1.5 bg-surface rounded-2xl"><IconSignature class="w-4 h-4" /></div>
            <div class="deasy-overline">Firmas Detectadas</div>
          </div>
          <div class="text-3xl font-black text-strong z-(--z-capa-base)">{{ validationResult.summary?.signatureCount || 0 }}</div>
        </div>

        <AppAlert variant="success" class="flex flex-col items-start gap-2 relative overflow-hidden">
          <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-100 rounded-full blur-xl opacity-50"></div>
          <div class="flex items-center gap-2 text-success mb-1 z-(--z-capa-base)">
            <div class="p-1.5 bg-emerald-100 rounded-2xl"><IconCheck class="w-4 h-4" /></div>
            <div class="deasy-overline">Firmas Válidas</div>
          </div>
          <div class="text-3xl font-black text-success z-(--z-capa-base)">{{ validationResult.summary?.validSignatureCount || 0 }}</div>
        </AppAlert>

        <div class="rounded-2xl border border-blue-light-200 bg-blue-light-50/50 p-4 flex flex-col items-start gap-2 relative overflow-hidden">
           <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-light-100 rounded-full blur-xl opacity-50"></div>
          <div class="flex items-center gap-2 text-info mb-1 z-(--z-capa-base)">
            <div class="p-1.5 bg-blue-light-100 rounded-2xl"><IconSearch class="w-4 h-4" /></div>
            <div class="deasy-overline">Coincidencias</div>
          </div>
          <div class="text-3xl font-black text-info z-(--z-capa-base)">{{ validationResult.summary?.matchingCedulaCount || 0 }}</div>
        </div>

        <div class="rounded-2xl border border-brand-200 bg-brand-50/50 p-4 flex flex-col justify-center relative overflow-hidden">
          <div class="flex items-center gap-2 text-primary mb-2 z-(--z-capa-base)">
            <div class="p-1.5 bg-brand-100 rounded-2xl"><IconFileCheck class="w-4 h-4" /></div>
            <div class="deasy-overline">Documento Activo</div>
          </div>
          <div class="text-sm font-bold text-primary truncate w-full z-(--z-capa-base)" :title="validationFile?.name">{{ validationFile?.name || 'Subido manualmente' }}</div>
        </div>
      </div>

      <AppAlert variant="warning" class="mt-4 flex items-start gap-3" v-if="validationResult?.summary?.timestampCount">
        <IconAlertTriangle class="w-5 h-5 shrink-0 text-warning mt-0.5" />
        <p class="font-medium leading-relaxed m-0">El documento también contiene <strong class="font-black">{{ validationResult.summary.timestampCount }}</strong> sello(s) de tiempo, los cuales no se detallan en la tabla principal de firmantes.</p>
      </AppAlert>

      <AppAlert class="mt-4 flex items-start gap-3" v-if="Array.isArray(validationResult?.warnings) && validationResult.warnings.length">
        <IconAlertCircle class="w-5 h-5 shrink-0 text-danger mt-0.5" />
        <div class="flex flex-col gap-2">
          <p v-for="(warning, idx) in validationResult.warnings" :key="idx" class="font-medium leading-relaxed m-0">{{ warning }}</p>
        </div>
      </AppAlert>
    </div>

    <!-- TABLA -->
    <div class="bg-white border-t border-line relative min-h-50">
      <Loading 
        :visible="isValidatingDocument" 
        text="Validando firmas..." 
        subText="Por favor espere, esto puede tardar unos segundos dependiendo del tamaño de su documento." 
        :overlay="true" 
 />
      <AppDataTable
        :fields="validationTableFields"
        :rows="validationResult?.signatures || []"
        :row-key="(row) => `${row.index}-${row.fieldName || row.signerCedula || 'firma'}`"
        class="border-0 shadow-none rounded-none"
      >
        <template #cell="{ row, field }">
          <template v-if="field.name === 'validLabel'">
            <div class="flex items-center justify-center">
              <AppTag v-if="row.valid" variant="success">
                <IconCheck class="w-3.5 h-3.5" /> Válida
              </AppTag>
              <AppTag v-else variant="danger">
                <IconX class="w-3.5 h-3.5" /> Inválida
              </AppTag>
            </div>
          </template>
          <template v-else-if="field.name === 'certificateAuthority'">
            <div class="flex items-center justify-center">
              <AppButton
                v-if="row.certificateAuthority && row.certificateAuthority !== 'No disponible'"
                variant="info-soft"
                icon-only
                title="Ver entidad certificadora"
                @click="openCertificateAuthorityModal(row)"
              >
                <IconCertificate class="w-4 h-4" />
           </AppButton>
              <span v-else class="deasy-overline">N/A</span>
            </div>
          </template>
          <template v-else-if="field.name === 'signerCedula'">
            <div class="flex flex-col gap-2 items-start">
              <span class="font-semibold text-strong">{{ row.signerCedula }}</span>
              <AppTag v-if="row.matchesCedula" variant="info">
                <IconCheck class="w-3 h-3" /> Coincide
              </AppTag>
            </div>
          </template>
          <template v-else-if="field.name === 'details'">
            <details class="min-w-[16rem] group">
              <summary class="deasy-overline cursor-pointer text-info hover:text-info transition flex items-center gap-2 list-none">
                <IconInfoCircle class="w-4 h-4" />
                <span class="group-open:hidden">Ver técnico</span>
                <span class="hidden group-open:inline">Ocultar</span>
              </summary>
              <pre class="deasy-card mt-2 overflow-auto whitespace-pre-wrap text-theme-xs text-icon p-3 max-h-40 leading-relaxed custom-scrollbar">{{ JSON.stringify(row.extras || {}, null, 2) }}</pre>
            </details>
          </template>
          <template v-else>
            <span class="text-sm text-icon font-medium">{{ row[field.name] }}</span>
          </template>
        </template>
        <template #empty>
          <AppEmpty :icon="IconShieldCheck" title="Sin firmas detectadas">No se encontraron firmas electrónicas embebidas en el documento analizado o el documento no ha sido cargado correctamente.</AppEmpty>
        </template>
      </AppDataTable>
    </div>
  </AppModalShell>

  <AppModalShell
    ref="certificateAuthorityModal"
    labelled-by="certificate-authority-modal-title"
    title="Entidad certificadora"
    size="lg"
    content-class="shadow border-0"
    body-class="pt-4"
  >
    <div class="flex flex-col gap-4">
      <div class="deasy-card px-4 py-3">
        <div class="deasy-overline">Entidad</div>
        <div class="mt-2 whitespace-pre-wrap text-sm font-medium text-strong">
          {{ selectedCertificateAuthority?.certificateAuthority || 'No disponible' }}
        </div>
      </div>

      <div
        v-if="selectedCertificateAuthority?.extras?.issuer"
        class="deasy-card px-4 py-3"
      >
        <div class="deasy-overline">Issuer completo</div>
        <div class="mt-2 whitespace-pre-wrap text-sm text-body">
          {{ selectedCertificateAuthority.extras.issuer }}
        </div>
      </div>

      <div
        v-if="selectedCertificateAuthority?.extras?.issuerAttributes && Object.keys(selectedCertificateAuthority.extras.issuerAttributes).length"
        class="deasy-card px-4 py-3"
      >
        <div class="deasy-overline">Atributos detectados</div>
        <pre class="mt-3 overflow-auto whitespace-pre-wrap text-xs text-icon">{{ JSON.stringify(selectedCertificateAuthority.extras.issuerAttributes, null, 2) }}</pre>
      </div>
    </div>
  </AppModalShell>
</template>
  <script setup>
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
import AppDeleteButton from "@/shared/components/buttons/AppDeleteButton.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
  import { onMounted, onBeforeUnmount, ref, watch, nextTick, computed, defineExpose, defineProps, defineEmits, h, useId } from "vue";
  import { useRouter } from 'vue-router';
  import axios from '@/core/services/httpClient';
  import { pdfjsLib } from '@/core/utils/pdfjsSetup';
  import { Modal } from '@/shared/utils/modalController';
  import { IconArrowLeft, IconSignature, IconSend, IconShieldCheck, IconX, IconFileUpload, IconFiles, IconSearch, IconCertificate, IconAlertCircle, IconCheck, IconInfoCircle, IconAlertTriangle, IconFileCheck, IconRefresh, IconTrash, IconListCheck, IconInbox } from '@tabler/icons-vue';
  import { API_ROUTES } from '@/core/config/apiConfig';
  import AppTag from '@/shared/components/data/AppTag.vue';
  import AppDataTable from '@/shared/components/data/AppDataTable.vue';
  import AppCounterNavigator from '@/shared/components/widgets/AppCounterNavigator.vue';
  import PdfDropField from '@/shared/components/forms/PdfDropField.vue';
  import SignatureBox from '@/modules/firmas/components/SignatureBox.vue';
  import UserCertificatesPanel from '@/modules/firmas/components/UserCertificatesPanel.vue';
  import AppModalShell from '@/shared/components/modals/AppModalShell.vue';
  import AdminButton from '@/shared/components/buttons/AppButton.vue';
  import SToggle from '@/shared/components/forms/SToggle.vue';
  import Loading from '@/shared/components/feedback/Loading.vue';
  import MultiSignerPanel from '@/modules/firmas/components/MultiSignerPanel.vue';


// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;
  const router = useRouter();

  const props = defineProps({
    embedded: {
      type: Boolean,
      default: false
    },
    multiOnly: {
      type: Boolean,
      default: false
    },
    enableHomeShortcuts: {
      type: Boolean,
      default: false
    },
    showStartHeading: {
      type: Boolean,
      default: true
    },
    launcherMode: {
      type: String,
      default: "all"
    },
    hiddenLauncherModes: {
      type: Array,
      default: () => []
    }
  });
  const emit = defineEmits(['workflow-signed', 'batch-finished', 'close-multi', 'request-close', 'open-home-pending', 'open-home-multisigner', 'open-general-multisigner', 'open-sign-modal', 'open-request-modal', 'multi-header-update']);

  const buildWorkspaceIcon = (IconComponent, colorClasses) =>
    h(
      'div',
      {
        class: `signature-workspace-icon deasy-icon-box deasy-icon-box--xl deasy-icon-box--outlined mx-auto ${colorClasses}`
      },
      [h(IconComponent, { class: 'h-7 w-7', 'stroke-width': 1.5 })]
    );

  const CustomIconSignature = () => buildWorkspaceIcon(IconSignature, 'deasy-icon-box--info');
  const CustomIconSearch = () => buildWorkspaceIcon(IconSearch, 'deasy-icon-box--neutral');
  const CustomIconSend = () => buildWorkspaceIcon(IconSend, 'deasy-icon-box--success');
  const CustomIconShieldCheck = () => buildWorkspaceIcon(IconShieldCheck, 'deasy-icon-box--warning');
  const CustomIconFiles = () => buildWorkspaceIcon(IconFiles, 'deasy-icon-box--primary');
  const CustomIconPendingTray = () => buildWorkspaceIcon(IconListCheck, 'deasy-icon-box--info');
  const CustomIconReceivedRequests = () => buildWorkspaceIcon(IconInbox, 'deasy-icon-box--success');
  const normalizedLauncherMode = computed(() => String(props.launcherMode || "all").trim().toLowerCase());
  const canShowLauncher = (mode) => {
    const normalizedMode = String(mode || "").trim().toLowerCase();
    if (!normalizedMode) return false;
    if (props.hiddenLauncherModes.map((value) => String(value || "").trim().toLowerCase()).includes(normalizedMode)) {
      return false;
    }
    if (normalizedLauncherMode.value === "all") return true;
    return normalizedLauncherMode.value === normalizedMode;
  };
  const resolveUiErrorMessage = (error, fallback) => {
    const candidates = [
      error?.response?.data?.error,
      error?.response?.data?.details,
      error?.response?.data?.message,
      error?.details,
      error?.error,
      error?.message,
      typeof error === 'string' ? error : ''
    ];
    const resolved = candidates
      .map((value) => String(value || '').trim())
      .find(Boolean);
    if (resolved === "The signer's certificate could not be validated") {
      return 'No se pudo validar el certificado del firmante. Para este entorno de pruebas, habilita "Permitir certificados no validados".';
    }
    return resolved || fallback;
  };

  const readResponsePayload = async (response) => {
    const rawText = await response.text().catch(() => '');
    if (!rawText) {
      return {};
    }
    try {
      return JSON.parse(rawText);
    } catch {
      return {
        message: rawText
      };
    }
  };

  let ctx;
  const colPdf=ref(null)
  let pdfDoc = null;
  let renderTask = null;
  const pdfViewer=ref(null), pdfCanvas=ref(null), coordinatesDisplay=ref(null);
  const currentPage = ref(1);
  const pageInput = ref(1);
  const totalPages = ref(0);
  const pageHeightPdf = ref(0);
  const pageWidthPdf = ref(0);
  const displayScaleRef = ref(1);
  const showSignaturesModal = ref(false);
  const uploadedFiles = ref([]);
  const uploadError = ref('');
  const pdfReady = ref(false);
  const requestMode = ref(false);
  const workspaceMode = ref('single');
  const deleteModal = ref(null);
  const assignSignerModal = ref(null);
  const confirmDeleteModal = ref(null);
  const signCertModal = ref(null);
  const signResultModal = ref(null);
  const validationResultModal = ref(null);
  const certificateAuthorityModal = ref(null);
  const certificatesManagerModal = ref(null);
  const certificatesPanelRef = ref(null);
  const signerInput = ref('');
  const userResults = ref([]);
  const userSearchError = ref('');
  const isSearchingUsers = ref(false);
  const selectedSigner = ref(null);
  const statusFilter = ref('all');
  const signerUnitTypeFilter = ref('');
  const signerUnitFilter = ref('');
  const signerCargoFilter = ref('');
  const signerUnitTypeOptions = ref([]);
  const signerUnitOptions = ref([]);
  const signerCargoOptions = ref([]);
  const isLoadingSignerOptions = ref(false);
  const currentUser = ref(null);
  const fields = ref([]);
  const tokenPreviewFields = ref([]);
  const lastSelection = ref(null);
  const lastFieldId = ref(null);
  const fieldCounter = ref(1);
  const visibleFields = computed(() => (signMode.value === 'token' ? tokenPreviewFields.value : fields.value));
  const previewCanvas = ref(null);
  const selectedField = ref(null);
  const filterPage = ref('all');
  const filteredFields = computed(() => {
    if (filterPage.value === 'all') return visibleFields.value;
    return visibleFields.value.filter((field) => field.page === Number(filterPage.value));
  });
  const currentPageFields = computed(() => visibleFields.value.filter((field) => field.page === currentPage.value));
  const pagesWithFields = computed(() => {
    const pages = new Set(visibleFields.value.map((field) => field.page));
    return Array.from(pages).sort((a, b) => a - b);
  });
  let viewport = null;
  const pdfScale = ref(1.75); 
  let deleteModalInstance = null;
  let assignSignerModalInstance = null;
  let confirmDeleteModalInstance = null;
  let searchTimeout = null;
  let resizeObserver = null;
  let resizeTimer = null;
  let lastContainerWidth = null;

  const FIELD_WIDTH = 124;
  const FIELD_HEIGHT = 48;
  const PDF_LOAD_OPTIONS = {
    enableXfa: true,
    stopAtErrors: false
  };
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let activeBox = null;
  const pendingDeleteFieldId = ref(null);
  const availableCertificates = ref([]);
  const selectedCertificateId = ref(null);
  const certPassword = ref('');
  const stampText = ref('');
  const signMode = ref('coordinates');
  const ALLOW_UNTRUSTED_SIGNER_STORAGE_KEY = 'deasy.allowUntrustedSigner';
  const readAllowUntrustedSignerPreference = () => {
    try {
      const raw = localStorage.getItem(ALLOW_UNTRUSTED_SIGNER_STORAGE_KEY);
      if (raw === null) {
        return true;
      }
      return raw === 'true';
    } catch {
      return true;
    }
  };
  const allowUntrustedSigner = ref(readAllowUntrustedSignerPreference());
  const isSigning = ref(false);
  const signError = ref('');
  const signSuccess = ref(false);
  const signResultMessage = ref('');
  const signedMinioPath = ref('');
  const signedFieldsCount = ref(0);
  const workflowSignContext = ref(null);
  const workflowPdfStatus = ref({ type: 'info', message: '' });
  const validationFile = ref(null);
  const validationCedula = ref('');
  const isValidatingDocument = ref(false);
  const validationError = ref('');
  const validationResult = ref(null);
  const selectedCertificateAuthority = ref(null);
  const multiBatchRequest = ref(null);
  const activeMultiBatchJob = ref(null);
  const multiSignerPanelRef = ref(null);

  watch(allowUntrustedSigner, (value) => {
    try {
      localStorage.setItem(ALLOW_UNTRUSTED_SIGNER_STORAGE_KEY, value ? 'true' : 'false');
    } catch {
      // ignore storage failures in restricted contexts
    }
  });
  const activeMultiBatchJobId = ref('');
  const multiSignerSeedFiles = ref([]);
  const multiSignerSeedDocuments = ref([]);
  const allowManualMultiSignerUpload = ref(true);
  const enableMultiSignerDocumentFilters = ref(false);
  const isStartingMultiBatch = ref(false);
  const isDownloadingMultiBatch = ref(false);
  const isLoadingCertificates = ref(false);
  let signCertModalInstance = null;
  let signResultModalInstance = null;
  let validationResultModalInstance = null;
  let certificateAuthorityModalInstance = null;
  let certificatesManagerModalInstance = null;
  let multiBatchPollTimer = null;
  const validationTableFields = [
    { name: 'signerCedula', label: 'Cédula de Identidad' },
    { name: 'signerName', label: 'Nombres Apellidos' },
    { name: 'reasonLocation', label: 'Razón / Localización' },
    { name: 'signingTime', label: 'Fecha de Firmado' },
    { name: 'timestampStatus', label: 'Estampa de Tiempo' },
    { name: 'certificateAuthority', label: 'Entidad Certificadora' },
    { name: 'certificateIssuedAt', label: 'Fecha de Emisión' },
    { name: 'certificateExpiresAt', label: 'Fecha de Expiración' },
    { name: 'revocationStatus', label: 'Fecha de Revocación' },
    { name: 'validLabel', label: 'Válido' },
    { name: 'details', label: 'Detalles' }
  ];
  const currentSignatureMarker = computed(() => {
    if (currentUser.value?.signatureMarker) return currentUser.value.signatureMarker;
    const rawToken = currentUser.value?.signatureToken || currentUser.value?.token || '';
    return rawToken ? `!-${rawToken}-!` : '';
  });
  const isEmbeddedWorkflowMode = computed(() =>
    props.embedded
      && Boolean(workflowSignContext.value?.documentVersionId || workflowSignContext.value?.signatureRequestId)
  );

  const handleDatabaseEntry = () => {
    if (props.enableHomeShortcuts) {
      emit('open-home-multisigner');
      return;
    }
    router.push({ name: 'home-signatures' });
  };

  const removeBox = () => {
    const signbox = document.getElementById('active-signbox');
    if (signbox) {
      signbox.remove();
    }
  };

  const updateFieldCoordinates = (updatedField) => {
    const idx = fields.value.findIndex(f => f.id === updatedField.id);
    if (idx !== -1) {
      fields.value[idx] = updatedField;
    }
  };

  const clearAllBoxes = () => {
    removeBox();
  };

  const getViewerRect = () => pdfViewer.value.getBoundingClientRect();

  const getDisplayScale = () => {
    const rect = getViewerRect();
    if (!rect.width) return 1;
    return pdfCanvas.value.width / rect.width;
  };

  const toPdfUnits = (cssValue) => {
    const displayScale = getDisplayScale();
    return (cssValue * displayScale) / pdfScale.value;
  };

  const toCssUnits = (pdfUnits) => {
    const displayScale = getDisplayScale();
    return (pdfUnits * pdfScale.value) / displayScale;
  };

  const updateCoordinates = (left, top, right, bottom, rectHeight) => {
    const x1 = toPdfUnits(left);
    const y1 = toPdfUnits(rectHeight - top);
    const x2 = toPdfUnits(right);
    const y2 = toPdfUnits(rectHeight - bottom);
    lastSelection.value = {
      page: currentPage.value,
      x1,
      y1,
      x2,
      y2
    };
  };

  const createBox = (left, top, width, height) => {
    removeBox();
    const box = document.createElement('div');
    box.classList.add('box');
    box.id = 'active-signbox';
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.position = 'absolute';
    box.style.pointerEvents = 'none';
    pdfViewer.value.appendChild(box);
    return box;
  };



  const handleMouseDown = (event) => {
    isMouseOverPdf.value = false; // Hide preview temporarily on click
    if (!pdfDoc || !pdfViewer.value) return;

    const rect = getViewerRect();
    const ofx = rect.left + window.scrollX;
    const ofy = rect.top + window.scrollY;
    // ... rest of code
    const currentX = event.pageX - ofx;
    const currentY = event.pageY - ofy;

    const presetWidth = toCssUnits(FIELD_WIDTH);
    const presetHeight = toCssUnits(FIELD_HEIGHT);
    const maxLeft = Math.max(0, rect.width - presetWidth);
    const maxTop = Math.max(0, rect.height - presetHeight);
    
    const left = Math.min(Math.max(currentX - presetWidth / 2, 0), maxLeft);
    const top = Math.min(Math.max(currentY - presetHeight / 2, 0), maxTop);
      
    const box = createBox(left, top, presetWidth, presetHeight);
    updateCoordinates(left, top, left + presetWidth, top + presetHeight, rect.height);
    activeBox = box;
    if (requestMode.value) {
      openAssignSignerModal();
    } else {
      saveFieldWithSigner(currentUser.value);
    }
  };

  const isMouseOverPdf = ref(false);
  const isHoveringField = ref(false);
  const previewBoxStyle = ref({ display: 'none' });

  const handleMouseMove = (event) => {
    if (!pdfViewer.value) return;
    const rect = getViewerRect();

    const ofx = rect.left + window.scrollX;
    const ofy = rect.top + window.scrollY;
    const currentX = event.pageX - ofx;
    const currentY = event.pageY - ofy;

    isMouseOverPdf.value = true;
    const presetWidth = toCssUnits(FIELD_WIDTH);
    const presetHeight = toCssUnits(FIELD_HEIGHT);
    
    const maxLeft = Math.max(0, rect.width - presetWidth);
    const maxTop = Math.max(0, rect.height - presetHeight);
    
    // Calculate center to place mouse in the middle of the preview
    const left = Math.min(Math.max(currentX - presetWidth / 2, 0), maxLeft);
    const top = Math.min(Math.max(currentY - presetHeight / 2, 0), maxTop);

    previewBoxStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
      width: `${presetWidth}px`,
      height: `${presetHeight}px`
    };
  };

  const handleMouseLeave = () => {
    isMouseOverPdf.value = false;
    handleMouseUp();
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    if (!activeBox || !lastSelection.value) return;
    if (requestMode.value) {
      openAssignSignerModal();
      return;
    }
    saveFieldWithSigner(currentUser.value);
  };

  const registerEvents = () => {
    if (!pdfViewer.value) return;
    pdfViewer.value.addEventListener('mousedown', handleMouseDown);
    pdfViewer.value.addEventListener('mousemove', handleMouseMove);
    pdfViewer.value.addEventListener('mouseup', handleMouseUp);
    pdfViewer.value.addEventListener('mouseleave', handleMouseUp);
  };

  onMounted(() => {
    registerEvents();
    if (deleteModal.value?.el) {
      deleteModalInstance = Modal.getOrCreateInstance(deleteModal.value.el);
    }
    if (assignSignerModal.value?.el) {
      assignSignerModalInstance = Modal.getOrCreateInstance(assignSignerModal.value.el);
    }
    if (confirmDeleteModal.value?.el) {
      confirmDeleteModalInstance = Modal.getOrCreateInstance(confirmDeleteModal.value.el);
    }
    if (signCertModal.value?.el) {
      signCertModalInstance = Modal.getOrCreateInstance(signCertModal.value.el);
    }
    if (signResultModal.value?.el) {
      signResultModalInstance = Modal.getOrCreateInstance(signResultModal.value.el);
    }
    if (validationResultModal.value?.el) {
      validationResultModalInstance = Modal.getOrCreateInstance(validationResultModal.value.el);
    }
    if (certificateAuthorityModal.value?.el) {
      certificateAuthorityModalInstance = Modal.getOrCreateInstance(certificateAuthorityModal.value.el);
    }
    if (certificatesManagerModal.value?.el) {
      certificatesManagerModalInstance = Modal.getOrCreateInstance(certificatesManagerModal.value.el);
    }
    const userDataString = localStorage.getItem('user');
    if (userDataString) {
      try {
        currentUser.value = JSON.parse(userDataString);
        if (!stampText.value && currentUser.value) {
          stampText.value = `${currentUser.value.first_name ?? ''} ${currentUser.value.last_name ?? ''}`.trim();
        }
      } catch (error) {
        console.error('Error al cargar usuario en firmador:', error);
      }
    }
    ensureCurrentUserProfile();
    ensureResizeObserver();
    window.addEventListener('resize', scheduleResizeRender);
  });

  watch(pdfReady, async (ready) => {
    if (!ready) return;
    await nextTick();
    registerEvents();
    ensureResizeObserver();
  });

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
    window.removeEventListener('resize', scheduleResizeRender);
    if (multiBatchPollTimer) {
      clearTimeout(multiBatchPollTimer);
      multiBatchPollTimer = null;
    }
  });

  const scheduleUserSearch = () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      fetchUsers(signerInput.value);
    }, 300);
  };

  watch(signerInput, () => {
    scheduleUserSearch();
  });

  watch([statusFilter, signerUnitFilter, signerCargoFilter], () => {
    fetchUsers(signerInput.value);
  });

  watch(signerUnitTypeFilter, async () => {
    signerUnitFilter.value = '';
    await loadSignerUnitOptions();
    fetchUsers(signerInput.value);
  });
  


  const renderPage = async (pageNum) => {
    if (!pdfDoc || !pdfCanvas.value) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      ctx = pdfCanvas.value.getContext('2d');
      const baseViewport = page.getViewport({ scale: 1 });
      pageHeightPdf.value = baseViewport.height;
      pageWidthPdf.value = baseViewport.width;
      const containerWidth = colPdf.value?.clientWidth || baseViewport.width;
      pdfScale.value = containerWidth / baseViewport.width;
      viewport = page.getViewport({ scale: pdfScale.value });
      pdfCanvas.value.width = viewport.width;
      pdfCanvas.value.height = viewport.height;
      colPdf.value.style.width = '100%';
      pdfViewer.value.style.width = `${viewport.width}px`;
      pdfViewer.value.style.height = `${viewport.height}px`;

      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // noop
        }
      }

      renderTask = page.render({
        canvasContext: ctx,
        viewport
      });
      await renderTask.promise;
      displayScaleRef.value = getDisplayScale();
      currentPage.value = pageNum;
      pageInput.value = pageNum;
      clearAllBoxes();
      uploadError.value = '';
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') {
        return;
      }
      uploadError.value = 'No se pudo visualizar la página del PDF seleccionado.';
      console.error('Error al renderizar el PDF:', err);
    }
  };

  const scheduleResizeRender = () => {
    if (!pdfReady.value || !pdfDoc) return;
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      if (!pdfReady.value || !pdfDoc) return;
      renderPage(currentPage.value);
    }, 150);
  };

  const ensureResizeObserver = () => {
    if (!colPdf.value || typeof ResizeObserver === 'undefined') return;
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        const width = entries?.[0]?.contentRect?.width;
        if (!width || width === lastContainerWidth) return;
        lastContainerWidth = width;
        scheduleResizeRender();
      });
    }
    resizeObserver.observe(colPdf.value);
  };


    const prevPageBtn= () => {
      if (currentPage.value <= 1) return;
      renderPage(currentPage.value - 1);
    }

    const nextPageBtn=() => {
      if (currentPage.value >= totalPages.value) return;
      renderPage(currentPage.value + 1);
    }

    const goToPage = () => {
      const parsed = Number.parseInt(pageInput.value, 10);
      if (Number.isNaN(parsed)) {
        pageInput.value = currentPage.value;
        return;
      }
      const target = Math.min(Math.max(parsed, 1), totalPages.value || 1);
      renderPage(target);
    }

    const resetPdfState = () => {
      pdfDoc = null;
      pdfReady.value = false;
      totalPages.value = 0;
      currentPage.value = 1;
      pageInput.value = 1;
      lastSelection.value = null;
      lastFieldId.value = null;
    };

    const loadPdfFromFile = async (file, mode = 'sign') => {
      resetPdfState();
      fields.value = [];
      tokenPreviewFields.value = [];
      lastSelection.value = null;
      lastFieldId.value = null;
      fieldCounter.value = 1;
      clearAllBoxes();
      selectedField.value = null;
      filterPage.value = 'all';
      statusFilter.value = 'all';
      requestMode.value = mode === 'request';
      try {
        const fileBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(fileBuffer),
          ...PDF_LOAD_OPTIONS
        });
        const pdf = await loadingTask.promise;
        pdfDoc = pdf;
        totalPages.value = pdfDoc.numPages;
        pdfReady.value = true;
        await nextTick();
        await renderPage(currentPage.value);
      } catch (err) {
        uploadError.value = 'No se pudo cargar el PDF seleccionado.';
        console.error('Error al cargar el archivo PDF:', err);
        resetPdfState();
        throw err;
      }
    };

    const loadPdfFromRemotePath = async (objectPath, mode = 'sign') => {
      if (!objectPath) {
        workflowPdfStatus.value = {
          type: 'info',
          message: 'Este entregable todavía no tiene un PDF vinculado para precargar.'
        };
        return;
      }
      workflowPdfStatus.value = {
        type: 'info',
        message: 'Precargando PDF del entregable...'
      };
      try {
        let response = null;
        if (workflowSignContext.value?.taskItemId && workflowSignContext.value?.processDefinitionId) {
          const resolvedUser = await ensureCurrentUserProfile();
          const currentUserId = Number(resolvedUser?.id || 0);
          if (currentUserId) {
            response = await fetch(
              API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_FILE(
                currentUserId,
                workflowSignContext.value.processDefinitionId,
                workflowSignContext.value.taskItemId
              ),
              {
                headers: getAuthHeaders()
              }
            );
          }
        }
        if (!response) {
          response = await fetch(`${API_ROUTES.SIGN}/download?path=${encodeURIComponent(objectPath)}`, {
            headers: getAuthHeaders()
          });
        }
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.message || 'No se pudo descargar el PDF vinculado.');
        }
        const blob = await response.blob();
        const remoteFile = new File(
          [blob],
          objectPath.split('/').pop() || 'documento.pdf',
          { type: 'application/pdf' }
        );
        uploadedFiles.value = [{ content: remoteFile, isRenaming: false, name: remoteFile.name }];
        await loadPdfFromFile(remoteFile, mode);
        workflowPdfStatus.value = {
          type: 'success',
          message: 'El PDF del entregable se precargó correctamente.'
        };
      } catch (error) {
        workflowPdfStatus.value = {
          type: 'error',
          message: error?.message || 'No se pudo precargar el PDF del entregable.'
        };
      }
    };

    const onAddFiles = async (files, mode = 'sign', options = {}) => {
      uploadError.value = '';
      if (mode === 'multi' && Array.isArray(options.documents) && options.documents.length) {
        resetToStart();
        multiSignerSeedFiles.value = [];
        multiSignerSeedDocuments.value = [...options.documents];
        allowManualMultiSignerUpload.value = options.allowManualUpload !== false;
        enableMultiSignerDocumentFilters.value = Boolean(options.enableDocumentFilters);
        workspaceMode.value = 'multi';
        return;
      }
      const normalizedFiles = Array.from(files || []);
      if (!normalizedFiles.length) return;
      const pdfFiles = normalizedFiles.filter(
        (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      );
      if (!pdfFiles.length) {
        uploadError.value = 'El archivo debe ser un PDF.';
        return;
      }
      if (pdfFiles.length !== normalizedFiles.length) {
        uploadError.value = 'Solo se permiten archivos PDF.';
        return;
      }
      if (mode === 'multi') {
        if (props.enableHomeShortcuts) {
          emit('open-general-multisigner', { files: pdfFiles });
          return;
        }
        resetToStart();
        multiSignerSeedFiles.value = [...pdfFiles];
        multiSignerSeedDocuments.value = Array.isArray(options.documents) ? [...options.documents] : [];
        allowManualMultiSignerUpload.value = options.allowManualUpload !== false;
        enableMultiSignerDocumentFilters.value = Boolean(options.enableDocumentFilters);
        workspaceMode.value = 'multi';
        return;
      }
      const file = pdfFiles[0];
      if (props.enableHomeShortcuts && !props.embedded && (mode === 'sign' || mode === 'request')) {
        emit(mode === 'sign' ? 'open-sign-modal' : 'open-request-modal', { files: [file], mode });
        return;
      }
      if (mode === 'validate') {
        validationFile.value = file;
        validateDocument();
        return;
      }
      uploadedFiles.value = [{ content: file, isRenaming: false, name: file.name }];
      return loadPdfFromFile(file, mode);
    };

    const onPdfDropFiles = (files, mode) => {
      onAddFiles(files, mode);
    };

    const formatValidationDate = (value) => {
      if (!value) return 'No disponible';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return String(value);
      }
      return parsed.toLocaleString('es-EC');
    };

    const buildValidationRowsFromPayload = (signatures = []) =>
      signatures.map((signature) => ({
        ...signature,
        signerCedula: signature.signerCedula || 'No disponible',
        signerName: [
          signature.firstNames,
          signature.lastName,
          signature.secondLastName
        ].filter(Boolean).join(' ') || signature.signerName || 'No disponible',
        reasonLocation: [signature.reason, signature.location].filter(Boolean).join(' / ') || 'No disponible',
        signingTime: formatValidationDate(signature.signingTime),
        timestampStatus: signature.timestampStatus || 'No',
        certificateAuthority: signature.certificateAuthority || 'No disponible',
        certificateIssuedAt: formatValidationDate(signature.certificateIssuedAt),
        certificateExpiresAt: formatValidationDate(signature.certificateExpiresAt),
        revocationStatus: signature.revocationStatus || 'No disponible',
        validLabel: signature.valid ? 'Sí' : 'No'
      }));

    const openValidationModal = () => {
      if (!validationResultModal.value?.el) return;
      validationResultModalInstance = Modal.getOrCreateInstance(validationResultModal.value.el);
      validationResultModalInstance.show();
    };

    const openCertificateAuthorityModal = (row) => {
      selectedCertificateAuthority.value = row;
      if (!certificateAuthorityModal.value?.el) return;
      certificateAuthorityModalInstance = Modal.getOrCreateInstance(certificateAuthorityModal.value.el);
      certificateAuthorityModalInstance.show();
    };

    const validateDocument = async () => {
      if (!validationFile.value) {
        uploadError.value = 'Debes seleccionar un PDF para validarlo.';
        return;
      }

      openValidationModal();

      isValidatingDocument.value = true;
      validationError.value = '';
      uploadError.value = '';
      validationResult.value = null;
      try {
        const formData = new FormData();
        formData.append('pdf', validationFile.value);
        if (validationCedula.value.trim()) {
          formData.append('cedula', validationCedula.value.trim());
        }
        const response = await fetch(API_ROUTES.SIGN_VALIDATE, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || data?.message || 'No se pudo validar el documento.');
        }
        validationResult.value = {
          ...data,
          signatures: buildValidationRowsFromPayload(data.signatures || [])
        };
      } catch (error) {
        validationError.value = error.message || 'No se pudo validar el documento.';
        uploadError.value = validationError.value;
      } finally {
        isValidatingDocument.value = false;
      }
    };

    const openMultiSigner = () => {
      resetToStart();
      multiSignerSeedFiles.value = [];
      multiSignerSeedDocuments.value = [];
      allowManualMultiSignerUpload.value = true;
      enableMultiSignerDocumentFilters.value = false;
      workspaceMode.value = 'multi';
    };

    const closeMultiSigner = () => {
      if (props.multiOnly) {
        emit('close-multi');
        return;
      }
      workspaceMode.value = 'single';
    };

    const loadSignerFilterOptions = async () => {
      isLoadingSignerOptions.value = true;
      try {
        const [unitTypesResponse, cargosResponse] = await Promise.all([
          axios.get(API_ROUTES.ADMIN_SQL_TABLE('unit_types'), {
            params: { limit: 500 }
          }),
          axios.get(API_ROUTES.ADMIN_SQL_TABLE('cargos'), {
            params: { limit: 500 }
          })
        ]);
        signerUnitTypeOptions.value = unitTypesResponse.data || [];
        signerCargoOptions.value = cargosResponse.data || [];
      } catch (error) {
        // Los desplegables quedan vacíos, que se ve igual que "no hay tipos de unidad ni
        // cargos configurados": sin traza no había forma de distinguir el fallo del vacío.
        console.error('No se pudieron cargar los filtros de firmantes:', error);
        signerUnitTypeOptions.value = [];
        signerCargoOptions.value = [];
      } finally {
        isLoadingSignerOptions.value = false;
      }
    };

    const loadSignerUnitOptions = async () => {
      if (!signerUnitTypeFilter.value) {
        signerUnitOptions.value = [];
        return;
      }
      isLoadingSignerOptions.value = true;
      try {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE('units'), {
          params: {
            filter_unit_type_id: signerUnitTypeFilter.value,
            limit: 500
          }
        });
        signerUnitOptions.value = response.data || [];
      } catch (error) {
        // Mismo caso que loadSignerFilterOptions: la lista vacía no distingue "ese tipo de
        // unidad no tiene unidades" de "la petición falló".
        console.error('No se pudieron cargar las unidades del filtro de firmantes:', error);
        signerUnitOptions.value = [];
      } finally {
        isLoadingSignerOptions.value = false;
      }
    };

    const fetchUsers = async (term) => {
      isSearchingUsers.value = true;
      userSearchError.value = '';
      try {
        const params = new URLSearchParams({
          search: term || '',
          limit: '20'
        });
        if (statusFilter.value !== 'all') {
          params.set('status', statusFilter.value);
        }
        if (signerUnitTypeFilter.value) {
          params.set('unit_type_id', signerUnitTypeFilter.value);
        }
        if (signerUnitFilter.value) {
          params.set('unit_id', signerUnitFilter.value);
        }
        if (signerCargoFilter.value) {
          params.set('cargo_id', signerCargoFilter.value);
        }
        const url = `${API_ROUTES.USERS}?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('No se pudo obtener usuarios');
        }
        const data = await response.json();
        userResults.value = Array.isArray(data) ? data : [];
      } catch (error) {
        userSearchError.value = 'No se pudo cargar la lista de usuarios.';
        userResults.value = [];
      } finally {
        isSearchingUsers.value = false;
      }
    };

    const selectSigner = (user) => {
      selectedSigner.value = user;
      signerInput.value = user?.email || user?.cedula || '';
      userSearchError.value = '';
    };

    const buildResolvedSigner = (signer) => {
      if (!signer) return null;
      return {
        id: signer.id ?? signer._id,
        cedula: signer.cedula,
        first_name: signer.first_name,
        last_name: signer.last_name,
        email: signer.email
      };
    };

    const addFieldFromSelection = (selection, signer, options = {}) => {
      if (!selection) return null;
      if (selection.x1 === selection.x2 || selection.y1 === selection.y2) return null;
      const fieldName = options.fieldName || `Firma ${fieldCounter.value}`;
      fieldCounter.value += 1;
      const field = {
        id: options.id || `field-${Date.now()}-${fieldCounter.value}`,
        name: fieldName,
        page: selection.page,
        x1: Number(selection.x1.toFixed(2)),
        y1: Number(selection.y1.toFixed(2)),
        x2: Number(selection.x2.toFixed(2)),
        y2: Number(selection.y2.toFixed(2)),
        signer: buildResolvedSigner(signer)
      };
      fields.value = [...fields.value, field];
      lastFieldId.value = field.id;
      return field;
    };

    const saveFieldWithSigner = (signer) => {
      if (!activeBox || !lastSelection.value) return;
      addFieldFromSelection(lastSelection.value, signer);
      removeBox();
      activeBox = null;
      lastSelection.value = null;
    };

    const buildTokenPreviewFields = async () => {
      tokenPreviewFields.value = [];
      if (!pdfDoc || !currentSignatureMarker.value) {
        return [];
      }

      const markerRegex = new RegExp(escapeRegExp(currentSignatureMarker.value), 'g');
      const previewFields = [];
      const signer = buildResolvedSigner(currentUser.value);

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
        const page = await pdfDoc.getPage(pageNum);
        const pageViewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        for (const item of textContent.items || []) {
          const rawText = typeof item?.str === 'string' ? item.str : '';
          if (!rawText || !rawText.includes(currentSignatureMarker.value)) continue;

          markerRegex.lastIndex = 0;
          let match;
          while ((match = markerRegex.exec(rawText)) !== null) {
            const charWidth = rawText.length ? Number(item.width || 0) / rawText.length : 0;
            const x1 = Math.max(
              0,
              Math.min((Number(item.transform?.[4]) || 0) + charWidth * match.index, pageViewport.width - FIELD_WIDTH)
            );
            const y1 = Math.max(
              FIELD_HEIGHT,
              Math.min((Number(item.transform?.[5]) || 0) - 6 + FIELD_HEIGHT * 0.5, pageViewport.height)
            );

            previewFields.push({
              id: `token-preview-${pageNum}-${previewFields.length}-${Date.now()}`,
              name: `Token ${previewFields.length + 1}`,
              page: pageNum,
              x1: Number(x1.toFixed(2)),
              y1: Number(y1.toFixed(2)),
              x2: Number(Math.min(pageViewport.width, x1 + FIELD_WIDTH).toFixed(2)),
              y2: Number(Math.max(0, y1 - FIELD_HEIGHT).toFixed(2)),
              signer
            });
          }
        }
      }

      tokenPreviewFields.value = previewFields;
      return previewFields;
    };

    const submitAction = () => {
      if (requestMode.value) {
        console.log('Enviar solicitud de firmas');
        return;
      }
      signMode.value = 'coordinates';
      openSignCertModal();
    };

    const submitTokenAction = async () => {
      if (requestMode.value) return;
      const previewFields = await buildTokenPreviewFields();
      if (!previewFields.length) {
        signMode.value = 'coordinates';
        uploadError.value = currentSignatureMarker.value
          ? `No se encontraron coincidencias del token ${currentSignatureMarker.value} en el PDF.`
          : 'El usuario actual no tiene token de firma configurado.';
        return;
      }
      signMode.value = 'token';
      uploadError.value = '';
      signError.value = '';
      openSignCertModal();
    };

    const selectField = (fieldId, preview = false) => {
      lastFieldId.value = fieldId;
      selectedField.value = visibleFields.value.find((item) => item.id === fieldId) || null;
      if (preview) {
        const field = visibleFields.value.find((item) => item.id === fieldId);
        if (field && field.page !== currentPage.value) {
          renderPage(field.page);
        }
        if (field) {
          renderFieldPreview(field);
        }
      }
    };



    const goToFieldLocation = async (fieldId) => {
      const field = visibleFields.value.find((item) => item.id === fieldId);
      if (!field) return;

      if (deleteModalInstance) {
        deleteModalInstance.hide();
      }

      if (field.page !== currentPage.value) {
        await renderPage(field.page);
      }

      // Add a slight delay to ensure DOM is updated after renderPage
      nextTick(() => {
        setTimeout(() => {
          const boxEl = document.querySelector(`[data-field-id="${fieldId}"]`);
          /* EL RESALTADO SALE DEL ESTADO, NO DEL DOM (2026-08-20, F8).
             Antes se anadian cuatro utilidades con `classList.add` —dos de ellas de color— y se
             quitaban a los 1500 ms. Eso es color viviendo en JavaScript en su peor forma: ni
             `check-orphan-classes` puede verlo, porque no hay ningun atributo que leer.
             `SignatureBox` YA tiene `isActive`, atado a `lastFieldId`, y pinta el mismo anillo. */
          selectField(fieldId);
          boxEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
    };

    const removeField = (fieldId) => {
      fields.value = fields.value.filter((field) => field.id !== fieldId);
      if (lastFieldId.value === fieldId) {
        lastFieldId.value = fields.value[fields.value.length - 1]?.id || null;
      }
      if (selectedField.value?.id === fieldId) {
        selectedField.value = null;
        if (previewCanvas.value) {
          const ctx = previewCanvas.value.getContext('2d');
          ctx?.clearRect(0, 0, previewCanvas.value.width, previewCanvas.value.height);
        }
      }
    };

    const formatCoord = (value) => {
      return Number(value).toFixed(2);
    };

    const renderFieldPreview = (field) => {
      if (!previewCanvas.value || !pdfDoc) return;
      pdfDoc.getPage(field.page).then((page) => {
        const previewCtx = previewCanvas.value.getContext('2d');
        if (!previewCtx) return;
        const fullViewport = page.getViewport({ scale: 1 });
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = fullViewport.width;
        tempCanvas.height = fullViewport.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        page.render({ canvasContext: tempCtx, viewport: fullViewport }).promise.then(() => {
          const padding = 40;
          const rawWidth = Math.max(1, field.x2 - field.x1);
          const rawHeight = Math.max(1, field.y1 - field.y2);
          const cropLeft = Math.max(0, field.x1 - padding);
          const cropTop = Math.max(0, fullViewport.height - field.y1 - padding);
          const cropWidth = Math.min(fullViewport.width - cropLeft, rawWidth + padding * 2);
          const cropHeight = Math.min(fullViewport.height - cropTop, rawHeight + padding * 2);
          const maxWidth = 420;
          const scale = maxWidth / cropWidth;
          previewCanvas.value.width = Math.round(cropWidth * scale);
          previewCanvas.value.height = Math.round(cropHeight * scale);
          previewCtx.clearRect(0, 0, previewCanvas.value.width, previewCanvas.value.height);
          previewCtx.drawImage(
            tempCanvas,
            cropLeft,
            cropTop,
            cropWidth,
            cropHeight,
            0,
            0,
            previewCanvas.value.width,
            previewCanvas.value.height
          );
        });
      });
    };

    const goBackToStart = () => {
      if (
        props.embedded
        && !isEmbeddedWorkflowMode.value
        && ['sign', 'request'].includes(normalizedLauncherMode.value)
      ) {
        emit('request-close');
        return;
      }
      if (isEmbeddedWorkflowMode.value) {
        uploadedFiles.value = [];
        uploadError.value = '';
        fields.value = [];
        tokenPreviewFields.value = [];
        lastSelection.value = null;
        lastFieldId.value = null;
        fieldCounter.value = 1;
        activeBox = null;
        clearAllBoxes();
        selectedField.value = null;
        filterPage.value = 'all';
        selectedCertificateId.value = null;
        availableCertificates.value = [];
        certPassword.value = '';
        signMode.value = 'coordinates';
        signError.value = '';
        signResultMessage.value = '';
        signSuccess.value = false;
        signedMinioPath.value = '';
        signedFieldsCount.value = 0;
        resetPdfState();
        workflowPdfStatus.value = {
          type: workflowSignContext.value?.preloadPdfPath ? 'info' : 'error',
          message: workflowSignContext.value?.preloadPdfPath
            ? 'La sesión quedó lista para reintentar la carga del PDF vinculado.'
            : 'Este flujo no tiene un PDF vinculado para precargar.'
        };
        return;
      }
      resetToStart();
    };

    const openDeleteModal = () => {
      if (!deleteModal.value?.el) return;
      deleteModalInstance = Modal.getOrCreateInstance(deleteModal.value.el);
      deleteModalInstance.show();
    };

    const requestDeleteField = (fieldId) => {
      pendingDeleteFieldId.value = fieldId;
      if (!confirmDeleteModal.value?.el) return;
      confirmDeleteModalInstance = Modal.getOrCreateInstance(confirmDeleteModal.value.el);
      confirmDeleteModalInstance.show();
    };

    const confirmDeleteField = () => {
      if (!pendingDeleteFieldId.value) return;
      removeField(pendingDeleteFieldId.value);
      pendingDeleteFieldId.value = null;
      confirmDeleteModalInstance?.hide();
    };

    const openAssignSignerModal = () => {
      if (!assignSignerModal.value?.el) return;
      signerInput.value = '';
      userSearchError.value = '';
      selectedSigner.value = null;
      statusFilter.value = 'all';
      signerUnitTypeFilter.value = '';
      signerUnitFilter.value = '';
      signerCargoFilter.value = '';
      signerUnitOptions.value = [];
      loadSignerFilterOptions();
      assignSignerModalInstance = Modal.getOrCreateInstance(assignSignerModal.value.el);
      assignSignerModalInstance.show();
      fetchUsers('');
    };

    const clearSignerFilters = () => {
      signerInput.value = '';
      statusFilter.value = 'all';
      signerUnitTypeFilter.value = '';
      signerUnitFilter.value = '';
      signerCargoFilter.value = '';
      signerUnitOptions.value = [];
      fetchUsers('');
    };

  const confirmSigner = () => {
      if (!activeBox || !lastSelection.value) {
        userSearchError.value = 'Selecciona un area de firma antes de asignar.';
        return;
      }
      if (!selectedSigner.value) {
        userSearchError.value = 'Selecciona un usuario de la lista.';
        return;
      }
      saveFieldWithSigner(selectedSigner.value);
      assignSignerModalInstance?.hide();
    };

  const getAuthHeaders = () => {
      const token = localStorage.getItem('token');
      return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const reconcileEmbeddedWorkflowSignAfterError = async (fallbackContext = null) => {
      const embeddedMode = Boolean(
        fallbackContext?.embedded
        ?? isEmbeddedWorkflowMode.value
      );
      if (!embeddedMode) return null;

      const documentVersionId = Number(
        fallbackContext?.documentVersionId
        ?? workflowSignContext.value?.documentVersionId
        ?? 0
      );
      const signatureRequestId = Number(
        fallbackContext?.signatureRequestId
        ?? workflowSignContext.value?.signatureRequestId
        ?? 0
      );
      if (!documentVersionId || !signatureRequestId) {
        return null;
      }

      try {
        const response = await fetch(API_ROUTES.SIGN_DOCUMENT_SIGNATURE_FLOW(documentVersionId), {
          headers: getAuthHeaders()
        });
        const snapshot = await readResponsePayload(response);
        if (!response.ok) {
          return null;
        }

        const request = Array.isArray(snapshot?.signatureRequests)
          ? snapshot.signatureRequests.find((item) => Number(item?.id || 0) === signatureRequestId)
          : null;

        const requestStatusCode = String(request?.requestStatusCode || '').trim().toLowerCase();
        const completed =
          requestStatusCode === 'completado'
          || requestStatusCode === 'completed'
          || Boolean(request?.respondedAt);
        const currentStepOrder = Number(snapshot?.currentSignatureStepOrder || 0);
        const requestStepOrder = Number(request?.stepOrder || 0);
        const workflowAdvanced = Boolean(currentStepOrder && requestStepOrder && currentStepOrder > requestStepOrder);

        if (!completed && !workflowAdvanced) {
          return null;
        }

        return {
          documentVersionId,
          signatureRequestId,
          signedPath: '',
          workflow: snapshot,
          message: 'La firma del flujo se registró correctamente.'
        };
      } catch {
        return null;
      }
    };

    const loadCertificates = async () => {
      isLoadingCertificates.value = true;
      try {
        const response = await fetch(API_ROUTES.USERS_MY_CERTIFICATES, {
          headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'No se pudieron cargar los certificados.');
        }
        availableCertificates.value = Array.isArray(data?.certificates) ? data.certificates : [];
        const selected = availableCertificates.value.find((item) => item.id === selectedCertificateId.value);
        const defaultCertificate =
          availableCertificates.value.find((item) => item.is_default) ||
          availableCertificates.value[0] ||
          null;
        selectedCertificateId.value = selected?.id || defaultCertificate?.id || null;
      } catch (error) {
        signError.value = resolveUiErrorMessage(error, 'No se pudieron cargar los certificados.');
        availableCertificates.value = [];
        selectedCertificateId.value = null;
      } finally {
        isLoadingCertificates.value = false;
      }
    };

    const handleCertificatesLoaded = (certificates) => {
      availableCertificates.value = Array.isArray(certificates) ? certificates : [];
      const selected = availableCertificates.value.find((item) => item.id === selectedCertificateId.value);
      if (!selected) {
        const defaultCertificate =
          availableCertificates.value.find((item) => item.is_default) ||
          availableCertificates.value[0] ||
          null;
        selectedCertificateId.value = defaultCertificate?.id || null;
      }
    };

    const handleCertificateSelected = (certificate) => {
      selectedCertificateId.value = certificate?.id || null;
    };

    const ensureCurrentUserProfile = async () => {
      const hasSignatureToken = Boolean(
        currentUser.value?.signatureMarker
        || currentUser.value?.signatureToken
        || currentUser.value?.token
      );
      if (hasSignatureToken) {
        return currentUser.value;
      }
      try {
        const response = await fetch(API_ROUTES.USERS_ME, {
          headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.user) {
          throw new Error(data?.message || 'No se pudo refrescar el perfil del usuario.');
        }
        currentUser.value = data.user;
        localStorage.setItem('user', JSON.stringify(data.user));
        if (!stampText.value && currentUser.value) {
          stampText.value = `${currentUser.value.first_name ?? ''} ${currentUser.value.last_name ?? ''}`.trim();
        }
        return currentUser.value;
      } catch (error) {
        console.error('No se pudo refrescar el perfil del usuario para la firma:', error);
        return currentUser.value;
      }
    };

    const openCertificatesManagerModal = () => {
      if (!certificatesManagerModal.value?.el) return;
      certificatesManagerModalInstance = Modal.getOrCreateInstance(certificatesManagerModal.value.el);
      certificatesManagerModalInstance.show();
      nextTick(() => {
        certificatesPanelRef.value?.loadCertificates?.();
      });
    };

    const openSignCertModal = async () => {
      signError.value = '';
      signResultMessage.value = '';
      signSuccess.value = false;
      if (isEmbeddedWorkflowMode.value) {
        allowUntrustedSigner.value = true;
      }
      await loadCertificates();
      if (!signCertModal.value?.el) return;
      signCertModalInstance = Modal.getOrCreateInstance(signCertModal.value.el);
      signCertModalInstance.show();
    };

    const prepareMultiBatchStart = async (payload) => {
      multiBatchRequest.value = payload;
      signError.value = '';
      signResultMessage.value = '';
      signSuccess.value = false;
      await openSignCertModal();
    };

    const stopMultiBatchPolling = () => {
      if (multiBatchPollTimer) {
        clearTimeout(multiBatchPollTimer);
        multiBatchPollTimer = null;
      }
    };

    const pollMultiBatchStatus = async (jobId) => {
      stopMultiBatchPolling();
      try {
        const response = await fetch(API_ROUTES.SIGN_BATCH_STATUS(jobId), {
          headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || data?.message || 'No se pudo consultar el lote.');
        }
        activeMultiBatchJob.value = data;
        if (['completed', 'error'].includes(data.status)) {
          emit('batch-finished', data);
        }
        if (!['completed', 'error'].includes(data.status)) {
          multiBatchPollTimer = setTimeout(() => {
            pollMultiBatchStatus(jobId);
          }, 1500);
        }
      } catch (error) {
        signError.value = resolveUiErrorMessage(error, 'No se pudo consultar el avance de la firma masiva.');
      }
    };

    const downloadMultiBatch = async () => {
      if (!activeMultiBatchJobId.value) {
        signError.value = 'No hay un lote disponible para descargar.';
        return;
      }
      try {
        isDownloadingMultiBatch.value = true;
        const response = await fetch(API_ROUTES.SIGN_BATCH_DOWNLOAD(activeMultiBatchJobId.value), {
          headers: getAuthHeaders()
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || data?.message || 'No se pudo descargar el lote firmado.');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `firmas-lote-${activeMultiBatchJobId.value}.zip`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        signError.value = resolveUiErrorMessage(error, 'No se pudo descargar el lote firmado.');
      } finally {
        isDownloadingMultiBatch.value = false;
      }
    };

    const confirmSign = async () => {
      if (multiBatchRequest.value) {
        if (!selectedCertificateId.value) {
          signError.value = 'Debes seleccionar un certificado.';
          return;
        }
        if (!certPassword.value) {
          signError.value = 'Debes ingresar la contraseña del certificado.';
          return;
        }
        if (!stampText.value.trim()) {
          signError.value = 'Debes indicar el texto del sello.';
          return;
        }

        isSigning.value = true;
        isStartingMultiBatch.value = true;
        signError.value = '';
        try {
          const formData = new FormData();
          multiBatchRequest.value.documents.forEach((doc) => {
            formData.append('pdf', doc.file);
          });
          formData.append('certificate_id', String(selectedCertificateId.value));
          formData.append('password', certPassword.value);
          formData.append('stampText', stampText.value.trim());
          formData.append('sign_mode', multiBatchRequest.value.mode === 'token' ? 'token' : 'coordinates');
          if (multiBatchRequest.value.mode === 'shared-coordinates' && multiBatchRequest.value.sharedFields?.length) {
            formData.append('fields', JSON.stringify(
              multiBatchRequest.value.sharedFields.map((field) => ({
                page: field.page,
                pageReference: field.pageReference || 'start',
                pageValue: field.pageValue || field.page,
                pageOffset: Number(field.pageOffset || 0),
                x: Math.round(field.x1),
                y: Math.round(field.y1)
              }))
            ));
          }
          if (multiBatchRequest.value.mode === 'per-document' && multiBatchRequest.value.documentFields?.length) {
            formData.append('document_fields', JSON.stringify(
              multiBatchRequest.value.documentFields.map((doc) => ({
                id: doc.id,
                name: doc.name,
                fields: Array.isArray(doc.fields)
                  ? doc.fields.map((field) => ({
                      page: field.page,
                      x: Math.round(field.x1),
                      y: Math.round(field.y1)
                    }))
                  : []
              }))
            ));
          }
          formData.append('document_contexts', JSON.stringify(
            multiBatchRequest.value.documents.map((doc) => ({
              id: doc.id,
              name: doc.name,
              relativePath: doc.relativePath || doc.name,
              metadata: {
                signatureRequestId: Number(doc?.metadata?.signatureRequestId || 0) || null,
                documentVersionId: Number(doc?.metadata?.documentVersionId || 0) || null,
                documentId: Number(doc?.metadata?.documentId || 0) || null,
                processName: doc?.metadata?.processName || '',
                unitLabel: doc?.metadata?.unitLabel || '',
                termName: doc?.metadata?.termName || '',
                termYear: doc?.metadata?.termYear || '',
                termTypeName: doc?.metadata?.termTypeName || '',
                stepName: doc?.metadata?.stepName || '',
                requestedAt: doc?.metadata?.requestedAt || ''
              }
            }))
          ));
          formData.append('allow_untrusted_signer', allowUntrustedSigner.value ? 'true' : 'false');

          const response = await fetch(API_ROUTES.SIGN_BATCH_START, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || data?.message || `Error del servidor (${response.status})`);
          }
          activeMultiBatchJobId.value = data.jobId || '';
          activeMultiBatchJob.value = {
            jobId: data.jobId,
            status: 'processing',
            total: Number(data.total || multiBatchRequest.value.documents.length),
            processed: 0,
            successCount: 0,
            failedCount: 0,
            results: multiBatchRequest.value.documents.map((doc) => ({
              fileName: doc.name,
              status: 'pending'
            }))
          };
          signCertModalInstance?.hide();
          await pollMultiBatchStatus(activeMultiBatchJobId.value);
          multiBatchRequest.value = null;
        } catch (error) {
          signError.value = resolveUiErrorMessage(error, 'No se pudo iniciar la firma masiva.');
        } finally {
          isSigning.value = false;
          isStartingMultiBatch.value = false;
        }
        return;
      }

      if (signMode.value === 'coordinates' && !fields.value.length) {
        signError.value = 'Agrega al menos un campo de firma antes de continuar.';
        return;
      }
      if (signMode.value === 'token' && !currentSignatureMarker.value) {
        signError.value = 'El usuario actual no tiene token de firma configurado.';
        return;
      }
      if (!selectedCertificateId.value) {
        signError.value = 'Debes seleccionar un certificado.';
        return;
      }
      if (!certPassword.value) {
        signError.value = 'Debes ingresar la contraseña del certificado.';
        return;
      }
      if (!stampText.value.trim()) {
        signError.value = 'Debes indicar el texto del sello.';
        return;
      }
      if (!uploadedFiles.value?.[0]?.content) {
        signError.value = 'Debes cargar un PDF antes de firmar.';
        return;
      }

      isSigning.value = true;
      signError.value = '';
      const embeddedWorkflowContext = {
        embedded: props.embedded && isEmbeddedWorkflowMode.value,
        documentVersionId: Number(workflowSignContext.value?.documentVersionId || 0),
        signatureRequestId: Number(workflowSignContext.value?.signatureRequestId || 0)
      };
      try {
        const allFields = fields.value.map((field) => ({
          page: field.page,
          x: Math.round(field.x1),
          y: Math.round(field.y1)
        }));
        const formData = new FormData();
        formData.append('pdf', uploadedFiles.value[0].content);
        formData.append('certificate_id', String(selectedCertificateId.value));
        formData.append('password', certPassword.value);
        formData.append('stampText', stampText.value.trim());
        formData.append('sign_mode', signMode.value);
        if (signMode.value === 'coordinates') {
          formData.append('fields', JSON.stringify(allFields));
        } else {
          formData.append('token', currentSignatureMarker.value);
        }
        if (workflowSignContext.value?.signatureRequestId) {
          formData.append('signature_request_id', String(workflowSignContext.value.signatureRequestId));
        }
        if (workflowSignContext.value?.documentVersionId) {
          formData.append('document_version_id', String(workflowSignContext.value.documentVersionId));
        }
        formData.append('allow_untrusted_signer', allowUntrustedSigner.value ? 'true' : 'false');

        const response = await fetch(API_ROUTES.SIGN, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData
        });
        const data = await readResponsePayload(response);
        if (!response.ok) {
          throw {
            error: data?.error || '',
            details: data?.details || '',
            message: data?.message || `Error del servidor (${response.status})`,
            status: response.status
          };
        }
        const signedCount = Number(data.fieldsCount || (signMode.value === 'coordinates' ? allFields.length : 0));
        const validationWarning =
          data?.validation?.warning
          || data?.validation?.details
          || '';
        signError.value = '';
        signSuccess.value = true;
        signResultMessage.value = validationWarning && data?.validation?.warningAccepted
          ? `El documento fue firmado correctamente con ${signedCount} campo(s). Advertencia: ${validationWarning}`
          : `El documento fue firmado correctamente con ${signedCount} campo(s).`;
        signedMinioPath.value = data.signedPath;
        signedFieldsCount.value = signedCount;
        if (props.embedded && isEmbeddedWorkflowMode.value) {
          emit('workflow-signed', {
            documentVersionId: embeddedWorkflowContext.documentVersionId || null,
            signatureRequestId: embeddedWorkflowContext.signatureRequestId || null,
            signedPath: data.signedPath || '',
            workflow: data.workflow || null,
            message: signResultMessage.value,
          });
          return;
        }
        signCertModalInstance?.hide();
        signResultModalInstance = Modal.getOrCreateInstance(signResultModal.value.el);
        signResultModalInstance.show();
      } catch (error) {
        const reconciledWorkflow = await reconcileEmbeddedWorkflowSignAfterError(embeddedWorkflowContext);
        if (reconciledWorkflow) {
          signError.value = '';
          signSuccess.value = true;
          signResultMessage.value = reconciledWorkflow.message;
          emit('workflow-signed', reconciledWorkflow);
          return;
        }
        signSuccess.value = false;
        signError.value = resolveUiErrorMessage(error, 'No se pudo firmar el documento.');
        signResultMessage.value = signError.value;
        signCertModalInstance?.hide();
        signResultModalInstance = Modal.getOrCreateInstance(signResultModal.value.el);
        signResultModalInstance.show();
      } finally {
        isSigning.value = false;
      }
    };

    const viewSignedDocument = async () => {
      if (!signedMinioPath.value) return;
      try {
        const response = await fetch(`${API_ROUTES.SIGN}/download?path=${encodeURIComponent(signedMinioPath.value)}`, {
          headers: getAuthHeaders()
        });
        if (!response.ok) {
          throw new Error('No se pudo visualizar el documento firmado.');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        signError.value = resolveUiErrorMessage(error, 'No se pudo visualizar el documento firmado.');
      }
    };

    const downloadSignedDocument = async () => {
      if (!signedMinioPath.value) return;
      try {
        const response = await fetch(`${API_ROUTES.SIGN}/download?path=${encodeURIComponent(signedMinioPath.value)}`, {
          headers: getAuthHeaders()
        });
        if (!response.ok) {
          throw new Error('No se pudo descargar el documento firmado.');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'documento_firmado.pdf';
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        signError.value = resolveUiErrorMessage(error, 'No se pudo descargar el documento firmado.');
      }
    };

    const resetToStart = () => {
      uploadedFiles.value = [];
      uploadError.value = '';
      fields.value = [];
      tokenPreviewFields.value = [];
      lastSelection.value = null;
      lastFieldId.value = null;
      fieldCounter.value = 1;
      activeBox = null;
      clearAllBoxes();
      selectedField.value = null;
      filterPage.value = 'all';
      signerInput.value = '';
      statusFilter.value = 'all';
      signerUnitTypeFilter.value = '';
      signerUnitFilter.value = '';
      signerCargoFilter.value = '';
      signerUnitTypeOptions.value = [];
      signerUnitOptions.value = [];
      signerCargoOptions.value = [];
      userResults.value = [];
      userSearchError.value = '';
      selectedSigner.value = null;
      selectedCertificateId.value = null;
      availableCertificates.value = [];
      certPassword.value = '';
      signMode.value = 'coordinates';
      signError.value = '';
      signResultMessage.value = '';
      signSuccess.value = false;
      signedMinioPath.value = '';
      signedFieldsCount.value = 0;
      validationFile.value = null;
      validationCedula.value = '';
      isValidatingDocument.value = false;
      validationError.value = '';
      validationResult.value = null;
      activeMultiBatchJob.value = null;
      activeMultiBatchJobId.value = '';
      isStartingMultiBatch.value = false;
      isDownloadingMultiBatch.value = false;
      multiBatchRequest.value = null;
      multiSignerSeedDocuments.value = [];
      allowManualMultiSignerUpload.value = true;
      enableMultiSignerDocumentFilters.value = false;
      workflowSignContext.value = null;
      workflowPdfStatus.value = { type: 'info', message: '' };
      stopMultiBatchPolling();
      pendingDeleteFieldId.value = null;
      workspaceMode.value = 'single';
      resetPdfState();
    };

    const initializeWorkflowSignatureSession = (payload = {}) => {
      allowUntrustedSigner.value = true;
      workflowSignContext.value = {
        signatureRequestId: payload.signatureRequestId ? Number(payload.signatureRequestId) : null,
        documentVersionId: payload.documentVersionId ? Number(payload.documentVersionId) : null,
        taskItemId: payload.taskItemId ? Number(payload.taskItemId) : null,
        processDefinitionId: payload.processDefinitionId ? Number(payload.processDefinitionId) : null,
        documentTitle: payload.documentTitle || '',
        documentVersionLabel: payload.documentVersionLabel || '',
        preloadPdfPath: payload.preloadPdfPath || ''
      };
      workflowPdfStatus.value = {
        type: 'info',
        message: payload.preloadPdfPath
          ? 'Preparando PDF vinculado del entregable...'
          : 'Este entregable todavía no tiene un PDF vinculado para precargar.'
      };
      signError.value = '';
      signResultMessage.value = '';
      signSuccess.value = false;
      signedMinioPath.value = '';
      uploadError.value = '';
      multiBatchRequest.value = null;
      activeMultiBatchJob.value = null;
      activeMultiBatchJobId.value = '';
      requestMode.value = false;
      workspaceMode.value = 'single';
      if (payload.preloadPdfPath) {
        loadPdfFromRemotePath(payload.preloadPdfPath, 'sign');
      }
      multiSignerSeedFiles.value = [];
      multiSignerSeedDocuments.value = [];
      allowManualMultiSignerUpload.value = true;
      enableMultiSignerDocumentFilters.value = false;
    };

    const retryWorkflowPdfLoad = () => {
      uploadError.value = '';
      signError.value = '';
      signResultMessage.value = '';
      if (workflowSignContext.value?.preloadPdfPath) {
        loadPdfFromRemotePath(workflowSignContext.value.preloadPdfPath, 'sign');
      }
    };

    const openMultiSignerWithFiles = (files = [], options = {}) => {
      return onAddFiles(files, 'multi', options);
    };

    const openSingleFlowWithFiles = (files = [], mode = 'sign') => {
      return onAddFiles(files, mode);
    };

    const multiPrevDocument = () => multiSignerPanelRef.value?.prevDocument?.();
    const multiNextDocument = () => multiSignerPanelRef.value?.nextDocument?.();
    const multiPrevPage = () => multiSignerPanelRef.value?.prevPage?.();
    const multiNextPage = () => multiSignerPanelRef.value?.nextPage?.();
    const multiGoToDocument = (value) => multiSignerPanelRef.value?.goToDocument?.(value);
    const multiGoToPage = (value) => multiSignerPanelRef.value?.goToPage?.(value);

    defineExpose({
      resetToStart,
      initializeWorkflowSignatureSession,
      openMultiSignerWithFiles,
      openSingleFlowWithFiles,
      multiPrevDocument,
      multiNextDocument,
      multiPrevPage,
      multiNextPage,
      multiGoToDocument,
      multiGoToPage
    });

  </script>
