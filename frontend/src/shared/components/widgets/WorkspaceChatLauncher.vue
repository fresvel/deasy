<template>
  <div>
    <AppButton
      variant="plain"
      class-name="fixed bottom-6 right-4 z-[90] inline-flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-white text-info shadow-[0_1px_2px_rgba(var(--elev-ink-rgb),0.05),0_14px_34px_rgba(var(--elev-ink-rgb),0.12)] transition hover:-translate-y-0.5 hover:border-blue-light-200 hover:bg-blue-light-50 focus:outline-none focus:ring-4 sm:right-6 sm:h-16 sm:w-16"
      aria-label="Abrir chat"
      title="Abrir chat"
      @click="openLauncher"
    >
      <IconMessages class="relative z-10 h-7 w-7 sm:h-8 sm:w-8" />
    </AppButton>

    <div
      v-if="showChat"
      class="fixed inset-0 z-95 bg-navy/30 backdrop-blur-[2px]"
      @click="closePanel"
    />

    <aside
      v-if="showChat"
      class="fixed inset-x-3 bottom-3 z-100 flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(var(--elev-ink-rgb),0.04),0_24px_64px_rgba(var(--elev-ink-rgb),0.16)] sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-6 sm:w-[min(27.5rem,calc(100vw-3rem))]"
      aria-label="Panel global de chat"
    >
      <header class="border-b border-line bg-gradient-to-b from-white to-surface/70 px-4 py-4 sm:px-5">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-light-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]">
              <component :is="view === 'conversation' ? activeModeIcon : IconMessages" class="h-5 w-5" :stroke="1.9" />
            </span>
            <div class="min-w-0">
              <h3 class="m-0 truncate text-base font-bold text-navy">{{ headerTitle }}</h3>
              <p v-if="headerSubtitle" class="m-0 mt-0.5 truncate text-xs font-medium text-muted">
                {{ headerSubtitle }}
              </p>
            </div>
          </div>

          <AppButton
            variant="plain"
            class-name="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface hover:text-body"
            aria-label="Cerrar chat"
            title="Cerrar chat"
            @click="closePanel"
          >
            <IconX class="h-5 w-5" />
          </AppButton>
        </div>

        <div class="mt-4">
          <AppButton
            v-if="view === 'conversation'"
            variant="plain"
            class-name="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-icon shadow-elev-1 transition hover:border-line-strong hover:bg-surface hover:text-navy"
            @click="view = 'inbox'"
          >
            <IconArrowLeft class="h-4 w-4" />
            Volver
          </AppButton>

          <nav v-else class="flex items-center gap-1 rounded-2xl border border-line bg-surface/70 p-1">
            <button
              v-for="mode in modeOptions"
              :key="mode"
              type="button"
              :title="modeLabels[mode]"
              :aria-label="modeLabels[mode]"
              :aria-pressed="activeMode === mode"
              class="flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition"
              :class="activeMode === mode
                ? 'bg-white text-info shadow-[0_2px_8px_rgba(var(--elev-ink-rgb),0.08)]'
                : 'text-muted hover:text-body'"
              @click="switchMode(mode)"
            >
              <component :is="modeIcons[mode]" class="h-5 w-5" :stroke="1.8" />
              <span>{{ modeLabels[mode] }}</span>
            </button>
          </nav>
        </div>

        <label
          v-if="view !== 'conversation'"
          aria-label="Buscar conversación"
          class="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 shadow-elev-1 transition focus-within:border-blue-light-400 focus-within:ring-4 focus-within:ring-blue-light-500/10"
        >
          <IconSearch class="h-4 w-4 text-muted" />
          <input
            v-model="searchQuery"
            type="search"
            class="w-full border-0 bg-transparent p-0 text-sm font-medium text-body outline-none placeholder:text-muted"
            placeholder="Buscar conversación"
          >
        </label>
      </header>

      <div class="min-h-0 flex-1 bg-surface/70">
        <div v-if="loading" class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted">
          <div class="h-12 w-12 animate-pulse rounded-full border border-blue-light-100 bg-blue-light-50" />
          <p class="m-0 text-sm font-semibold">Cargando chat...</p>
        </div>

        <div v-else-if="error" class="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
          {{ error }}
        </div>

        <div v-else-if="view === 'conversation'" class="flex h-full min-h-0 flex-col">
          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div v-if="messages.length" class="flex flex-col gap-3">
              <article
                v-for="message in messages"
                :key="message.id"
                class="max-w-[88%] rounded-xl px-4 py-3 shadow-elev-1"
                :class="Number(message.sender_person_id) === Number(currentPersonId)
                  ? 'ml-auto bg-blue-light-700 text-white'
                  : 'mr-auto border border-line bg-white text-strong'"
              >
                <p class="m-0 whitespace-pre-wrap wrap-break-word text-sm font-medium leading-6">
                  {{ message.content || 'Adjunto sin texto' }}
                </p>
                <div v-if="message.attachments?.length" class="mt-3 flex flex-col gap-2">
                  <button
                    v-for="(attachment, attachmentIndex) in message.attachments"
                    :key="`${message.id}-${attachmentIndex}-${attachment.path}`"
                    type="button"
                    class="inline-flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-xs font-semibold"
                    :class="Number(message.sender_person_id) === Number(currentPersonId)
                      ? 'border-blue-light-500 bg-blue-light-600 text-white hover:bg-blue-light-800'
                      : 'border-line bg-surface text-body hover:bg-surface'"
                    @click="downloadAttachment(message, attachmentIndex)"
                  >
                    <span class="truncate">{{ attachment.filename }}</span>
                    <IconDownload class="h-4 w-4 shrink-0" />
                  </button>
                </div>
                <div
                  class="mt-2 flex items-center gap-2 text-[11px] font-bold"
                  :class="Number(message.sender_person_id) === Number(currentPersonId) ? 'text-white/80' : 'text-muted'"
                >
                  <span>{{ Number(message.sender_person_id) === Number(currentPersonId) ? 'Tú' : `Persona #${message.sender_person_id}` }}</span>
                  <span>·</span>
                  <span>{{ formatDateTime(message.created_at) }}</span>
                </div>
              </article>
            </div>
          </div>

          <footer class="border-t border-line bg-white px-4 py-4 sm:px-5">
            <div v-if="pendingAttachments.length" class="mb-3 flex flex-wrap gap-2">
              <span
                v-for="(file, index) in pendingAttachments"
                :key="`${file.name}-${index}`"
                class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-icon"
              >
                <span class="max-w-40 truncate">{{ file.name }}</span>
                <button type="button" class="text-muted transition hover:text-icon" @click="removePendingAttachment(index)">
                  <IconX class="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div class="flex items-end gap-3">
              <input ref="attachmentInputRef" type="file" aria-label="Adjuntar archivos" class="hidden" multiple @change="handleAttachmentSelection">
              <AppButton
                variant="plain"
                class-name="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-muted transition hover:bg-surface hover:text-body"
                aria-label="Adjuntar archivos"
                title="Adjuntar archivos"
                @click="attachmentInputRef?.click?.()"
              >
                <IconPaperclip class="h-5 w-5" />
              </AppButton>
              <textarea
                ref="composerRef"
                v-model="draft"
                rows="1"
                aria-label="Mensaje del chat"
                class="max-h-40 min-h-13 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium text-strong outline-none transition placeholder:text-muted focus:bg-white focus:ring-4"
                placeholder="Escribe un mensaje"
                @input="resizeComposer"
                @keydown.enter.exact.prevent="sendMessage"
              />
              <AppButton
                variant="primary"
                size="sm"
                class-name="h-[52px] shrink-0 rounded-2xl px-4"
                :disabled="submitting || (!String(draft || '').trim() && !pendingAttachments.length)"
                @click="sendMessage"
              >
                {{ submitting ? 'Enviando...' : 'Enviar' }}
              </AppButton>
            </div>
          </footer>
        </div>

        <template v-else-if="activeMode === 'processes'">
          <div v-if="!storedContext.processId" class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-muted shadow-elev-1">
              <IconInbox class="h-6 w-6" />
            </div>
            <p class="m-0 text-sm font-bold text-body">Sin contexto de proceso</p>
            <p class="m-0 max-w-xs text-sm font-medium text-muted">
              Abre primero un proceso desde Home para dejar disponible su thread en el launcher global.
            </p>
          </div>

          <div v-else class="px-4 pb-4 pt-4 sm:px-5">
            <div v-if="filteredThreadItems.length" class="flex flex-col gap-3">
              <button
                v-for="item in filteredThreadItems"
                :key="item.id"
                type="button"
                class="rounded-xl border border-line bg-white px-4 py-4 text-left shadow-elev-1 transition hover:border-blue-light-200 hover:bg-blue-light-50/40"
                @click="openThreadItem(item)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="m-0 truncate text-sm font-bold text-navy">{{ item.title }}</p>
                    <p class="m-0 mt-1 text-xs font-medium text-muted">{{ item.scopeLabel }}</p>
                  </div>
                  <div class="shrink-0 text-right">
                    <span class="block text-[11px] font-bold uppercase tracking-wide text-muted">
                      {{ item.lastMessageAtLabel }}
                    </span>
                    <span
                      v-if="Number(item.unreadCount || 0) > 0"
                      class="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-blue-light-600 px-2 py-0.5 text-[11px] font-bold text-white"
                    >
                      {{ item.unreadCount }}
                    </span>
                  </div>
                </div>
                <p class="m-0 mt-3 text-sm font-medium text-icon">
                  {{ item.summary || 'Sin mensajes todavía. Usa este espacio para dar seguimiento al proceso.' }}
                </p>
              </button>
            </div>
          </div>
        </template>

        <div v-else-if="activeMode === 'units'" class="flex h-full flex-col">
          <div v-if="filteredUnitItems.length" class="px-4 pb-4 pt-4 sm:px-5">
            <div class="flex flex-col gap-3">
              <button
                v-for="item in filteredUnitItems"
                :key="item.unitId"
                type="button"
                class="rounded-xl border border-line bg-white px-4 py-4 text-left shadow-elev-1 transition hover:border-blue-light-200 hover:bg-blue-light-50/40"
                @click="openUnitItem(item)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="m-0 truncate text-sm font-bold text-navy">{{ item.title }}</p>
                    <p class="m-0 mt-1 text-xs font-medium text-muted">{{ item.scopeLabel }}</p>
                  </div>
                  <div class="shrink-0 text-right">
                    <span class="block text-[11px] font-bold uppercase tracking-wide text-muted">
                      {{ item.lastMessageAtLabel }}
                    </span>
                    <span
                      v-if="Number(item.unreadCount || 0) > 0"
                      class="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-blue-light-600 px-2 py-0.5 text-[11px] font-bold text-white"
                    >
                      {{ item.unreadCount }}
                    </span>
                  </div>
                </div>
                <p class="m-0 mt-3 text-sm font-medium text-icon">
                  {{ item.summary || 'Sin mensajes todavía. Saluda a los miembros de tu unidad.' }}
                </p>
              </button>
            </div>
          </div>

          <div v-else class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-muted shadow-elev-1">
              <IconBuildingCommunity class="h-6 w-6" />
            </div>
            <p class="m-0 text-sm font-bold text-body">Sin unidades</p>
            <p class="m-0 max-w-xs text-sm font-medium text-muted">
              No perteneces a ninguna unidad con miembros para conversar.
            </p>
          </div>
        </div>

        <div v-else class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-muted shadow-elev-1">
            <IconMessages class="h-6 w-6" />
          </div>
          <p class="m-0 text-sm font-bold text-body">Modo en preparación</p>
          <p class="m-0 max-w-xs text-sm font-medium text-muted">
            {{ activeMode === 'groups' ? 'Los chats grupales se integrarán en este mismo panel.' : 'Los chats individuales se integrarán en este mismo panel.' }}
          </p>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';
