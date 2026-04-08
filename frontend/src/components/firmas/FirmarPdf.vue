<template>
  <div :class="rootClasses">
    <div v-if="pdfReady" class="flex flex-col gap-4 mb-6 animate-fade-in relative z-20">
      
      <!-- Top Row: Back, Workflow Info & Settings -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl border border-slate-200/80 shadow-sm p-3 sm:p-4 rounded-2xl">
        <div class="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            class="flex-shrink-0 flex items-center justify-center p-2 sm:p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
            title="Regresar"
            @click="goBackToStart"
          >
            <IconArrowLeft class="w-5 h-5" />
          </button>

          <!-- Status / Action Area -->
          <div v-if="workflowSignContext" class="flex flex-col pl-1 sm:pl-0 border-l-2 sm:border-l-0 border-sky-200">
            <span class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-sky-600 mb-0.5">Sesión Activa</span>
            <div class="text-xs sm:text-sm font-semibold text-slate-800 truncate max-w-[180px] sm:max-w-xs md:max-w-md">
              {{ workflowSignContext.documentTitle || `Documento #${workflowSignContext.documentVersionId}` }}
              <span class="text-slate-400 font-normal">· v{{ workflowSignContext.documentVersionLabel || workflowSignContext.documentVersionId }}</span>
            </div>
            <div v-if="workflowPdfStatus.message" class="text-[10px] sm:text-xs mt-0.5" :class="workflowPdfStatus.type === 'error' ? 'text-rose-600' : workflowPdfStatus.type === 'success' ? 'text-emerald-600' : 'text-sky-600'">
              {{ workflowPdfStatus.message }}
            </div>
          </div>
          <div v-else class="text-sm sm:text-base font-bold text-slate-800 border-l sm:border-l-0 pl-3 sm:pl-0 border-slate-200">
            Firma de Documento
          </div>
        </div>

        <!-- Right Side: Change PDF & Mode Selector -->
        <div class="flex items-center flex-wrap sm:flex-nowrap gap-2 sm:gap-3">
          <button 
            type="button"
            @click="showSignaturesModal = true"
            class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 border border-sky-200/60 shadow-sm"
          >
            <IconList class="w-4 h-4" />
            <span class="hidden sm:inline">Ver campos de firma ({{ visibleFields.length }})</span>
            <span class="sm:hidden">{{ visibleFields.length }}</span>
          </button>
          
          <div class="h-8 w-px bg-slate-200 hidden sm:block"></div>
          <PdfDropField
            variant="inline"
            title=""
            action-text="Cambiar PDF"
            help-text=""
            :icon="IconFileUpload"
            input-id="change-pdf-input"
            @files-selected="onPdfDropFiles($event, requestMode ? 'request' : 'sign')"
            class="change-pdf-compact w-full sm:w-auto"
          />
        </div>
      </div>

      <!-- Action & Pagination Row (Sticky on Mobile, Regular on Desktop) -->
      <div class="fixed bottom-4 left-4 right-4 lg:static lg:bottom-auto lg:left-auto lg:right-auto z-50 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 p-3 lg:p-0 bg-white/90 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border lg:border-0 border-slate-200/80 rounded-[1.25rem] lg:rounded-none shadow-2xl shadow-sky-900/10 lg:shadow-none animate-slide-up lg:animate-none">
        
        <!-- Pagination controls -->
        <div class="flex items-center justify-between sm:justify-start gap-1 sm:gap-2 bg-slate-800 lg:bg-white text-white lg:text-slate-800 p-1.5 rounded-xl shadow-inner lg:shadow-sm border border-slate-700 lg:border-slate-200 w-full sm:w-auto">
          <button @click="prevPageBtn" class="flex items-center justify-center p-1.5 sm:p-2 rounded-lg text-slate-300 lg:text-slate-500 hover:text-white lg:hover:text-slate-800 hover:bg-slate-700 lg:hover:bg-slate-100 transition-colors">
            <IconChevronLeft class="w-5 h-5 sm:w-6 sm:h-6" stroke-width="2" />
          </button>
          <div class="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-2 font-semibold text-xs sm:text-sm">
            <span class="hidden sm:inline">Pág</span>
            <input
              v-model="pageInput"
              class="w-10 sm:w-12 px-1 text-center bg-slate-900 lg:bg-slate-50 border border-slate-600 lg:border-slate-300 rounded-md py-1 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
              type="number" min="1" :max="totalPages"
              @keyup.enter="goToPage"
            />
            <span class="text-slate-400 lg:text-slate-500 whitespace-nowrap">de {{ totalPages }}</span>
          </div>
          <button @click="nextPageBtn" class="flex items-center justify-center p-1.5 sm:p-2 rounded-lg text-slate-300 lg:text-slate-500 hover:text-white lg:hover:text-slate-800 hover:bg-slate-700 lg:hover:bg-slate-100 transition-colors">
            <IconChevronRight class="w-5 h-5 sm:w-6 sm:h-6" stroke-width="2" />
          </button>
        </div>

        <!-- Primary Actions -->
        <div class="flex items-center w-full sm:w-auto justify-end gap-2 sm:gap-3">
          <button
            v-if="signMode !== 'token'"
            type="button"
            class="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-rose-600 bg-rose-50/80 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 font-bold text-xs sm:text-sm transition-all shadow-sm"
            @click="openDeleteModal"
            title="Eliminar PDF actual"
          >
            <IconTrash class="w-4 h-4 sm:w-5 sm:h-5" stroke-width="2" />
            <span class="hidden sm:inline">Eliminar</span>
          </button>

          <button
            v-if="!requestMode"
            type="button"
            class="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-indigo-700 bg-indigo-50/80 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 font-bold text-xs sm:text-sm transition-all shadow-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
            @click="submitTokenAction"
          >
            <IconKey class="w-4 h-4 sm:w-5 sm:h-5" stroke-width="2" />
            <span class="whitespace-nowrap">Por Token</span>
          </button>

          <button
            type="button"
            class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 active:scale-95 transform text-white font-bold text-xs sm:text-sm shadow-md shadow-sky-500/25 hover:shadow-lg hover:shadow-sky-500/40 transition-all border border-sky-600/50 focus:ring-2 focus:ring-sky-500/30 outline-none"
            @click="submitAction"
          >
            <IconSignature v-if="!requestMode" class="w-5 h-5" stroke-width="2" />
            <IconSend v-else class="w-5 h-5" stroke-width="2" />
            <span class="whitespace-nowrap">{{ requestMode ? 'Enviar Solicitud' : 'Firmar Documento' }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="workspaceMode === 'multi'" class="mt-4">
      <MultiSignerPanel
        :batch-job="activeMultiBatchJob"
        :is-batch-submitting="isStartingMultiBatch"
        :is-downloading-batch="isDownloadingMultiBatch"
        @back="closeMultiSigner"
        @download-batch="downloadMultiBatch"
        @start-batch="prepareMultiBatchStart"
      />
    </div>

    <div v-else-if="!pdfReady" class="mt-4 mb-10 overflow-hidden animate-fade-in">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-slate-900 tracking-tight">Empezar a firmar</h2>
        <p class="text-slate-500 mt-2 text-base max-w-2xl">
          Selecciona un documento PDF para comenzar a firmar individualmente, o explora las herramientas avanzadas para envío, validación y firma masiva.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- MAIN ACTION: Firmar individual (Colspan 8) -->
        <div class="lg:col-span-8 group relative bg-white border border-slate-200 hover:border-sky-300 rounded-3xl p-8 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-center min-h-[320px]">
          <div class="absolute -right-24 -top-24 w-72 h-72 bg-sky-50 rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-opacity"></div>
          
          <div class="relative z-10 flex flex-col items-center text-center">
            <div class="w-16 h-16 bg-sky-50 border border-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-3">
              <IconSignature class="w-8 h-8" stroke-width="1.5" />
            </div>
            <h3 class="text-2xl font-bold text-slate-800 mb-2">Firmar un documento</h3>
            <p class="text-slate-500 mb-8 max-w-md">Arrastra y suelta tu archivo PDF aquí o explora tus archivos locales para firmarlo al instante.</p>
            
            <div class="w-full max-w-lg mx-auto">
              <PdfDropField
                variant="card"
                action-text="Examinar archivos"
                help-text="Solo se admiten documentos en formato .pdf"
                input-id="sign-pdf-input"
                @files-selected="onPdfDropFiles($event, 'sign')"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- SECONDARY ACTIONS -->
        <div class="lg:col-span-4 flex flex-col gap-6">
          
          <!-- Multifirmador -->
          <div class="bg-white border border-slate-200 hover:border-indigo-300 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group cursor-pointer h-full flex flex-col justify-center" @click="openMultiSigner">
            <div class="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative z-10 flex items-start gap-4">
              <div class="flex-shrink-0 w-12 h-12 bg-indigo-50 text-indigo-600 rounded-[14px] flex items-center justify-center group-hover:scale-105 transition-transform">
                <IconFiles class="w-6 h-6" stroke-width="1.5" />
              </div>
              <div>
                <h4 class="text-lg font-bold text-slate-800 mb-1 group-hover:text-indigo-700 transition-colors">Firma múltiple</h4>
                <p class="text-sm text-slate-500 mb-3 leading-relaxed">Aplica tu firma sobre múltiples documentos en un solo paso.</p>
                <div class="inline-flex items-center text-sm font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  Abrir herramienta <IconChevronRight class="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          </div>

          <!-- Solicitar/Enviar -->
          <div class="bg-white border border-slate-200 border-dashed hover:border-emerald-300 rounded-3xl p-6 shadow-sm transition-all duration-300 relative group">
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-12 h-12 bg-emerald-50 text-emerald-600 rounded-[14px] flex items-center justify-center group-hover:scale-105 transition-transform">
                <IconSend class="w-6 h-6" stroke-width="1.5" />
              </div>
              <div class="flex-1 w-full">
                <h4 class="text-lg font-bold text-slate-800 mb-1 group-hover:text-emerald-700 transition-colors">Solicitar firmas</h4>
                <p class="text-sm text-slate-500 mb-3 leading-relaxed">Carga un PDF y envíalo para que otros lo firmen.</p>
                <div class="w-full">
                  <PdfDropField
                    variant="inline"
                    action-text="Subir PDF"
                    input-id="request-pdf-input"
                    @files-selected="onPdfDropFiles($event, 'request')"
                    class="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      <!-- BOTTOM ROW / TERTIARY ACTIONS -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        
        <!-- Validar Documento -->
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row items-center sm:items-start gap-5 group">
           <div class="flex-shrink-0 w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <IconShieldCheck class="w-7 h-7" stroke-width="1.5" />
           </div>
           <div class="flex-1 w-full text-center sm:text-left">
             <h4 class="text-lg font-bold text-slate-800 mb-1">Validar un documento</h4>
             <p class="text-sm text-slate-500 mb-4">Verifica la integridad y validez de las firmas contenidas en un documento PDF.</p>
             <PdfDropField
                variant="inline"
                action-text="Cargar documento a validar"
                input-id="validate-pdf-input"
                @files-selected="onPdfDropFiles($event, 'validate')"
              />
           </div>
        </div>

        <!-- Buscar BD -->
        <div class="bg-slate-50/50 border border-slate-200 border-dashed rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-5 opacity-70 cursor-not-allowed">
           <div class="flex-shrink-0 w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center">
              <IconSearch class="w-7 h-7" stroke-width="1.5" />
           </div>
           <div class="text-center sm:text-left">
             <div class="inline-flex px-2.5 py-0.5 rounded shadow-sm border border-slate-200/60 text-[10px] font-bold bg-white text-slate-500 uppercase tracking-wider mb-2">Próximamente</div>
             <h4 class="text-lg font-bold text-slate-600 mb-1">Buscar en base de datos</h4>
             <p class="text-sm text-slate-500 leading-relaxed">Selecciona solicitudes pendientes directamente desde el sistema, sin archivos locales.</p>
           </div>
        </div>
      </div>
      
      <div v-if="uploadError" class="flex animate-fade-in items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl mt-6 text-sm font-medium shadow-sm">
        <div class="bg-white p-1 rounded-lg border border-rose-100 shadow-sm text-rose-600">
          <IconX class="w-5 h-5 flex-shrink-0" />
        </div>
        {{ uploadError }}
      </div>
    </div>

    <div v-else class="mt-4">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 lg:p-6 w-full max-h-[75vh] overflow-y-auto overflow-x-hidden relative pb-28 lg:pb-6">
        <div class="w-full relative flex justify-center" ref="colPdf">
          <div 
            class="relative shadow-sm border border-slate-200" 
            ref="pdfViewer"
            @mousemove="handleMouseMove"
            @mouseleave="handleMouseLeave"
          >
            <canvas ref="pdfCanvas" class="block cursor-crosshair relative z-10 w-full"></canvas>
            
            <!-- PREVIEW PREDEFINIDA BOX -->
            <div 
              v-if="isMouseOverPdf && !isHoveringField"
              class="absolute pointer-events-none z-20 border-2 border-sky-400 bg-sky-400/20 rounded-md backdrop-blur-[1px] transition-opacity duration-150 block shadow-[0_0_15px_rgba(56,189,248,0.3)]"
              :style="previewBoxStyle"
            >
               <div class="absolute inset-0 flex items-center justify-center opacity-70">
                 <IconSignature class="w-6 h-6 text-sky-700" />
               </div>
            </div>

            <div
              v-for="field in currentPageFields"
              :key="field.id"
              class="box saved-box"
              :class="[{ 'saved-box--active': field.id === lastFieldId }, 'cursor-move']"
              :data-field-id="field.id"
              :style="getFieldBoxStyle(field)"
              @mouseenter="isHoveringField = true"
              @mouseleave="isHoveringField = false"
              @mousedown.stop.prevent="startDragField(field, $event)"
              @click.stop="selectField(field.id)"
            >
              <div v-if="field.signer" class="saved-box-signer">
                {{ field.signer.first_name }} {{ field.signer.last_name }}
              </div>
              <div v-if="signMode !== 'token'" class="saved-box-actions" @mousedown.stop @click.stop>
                <BtnDelete message="Eliminar" @onpress="requestDeleteField(field.id)" />
                <button
                  type="button"
                  class="saved-box-action-btn saved-box-sign-btn"
                  title="Firmar documento"
                  aria-label="Firmar documento"
                  @click.stop="submitAction"
                >
                  <IconSignature class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AdminModalShell
      controlled
      :open="showSignaturesModal"
      @close="showSignaturesModal = false"
      labelled-by="signaturesModalLabel"
      title="Campos de firma"
      size="lg"
    >
      <div v-if="!visibleFields.length" class="text-center py-10 px-4">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-slate-100 text-slate-400 rounded-full mb-4">
          <IconSignature class="w-8 h-8" />
        </div>
        <h3 class="text-xl font-semibold text-slate-800 mb-2">No hay firmas</h3>
        <p class="text-slate-500 max-w-sm mx-auto leading-relaxed">
          Aún no has agregado ningún campo de firma al documento. Haz clic sobre el documento PDF para insertar una.
        </p>
      </div>

      <div v-else class="flex flex-col gap-3 py-2">
        <div
          v-for="field in visibleFields"
          :key="field.id"
          class="bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-300 hover:shadow-sm transition-all relative overflow-hidden group"
          :class="{ 'ring-2 ring-sky-500 border-transparent': field.id === lastFieldId }"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-12">
            
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-10 h-10 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center font-bold">
                <IconSignature class="w-5 h-5" />
              </div>
              <div>
                <div v-if="field.signer" class="font-semibold text-slate-800 text-base mb-0.5">
                  {{ field.signer.first_name }} {{ field.signer.last_name }}
                </div>
                <div v-else class="font-semibold text-slate-800 text-base mb-0.5">
                  Firmante no asignado
                </div>
                
                <div v-if="field.signer" class="text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span v-if="field.signer.email" class="inline-flex items-center gap-1">
                    <span class="font-medium text-slate-400">Email:</span> {{ field.signer.email }}
                  </span>
                  <span v-if="field.signer.cedula" class="inline-flex items-center gap-1">
                    <span class="font-medium text-slate-400">CI:</span> {{ field.signer.cedula }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-4 sm:border-l sm:border-slate-100 sm:pl-5">
              <div class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-center">
                <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Pág</span>
                <span class="block text-lg font-bold text-slate-800 leading-none mt-0.5">{{ field.page }}</span>
              </div>
              
              <div class="text-xs text-slate-500 grid grid-cols-2 gap-x-4 gap-y-1">
                <div>x/y: <span class="font-medium text-slate-700">{{ formatCoord(field.x1) }}, {{ formatCoord(field.y1) }}</span></div>
                <div>w/h: <span class="font-medium text-slate-700">{{ formatCoord(field.x2 - field.x1) }}, {{ formatCoord(field.y2 - field.y1) }}</span></div>
              </div>
            </div>
            
          </div>
          
          <button
            v-if="signMode !== 'token'"
            @click.stop="requestDeleteField(field.id)"
            class="absolute top-1/2 -translate-y-1/2 right-4 p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100 lg:opacity-100 focus:opacity-100 outline-none"
            title="Eliminar campo"
          >
            <IconTrash class="w-5 h-5" stroke-width="1.5" />
          </button>
        </div>
      </div>
    </AdminModalShell>

  </div>

  <AdminModalShell
    ref="deleteModal"
    id="deleteFieldsModal"
    labelled-by="delete-fields-modal-title"
    title="Eliminar campos"
    size="md"
    body-class="p-6 overflow-y-auto max-h-[80vh]"
  >
    <div v-if="!fields.length" class="text-slate-500 text-center font-medium py-8 bg-slate-50 rounded-xl border border-slate-100">No hay firmas para eliminar.</div>
    <div v-else class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
        <label class="font-semibold text-sm text-slate-700 ml-2">Filtrar por pagina</label>
        <select v-model="filterPage" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500">
          <option value="all">Todas</option>
          <option v-for="page in pagesWithFields" :key="page" :value="page">
            Pagina {{ page }}
          </option>
        </select>
      </div>
      
      <div class="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        <div
          v-for="field in filteredFields"
          :key="field.id"
          class="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-sky-300 hover:bg-sky-50/30 transition gap-3"
          :class="field.id === lastFieldId ? 'border-sky-500 bg-sky-50/50' : 'bg-white'"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-slate-800">{{ field.name }}</span>
              <span class="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold tracking-wide">Pág {{ field.page }}</span>
            </div>
            <span class="text-slate-500 text-xs font-medium">
              {{ field.signer ? `${field.signer.first_name} ${field.signer.last_name}` : 'Sin asignar' }}
            </span>
          </div>
          
          <div class="flex items-center gap-2 sm:self-center self-end">
            <button 
              type="button" 
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition font-medium focus:outline-none focus:ring-2 focus:ring-slate-200" 
              @click.stop="goToFieldLocation(field.id)"
            >
              <IconSearch class="w-3.5 h-3.5" stroke-width="2.5" />
              Ver en documento
            </button>
            <button 
              type="button" 
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition font-medium focus:outline-none focus:ring-2 focus:ring-red-200" 
              @click.stop="requestDeleteField(field.id)"
            >
              <IconTrash class="w-3.5 h-3.5" stroke-width="2.5" />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  </AdminModalShell>

  <AdminModalShell
    ref="assignSignerModal"
    labelled-by="assign-signer-title"
    title="Asignar firmante"
    size="lg"
    dialog-class="items-center"
    content-class="rounded-4 shadow border-0"
    body-class="pt-4"
  >
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm text-slate-700 mb-0">Estado</label>
          <select v-model="statusFilter" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500">
            <option value="all">Todos</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Verificado">Verificado</option>
            <option value="Reportado">Reportado</option>
          </select>
        </div>
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm text-slate-700 mb-0">Buscar</label>
          <input
            v-model="signerInput"
            type="text"
            class="block w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Nombre, correo o cédula"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm text-slate-700 mb-0">Tipo de unidad</label>
          <select v-model="signerUnitTypeFilter" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500">
            <option value="">Todos</option>
            <option v-for="option in signerUnitTypeOptions" :key="option.id" :value="String(option.id)">
              {{ option.label || option.name }}
            </option>
          </select>
        </div>
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm text-slate-700 mb-0">Unidad</label>
          <select v-model="signerUnitFilter" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500" :disabled="!signerUnitTypeFilter || isLoadingSignerOptions">
            <option value="">Todas</option>
            <option v-for="option in signerUnitOptions" :key="option.id" :value="String(option.id)">
              {{ option.label || option.name }}
            </option>
          </select>
        </div>
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm text-slate-700 mb-0">Cargo</label>
          <select v-model="signerCargoFilter" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500" :disabled="isLoadingSignerOptions">
            <option value="">Todos</option>
            <option v-for="option in signerCargoOptions" :key="option.id" :value="String(option.id)">
              {{ option.label || option.name }}
            </option>
          </select>
        </div>
        <div class="flex items-end justify-end">
          <AdminButton variant="outlinePrimary" class-name="w-full md:w-auto" @click="clearSignerFilters">
            Limpiar filtros
          </AdminButton>
        </div>
      </div>

      <div class="mt-2 min-h-[260px] max-h-[360px] overflow-y-auto bg-slate-50 border border-slate-100 rounded-xl p-2 custom-scrollbar">
        <div v-if="isSearchingUsers" class="text-slate-500 text-sm text-center py-10 font-medium">Buscando usuarios...</div>
        <div v-else-if="userResults.length === 0" class="text-slate-500 text-sm text-center py-10 font-medium">
          No se han encontrado resultados.
        </div>
        <div v-else class="flex flex-col gap-2">
          <button
            v-for="user in userResults"
            :key="user.id || user._id"
            type="button"
            class="flex flex-col p-3 border rounded-xl text-left transition w-full shadow-sm"
            :class="selectedSigner?.id === user.id || selectedSigner?._id === user._id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'"
            @click="selectSigner(user)"
          >
            <div class="font-semibold text-slate-800 text-sm flex items-center justify-between w-full gap-3">
              <span>{{ user.first_name }} {{ user.last_name }}</span>
              <span v-if="selectedSigner?.id === user.id || selectedSigner?._id === user._id" class="text-sky-600 bg-sky-100 px-2 py-0.5 rounded text-xs">Seleccionado</span>
            </div>
            <div class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{{ user.cedula }}</span>
              <span>{{ user.email }}</span>
            </div>
            <div v-if="user.unit_type_name || user.unit_name || user.cargo_name" class="text-xs text-slate-600 mt-2 flex flex-wrap gap-2">
              <span v-if="user.unit_type_name" class="bg-white border border-slate-200 rounded-md px-2 py-1">{{ user.unit_type_name }}</span>
              <span v-if="user.unit_name" class="bg-white border border-slate-200 rounded-md px-2 py-1">{{ user.unit_name }}</span>
              <span v-if="user.cargo_name" class="bg-white border border-slate-200 rounded-md px-2 py-1">{{ user.cargo_name }}</span>
            </div>
          </button>
        </div>
      </div>
      <p v-if="userSearchError" class="text-red-500 text-sm font-medium mt-1 mb-0">{{ userSearchError }}</p>
    </div>
    <template #footer>
      <AdminButton variant="secondary" data-modal-dismiss>
        Cancelar
      </AdminButton>
      <AdminButton variant="primary" @click="confirmSigner">
        Guardar y Asignar
      </AdminButton>
    </template>
  </AdminModalShell>

  <AdminModalShell
    ref="confirmDeleteModal"
    labelled-by="confirm-delete-signature-title"
    title="Eliminar firma"
    size="centered"
    content-class="rounded-4 shadow border-0"
    body-class="pt-4"
    footer-class="border-0 pt-0"
  >
    <p class="mb-0 text-sm text-slate-600">
      ¿Deseas eliminar este campo de firma? Esta acción no se puede deshacer.
    </p>
    <template #footer>
      <AdminButton variant="outlineDanger" @click="confirmDeleteField">
        Eliminar
      </AdminButton>
    </template>
  </AdminModalShell>

  <AdminModalShell
    ref="signCertModal"
    labelled-by="sign-cert-modal-title"
    :title="multiBatchRequest ? 'Iniciar firma masiva' : signMode === 'token' ? 'Firmar documento por token' : 'Firmar documento'"
    size="lg"
    content-class="rounded-4 shadow border-0"
    body-class="pt-4"
  >
    <div class="flex flex-col gap-4">
      <p class="mb-0 text-sm text-slate-600">
        Selecciona uno de tus certificados guardados e ingresa la contraseña del `.p12`.
      </p>

      <div
        v-if="multiBatchRequest"
        class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
      >
        <div class="font-semibold">Lote preparado</div>
        <div class="mt-1 text-sky-800">
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
        class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
      >
        <div class="font-semibold">Firma por token</div>
        <div v-if="currentSignatureMarker" class="mt-1 text-sky-800">
          Se buscarán todas las coincidencias del marcador <span class="font-mono font-semibold">{{ currentSignatureMarker }}</span> y se estampará la firma en cada una.
        </div>
        <div v-else class="mt-1 text-red-600">
          Tu usuario no tiene un token de firma configurado.
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <div class="text-sm font-bold text-slate-800">Certificados disponibles</div>
            <div class="text-xs text-slate-500">Puedes gestionarlos aquí sin salir de la vista de firmas.</div>
          </div>
          <AdminButton variant="outlinePrimary" size="sm" @click="openCertificatesManagerModal">
            Gestionar certificados
          </AdminButton>
        </div>

        <div v-if="isLoadingCertificates" class="text-sm text-slate-500 font-medium py-3">
          Cargando certificados...
        </div>
        <div v-else-if="!availableCertificates.length" class="text-sm text-slate-500 font-medium py-3">
          No tienes certificados cargados.
        </div>
        <div v-else class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
          <button
            v-for="certificate in availableCertificates"
            :key="certificate.id"
            type="button"
            class="w-full rounded-xl border px-3 py-3 text-left transition"
            :class="selectedCertificateId === certificate.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'"
            @click="selectedCertificateId = certificate.id"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-bold text-slate-800">{{ certificate.label }}</span>
              <AppTag v-if="certificate.is_default" variant="info">Predeterminado</AppTag>
            </div>
            <div class="text-xs text-slate-500 mt-1">{{ certificate.original_filename }}</div>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm text-slate-700">Contraseña del certificado</label>
          <input
            v-model="certPassword"
            type="password"
            class="block w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Contraseña del .p12"
            autocomplete="current-password"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-sm text-slate-700">Texto del sello</label>
          <input
            v-model="stampText"
            type="text"
            class="block w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Ej: Dr. Juan Pérez"
          />
        </div>
      </div>

      <label class="inline-flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <input
          v-model="allowUntrustedSigner"
          type="checkbox"
          class="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-300"
        />
        <span>
          Permitir certificados no validados
          <span class="block text-xs text-amber-700">
            Solo para pruebas. Si la cadena de confianza no puede validarse, la firma continuará y se devolverá como advertencia.
          </span>
        </span>
      </label>

      <p v-if="signError" class="mb-0 text-sm font-medium text-red-600">{{ signError }}</p>
    </div>
    <template #footer>
      <AdminButton variant="secondary" data-modal-dismiss :disabled="isSigning">
        Cancelar
      </AdminButton>
      <AdminButton variant="primary" :disabled="isSigning" @click="confirmSign">
        {{ isSigning ? "Firmando..." : "Confirmar firma" }}
      </AdminButton>
    </template>
  </AdminModalShell>

  <AdminModalShell
    ref="signResultModal"
    labelled-by="sign-result-modal-title"
    :title="signSuccess ? 'Documento firmado' : 'Error al firmar'"
    size="md"
    content-class="rounded-4 shadow border-0"
    body-class="pt-4"
  >
      <div v-if="signSuccess" class="flex flex-col gap-4">
        <p class="mb-0 text-sm text-emerald-700 font-medium">
          El documento fue firmado correctamente con {{ signedFieldsCount }} campo(s).
        </p>
        <div v-if="signedMinioPath" class="flex flex-wrap gap-3">
          <AdminButton variant="outlinePrimary" @click="viewSignedDocument">Visualizar documento</AdminButton>
          <AdminButton variant="primary" @click="downloadSignedDocument">Descargar documento</AdminButton>
        </div>
    </div>
    <p v-else class="mb-0 text-sm text-red-600 font-medium">{{ signError }}</p>
    <template #footer>
      <AdminButton variant="secondary" data-modal-dismiss>Cerrar</AdminButton>
    </template>
  </AdminModalShell>

  <AdminModalShell
    ref="certificatesManagerModal"
    labelled-by="certificates-manager-modal-title"
    title="Gestionar certificados"
    size="xl"
    content-class="rounded-4 shadow border-0"
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
      <AdminButton variant="secondary" data-modal-dismiss>Cerrar</AdminButton>
    </template>
  </AdminModalShell>

  <AdminModalShell
    ref="validationResultModal"
    labelled-by="validation-result-modal-title"
    title="Validar documento"
    size="xl"
    :show-close-button="false"
    content-class="rounded-3xl shadow-xl border-0 overflow-hidden"
    header-class="bg-slate-50 border-b border-slate-100"
    body-class="p-0 bg-slate-50 relative"
  >
    <template #title>
      <div class="flex items-center pb-0">Validar documento</div>
      <button data-modal-dismiss class="absolute right-5 top-4 inline-flex items-center justify-center gap-1.5 p-1 rounded-xl bg-slate-100/50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 font-semibold text-sm transition-colors cursor-pointer z-20">
        <IconX class="w-4 h-4" stroke-width="2.5" />
      </button>
    </template>
    <div class="px-6 pt-6 pb-4">
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-end gap-4 relative overflow-hidden">
        <div class="absolute -right-16 -top-16 w-32 h-32 bg-sky-50 rounded-full blur-2xl opacity-60"></div>
        <div class="flex-1 flex flex-col gap-2 relative z-10 w-full">
          <label class="font-bold text-sm text-slate-700 flex items-center justify-start gap-2">
            <IconSearch class="w-4 h-4 text-sky-600" /> Buscar cédula en las firmas
          </label>
          <div class="relative max-w-full md:max-w-sm">
            <input
              v-model="validationCedula"
              type="text"
              class="block w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-50"
              placeholder="Ej. 0999999999 (Opcional)"
            />
          </div>
        </div>
        <div class="relative z-10 w-full md:w-auto">
          <button 
            class="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-sky-600 text-sky-700 hover:bg-sky-50 hover:border-sky-700 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isValidatingDocument || !validationFile" 
            @click="validateDocument"
          >
            <IconRefresh v-if="isValidatingDocument" class="w-4 h-4 animate-spin" />
            <IconShieldCheck v-else class="w-4 h-4" />
            {{ isValidatingDocument ? 'Validando...' : 'Revalidar documento' }}
          </button>
        </div>
      </div>

      <div v-if="validationError" class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-3 shadow-sm animate-fade-in">
        <IconAlertCircle class="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
        <p class="font-medium leading-relaxed m-0">{{ validationError }}</p>
      </div>

      <div v-if="validationResult" class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col items-start gap-2 relative overflow-hidden">
          <div class="flex items-center gap-2 text-slate-500 mb-1 z-10">
            <div class="p-1.5 bg-slate-100 rounded-lg"><IconSignature class="w-4 h-4" /></div>
            <div class="text-xs font-bold uppercase tracking-wider">Firmas Detectadas</div>
          </div>
          <div class="text-3xl font-black text-slate-800 z-10">{{ validationResult.summary?.signatureCount || 0 }}</div>
        </div>

        <div class="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm flex flex-col items-start gap-2 relative overflow-hidden">
          <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-100 rounded-full blur-xl opacity-50"></div>
          <div class="flex items-center gap-2 text-emerald-700 mb-1 z-10">
            <div class="p-1.5 bg-emerald-100 rounded-lg"><IconCheck class="w-4 h-4" /></div>
            <div class="text-xs font-bold uppercase tracking-wider">Firmas Válidas</div>
          </div>
          <div class="text-3xl font-black text-emerald-900 z-10">{{ validationResult.summary?.validSignatureCount || 0 }}</div>
        </div>

        <div class="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 shadow-sm flex flex-col items-start gap-2 relative overflow-hidden">
           <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-cyan-100 rounded-full blur-xl opacity-50"></div>
          <div class="flex items-center gap-2 text-cyan-700 mb-1 z-10">
            <div class="p-1.5 bg-cyan-100 rounded-lg"><IconSearch class="w-4 h-4" /></div>
            <div class="text-xs font-bold uppercase tracking-wider">Coincidencias</div>
          </div>
          <div class="text-3xl font-black text-cyan-900 z-10">{{ validationResult.summary?.matchingCedulaCount || 0 }}</div>
        </div>

        <div class="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div class="flex items-center gap-2 text-indigo-700 mb-2 z-10">
            <div class="p-1.5 bg-indigo-100 rounded-lg"><IconFileCheck class="w-4 h-4" /></div>
            <div class="text-xs font-bold uppercase tracking-wider">Documento Activo</div>
          </div>
          <div class="text-sm font-bold text-indigo-900 truncate w-full z-10" :title="validationFile?.name">{{ validationFile?.name || 'Subido manualmente' }}</div>
        </div>
      </div>

      <div
        v-if="validationResult?.summary?.timestampCount"
        class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3 shadow-sm animate-fade-in"
      >
        <IconAlertTriangle class="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <p class="font-medium leading-relaxed m-0">El documento también contiene <strong class="font-black">{{ validationResult.summary.timestampCount }}</strong> sello(s) de tiempo, los cuales no se detallan en la tabla principal de firmantes.</p>
      </div>

      <div
        v-if="Array.isArray(validationResult?.warnings) && validationResult.warnings.length"
        class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-3 shadow-sm animate-fade-in"
      >
        <IconAlertCircle class="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
        <div class="flex flex-col gap-1">
          <p v-for="(warning, idx) in validationResult.warnings" :key="idx" class="font-medium leading-relaxed m-0">{{ warning }}</p>
        </div>
      </div>
    </div>

    <!-- TABLA -->
    <div class="bg-white border-t border-slate-200 relative min-h-[200px]">
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
              <span v-if="row.valid" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
                <IconCheck class="w-3.5 h-3.5" /> Válida
              </span>
              <span v-else class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200">
                <IconX class="w-3.5 h-3.5" /> Inválida
              </span>
            </div>
          </template>
          <template v-else-if="field.name === 'certificateAuthority'">
            <div class="flex items-center justify-center">
              <button
                v-if="row.certificateAuthority && row.certificateAuthority !== 'No disponible'"
                @click="openCertificateAuthorityModal(row)"
                class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-600 transition-colors"
                title="Ver entidad certificadora"
              >
                <IconCertificate class="w-4 h-4" />
              </button>
              <span v-else class="text-slate-400 text-xs font-semibold uppercase">N/A</span>
            </div>
          </template>
          <template v-else-if="field.name === 'signerCedula'">
            <div class="flex flex-col gap-1.5 items-start">
              <span class="font-semibold text-slate-800">{{ row.signerCedula }}</span>
              <span v-if="row.matchesCedula" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 text-[10px] font-bold uppercase tracking-wider border border-cyan-200">
                <IconCheck class="w-3 h-3" /> Coincide
              </span>
            </div>
          </template>
          <template v-else-if="field.name === 'details'">
            <details class="min-w-[16rem] group">
              <summary class="cursor-pointer text-xs font-bold uppercase tracking-wider text-sky-600 hover:text-sky-700 transition flex items-center gap-1 list-none">
                <IconInfoCircle class="w-4 h-4" />
                <span class="group-open:hidden">Ver técnico</span>
                <span class="hidden group-open:inline">Ocultar</span>
              </summary>
              <pre class="mt-2 overflow-auto whitespace-pre-wrap text-[10px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner max-h-40 leading-relaxed custom-scrollbar">{{ JSON.stringify(row.extras || {}, null, 2) }}</pre>
            </details>
          </template>
          <template v-else>
            <span class="text-sm text-slate-600 font-medium">{{ row[field.name] }}</span>
          </template>
        </template>
        <template #empty>
          <div class="flex flex-col items-center justify-center py-12 px-4">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <IconShieldCheck class="w-8 h-8" />
            </div>
            <h4 class="text-lg font-bold text-slate-700 mb-1">Sin firmas detectadas</h4>
            <p class="text-sm text-slate-500 text-center max-w-md">No se encontraron firmas electrónicas embebidas en el documento analizado o el documento no ha sido cargado correctamente.</p>
          </div>
        </template>
      </AppDataTable>
    </div>
  </AdminModalShell>

  <AdminModalShell
    ref="certificateAuthorityModal"
    labelled-by="certificate-authority-modal-title"
    title="Entidad certificadora"
    size="lg"
    content-class="rounded-4 shadow border-0"
    body-class="pt-4"
  >
    <div class="flex flex-col gap-4">
      <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Entidad</div>
        <div class="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-800">
          {{ selectedCertificateAuthority?.certificateAuthority || 'No disponible' }}
        </div>
      </div>

      <div
        v-if="selectedCertificateAuthority?.extras?.issuer"
        class="rounded-2xl border border-slate-200 bg-white px-4 py-3"
      >
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Issuer completo</div>
        <div class="mt-2 whitespace-pre-wrap text-sm text-slate-700">
          {{ selectedCertificateAuthority.extras.issuer }}
        </div>
      </div>

      <div
        v-if="selectedCertificateAuthority?.extras?.issuerAttributes && Object.keys(selectedCertificateAuthority.extras.issuerAttributes).length"
        class="rounded-2xl border border-slate-200 bg-white px-4 py-3"
      >
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Atributos detectados</div>
        <pre class="mt-3 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{{ JSON.stringify(selectedCertificateAuthority.extras.issuerAttributes, null, 2) }}</pre>
      </div>
    </div>
  </AdminModalShell>
</template>
  <script setup>
  import { onMounted, onBeforeUnmount, ref, watch, nextTick, computed, defineExpose, defineProps } from 'vue';
  import axios from 'axios';
  import { pdfjsLib } from '@/utils/pdfjsSetup';
  import { Modal } from '@/utils/modalController';
  import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconSignature, IconSend, IconShieldCheck, IconX, IconFileUpload, IconFiles, IconSearch, IconCertificate, IconAlertCircle, IconCheck, IconInfoCircle, IconAlertTriangle, IconFileCheck, IconRefresh, IconTrash, IconKey, IconList, IconMail, IconCreditCard } from '@tabler/icons-vue';
  import { API_ROUTES } from '@/services/apiConfig';
  import BtnDelete from '@/components/BtnDelete.vue';
  import AppTag from '@/components/AppTag.vue';
  import AppDataTable from '@/components/AppDataTable.vue';
  import PdfDropField from '@/components/firmas/PdfDropField.vue';
  import UserCertificatesPanel from '@/components/firmas/UserCertificatesPanel.vue';
  import AdminModalShell from '@/components/AppModalShell.vue';
  import AdminButton from '@/components/AppButton.vue';
  import Loading from '@/components/Loading.vue';
  import MultiSignerPanel from '@/components/firmas/MultiSignerPanel.vue';

  const props = defineProps({
    embedded: {
      type: Boolean,
      default: false
    }
  });

  let ctx;
  const colPdf=ref(null)
  let pdfDoc = null;
  let renderTask = null;
  const pdfViewer=ref(null), pdfCanvas=ref(null), coordinatesDisplay=ref(null);
  const currentPage = ref(1);
  const pageInput = ref(1);
  const totalPages = ref(0);
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
  let pdfScale = 1.75; 
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
  let draggedField = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragInitialLeft = 0;
  let dragInitialTop = 0;
  let startX = 0;
  let startY = 0;
  let activeBox = null;
  const pendingDeleteFieldId = ref(null);
  const availableCertificates = ref([]);
  const selectedCertificateId = ref(null);
  const certPassword = ref('');
  const stampText = ref('');
  const signMode = ref('coordinates');
  const allowUntrustedSigner = ref(false);
  const isSigning = ref(false);
  const signError = ref('');
  const signSuccess = ref(false);
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
  const activeMultiBatchJobId = ref('');
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
  const rootClasses = computed(() =>
    props.embedded
      ? 'w-full h-full max-w-7xl mx-auto p-0 flex flex-col gap-6'
      : 'w-full h-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6'
  );

  const removeBox = () => {
    const signbox = document.getElementById('active-signbox');
    if (signbox) {
      signbox.remove();
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
    return (cssValue * displayScale) / pdfScale;
  };

  const toCssUnits = (pdfUnits) => {
    const displayScale = getDisplayScale();
    return (pdfUnits * pdfScale) / displayScale;
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

  const startDragField = (field, event) => {
    if (isDragging) return;

    // Check if we are interacting with child buttons
    if (event.target.closest('.saved-box-actions')) return;

    draggedField = field;
    dragStartX = event.pageX;
    dragStartY = event.pageY;

    const rect = getViewerRect();
    dragInitialLeft = toCssUnits(field.x1);
    dragInitialTop = rect.height - toCssUnits(field.y1);
    
    selectField(field.id);
  };

  const handleMouseDown = (event) => {
    if (draggedField) return; // Prevent starting a new box if dragging
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

    if (draggedField) {
      isMouseOverPdf.value = false;
      const deltaX = event.pageX - dragStartX;
      const deltaY = event.pageY - dragStartY;
      
      const boxWidth = toCssUnits(draggedField.x2 - draggedField.x1);
      const boxHeight = toCssUnits(draggedField.y1 - draggedField.y2);
      
      const maxLeft = Math.max(0, rect.width - boxWidth);
      const maxTop = Math.max(0, rect.height - boxHeight);

      const boundedLeft = Math.min(Math.max(dragInitialLeft + deltaX, 0), maxLeft);
      const boundedTop = Math.min(Math.max(dragInitialTop + deltaY, 0), maxTop);
      
      draggedField.x1 = toPdfUnits(boundedLeft);
      draggedField.y1 = toPdfUnits(rect.height - boundedTop);
      draggedField.x2 = toPdfUnits(boundedLeft + boxWidth);
      draggedField.y2 = toPdfUnits(rect.height - (boundedTop + boxHeight));
      
      updateCoordinates(boundedLeft, boundedTop, boundedLeft + boxWidth, boundedTop + boxHeight, rect.height);
      return;
    }

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
    if (draggedField) {
      draggedField = null;
      return;
    }
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
      const containerWidth = colPdf.value?.clientWidth || baseViewport.width;
      pdfScale = containerWidth / baseViewport.width;
      viewport = page.getViewport({ scale: pdfScale });
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
        loadingTask.promise.then(async (pdf) => {
          pdfDoc = pdf;
          totalPages.value = pdfDoc.numPages;
          pdfReady.value = true;
          await nextTick();
          await renderPage(currentPage.value);
        }).catch(err => {
          uploadError.value = 'No se pudo cargar el PDF seleccionado.';
          console.error('Error al cargar el PDF:', err);
          resetPdfState();
        });
      } catch (err) {
        uploadError.value = 'No se pudo leer el archivo PDF seleccionado.';
        console.error('Error al leer el archivo PDF:', err);
        resetPdfState();
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

    const onAddFiles = (files, mode = 'sign') => {
      uploadError.value = '';
      const file = files?.[0];
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        uploadError.value = 'El archivo debe ser un PDF.';
        return;
      }
      if (mode === 'validate') {
        validationFile.value = file;
        validateDocument();
        return;
      }
      uploadedFiles.value = [{ content: file, isRenaming: false, name: file.name }];
      loadPdfFromFile(file, mode);
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
      workspaceMode.value = 'multi';
    };

    const closeMultiSigner = () => {
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

    const getFieldBoxStyle = (field) => {
      const rect = getViewerRect();
      const left = toCssUnits(field.x1);
      const right = toCssUnits(field.x2);
      const top = rect.height - toCssUnits(field.y1);
      const bottom = rect.height - toCssUnits(field.y2);
      return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.max(0, right - left)}px`,
        height: `${Math.max(0, bottom - top)}px`,
        position: 'absolute',
        pointerEvents: 'auto'
      };
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
          if (boxEl) {
            boxEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // optionally highlight the box temporarily by adding a temporary class
            boxEl.classList.add('ring-4', 'ring-sky-500', 'ring-offset-2', 'transition-shadow');
            setTimeout(() => {
              boxEl.classList.remove('ring-4', 'ring-sky-500', 'ring-offset-2', 'transition-shadow');
            }, 1500);
          }
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
        const defaultCertificate =
          availableCertificates.value.find((item) => item.is_default) ||
          availableCertificates.value[0] ||
          null;
        if (!selectedCertificateId.value && defaultCertificate) {
          selectedCertificateId.value = defaultCertificate.id;
        }
      } catch (error) {
        signError.value = error.message || 'No se pudieron cargar los certificados.';
        availableCertificates.value = [];
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
      signSuccess.value = false;
      await loadCertificates();
      if (!signCertModal.value?.el) return;
      signCertModalInstance = Modal.getOrCreateInstance(signCertModal.value.el);
      signCertModalInstance.show();
    };

    const prepareMultiBatchStart = async (payload) => {
      multiBatchRequest.value = payload;
      signError.value = '';
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
        if (!['completed', 'error'].includes(data.status)) {
          multiBatchPollTimer = setTimeout(() => {
            pollMultiBatchStatus(jobId);
          }, 1500);
        }
      } catch (error) {
        signError.value = error.message || 'No se pudo consultar el avance de la firma masiva.';
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
        signError.value = error.message || 'No se pudo descargar el lote firmado.';
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
          signError.value = error.message || 'No se pudo iniciar la firma masiva.';
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
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || data?.message || `Error del servidor (${response.status})`);
        }
        signSuccess.value = true;
        signedMinioPath.value = data.signedPath;
        signedFieldsCount.value = Number(data.fieldsCount || (signMode.value === 'coordinates' ? allFields.length : 0));
        signCertModalInstance?.hide();
        signResultModalInstance = Modal.getOrCreateInstance(signResultModal.value.el);
        signResultModalInstance.show();
      } catch (error) {
        signError.value = error.message || 'No se pudo firmar el documento.';
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
        signError.value = error.message || 'No se pudo visualizar el documento firmado.';
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
        signError.value = error.message || 'No se pudo descargar el documento firmado.';
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
      workflowSignContext.value = null;
      workflowPdfStatus.value = { type: 'info', message: '' };
      stopMultiBatchPolling();
      pendingDeleteFieldId.value = null;
      workspaceMode.value = 'single';
      resetPdfState();
    };

    const initializeWorkflowSignatureSession = (payload = {}) => {
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
    };

    defineExpose({ resetToStart, initializeWorkflowSignatureSession });

  </script>
<style scoped>
.pdf-viewer {
  position: relative;
  max-width: 100%;
}

:deep(.box) {
  border: 2px dashed var(--brand-accent, #0ea5e9);
  position: absolute;
  background-color: rgba(14, 165, 233, 0.25);
  border-radius: 5%;
  z-index: 20;
}

:deep(.saved-box) {
  cursor: pointer;
}

:deep(.saved-box-delete) {
  z-index: 30;
}

.saved-box-actions {
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(105%, -8%);
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  pointer-events: auto;
}

.saved-box-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.85rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.saved-box-action-btn:hover {
  background: #f8fafc;
  color: #0f172a;
  transform: translateY(-1px);
}

.saved-box-action-btn:focus-visible {
  outline: 2px solid rgba(14, 165, 233, 0.35);
  outline-offset: 2px;
}

.saved-box-signer {
  position: absolute;
  inset: 0.45rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.55rem;
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.28);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

:deep(.saved-box--active) {
  border-color: var(--brand-accent, #0ea5e9);
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.35);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--brand-border, #e2e8f0);
  border-radius: 10px;
}

.page-selector-input {
  appearance: textfield;
  -moz-appearance: textfield;
}

.page-selector-input::-webkit-outer-spin-button,
.page-selector-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
