<template>
  <div class="party-panel" v-if="party">
    <div class="party-header">
      <span class="party-title">Party ({{ party.members.length }}/8)</span>
      <button class="party-leave-btn" @click="$emit('leave-party')">Leave</button>
    </div>
    <div class="party-settings">
      <span class="setting-badge">{{ party.settings.visibility }}</span>
      <span class="setting-badge">{{ party.settings.lootRule }} loot</span>
    </div>
    <div class="party-members">
      <div
        v-for="member in party.members"
        :key="member.characterId"
        class="party-member"
        :class="{ 'is-leader': member.isLeader, 'is-self': member.characterId === myId }"
      >
        <div class="member-info">
          <span class="member-name">{{ member.characterName }}</span>
          <span class="member-level">Lv.{{ member.level }}</span>
          <span v-if="member.isLeader" class="leader-icon">★</span>
        </div>
        <div class="member-bar-container">
          <div class="member-hp-bar" :style="{ width: hpPercent(member) + '%' }"></div>
        </div>
        <div class="member-effects" v-if="getMemberEffects(member.characterId).length > 0">
          <div
            v-for="eff in getMemberEffects(member.characterId)"
            :key="eff.id"
            class="member-effect-icon"
            :class="isBuff(eff) ? 'buff' : 'debuff'"
            :title="eff.type"
          >{{ getEffectLabel(eff) }}</div>
        </div>
        <div class="member-actions" v-if="isLeader && member.characterId !== myId">
          <button class="tiny-btn" @click="$emit('kick-member', member.characterId)" title="Kick">✕</button>
          <button class="tiny-btn" @click="$emit('promote-member', member.characterId)" title="Make Leader">★</button>
        </div>
      </div>
    </div>
    <div class="loot-pool" v-if="lootPool.length > 0">
      <div class="loot-header">Loot Pool ({{ lootPool.length }}/16)</div>
      <div v-for="item in lootPool" :key="item.lootId" class="loot-item">
        <span>{{ item.itemName }} x{{ item.quantity }}</span>
        <button
          v-if="!hasRolled(item)"
          class="roll-btn"
          @click="$emit('roll-loot', item.lootId)"
        >Roll</button>
        <span v-else class="rolled-label">Rolled</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PartyData, PartyLootItem, StatusEffectType } from '@dust-saga/shared';

const BUFF_TYPES = new Set([
  StatusEffectType.HASTE,
  StatusEffectType.BUFF_DEFENSE,
  StatusEffectType.BUFF_CAST_SPEED,
  StatusEffectType.BUFF_MAX_HP,
  StatusEffectType.BUFF_MP_REGEN,
  StatusEffectType.BUFF_ATTACK,
  StatusEffectType.BUFF_GENERIC,
  StatusEffectType.BUFF_STAT,
  StatusEffectType.BUFF_PHYSICAL_REDUC,
  StatusEffectType.BUFF_DODGE,
  StatusEffectType.BUFF_ACCURACY,
  StatusEffectType.BUFF_ATTACK_SPEED,
]);

const props = defineProps<{
  party: PartyData | null;
  lootPool: PartyLootItem[];
  myId: string;
  entityStatusEffects: Record<string, any[]>;
}>();

defineEmits<{
  'leave-party': [];
  'kick-member': [characterId: string];
  'promote-member': [characterId: string];
  'roll-loot': [lootId: string];
}>();

const isLeader = (() => props.party?.leaderId === props.myId)();

function hpPercent(m: { health: number; maxHealth: number }): number {
  if (m.maxHealth <= 0) return 0;
  return (m.health / m.maxHealth) * 100;
}

function hasRolled(item: PartyLootItem): boolean {
  return item.rolls[props.myId] !== undefined;
}

function getMemberEffects(characterId: string): any[] {
  const effects = props.entityStatusEffects[characterId];
  if (!effects) return [];
  const now = Date.now();
  return effects.filter(e => (e.appliedAt + e.duration - now) > 0);
}

function isBuff(e: any): boolean {
  return BUFF_TYPES.has(e.type);
}

function getEffectLabel(e: any): string {
  if (e.skillName) {
    const words = e.skillName.split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return e.skillName.substring(0, 2).toUpperCase();
  }
  const DEBUFF_ICONS: Record<string, string> = {
    [StatusEffectType.POISON]: 'Ps',
    [StatusEffectType.BURN]: 'Br',
    [StatusEffectType.FREEZE]: 'Fr',
    [StatusEffectType.STUN]: 'St',
    [StatusEffectType.SILENCE]: 'Si',
    [StatusEffectType.SLEEP]: 'Sl',
    [StatusEffectType.KNOCKDOWN]: 'Kd',
    [StatusEffectType.CHARM]: 'Ch',
    [StatusEffectType.BLEED]: 'Bl',
    [StatusEffectType.ROOT]: 'Rt',
    [StatusEffectType.SLOW]: 'Sw',
  };
  return DEBUFF_ICONS[e.type] || '??';
}
</script>

<style scoped>
.party-panel {
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  width: 200px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid #555;
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
  color: #ddd;
  z-index: 10;
}
.party-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.party-title {
  font-weight: bold;
  color: #7af;
}
.party-leave-btn {
  background: #633;
  border: 1px solid #955;
  color: #faa;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}
.party-leave-btn:hover { background: #844; }
.party-settings {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.setting-badge {
  background: rgba(255,255,255,0.1);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  text-transform: capitalize;
}
.party-member {
  padding: 3px 4px;
  border-radius: 3px;
  margin-bottom: 3px;
  background: rgba(255,255,255,0.05);
}
.party-member.is-self { border-left: 2px solid #7af; }
.party-member.is-leader { border-left: 2px solid #fd0; }
.member-info {
  display: flex;
  align-items: center;
  gap: 4px;
}
.member-name { font-weight: bold; }
.member-level { color: #aaa; font-size: 10px; }
.leader-icon { color: #fd0; font-size: 10px; }
.member-bar-container {
  height: 4px;
  background: #333;
  border-radius: 2px;
  margin-top: 2px;
  overflow: hidden;
}
.member-hp-bar {
  height: 100%;
  background: #4a4;
  transition: width 0.3s;
}
.member-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 2px;
}
.member-effect-icon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.4rem;
  font-weight: bold;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.member-effect-icon.buff { background: rgba(76, 175, 80, 0.6); }
.member-effect-icon.debuff { background: rgba(244, 67, 54, 0.6); }
.member-actions {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.tiny-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  color: #aaa;
  cursor: pointer;
  padding: 0 4px;
  font-size: 10px;
  border-radius: 2px;
}
.tiny-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
.loot-pool {
  margin-top: 8px;
  border-top: 1px solid #444;
  padding-top: 6px;
}
.loot-header {
  font-weight: bold;
  color: #fd0;
  margin-bottom: 4px;
}
.loot-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 4px;
  background: rgba(255,215,0,0.05);
  border-radius: 2px;
  margin-bottom: 2px;
}
.roll-btn {
  background: #263;
  border: 1px solid #4a5;
  color: #8f8;
  padding: 1px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
}
.roll-btn:hover { background: #374; }
.rolled-label { color: #888; font-size: 10px; }
</style>
