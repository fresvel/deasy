<template>
  <AppWorkspaceShell
    :menu-open="vmenu"
    :show-notify="vnotify"
    current-section="admin"
    :photo="userPhoto"
    :username="userFullName"
    sidebar-subtitle="Administración"
    @menu-toggle="toggleMenu"
    @close-mobile="closeMenu"
    @notify="toggleNotify"
    @notify-close="closeNotify"
    @sign="isSigningView = !isSigningView"
    @primary-nav="revealSidebarForNav"
  >

      <template #header>
        <AppContextHeader :title="adminShellHeaderTitle" :subtitle="adminShellHeaderSubtitle" />
      </template>

      <template #sidebar>

          <div class="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 xl:max-h-[calc(100vh-14rem)] custom-scrollbar custom-scrollbar--dark">
            <div class="deasy-nav-shell">
              <div class="deasy-nav-section">
                <button 
                  type="button" 
                  @click="goAdminHome" 
                  class="deasy-nav-item"
                  :class="isHomeActive ? 'deasy-nav-item--active' : ''"
                >
                  <span class="deasy-nav-item__icon">
                    <IconHome class="h-4.5 w-4.5 shrink-0" />
                  </span>
                  <span>Inicio</span>
                </button>
              </div>

            <div v-for="group in groupedTables" :key="group.key" class="deasy-nav-section">
              <button
                class="deasy-nav-group-title"
                :class="{ 'deasy-nav-item--subtle-active': openCategories[group.label] }"
                type="button"
                @click="onGroupTitleClick(group)"
              >
                <div class="flex items-center gap-4">
                  <span class="deasy-nav-glyph" :class="workspaceIconToneClass(groupIconMeta(group).tone, 'deasy-nav-glyph')">
                    <component :is="groupIconMeta(group).icon" class="h-5 w-5 shrink-0" />
                  </span>
                  <span>{{ group.label }}</span>
                </div>
                <IconChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': openCategories[group.label] }" />
              </button>

              <div v-show="openCategories[group.label]" class="deasy-nav-tree">
                <!-- Una sola rama para los siete grupos: los ítems son las categorías del grupo, que
                     salen del backend. Antes había CINCO ramas calcadas, una por sección. -->
                <template v-if="menuItemsDe(group.key).length">
                  <button
                    v-for="item in menuItemsDe(group.key)"
                    :key="item.key"
                    class="deasy-nav-item"
                    :class="[isSectionItemActive(group.key, item) ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="openGroupItem(group, item)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(resolveIconMeta(item.icon, item.label).tone)">
                      <component :is="resolveIconMeta(item.icon, item.label).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else>
                  <button
                    v-for="table in group.mainTables"
                    :key="table.table"
                    class="deasy-nav-item"
                    :class="[selectedTable?.table === table.table ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="selectTable(table)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(tableIconMeta(table.table).tone)">
                      <component :is="tableIconMeta(table.table).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ table.label }}</span>
                  </button>
                  <div v-if="group.supportTables.length" class="deasy-overline pl-4 pt-2 pb-1">
                    Relaciones y soporte
                  </div>
                  <button
                    v-for="table in group.supportTables"
                    :key="table.table"
                    class="deasy-nav-item"
                    :class="[selectedTable?.table === table.table ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="selectTable(table)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(tableIconMeta(table.table).tone)">
                      <component :is="tableIconMeta(table.table).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ table.label }}</span>
                  </button>
                </template>
              </div>
            </div>
            </div>
          </div>
      </template>

        <template v-if="isSigningView">
          <FirmarPdf />
        </template>
        <template v-else>
        <div v-if="!selectedTable && !canalesTabActive && !legalesTabActive">
          <div class="flex flex-col min-h-100">
            <div v-if="loadingMeta" class="flex-1 flex items-center justify-center">
               <div class="inline-flex items-center gap-3">
                 <div class="deasy-spinner deasy-spinner--lg text-info"></div>
                 <span class="text-muted font-medium">Cargando catálogos...</span>
               </div>
            </div>
            <AppAlert class="text-center" v-else-if="metaError">{{ metaError }}</AppAlert>
            <template v-else>
               <AppPageHeader size="hero" shell-class="mb-8" :overline="adminHeroKicker" :title="adminHeroTitle" :description="adminHeroDescription">
                 <template #media><component :is="adminHeroIcon" class="h-10 w-10" /></template>
                 <template #actions>
                   <AppButton variant="neutral-outline" @click="handleHeroBack">
          <IconArrowLeft class="h-4.5 w-4.5" />
          <span>Volver</span>
        </AppButton>
                 </template>
               </AppPageHeader>
               
               <div class="deasy-tile-grid">
                 <!-- Un solo índice para los siete grupos. Antes eran cinco bloques calcados. -->
                 <template v-if="showSectionIndex">
                    <AppNavCard
                      v-for="item in currentSectionItems"
                      :key="item.key"
                      :title="item.label"
                      :description="item.description || 'Administra y configura los datos de esta sección.'"
                      :icon="resolveIconMeta(item.icon, item.label).icon"
                      show-arrow
                      @click="openItem(item)"
                    />
                      <!-- Los canales NO son una tabla ni cuelgan de ninguna: su tarjeta va aqui,
                           en la portada de Institucion, junto a las que si lo son. -->
                      <AppNavCard
                        v-if="selectedSection === 'institucion'"
                        title="Canales de mensajería"
                        description="Por dónde puede alguien demostrar que un teléfono es suyo. Estado de Telegram y WhatsApp."
                        :icon="IconMessage2"
                        show-arrow
                        @click="abrirCanales()"
                      />
                      <!-- Los textos legales tampoco son una tabla: viven en MinIO, no en una
                           columna. Y la tarjeta se esconde sin permiso de lectura, porque quien
                           administra unidades no tiene por que ver el borrador de un texto legal. -->
                      <AppNavCard
                        v-if="selectedSection === 'institucion' && puedeVerLegales"
                        title="Documentos legales"
                        description="Términos de uso y tratamiento de datos: redactar, publicar y retirar. Lo publicado es inmutable."
                        :icon="IconGavel"
                        show-arrow
                        @click="abrirLegales()"
                      />
                    <div v-if="traceabilityTables.length" class="col-span-full mt-2">
                      <button
                        type="button"
                        class="deasy-picker deasy-picker--flat justify-between"
                        @click="traceabilityOpen = !traceabilityOpen"
                      >
                        <span>
                          <span class="block text-sm font-bold text-body">Trazabilidad y soporte</span>
                          <span class="block text-xs text-muted">Registros técnicos generados durante la ejecución de tareas, entregas y firmas. Disponibles para consulta, diagnóstico y soporte.</span>
                        </span>
                        <IconChevronDown class="h-4 w-4 shrink-0 transition-transform duration-200" :class="{ 'rotate-180': traceabilityOpen }" />
                      </button>
                      <div v-show="traceabilityOpen" class="deasy-tile-grid mt-3">
                        <AppNavCard
                          v-for="table in traceabilityTables"
                          :key="table.table"
                          :title="table.label"
                          meta="Consultar"
                          :description="table.description || 'Registro técnico generado por el sistema durante la ejecución.'"
                          :icon="tableIconMeta(table.table).icon"
                          show-arrow
                          @click="selectTable(table)"
                        />
                      </div>
                    </div>
                 </template>
                 <template v-else>
                    <AppNavCard
                      v-for="group in homeGroups"
                      :key="group.key"
                      :title="group.label"
                      :description="descriptionForGroup(group)"
                      :icon="groupIconMeta(group).icon"
                      show-arrow
                      @click="openGroupFromHome(group)"
                    />
                 </template>
               </div>
            </template>
          </div>
        </div>

          <!-- ⚠️ RAMA PROPIA, no un modo de `AdminTableManager`: esta pantalla no habla de ninguna
               tabla, y ese componente ya carga con dos injertos concentrados. -->
          <div v-else-if="canalesTabActive" class="w-full flex-1 overflow-hidden relative flex flex-col min-h-0">
            <div class="deasy-typography w-full h-full relative overflow-y-auto p-6">
              <CanalesPanel @volver="volverDeCanales()" />
            </div>
          </div>

          <!-- Misma rama propia, y por el mismo motivo: los textos legales no son una tabla. Su
               contenido vive en MinIO y su ciclo de vida no lo gobierna ningun CRUD generico. -->
          <div v-else-if="legalesTabActive" class="w-full flex-1 overflow-hidden relative flex flex-col min-h-0">
            <div class="deasy-typography w-full h-full relative overflow-y-auto p-6">
              <DocumentosLegalesPanel @volver="volverDeLegales()" />
            </div>
          </div>

        <div v-else class="w-full flex-1 overflow-hidden relative flex flex-col min-h-0">
          <div class="deasy-typography w-full h-full relative overflow-y-auto">
             <AdminTableManager
               ref="adminManager"
               :table="selectedTable"
               :sibling-tabs="currentSiblingTabs"
               :active-sibling-tab="graphTabActive ? ORG_GRAPH_TAB_KEY : (processGraphTabActive ? PROCESS_GRAPH_TAB_KEY : (selectedTable?.table || ''))"
               :force-graph="graphTabActive"
               :force-process-graph="processGraphTabActive"
               :all-tables="tables"
               :initial-filters="pendingTableFilters"
               @select-sibling-tab="handleSiblingTabChange"
               @go-back="handleManagerGoBack"
             />
          </div>
        </div>
        </template>
  </AppWorkspaceShell>

  <WorkspaceChatLauncher :current-person-id="currentUser?.id || currentUser?._id || null" />
