<template>
  <div ref="panelRef" class="inventory-panel" v-show="visible" data-draggable :style="{ left: posX + 'px', top: posY + 'px' }">
    <div class="panel-header" data-drag-handle>
      <span class="drag-dots">&#8960;</span>
      <h3>Inventory</h3>
      <button class="close-btn" @click="$emit('close')">x</button>
    </div>

    <div class="inventory-content">
      <div class="preview-section">
        <canvas ref="previewCanvas" width="200" height="260"></canvas>
      </div>
      <div class="equipment-section">
        <h4>Equipment</h4>
        <div class="equipment-slots">
          <div
            v-for="slot in equipmentSlots"
            :key="slot.key"
            class="equip-slot"
            :class="{ filled: equipment[slot.key] }"
            @click="handleEquipClick(slot.key)"
          >
            <span class="slot-label">{{ slot.label }}</span>
            <span v-if="equipment[slot.key]" class="slot-item">{{ getItemName(equipment[slot.key]?.itemId) }}</span>
          </div>
        </div>
      </div>

      <div class="items-section">
        <h4>Items ({{ inventory.length }}/{{ maxSlots }})</h4>
        <div class="item-grid">
          <div
            v-for="item in inventory"
            :key="item.slot"
            class="item-slot"
            :class="getItemRarity(item.itemId)"
            @click="handleItemClick(item)"
          >
            <span class="item-name">{{ getItemName(item.itemId) }}</span>
            <span v-if="item.quantity > 1" class="item-qty">x{{ item.quantity }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { ITEM_DATABASE } from '@dust-saga/shared';
import { useDraggable } from '../composables/useDraggable';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight, MeshBuilder, StandardMaterial, Color3, Color4, Vector3, AbstractMesh } from '@babylonjs/core';

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-inventory', { x: 200, y: 100 });
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
  'use-item': [itemId: string];
  'equip-item': [itemId: string];
  'unequip-item': [slot: string];
}>();

const equipmentSlots = [
  { key: 'weapon', label: 'Weapon' },
  { key: 'helmet', label: 'Head' },
  { key: 'armor', label: 'Body' },
  { key: 'boots', label: 'Feet' },
  { key: 'accessory', label: 'Ring' }
];

let previewEngine: Engine | null = null;
let previewScene: Scene | null = null;
let characterParts: Record<string, AbstractMesh | null> = {
  helmet: null,
  armor: null,
  boots: null,
  weapon: null,
  accessory: null,
};
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

function getItemRarity(itemId: string): string {
  return ITEM_DATABASE[itemId]?.rarity || 'common';
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

  buildCharacterMeshes();
  startRotationLoop();
}

function buildCharacterMeshes(): void {
  if (!previewScene) return;

  const skinMat = new StandardMaterial('skin', previewScene);
  skinMat.diffuseColor = new Color3(0.85, 0.7, 0.55);

  const defaultMat = new StandardMaterial('default', previewScene);
  defaultMat.diffuseColor = new Color3(0.3, 0.3, 0.4);

  const head = MeshBuilder.CreateSphere('head', { diameter: 0.5, segments: 8 }, previewScene);
  head.position.y = 1.7;
  head.material = skinMat;

  const body = MeshBuilder.CreateCylinder('body', { height: 0.9, diameterTop: 0.45, diameterBottom: 0.4, tessellation: 8 }, previewScene);
  body.position.y = 1.05;
  body.material = defaultMat;

  const leftArm = MeshBuilder.CreateCylinder('leftArm', { height: 0.7, diameter: 0.12, tessellation: 8 }, previewScene);
  leftArm.position.set(-0.35, 1.1, 0);
  leftArm.rotation.z = 0.2;
  leftArm.material = skinMat;

  const rightArm = MeshBuilder.CreateCylinder('rightArm', { height: 0.7, diameter: 0.12, tessellation: 8 }, previewScene);
  rightArm.position.set(0.35, 1.1, 0);
  rightArm.rotation.z = -0.2;
  rightArm.material = skinMat;

  const leftLeg = MeshBuilder.CreateCylinder('leftLeg', { height: 0.7, diameter: 0.14, tessellation: 8 }, previewScene);
  leftLeg.position.set(-0.15, 0.35, 0);
  leftLeg.material = skinMat;

  const rightLeg = MeshBuilder.CreateCylinder('rightLeg', { height: 0.7, diameter: 0.14, tessellation: 8 }, previewScene);
  rightLeg.position.set(0.15, 0.35, 0);
  rightLeg.material = skinMat;

  const helmetMesh = MeshBuilder.CreateSphere('equip_helmet', { diameter: 0.55, segments: 8 }, previewScene);
  helmetMesh.position.y = 1.75;
  helmetMesh.scaling.y = 0.6;
  const helmetMat = new StandardMaterial('helmet_default', previewScene);
  helmetMat.diffuseColor = new Color3(0.3, 0.3, 0.4);
  helmetMat.alpha = 0.3;
  helmetMesh.material = helmetMat;
  characterParts.helmet = helmetMesh;

  const armorMesh = MeshBuilder.CreateCylinder('equip_armor', { height: 0.95, diameterTop: 0.5, diameterBottom: 0.45, tessellation: 8 }, previewScene);
  armorMesh.position.y = 1.05;
  const armorMat = new StandardMaterial('armor_default', previewScene);
  armorMat.diffuseColor = new Color3(0.3, 0.3, 0.4);
  armorMat.alpha = 0.3;
  armorMesh.material = armorMat;
  characterParts.armor = armorMesh;

  const bootsMesh = MeshBuilder.CreateBox('equip_boots', { width: 0.5, height: 0.25, depth: 0.3 }, previewScene);
  bootsMesh.position.y = 0.12;
  const bootsMat = new StandardMaterial('boots_default', previewScene);
  bootsMat.diffuseColor = new Color3(0.3, 0.3, 0.4);
  bootsMat.alpha = 0.3;
  bootsMesh.material = bootsMat;
  characterParts.boots = bootsMesh;

  const weaponMesh = MeshBuilder.CreateBox('equip_weapon', { width: 0.08, height: 1.2, depth: 0.08 }, previewScene);
  weaponMesh.position.set(0.55, 0.8, 0);
  weaponMesh.rotation.z = -0.3;
  const weaponMat = new StandardMaterial('weapon_default', previewScene);
  weaponMat.diffuseColor = new Color3(0.3, 0.3, 0.4);
  weaponMat.alpha = 0.3;
  weaponMesh.material = weaponMat;
  characterParts.weapon = weaponMesh;

  const ringMesh = MeshBuilder.CreateTorus('equip_ring', { diameter: 0.15, thickness: 0.03, tessellation: 16 }, previewScene);
  ringMesh.position.set(0.15, 0.8, 0.3);
  const ringMat = new StandardMaterial('ring_default', previewScene);
  ringMat.diffuseColor = new Color3(0.3, 0.3, 0.4);
  ringMat.alpha = 0.3;
  ringMat.emissiveColor = new Color3(0.1, 0.1, 0.15);
  ringMesh.material = ringMat;
  characterParts.accessory = ringMesh;

  const ground = MeshBuilder.CreateGround('ground', { width: 2, height: 2 }, previewScene);
  const groundMat = new StandardMaterial('ground', previewScene);
  groundMat.diffuseColor = new Color3(0.1, 0.1, 0.15);
  groundMat.specularColor = Color3.Black();
  ground.material = groundMat;
}

