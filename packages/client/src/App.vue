<template>
  <div id="app">
    <div v-if="gameState === 'auth'" class="auth-container">
      <div class="auth-box">
        <div class="logo">
          <h1>Dust Saga</h1>
          <p class="subtitle">Low Poly MMORPG</p>
        </div>
        <div v-if="!isLoginMode" class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="Enter your email" required />
        </div>
        <div class="form-group">
          <label>Username</label>
          <input v-model="username" type="text" placeholder="Enter your username" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="Enter your password" required />
        </div>
        <button type="button" class="btn-primary" @click="handleAuth">
          {{ isLoginMode ? 'Login' : 'Register' }}
        </button>
        <p class="toggle-mode">
          {{ isLoginMode ? "Don't have an account?" : "Already have an account?" }}
          <a @click="isLoginMode = !isLoginMode">{{ isLoginMode ? 'Register' : 'Login' }}</a>
        </p>
      </div>
    </div>

    <CharacterSelect
      v-else-if="gameState === 'character-select'"
      :characters="characters"
      @select-character="handleSelectCharacter"
      @create-character="handleCreateCharacter"
      @delete-character="handleDeleteCharacter"
    />

    <div v-else-if="gameState === 'playing'" class="game-container">
      <canvas ref="gameCanvas"></canvas>

      <GameHUD
        ref="hudRef"
        :stats="playerStats"
        :player-name="playerName"
        :player-class="playerClass"
        :target-id="targetId"
        :target-name="targetName"
        :target-health="targetHealth"
        :target-max-health="targetMaxHealth"
        :target-level="targetLevel"
        :target-type="targetType"
        :target-class="targetClass"
        :target-status-effects="targetStatusEffects"
        :status-effects="playerStatusEffects"
        @toggle-inventory="showInventory = !showInventory"
        @toggle-quests="showQuests = !showQuests"
        @toggle-character="showInventory = !showInventory"
        @toggle-skills="showSkillWindow = !showSkillWindow"
        @clear-target="gameClient?.setTarget(null)"
        @use-skill="handleUseSkillSlot"
        @party-action="handlePartyAction"
      />

      <ChatPanel
        ref="chatPanelRef"
        :messages="chatMessages"
        @send="handleSendChat"
        @focus="onChatFocus"
        @blur="onChatBlur"
      />

      <InventoryUI
        :visible="showInventory"
        :inventory="inventory"
        :equipment="equipment"
        :max-slots="30"
        @close="showInventory = false"
        @use-item="handleUseItem"
        @equip-item="handleEquipItem"
        @unequip-item="handleUnequipItem"
      />

      <QuestLog
        :visible="showQuests"
        :quests="quests"
        @close="showQuests = false"
        @complete-quest="handleCompleteQuest"
        @abandon-quest="handleAbandonQuest"
      />

      <DialogBox
        :visible="showDialog"
        :npc-name="dialogData.npcName"
        :dialog="dialogData.dialog"
        :shop-items="dialogData.shopItems"
        :available-quests="dialogData.availableQuests"
        @close="showDialog = false"
        @select-option="handleDialogOption"
        @buy="handleBuyItem"
        @accept-quest="handleAcceptQuest"
      />

      <NotificationPopup
        :message="notification.message"
        :type="notification.type"
        :visible="notification.visible"
        @hide="notification.visible = false"
      />

      <StatAllocationPanel
        :visible="showStatPanel"
        :stats="playerStats"
        :stat-points="playerStatPoints"
        :unspent-stat-points="playerUnspentStatPoints"
        :race="playerRace"
        :job-id="playerJobId"
        :stat-breakdown="playerStatBreakdown"
        :status-effects="playerStatusEffects"
        @close="showStatPanel = false"
        @allocate="handleAllocateStat"
        @allocate-batch="handleAllocateBatch"
      />

      <SkillWindow
        v-show="showSkillWindow"
        :game-client="gameClient"
        @close="showSkillWindow = false"
      />

      <PartyPanel
        v-if="partyData"
        :party="partyData"
        :loot-pool="partyLootPool"
        :my-id="gameClient?.getPlayerId() || ''"
        :entity-status-effects="entityStatusEffects"
        @leave-party="handlePartyLeave"
        @kick-member="handlePartyKick"
        @promote-member="handlePartyPromote"
        @roll-loot="handlePartyLootRoll"
      />

      <PartyCreateDialog
        :visible="showPartyCreate"
        :target-name="partyCreateTargetName"
        :target-id="partyCreateTargetId"
        @create="handlePartyCreate"
        @cancel="showPartyCreate = false"
      />

      <PartyInviteDialog
        :visible="showPartyInvite"
        :party-id="partyInviteData.partyId"
        :leader-name="partyInviteData.leaderName"
        :settings="partyInviteData.settings"
        :member-count="partyInviteData.memberCount"
        @accept="handlePartyJoin"
        @reject="showPartyInvite = false"
      />

      <DeathPopup
        :visible="isDead"
        :revived-by="revivedBy"
        @respawn="handleRespawn"
      />

      <div class="controls-hint">
        Click to lock | WASD move | Shift sprint | F attack | I inventory | J quests | K skills | 1-0 skill bar | E interact
      </div>
    </div>

    <div v-else class="loading-screen">
      <h2>Loading...</h2>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { GameClient } from './core/GameClient';
