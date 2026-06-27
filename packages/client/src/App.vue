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
      @return-to-title="handleReturnToTitle"
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
        :is-resting="isResting"
        @toggle-inventory="showInventory = !showInventory"
        @toggle-quests="showQuests = !showQuests"
        @toggle-character="showInventory = !showInventory"
        @toggle-skills="showSkillWindow = !showSkillWindow"
        @toggle-rest="handleToggleRest"
        @toggle-settings="showSettings = !showSettings"
        @clear-target="gameClient?.setTarget(null)"
        @use-skill="handleUseSkillSlot"
        @party-action="handlePartyAction"
        @trade-action="handleTradeRequest"
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
        @drop-item="handleDropItem"
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
        :active-quests="dialogData.activeQuests"
        :npc-screen-pos="npcScreenPos"
        @close="closeDialog"
        @select-option="handleDialogOption"
        @progress="handleDialogProgress"
        @buy="handleBuyItem"
        @accept-quest="handleAcceptQuest"
        @complete-quest="handleCompleteQuest"
      />

      <LootWindow
        :visible="showLootWindow"
        :loot-id="lootWindowState.lootId"
        :source-name="lootWindowState.sourceName"
        :items="lootWindowState.items"
        @close="showLootWindow = false"
        @take-item="handleTakeLootItem"
        @take-all="handleTakeAllLoot"
      />

      <CraftWindow
        :visible="showCraftWindow"
        :npc-name="craftWindowState.npcName"
        :profession="craftWindowState.profession"
        :recipes="craftableRecipes"
        :inventory="inventory"
        :player-level="playerStats?.level || 1"
        @close="showCraftWindow = false"
        @craft="handleCraftRequest"
      />

      <EnhancementWindow
        :visible="showEnhancement"
        :inventory="inventory"
        :equipment="equipment"
        @close="showEnhancement = false"
        @enhance="handleEnhance"
        :last-result="lastEnhanceResult"
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
        :racial-passive="playerRacialPassive"
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
        @change-loot-rule="handleChangeLootRule"
        @submit-roll="handleSubmitLootRoll"
        @take-loot="handleTakePartyLoot"
        @target-member="handlePartyTarget"
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

      <GMPanel
        :visible="showGMPanel"
        :send-command="gmSendCommand"
        :on-chat-message="gmOnChatMessage"
        :off-chat-message="gmOffChatMessage"
        :dummy-stats="dummyStats"
        :entity-status-effects="entityStatusEffects"
        @close="showGMPanel = false"
        @open="showGMPanel = true"
      />

      <SettingsPanel
        :visible="showSettings"
        @close="showSettings = false"
        @logout="handleLogout"
        @return-to-character-select="handleReturnToCharacterSelect"
      />

      <div v-if="logoutCountdown > 0" class="logout-overlay">
        <div class="logout-box">
          <div class="logout-message">
            {{ logoutType === 'title' ? 'Returning to title screen' : 'Returning to character select' }}
            in {{ logoutCountdown }}s
          </div>
          <button class="logout-cancel" @click="cancelLogout">Cancel</button>
        </div>
      </div>

      <TradeWindow
        :visible="showTradeWindow"
        :trade="tradeState"
        @add-item="handleTradeAddItem"
        @remove-item="handleTradeRemoveItem"
        @set-gold="handleTradeSetGold"
        @accept="handleTradeAccept"
        @cancel="handleTradeCancel"
      />

      <TradeInviteDialog
        :visible="showTradeInvite"
        :from-name="tradeInviteData.fromName"
        @accept="handleTradeInviteAccept"
        @reject="handleTradeInviteReject"
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
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue';
import { GameClient } from './core/GameClient';
import { PacketType, PlayerStats, StatPoints, PartyData, PartyLootItem, StatusEffectType, getRecipe } from '@dust-saga/shared';
import type { TradeState } from '@dust-saga/shared';
import CharacterSelect from './ui/CharacterSelect.vue';
import GameHUD from './ui/GameHUD.vue';
import ChatPanel from './ui/ChatPanel.vue';
import InventoryUI from './ui/InventoryUI.vue';
import QuestLog from './ui/QuestLog.vue';
import DialogBox from './ui/DialogBox.vue';
import LootWindow from './ui/LootWindow.vue';
import CraftWindow from './ui/CraftWindow.vue';
import NotificationPopup from './ui/NotificationPopup.vue';
import StatAllocationPanel from './ui/StatAllocationPanel.vue';
import SkillWindow from './ui/SkillWindow.vue';
import PartyPanel from './ui/PartyPanel.vue';
import PartyCreateDialog from './ui/PartyCreateDialog.vue';
import PartyInviteDialog from './ui/PartyInviteDialog.vue';
import DeathPopup from './ui/DeathPopup.vue';
import EnhancementWindow from './ui/EnhancementWindow.vue';
import GMPanel from './ui/GMPanel.vue';
import TradeWindow from './ui/TradeWindow.vue';
import TradeInviteDialog from './ui/TradeInviteDialog.vue';
import SettingsPanel from './ui/SettingsPanel.vue';
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
const showLootWindow = ref(false);
const lootWindowState = ref<{ lootId: string; sourceName: string; items: any[] }>({ lootId: '', sourceName: '', items: [] });
const showCraftWindow = ref(false);
const craftWindowState = ref<{ npcId: string; npcName: string; profession: any }>({ npcId: '', npcName: '', profession: undefined });
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
  availableQuests: [],
  activeQuests: []
});
const currentNPCId = ref('');
const npcScreenPos = ref<{ x: number; y: number } | null>(null);
const showEnhancement = ref(false);
let dialogTrackRAF: number | null = null;

