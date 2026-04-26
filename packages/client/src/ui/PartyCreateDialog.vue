<template>
  <div class="dialog-overlay" v-if="visible" @click.self="$emit('cancel')">
    <div class="dialog-box">
      <h3>Create Party</h3>
      <div class="form-group">
        <label>Visibility</label>
        <select v-model="visibility">
          <option value="private">Private (invite only)</option>
          <option value="open">Open (anyone can join)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Loot Rules</label>
        <select v-model="lootRule">
          <option value="random">Random Distribution</option>
          <option value="pool">Roll Pool (cap 16 items)</option>
        </select>
      </div>
      <p class="hint">Inviting: {{ targetName }}</p>
      <div class="dialog-actions">
        <button class="btn-confirm" @click="submit">Create & Invite</button>
        <button class="btn-cancel" @click="$emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  visible: boolean;
  targetName: string;
  targetId: string;
}>();

const emit = defineEmits<{
  create: [data: { targetId: string; visibility: string; lootRule: string }];
  cancel: [];
}>();

const visibility = ref('private');
const lootRule = ref('random');

function submit() {
  emit('create', {
    targetId: props.targetId,
    visibility: visibility.value,
    lootRule: lootRule.value
  });
}
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
  min-width: 300px;
  color: #ddd;
}
.dialog-box h3 { margin: 0 0 16px; color: #7af; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; margin-bottom: 4px; font-size: 12px; color: #aaa; }
.form-group select {
  width: 100%;
  padding: 6px;
  background: #222;
  border: 1px solid #555;
  color: #ddd;
  border-radius: 4px;
}
.hint { font-size: 12px; color: #888; margin: 12px 0; }
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
