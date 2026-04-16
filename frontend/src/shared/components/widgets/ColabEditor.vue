<template>
  <div class="profile-admin-skin colab-editor">
    <div
      v-for="(cell, index) in cells"
      :key="cell.id"
      class="colab-cell"
      :class="{ 'is-editing': cell.isEditing }"
    >
      <div class="colab-cell-toolbar" v-show="cell.isEditing || hoveredCell === cell.id">
        <button
          type="button"
          class="profile-icon-button profile-icon-button--muted"
          @click="moveCellUp(index)"
          :disabled="index === 0"
          title="Mover arriba"
        >
          <IconArrowUp />
        </button>
        <button
          type="button"
          class="profile-icon-button profile-icon-button--muted"
          @click="moveCellDown(index)"
          :disabled="index === cells.length - 1"
          title="Mover abajo"
        >
          <IconArrowDown />
        </button>
        <button
          type="button"
          class="profile-icon-button profile-icon-button--primary"
          @click="toggleEdit(cell)"
          :title="cell.isEditing ? 'Guardar' : 'Editar'"
        >
          <component :is="tablerIconMap[cell.isEditing ? 'check' : 'edit'] || tablerIconMap['info-circle']" />
        </button>
        <button
          type="button"
          class="profile-icon-button profile-icon-button--danger"
          @click="deleteCell(index)"
          title="Eliminar"
        >
          <IconTrash />
        </button>
        <button
          type="button"
          class="profile-icon-button profile-icon-button--muted"
          @click="showCellMenu(cell)"
          title="Más opciones"
        >
          <IconDotsVertical />
        </button>
      </div>
      
      <div class="colab-cell-content">
        <div
          v-if="!cell.isEditing"
          class="colab-cell-display"
          @dblclick="toggleEdit(cell)"
          @mouseenter="hoveredCell = cell.id"
          @mouseleave="hoveredCell = null"
        >
          <div v-if="cell.content.trim()" class="cell-text">
            {{ cell.content }}
          </div>
          <div v-else class="cell-placeholder">
            Haz doble clic (o ingresa) para editar
          </div>
        </div>
        <textarea
          v-else
          v-model="cell.content"
          class="colab-cell-input"
          @blur="saveCell(cell)"
          @keydown.enter.exact.prevent="addCellAfter(index)"
          @keydown.escape="cancelEdit(cell)"
          ref="cellInputs"
          :data-cell-id="cell.id"
        ></textarea>
      </div>
    </div>
    
    <div class="colab-add-cell">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        @click="addCell"
      >
        <IconPlus />
        Agregar celda
      </button>
    </div>
  </div>
</template>

<script setup>
import { IconArrowUp, IconArrowDown, IconTrash, IconDotsVertical, IconPlus, IconHome, IconUser, IconEdit, IconSettings, IconLogin, IconX, IconSearch, IconCheck, IconSitemap, IconLink, IconEye, IconId, IconLock, IconChecks, IconListCheck, IconRefresh, IconArrowLeft, IconStack, IconCircleX, IconUserPlus, IconCertificate, IconInfoCircle } from '@tabler/icons-vue';

const tablerIconMap = {
  'home': IconHome, 'user': IconUser, 'edit': IconEdit, 'cog': IconSettings, 'sign-in-alt': IconLogin,
  'times': IconX, 'search': IconSearch, 'check': IconCheck, 'sitemap': IconSitemap, 'link': IconLink,
  'eye': IconEye, 'plus': IconPlus, 'id-card': IconId, 'lock': IconLock, 'check-double': IconChecks,
  'list-check': IconListCheck, 'rotate-right': IconRefresh, 'backward': IconArrowLeft, 'layer-group': IconStack,
  'times-circle': IconCircleX, 'user-plus': IconUserPlus, 'ellipsis-vertical': IconDotsVertical,
  'arrow-up': IconArrowUp, 'arrow-down': IconArrowDown, 'trash': IconTrash, 'certificate': IconCertificate,
  'info-circle': IconInfoCircle
};