const notification = ref({ message: '', type: 'info', visible: false });
const showStatPanel = ref(false);
const playerStatPoints = ref<StatPoints | null>(null);
const playerUnspentStatPoints = ref(0);
const playerUnspentSkillPoints = ref(0);
const playerStatBreakdown = ref<any>(null);
const playerRace = ref('');
const playerRacialPassive = ref('');
const playerJobId = ref('');
const showSkillWindow = ref(false);
const skillStore = useSkillStore();
const playerStatusEffects = ref<any[]>([]);
const isResting = ref(false);
const showGMPanel = ref(false);
const showSettings = ref(false);
const dummyStats = ref<Record<string, any>>({});

const logoutCountdown = ref(0);
const logoutType = ref<'character-select' | 'title'>('title');
let logoutTimer: ReturnType<typeof setInterval> | null = null;

const partyData = ref<PartyData | null>(null);
const partyLootPool = ref<PartyLootItem[]>([]);
const showPartyCreate = ref(false);
const partyCreateTargetId = ref('');
const partyCreateTargetName = ref('');
const showPartyInvite = ref(false);
const partyInviteData = ref<{ partyId: string; leaderName: string; settings: any; memberCount: number }>({
  partyId: '', leaderName: '', settings: null, memberCount: 0
});

const tradeState = ref<TradeState | null>(null);
const showTradeWindow = ref(false);
const showTradeInvite = ref(false);
const tradeInviteData = ref<{ fromName: string; fromId: string }>({ fromName: '', fromId: '' });

let gameClient: GameClient | null = null;
let currentDialogNPCId = '';

function handleReturnToTitle() {
  if (!gameClient) return;
  gameClient.logoutToTitle();
  characters.value = [];
  gameState.value = 'auth';
}

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

