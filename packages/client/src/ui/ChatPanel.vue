<template>
  <div class="chat-panel">
    <div class="chat-messages" ref="chatEl">
      <div v-for="(msg, i) in messages" :key="i" class="chat-msg">
        <span class="chat-sender">[{{ msg.sender }}]</span>
        <span class="chat-text">{{ msg.message }}</span>
      </div>
    </div>
    <form @submit.prevent="sendChat" class="chat-form">
      <input
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
import { ref, watch, nextTick } from 'vue';

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
</script>

<style scoped>
.chat-panel {
  position: absolute;
  bottom: 70px;
  left: 15px;
  width: 320px;
  pointer-events: auto;
}

.chat-messages {
  max-height: 180px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.5);
  padding: 8px;
  border-radius: 8px 8px 0 0;
  font-size: 0.8rem;
}

.chat-msg {
  margin-bottom: 2px;
  word-wrap: break-word;
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