</template>

<script setup>

import { computed, onMounted, ref } from "vue";
import AppPageHeader from "@/shared/components/layout/AppPageHeader.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppContextHeader from "@/shared/components/layout/AppContextHeader.vue";
import { useWorkspaceChrome } from "@/shared/composables/useWorkspaceChrome.js";

import {
  IconLock,
  IconCircle,
  IconInfoCircle,
  IconPlus,
  IconBell,
  IconArrowLeft,
  IconChevronDown,
  IconHome,
  // ⚠️ `IconMessage2` FALTABA. La tarjeta de canales lo nombra desde que se escribio y nadie lo
  // importaba: en `<script setup>` eso no es un error, es `undefined`, asi que `AppNavCard` recibia
  // un icono vacio y la tarjeta salia sin glifo. No lo ve el build ni el lint.
  IconMessage2,
  IconGavel,
} from '@tabler/icons-vue'

import axios from "@/core/services/httpClient";
import { useRoute, useRouter } from "vue-router";
import AppNavCard from "@/shared/components/layout/AppNavCard.vue";
import CanalesPanel from "../components/canales/CanalesPanel.vue";
import DocumentosLegalesPanel from "../components/legales/DocumentosLegalesPanel.vue";
import AppWorkspaceShell from "@/layouts/workspace/AppWorkspaceShell.vue";
import WorkspaceChatLauncher from "@/shared/components/widgets/WorkspaceChatLauncher.vue";
import AdminTableManager from "@/modules/admin/components/tables/AdminTableManager.vue";
import FirmarPdf from "@/modules/firmas/components/FirmarPdf.vue";
import { API_ROUTES } from "@/core/config/apiConfig";
import {
  resolveWorkspaceAdminGroupIcon,
  resolveWorkspaceAdminTableIcon,
  resolveWorkspaceProfileMenuIcon,
  workspaceIconToneClass,
} from "@/shared/utils/workspaceNavIcons.js";
import { canAccessResource, canReadAdminTable, isTraceabilityTable, registrarRecursosDeTablas } from "@/core/utils/accessControl.js";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";