import ProcessDefinitionPanelService from '@/core/services/ProcessDefinitionPanelService.js';
import realtimeClient from '@/core/services/realtimeClient.js';
import {
  IconArrowLeft,
  IconBuildingCommunity,
  IconDownload,
  IconInbox,
  IconMessages,
  IconPaperclip,
  IconRoute,
  IconSearch,
  IconUser,
  IconUsersGroup,
  IconX
} from '@tabler/icons-vue';

const props = defineProps({
  currentPersonId: {
    type: [Number, String],
    default: null
  }
});

const CHAT_CONTEXT_KEY = 'deasy_workspace_chat_context';
const service = new ProcessDefinitionPanelService();

const showChat = ref(false);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const activeMode = ref('processes');
const view = ref('inbox');
const searchQuery = ref('');
const thread = ref(null);
const unitItems = ref([]);
const messages = ref([]);
const draft = ref('');
const pendingAttachments = ref([]);
const composerRef = ref(null);
const attachmentInputRef = ref(null);
const storedContext = ref({
  processId: null,
  scopeUnitId: null,
  title: '',
  accessibleScopeUnitIds: []
});
let pollTimer = null;
let offMessage = null;
let offNotification = null;
let subscribedConversationId = null;

const modeOptions = ['processes', 'units', 'groups', 'users'];
const modeLabels = {
  processes: 'Procesos',
  units: 'Unidades',
  groups: 'Grupos',
  users: 'Usuarios'
};
const modeIcons = {
  processes: IconRoute,
  units: IconBuildingCommunity,
  groups: IconUsersGroup,
  users: IconUser
};