async function handleCreateCharacter(data: { name: string; characterClass: string; race: string; racialPassive: string }) {
  if (!gameClient) return;
  gameClient.createCharacter(data.name, data.characterClass, data.race, data.racialPassive);
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

function handleDropItem(data: { itemId: string; quantity: number }) {
  if (!gameClient) return;
  gameClient.dropItem(data.itemId, data.quantity);
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
    closeDialog();
  } else if (option.action === 'complete_quest') {
    gameClient.completeQuest(option.actionData.questId);
    closeDialog();
  } else if (option.action === 'open_shop') {
  } else if (option.action === 'heal') {
    gameClient.interactNPC(currentDialogNPCId);
    closeDialog();
  } else if (option.action === 'join_nation') {
    gameClient.interactNPC(currentDialogNPCId, 'join_nation');
    closeDialog();
  } else if (option.action === 'open_enhancement') {
    closeDialog();
    showEnhancement.value = true;
  } else if (option.action === 'craft') {
    openCraftWindow();
  } else if (option.nextDialogId) {
    gameClient.interactNPC(currentDialogNPCId, option.nextDialogId);
  }
}

function closeDialog() {
  showDialog.value = false;
  npcScreenPos.value = null;
  gameClient?.setDialogActive(false);
  stopDialogTracking();
  if (currentDialogNPCId) {
    gameClient?.getNetworkClient().closeNpcDialog();
  }
}

function handleDialogProgress() {
  closeDialog();
}

function startDialogTracking() {
  stopDialogTracking();
  function track() {
    if (!showDialog.value || !currentNPCId.value) return;
    const worldPos = gameClient?.getEntityWorldPosition(currentNPCId.value);
    if (worldPos) {
      npcScreenPos.value = gameClient?.projectToScreen(worldPos) || null;
    }
    dialogTrackRAF = requestAnimationFrame(track);
  }
  track();
}

