<template>
  <div :class="responsiveClass">
    <div v-if="scrollClass" :class="scrollClass">
      <table :class="tableClass">
        <thead v-if="showHeader">
          <tr>
            <th v-for="field in fields" :key="field.name" class="text-start">
              {{ field.label || field.name }}
            </th>
            <th v-if="$slots.actions" class="text-start admin-action-col">{{ actionsLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td :colspan="fields.length + ($slots.actions ? 1 : 0)" class="px-4 py-8 text-center text-sm text-slate-500">
              <slot name="empty">
                <p class="my-3">{{ emptyText }}</p>
              </slot>
            </td>
          </tr>
          <tr v-for="row in rows" :key="rowKey(row)">
            <slot name="row" :row="row" :fields="fields">
              <td v-for="field in fields" :key="field.name">
                <slot name="cell" :row="row" :field="field">
                  {{ row[field.name] }}
                </slot>
              </td>
              <td v-if="$slots.actions" class="text-end admin-action-col">
                <slot name="actions" :row="row" />
              </td>
            </slot>
          </tr>
        </tbody>
      </table>
    </div>
    <table v-else :class="tableClass">
      <thead v-if="showHeader" class="admin-table-head">
        <tr>
          <th v-for="field in fields" :key="field.name" class="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {{ field.label || field.name }}
          </th>
          <th v-if="$slots.actions" class="admin-action-col px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{{ actionsLabel }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-if="rows.length === 0">
          <td :colspan="fields.length + ($slots.actions ? 1 : 0)" class="px-4 py-8 text-center text-sm text-slate-500">
            <slot name="empty">
              <p class="my-3">{{ emptyText }}</p>
            </slot>
          </td>
        </tr>
        <tr v-for="row in rows" :key="rowKey(row)">
          <slot name="row" :row="row" :fields="fields">
              <td v-for="field in fields" :key="field.name" class="px-4 py-3 align-middle text-sm text-slate-700">
              <slot name="cell" :row="row" :field="field">
                {{ row[field.name] }}
              </slot>
            </td>
              <td v-if="$slots.actions" class="admin-action-col px-4 py-3 text-right align-middle">
                <slot name="actions" :row="row" />
              </td>
          </slot>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
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
    default: "admin-data-table min-w-full border-separate border-spacing-0 text-sm"
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  responsiveClass: {
    type: String,
    default: "overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
  },
  scrollClass: {
    type: String,
    default: "table-actions-scroll"
  }
});
</script>