const { menuOpen: vmenu, showNotify: vnotify, toggleMenu, closeMenu, toggleNotify, closeNotify, revealSidebarForNav } =
  useWorkspaceChrome();
const isSigningView = ref(false);
const tables = ref([]);
const loadingMeta = ref(false);
const metaError = ref("");
const pendingTableFilters = ref(null);
// Organigrama como pestaña hermana de las tablas de Unidades (no una tabla real).
const ORG_GRAPH_TAB_KEY = "__unit_graph__";
// Mapa de procesos como pestaña hermana de las tablas de Procesos (no una tabla real).
const PROCESS_GRAPH_TAB_KEY = "__process_graph__";
// Canales de mensajería: la TERCERA pestaña que no es una tabla, y la primera que no cuelga de
// ninguna. Se pinta AQUÍ y no dentro de `AdminTableManager` --donde viven los dos grafos-- a
// propósito: ese componente ya es un God con dos injertos concentrados, y meterle un tercero que
// además no tiene nada que ver con ninguna tabla es exactamente lo que el CLAUDE.md pide no hacer.
const CANALES_SLUG = "canales";
// Documentos legales: la CUARTA que no es una tabla, y por el mismo motivo que los canales — su
// contenido no esta en una columna, esta en dos buckets de MinIO, y publicar no es un UPDATE sino
// un traslado a un archivo que ya no admite escritura.
const LEGALES_SLUG = "documentos-legales";
// selectedTable / selectedSection / los cinco item / los dos grafos NO son refs: se DERIVAN de la
// URL (fase 3.5, cierre). Ver el bloque "Estado derivado de la URL" más abajo.
const openCategories = ref({});
const adminManager = ref(null);

const currentUser = ref(null);
const router = useRouter();
const route = useRoute();
const defaultPhoto = "/images/avatar.png";
const userPhoto = ref(defaultPhoto);
const userFullName = computed(() => {
  if (currentUser.value) {
    const firstName = currentUser.value.first_name ?? "";
    const lastName = currentUser.value.last_name ?? "";
    return `${firstName} ${lastName}`.trim() || "Administrador";
  }
  return "Administrador";
});

// ── EL MENÚ SE DERIVA DE LA CATEGORÍA DEL BACKEND ────────────────────────────────────────────────
//
// Aquí NO se nombra ni una tabla. Antes había TRES listas de nombres de tabla escritas a mano en
// este mismo fichero —`GROUP_DEFS.main`, `GROUP_DEFS.support` y cinco `*_INDEX_ITEMS`— y el
// `category` que el backend ya enviaba en `/admin/sql/meta` se recibía y se tiraba.
//
// Lo que costó, medido el 2026-08-28: **11 tablas** nuevas cayeron en un cajón «Otros», **19 no eran
// alcanzables navegando** porque ningún ítem las listaba, y el ítem «Documentos» apuntaba a
// `documents`, borrada el 2026-08-23. Una lista a mano se pudre en las dos direcciones.
//
// Ahora la PERTENENCIA la pone el backend (`sqlTables.js`, campo `category`) y aquí sólo queda la
// PRESENTACIÓN: cómo se llama cada categoría en pantalla, con qué icono, y en qué grupo del aside
// cae. Una tabla nueva aparece sola.