const threadItems = computed(() => {
  if (!thread.value) return [];
  return [{
    id: thread.value.id,
    title: thread.value.title || storedContext.value.title || 'Chat del proceso',
    summary: thread.value.mobile_summary || '',
    unreadCount: Number(thread.value.unread_count || 0),
    scopeLabel: thread.value.scope?.scope_unit_id ? `Unidad #${thread.value.scope.scope_unit_id}` : 'Ámbito operativo resuelto',
    lastMessageAtLabel: thread.value.last_message_at ? formatDateTime(thread.value.last_message_at) : 'Nuevo'
  }];
});

const filteredThreadItems = computed(() => {
  const normalized = String(searchQuery.value || '').trim().toLowerCase();
  if (!normalized) return threadItems.value;
  return threadItems.value.filter((item) =>
    [item.title, item.summary, item.scopeLabel]
      .map((value) => String(value || '').toLowerCase())
      .some((value) => value.includes(normalized))
  );
});

const filteredUnitItems = computed(() => {
  const normalized = String(searchQuery.value || '').trim().toLowerCase();
  if (!normalized) return unitItems.value;
  return unitItems.value.filter((item) =>
    [item.title, item.summary, item.scopeLabel]
      .map((value) => String(value || '').toLowerCase())
      .some((value) => value.includes(normalized))
  );
});

