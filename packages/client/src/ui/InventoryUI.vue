<template>
  <div ref="panelRef" class="inventory-panel" v-show="visible" data-draggable :style="{ left: posX + 'px', top: posY + 'px' }">
    <div class="panel-header" data-drag-handle>
      <span class="drag-dots">&#8960;</span>
      <h3>Inventory</h3>
      <button class="close-btn" @click="$emit('close')">x</button>
    </div>

    <div class="inventory-top">
      <div class="equip-left">
        <div
          v-for="slot in leftSlots"
          :key="slot.key"
          class="equip-slot"
          :class="{ filled: equipment[slot.key], [getItemRarity(equipment[slot.key]?.itemId)]: equipment[slot.key] }"
          @click="handleEquipClick(slot.key)"
          @mouseenter="equipment[slot.key] && showTooltip($event, equipment[slot.key].itemId, equipment[slot.key].enhancementLevel, equipment[slot.key].enhancementElement)"
          @mouseleave="hideTooltip"
        >
          <span class="slot-icon">{{ equipment[slot.key] ? getItemIcon(equipment[slot.key].itemId) : slot.icon }}</span>
          <span class="slot-label">{{ slot.label }}</span>
          <span v-if="equipment[slot.key]" class="slot-item-dot"></span>
        </div>
      </div>

      <div class="preview-section">
        <canvas ref="previewCanvas" width="200" height="280"></canvas>
      </div>

      <div class="equip-right">
        <div
          v-for="slot in rightSlots"
          :key="slot.key"
          class="equip-slot"
          :class="{ filled: equipment[slot.key], [getItemRarity(equipment[slot.key]?.itemId)]: equipment[slot.key] }"
          @click="handleEquipClick(slot.key)"
          @mouseenter="equipment[slot.key] && showTooltip($event, equipment[slot.key].itemId, equipment[slot.key].enhancementLevel, equipment[slot.key].enhancementElement)"
          @mouseleave="hideTooltip"
        >
          <span class="slot-icon">{{ equipment[slot.key] ? getItemIcon(equipment[slot.key].itemId) : slot.icon }}</span>
          <span class="slot-label">{{ slot.label }}</span>
          <span v-if="equipment[slot.key]" class="slot-item-dot"></span>
        </div>
      </div>
    </div>

    <div class="inventory-bottom">
      <div class="tab-bar">
        <div class="tab" :class="{ active: activeTab === 1 }" @click="activeTab = 1">1</div>
        <div class="tab" :class="{ active: activeTab === 2 }" @click="activeTab = 2">2</div>
        <div class="tab" :class="{ active: activeTab === 3 }" @click="activeTab = 3">3</div>
        <div class="tab" :class="{ active: activeTab === 4 }" @click="activeTab = 4">4</div>
        <div class="slot-count">{{ usedSlotCount }}/{{ totalSlots }}</div>
      </div>
      <div class="item-grid">
        <div
          v-for="(item, idx) in tabItems"
          :key="idx"
          class="item-slot"
          :class="getItemRarity(item.itemId)"
          draggable="true"
          @dragstart="onItemDragStart($event, item)"
          @click="handleItemClick(item)"
          @contextmenu.prevent="handleItemRightClick($event, item)"
          @mouseenter="showTooltip($event, item.itemId, item.enhancementLevel, item.enhancementElement)"
          @mouseleave="hideTooltip"
        >
          <span class="item-icon">{{ getItemIcon(item.itemId) }}</span>
          <span v-if="item.quantity > 1" class="item-qty">{{ item.quantity }}</span>
        </div>
        <div v-for="n in emptySlots" :key="'empty-' + n" class="item-slot empty"></div>
      </div>
    </div>

    <div
      v-if="trashMenu.visible"
      class="trash-context-menu"
      :style="{ left: trashMenu.x + 'px', top: trashMenu.y + 'px' }"
    >
      <div class="trash-option" @click="confirmTrash">
        <span>Trash {{ trashMenu.quantity > 1 ? '1' : getItemName(trashMenu.itemId) }}</span>
      </div>
      <div v-if="trashMenu.quantity > 1" class="trash-option" @click="confirmTrashAll">
        <span>Trash All (x{{ trashMenu.quantity }})</span>
      </div>
      <div class="trash-option cancel" @click="trashMenu.visible = false">
        <span>Cancel</span>
      </div>
    </div>

    <div
      v-if="tooltip.visible"
      class="item-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="tooltip-name" :class="tooltip.rarity">{{ tooltip.enhanceLevel > 0 ? getEnhancedItemName(tooltip.name, tooltip.enhanceLevel, tooltip.enhanceElement) : tooltip.name }}</div>
      <div class="tooltip-type">{{ tooltip.type }}</div>
      <div v-if="tooltip.slot" class="tooltip-slot">Slot: {{ tooltip.slot }}</div>
      <div v-if="tooltip.level > 0" class="tooltip-level">Required Level: {{ tooltip.level }}</div>
      <div v-if="tooltip.enhanceLevel > 0" class="tooltip-enhance">+{{ tooltip.enhanceLevel }} Enhanced</div>
      <div class="tooltip-desc">{{ tooltip.description }}</div>
      <div v-if="tooltip.statLines.length > 0" class="tooltip-stats">
        <div v-for="(line, i) in tooltip.statLines" :key="i" class="tooltip-stat">{{ line }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, reactive, computed } from 'vue';