import { PacketType, PlayerStats, StatPoints, PartyData, PartyLootItem } from '@dust-saga/shared';
import CharacterSelect from './ui/CharacterSelect.vue';
import GameHUD from './ui/GameHUD.vue';
import ChatPanel from './ui/ChatPanel.vue';
import InventoryUI from './ui/InventoryUI.vue';
import QuestLog from './ui/QuestLog.vue';
import DialogBox from './ui/DialogBox.vue';
import NotificationPopup from './ui/NotificationPopup.vue';
import StatAllocationPanel from './ui/StatAllocationPanel.vue';
import SkillWindow from './ui/SkillWindow.vue';
import PartyPanel from './ui/PartyPanel.vue';
import PartyCreateDialog from './ui/PartyCreateDialog.vue';
import PartyInviteDialog from './ui/PartyInviteDialog.vue';
import DeathPopup from './ui/DeathPopup.vue';
import { useSkillStore } from './composables/useSkillStore';

type GameState = 'auth' | 'character-select' | 'loading' | 'playing';

const gameState = ref<GameState>('auth');
const isLoginMode = ref(true);
const username = ref('');
const email = ref('');
const password = ref('');
const gameCanvas = ref<HTMLCanvasElement | null>(null);
const hudRef = ref<any>(null);

const characters = ref<any[]>([]);
const playerStats = ref<PlayerStats | null>(null);
const playerName = ref('');
const playerClass = ref('');
const chatMessages = ref<Array<{ sender: string; message: string }>>([]);
const chatFocused = ref(false);
const chatPanelRef = ref<any>(null);
const showInventory = ref(false);
const showQuests = ref(false);
const showDialog = ref(false);
const inventory = ref<any[]>([]);
const equipment = ref<any>({});
const quests = ref<any[]>([]);
const isDead = ref(false);
const revivedBy = ref<string | undefined>(undefined);

const targetId = ref<string | null>(null);
const targetName = ref('');
const targetHealth = ref(0);
const targetMaxHealth = ref(0);
const targetLevel = ref(0);
const targetType = ref('');
const targetClass = ref('');
const targetStatusEffects = ref<any[]>([]);
const entityStatusEffects = ref<Record<string, any[]>>({});

const dialogData = ref<any>({
  npcName: '',
  dialog: null,
  shopItems: [],
  availableQuests: []
});
const currentNPCId = ref('');

const notification = ref({ message: '', type: 'info', visible: false });
const showStatPanel = ref(false);
const playerStatPoints = ref<StatPoints | null>(null);
const playerUnspentStatPoints = ref(0);
const playerUnspentSkillPoints = ref(0);
const playerStatBreakdown = ref<any>(null);
const playerRace = ref('');
const playerJobId = ref('');
const showSkillWindow = ref(false);
const skillStore = useSkillStore();
const playerStatusEffects = ref<any[]>([]);

