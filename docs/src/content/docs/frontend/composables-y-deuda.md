---
title: "El frontend: composables, tiempo real y deuda"
description: "Los composables que sostienen la app, Socket.IO en el cliente y los God Objects que quedan."
sidebar:
  order: 1
---
El patron comun: una función `useXxx({ deps })` que **declara y devuelve sus propios `ref`**, con dependencias inyectadas de solo lectura. Nada de `provide`/`inject`, nada de singletons reactivos.

`useFlowBuilder.js` (modulo `home`) es el constructor del *flujo routed*: quien elabora (`flowEntrega`) y quien firma (`flowFirma`, con pasos ordenados que llevan `signers`, `approval_mode` y `required_min`). Fue extraido de `HomeView.vue` durante la fase B del refactor del God Object.

Otros: `useProcessPanels.js`, `useDeliverableView.js` (38 KB, el mayor), `useDocumentCenter.js`, `useGeneralTask.js`, `useRecipientSearch.js`, `useWorkspaceChrome.js` (estado del *chrome* compartido por las cuatro vistas que montan `AppWorkspaceShell`), y 24 composables en el modulo admin repartidos en seis subcarpetas (`data/`, `fk/`, `forms/`, `modals/`, `processes/`, `ui/`).

## Tiempo real en el cliente

Un único cliente: `src/core/services/realtimeClient.js` (clase `RealtimeClient` exportada como singleton).

- Autentica con `auth: { token: localStorage.token }` — el mismo JWT que el `httpClient`.

- Resuelve el destino según la base: si es absoluta, `io(base, {path: "/socket.io"})`; si es relativa (`/api`, detras de nginx), `io({path: "/api/socket.io"})` sobre el mismo origen.

- Reconexion infinita con backoff de 1 a 8 segundos; `connect()` es idempotente y **reconecta si el token cambio**.

Su único consumidor es `WorkspaceChatLauncher.vue`, que escucha `chat.message.created` y `chat.notification.created`.

:::note[Código muerto detectado]

`subscribeProcess` y `unsubscribeProcess` están definidos en el cliente pero **no tienen ningun llamador** en `src/`.

:::

## Vue Flow y dagre: los dos grafos

Se usan **solo** en el modulo admin, para dos grafos interactivos:

- **Organigrama de unidades** — `modules/admin/components/units/UnitGraphView.vue` (55 KB), con nodos y aristas propios (`UnitNode.vue`, `UnitEdge.vue`).

- **Mapa de procesos** — `ProcessGraphView.vue` (52 KB), con `ProcessNode.vue`, `ProcessConfigNode.vue` y `ProcessTemplateNode.vue`.

`dagre` calcula el layout jerarquico de arriba a abajo automáticamente, así no hay que posicionar nodos a mano. Ambos se cargan con `defineAsyncComponent(() => import(...))`, de modo que Vue Flow y dagre **quedan fuera del bundle inicial** y solo se descargan al abrir esas dos pantallas.

Se alcanzan por URL: `/admin/academia/unidades/organigrama` y `/admin/gestiones/procesos/mapa`.

:::note

**Nota** El constructor de flujos de firma **no** usa Vue Flow: es un formulario de listas (`useFlowBuilder.js`).

:::

## Los “God Objects” (deuda tecnica visible)

| **Fichero**                                                   | **Tamano**                     |
|:--------------------------------------------------------------|:-------------------------------|
| `modules/home/views/HomeView.vue`                              | **215 KB** (5 129 líneas)  |
| `modules/admin/components/tables/AdminTableManager.vue`        | 162 KB                     |
| `modules/firmas/components/FirmarPdf.vue`                      | 109 KB                     |
| `modules/admin/components/modals/AdminDraftArtifactModal.vue`  | 71 KB                      |
| `modules/admin/components/units/UnitGraphView.vue`             | 55 KB                      |
| `modules/admin/components/units/ProcessGraphView.vue`          | 52 KB                      |
| `modules/firmas/components/MultiSignerPanel.vue`               | 46 KB                      |
| `modules/admin/views/AdminView.vue`                            | 42 KB                      |
| `modules/home/composables/useDeliverableView.js`               | 38 KB                      |

Están en el plan de calidad y se están troceando extrayendo composables — así nacio `useFlowBuilder.js`.

:::tip[Que es un “God Object”]

Un objeto (aquí, un componente) que sabe y hace demasiado: acumula responsabilidades de varios dominios hasta que nadie puede cambiarlo sin miedo. El sintoma es el tamano, pero el problema real es que *cualquier* cambio lo toca, así que todos los cambios entran en conflicto y ningun test lo cubre entero. La cura no es partirlo por líneas, sino **extraer responsabilidades completas** (un composable con su estado propio) una a una.

:::