// Cómo se enseña cada categoría. La clave es EXACTAMENTE el valor de `category` del backend.
const CATEGORIA_UI = {
  Estructura: { label: "Unidades y cargos", icon: "id-card", description: "Unidades, sus relaciones, cargos, puestos y ocupaciones." },
  Geografia:  { label: "Geografía", icon: "map-marked-alt", description: "Países, provincias, cantones y parroquias." },
  Calendario: { label: "Periodos", icon: "square-check", description: "Tipos de periodo y periodos académicos." },
  Personas:   { label: "Personas", icon: "user", description: "Personas y sus documentos, correos, teléfonos, direcciones y autoidentificación." },
  VocabularioPersona: { label: "Datos personales", icon: "user", description: "Género, estado civil, autoidentificación étnica, discapacidad y parentesco." },
  Procesos:   { label: "Procesos", icon: "check-double", description: "Procesos y sus configuraciones versionadas." },
  Plantillas: { label: "Entregables", icon: "file", description: "Generadores, plantillas y su vínculo con cada configuración." },
  Tareas:     { label: "Tareas", icon: "square-check", description: "Corridas, tareas y los entregables instanciados." },
  Documentos: { label: "Documentos", icon: "file", description: "Rondas del documento, sus correcciones y sus firmas." },
  // ⚠️ AQUI HABIA UNA ENTRADA `Entrega` Y SOBRABA, mientras la que hacia falta no estaba. La categoria
  // «Entrega» murio el 2026-10-09 con las cuatro tablas del flujo de llenado, y `GROUP_DEFS` ya no la
  // nombra: era codigo muerto. La que la sustituye, «Recorrido», NO tenia entrada aqui, asi que caia al
  // valor por omision de la linea 445 --icono `circle` y descripcion VACIA-- y se veia como la unica
  // tarjeta de `/admin` sin explicacion. Lo arreglado es la pareja: fuera la muerta, dentro la viva.
  Recorrido:  { label: "Recorrido", icon: "file", description: "El recorrido del documento: los pasos declarados y el turno de cada uno." },
  Firmas:     { label: "Firmas", icon: "certificate", description: "El resultado de firmar y los lotes que se mandan al firmador." },
  Seguridad:  { label: "Roles y permisos", icon: "lock", description: "Roles, permisos, sus asignaciones y la bitácora de accesos a datos sensibles." },
  Contratos:  { label: "Vacantes y contratos", icon: "certificate", description: "Vacantes, su visibilidad y los contratos." }
};

// Los grupos del aside. `main` y `support` llevan CATEGORÍAS, no tablas: lo de `support` se pinta
// bajo el separador de apoyo, que es donde va la fontanería de los flujos.
//
// «Gestiones» se disolvió el 2026-08-28: eran 25 de las 54 tablas, casi la mitad, en un cajón cuyo
// nombre no decía nada. Se parte siguiendo la frontera que el propio modelo documenta en /modelo/
// —«declarar no crea trabajo»—: Procesos es lo que se DECLARA, Tareas lo que se DISPARA y
// Documentos lo que se PRODUCE y se firma.
const GROUP_DEFS = [
  { key: "institucion", label: "Institución", main: ["Estructura", "Geografia", "Calendario"], support: [] },
  { key: "procesos",    label: "Procesos",    main: ["Procesos", "Plantillas"], support: [] },
  { key: "tareas",      label: "Tareas",      main: ["Tareas"], support: [] },
  // ⚠️ `support` DECIA ["Entrega", "Firmas"], y la primera dejo de existir el 2026-10-09: la categoria
  // «Entrega» era la de las cuatro tablas del flujo de llenado, retiradas con las ocho del recorrido
  // partido en dos. Las cuatro que las sustituyen estan en la categoria «Recorrido» --una para los dos
  // lados-- y, hasta este arreglo, NINGUN grupo la listaba: existian en `sqlTables.js`, el backend las
  // servia, y en `/admin` no aparecian. Un grupo vacio y cuatro tablas invisibles.
  //
  // Se ve en el navegador y en ningun test: esta lista no la cruza nadie con las categorias reales.
  { key: "documentos",  label: "Documentos",  main: ["Documentos"], support: ["Recorrido", "Firmas"] },
  { key: "usuarios",    label: "Usuarios",    main: ["Personas", "VocabularioPersona"], support: [] },
  { key: "contratos",   label: "Contratos",   main: ["Contratos"], support: [] },
  { key: "seguridad",   label: "Seguridad",   main: ["Seguridad"], support: [] }
];

// El grupo que abre el organigrama por defecto al entrar en su ítem de unidades.
const INSTITUCION_GROUP_KEY = "institucion";

// Slugs de URL: la ruta usa el nombre humano en vez de la clave interna. Se derivan de la etiqueta
// para no mantener un mapa a mano — y por eso vale igual para los grupos y para los ítems.
const slugifySection = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const SECTION_SLUG_BY_KEY = Object.fromEntries(GROUP_DEFS.map((group) => [group.key, slugifySection(group.label)]));
const SECTION_KEY_BY_SLUG = Object.fromEntries(GROUP_DEFS.map((group) => [slugifySection(group.label), group.key]));

const TABLE_TAB_LABEL_OVERRIDES = {
  generadores_de_documento: "Generadores",
  ediciones: "Plantillas",
  vinculos: "Procesos asignados"
};