const partyData = ref<PartyData | null>(null);
const partyLootPool = ref<PartyLootItem[]>([]);
const showPartyCreate = ref(false);
const partyCreateTargetId = ref('');
const partyCreateTargetName = ref('');
const showPartyInvite = ref(false);
const partyInviteData = ref<{ partyId: string; leaderName: string; settings: any; memberCount: number }>({
  partyId: '', leaderName: '', settings: null, memberCount: 0
});

let gameClient: GameClient | null = null;
let currentDialogNPCId = '';

function handleAuth() {
  if (!gameClient) return;
  if (isLoginMode.value) {
    gameClient.login(username.value, password.value);
  } else {
    gameClient.register(username.value, email.value, password.value);
  }
}

function handleSelectCharacter(characterId: string) {
  if (!gameClient) return;
  gameState.value = 'loading';
  gameClient.selectCharacter(characterId);

  setTimeout(() => {
    if (gameState.value === 'loading') {
      gameState.value = 'playing';
      nextTick(() => {
        setupGameCanvas();
      });
    }
  }, 1000);
}

async function handleCreateCharacter(name: string, characterClass: string, race: string) {
  if (!gameClient) return;
  gameClient.createCharacter(name, characterClass, race);
  setTimeout(() => {
    gameClient?.requestCharacterList();
  }, 500);
}

function handleDeleteCharacter(characterId: string) {
  if (!gameClient) return;
  gameClient.deleteCharacter(characterId);
  characters.value = characters.value.filter(c => c.id !== characterId);
}

async function setupGameCanvas() {
  await nextTick();
  if (gameCanvas.value && gameClient) {
    await gameClient.initEngine(gameCanvas.value);
    gameClient.setSkillBarHandler(handleSkillBarKey);
    const minimapCanvas = hudRef.value?.minimapCanvas;
    if (minimapCanvas) {
      gameClient.setMinimapCanvas(minimapCanvas);
    }
  }
}

function handleSendChat(message: string) {
  if (!gameClient) return;
  gameClient.sendChatMessage(message);
}

function onChatFocus() {
  chatFocused.value = true;
  gameClient?.setChatFocused(true);
}

function onChatBlur() {
  chatFocused.value = false;
  gameClient?.setChatFocused(false);
}

function handleUseItem(itemId: string) {
  if (!gameClient) return;
  gameClient.useItem(itemId);
}

function handleEquipItem(itemId: string) {
  if (!gameClient) return;
  gameClient.equipItem(itemId);
}

function handleUnequipItem(slot: string) {
  if (!gameClient) return;
  gameClient.unequipItem(slot);
}

function handleCompleteQuest(questId: string) {
  if (!gameClient) return;
  gameClient.completeQuest(questId);
}

function handleAbandonQuest(questId: string) {
  if (!gameClient) return;
  gameClient.abandonQuest(questId);
}

function handleDialogOption(option: any) {
  if (!gameClient) return;
  if (option.action === 'accept_quest') {
    gameClient.acceptQuest(option.actionData.questId);
    showDialog.value = false;
  } else if (option.action === 'complete_quest') {
    gameClient.completeQuest(option.actionData.questId);
    showDialog.value = false;
  } else if (option.action === 'open_shop') {
  } else if (option.action === 'heal') {
    gameClient.interactNPC(currentDialogNPCId);
    showDialog.value = false;
  } else if (option.action === 'join_nation') {
    gameClient.interactNPC(currentDialogNPCId, 'join_nation');
    showDialog.value = false;
  } else if (option.nextDialogId) {
    gameClient.interactNPC(currentDialogNPCId, option.nextDialogId);
  }
}

function handleBuyItem(itemId: string) {
  if (!gameClient) return;
  gameClient.buyFromShop(itemId);
}

function handleAllocateStat(stat: string) {
  if (!gameClient) return;
  gameClient.allocateStatPoint(stat);
}

function handleAllocateBatch(allocations: Record<string, number>) {
  if (!gameClient) return;
  gameClient.allocateStatBatch(allocations);
}

function handleUseSkillSlot(barIndex: number, slotIndex: number) {
  if (!gameClient) return;
  const slot = skillStore.getSkillInSlot(barIndex, slotIndex);
  if (!slot?.skillName) return;
  if (skillStore.isOnCooldown(slot.skillName)) return;
  gameClient.useSkill(slot.skillName, targetId.value);
}

