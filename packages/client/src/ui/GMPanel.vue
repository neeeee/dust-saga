<template>
  <div class="gm-panel" v-show="visible" :style="{ left: posX + 'px', top: posY + 'px' }" @mousedown.self="startDrag">
    <div class="gm-header" @mousedown="startDrag">
      <span class="drag-dots">&#8960;</span>
      <span>GM Panel</span>
      <button class="close-btn" @click="$emit('close')">x</button>
    </div>

    <div class="gm-tabs" v-if="selectedDummy">
      <button class="gm-tab" :class="{ active: activeTab === 'actions' }" @click="activeTab = 'actions'">Actions</button>
      <button class="gm-tab" :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">Stats</button>
    </div>

    <div class="gm-body">
      <div class="gm-section">
        <div class="gm-row">
          <button class="gm-btn gm-btn-primary" @click="sendCmd('/spawn_dummy')">Spawn Dummy</button>
          <button class="gm-btn gm-btn-danger" @click="despawnSelected" :disabled="!selectedDummy">Despawn</button>
        </div>
        <select v-if="dummies.length > 0" v-model="selectedDummy" class="gm-select">
          <option value="">Select dummy...</option>
          <option v-for="d in dummies" :key="d.id" :value="d.id">{{ d.id }}</option>
        </select>
      </div>

      <template v-if="selectedDummy && activeTab === 'actions'">
        <div class="gm-section">
          <div class="gm-section-title">Stats</div>
          <div class="gm-stat-grid">
            <label v-for="s in statFields" :key="s.key" class="gm-stat-label">
              {{ s.key }}
              <input type="number" v-model.number="dummyStats[s.key]" class="gm-input" style="width:60px" />
              <button class="gm-btn gm-btn-sm" @click="setStat(s.key)">Set</button>
            </label>
          </div>
        </div>

        <div class="gm-section">
          <div class="gm-section-title">Class</div>
          <select v-model="dummyClass" class="gm-select">
            <option v-for="j in jobList" :key="j" :value="j">{{ j }}</option>
          </select>
          <button class="gm-btn gm-btn-primary" @click="sendCmd('/dummy_class ' + selectedDummy + ' ' + dummyClass)" style="margin-top:4px">Apply Class</button>
        </div>

        <div class="gm-section">
          <div class="gm-section-title">Gear Preset</div>
          <div class="gm-row">
            <button v-for="p in gearPresets" :key="p" class="gm-btn" @click="sendCmd('/dummy_gear ' + selectedDummy + ' ' + p)">{{ p }}</button>
          </div>
        </div>

        <div class="gm-section">
          <div class="gm-section-title">Toggles</div>
          <div class="gm-row">
            <button class="gm-btn" :class="dummyPvp ? 'gm-btn-danger' : 'gm-btn-primary'" @click="sendCmd('/dummy_pvp ' + selectedDummy); dummyPvp = !dummyPvp">PvP: {{ dummyPvp ? 'ON' : 'OFF' }}</button>
            <button class="gm-btn" :class="dummyWalking ? 'gm-btn-active' : ''" @click="sendCmd('/dummy_walk ' + selectedDummy); dummyWalking = !dummyWalking">Walk: {{ dummyWalking ? 'ON' : 'OFF' }}</button>
            <button class="gm-btn" :class="dummyInParty ? 'gm-btn-active' : ''" @click="sendCmd('/dummy_party ' + selectedDummy); dummyInParty = !dummyInParty">Party: {{ dummyInParty ? 'ON' : 'OFF' }}</button>
          </div>
        </div>
      </template>

      <template v-if="selectedDummy && activeTab === 'stats'">
        <div class="gm-section" v-if="normalizedDummyStats">
          <div class="gm-section-title">Basic Info</div>
          <div class="gm-stats-grid">
            <div class="gm-stat-item">
              <span class="gm-stat-lbl">Level</span>
              <span class="gm-stat-val">{{ normalizedDummyStats.level ?? '--' }}</span>
            </div>
            <div class="gm-stat-item">
              <span class="gm-stat-lbl">HP</span>
              <span class="gm-stat-val">{{ normalizedDummyStats.health ?? '--' }}/{{ normalizedDummyStats.maxHealth ?? '--' }}</span>
            </div>
            <div class="gm-stat-item" v-if="normalizedDummyStats.mana !== undefined">
              <span class="gm-stat-lbl">MP</span>
              <span class="gm-stat-val">{{ normalizedDummyStats.mana }}/{{ normalizedDummyStats.maxMana }}</span>
            </div>
          </div>
        </div>

        <div class="gm-section" v-if="normalizedDummyStats?.attack !== undefined">
          <div class="gm-section-title">Derived Stats</div>
          <div class="gm-stats-grid">
            <div class="gm-stat-item">
              <span class="gm-stat-lbl">ATK</span>
              <span class="gm-stat-val">{{ normalizedDummyStats.attack }}</span>
            </div>
            <div class="gm-stat-item">
              <span class="gm-stat-lbl">DEF</span>
              <span class="gm-stat-val">{{ normalizedDummyStats.defense }}</span>
            </div>
            <div class="gm-stat-item">
              <span class="gm-stat-lbl">MATK</span>
              <span class="gm-stat-val">{{ normalizedDummyStats.magicAttack }}</span>
            </div>
            <div class="gm-stat-item">
              <span class="gm-stat-lbl">CRIT</span>
              <span class="gm-stat-val">{{ Math.round((normalizedDummyStats.critChance ?? 0) * 100) }}%</span>
            </div>
            <div class="gm-stat-item">
              <span class="gm-stat-lbl">CSPD</span>
              <span class="gm-stat-val">{{ normalizedDummyStats.castSpeed > 1 ? '+' + Math.round((normalizedDummyStats.castSpeed - 1) * 100) + '%' : '0%' }}</span>
            </div>
          </div>
        </div>

        <div class="gm-section" v-if="selectedDummyEffects.length > 0">
          <div class="gm-section-title">Active Effects ({{ selectedDummyEffects.length }})</div>
          <div class="gm-effects-list">
            <div v-for="effect in selectedDummyEffects" :key="effect.id" class="gm-effect-item">
              <span class="gm-effect-name">{{ effect.skillName || effect.type }}</span>
              <span class="gm-effect-stacks" v-if="effect.stacks > 1">x{{ effect.stacks }}</span>
            </div>
          </div>
        </div>

        <div class="gm-section" v-if="!normalizedDummyStats && selectedDummyEffects.length === 0">
          <span class="gm-empty">No stats data received yet.</span>
        </div>
      </template>
    </div>
  </div>

  <button
    v-if="!visible"
    class="gm-toggle-btn"
    @click="$emit('open')"
    title="GM Panel (F12)"
  >GM</button>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  visible: boolean;
  sendCommand: (cmd: string) => void;
  onChatMessage?: (handler: (sender: string, message: string) => void) => void;
  offChatMessage?: (handler: (sender: string, message: string) => void) => void;
  dummyStats?: Record<string, any>;
  entityStatusEffects?: Record<string, any[]>;
}>();