import { ITEM_DATABASE, getEnhancedItemName } from '@dust-saga/shared';
import { useDraggable } from '../composables/useDraggable';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight, MeshBuilder, StandardMaterial, Color3, Color4, Vector3, AbstractMesh, TransformNode } from '@babylonjs/core';

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-inventory', { x: 150, y: 40 });
const panelRef = ref<HTMLElement | null>(null);
const previewCanvas = ref<HTMLCanvasElement | null>(null);

const props = defineProps<{
  visible: boolean;
  inventory: Array<{ itemId: string; quantity: number; slot: number }>;
  equipment: Record<string, any>;
  maxSlots: number;
}>();

const emit = defineEmits<{
  'close': [];
  'equip-item': [itemId: string];
  'use-item': [itemId: string];
  'unequip-item': [slot: string];
  'drop-item': [data: { itemId: string; quantity: number }];
}>();

const SLOTS_PER_TAB = 16;
const totalSlots = 64;
const activeTab = ref(1);

const usedSlotCount = computed(() => props.inventory.length);

const tabItems = computed(() => {
  const start = (activeTab.value - 1) * SLOTS_PER_TAB;
  const end = start + SLOTS_PER_TAB;
  const items: Array<{ itemId: string; quantity: number; slot: number; enhancementLevel?: number; enhancementElement?: string }> = [];
  for (let i = start; i < end && i < totalSlots; i++) {
    const item = props.inventory.find(inv => inv.slot === i);
    if (item) items.push(item);
  }
  return items;
});

const emptySlots = computed(() => {
  const tabItemCount = tabItems.value.length;
  return SLOTS_PER_TAB - tabItemCount;
});

const leftSlots = [
  { key: 'helmet', label: 'Head', icon: 'H' },
  { key: 'armor', label: 'Torso', icon: 'T' },
  { key: 'gloves', label: 'Hands', icon: 'G' },
  { key: 'legs', label: 'Legs', icon: 'L' },
  { key: 'boots', label: 'Feet', icon: 'B' },
];

const rightSlots = [
  { key: 'weapon', label: 'Weapon', icon: 'W' },
  { key: 'shield', label: 'Shield', icon: 'S' },
  { key: 'earring_1', label: 'Ear 1', icon: 'e' },
  { key: 'earring_2', label: 'Ear 2', icon: 'e' },
  { key: 'necklace', label: 'Neck', icon: 'N' },
  { key: 'belt', label: 'Belt', icon: 'b' },
  { key: 'ring_1', label: 'Ring 1', icon: 'r' },
  { key: 'ring_2', label: 'Ring 2', icon: 'r' },
];