const activeModeIcon = computed(() => modeIcons[activeMode.value] || IconMessages);

const headerTitle = computed(() => {
  if (view.value === 'conversation') {
    return thread.value?.title || 'Conversación';
  }
  return 'Chat';
});

const headerSubtitle = computed(() => {
  if (view.value === 'conversation') {
    if (activeMode.value === 'units') {
      return 'Miembros de la unidad';
    }
    if (activeMode.value === 'processes') {
      return 'Seguimiento del proceso';
    }
    return '';
  }
  return '';
});

const loadStoredContext = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(CHAT_CONTEXT_KEY);
    if (!raw) {
      storedContext.value = {
        processId: null,
        scopeUnitId: null,
        title: '',
        accessibleScopeUnitIds: []
      };
      return;
    }
    const parsed = JSON.parse(raw);
    storedContext.value = {
      processId: Number(parsed?.processId || 0) || null,
      scopeUnitId: Number(parsed?.scopeUnitId || 0) || null,
      title: String(parsed?.title || ''),
      accessibleScopeUnitIds: Array.isArray(parsed?.accessibleScopeUnitIds) ? parsed.accessibleScopeUnitIds : []
    };
  } catch {
    storedContext.value = {
      processId: null,
      scopeUnitId: null,
      title: '',
      accessibleScopeUnitIds: []
    };
  }
};