const hiddenTables = new Set([]);
const visibleTables = computed(() =>
  tables.value.filter((table) =>
    !hiddenTables.has(table.table) && canReadAdminTable(table.table, currentUser.value)
  )
);
const tableMap = computed(() =>
  Object.fromEntries(visibleTables.value.map((table) => [table.table, table]))
);

const tablasDeCategorias = (categorias) =>
  visibleTables.value.filter((table) => categorias.includes(table.category));

const groupedTables = computed(() => {
  const conocidas = new Set();
  const groups = GROUP_DEFS.map((group) => {
    const mainTables = tablasDeCategorias(group.main);
    const supportTables = tablasDeCategorias(group.support);
    [...mainTables, ...supportTables].forEach((table) => conocidas.add(table.table));
    return { ...group, mainTables, supportTables };
  });

  // El cajón «Otros» se conserva como RED, no como destino: si una tabla declara una categoría que
  // ningún grupo recoge, tiene que verse en pantalla en vez de desaparecer. Con la taxonomía al día
  // está vacío, y que aparezca es la señal de que falta declarar algo.
  const huerfanas = visibleTables.value.filter((table) => !conocidas.has(table.table));
  if (huerfanas.length) {
    groups.push({ key: "otros", label: "Otros", main: [], support: [], mainTables: huerfanas, supportTables: [] });
  }

  return groups;
});

// El nivel ÍTEM de la navegación (`/admin/:seccion/:item/:tabla`) ES la categoría. Antes eran cinco
// arrays escritos a mano; ahora se derivan, así que no pueden quedarse cortos.
const sectionIndexItems = computed(() => {
  const porSeccion = {};
  for (const group of GROUP_DEFS) {
    porSeccion[group.key] = [...group.main, ...group.support]
      .map((categoria) => {
        const ui = CATEGORIA_UI[categoria] || { label: categoria, icon: "circle", description: "" };
        const availableTables = tablasDeCategorias([categoria]);
        return { key: slugifySection(ui.label), categoria, ...ui, tables: availableTables.map((t) => t.table), availableTables, tableCount: availableTables.length };
      })
      // Una tarjeta sin tablas visibles no tiene a dónde navegar: se oculta, como antes.
      .filter((item) => item.tableCount > 0);
  }
  return porSeccion;
});


const homeGroups = computed(() =>
  groupedTables.value.filter((group) => (group.mainTables.length + group.supportTables.length) > 0)
);

// Los ítems de la sección abierta. Antes eran cinco computeds idénticos —uno por sección— y cinco
// bloques de plantilla calcados; el propio fichero ya se quejaba de "repetir el mismo bloque cinco
// veces, una por sección".
const menuItemsDe = (sectionKey) => sectionIndexItems.value[sectionKey] || [];
const currentSectionItems = computed(() => menuItemsDe(selectedSection.value));


// --- Estado derivado de la URL (fase 3.5, cierre) -----------------------------------------------
// /admin/:section?/:item?/:table? ES el estado de navegación: no hay copia local que sincronizar.
// Antes convivían refs locales (selectedTable, selectedSection y los cinco selectedXItem, más los
// dos flags de grafo) con route.params: un watch empujaba de los refs a la URL (syncAdminUrl) y
// hydrateFromRoute empujaba de vuelta al montar. Ese doble origen de verdad es lo que obligaba a
// repetir el mismo bloque de asignaciones cinco veces, una por sección.
// Ahora todo se DERIVA de route.params y navegar es un router.push. App.vue re-monta la vista por
// route.fullPath, así que cada navegación reconstruye la vista desde la URL — igual que un F5.
// La firma (isSigningView) sigue siendo overlay modal, NO ruta (por diseño).

// El grafo se muestra SOBRE la tabla units/processes (force-graph); en la URL es su propio :table.
const UNIT_GRAPH_SLUG = "organigrama";
const PROCESS_GRAPH_SLUG = "mapa";

const findTableByName = (name) => {
  for (const group of groupedTables.value) {
    const match = [...(group.mainTables || []), ...(group.supportTables || [])]
      .find((candidate) => candidate.table === name);
    if (match) return match;
  }
  return null;
};

// A qué sección/ítem pertenece una tabla. Es la cadena if/else de la antigua selectTable, sin repetir.
const resolveSectionByTable = (tableName) => {
  for (const [sectionKey, items] of Object.entries(sectionIndexItems.value)) {
    if (items.some((item) => item.tables.includes(tableName))) return sectionKey;
  }
  const group = groupedTables.value.find((candidate) =>
    [...candidate.mainTables, ...candidate.supportTables].some((item) => item.table === tableName)
  );
  return group?.key || "";
};

const resolveItemByTable = (tableName) => {
  for (const items of Object.values(sectionIndexItems.value)) {
    const match = items.find((item) => item.tables.includes(tableName));
    if (match) return match.key;
  }
  return "";
};

const routeTableSlug = computed(() => route.params.table || "");
const graphTabActive = computed(() => routeTableSlug.value === UNIT_GRAPH_SLUG);
const processGraphTabActive = computed(() => routeTableSlug.value === PROCESS_GRAPH_SLUG);
const canalesTabActive = computed(() =>
  selectedSection.value === "institucion" && routeTableSlug.value === CANALES_SLUG);
