<template>
  <div class="dialog-overlay" v-if="visible">
    <div class="dialog-box">
      <h3>Trade Request</h3>
      <p class="invite-info">{{ fromName }} wants to trade with you.</p>
      <div class="dialog-actions">
        <button class="btn-confirm" @click="$emit('accept')">Accept</button>
        <button class="btn-cancel" @click="$emit('reject')">Decline</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  fromName: string;
}>();

defineEmits<{
  accept: [];
  reject: [];
}>();
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog-box {
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 20px;
  min-width: 240px;
  color: #ddd;
}
.dialog-box h3 { margin: 0 0 12px; color: #7af; }
.invite-info { font-size: 14px; margin-bottom: 16px; }
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-confirm {
  background: #263;
  border: 1px solid #4a5;
  color: #fff;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-confirm:hover { background: #374; }
.btn-cancel {
  background: #333;
  border: 1px solid #555;
  color: #ddd;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-cancel:hover { background: #444; }
</style>