const emit = defineEmits<{
  close: [];
  open: [];
}>();

const posX = ref(10);
const posY = ref(10);
const dragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

const dummies = ref<Array<{ id: string }>>([]);
const selectedDummy = ref('');
const dummyStats = reactive<Record<string, number>>({
  STR: 5, DEX: 5, AGI: 5, INT: 5, SPI: 5, STA: 5,
  level: 1, hp: 100, maxhp: 100, mp: 50, maxmp: 50,
});
const dummyClass = ref('warrior');
const dummyPvp = ref(false);
const dummyWalking = ref(false);
const dummyInParty = ref(false);
const activeTab = ref<'actions' | 'stats'>('actions');

const selectedDummyStats = computed(() => {
  if (!selectedDummy.value || !props.dummyStats) return null;
  return props.dummyStats[selectedDummy.value] || null;
});

const normalizedDummyStats = computed(() => {
  const raw = selectedDummyStats.value;
  if (!raw) return null;
  if (raw.stats) {
    const s = raw.stats;
    return { level: s.level, health: s.health, maxHealth: s.maxHealth, mana: s.mana, maxMana: s.maxMana, attack: s.attack, defense: s.defense, magicAttack: s.magicAttack, critChance: s.critChance, castSpeed: s.castSpeed };
  }
  return { level: raw.level, health: raw.health, maxHealth: raw.maxHealth };
});

const selectedDummyEffects = computed(() => {
  if (!selectedDummy.value || !props.entityStatusEffects) return [];
  return props.entityStatusEffects[selectedDummy.value] || [];
});

const statFields = [
  { key: 'STR' }, { key: 'DEX' }, { key: 'AGI' }, { key: 'INT' }, { key: 'SPI' }, { key: 'STA' },
  { key: 'level' }, { key: 'hp' }, { key: 'maxhp' }, { key: 'mp' }, { key: 'maxmp' },
];

const gearPresets = ['naked', 'common', 'rare', 'legendary'];

const jobList = [
  'warrior', 'gladiator', 'juggernaut', 'dragoon', 'knight', 'warlord', 'paladin',
  'scout', 'archer', 'sniper', 'hunter', 'provocateur', 'assassin', 'saboteur',
  'acolyte', 'priest', 'cleric', 'enchanter', 'ascetic', 'monk', 'exorcist',
  'mage', 'wizard', 'warlock', 'conjurer', 'sorcerer', 'corruptor', 'shadowblade',
];

function sendCmd(cmd: string) {
  props.sendCommand(cmd);
}

function setStat(prop: string) {
  const val = dummyStats[prop];
  if (selectedDummy.value && val !== undefined) {
    sendCmd(`/dummy_set ${selectedDummy.value} ${prop} ${val}`);
  }
}

function despawnSelected() {
  if (selectedDummy.value) {
    sendCmd(`/despawn_dummy ${selectedDummy.value}`);
  }
}