const legalesTabActive = computed(() =>
  selectedSection.value === "institucion" && routeTableSlug.value === LEGALES_SLUG);
// ⚠️ ESTO SOLO DECIDE QUE SE ENSEÑA. Quien manda es el backend (`legal_documents.*`): esconder la
// tarjeta evita ofrecer una pantalla que devolveria 403, no protege nada por si mismo.
const puedeVerLegales = computed(() => canAccessResource("legal_documents", "read", currentUser.value));

// La URL ES el estado de navegación, como en el resto del admin: no hay un `ref` que diga «estoy en
// canales». Se entra navegando y se sale navegando, así que un enlace directo funciona y recargar
// deja la pantalla donde estaba.
const abrirCanales = () => navigateAdmin({ section: "institucion", item: CANALES_SLUG, table: CANALES_SLUG });
const volverDeCanales = () => navigateAdmin({ section: "institucion" });

const abrirLegales = () => navigateAdmin({ section: "institucion", item: LEGALES_SLUG, table: LEGALES_SLUG });
const volverDeLegales = () => navigateAdmin({ section: "institucion" });

const selectedTable = computed(() => {
  const tableName = graphTabActive.value
    ? "units"
    : processGraphTabActive.value
      ? "processes"
      : routeTableSlug.value;
  return tableName ? findTableByName(tableName) : null;
});

// Con tabla, la sección y el ítem los manda la tabla (la URL puede traer un slug obsoleto); sin
// tabla, los manda el slug de la URL. El "-" es el marcador posicional de ítem vacío.
const selectedSection = computed(() => {
  const table = selectedTable.value;
  if (table) return resolveSectionByTable(table.table);
  const slug = route.params.section || "";
  // hasOwn y no un acceso a secas: el slug viene de la URL y "constructor"/"toString" darían un valor
  // heredado del prototipo, que aquí pasaría por una sección válida.
  return Object.hasOwn(SECTION_KEY_BY_SLUG, slug) ? SECTION_KEY_BY_SLUG[slug] : "";
});

const activeItemKey = computed(() => {
  const table = selectedTable.value;
  if (table) return resolveItemByTable(table.table);
  const itemSlug = route.params.item || "";
  return itemSlug === "-" ? "" : itemSlug;
});

const currentSiblingSourceItem = computed(() => {
  const tableName = selectedTable.value?.table;
  if (!tableName) {
    return null;
  }

  // Las pestañas hermanas salen del ítem que contiene la tabla abierta, sea del grupo que sea.
  return Object.values(sectionIndexItems.value)
    .flat()
    .find((item) => item.availableTables.some((table) => table.table === tableName)) || null;
});

const currentSiblingTabs = computed(() => {
  if (!selectedTable.value || !currentSiblingSourceItem.value) {
    return [];
  }

  const availableTables = currentSiblingSourceItem.value.availableTables || [];
  if (availableTables.length < 2) {
    return [];
  }

  const tabs = availableTables.map((table) => ({
    key: table.table,
    label: TABLE_TAB_LABEL_OVERRIDES[table.table] || table.label || table.table
  }));
  // Pestaña hermana "Organigrama" para el grupo que contiene unidades.
  if (availableTables.some((table) => table.table === "units")) {
    tabs.push({ key: ORG_GRAPH_TAB_KEY, label: "Organigrama" });
  }
  // Pestaña hermana "Mapa de procesos" para el grupo que contiene procesos.
  if (availableTables.some((table) => table.table === "processes")) {
    tabs.push({ key: PROCESS_GRAPH_TAB_KEY, label: "Mapa de procesos" });
  }
  return tabs;
});

// El índice de sección: la portada de un grupo, con una tarjeta por ítem. Antes eran CINCO
// computeds idénticos y cinco bloques de plantilla calcados, uno por sección.
const showSectionIndex = computed(() => Boolean(selectedSection.value) && !selectedTable.value);
const currentGroup = computed(() => GROUP_DEFS.find((g) => g.key === selectedSection.value) || null);

// Tablas runtime (registros materializados por los flujos). Se muestran aparte, en el bloque colapsable
// "Trazabilidad y soporte", ya filtradas por permiso de lectura (visibleTables).
const traceabilityOpen = ref(false);
const traceabilityTables = computed(() =>
  visibleTables.value.filter((table) => isTraceabilityTable(table.table))
);

const HERO_POR_GRUPO = {
  institucion: { icon: "map-marked-alt", description: "Unidades, cargos, geografía y periodos: cómo se describe la institución." },
  procesos:    { icon: "check-double", description: "Lo que se DECLARA: procesos, sus configuraciones y las plantillas que producen." },
  tareas:      { icon: "square-check", description: "Lo que se DISPARA: corridas, tareas y los entregables instanciados." },
  documentos:  { icon: "file", description: "Lo que se PRODUCE: rondas del documento, su recorrido y sus firmas." },
  usuarios:    { icon: "user", description: "Personas y sus datos: documentos, correos, teléfonos y direcciones." },
  contratos:   { icon: "certificate", description: "Vacantes, su visibilidad y los contratos." },
  seguridad:   { icon: "lock", description: "Roles, permisos y sus asignaciones." }
};

