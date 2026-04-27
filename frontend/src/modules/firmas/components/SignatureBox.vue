<template>
  <div
    class="signature-box absolute flex flex-col items-center justify-center p-1 rounded-sm backdrop-blur-[1px] transition-colors group z-20"
    :class="[
      isActive ? 'border-sky-500 bg-sky-500/20 ring-4 ring-sky-500 ring-opacity-30 border-solid' : 'border-dashed border-sky-400 bg-sky-400/10 hover:border-sky-500 hover:bg-sky-500/20',
      isPreview ? 'pointer-events-none opacity-60 z-30' : 'pointer-events-auto custom-drag-cursor',
      isDragging ? 'opacity-80 scale-105 shadow-xl ring-2 custom-dragging-cursor' : 'shadow-sm',
      customClass
    ]"
    :style="[computedStyle, { borderWidth: '2px' }]"
    @mousedown.stop.prevent="startDrag"
    @click.stop="onClick"
    @mouseenter="$emit('hover-enter')"
    @mouseleave="$emit('hover-leave')"
  >
    <div class="h-full w-full border border-sky-400/50 border-dashed rounded relative flex flex-col items-center justify-center bg-white/40 pointer-events-none">
      <IconSignature class="w-6 h-6 sm:w-8 sm:h-8 text-sky-600 drop-shadow mb-1 opacity-75 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
      <span class="text-[9px] sm:text-[10px] font-bold text-sky-800 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-sky-200 uppercase tracking-widest text-center truncate max-w-full">
        {{ label || 'Firma' }}
      </span>
    </div>
    
    <!-- Botón eliminar rápido en hover o seleccionado -->
    <div 
      v-if="!isPreview"
      class="absolute right-0 top-0 z-30 flex translate-x-[calc(100%+0.5rem)] flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      :class="{ 'opacity-100': isActive }"
    >
      <button
        v-if="allowDelete"
        @click.stop="$emit('delete')"
        class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/80 bg-rose-500/88 text-white shadow-md backdrop-blur-sm transition-colors cursor-pointer ring-0 outline-none hover:bg-rose-600/92 active:scale-95"
      >
        <IconTrash class="w-3.5 h-3.5" />
      </button>
      <slot name="actions"></slot>
    </div>

    <div
      v-if="!isPreview && $slots.navigation"
      class="absolute bottom-0 left-0 right-0 z-30 flex translate-y-[calc(100%+0.4rem)] flex-col items-stretch gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      :class="{ 'opacity-100': isActive }"
    >
      <slot name="navigation"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount } from 'vue';
import { IconSignature, IconTrash } from '@tabler/icons-vue';

const props = defineProps({
  field: { type: Object, default: () => null },
  pdfScale: { type: Number, default: 1 },
  // Escala para FirmarPdf (DisplayScale custom)
  displayScale: { type: Number, default: 1 },
  pageHeightPdf: { type: Number, default: 0 },
  pageWidthPdf: { type: Number, default: 0 },
  top: { type: Number, default: null }, // px fijos (Para preview)
  left: { type: Number, default: null }, // px fijos
  width: { type: Number, default: null }, // px fijos
  height: { type: Number, default: null }, // px fijos
  isActive: { type: Boolean, default: false },
  isPreview: { type: Boolean, default: false },
  label: { type: String, default: '' },
  allowDelete: { type: Boolean, default: true },
  customClass: { type: String, default: '' }
});

const emit = defineEmits(['update:position', 'delete', 'select', 'drag-start', 'drag-end', 'hover-enter', 'hover-leave']);

const isDragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let initialX1 = 0;
let initialY1 = 0;
let initialX2 = 0;
let initialY2 = 0;

// Utilidades de conversión
const combinedScale = computed(() => props.pdfScale / props.displayScale);
const toPdfUnits = (cssValue) => cssValue / combinedScale.value;
const toCssUnits = (pdfValue) => pdfValue * combinedScale.value;

