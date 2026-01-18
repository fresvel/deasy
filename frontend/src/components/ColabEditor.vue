<template>
  <div class="colab-editor">
    <div
      v-for="(cell, index) in cells"
      :key="cell.id"
      class="colab-cell"
      :class="{ 'is-editing': cell.isEditing }"
    >
      <div class="colab-cell-toolbar" v-show="cell.isEditing || hoveredCell === cell.id">
        <button
          type="button"
          class="btn btn-sm btn-link text-muted p-1"
          @click="moveCellUp(index)"
          :disabled="index === 0"
          title="Mover arriba"
        >
          <font-awesome-icon icon="arrow-up" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-link text-muted p-1"
          @click="moveCellDown(index)"
          :disabled="index === cells.length - 1"
          title="Mover abajo"
        >
          <font-awesome-icon icon="arrow-down" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-link text-primary p-1"
          @click="toggleEdit(cell)"
          :title="cell.isEditing ? 'Guardar' : 'Editar'"
        >
          <font-awesome-icon :icon="cell.isEditing ? 'check' : 'edit'" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-link text-danger p-1"
          @click="deleteCell(index)"
          title="Eliminar"
        >
          <font-awesome-icon icon="trash" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-link text-muted p-1"
          @click="showCellMenu(cell)"
          title="Más opciones"
        >
          <font-awesome-icon icon="ellipsis-vertical" />
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
        class="btn btn-outline-primary btn-sm"
        @click="addCell"
      >
        <font-awesome-icon icon="plus" class="me-2" />
        Agregar celda
      </button>
    </div>
  </div>
</template>

<script setup>
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
  font-size: 0.95rem;
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
