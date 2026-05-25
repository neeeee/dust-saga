<template>
  <div
    ref="panelRef"
    class="chat-panel"
    data-draggable
    :style="{ left: posX + 'px', top: posY + 'px' }"
  >
    <div class="chat-header" data-drag-handle>
      <span class="drag-dots">&#8960;</span>
    </div>
    <div class="chat-messages" ref="chatEl">
      <div v-for="(msg, i) in messages" :key="i" class="chat-msg">
        <span class="chat-sender">[{{ msg.sender }}]</span>
        <span class="chat-text">{{ msg.message }}</span>
      </div>
    </div>
    <form @submit.prevent="sendChat" class="chat-form">
      <input
        ref="inputEl"
        v-model="input"
        type="text"
        placeholder="Press Enter to chat..."
        maxlength="200"
        @focus="onFocus"
        @blur="onBlur"
      />
      <button type="submit">Send</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useDraggable } from '../composables/useDraggable';

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-chat');
const panelRef = ref<HTMLElement | null>(null);

const props = defineProps<{
  messages: Array<{ sender: string; message: string; channel?: string }>;
}>();

const emit = defineEmits<{
  'send': [message: string];
  'focus': [];
  'blur': [];
}>();

const input = ref('');
const chatEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);

watch(() => props.messages.length, async () => {
  await nextTick();
  if (chatEl.value) {
    chatEl.value.scrollTop = chatEl.value.scrollHeight;
  }
});

function sendChat() {
  if (input.value.trim()) {
    emit('send', input.value.trim());
    input.value = '';
  }
}

function onFocus() {
  emit('focus');
}

function onBlur() {
  emit('blur');
}

function focusInput() {
  inputEl.value?.focus();
}

function blurInput() {
  inputEl.value?.blur();
}

defineExpose({ focusInput, blurInput });

onMounted(() => {
  if (panelRef.value) attach(panelRef.value);
});

onUnmounted(() => {
  if (panelRef.value) detach(panelRef.value);
});
</script>

<style scoped>
.chat-panel {
  position: absolute;
  width: 320px;
  z-index: 10;
  pointer-events: auto;
  user-select: text !important;
  -webkit-user-select: text !important;
}

.chat-header {
  user-select: none !important;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px 8px 0 0;
}

.drag-dots {
  cursor: grab;
  color: #666;
  font-size: 0.9rem;
}

.drag-dots:active {
  cursor: grabbing;
}

.chat-messages {
  max-height: 180px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.5);
  padding: 8px;
  border-radius: 8px 8px 0 0;
  font-size: 0.8rem;
  user-select: text !important;
  -webkit-user-select: text !important;
}

.chat-msg {
  margin-bottom: 2px;
  word-wrap: break-word;
  user-select: text !important;
  -webkit-user-select: text !important;
}

.chat-sender {
  color: #667eea;
  font-weight: bold;
}

.chat-text {
  color: #ddd;
}

.chat-form {
  display: flex;
}

.chat-form input {
  flex: 1;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-top: none;
  border-radius: 0 0 0 8px;
  color: white;
  font-size: 0.85rem;
  outline: none;
}

.chat-form input:focus {
  border-color: #667eea;
}

.chat-form button {
  padding: 6px 12px;
  background: #667eea;
  border: none;
  border-radius: 0 0 8px 0;
  color: white;
  font-size: 0.8rem;
  cursor: pointer;
}
</style>