import { ref, nextTick, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue']);

const cells = ref([]);
const hoveredCell = ref(null);
const cellInputs = ref([]);

// Inicializar celdas desde modelValue o crear una por defecto
const initializeCells = () => {
  if (props.modelValue && props.modelValue.length > 0) {
    cells.value = props.modelValue.map((content, index) => ({
      id: `cell-${Date.now()}-${index}`,
      content: content,
      isEditing: false
    }));
  } else {
    cells.value = [{
      id: `cell-${Date.now()}`,
      content: '',
      isEditing: true
    }];
  }
};

// Observar cambios en modelValue
watch(() => props.modelValue, (newVal) => {
  if (newVal && newVal.length !== cells.value.length) {
    initializeCells();
  }
}, { immediate: true });

// Observar cambios en cells y emitir al padre
watch(cells, (newCells) => {
  const contents = newCells.map(cell => cell.content);
  emit('update:modelValue', contents);
}, { deep: true });

const addCell = () => {
  const newCell = {
    id: `cell-${Date.now()}-${Math.random()}`,
    content: '',
    isEditing: true
  };
  cells.value.push(newCell);
  nextTick(() => {
    focusCell(newCell.id);
  });
};

const addCellAfter = (index) => {
  const newCell = {
    id: `cell-${Date.now()}-${Math.random()}`,
    content: '',
    isEditing: true
  };
  cells.value.splice(index + 1, 0, newCell);
  nextTick(() => {
    focusCell(newCell.id);
  });
};

const deleteCell = (index) => {
  if (cells.value.length > 1) {
    cells.value.splice(index, 1);
  } else {
    cells.value[0].content = '';
    cells.value[0].isEditing = true;
  }
};

const moveCellUp = (index) => {
  if (index > 0) {
    const cell = cells.value.splice(index, 1)[0];
    cells.value.splice(index - 1, 0, cell);
  }
};

const moveCellDown = (index) => {
  if (index < cells.value.length - 1) {
    const cell = cells.value.splice(index, 1)[0];
    cells.value.splice(index + 1, 0, cell);
  }
};

const toggleEdit = (cell) => {
  cell.isEditing = !cell.isEditing;
  if (cell.isEditing) {
    nextTick(() => {
      focusCell(cell.id);
    });
  }
};

const saveCell = (cell) => {
  cell.isEditing = false;
};

const cancelEdit = (cell) => {
  cell.isEditing = false;
};

const focusCell = (cellId) => {
  const input = cellInputs.value?.find(el => el?.dataset?.cellId === cellId);
  if (input) {
    input.focus();
  }
};

const showCellMenu = (cell) => {
  // TODO: Implementar menú de opciones adicionales
  console.log('Menú de celda:', cell);
};

initializeCells();
</script>

<style scoped>
.colab-editor {
  background: var(--brand-white);
  border-radius: var(--radius-md);
  padding: 1rem;
  min-height: 400px;
}

.colab-cell {
  position: relative;
  margin-bottom: 0.5rem;
  border: 1px solid var(--brand-border);
  border-radius: var(--radius-sm);
  background: var(--brand-white);
  transition: all 0.2s ease;
}

.colab-cell:hover {
  border-color: var(--brand-accent);
  box-shadow: var(--brand-shadow-soft);
}

.colab-cell.is-editing {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px rgba(var(--brand-primary-rgb), 0.1);
}

.colab-cell-toolbar {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  display: flex;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  box-shadow: var(--brand-shadow-soft);
  z-index: 10;
}

.colab-cell-content {
  padding: 1rem;
  min-height: 60px;
}

.colab-cell-display {
  min-height: 40px;
  cursor: text;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s ease;
}

.colab-cell-display:hover {
  background-color: var(--brand-surface);
}

.cell-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--brand-navy);
  line-height: 1.6;
  font-size: 0.875rem; /* Ajustado a un tamaño más pequeño y legible (text-sm de Tailwind) */
}

.cell-placeholder {
  color: var(--brand-muted);
  font-style: italic;
  padding: 0.5rem;
}

.colab-cell-input {
  width: 100%;
  min-height: 100px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem; /* Ajustado el tamaño de la fuente para consistencia */
  line-height: 1.6;
  padding: 0.5rem;
  color: var(--brand-navy);
  background: transparent;
}

.colab-add-cell {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--brand-border);
  text-align: center;
}

.btn-link {
  text-decoration: none;
  padding: 0.25rem 0.5rem;
}

.btn-link:hover {
  background-color: var(--brand-surface);
  border-radius: var(--radius-sm);
}

.btn-link:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