function stopDialogTracking() {
  if (dialogTrackRAF !== null) {
    cancelAnimationFrame(dialogTrackRAF);
    dialogTrackRAF = null;
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

function handleToggleRest() {
  gameClient?.toggleRest();
}

function handleLogout(): void {
  startLogoutCountdown('title');
}

function handleReturnToCharacterSelect(): void {
  startLogoutCountdown('character-select');
}

function startLogoutCountdown(type: 'character-select' | 'title'): void {
  if (logoutTimer) return;
  logoutType.value = type;
  logoutCountdown.value = 10;
  showSettings.value = false;
  logoutTimer = setInterval(() => {
    logoutCountdown.value--;
    if (logoutCountdown.value <= 0) {
      executeLogout();
    }
  }, 1000);
}

function cancelLogout(): void {
  if (logoutTimer) {
    clearInterval(logoutTimer);
    logoutTimer = null;
  }
  logoutCountdown.value = 0;
}

function executeLogout(): void {
  if (logoutTimer) {
    clearInterval(logoutTimer);
    logoutTimer = null;
  }
  const wasTitle = logoutType.value === 'title';
  logoutCountdown.value = 0;

  showSettings.value = false;
  showInventory.value = false;
  showQuests.value = false;
  showSkillWindow.value = false;
  showStatPanel.value = false;
  showEnhancement.value = false;
  showDialog.value = false;
  isResting.value = false;
  isDead.value = false;

  if (gameClient) {
    if (wasTitle) {
      gameClient.logoutToTitle();
      gameState.value = 'auth';
    } else {
      gameClient.returnToCharacterSelect();
      gameState.value = 'loading';
    }
  }
}

function handleSkillBarKey(barIndex: number, slotIndex: number) {
  handleUseSkillSlot(barIndex, slotIndex);
}

function handlePartyTarget(characterId: string) {
  gameClient?.targetEntity(characterId);
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

function handlePartyLootRoll(_lootId: string) {
  // deprecated — replaced by handleSubmitLootRoll with explicit kind.
  // Kept as a no-op so legacy callers don't break.
}

function handleChangeLootRule(rule: string) {
  gameClient?.setPartyLootRule(rule);
}

function handleSubmitLootRoll(lootId: string, kind: 'need' | 'greed' | 'pass') {
  gameClient?.submitLootRoll(lootId, kind);
}

function handleTakePartyLoot(lootId: string) {
  gameClient?.takePartyLoot(lootId);
}

function handleTradeAddItem(slot: number, quantity: number) {
  gameClient?.getNetworkClient().sendTradeAddItem(slot, quantity);
}

function handleTradeRequest(targetId: string) {
  gameClient?.getNetworkClient().sendTradeRequest(targetId);
}

function handleTradeRemoveItem(offerIndex: number) {
  gameClient?.getNetworkClient().sendTradeRemoveItem(offerIndex);
}

function handleTradeSetGold(gold: number) {
  gameClient?.getNetworkClient().sendTradeSetGold(gold);
}

function handleTradeAccept() {
  gameClient?.getNetworkClient().sendTradeAccept();
}

function handleTradeCancel() {
  gameClient?.getNetworkClient().sendTradeCancel();
}

function handleTradeInviteAccept() {
  showTradeInvite.value = false;
  gameClient?.getNetworkClient().sendTradeResponse(true);
}

function handleTradeInviteReject() {
  showTradeInvite.value = false;
  gameClient?.getNetworkClient().sendTradeResponse(false);
}

function handleRespawn() {
  if (!gameClient) return;
  gameClient.value.sendRespawnRequest();
  isDead.value = false;
  revivedBy.value = undefined;
}

function handleEnhance(data: { weaponSlot: { slotIndex: number; itemId: string }; materialSlots: Array<{ slotIndex: number; itemId: string }> }) {
  if (!gameClient) return;
  gameClient.sendEnhance(data);
}

const lastEnhanceResult = ref<{ success: boolean; weaponSlotIndex: number; enhancementLevel: number; enhancementElement: string } | null>(null);

function handleEnhancementResult(data: { success: boolean; weaponSlotIndex: number; enhancementLevel: number; enhancementElement: string }) {
  lastEnhanceResult.value = data;
}

function handleAcceptQuest(questId: string) {
  if (!gameClient) return;
  gameClient.acceptQuest(questId);
  closeDialog();
}

function handleOpenNearestLoot(): void {
  if (!gameClient) return;
  const nearest = gameClient.nearestLootBeacon(4);
  if (!nearest) {
    showLootWindow.value = false;
    return;
  }
  const bag = (gameClient as any).lootBeacons.get(nearest.lootId);
  if (!bag) return;
  lootWindowState.value = {
    lootId: nearest.lootId,
    sourceName: bag.sourceName || 'Loot',
    items: bag.items || [],
  };
  showLootWindow.value = true;
}

function handleTakeLootItem(lootId: string, itemId: string): void {
  gameClient?.pickupLoot(lootId, itemId);
  const bag = (gameClient as any).lootBeacons.get(lootId);
  if (!bag || !bag.items || bag.items.length <= 1) {
    showLootWindow.value = false;
  } else {
    lootWindowState.value = {
      lootId,
      sourceName: bag.sourceName || 'Loot',
      items: bag.items.filter((i: any) => i.id !== itemId),
    };
  }
}

function handleTakeAllLoot(lootId: string): void {
  gameClient?.pickupLoot(lootId, undefined, true);
  showLootWindow.value = false;
}

function openCraftWindow(): void {
  if (!gameClient) return;
  const npcId = gameClient.currentNpcId;
  const data = gameClient.getLastNpcDialog();
  if (!npcId || !data) return;
  craftWindowState.value = {
    npcId,
    npcName: data.npcName || 'Craftsman',
    profession: data.craftProfession,
  };
  showCraftWindow.value = true;
  closeDialog();
}

function handleCraftRequest(recipeId: string): void {
  if (!gameClient) return;
  gameClient.craft(recipeId, craftWindowState.value.npcId);
}

const craftableRecipes = computed(() => {
  if (!craftWindowState.value.profession) return [];
  const known = gameClient?.getLearnedRecipes() || [];
  const profession = craftWindowState.value.profession;
  return known
    .map(id => getRecipe(id))
    .filter((r): r is NonNullable<typeof r> => !!r && r.profession === profession);
});

function showNotification(message: string, type: string) {
  notification.value = { message, type, visible: true };
}

function gmSendCommand(cmd: string) {
  gameClient?.sendChatMessage(cmd);
}

const gmChatHandlers: Array<(sender: string, message: string) => void> = [];

function gmOnChatMessage(handler: (sender: string, message: string) => void) {
  gmChatHandlers.push(handler);
}

function gmOffChatMessage(handler: (sender: string, message: string) => void) {
  const idx = gmChatHandlers.indexOf(handler);
  if (idx >= 0) gmChatHandlers.splice(idx, 1);
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
      gmChatHandlers.forEach(h => h(sender, message));
    },
    onNotification: (message, type) => {
      showNotification(message, type);
    },
    onEnhancementResult: (data) => {
      handleEnhancementResult(data);
    },
    onDeath: (data) => {
      if (data.isDead) {
        isDead.value = true;
        isResting.value = false;
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
      currentNPCId.value = data.npcId;
      dialogData.value = data;
      showDialog.value = true;
      gameClient?.setDialogActive(true);
      startDialogTracking();
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
    onCastCancel: (skillName) => {
      skillStore.endCast();
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
        insufficient_proficiency: 'Not enough proficiency',
        insufficient_level: 'Level too low',
        pvp_disabled: 'PvP is disabled in this zone',
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
    onRestStateChange: (resting) => {
      isResting.value = resting;
    },
    onEntityRestStateChange: (_characterId, _resting) => {
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
    if (gameState.value === 'loading' || gameState.value === 'playing') {
      gameState.value = 'character-select';
    }
  });

  network.onPacket(PacketType.CHARACTER_CREATE, (packet: any) => {
    if (packet.data.character) {
      characters.value.push(packet.data.character);
    }
  });

  network.onPacket(PacketType.CHARACTER_SELECT, (packet: any) => {
    gameState.value = 'playing';
    playerRace.value = packet.data.race || '';
    playerRacialPassive.value = packet.data.racialPassive || '';
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
      const eid = packet.data.entityId;
      dummyStats.value = { ...dummyStats.value, [eid]: { ...(dummyStats.value[eid] || {}), ...packet.data } };
    }
    if (packet.data.stats && packet.data.characterId && packet.data.characterId !== gameClient?.getPlayerId()) {
      if (packet.data.characterId === targetId.value) {
        targetHealth.value = packet.data.stats.health || 0;
        targetMaxHealth.value = packet.data.stats.maxHealth || 0;
        if (packet.data.stats.level !== undefined) {
          targetLevel.value = packet.data.stats.level;
        }
      }
      const cid = packet.data.characterId;
      dummyStats.value = { ...dummyStats.value, [cid]: { ...(dummyStats.value[cid] || {}), ...packet.data } };
    }
  });

  network.onPacket(PacketType.DAMAGE, (packet: any) => {
    if (packet.data.targetId === targetId.value && !packet.data.missed) {
      let total = packet.data.damage || 0;
      if (packet.data.elementalDamage) {
        for (const el of packet.data.elementalDamage) {
          total += el.damage;
        }
      }
      if (packet.data.physicalDamage) {
        total += packet.data.physicalDamage;
      }
      if (packet.data.physicalElementalDamage) {
        for (const el of packet.data.physicalElementalDamage) {
          total += el.damage;
        }
      }
      targetHealth.value = Math.max(0, targetHealth.value - total);
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
    if (gameClient) {
      gameClient.updatePartyMembers((packet.data.members || []).map((m: any) => m.characterId));
    }
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
    if (gameClient) {
      gameClient.updatePartyMembers([]);
    }
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

  network.onPacket(PacketType.TRADE_INVITE, (packet: any) => {
    tradeInviteData.value = { fromName: packet.data.fromName, fromId: packet.data.fromId };
    showTradeInvite.value = true;
  });

  network.onPacket(PacketType.TRADE_OPEN, () => {
    showTradeWindow.value = true;
  });

  network.onPacket(PacketType.TRADE_UPDATE, (packet: any) => {
    tradeState.value = packet.data;
  });

  network.onPacket(PacketType.TRADE_CLOSE, (packet: any) => {
    showTradeWindow.value = false;
    tradeState.value = null;
    if (packet.data.reason === 'cancelled') {
      showNotification('Trade cancelled.', 'info');
    } else if (packet.data.reason === 'completed') {
      showNotification('Trade completed!', 'success');
    } else if (packet.data.reason === 'too_far') {
      showNotification('Trade cancelled: too far away.', 'error');
    } else if (packet.data.reason === 'error') {
      showNotification('Trade failed.', 'error');
    }
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
  if (e.code === 'Escape' && (chatFocused.value || tag === 'input' || tag === 'textarea' || tag === 'select')) {
    chatPanelRef.value?.blurInput();
    return;
  }
  if (chatFocused.value || tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.code === 'F12') {
    e.preventDefault();
    const role = gameClient?.getAccountRole();
    if (role !== 'gm' && role !== 'admin') return;
    showGMPanel.value = !showGMPanel.value;
  } else if (e.code === 'KeyI') {
    showInventory.value = !showInventory.value;
  } else if (e.code === 'KeyJ') {
    showQuests.value = !showQuests.value;
  } else if (e.code === 'KeyC') {
    showStatPanel.value = !showStatPanel.value;
  } else if (e.code === 'KeyK') {
    showSkillWindow.value = !showSkillWindow.value;
  } else if (e.code === 'KeyR') {
    gameClient?.toggleRest();
  } else if (e.code === 'KeyL') {
    e.preventDefault();
    handleOpenNearestLoot();
  } else if (e.code === 'Tab') {
    e.preventDefault();
    gameClient?.cycleTarget(e.shiftKey ? -1 : 1);
  } else if (e.code === 'Escape') {
    gameClient?.cancelCast();
    showInventory.value = false;
    showQuests.value = false;
    if (showDialog.value) {
      closeDialog();
    }
    showEnhancement.value = false;
    showStatPanel.value = false;
    showSkillWindow.value = false;
    if (showTradeWindow.value) {
      handleTradeCancel();
    }
    if (gameClient) {
      gameClient.setTarget(null);
      gameClient.cancelClickToMove();
    }
  }
}

onUnmounted(() => {
  if (gameClient) {
    gameClient.dispose();
  }
  stopDialogTracking();
  window.removeEventListener('keydown', handleGlobalKeyDown);
});

const SONG_TYPES = new Set([
  StatusEffectType.SONG_GREEN,
  StatusEffectType.SONG_BLUE,
  StatusEffectType.SONG_YELLOW,
  StatusEffectType.SONG_RED,
]);

watch(playerStatusEffects, (effects) => {
  if (!gameClient) return;
  const now = Date.now();
  const activeSong = effects?.find(e => SONG_TYPES.has(e.type) && (!e.expiresAt || e.expiresAt > now));
  const engine = gameClient.getEngine();
  if (activeSong) {
    engine.createSongIndicator(activeSong.type, 5);
  } else {
    engine.removeSongIndicator();
  }
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

.logout-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.logout-box {
  background: rgba(20, 20, 40, 0.95);
  padding: 2rem 3rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  text-align: center;
}

.logout-message {
  color: white;
  font-size: 1.1rem;
  margin-bottom: 1.2rem;
}

.logout-cancel {
  padding: 0.6rem 2rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
}

.logout-cancel:hover {
  background: #5568d3;
}
</style>