let previewEngine: Engine | null = null;
let previewScene: Scene | null = null;
let characterRoot: TransformNode | null = null;
let rotationAngle = 0;
let animationFrameId: number | null = null;

const RARITY_COLORS: Record<string, Color3> = {
  common: new Color3(0.6, 0.6, 0.6),
  uncommon: new Color3(0.2, 0.8, 0.2),
  rare: new Color3(0.2, 0.4, 1.0),
  epic: new Color3(0.6, 0.2, 0.9),
  legendary: new Color3(1.0, 0.65, 0.0),
};

function getItemName(itemId: string): string {
  return ITEM_DATABASE[itemId]?.name || itemId;
}

const ITEM_TYPE_ICONS: Record<string, string> = {
  weapon: 'W', armor: 'A', helmet: 'H', boots: 'B', gloves: 'G',
  legs: 'L', shield: 'S', earring: 'e', necklace: 'N', belt: 'b',
  ring: 'r', consumable: 'P', material: 'M', quest: 'Q',
};

function getItemIcon(itemId: string): string {
  const def = ITEM_DATABASE[itemId];
  if (!def) return '?';
  return ITEM_TYPE_ICONS[def.type] || '?';
}

function getEquipSlotName(eq: any): string {
  if (!eq) return '';
  const baseName = getItemName(eq.itemId);
  return getEnhancedItemName(baseName, eq.enhancementLevel, eq.enhancementElement);
}

function getInventoryItemName(item: any): string {
  const baseName = getItemName(item.itemId);
  return getEnhancedItemName(baseName, item.enhancementLevel, item.enhancementElement);
}

function getItemRarity(itemId: string): string {
  return ITEM_DATABASE[itemId]?.rarity || 'common';
}

const tooltip = reactive<{ visible: boolean; x: number; y: number; name: string; rarity: string; type: string; slot: string; level: number; description: string; statLines: string[]; enhanceLevel: number; enhanceElement: string | null }>({
  visible: false, x: 0, y: 0, name: '', rarity: 'common', type: '', slot: '', level: 0, description: '', statLines: [], enhanceLevel: 0, enhanceElement: null,
});