function updateEquipPreview(): void {
  if (!previewScene) return;

  const slotMeshMap: Record<string, string> = {
    helmet: 'equip_helmet',
    armor: 'equip_armor',
    boots: 'equip_boots',
    weapon: 'equip_weapon',
    accessory: 'equip_ring',
  };

  const slotMatMap: Record<string, string> = {
    helmet: 'helmet_default',
    armor: 'armor_default',
    boots: 'boots_default',
    weapon: 'weapon_default',
    accessory: 'ring_default',
  };

  for (const [slotKey, meshName] of Object.entries(slotMeshMap)) {
    const mesh = previewScene.getMeshByName(meshName);
    const mat = previewScene.getMaterialByName(slotMatMap[slotKey]) as StandardMaterial;
    if (!mesh || !mat) continue;

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
    if (previewScene) {
      const root = previewScene.getMeshByName('head');
      if (root) {
        root.parent!.rotation.y = rotationAngle;
      }
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
  characterParts = { helmet: null, armor: null, boots: null, weapon: null, accessory: null };
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

function handleEquipClick(slot: string) {
  emit('unequip-item', slot);
}

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
  width: 460px;
  background: rgba(10, 10, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: white;
  z-index: 50;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  flex: 1;
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

.inventory-content {
  padding: 12px 16px;
  display: flex;
  gap: 12px;
}

.preview-section {
  flex-shrink: 0;
}

.preview-section canvas {
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  display: block;
  width: 200px;
  height: 260px;
}

.equipment-section {
  flex: 1;
  min-width: 0;
}

.equipment-section h4,
.items-section h4 {
  margin: 0 0 8px;
  font-size: 0.85rem;
  color: #888;
}

.items-section {
  flex: 1;
  min-width: 0;
}

.equipment-slots {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.equip-slot {
  width: 100%;
  height: 36px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  cursor: pointer;
  font-size: 0.7rem;
}

.equip-slot.filled {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.15);
}

.slot-label {
  color: #666;
  font-size: 0.65rem;
  width: 40px;
  flex-shrink: 0;
}

.slot-item {
  color: #ddd;
  font-size: 0.65rem;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.item-slot {
  padding: 6px 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  font-size: 0.7rem;
  position: relative;
  min-height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.item-slot:hover {
  background: rgba(255, 255, 255, 0.15);
}

.item-slot.uncommon {
  border-color: rgba(30, 255, 0, 0.4);
}

.item-slot.rare {
  border-color: rgba(0, 112, 255, 0.5);
}

.item-slot.epic {
  border-color: rgba(163, 53, 238, 0.5);
}

.item-slot.legendary {
  border-color: rgba(255, 165, 0, 0.5);
}

.item-name {
  font-size: 0.6rem;
  color: #ddd;
  line-height: 1.2;
}

.item-qty {
  font-size: 0.6rem;
  color: #aaa;
}
</style>