const persistStoredContext = (value = {}) => {
  if (typeof window === 'undefined') return;
  const nextValue = {
    processId: Number(value?.processId || 0) || null,
    scopeUnitId: Number(value?.scopeUnitId || 0) || null,
    title: String(value?.title || ''),
    accessibleScopeUnitIds: Array.isArray(value?.accessibleScopeUnitIds) ? value.accessibleScopeUnitIds : []
  };
  window.sessionStorage.setItem(CHAT_CONTEXT_KEY, JSON.stringify(nextValue));
  storedContext.value = nextValue;
};

const resizeComposer = async () => {
  await nextTick();
  const element = composerRef.value;
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
};

const closePanel = () => {
  showChat.value = false;
  error.value = '';
  searchQuery.value = '';
  view.value = 'inbox';
  draft.value = '';
  pendingAttachments.value = [];
  teardownConversationRealtime();
};

const resolveScopeUnitId = () => {
  if (storedContext.value.scopeUnitId) return storedContext.value.scopeUnitId;
  const ids = storedContext.value.accessibleScopeUnitIds
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  return ids.length === 1 ? ids[0] : null;
};

const loadMessages = async (conversationId) => {
  const response = await service.getConversationMessages(conversationId, { limit: 50 });
  messages.value = Array.isArray(response?.data) ? response.data : [];
};

const markRead = async (conversationId) => {
  if (!conversationId) return;
  await service.markConversationRead(conversationId);
  if (thread.value?.id === conversationId) {
    thread.value = {
      ...thread.value,
      unread_count: 0
    };
  }
};

const openProcessThread = async ({ openConversation = false } = {}) => {
  if (!storedContext.value.processId) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await service.createOrGetProcessThread(storedContext.value.processId, resolveScopeUnitId());
    thread.value = response?.data || null;
    if (thread.value?.id) {
      await loadMessages(thread.value.id);
      if (openConversation) {
        await markRead(thread.value.id);
      }
    }
    view.value = openConversation ? 'conversation' : 'inbox';
  } catch (currentError) {
    error.value = currentError?.response?.data?.message || currentError?.message || 'No se pudo abrir el chat.';
  } finally {
    loading.value = false;
  }
};

const loadUnits = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await service.listChatUnits();
    const rows = Array.isArray(response?.data) ? response.data : [];
    unitItems.value = rows.map((row) => {
      const conversation = row?.conversation || null;
      const memberCount = Number(row?.member_count || 0);
      return {
        unitId: Number(row?.unit_id) || null,
        title: row?.label || `Unidad #${row?.unit_id}`,
        scopeLabel: `${memberCount} ${memberCount === 1 ? 'miembro' : 'miembros'}`,
        summary: conversation?.mobile_summary || '',
        unreadCount: Number(conversation?.unread_count || 0),
        lastMessageAt: conversation?.last_message_at || null,
        lastMessageAtLabel: conversation?.last_message_at ? formatDateTime(conversation.last_message_at) : 'Nuevo'
      };
    }).filter((item) => item.unitId);
  } catch (currentError) {
    error.value = currentError?.response?.data?.message || currentError?.message || 'No se pudieron cargar las unidades.';
  } finally {
    loading.value = false;
  }
};