function showTooltip(event: MouseEvent, itemId: string, enhancementLevel?: number, enhancementElement?: string | null): void {
  const def = ITEM_DATABASE[itemId];
  if (!def) return;
  const statLines: string[] = [];
  const s = def.stats;
  if (s.attack) statLines.push(`+${s.attack} Attack`);
  if (s.defense) statLines.push(`+${s.defense} Defense`);
  if (s.health) statLines.push(`+${s.health} Health`);
  if (s.mana) statLines.push(`+${s.mana} Mana`);
  if (s.speed) statLines.push(`+${s.speed} Speed`);
  if (s.criticalChance) statLines.push(`+${Math.round(s.criticalChance * 100)}% Critical`);
  if (s.accuracy) statLines.push(`+${s.accuracy} Accuracy`);
  if (s.dodge) statLines.push(`${s.dodge >= 0 ? '+' : ''}${s.dodge} Dodge`);
  if (s.attackSpeed) statLines.push(`+${Math.round(s.attackSpeed * 100)}% Attack Speed`);
  if (s.fireResist) statLines.push(`+${s.fireResist} Fire Resist`);
  if (s.iceResist) statLines.push(`+${s.iceResist} Ice Resist`);
  if (s.lightningResist) statLines.push(`+${s.lightningResist} Lightning Resist`);
  if (s.poisonResist) statLines.push(`+${s.poisonResist} Poison Resist`);
  if (s.darkResist) statLines.push(`+${s.darkResist} Dark Resist`);
  if (s.holyResist) statLines.push(`+${s.holyResist} Holy Resist`);
  if (s.magicAttack) statLines.push(`+${Math.round(s.magicAttack * 100)}% Magic Attack`);
  if (s.STA) statLines.push(`+${s.STA} STA`);
  if (s.STR) statLines.push(`+${s.STR} STR`);
  if (s.AGI) statLines.push(`+${s.AGI} AGI`);
  if (s.DEX) statLines.push(`+${s.DEX} DEX`);
  if (s.SPI) statLines.push(`+${s.SPI} SPI`);
  if (s.INT) statLines.push(`+${s.INT} INT`);

  if (enhancementLevel && enhancementLevel > 0) {
    const enhAtk = !((s.magicAttack && s.magicAttack > 0) || (s.INT && s.INT > 0) || (s.SPI && s.SPI > 0)) ? enhancementLevel * 3 : 0;
    const enhMatk = (s.magicAttack && s.magicAttack > 0) || (s.INT && s.INT > 0) || (s.SPI && s.SPI > 0) ? enhancementLevel * 2 : 0;
    if (enhAtk > 0) statLines.push(`+${enhAtk} Attack (Enhance)`);
    if (enhMatk > 0) statLines.push(`+${enhMatk}% Magic Attack (Enhance)`);
    if (def.equipmentSlot === 'armor' || def.equipmentSlot === 'helmet') {
      statLines.push(`+${enhancementLevel * 3} Defense (Enhance)`);
      statLines.push(`+${enhancementLevel * 15} Health (Enhance)`);
    } else if (def.equipmentSlot === 'boots') {
      statLines.push(`+${enhancementLevel * 2} Defense (Enhance)`);
      statLines.push(`+${enhancementLevel} Dodge (Enhance)`);
    }
  }

  const panelRect = panelRef.value?.getBoundingClientRect();
  const tx = event.clientX + 12 - (panelRect?.left || 0);
  const ty = event.clientY + 12 - (panelRect?.top || 0);

  tooltip.visible = true;
  tooltip.x = tx;
  tooltip.y = ty;
  tooltip.name = def.name;
  tooltip.rarity = def.rarity;
  tooltip.type = def.type.charAt(0).toUpperCase() + def.type.slice(1);
  tooltip.slot = def.equipmentSlot ? def.equipmentSlot.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
  tooltip.level = def.requiredLevel;
  tooltip.description = def.description;
  tooltip.statLines = statLines;
  tooltip.enhanceLevel = enhancementLevel || 0;
  tooltip.enhanceElement = enhancementElement || null;
}

function hideTooltip(): void {
  tooltip.visible = false;
}

function initPreview(): void {
  if (!previewCanvas.value) return;
  previewEngine = new Engine(previewCanvas.value, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });
  previewScene = new Scene(previewEngine);
  previewScene.clearColor = new Color4(0.04, 0.04, 0.08, 1);

  const camera = new ArcRotateCamera('previewCam', -Math.PI / 2, Math.PI / 3, 4, Vector3.Zero(), previewScene);
  camera.lowerRadiusLimit = 2.5;
  camera.upperRadiusLimit = 6;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 2.2;
  camera.attachControl(previewCanvas.value, true);
  camera.inputs.attached.pointers.buttons = [0];

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), previewScene);
  hemi.intensity = 0.7;
  const dir = new DirectionalLight('dir', new Vector3(-1, -2, -1), previewScene);
  dir.intensity = 0.6;
  dir.position = new Vector3(5, 10, 5);

  characterRoot = new TransformNode('charRoot', previewScene);
  buildCharacterMeshes();
  startRotationLoop();
}

function makeEquipMat(name: string, scene: Scene): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = new Color3(0.3, 0.3, 0.4);
  mat.alpha = 0.3;
  return mat;
}

