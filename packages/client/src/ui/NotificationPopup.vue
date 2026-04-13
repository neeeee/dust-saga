<template>
  <Transition name="notification">
    <div class="notification" :class="type" v-if="visible">
      {{ message }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  message: string;
  type: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  'hide': [];
}>();

watch(() => props.visible, (val) => {
  if (val) {
    setTimeout(() => emit('hide'), 3000);
  }
});
</script>

<style scoped>
.notification {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 0.9rem;
  z-index: 100;
  pointer-events: none;
  white-space: nowrap;
}

.notification.success {
  background: rgba(76, 175, 80, 0.85);
  color: white;
}

.notification.error {
  background: rgba(244, 67, 54, 0.85);
  color: white;
}

.notification.info {
  background: rgba(33, 150, 243, 0.85);
  color: white;
}

.notification-enter-active {
  transition: all 0.3s ease-out;
}

.notification-leave-active {
  transition: all 0.5s ease-in;
}

.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