function handleSkillBarKey(barIndex: number, slotIndex: number) {
  handleUseSkillSlot(barIndex, slotIndex);
}

function handlePartyAction(targetIdStr: string) {
  if (partyData.value) {
    if (partyData.value.leaderId !== gameClient?.getPlayerId()) {
      showNotification('Only the party leader can invite members.', 'error');
      return;
    }
    if (!gameClient) return;
    gameClient.sendPartyInviteRequest(targetIdStr);
    return;
  }
  partyCreateTargetId.value = targetIdStr;
  partyCreateTargetName.value = targetName.value;
  showPartyCreate.value = true;
}

function handlePartyCreate(data: { targetId: string; visibility: string; lootRule: string }) {
  if (!gameClient) return;
  gameClient.sendPartyCreate(data.targetId, data.visibility, data.lootRule);
  showPartyCreate.value = false;
}

function handlePartyJoin(partyId: string) {
  if (!gameClient) return;
  gameClient.sendPartyJoin(partyId);
  showPartyInvite.value = false;
}

function handlePartyLeave() {
  if (!gameClient) return;
  gameClient.sendPartyLeave();
}

function handlePartyKick(targetId: string) {
  if (!gameClient) return;
  gameClient.sendPartyKick(targetId);
}

function handlePartyPromote(targetId: string) {
  if (!gameClient) return;
  gameClient.sendPartyPromote(targetId);
}

function handlePartyLootRoll(lootId: string) {
  if (!gameClient) return;
  gameClient.sendPartyLootRoll(lootId);
}

function handleRespawn() {
  if (!gameClient) return;
  gameClient.value.sendRespawnRequest();
  isDead.value = false;
  revivedBy.value = undefined;
}

function handleAcceptQuest(questId: string) {
  if (!gameClient) return;
  gameClient.acceptQuest(questId);
  showDialog.value = false;
}

function showNotification(message: string, type: string) {
  notification.value = { message, type, visible: true };
}