function buildCharacterMeshes(): void {
  if (!previewScene || !characterRoot) return;

  const skinMat = new StandardMaterial('skin', previewScene);
  skinMat.diffuseColor = new Color3(0.85, 0.7, 0.55);

  const defaultMat = new StandardMaterial('default', previewScene);
  defaultMat.diffuseColor = new Color3(0.3, 0.3, 0.4);

  const head = MeshBuilder.CreateSphere('head', { diameter: 0.5, segments: 8 }, previewScene);
  head.position.y = 1.7;
  head.parent = characterRoot;
  head.material = skinMat;

  const body = MeshBuilder.CreateCylinder('body', { height: 0.9, diameterTop: 0.45, diameterBottom: 0.4, tessellation: 8 }, previewScene);
  body.position.y = 1.05;
  body.parent = characterRoot;
  body.material = defaultMat;

  const leftArm = MeshBuilder.CreateCylinder('leftArm', { height: 0.7, diameter: 0.12, tessellation: 8 }, previewScene);
  leftArm.position.set(-0.35, 1.1, 0);
  leftArm.rotation.z = 0.2;
  leftArm.parent = characterRoot;
  leftArm.material = skinMat;

  const rightArm = MeshBuilder.CreateCylinder('rightArm', { height: 0.7, diameter: 0.12, tessellation: 8 }, previewScene);
  rightArm.position.set(0.35, 1.1, 0);
  rightArm.rotation.z = -0.2;
  rightArm.parent = characterRoot;
  rightArm.material = skinMat;

  const leftLeg = MeshBuilder.CreateCylinder('leftLeg', { height: 0.7, diameter: 0.14, tessellation: 8 }, previewScene);
  leftLeg.position.set(-0.15, 0.35, 0);
  leftLeg.parent = characterRoot;
  leftLeg.material = skinMat;

  const rightLeg = MeshBuilder.CreateCylinder('rightLeg', { height: 0.7, diameter: 0.14, tessellation: 8 }, previewScene);
  rightLeg.position.set(0.15, 0.35, 0);
  rightLeg.parent = characterRoot;
  rightLeg.material = skinMat;

  const helmetMesh = MeshBuilder.CreateSphere('equip_helmet', { diameter: 0.55, segments: 8 }, previewScene);
  helmetMesh.position.y = 1.75;
  helmetMesh.scaling.y = 0.6;
  helmetMesh.parent = characterRoot;
  helmetMesh.material = makeEquipMat('mat_helmet', previewScene);

  const armorMesh = MeshBuilder.CreateCylinder('equip_armor', { height: 0.95, diameterTop: 0.5, diameterBottom: 0.45, tessellation: 8 }, previewScene);
  armorMesh.position.y = 1.05;
  armorMesh.parent = characterRoot;
  armorMesh.material = makeEquipMat('mat_armor', previewScene);

  const glovesMesh = MeshBuilder.CreateSphere('equip_gloves', { diameter: 0.18, segments: 6 }, previewScene);
  glovesMesh.position.set(-0.38, 0.72, 0);
  glovesMesh.parent = characterRoot;
  glovesMesh.material = makeEquipMat('mat_gloves', previewScene);

  const legsMesh = MeshBuilder.CreateCylinder('equip_legs', { height: 0.6, diameterTop: 0.2, diameterBottom: 0.18, tessellation: 8 }, previewScene);
  legsMesh.position.y = 0.4;
  legsMesh.parent = characterRoot;
  legsMesh.material = makeEquipMat('mat_legs', previewScene);

  const bootsMesh = MeshBuilder.CreateBox('equip_boots', { width: 0.5, height: 0.25, depth: 0.3 }, previewScene);
  bootsMesh.position.y = 0.12;
  bootsMesh.parent = characterRoot;
  bootsMesh.material = makeEquipMat('mat_boots', previewScene);

  const weaponMesh = MeshBuilder.CreateBox('equip_weapon', { width: 0.08, height: 1.2, depth: 0.08 }, previewScene);
  weaponMesh.position.set(0.55, 0.8, 0);
  weaponMesh.rotation.z = -0.3;
  weaponMesh.parent = characterRoot;
  weaponMesh.material = makeEquipMat('mat_weapon', previewScene);

  const shieldMesh = MeshBuilder.CreateBox('equip_shield', { width: 0.04, height: 0.7, depth: 0.5 }, previewScene);
  shieldMesh.position.set(-0.55, 0.9, 0);
  shieldMesh.parent = characterRoot;
  shieldMesh.material = makeEquipMat('mat_shield', previewScene);

  const ring1Mesh = MeshBuilder.CreateTorus('equip_ring1', { diameter: 0.12, thickness: 0.025, tessellation: 16 }, previewScene);
  ring1Mesh.position.set(0.18, 0.95, 0.3);
  ring1Mesh.parent = characterRoot;
  ring1Mesh.material = makeEquipMat('mat_ring1', previewScene);

  const ring2Mesh = MeshBuilder.CreateTorus('equip_ring2', { diameter: 0.12, thickness: 0.025, tessellation: 16 }, previewScene);
  ring2Mesh.position.set(-0.18, 0.95, 0.3);
  ring2Mesh.parent = characterRoot;
  ring2Mesh.material = makeEquipMat('mat_ring2', previewScene);

  const earring1Mesh = MeshBuilder.CreateTorus('equip_earring1', { diameter: 0.1, thickness: 0.02, tessellation: 12 }, previewScene);
  earring1Mesh.position.set(-0.28, 1.75, 0);
  earring1Mesh.parent = characterRoot;
  earring1Mesh.material = makeEquipMat('mat_earring1', previewScene);

  const earring2Mesh = MeshBuilder.CreateTorus('equip_earring2', { diameter: 0.1, thickness: 0.02, tessellation: 12 }, previewScene);
  earring2Mesh.position.set(0.28, 1.75, 0);
  earring2Mesh.parent = characterRoot;
  earring2Mesh.material = makeEquipMat('mat_earring2', previewScene);

  const necklaceMesh = MeshBuilder.CreateTorus('equip_necklace', { diameter: 0.35, thickness: 0.02, tessellation: 20 }, previewScene);
  necklaceMesh.position.y = 1.45;
  necklaceMesh.parent = characterRoot;
  necklaceMesh.material = makeEquipMat('mat_necklace', previewScene);

  const beltMesh = MeshBuilder.CreateTorus('equip_belt', { diameter: 0.48, thickness: 0.025, tessellation: 20 }, previewScene);
  beltMesh.position.y = 0.65;
  beltMesh.parent = characterRoot;
  beltMesh.material = makeEquipMat('mat_belt', previewScene);

  const ground = MeshBuilder.CreateGround('ground', { width: 2, height: 2 }, previewScene);
  const groundMat = new StandardMaterial('ground', previewScene);
  groundMat.diffuseColor = new Color3(0.1, 0.1, 0.15);
  groundMat.specularColor = Color3.Black();
  ground.material = groundMat;
}

