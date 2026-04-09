<template>
  <div>
    <AppButton
      variant="plain"
      class-name="fixed bottom-6 right-4 z-[90] inline-flex h-16 w-16 items-center justify-center rounded-full border border-sky-200/90 bg-gradient-to-br from-white via-sky-50 to-sky-100 text-sky-700 shadow-[0_18px_45px_rgba(2,132,199,0.22)] ring-1 ring-white/80 transition hover:-translate-y-1 hover:from-white hover:to-sky-50 focus:outline-none focus:ring-4 focus:ring-sky-200/70 sm:right-6 sm:h-[4.5rem] sm:w-[4.5rem]"
      aria-label="Abrir chat"
      title="Abrir chat"
      @click="openLauncher"
    >
      <span class="absolute inset-1.25 rounded-full border border-white/70 bg-white/55" />
      <IconMessages class="relative z-10 h-7 w-7 sm:h-8 sm:w-8" />
    </AppButton>

    <div
      v-if="showChat"
      class="fixed inset-0 z-95 bg-slate-950/30 backdrop-blur-[2px]"
      @click="closePanel"
    />

    <aside
      v-if="showChat"
      class="fixed inset-x-3 bottom-3 z-100 flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-6 sm:w-[min(27.5rem,calc(100vw-3rem))]"
      aria-label="Panel global de chat"
    >
      <header class="border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="m-0 text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Chat</p>
            <h3 class="m-0 mt-1 truncate text-base font-bold text-slate-900">
              {{ view === 'conversation' ? (thread?.title || 'Chat del proceso') : 'Bandeja de chats' }}
            </h3>
            <p class="m-0 mt-1 text-xs font-medium text-slate-500">
              {{ headerSubtitle }}
            </p>
          </div>

          <AppButton
            variant="plain"
            class-name="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar chat"
            title="Cerrar chat"
            @click="closePanel"
          >
            <IconX class="h-5 w-5" />
          </AppButton>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <AppButton
            v-if="view === 'conversation'"
            variant="plain"
            class-name="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            @click="view = 'inbox'"
          >
            <IconArrowLeft class="h-4 w-4" />
            Volver
          </AppButton>

          <div class="grid flex-1 grid-cols-3 gap-2">
            <button
              v-for="mode in modeOptions"
              :key="mode"
              type="button"
              class="rounded-2xl border px-3 py-2 text-xs font-bold transition"
              :class="activeMode === mode ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'"
              @click="switchMode(mode)"
            >
              {{ modeLabels[mode] }}
            </button>
          </div>
        </div>

        <label class="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <IconSearch class="h-4 w-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="search"
            class="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Buscar conversación"
          >
        </label>
      </header>

      <div class="min-h-0 flex-1 bg-slate-50/70">
        <div v-if="loading" class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
          <div class="h-12 w-12 animate-pulse rounded-full border border-sky-100 bg-sky-50" />
          <p class="m-0 text-sm font-semibold">Cargando chat...</p>
        </div>

        <div v-else-if="error" class="m-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
          {{ error }}
        </div>

        <div v-else-if="activeMode !== 'processes'" class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
            <IconMessages class="h-6 w-6" />
          </div>
          <p class="m-0 text-sm font-bold text-slate-700">Modo en preparación</p>
          <p class="m-0 max-w-xs text-sm font-medium text-slate-500">
            {{ activeMode === 'groups' ? 'Los chats grupales se integrarán en este mismo panel.' : 'Los chats individuales se integrarán en este mismo panel.' }}
          </p>
        </div>

        <div v-else-if="!storedContext.processId" class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
            <IconInbox class="h-6 w-6" />
          </div>
          <p class="m-0 text-sm font-bold text-slate-700">Sin contexto de proceso</p>
          <p class="m-0 max-w-xs text-sm font-medium text-slate-500">
            Abre primero un proceso desde el dashboard para dejar disponible su thread en el launcher global.
          </p>
        </div>

        <div v-else-if="view === 'inbox'" class="flex h-full flex-col">
          <div class="px-4 pb-4 pt-4 sm:px-5">
            <div v-if="filteredThreadItems.length" class="flex flex-col gap-3">
              <button
                v-for="item in filteredThreadItems"
                :key="item.id"
                type="button"
                class="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                @click="openThreadItem(item)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="m-0 truncate text-sm font-bold text-slate-900">{{ item.title }}</p>
                    <p class="m-0 mt-1 text-xs font-medium text-slate-500">{{ item.scopeLabel }}</p>
                  </div>
                  <div class="shrink-0 text-right">
                    <span class="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {{ item.lastMessageAtLabel }}
                    </span>
                    <span
                      v-if="Number(item.unreadCount || 0) > 0"
                      class="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-bold text-white"
                    >
                      {{ item.unreadCount }}
                    </span>
                  </div>
                </div>
                <p class="m-0 mt-3 text-sm font-medium text-slate-600">
                  {{ item.summary || 'Sin mensajes todavía. Usa este espacio para dar seguimiento al proceso.' }}
                </p>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="flex h-full min-h-0 flex-col">
          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div v-if="messages.length" class="flex flex-col gap-3">
              <article
                v-for="message in messages"
                :key="message.id"
                class="max-w-[88%] rounded-3xl px-4 py-3 shadow-sm"
                :class="Number(message.sender_person_id) === Number(currentPersonId)
                  ? 'ml-auto bg-sky-700 text-white'
                  : 'mr-auto border border-slate-200 bg-white text-slate-800'"
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
                      ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'"
                    @click="downloadAttachment(message, attachmentIndex)"
                  >
                    <span class="truncate">{{ attachment.filename }}</span>
                    <IconDownload class="h-4 w-4 shrink-0" />
                  </button>
                </div>
                <div
                  class="mt-2 flex items-center gap-2 text-[11px] font-bold"
                  :class="Number(message.sender_person_id) === Number(currentPersonId) ? 'text-white/80' : 'text-slate-400'"
                >
                  <span>{{ Number(message.sender_person_id) === Number(currentPersonId) ? 'Tú' : `Persona #${message.sender_person_id}` }}</span>
                  <span>·</span>
                  <span>{{ formatDateTime(message.created_at) }}</span>
                </div>
              </article>
            </div>
          </div>

          <footer class="border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
            <div v-if="pendingAttachments.length" class="mb-3 flex flex-wrap gap-2">
              <span
                v-for="(file, index) in pendingAttachments"
                :key="`${file.name}-${index}`"
                class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                <span class="max-w-40 truncate">{{ file.name }}</span>
                <button type="button" class="text-slate-400 transition hover:text-slate-600" @click="removePendingAttachment(index)">
                  <IconX class="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div class="flex items-end gap-3">
              <input ref="attachmentInputRef" type="file" class="hidden" multiple @change="handleAttachmentSelection">
              <AppButton
                variant="plain"
                class-name="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
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
                class="max-h-40 min-h-13 flex-1 resize-none rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                placeholder="Escribe un mensaje"
                @input="resizeComposer"
                @keydown.enter.exact.prevent="sendMessage"
              />
              <AppButton
                variant="primary"
                size="sm"
                class-name="h-[52px] shrink-0 rounded-[18px] px-4"
                :disabled="submitting || (!String(draft || '').trim() && !pendingAttachments.length)"
                @click="sendMessage"
              >
                {{ submitting ? 'Enviando...' : 'Enviar' }}
              </AppButton>
            </div>
          </footer>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppButton from '@/shared/components/ui/AppButton.vue';