onMounted(async () => {
  gameClient = new GameClient(null);

  gameClient.setCallbacks({
    onStatsUpdate: (stats) => {
      playerStats.value = stats;
    },
    onStatPointsUpdate: (sp, unspent, unspentSkill, breakdown) => {
      playerStatPoints.value = sp;
      playerUnspentStatPoints.value = unspent;
      playerUnspentSkillPoints.value = unspentSkill;
      if (breakdown) playerStatBreakdown.value = breakdown;
    },
    onSkillProficienciesUpdate: (proficiencies, adeptness) => {
      skillStore.updateSkillProficiencies(
        proficiencies,
        adeptness,
        gameClient?.getJobId() || 'warrior',
        gameClient?.getBaseClass() || 'warrior',
        gameClient?.getUnspentSkillPoints() || 0,
        playerStats.value?.level || 1,
      );
    },
    onInventoryUpdate: (inv, equip) => {
      inventory.value = inv;
      equipment.value = equip;
    },
    onQuestUpdate: (q) => {
      quests.value = q;
    },
    onChatMessage: (sender, message) => {
      chatMessages.value.push({ sender, message });
      if (chatMessages.value.length > 50) chatMessages.value.shift();
    },
    onNotification: (message, type) => {
      showNotification(message, type);
    },
    onDeath: (data) => {
      if (data.isDead) {
        isDead.value = true;
        revivedBy.value = undefined;
      } else {
        isDead.value = false;
        revivedBy.value = data.revivedBy;
      }
    },
    onExperienceGain: (data) => {
      showNotification(`+${data.experience} XP`, 'info');
    },
    onLevelUp: (level) => {
      showNotification(`Level Up! You are now level ${level}!`, 'success');
    },
    onNPCDialog: (data) => {
      currentDialogNPCId = data.npcId;
      dialogData.value = data;
      showDialog.value = true;
    },
    onTargetChange: (id, data) => {
      targetId.value = id;
      if (!id || !data) {
        targetName.value = '';
        targetHealth.value = 0;
        targetMaxHealth.value = 0;
        targetLevel.value = 0;
        targetType.value = '';
        targetClass.value = '';
        targetStatusEffects.value = [];
      } else {
        targetName.value = data.name;
        targetHealth.value = data.health;
        targetMaxHealth.value = data.maxHealth;
        targetLevel.value = data.level;
        targetType.value = data.type || '';
        targetClass.value = data.class || '';
        targetStatusEffects.value = entityStatusEffects.value[id] || [];
      }
    },
    onZoneChange: (zoneId, zoneName) => {
      showNotification(`Entered: ${zoneName}`, 'info');
    },
    onEnemyListUpdate: (enemies) => {
    },
    onCastStart: (skillName, castTime) => {
      skillStore.startCast(skillName, castTime);
    },
    onCastComplete: (skillName) => {
      skillStore.endCast();
    },
    onSkillUsed: (skillName, mpCost, cooldownRemaining) => {
      skillStore.endCast();
      if (cooldownRemaining > 0) {
        skillStore.startCooldown(skillName, cooldownRemaining);
      }
    },
    onSkillError: (skillName, error) => {
      skillStore.endCast();
      const messages: Record<string, string> = {
        cooldown: 'Skill is on cooldown',
        no_mana: 'Not enough MP',
        silenced: 'You are silenced',
        passive: 'Cannot use passive skill',
        not_found: 'Skill not found',
        dead: 'You are dead',
        cc: 'Cannot cast while crowd controlled',
        no_target: 'Select a target first',
        no_self_target: 'Cannot target yourself',
        self_only: 'This skill can only target yourself',
      };
      showNotification(messages[error] || `Cannot use skill: ${error}`, 'error');
    },
    onStatusEffects: (effects) => {
      playerStatusEffects.value = effects;
      entityStatusEffects.value = { ...entityStatusEffects.value, [gameClient?.getPlayerId() || '']: effects };
    },
    onEntityStatusEffects: (entityId, effects) => {
      entityStatusEffects.value = { ...entityStatusEffects.value, [entityId]: effects };
      if (entityId === targetId.value) {
        targetStatusEffects.value = effects;
      }
    },
  });

  await gameClient.initialize();

  const network = gameClient.getNetworkClient();

  network.onPacket(PacketType.AUTH_SUCCESS, (packet: any) => {
    if (gameState.value === 'auth') {
      gameState.value = 'character-select';
      setTimeout(() => {
        gameClient?.requestCharacterList();
      }, 200);
    }
  });

  network.onPacket(PacketType.AUTH_FAILURE, (packet: any) => {
    showNotification(packet.data.message, 'error');
  });

  network.onPacket(PacketType.CHARACTER_LIST, (packet: any) => {
    characters.value = packet.data.characters || [];
  });

  network.onPacket(PacketType.CHARACTER_CREATE, (packet: any) => {
    if (packet.data.character) {
      characters.value.push(packet.data.character);
    }
  });

  network.onPacket(PacketType.CHARACTER_SELECT, (packet: any) => {
    gameState.value = 'playing';
    playerRace.value = packet.data.race || '';
    playerJobId.value = packet.data.jobId || '';
    skillStore.initForCharacter(packet.data.characterId);
    nextTick(() => {
      setupGameCanvas();
    });
  });

  network.onPacket(PacketType.STATS_UPDATE, (packet: any) => {
    if (packet.data.entityId && packet.data.entityId !== gameClient?.getPlayerId()) {
      if (packet.data.entityId === targetId.value) {
        targetHealth.value = packet.data.health || 0;
        targetMaxHealth.value = packet.data.maxHealth || 0;
        if (packet.data.level !== undefined) {
          targetLevel.value = packet.data.level;
        }
      }
    }
    if (packet.data.stats && packet.data.characterId && packet.data.characterId === targetId.value && packet.data.characterId !== gameClient?.getPlayerId()) {
      targetHealth.value = packet.data.stats.health || 0;
      targetMaxHealth.value = packet.data.stats.maxHealth || 0;
      if (packet.data.stats.level !== undefined) {
        targetLevel.value = packet.data.stats.level;
      }
    }
  });

  network.onPacket(PacketType.DAMAGE, (packet: any) => {
    if (packet.data.targetId === targetId.value && !packet.data.missed) {
      targetHealth.value = Math.max(0, targetHealth.value - packet.data.damage);
    }
  });

  network.onPacket(PacketType.HEAL, (packet: any) => {
    if (packet.data.targetId === targetId.value && !packet.data.mpRestore) {
      targetHealth.value = Math.min(targetMaxHealth.value, targetHealth.value + packet.data.amount);
    }
  });

  network.onPacket(PacketType.PARTY_UPDATE, (packet: any) => {
    partyData.value = {
      partyId: packet.data.partyId,
      leaderId: packet.data.leaderId,
      members: packet.data.members,
      settings: packet.data.settings,
    };
    partyLootPool.value = packet.data.lootPool || [];
  });

  network.onPacket(PacketType.PARTY_INVITE, (packet: any) => {
    partyInviteData.value = {
      partyId: packet.data.partyId,
      leaderName: packet.data.leaderName,
      settings: packet.data.settings,
      memberCount: packet.data.memberCount,
    };
    showPartyInvite.value = true;
  });

  network.onPacket(PacketType.PARTY_DISBAND, () => {
    partyData.value = null;
    partyLootPool.value = [];
  });

  network.onPacket(PacketType.PARTY_LOOT_ROLL, (packet: any) => {
    const existing = partyLootPool.value.find(i => i.lootId === packet.data.lootId);
    if (!existing) {
      partyLootPool.value.push({
        lootId: packet.data.lootId,
        itemId: packet.data.itemId,
        itemName: packet.data.itemName,
        quantity: packet.data.quantity,
        rolls: {}
      });
    }
  });

  network.onPacket(PacketType.PARTY_LOOT_RESULT, (packet: any) => {
    partyLootPool.value = partyLootPool.value.filter(i => i.lootId !== packet.data.lootId);
    showNotification(`${packet.data.winnerName} won ${packet.data.itemName}!`, 'info');
  });

  window.addEventListener('keydown', handleGlobalKeyDown);
});

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.code === 'Enter' && !chatFocused.value && gameState.value === 'playing') {
    e.preventDefault();
    chatPanelRef.value?.focusInput();
    return;
  }

  const tag = (document.activeElement?.tagName || '').toLowerCase();
  if (chatFocused.value || tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.code === 'KeyI') {
    showInventory.value = !showInventory.value;
  } else if (e.code === 'KeyJ') {
    showQuests.value = !showQuests.value;
  } else if (e.code === 'KeyC') {
    showStatPanel.value = !showStatPanel.value;
  } else if (e.code === 'KeyK') {
    showSkillWindow.value = !showSkillWindow.value;
  } else if (e.code === 'Escape') {
    showInventory.value = false;
    showQuests.value = false;
    showDialog.value = false;
    showStatPanel.value = false;
    showSkillWindow.value = false;
  }
}

onUnmounted(() => {
  if (gameClient) {
    gameClient.dispose();
  }
  window.removeEventListener('keydown', handleGlobalKeyDown);
});
</script>

<style scoped>
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: 'Segoe UI', sans-serif;
}

.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.auth-box {
  background: rgba(20, 20, 40, 0.95);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 350px;
}

.logo {
  text-align: center;
  margin-bottom: 1.5rem;
}

.logo h1 {
  color: white;
  margin: 0;
  font-size: 2rem;
  letter-spacing: 3px;
}

.subtitle {
  color: #667eea;
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #888;
  font-size: 0.85rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: white;
  font-size: 1rem;
  outline: none;
}

.form-group input:focus {
  border-color: #667eea;
}

.btn-primary {
  width: 100%;
  padding: 0.75rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #5568d3;
}

.toggle-mode {
  text-align: center;
  margin-top: 1rem;
  color: #666;
  font-size: 0.85rem;
}

.toggle-mode a {
  color: #667eea;
  cursor: pointer;
  text-decoration: underline;
}

.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.game-container canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.controls-hint {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: #888;
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 0.75rem;
  pointer-events: none;
}

.loading-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #0a0a15;
  color: white;
}
</style>