const computedStyle = computed(() => {
  if (props.isPreview) {
    return {
      left: `${props.left}px`,
      top: `${props.top}px`,
      width: `${props.width}px`,
      height: `${props.height}px`
    };
  }
  
  if (!props.field) return {};

  const left = toCssUnits(props.field.x1);
  const right = toCssUnits(props.field.x2);
  const top = toCssUnits(props.pageHeightPdf - props.field.y1);
  const bottom = toCssUnits(props.pageHeightPdf - props.field.y2);

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(0, right - left)}px`,
    height: `${Math.max(0, bottom - top)}px`
  };
});

const startDrag = (event) => {
  if (props.isPreview) return;
  // Prevent drag if click is on the delete button
  if (event.target.closest('button')) return;

  isDragging.value = true;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  
  initialX1 = props.field.x1;
  initialY1 = props.field.y1;
  initialX2 = props.field.x2;
  initialY2 = props.field.y2;

  emit('select');
  emit('drag-start');

  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
};

const onDrag = (event) => {
  if (!isDragging.value) return;

  const deltaX = event.clientX - dragStartX;
  const deltaY = event.clientY - dragStartY;

  const pdfDeltaX = toPdfUnits(deltaX);
  const pdfDeltaY = toPdfUnits(deltaY); // Y en PDF va de abajo arriba

  let newX1 = initialX1 + pdfDeltaX;
  let newX2 = initialX2 + pdfDeltaX;
  let newY1 = initialY1 - pdfDeltaY;
  let newY2 = initialY2 - pdfDeltaY;

  // Límites usando pageWidthPdf y pageHeightPdf
  const boxPdfWidth = initialX2 - initialX1;
  const boxPdfHeight = initialY1 - initialY2;
  
  const maxPdfWidth = props.pageWidthPdf || 99999;
  const maxPdfHeight = props.pageHeightPdf || 99999;

  if (newX1 < 0) {
    newX1 = 0;
    newX2 = boxPdfWidth;
  }
  if (props.pageWidthPdf && newX2 > maxPdfWidth) {
    newX2 = maxPdfWidth;
    newX1 = maxPdfWidth - boxPdfWidth;
  }

  if (newY2 < 0) {
    newY2 = 0;
    newY1 = boxPdfHeight;
  }
  if (props.pageHeightPdf && newY1 > maxPdfHeight) {
    newY1 = maxPdfHeight;
    newY2 = maxPdfHeight - boxPdfHeight;
  }

  // Actualizamos un clon del objeto field
  emit('update:position', { 
    ...props.field,
    x1: newX1, 
    y1: newY1, 
    x2: newX2, 
    y2: newY2 
  });
};

const stopDrag = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  emit('drag-end');
};

const onClick = () => {
  if (props.isPreview) return;
  emit('select');
};

onBeforeUnmount(() => {
  if (isDragging.value) {
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
  }
});

</script>

<style scoped>
.custom-drag-cursor {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 12.5v-7.5a1.5 1.5 0 0 1 3 0v6.5'%3E%3C/path%3E%3Cpath d='M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5'%3E%3C/path%3E%3Cpath d='M14 5.5a1.5 1.5 0 1 1 3 0v6.5'%3E%3C/path%3E%3Cpath d='M17 7.5a1.5 1.5 0 1 1 3 0v8.5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -5.012 -2.7l-3.196 -4.8a1.996 1.996 0 0 1 2.14 -3.111l3.86 1.311'%3E%3C/path%3E%3C/svg%3E") 12 12, grab;
}
.custom-drag-cursor:active, .custom-dragging-cursor {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='lightgray' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 12.5v-7.5a1.5 1.5 0 0 1 3 0v6.5'%3E%3C/path%3E%3Cpath d='M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5'%3E%3C/path%3E%3Cpath d='M14 5.5a1.5 1.5 0 1 1 3 0v6.5'%3E%3C/path%3E%3Cpath d='M17 7.5a1.5 1.5 0 1 1 3 0v8.5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -5.012 -2.7l-3.196 -4.8a1.996 1.996 0 0 1 2.14 -3.111l3.86 1.311'%3E%3C/path%3E%3C/svg%3E") 12 12, grabbing !important;
}
</style>