import ProcessDefinitionPanelService from '@/modules/logged/services/ProcessDefinitionPanelService.js';
import {
  IconArrowLeft,
  IconDownload,
  IconInbox,
  IconMessages,
  IconPaperclip,
  IconSearch,
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

const modeOptions = ['processes', 'groups', 'users'];
const modeLabels = {
  processes: 'Procesos',
  groups: 'Grupos',
  users: 'Usuarios'
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

const headerSubtitle = computed(() => {
  if (view.value === 'conversation') {
    return 'Seguimiento del proceso y sus entregables';
  }
  if (activeMode.value === 'groups') {
    return 'Modo grupos';
  }
  if (activeMode.value === 'users') {
    return 'Modo usuarios';
  }
  return 'Modo procesos';
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
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
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

const openLauncher = async () => {
  loadStoredContext();
  showChat.value = true;
  if (activeMode.value === 'processes' && storedContext.value.processId) {
    await openProcessThread({ openConversation: false });
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
    const refreshedThread = await service.getProcessThread(storedContext.value.processId, resolveScopeUnitId());
    thread.value = refreshedThread?.data || thread.value;
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
  if (mode === 'processes' && storedContext.value.processId) {
    await openProcessThread({ openConversation: false });
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

watch(
  () => [showChat.value, view.value, thread.value?.id],
  () => {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    if (showChat.value && view.value === 'conversation' && thread.value?.id) {
      pollTimer = window.setInterval(async () => {
        if (loading.value || submitting.value || !thread.value?.id) return;
        try {
          await loadMessages(thread.value.id);
          await markRead(thread.value.id);
        } catch {
          // no-op fallback polling
        }
      }, 12000);
    }
  },
  { immediate: true }
);

onMounted(() => {
  loadStoredContext();
  window.addEventListener('storage', loadStoredContext);
  window.addEventListener('workspace-chat:open-process', handleOpenProcessEvent);
  window.addEventListener('workspace-chat:context-updated', handleStorageUpdateEvent);
});

onBeforeUnmount(() => {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  window.removeEventListener('storage', loadStoredContext);
  window.removeEventListener('workspace-chat:open-process', handleOpenProcessEvent);
  window.removeEventListener('workspace-chat:context-updated', handleStorageUpdateEvent);
});
</script>
