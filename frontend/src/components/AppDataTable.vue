<template>
  <div :class="responsiveClass">
    <div v-if="scrollClass" :class="scrollClass">
      <table :class="resolvedTableClass">
        <thead v-if="showHeader">
          <tr>
            <th v-for="field in fields" :key="field.name" :class="headerCellClass">
              {{ field.label || field.name }}
            </th>
            <th v-if="$slots.actions" :class="[headerCellClass, actionsHeaderClass]">{{ actionsLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td :colspan="fields.length + ($slots.actions ? 1 : 0)" :class="emptyCellClass">
              <slot name="empty">
                <p class="my-3">{{ emptyText }}</p>
              </slot>
            </td>
          </tr>
          <tr v-for="row in rows" :key="rowKey(row)" :class="rowClass">
            <slot name="row" :row="row" :fields="fields">
              <td v-for="field in fields" :key="field.name" :class="bodyCellClass">
                <slot name="cell" :row="row" :field="field">
                  {{ row[field.name] }}
                </slot>
              </td>
              <td v-if="$slots.actions" :class="[bodyCellClass, actionsBodyClass]">
                <slot name="actions" :row="row" />
              </td>
            </slot>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  fields: {
    type: Array,
    default: () => []
  },
  rows: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: Function,
    required: true
  },
  emptyText: {
    type: String,
    default: "No hay registros disponibles"
  },
  actionsLabel: {
    type: String,
    default: "ACCION"
  },
  tableClass: {
    type: String,
    default: ""
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  responsiveClass: {
    type: String,
    default: "deasy-table-responsive"
  },
  scrollClass: {
    type: String,
    default: ""
  },
  headerCellClass: {
    type: String,
    default: "text-start"
  },
  bodyCellClass: {
    type: String,
    default: ""
  },
  actionsHeaderClass: {
    type: String,
    default: "text-start admin-action-col"
  },
  actionsBodyClass: {
    type: String,
    default: "text-end admin-action-col"
  },
  rowClass: {
    type: String,
    default: ""
  },
  emptyCellClass: {
    type: String,
    default: "px-4 py-8 text-center text-sm text-slate-500"
  }
});

const resolvedTableClass = computed(() => props.tableClass || "deasy-table");
</script>