const EQUIP_SLOT_MAT_MAP: Record<string, string> = {
  helmet: 'mat_helmet',
  armor: 'mat_armor',
  gloves: 'mat_gloves',
  legs: 'mat_legs',
  boots: 'mat_boots',
  weapon: 'mat_weapon',
  shield: 'mat_shield',
  earring_1: 'mat_earring1',
  earring_2: 'mat_earring2',
  necklace: 'mat_necklace',
  belt: 'mat_belt',
  ring_1: 'mat_ring1',
  ring_2: 'mat_ring2',
};

function updateEquipPreview(): void {
  if (!previewScene) return;

  for (const [slotKey, matName] of Object.entries(EQUIP_SLOT_MAT_MAP)) {
    const mat = previewScene.getMaterialByName(matName) as StandardMaterial;
    if (!mat) continue;

    const equipped = props.equipment[slotKey];
    if (equipped) {
      const itemDef = ITEM_DATABASE[equipped.itemId];
      const rarity = itemDef?.rarity || 'common';
      const color = RARITY_COLORS[rarity] || RARITY_COLORS.common;
      mat.diffuseColor = color;
      mat.emissiveColor = color.scale(0.2);
      mat.alpha = 0.85;
    } else {
      mat.diffuseColor = new Color3(0.3, 0.3, 0.4);
      mat.emissiveColor = Color3.Black();
      mat.alpha = 0.3;
    }
  }
}

function startRotationLoop(): void {
  function tick() {
    rotationAngle += 0.003;
    if (characterRoot) {
      characterRoot.rotation.y = rotationAngle;
    }
    if (previewScene && previewEngine) {
      previewScene.render();
    }
    animationFrameId = requestAnimationFrame(tick);
  }
  tick();
}