const openUnitItem = async (item) => {
  if (!item?.unitId) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await service.createOrGetUnitThread(item.unitId);
    thread.value = response?.data || null;
    if (thread.value?.id) {
      await loadMessages(thread.value.id);
      await markRead(thread.value.id);
    }
    view.value = 'conversation';
  } catch (currentError) {
    error.value = currentError?.response?.data?.message || currentError?.message || 'No se pudo abrir el chat de la unidad.';
  } finally {
    loading.value = false;
  }
};

const openLauncher = async () => {
  loadStoredContext();
  showChat.value = true;
  if (activeMode.value === 'processes' && storedContext.value.processId) {
    await openProcessThread({ openConversation: false });
  } else if (activeMode.value === 'units') {
    await loadUnits();
  }
};

const openProcessThreadFromEvent = async (detail = {}) => {
  persistStoredContext({
    processId: detail?.processId,
    scopeUnitId: detail?.scopeUnitId,
    title: detail?.title,
    accessibleScopeUnitIds: detail?.accessibleScopeUnitIds
  });
  activeMode.value = 'processes';
  showChat.value = true;
  await openProcessThread({ openConversation: Boolean(detail?.openConversation) });
};

const openThreadItem = async (item) => {
  if (!item?.id) return;
  loading.value = true;
  error.value = '';
  try {
    await loadMessages(item.id);
    await markRead(item.id);
    view.value = 'conversation';
  } catch (currentError) {
    error.value = currentError?.response?.data?.message || currentError?.message || 'No se pudieron cargar los mensajes.';
  } finally {
    loading.value = false;
  }
};

const handleAttachmentSelection = (event) => {
  const selectedFiles = Array.from(event?.target?.files || []);
  if (!selectedFiles.length) return;
  pendingAttachments.value = [...pendingAttachments.value, ...selectedFiles].slice(0, 5);
  if (event?.target) {
    event.target.value = '';
  }
};

const removePendingAttachment = (index) => {
  pendingAttachments.value = pendingAttachments.value.filter((_, currentIndex) => currentIndex !== index);
};

const sendMessage = async () => {
  const trimmedContent = String(draft.value || '').trim();
  if (!thread.value?.id || submitting.value || (!trimmedContent && !pendingAttachments.value.length)) {
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    let attachments = [];
    if (pendingAttachments.value.length) {
      const uploadResponse = await service.uploadConversationAttachments(thread.value.id, pendingAttachments.value);
      attachments = Array.isArray(uploadResponse?.data) ? uploadResponse.data : [];
    }
    await service.sendConversationMessage(thread.value.id, {
      content: trimmedContent,
      attachments
    });
    draft.value = '';
    pendingAttachments.value = [];
    await loadMessages(thread.value.id);
    await markRead(thread.value.id);
    if (activeMode.value === 'processes' && storedContext.value.processId) {
      const refreshedThread = await service.getProcessThread(storedContext.value.processId, resolveScopeUnitId());
      thread.value = refreshedThread?.data || thread.value;
    } else {
      const refreshedThread = await service.getConversation(thread.value.id);
      thread.value = refreshedThread?.data || thread.value;
    }
  } catch (currentError) {
    error.value = currentError?.response?.data?.message || currentError?.message || 'No se pudo enviar el mensaje.';
  } finally {
    submitting.value = false;
  }
};

const downloadAttachment = async (message, attachmentIndex) => {
  if (!thread.value?.id || !message?.id) return;
  try {
    const blob = await service.downloadConversationAttachment(thread.value.id, message.id, attachmentIndex);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = message.attachments?.[attachmentIndex]?.filename || `adjunto-${attachmentIndex + 1}`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } catch (currentError) {
    error.value = currentError?.response?.data?.message || currentError?.message || 'No se pudo descargar el adjunto.';
  }
};