function handleGMMessage(sender: string, message: string) {
  if (sender !== 'GM') return;
  if (message.startsWith('SPAWNED ')) {
    const id = message.substring(8);
    dummies.value.push({ id });
    selectedDummy.value = id;
    resetDummyState();
  } else if (message.startsWith('DESPAWNED ')) {
    const id = message.substring(10);
    dummies.value = dummies.value.filter(d => d.id !== id);
    if (selectedDummy.value === id) {
      selectedDummy.value = '';
    }
  } else if (message.startsWith('PVP ')) {
    const parts = message.split(' ');
    if (parts[1] === selectedDummy.value) {
      dummyPvp.value = parts[2] === 'on';
    }
  } else if (message.startsWith('WALK ')) {
    const parts = message.split(' ');
    if (parts[1] === selectedDummy.value) {
      dummyWalking.value = parts[2] === 'on';
    }
  } else if (message.startsWith('PARTY ')) {
    const parts = message.split(' ');
    if (parts[1] === selectedDummy.value) {
      dummyInParty.value = parts[2] === 'added';
    }
  }
}

function resetDummyState() {
  dummyPvp.value = false;
  dummyWalking.value = false;
  dummyInParty.value = false;
  dummyClass.value = 'warrior';
}

watch(selectedDummy, () => { resetDummyState(); });

function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
  dragging.value = true;
  dragOffset.value = { x: e.clientX - posX.value, y: e.clientY - posY.value };

  const onMove = (ev: MouseEvent) => {
    if (!dragging.value) return;
    posX.value = ev.clientX - dragOffset.value.x;
    posY.value = ev.clientY - dragOffset.value.y;
  };
  const onUp = () => {
    dragging.value = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

const gmMessageHandler = handleGMMessage;
onMounted(() => {
  props.onChatMessage?.(gmMessageHandler);
});
onUnmounted(() => {
  props.offChatMessage?.(gmMessageHandler);
});
</script>

<style scoped>
.gm-panel {
  position: absolute;
  z-index: 1000;
  background: rgba(15, 15, 25, 0.95);
  border: 1px solid rgba(100, 100, 140, 0.4);
  border-radius: 6px;
  min-width: 260px;
  max-width: 340px;
  color: #ccc;
  font-size: 12px;
  user-select: none;
}

.gm-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(30, 30, 50, 0.9);
  border-bottom: 1px solid rgba(100, 100, 140, 0.3);
  cursor: move;
  border-radius: 6px 6px 0 0;
  font-weight: 600;
  font-size: 13px;
}

.gm-tabs {
  display: flex;
  border-bottom: 1px solid rgba(100, 100, 140, 0.3);
}

.gm-tab {
  flex: 1;
  padding: 5px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #888;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: color 0.15s, border-color 0.15s;
}

.gm-tab:hover { color: #bbb; }
.gm-tab.active { color: #a8b8ff; border-bottom-color: #667eea; }

.drag-dots {
  opacity: 0.5;
  cursor: move;
}

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}
.close-btn:hover { color: #fff; }

.gm-body {
  padding: 8px;
  max-height: 70vh;
  overflow-y: auto;
}

.gm-section {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(100, 100, 140, 0.2);
}

.gm-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.gm-section-title {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.gm-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.gm-stat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gm-stat-label {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #aaa;
}

.gm-select {
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #ccc;
  padding: 4px 6px;
  font-size: 12px;
  outline: none;
}

.gm-select:focus { border-color: #667eea; }

.gm-input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  color: #ccc;
  padding: 2px 4px;
  font-size: 11px;
  outline: none;
}

.gm-input:focus { border-color: #667eea; }

.gm-btn {
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: #ccc;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.15s;
}
.gm-btn:hover { background: rgba(255, 255, 255, 0.12); }
.gm-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.gm-btn-sm {
  padding: 1px 5px;
  font-size: 10px;
}

.gm-btn-primary {
  background: rgba(102, 126, 234, 0.3);
  border-color: rgba(102, 126, 234, 0.5);
  color: #a8b8ff;
}
.gm-btn-primary:hover { background: rgba(102, 126, 234, 0.5); }

.gm-btn-danger {
  background: rgba(234, 102, 102, 0.3);
  border-color: rgba(234, 102, 102, 0.5);
  color: #ffb8b8;
}
.gm-btn-danger:hover { background: rgba(234, 102, 102, 0.5); }

.gm-btn-active {
  background: rgba(102, 234, 140, 0.3);
  border-color: rgba(102, 234, 140, 0.5);
  color: #b8ffb8;
}

.gm-toggle-btn {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 999;
  background: rgba(30, 30, 50, 0.85);
  border: 1px solid rgba(100, 100, 140, 0.4);
  border-radius: 4px;
  color: #888;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 1px;
}
.gm-toggle-btn:hover {
  background: rgba(50, 50, 80, 0.9);
  color: #bbb;
}

.gm-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
}

.gm-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.gm-stat-lbl { color: #888; }
.gm-stat-val { color: #ddd; font-weight: 600; }

.gm-effects-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gm-effect-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.gm-effect-name { color: #a8b8ff; }
.gm-effect-stacks { color: #ffb74d; font-weight: 600; }

.gm-empty {
  color: #555;
  font-size: 11px;
  font-style: italic;
}
</style>