function disposePreview(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  characterRoot = null;
  previewScene?.dispose();
  previewEngine?.dispose();
  previewScene = null;
  previewEngine = null;
}

function handleItemClick(item: { itemId: string; quantity: number }) {
  const itemDef = ITEM_DATABASE[item.itemId];
  if (!itemDef) return;

  if (itemDef.equipmentSlot) {
    emit('equip-item', item.itemId);
  } else if (itemDef.type === 'consumable') {
    emit('use-item', item.itemId);
  }
}

function onItemDragStart(e: DragEvent, item: { itemId: string; quantity: number; slot: number; enhancementLevel?: number; enhancementElement?: string }) {
  e.dataTransfer?.setData('text/plain', JSON.stringify({ itemId: item.itemId, slot: item.slot, enhancementLevel: item.enhancementLevel, enhancementElement: item.enhancementElement }));
  e.dataTransfer!.effectAllowed = 'move';
}

function handleEquipClick(slot: string) {
  emit('unequip-item', slot);
}

const trashMenu = reactive({ visible: false, x: 0, y: 0, itemId: '', quantity: 0 });

function handleItemRightClick(e: MouseEvent, item: { itemId: string; quantity: number }) {
  trashMenu.visible = true;
  trashMenu.x = e.clientX;
  trashMenu.y = e.clientY;
  trashMenu.itemId = item.itemId;
  trashMenu.quantity = item.quantity;
}

function confirmTrash() {
  emit('drop-item', { itemId: trashMenu.itemId, quantity: 1 });
  trashMenu.visible = false;
}

function confirmTrashAll() {
  emit('drop-item', { itemId: trashMenu.itemId, quantity: trashMenu.quantity });
  trashMenu.visible = false;
}

function handleClickOutside(e: MouseEvent) {
  if (trashMenu.visible) {
    trashMenu.visible = false;
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
});

watch(() => props.equipment, () => {
  updateEquipPreview();
}, { deep: true });

watch(() => props.visible, async (v) => {
  await nextTick();
  if (v && !previewEngine && previewCanvas.value) {
    initPreview();
    updateEquipPreview();
  }
  if (!v) {
    disposePreview();
  }
});

watch(() => props.inventory.length, () => {
  const maxTab = Math.ceil(props.inventory.length / SLOTS_PER_TAB) || 1;
  if (activeTab.value > maxTab) activeTab.value = maxTab;
});

onMounted(() => {
  if (panelRef.value) attach(panelRef.value);
});

onUnmounted(() => {
  if (panelRef.value) detach(panelRef.value);
  disposePreview();
});
</script>

