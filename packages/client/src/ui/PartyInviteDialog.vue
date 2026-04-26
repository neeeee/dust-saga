<template>
  <div class="dialog-overlay" v-if="visible">
    <div class="dialog-box">
      <h3>Party Invite</h3>
      <p class="invite-info">{{ leaderName }} invites you to a party!</p>
      <div class="invite-details">
        <span class="detail-badge">{{ settings?.visibility || 'private' }}</span>
        <span class="detail-badge">{{ settings?.lootRule || 'random' }} loot</span>
        <span class="detail-badge">{{ memberCount }} member(s)</span>
      </div>
      <div class="dialog-actions">
        <button class="btn-confirm" @click="$emit('accept', partyId)">Join</button>
        <button class="btn-cancel" @click="$emit('reject')">Decline</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  partyId: string;
  leaderName: string;
  settings: { visibility: string; lootRule: string } | null;
  memberCount: number;
}>();

defineEmits<{
  accept: [partyId: string];
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
  min-width: 280px;
  color: #ddd;
}
.dialog-box h3 { margin: 0 0 12px; color: #7af; }
.invite-info { font-size: 14px; margin-bottom: 8px; }
.invite-details { display: flex; gap: 6px; margin-bottom: 16px; }
.detail-badge {
  background: rgba(255,255,255,0.1);
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  text-transform: capitalize;
}
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