const switchMode = async (mode) => {
  activeMode.value = mode;
  view.value = 'inbox';
  error.value = '';
  thread.value = null;
  messages.value = [];
  if (mode === 'processes' && storedContext.value.processId) {
    await openProcessThread({ openConversation: false });
  } else if (mode === 'units') {
    await loadUnits();
  }
};

const handleOpenProcessEvent = async (event) => {
  await openProcessThreadFromEvent(event?.detail || {});
};

const handleStorageUpdateEvent = (event) => {
  if (!event?.detail) {
    loadStoredContext();
    return;
  }
  persistStoredContext(event.detail);
};

const formatDateTime = (value) => {
  if (!value) return 'Ahora';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

watch(
  () => [showChat.value, view.value, draft.value],
  () => {
    if (view.value === 'conversation') {
      resizeComposer();
    }
  },
  { immediate: true }
);

const refreshActiveConversation = async (conversationId) => {
  if (loading.value || submitting.value) return;
  if (!conversationId || thread.value?.id !== conversationId) return;
  try {
    await loadMessages(conversationId);
    await markRead(conversationId);
  } catch {
    // no-op: la próxima emisión o el fallback reintentarán
  }
};

const teardownConversationRealtime = () => {
  if (offMessage) {
    offMessage();
    offMessage = null;
  }
  if (subscribedConversationId) {
    realtimeClient.unsubscribeConversation(subscribedConversationId);
    subscribedConversationId = null;
  }
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
};

const setupConversationRealtime = async (conversationId) => {
  teardownConversationRealtime();
  if (!conversationId) return;

  realtimeClient.connect();
  subscribedConversationId = conversationId;
  await realtimeClient.subscribeConversation(conversationId);

  // Evento en tiempo real: nuevo mensaje en la conversación abierta.
  offMessage = realtimeClient.on('chat.message.created', (envelope) => {
    const incomingId = envelope?.conversation?.id;
    if (incomingId && incomingId === conversationId) {
      refreshActiveConversation(conversationId);
    }
  });

  // Red de seguridad: si el socket está caído, refresca a baja frecuencia.
  pollTimer = window.setInterval(() => {
    if (realtimeClient.isConnected()) return;
    refreshActiveConversation(conversationId);
  }, 60000);
};

watch(
  () => [showChat.value, view.value, thread.value?.id],
  () => {
    if (showChat.value && view.value === 'conversation' && thread.value?.id) {
      setupConversationRealtime(thread.value.id);
    } else {
      teardownConversationRealtime();
    }
  },
  { immediate: true }
);

const handleRealtimeNotification = async () => {
  // Refresca el badge de no leídos del inbox cuando llega un aviso mientras no
  // se está viendo la conversación (esa vista ya se refresca por mensajes).
  if (!showChat.value || view.value === 'conversation') return;
  try {
    if (activeMode.value === 'processes' && storedContext.value.processId) {
      const refreshed = await service.getProcessThread(storedContext.value.processId, resolveScopeUnitId());
      thread.value = refreshed?.data || thread.value;
    } else if (activeMode.value === 'units') {
      await loadUnits();
    }
  } catch {
    // no-op
  }
};

onMounted(() => {
  loadStoredContext();
  realtimeClient.connect();
  offNotification = realtimeClient.on('chat.notification.created', handleRealtimeNotification);
  window.addEventListener('storage', loadStoredContext);
  window.addEventListener('workspace-chat:open-process', handleOpenProcessEvent);
  window.addEventListener('workspace-chat:context-updated', handleStorageUpdateEvent);
});

onBeforeUnmount(() => {
  teardownConversationRealtime();
  if (offNotification) {
    offNotification();
    offNotification = null;
  }
  realtimeClient.disconnect();
  window.removeEventListener('storage', loadStoredContext);
  window.removeEventListener('workspace-chat:open-process', handleOpenProcessEvent);
  window.removeEventListener('workspace-chat:context-updated', handleStorageUpdateEvent);
});
</script>