<style scoped>
.inventory-panel {
  position: absolute;
  width: 520px;
  background: rgba(10, 10, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: white;
  z-index: 50;
  user-select: none;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  flex: 1;
}

.inv-count {
  color: #888;
  font-size: 0.8rem;
  margin-right: 8px;
}

.drag-dots {
  cursor: grab;
  color: #666;
  font-size: 0.9rem;
  margin-right: 8px;
}

.drag-dots:active {
  cursor: grabbing;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 1.2rem;
  cursor: pointer;
}

.close-btn:hover {
  color: white;
}

.inventory-top {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  min-height: 290px;
}

.equip-left,
.equip-right {
  width: 140px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-section canvas {
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.3);
  display: block;
  width: 200px;
  height: 280px;
}

.equip-slot {
  height: 42px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.equip-slot:hover {
  background: rgba(255, 255, 255, 0.1);
}

.equip-slot.filled {
  border-color: rgba(102, 126, 234, 0.5);
  background: rgba(102, 126, 234, 0.1);
}

.equip-slot.filled.uncommon { border-color: rgba(30, 255, 0, 0.45); background: rgba(30, 255, 0, 0.06); }
.equip-slot.filled.rare { border-color: rgba(0, 112, 255, 0.5); background: rgba(0, 112, 255, 0.06); }
.equip-slot.filled.epic { border-color: rgba(163, 53, 238, 0.5); background: rgba(163, 53, 238, 0.06); }
.equip-slot.filled.legendary { border-color: rgba(255, 165, 0, 0.5); background: rgba(255, 165, 0, 0.06); }

.slot-icon {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: bold;
  color: #666;
  flex-shrink: 0;
}

.slot-item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.equip-slot.filled .slot-icon {
  color: #aab;
  background: rgba(102, 126, 234, 0.2);
  font-size: 0.7rem;
}

.equip-slot.filled.uncommon .slot-icon { background: rgba(30, 255, 0, 0.2); }
.equip-slot.filled.rare .slot-icon { background: rgba(0, 112, 255, 0.2); }
.equip-slot.filled.epic .slot-icon { background: rgba(163, 53, 238, 0.2); }
.equip-slot.filled.legendary .slot-icon { background: rgba(255, 165, 0, 0.2); }

.slot-label {
  color: #666;
  font-size: 0.6rem;
  width: 32px;
  flex-shrink: 0;
}

.inventory-bottom {
  padding: 8px 12px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.tab-bar {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
  align-items: center;
}

.slot-count {
  margin-left: auto;
  font-size: 0.65rem;
  color: #777;
  padding: 4px 6px;
}

.tab {
  padding: 4px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px 4px 0 0;
  font-size: 0.75rem;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ccc;
}

.tab.active {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.4);
  color: white;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 3px;
}

.item-slot {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  text-align: center;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
}

.item-slot:hover {
  background: rgba(255, 255, 255, 0.12);
}

.item-slot.empty {
  cursor: default;
  opacity: 0.3;
}

.item-slot.uncommon { border-color: rgba(30, 255, 0, 0.35); }
.item-slot.rare { border-color: rgba(0, 112, 255, 0.45); }
.item-slot.epic { border-color: rgba(163, 53, 238, 0.45); }
.item-slot.legendary { border-color: rgba(255, 165, 0, 0.45); }

.item-icon {
  font-size: 0.85rem;
  font-weight: bold;
  color: #999;
  line-height: 1;
}

.item-slot.uncommon .item-icon { color: #4caf50; }
.item-slot.rare .item-icon { color: #42a5f5; }
.item-slot.epic .item-icon { color: #ab47bc; }
.item-slot.legendary .item-icon { color: #ffa726; }

.item-qty {
  position: absolute;
  bottom: 1px;
  right: 3px;
  font-size: 0.5rem;
  color: #ddd;
  font-weight: bold;
  text-shadow: 1px 1px 2px #000;
}

.item-tooltip {
  position: absolute;
  background: rgba(8, 8, 20, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 10px;
  min-width: 160px;
  max-width: 220px;
  z-index: 200;
  pointer-events: none;
  font-size: 0.7rem;
  line-height: 1.4;
}

.tooltip-name {
  font-weight: bold;
  font-size: 0.8rem;
  margin-bottom: 2px;
}

.tooltip-name.common { color: #ccc; }
.tooltip-name.uncommon { color: #4caf50; }
.tooltip-name.rare { color: #42a5f5; }
.tooltip-name.epic { color: #ab47bc; }
.tooltip-name.legendary { color: #ffa726; }

.tooltip-type {
  color: #888;
  font-size: 0.65rem;
}

.tooltip-slot,
.tooltip-level {
  color: #aaa;
  font-size: 0.65rem;
}

.tooltip-enhance {
  color: #ffd700;
  font-size: 0.7rem;
  margin: 2px 0;
}

.tooltip-desc {
  color: #bbb;
  margin: 4px 0;
  font-style: italic;
}

.tooltip-stats {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 4px;
  padding-top: 4px;
}

.tooltip-stat {
  color: #66bb6a;
  font-size: 0.65rem;
}

.trash-context-menu {
  position: fixed;
  background: rgba(8, 8, 20, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  z-index: 200;
  min-width: 140px;
  padding: 2px 0;
}

.trash-option {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.75rem;
  color: #ccc;
}

.trash-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.trash-option.cancel {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 2px;
  padding-top: 6px;
  color: #888;
}
</style>