const adminHeroIcon = computed(() => {
  const hero = HERO_POR_GRUPO[selectedSection.value];
  return hero ? resolveIconMeta(hero.icon, currentGroup.value?.label || "").icon : IconLock;
});

const adminHeroTitle = computed(() => currentGroup.value?.label || "Panel de administración");

const adminHeroDescription = computed(() =>
  HERO_POR_GRUPO[selectedSection.value]?.description
  || "Accesos organizados para crear, editar, leer y eliminar datos del sistema."
);

const adminHeroKicker = computed(() =>
  selectedTable.value ? 'Tabla activa' : 'Administración'
);

const adminShellHeaderTitle = computed(() =>
  selectedTable.value
    ? (selectedTable.value.label || adminHeroTitle.value)
    : adminHeroTitle.value
);

const adminShellHeaderSubtitle = computed(() =>
  selectedTable.value
    ? ""
    : adminHeroDescription.value
);

// Los grafos son un :table propio en la URL, así que cambiar de pestaña hermana es siempre navegar:
// el guard de navigateAdmin sustituye al antiguo "si ya es la tabla activa, no hagas nada" (que con
// los flags de grafo como refs había que combinar a mano).
const handleSiblingTabChange = (tableName) => {
  if (tableName === ORG_GRAPH_TAB_KEY) {
    if (tableMap.value.units) navigateToTable("units", UNIT_GRAPH_SLUG);
    return;
  }
  if (tableName === PROCESS_GRAPH_TAB_KEY) {
    if (tableMap.value.processes) navigateToTable("processes", PROCESS_GRAPH_SLUG);
    return;
  }
  const targetTable = tableMap.value[tableName];
  if (targetTable) selectTable(targetTable);
};

const handleHeroBack = () => {
  // El índice de sección vuelve al panel principal de administración; desde el home, sale a /home.
  if (selectedSection.value) {
    goAdminHome();
    return;
  }
  router.push('/home');
};



const resolveIconMeta = (iconName, label = "") => {
  switch (iconName) {
    case 'map-marked-alt':
      return resolveWorkspaceAdminGroupIcon('estructura_academico');
    case 'check-double':
    case 'square-check':
      return resolveWorkspaceAdminGroupIcon('procesos');
    case 'user':
      return resolveWorkspaceAdminGroupIcon('usuarios');
    case 'id-card':
    case 'certificate':
      return resolveWorkspaceAdminGroupIcon('contratacion');
    case 'lock':
      return resolveWorkspaceAdminGroupIcon('seguridad');
    case 'plus':
      return { icon: IconPlus, tone: 'emerald' };
    case 'bell':
      return { icon: IconBell, tone: 'amber' };
    case 'circle':
      return { icon: IconCircle, tone: 'slate' };
    case 'info-circle':
      return { icon: IconInfoCircle, tone: 'slate' };
    default:
      return resolveWorkspaceProfileMenuIcon(iconName, label);
  }
};
const groupIconMeta = (group) => resolveWorkspaceAdminGroupIcon(group?.key || "");
const tableIconMeta = (tableName = "") => resolveWorkspaceAdminTableIcon(tableName);

// La descripción de cada grupo en la portada. Se mantiene junto a HERO_POR_GRUPO a propósito: una
// es la tarjeta y otra la cabecera, y decir lo mismo dos veces con palabras distintas confunde.
const groupDescMap = Object.fromEntries(
  Object.entries(HERO_POR_GRUPO).map(([key, hero]) => [key, hero.description])
);
const descriptionForGroup = (group) => groupDescMap[group?.key] || 'Gestión segura de módulos del sistema.';




// Un ítem del índice está activo si es el de la URL dentro de su sección, o si contiene la tabla
// abierta. Las cinco funciones que el template llama por nombre son ya un alias de esta.
const isSectionItemActive = (sectionKey, item) => {
  if (!item) {
    return false;
  }
  if (selectedSection.value === sectionKey && activeItemKey.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};

const openGroupIndex = (group) => {
  if (!group) {
    return;
  }
  if (sectionIndexItems.value[group.key]?.length) {
    navigateAdmin({ section: group.key });
    return;
  }
  // Grupos sin índice de sección propio (p. ej. "Otros"): ir directo a su primera tabla.
  const firstTable = [...(group.mainTables || []), ...(group.supportTables || [])][0];
  openCategories.value[group.label] = true;
  if (firstTable) {
    selectTable(firstTable);
  }
};

const onGroupTitleClick = (group) => {
  isSigningView.value = false;
  if (!group) {
    return;
  }
  const isOpen = Boolean(openCategories.value[group.label]);
  openCategories.value[group.label] = !isOpen;
  if (!isOpen) {
    openGroupIndex(group);
  }
};

// --- Navegación: escribir en la URL ---------------------------------------------------------
// Toda acción de navegación acaba aquí. Antes cada opener asignaba los siete refs y un watch
// traducía el resultado a una URL; ahora se construye la URL directamente y el estado se re-deriva.
const buildAdminParams = ({ section = "", item = "", table = "" }) => {
  const params = {};
  if (section) params.section = SECTION_SLUG_BY_KEY[section] || section;
  // El item es posicional: si hay tabla sin item resuelto, se usa "-" como marcador de hueco.
  if (params.section && (item || table)) params.item = item || "-";
  if (table) params.table = table;
  return params;
};

const navigateAdmin = (target = {}) => {
  isSigningView.value = false;
  const params = buildAdminParams(target);
  const current = route.params;
  if ((current.section || "") === (params.section || "")
    && (current.item || "") === (params.item || "")
    && (current.table || "") === (params.table || "")) {
    return;
  }
  // push (no replace): cada accion de navegacion crea UNA entrada de historial para que el boton
  // atras recorra tabla -> indice -> inicio.
  router.push({ name: "admin", params }).catch(() => {});
};

// Navega a una tabla resolviendo su seccion/item. `slug` permite abrir un grafo (organigrama/mapa),
// que en la URL es su propio :table sobre la misma tabla base.
const navigateToTable = (tableName, slug = tableName) => {
  navigateAdmin({
    section: resolveSectionByTable(tableName),
    item: resolveItemByTable(tableName),
    table: slug,
  });
};

const selectTable = (table, filters = null) => {
  if (!table) {
    return;
  }
  pendingTableFilters.value = filters;
  navigateToTable(table.table);
};

// Un item del indice va DIRECTO a las pestanas (sin menu intermedio): abre su primera tabla.
const openSectionItem = (sectionKey, item) => {
  if (!item) {
    return;
  }
  navigateAdmin({
    section: sectionKey,
    item: item.key,
    table: item.availableTables?.[0]?.table || "",
  });
};

// Desde el aside se puede abrir el ítem de un grupo que NO es el abierto, así que el grupo va
// explícito; desde el índice siempre es el de la sección en curso.
const openGroupItem = (group, item) => {
  if (!group || !item) {
    return;
  }
  if (group.key === INSTITUCION_GROUP_KEY && item.availableTables?.some((table) => table.table === "units")) {
    navigateAdmin({ section: group.key, item: item.key, table: UNIT_GRAPH_SLUG });
    return;
  }
  openSectionItem(group.key, item);
};

// Abrir un ítem: el mismo camino para los siete grupos. Antes eran cinco funciones calcadas.
const openItem = (item) => {
  if (!item) {
    return;
  }
  openGroupItem(currentGroup.value, item);
};

const openGroupFromHome = (group) => {
  if (!group) {
    return;
  }
  openGroupIndex(group);
};

const handleManagerGoBack = () => {
  if (!selectedTable.value) {
    return;
  }
  // Volver de una tabla cae en el indice de seccion (sus items), no en el indice por item (que era
  // identico a las pestanas y se elimino). Sin seccion, cae en el inicio de administracion.
  pendingTableFilters.value = null;
  navigateAdmin({ section: selectedSection.value });
};

// Sin tabla, sin seccion y sin item no hay nada abierto: los cinco showXIndex derivan de la seccion,
// asi que comprobarlos aparte era redundante.
const isHomeActive = computed(() =>
  !selectedTable.value && !selectedSection.value && !activeItemKey.value
);

const goAdminHome = () => {
  Object.keys(openCategories.value).forEach((key) => {
    openCategories.value[key] = false;
  });
  navigateAdmin();
};


const fetchMeta = async () => {
  loadingMeta.value = true;
  metaError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_META);
    const lista = response.data?.tables || [];
    // ANTES de asignar `tables`: los `computed` que filtran por permiso se recalculan al cambiar
    // `tables`, y tienen que encontrar ya el recurso de cada tabla. Ver `registrarRecursosDeTablas`.
    registrarRecursosDeTablas(lista);
    tables.value = lista;
    groupedTables.value.forEach((group) => {
      if (openCategories.value[group.label] === undefined) {
        openCategories.value[group.label] = false;
      }
    });
    // El acordeon del aside NO vive en la URL (es chrome, no navegacion): se abre la categoria de la
    // seccion activa. Es exactamente el estado en que quedaba tras hydrateFromRoute, que re-ejecutaba
    // los openers en cada remontaje (App.vue re-monta la vista por route.fullPath).
    const activeGroup = groupedTables.value.find((group) => group.key === selectedSection.value);
    if (activeGroup) {
      openCategories.value[activeGroup.label] = true;
    }
  } catch (error) {
    metaError.value = error?.response?.data?.message || "No se pudo cargar el catalogo.";
  } finally {
    loadingMeta.value = false;
  }
};

onMounted(() => {
  const userDataString = localStorage.getItem("user");
  if (userDataString) {
    try {
      currentUser.value = JSON.parse(userDataString);
    } catch {
      // Se ignora a propósito: el `user` de localStorage es un dato del cliente que puede
      // estar corrupto o venir de una versión anterior. Quedarse sin usuario en memoria es
      // la degradación correcta (la vista lo trata como no cargado); no hay nada que
      // diagnosticar en el servidor ni nada que contarle al usuario.
      currentUser.value = null;
    }
  }
  fetchMeta();
});

</script>
