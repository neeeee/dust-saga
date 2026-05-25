import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3 as V3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  AbstractMesh,
  ShadowGenerator,
  FloatArray,
  Scene as SceneType,
  AnimationGroup,
  Mesh,
} from '@babylonjs/core';
import { RecastJSPlugin } from '@babylonjs/core/Navigation/Plugins/recastJSPlugin';
import { INavMeshParameters } from '@babylonjs/core/Navigation/INavigationEngine';
import { AssetManager } from './AssetManager';
import { MapBuilder, MapData } from './MapBuilder';
import { ZoneDefinition } from '@dust-saga/shared';

export interface EntityMeshGroup {
  root: AbstractMesh;
  healthBarBg?: AbstractMesh;
  healthBarFg?: AbstractMesh;
  namePlate?: AbstractMesh;
  selectionCircle?: AbstractMesh;
}

export class GameEngine {
  private canvas: HTMLCanvasElement | null;
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: ArcRotateCamera | null = null;
  private shadowGenerator: ShadowGenerator | null = null;
  private meshes: Map<string, EntityMeshGroup> = new Map();
  private entityAnimations: Map<string, AnimationGroup[]> = new Map();
  private currentAnimation: Map<string, string> = new Map();
  private assetManager: AssetManager | null = null;
  private mapBuilder: MapBuilder | null = null;
  private playerMesh: AbstractMesh | null = null;
  private onClickCallbacks: Array<(entityId: string) => void> = [];
  private minimapCanvas: HTMLCanvasElement | null = null;
  private currentZoneDef: ZoneDefinition | null = null;
  private targetedEntityId: string | null = null;
  private aoeTargetCircle: AbstractMesh | null = null;
  private aoeIndicatorMat: StandardMaterial | null = null;
  private aoeValid: boolean = true;
  private aoeTargetingActive: boolean = false;
  private isRotating: boolean = false;
  private aoeZoneMeshes: Map<string, { disc: AbstractMesh; material: StandardMaterial; expiresAt: number }> = new Map();
  private navigationPlugin: RecastJSPlugin | null = null;
  private navMeshReady: boolean = false;
  private moveIndicator: AbstractMesh | null = null;
  private moveIndicatorMat: StandardMaterial | null = null;
  private moveIndicatorCallback: ((worldPos: V3) => void) | null = null;

  constructor(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
  }

  async initialize(): Promise<void> {
    if (!this.canvas) return;

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.5, 0.7, 1.0, 1);
    this.scene.ambientColor = new Color3(0.3, 0.3, 0.3);

    this.scene.fogMode = SceneType.FOGMODE_EXP;
    this.scene.fogDensity = 0.003;
    this.scene.fogColor = new Color3(0.7, 0.85, 0.95);

    this.assetManager = new AssetManager(this.scene);
    this.mapBuilder = new MapBuilder(this.scene, this.assetManager);

    this.camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3.5,
      12,
      V3.Zero(),
      this.scene
    );
    this.camera.attachControl(this.canvas, true);
    (this.camera.inputs.attached.pointers as any).buttons = [];
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 40;
    this.camera.lowerBetaLimit = 0.3;
    this.camera.upperBetaLimit = Math.PI / 2.2;
    this.camera.wheelPrecision = 30;
    this.camera.panningSensibility = 0;
    this.camera.inertia = 0.5;

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointermove', this.handlePointerMoveForCamera);

    const hemiLight = new HemisphericLight('hemiLight', new V3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.6;
    hemiLight.groundColor = new Color3(0.3, 0.3, 0.3);

    const dirLight = new DirectionalLight('dirLight', new V3(-1, -2, -1), this.scene);
    dirLight.intensity = 0.8;
    dirLight.position = new V3(50, 100, 50);

    this.shadowGenerator = new ShadowGenerator(1024, dirLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    this.scene.onPointerDown = (evt, pickResult) => {
      if (this.aoeTargetingActive) return;
      if (evt.button === 0 && pickResult?.hit && pickResult.pickedMesh) {
        let clickedEntity = false;
        for (const [id, group] of this.meshes) {
          if (pickResult.pickedMesh === group.root || group.root.getChildMeshes().includes(pickResult.pickedMesh)) {
            this.onClickCallbacks.forEach(cb => cb(id));
            clickedEntity = true;
            break;
          }
        }
        if (!clickedEntity && pickResult.pickedPoint) {
          const normal = pickResult.getNormal(true);
          if (!normal || Math.abs(normal.y) >= 0.85) {
            this.moveIndicatorCallback?.(V3.FromArray([pickResult.pickedPoint.x, pickResult.pickedPoint.y, pickResult.pickedPoint.z]));
          }
        }
      }
    };

    this.engine.runRenderLoop(() => {
      if (this.scene) {
        this.updateAOEZoneMeshes(Date.now());
        this.scene.render();
      }
    });

    window.addEventListener('resize', () => {
      this.engine?.resize();
    });
  }

  async loadZone(zoneDef: ZoneDefinition): Promise<void> {
    if (!this.scene || !this.mapBuilder) return;

    this.meshes.forEach(group => {
      group.root.dispose();
      group.healthBarBg?.dispose();
      group.healthBarFg?.dispose();
      group.namePlate?.dispose();
      group.selectionCircle?.dispose();
    });
    this.meshes.clear();
    this.entityAnimations.clear();
    this.currentAnimation.clear();
    this.targetedEntityId = null;
    this.mapBuilder.clear();
    this.navigationPlugin = null;
    this.navMeshReady = false;
    this.hideMoveIndicator();

    try {
      const resp = await fetch(`/maps/${zoneDef.id}.json`);
      if (resp.ok) {
        const mapData: MapData = await resp.json();
        await this.mapBuilder.build(mapData);
        if (this.minimapCanvas) {
          this.renderMinimap(zoneDef);
        }
        await this.buildNavMesh();
        return;
      }
    } catch (e) {
      console.warn(`Failed to load map JSON for ${zoneDef.id}, using fallback:`, e);
    }

    this.scene.clearColor = new Color4(zoneDef.fogColor.r, zoneDef.fogColor.g, zoneDef.fogColor.b, 1);
    this.scene.fogColor = new Color3(zoneDef.fogColor.r, zoneDef.fogColor.g, zoneDef.fogColor.b);
    this.scene.fogDensity = zoneDef.fogDensity;

    const ground = this.createGround(zoneDef);
    if (ground && this.shadowGenerator) {
      ground.receiveShadows = true;
    }

    await this.createEnvironmentObjects(zoneDef);

    await this.buildNavMesh();

    if (this.minimapCanvas) {
      this.renderMinimap(zoneDef);
    }
  }

  private createGround(zoneDef: ZoneDefinition): AbstractMesh {
    const ground = MeshBuilder.CreateGround('zone_ground', {
      width: zoneDef.size,
      height: zoneDef.size,
      subdivisions: 32
    }, this.scene!);

    const groundMat = new StandardMaterial('zone_ground_mat', this.scene!);
    groundMat.diffuseColor = new Color3(zoneDef.groundColor.r, zoneDef.groundColor.g, zoneDef.groundColor.b);
    groundMat.specularColor = new Color3(0.05, 0.05, 0.05);
    ground.material = groundMat;

    this.applyGroundVariation(ground, zoneDef);

    return ground;
  }

  private applyGroundVariation(ground: AbstractMesh, _zoneDef: ZoneDefinition): void {
    if (!this.scene) return;
    const positions = ground.getVerticesData('position');
    if (!positions) return;

    const newPositions = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      newPositions[i] = positions[i];
      newPositions[i + 1] = positions[i + 1] + (Math.random() - 0.5) * 0.15;
      newPositions[i + 2] = positions[i + 2];
    }

    ground.updateVerticesData('position', newPositions as FloatArray);
    ground.createNormals(true);

    ground.receiveShadows = true;
  }

  private async createEnvironmentObjects(zoneDef: ZoneDefinition): Promise<void> {
    if (!this.scene || !this.assetManager) return;

    for (const objGroup of zoneDef.environmentObjects) {
      for (const pos of objGroup.positions) {
        const position = new V3(pos.x, pos.y, pos.z);
        const scale = pos.scale || 1;

        if (objGroup.type === 'tree') {
          await this.createTree(position, scale);
        } else if (objGroup.type === 'rock') {
          await this.createRock(position, scale);
        }
      }
    }
  }

  private async createTree(position: V3, scale: number): Promise<void> {
    if (!this.assetManager) return;

    const result = await this.assetManager.instantiateModel('Pine.glb', position);
    if (result) {
      result.root.scaling = new V3(scale, scale, scale);
      result.root.name = `env_tree_${position.x}_${position.z}`;
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(result.root);
      }
    } else {
      this.createFallbackTree(position, scale);
    }
  }

  private createFallbackTree(position: V3, scale: number): void {
    if (!this.scene) return;

    const trunk = MeshBuilder.CreateCylinder(`env_tree_trunk_${Date.now()}`, {
      height: 3 * scale,
      diameter: 0.4 * scale
    }, this.scene);
    trunk.position = position;
    trunk.position.y += 1.5 * scale;

    const trunkMat = new StandardMaterial(`env_trunk_mat_${Date.now()}`, this.scene);
    trunkMat.diffuseColor = new Color3(0.4, 0.25, 0.15);
    trunk.material = trunkMat;

    const leaves = MeshBuilder.CreateCylinder(`env_tree_leaves_${Date.now()}`, {
      height: 4 * scale,
      diameterTop: 0,
      diameterBottom: 2.5 * scale,
      tessellation: 6
    }, this.scene);
    leaves.position = position.add(new V3(0, 4 * scale, 0));

    const leavesMat = new StandardMaterial(`env_leaves_mat_${Date.now()}`, this.scene);
    leavesMat.diffuseColor = new Color3(0.15 + Math.random() * 0.15, 0.5 + Math.random() * 0.2, 0.15);
    leaves.material = leavesMat;

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(trunk);
      this.shadowGenerator.addShadowCaster(leaves);
    }
  }

  private async createRock(position: V3, scale: number): Promise<void> {
    if (!this.assetManager) return;

    const result = await this.assetManager.instantiateModel('Rock Medium.glb', position);
    if (result) {
      result.root.scaling = new V3(scale, scale, scale);
      result.root.name = `env_rock_${position.x}_${position.z}`;
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(result.root);
      }
    } else {
      this.createFallbackRock(position, scale);
    }
  }

  private createFallbackRock(position: V3, scale: number): void {
    if (!this.scene) return;

    const rock = MeshBuilder.CreateBox(`env_rock_${Date.now()}`, {
      width: (0.8 + Math.random() * 0.6) * scale,
      height: (0.4 + Math.random() * 0.3) * scale,
      depth: (0.8 + Math.random() * 0.6) * scale
    }, this.scene);
    rock.position = position.add(new V3(0, 0.25 * scale, 0));
    rock.rotation.y = Math.random() * Math.PI * 2;

    const rockMat = new StandardMaterial(`env_rock_mat_${Date.now()}`, this.scene);
    rockMat.diffuseColor = new Color3(
      0.4 + Math.random() * 0.2,
      0.4 + Math.random() * 0.2,
      0.4 + Math.random() * 0.2
    );
    rock.material = rockMat;

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(rock);
    }
  }

  async createPlayerEntity(entityId: string, position: V3, modelFile: string, name?: string): Promise<AbstractMesh | null> {
    if (!this.scene || !this.assetManager) return null;

    let mesh: AbstractMesh | null = null;

    if (modelFile) {
      const result = await this.assetManager.instantiateModel(modelFile, position);
      if (result) {
        mesh = result.root;
        mesh.rotationQuaternion = null;
        this.entityAnimations.set(entityId, result.animations);
        this.startAnimation(entityId, 'Idle');
      }
    }

    if (!mesh) {
      mesh = this.createFallbackCharacter(entityId, position, new Color3(0.2, 0.4, 0.8));
    }

    if (mesh) {
      mesh.name = `player_${entityId}`;
      mesh.scaling = new V3(0.7, 0.7, 0.7);
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(mesh);
      }
    }

    const group: EntityMeshGroup = { root: mesh };

    if (name) {
      const namePlate = this.assetManager.createNamePlate(name, entityId);
      namePlate.position = position.add(new V3(0, 2.8, 0));
      group.namePlate = namePlate;
    }

    this.meshes.set(entityId, group);

    return mesh;
  }

  async createEnemyEntity(
    entityId: string,
    position: V3,
    modelFile: string,
    health: number,
    maxHealth: number,
    name: string
  ): Promise<AbstractMesh | null> {
    if (!this.scene || !this.assetManager) return null;

    let mesh: AbstractMesh | null = null;

    if (modelFile) {
      const result = await this.assetManager.instantiateModel(modelFile, position);
      if (result) {
        mesh = result.root;
        mesh.rotationQuaternion = null;
        this.entityAnimations.set(entityId, result.animations);
        this.startAnimation(entityId, 'Idle');
      }
    }

    if (!mesh) {
      mesh = this.createFallbackCharacter(entityId, position, new Color3(0.8, 0.2, 0.2));
    }

    if (mesh) {
      mesh.name = `enemy_${entityId}`;
      mesh.scaling = new V3(0.6, 0.6, 0.6);
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(mesh);
      }
    }

    const hpBar = this.assetManager.createHealthBar(entityId);
    hpBar.background.position = position.add(new V3(0, 2.5, 0));
    hpBar.foreground.parent = hpBar.background;
    hpBar.foreground.position = new V3(0, 0, -0.01);

    const namePlate = this.assetManager.createNamePlate(name, entityId);
    namePlate.position = position.add(new V3(0, 3, 0));

    const group: EntityMeshGroup = {
      root: mesh,
      healthBarBg: hpBar.background,
      healthBarFg: hpBar.foreground,
      namePlate
    };
    this.meshes.set(entityId, group);

    this.updateEntityHealth(entityId, health, maxHealth);

    return mesh;
  }

  async createNPCEntity(
    entityId: string,
    position: V3,
    modelFile: string,
    name: string
  ): Promise<AbstractMesh | null> {
    if (!this.scene || !this.assetManager) return null;

    let mesh: AbstractMesh | null = null;

    if (modelFile) {
      const result = await this.assetManager.instantiateModel(modelFile, position);
      if (result) {
        mesh = result.root;
        mesh.rotationQuaternion = null;
        this.entityAnimations.set(entityId, result.animations);
        this.startAnimation(entityId, 'Idle');
      }
    }

    if (!mesh) {
      mesh = this.createFallbackCharacter(entityId, position, new Color3(0.2, 0.8, 0.2));
    }

    if (mesh) {
      mesh.name = `npc_${entityId}`;
      mesh.scaling = new V3(0.7, 0.7, 0.7);
    }

    const namePlate = this.assetManager.createNamePlate(name, entityId);
    namePlate.position = position.add(new V3(0, 2.8, 0));

    const indicator = MeshBuilder.CreatePlane(`npc_indicator_${entityId}`, { width: 0.3, height: 0.3 }, this.scene);
    const indMat = new StandardMaterial(`npc_ind_mat_${entityId}`, this.scene);
    indMat.diffuseColor = new Color3(1, 1, 0);
    indMat.emissiveColor = new Color3(0.8, 0.8, 0);
    indMat.disableLighting = true;
    indMat.backFaceCulling = false;
    indicator.material = indMat;
    indicator.position = position.add(new V3(0, 3.2, 0));
    indicator.billboardMode = 7;

    const group: EntityMeshGroup = {
      root: mesh,
      namePlate
    };
    this.meshes.set(entityId, group);

    return mesh;
  }

  private createFallbackCharacter(entityId: string, position: V3, color: Color3): AbstractMesh {
    const body = MeshBuilder.CreateCapsule(`fallback_${entityId}`, {
      height: 1.8,
      radius: 0.35
    }, this.scene!);
    body.position = position;
    body.position.y += 0.9;

    const mat = new StandardMaterial(`fallback_mat_${entityId}`, this.scene!);
    mat.diffuseColor = color;
    body.material = mat;

    return body;
  }

  setPlayerMesh(entityId: string): void {
    const group = this.meshes.get(entityId);
    if (group) {
      this.playerMesh = group.root;
    }
  }

  getPlayerMesh(): AbstractMesh | null {
    return this.playerMesh;
  }

  updateEntityPosition(entityId: string, position: V3): void {
    const group = this.meshes.get(entityId);
    if (group?.root) {
      group.root.position = position;

      if (group.healthBarBg) {
        group.healthBarBg.position = position.add(new V3(0, 2.5, 0));
      }
      if (group.namePlate) {
        const hpOffset = group.healthBarBg ? 3 : 2.8;
        group.namePlate.position = position.add(new V3(0, hpOffset, 0));
      }
      if (group.selectionCircle) {
        group.selectionCircle.position.x = position.x;
        group.selectionCircle.position.y = 0.05;
        group.selectionCircle.position.z = position.z;
      }
    }
  }

  updateEntityRotation(entityId: string, rotation: number): void {
    const group = this.meshes.get(entityId);
    if (group?.root) {
      group.root.rotation.y = rotation;
    }
  }

  updateEntityHealth(entityId: string, current: number, max: number): void {
    const group = this.meshes.get(entityId);
    if (!group || !this.assetManager || !group.healthBarBg || !group.healthBarFg) return;

    this.assetManager.updateHealthBar(entityId, current, max, group.healthBarBg, group.healthBarFg);
  }

  showDamageNumber(entityId: string, damage: number, isCritical: boolean, element?: string, miss?: boolean): void {
    const group = this.meshes.get(entityId);
    if (!group?.root || !this.assetManager) return;

    this.assetManager.createDamageNumber(damage, group.root.position, isCritical, element, miss);
  }

  createLootBeacon(position: V3): void {
    if (!this.assetManager) return;
    this.assetManager.createLootBeacon(position);
  }

  removeEntity(entityId: string): void {
    const group = this.meshes.get(entityId);
    if (group) {
      group.root.dispose();
      group.healthBarBg?.dispose();
      group.healthBarFg?.dispose();
      group.namePlate?.dispose();
      group.selectionCircle?.dispose();
      this.meshes.delete(entityId);
    }
    if (this.targetedEntityId === entityId) {
      this.targetedEntityId = null;
    }
    this.entityAnimations.delete(entityId);
  }

  focusCameraOnEntity(entityId: string): void {
    const group = this.meshes.get(entityId);
    if (group?.root && this.camera) {
      this.camera.target = group.root.position;
    }
  }

  attachCameraToEntity(entityId: string): void {
    const group = this.meshes.get(entityId);
    if (group?.root && this.camera) {
      this.camera.lockedTarget = group.root;
    }
  }

  setTargetIndicator(entityId: string | null): void {
    if (!this.scene) return;

    if (this.targetedEntityId) {
      const oldGroup = this.meshes.get(this.targetedEntityId);
      if (oldGroup?.selectionCircle) {
        oldGroup.selectionCircle.dispose();
        oldGroup.selectionCircle = undefined;
      }
    }

    this.targetedEntityId = entityId;

    if (!entityId) return;

    const group = this.meshes.get(entityId);
    if (!group?.root) return;

    const circle = MeshBuilder.CreateDisc(`target_circle_${entityId}`, {
      radius: 0.9,
      tessellation: 32
    }, this.scene);
    const circleMat = new StandardMaterial(`target_circle_mat_${entityId}`, this.scene);
    circleMat.diffuseColor = new Color3(0.2, 0.6, 1.0);
    circleMat.emissiveColor = new Color3(0.15, 0.4, 0.9);
    circleMat.disableLighting = true;
    circleMat.alpha = 0.5;
    circleMat.backFaceCulling = false;
    circle.material = circleMat;
    circle.rotation.x = Math.PI / 2;
    circle.position = group.root.position.clone();
    circle.position.y = 0.05;

    group.selectionCircle = circle;
  }

  onClickEntity(callback: (entityId: string) => void): void {
    this.onClickCallbacks.push(callback);
  }

  setMinimapCanvas(canvas: HTMLCanvasElement): void {
    this.minimapCanvas = canvas;
  }

  private renderMinimap(zoneDef: ZoneDefinition): void {
    if (!this.minimapCanvas) return;
    this.currentZoneDef = zoneDef;
    this.drawMinimapBackground();
  }

  private drawMinimapBackground(): void {
    if (!this.minimapCanvas || !this.currentZoneDef) return;
    const ctx = this.minimapCanvas.getContext('2d');
    if (!ctx) return;

    const size = this.minimapCanvas.width;
    const gc = this.currentZoneDef.groundColor;

    ctx.fillStyle = `rgb(${Math.floor(gc.r * 255)}, ${Math.floor(gc.g * 255)}, ${Math.floor(gc.b * 255)})`;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);
  }

  updateMinimapPlayerDot(x: number, z: number, zoneSize: number): void {
    if (!this.minimapCanvas) return;
    const ctx = this.minimapCanvas.getContext('2d');
    if (!ctx) return;

    this.drawMinimapBackground();

    const size = this.minimapCanvas.width;
    const scale = size / zoneSize;

    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(
      size / 2 + x * scale,
      size / 2 + z * scale,
      4,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  getScene(): Scene | null {
    return this.scene;
  }

  getScreenPosition(worldPos: V3): { x: number; y: number } | null {
    if (!this.scene || !this.camera || !this.engine) return null;

    const viewportWidth = this.engine.getRenderWidth();
    const viewportHeight = this.engine.getRenderHeight();

    const projected = V3.Project(
      worldPos,
      this.camera.getViewMatrix(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(viewportWidth, viewportHeight)
    );

    if (projected.z < 0 || projected.z > 1) return null;

    const canvasRect = this.canvas?.getBoundingClientRect();
    if (!canvasRect) return null;

    return {
      x: canvasRect.left + projected.x,
      y: canvasRect.top + projected.y
    };
  }

  getEngine(): Engine | null {
    return this.engine;
  }

  getAssetManager(): AssetManager | null {
    return this.assetManager;
  }

  getMeshGroup(entityId: string): EntityMeshGroup | undefined {
    return this.meshes.get(entityId);
  }

  getMapBuilder(): MapBuilder | null {
    return this.mapBuilder;
  }

  startAnimation(entityId: string, name: string): void {
    const anims = this.entityAnimations.get(entityId);
    if (!anims) return;
    if (this.currentAnimation.get(entityId) === name) return;
    this.currentAnimation.set(entityId, name);
    anims.forEach(ag => ag.stop());

    const meshGroup = this.meshes.get(entityId);
    if (meshGroup?.root) {
      const skeleton = meshGroup.root.skeleton || meshGroup.root.getChildMeshes().find(m => m.skeleton)?.skeleton;
      if (skeleton) {
        skeleton.returnToRest();
      }
    }

    const target = anims.find(ag => ag.name.toLowerCase().includes(name.toLowerCase()));
    if (target) {
      target.goToFrame(target.from);
      target.start(true, 1.0, target.from, target.to);
    }
  }

  startAnimationOnce(entityId: string, name: string, onComplete?: () => void): void {
    const anims = this.entityAnimations.get(entityId);
    if (!anims) return;
    this.currentAnimation.set(entityId, name);
    anims.forEach(ag => ag.stop());

    const meshGroup = this.meshes.get(entityId);
    if (meshGroup?.root) {
      const skeleton = meshGroup.root.skeleton || meshGroup.root.getChildMeshes().find(m => m.skeleton)?.skeleton;
      if (skeleton) {
        skeleton.returnToRest();
      }
    }

    const target = anims.find(ag => ag.name.toLowerCase().includes(name.toLowerCase()));
    if (target) {
      target.goToFrame(target.from);
      target.start(false, 1.0, target.from, target.to);
      if (onComplete) {
        target.onAnimationGroupEndObservable.addOnce(() => onComplete());
      }
    }
  }

  showAOETargetCircle(radius: number): void {
    if (!this.scene) return;
    this.hideAOETargetCircle();
    this.aoeTargetingActive = true;

    const circle = MeshBuilder.CreateDisc('aoe_target_circle', {
      radius,
      tessellation: 64,
    }, this.scene);

    const mat = new StandardMaterial('aoe_target_mat', this.scene);
    mat.diffuseColor = new Color3(1.0, 0.3, 0.3);
    mat.emissiveColor = new Color3(0.6, 0.15, 0.15);
    mat.disableLighting = true;
    mat.alpha = 0.4;
    mat.backFaceCulling = false;
    circle.material = mat;
    circle.rotation.x = Math.PI / 2;
    circle.position.y = 0.1;
    circle.isPickable = false;

    this.aoeTargetCircle = circle;
    this.aoeIndicatorMat = mat;
    this.aoeValid = true;
  }

  hideAOETargetCircle(): void {
    this.aoeTargetingActive = false;
    if (this.aoeTargetCircle) {
      this.aoeTargetCircle.dispose();
      this.aoeTargetCircle = null;
    }
    if (this.aoeIndicatorMat) {
      this.aoeIndicatorMat.dispose();
      this.aoeIndicatorMat = null;
    }
  }

  updateAOETargetCircle(screenX: number, screenY: number): { position: { x: number; y: number; z: number }; valid: boolean } | null {
    if (!this.scene || !this.aoeTargetCircle || !this.camera) return null;

    const pickResult = this.scene.pick(screenX, screenY, (mesh) => {
      if (mesh === this.aoeTargetCircle) return false;
      if (mesh.isPickable === false) return false;
      const n = mesh.name;
      return n.startsWith('map_ground') || n.startsWith('zone_ground')
        || n.startsWith('map_struct_') || n.startsWith('map_pillar_')
        || n.startsWith('map_rock_') || n.startsWith('platform_')
        || n.startsWith('heightmap_');
    });

    if (!pickResult || !pickResult.hit || !pickResult.pickedPoint) {
      this.aoeValid = false;
      if (this.aoeIndicatorMat) {
        this.aoeIndicatorMat.diffuseColor = new Color3(0.5, 0.5, 0.5);
        this.aoeIndicatorMat.emissiveColor = new Color3(0.2, 0.2, 0.2);
        this.aoeIndicatorMat.alpha = 0.2;
      }
      return null;
    }

    const normal = pickResult.getNormal(true);
    const flatThreshold = 0.85;
    const isValid = !normal || Math.abs(normal.y) >= flatThreshold;

    this.aoeValid = isValid;
    this.aoeTargetCircle.position.x = pickResult.pickedPoint.x;
    this.aoeTargetCircle.position.z = pickResult.pickedPoint.z;
    this.aoeTargetCircle.position.y = pickResult.pickedPoint.y + 0.1;

    if (normal && Math.abs(normal.y) < 1.0) {
      this.aoeTargetCircle.rotation.x = Math.PI / 2;
      this.aoeTargetCircle.rotation.z = 0;
    }

    if (this.aoeIndicatorMat) {
      if (isValid) {
        this.aoeIndicatorMat.diffuseColor = new Color3(0.2, 0.8, 0.2);
        this.aoeIndicatorMat.emissiveColor = new Color3(0.1, 0.5, 0.1);
        this.aoeIndicatorMat.alpha = 0.45;
      } else {
        this.aoeIndicatorMat.diffuseColor = new Color3(0.8, 0.2, 0.2);
        this.aoeIndicatorMat.emissiveColor = new Color3(0.5, 0.1, 0.1);
        this.aoeIndicatorMat.alpha = 0.35;
      }
    }

    return {
      position: {
        x: pickResult.pickedPoint.x,
        y: pickResult.pickedPoint.y,
        z: pickResult.pickedPoint.z,
      },
      valid: isValid,
    };
  }

  isAOETargetValid(): boolean {
    return this.aoeValid;
  }

  isAOETargeting(): boolean {
    return this.aoeTargetCircle !== null;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (e.button === 2 && this.camera && !this.isRotating) {
      this.isRotating = true;
      this.canvas?.requestPointerLock();
    }
  };

  private handlePointerUp = (_e: PointerEvent): void => {
    if (this.isRotating) {
      this.isRotating = false;
      document.exitPointerLock();
    }
  };

  private handlePointerMoveForCamera = (e: PointerEvent): void => {
    if (!this.isRotating || !this.camera) return;
    this.camera.alpha -= e.movementX * 0.003;
  };

  private getAOEZoneColor(skillName: string): { diffuse: Color3; emissive: Color3 } {
    const name = skillName.toLowerCase();
    if (name.includes('fire') || name.includes('meteor')) return { diffuse: new Color3(1.0, 0.4, 0.1), emissive: new Color3(0.8, 0.2, 0.0) };
    if (name.includes('ice') || name.includes('frost') || name.includes('blizzard')) return { diffuse: new Color3(0.3, 0.6, 1.0), emissive: new Color3(0.1, 0.3, 0.8) };
    if (name.includes('thunder') || name.includes('lightning') || name.includes('storm')) return { diffuse: new Color3(0.9, 0.9, 0.3), emissive: new Color3(0.6, 0.6, 0.1) };
    if (name.includes('holy')) return { diffuse: new Color3(1.0, 1.0, 0.8), emissive: new Color3(0.7, 0.7, 0.3) };
    if (name.includes('dark') || name.includes('despair') || name.includes('shadow')) return { diffuse: new Color3(0.6, 0.2, 0.8), emissive: new Color3(0.4, 0.1, 0.6) };
    if (name.includes('poison') || name.includes('pestilence')) return { diffuse: new Color3(0.3, 0.8, 0.2), emissive: new Color3(0.1, 0.5, 0.1) };
    if (name.includes('arrow')) return { diffuse: new Color3(0.8, 0.6, 0.3), emissive: new Color3(0.5, 0.3, 0.1) };
    return { diffuse: new Color3(0.8, 0.3, 0.3), emissive: new Color3(0.5, 0.1, 0.1) };
  }

  createAOEZoneMesh(id: string, position: { x: number; y: number; z: number }, radius: number, skillName: string, expiresAt: number): void {
    if (!this.scene) return;
    this.removeAOEZoneMesh(id);

    const disc = MeshBuilder.CreateDisc(`aoe_zone_${id}`, { radius, tessellation: 64 }, this.scene);
    const mat = new StandardMaterial(`aoe_zone_mat_${id}`, this.scene);
    const colors = this.getAOEZoneColor(skillName);
    mat.diffuseColor = colors.diffuse;
    mat.emissiveColor = colors.emissive;
    mat.disableLighting = true;
    mat.alpha = 0.35;
    mat.backFaceCulling = false;
    disc.material = mat;
    disc.rotation.x = Math.PI / 2;
    disc.position.set(position.x, position.y + 0.05, position.z);
    disc.isPickable = false;

    this.aoeZoneMeshes.set(id, { disc, material: mat, expiresAt });
  }

  removeAOEZoneMesh(id: string): void {
    const entry = this.aoeZoneMeshes.get(id);
    if (entry) {
      entry.disc.dispose();
      entry.material.dispose();
      this.aoeZoneMeshes.delete(id);
    }
  }

  updateAOEZoneMeshes(now: number): void {
    for (const [id, entry] of this.aoeZoneMeshes) {
      const remaining = entry.expiresAt - now;
      if (remaining <= 0) {
        this.removeAOEZoneMesh(id);
        continue;
      }
      const fadeThreshold = 2000;
      if (remaining < fadeThreshold) {
        entry.material.alpha = 0.35 * (remaining / fadeThreshold);
      }
    }
  }

  async buildNavMesh(): Promise<void> {
    if (!this.scene) return;

    try {
      const recastFactory = (await import('recastjs')).default || (await import('recastjs'));
      const recastInstance = typeof recastFactory === 'function' ? await recastFactory() : recastFactory;
      this.navigationPlugin = new RecastJSPlugin(recastInstance);
    } catch (e) {
      console.warn('Failed to initialize RecastJSPlugin:', e);
      return;
    }

    const navMeshMeshes: Mesh[] = [];
    this.scene.meshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        const n = mesh.name;
        if (
          n.startsWith('map_ground') || n.startsWith('zone_ground') ||
          n.startsWith('map_struct_') || n.startsWith('map_pillar_') ||
          n.startsWith('map_house_') || n.startsWith('map_rock_') ||
          n.startsWith('platform_') || n.startsWith('env_rock_')
        ) {
          navMeshMeshes.push(mesh);
        }
      }
    });

    if (navMeshMeshes.length === 0) {
      console.warn('No meshes found for navmesh generation');
      return;
    }

    const params: INavMeshParameters = {
      cs: 0.2,
      ch: 0.2,
      walkableSlopeAngle: 45,
      walkableHeight: 1.0,
      walkableClimb: 0.5,
      walkableRadius: 0.3,
      maxEdgeLen: 12,
      maxSimplificationError: 1.3,
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxVertsPerPoly: 6,
      detailSampleDist: 6,
      detailSampleMaxError: 1.0,
    };

    try {
      this.navigationPlugin.createNavMesh(navMeshMeshes, params);
      this.navMeshReady = true;
    } catch (e) {
      console.warn('Navmesh generation failed:', e);
      this.navigationPlugin = null;
    }
  }

  isNavMeshReady(): boolean {
    return this.navMeshReady;
  }

  computePath(start: V3, end: V3): V3[] {
    if (!this.navigationPlugin || !this.navMeshReady) {
      return [end];
    }
    try {
      const snappedStart = this.navigationPlugin.getClosestPoint(start);
      const snappedEnd = this.navigationPlugin.getClosestPoint(end);
      const path = this.navigationPlugin.computePath(snappedStart, snappedEnd);
      if (path.length === 0) return [];
      return path;
    } catch {
      return [end];
    }
  }

  getGroundPoint(screenX: number, screenY: number): V3 | null {
    if (!this.scene) return null;
    const pickResult = this.scene.pick(screenX, screenY, (mesh) => {
      if (mesh.isPickable === false) return false;
      if (mesh === this.moveIndicator || mesh === this.aoeTargetCircle) return false;
      const n = mesh.name;
      return n.startsWith('map_ground') || n.startsWith('zone_ground')
        || n.startsWith('map_struct_') || n.startsWith('map_pillar_')
        || n.startsWith('map_rock_') || n.startsWith('platform_')
        || n.startsWith('heightmap_');
    });
    if (!pickResult || !pickResult.hit || !pickResult.pickedPoint) return null;
    const normal = pickResult.getNormal(true);
    if (normal && Math.abs(normal.y) < 0.85) return null;
    return V3.FromArray([pickResult.pickedPoint.x, pickResult.pickedPoint.y, pickResult.pickedPoint.z]);
  }

  setMoveIndicatorCallback(cb: (worldPos: V3) => void): void {
    this.moveIndicatorCallback = cb;
  }

  showMoveIndicator(position: V3): void {
    if (!this.scene) return;
    if (!this.moveIndicator) {
      this.moveIndicator = MeshBuilder.CreateDisc('move_indicator', { radius: 0.3, tessellation: 32 }, this.scene);
      this.moveIndicatorMat = new StandardMaterial('move_indicator_mat', this.scene);
      this.moveIndicatorMat.diffuseColor = new Color3(0.3, 0.8, 1.0);
      this.moveIndicatorMat.emissiveColor = new Color3(0.1, 0.4, 0.6);
      this.moveIndicatorMat.disableLighting = true;
      this.moveIndicatorMat.alpha = 0.5;
      this.moveIndicatorMat.backFaceCulling = false;
      this.moveIndicator.material = this.moveIndicatorMat;
      this.moveIndicator.isPickable = false;
      this.moveIndicator.rotation.x = Math.PI / 2;
    }
    this.moveIndicator.position.set(position.x, position.y + 0.05, position.z);
    this.moveIndicator.setEnabled(true);
  }

  hideMoveIndicator(): void {
    if (this.moveIndicator) {
      this.moveIndicator.setEnabled(false);
    }
  }

  updateMoveIndicator(deltaTime: number): void {
    if (this.moveIndicator && this.moveIndicatorMat && this.moveIndicator.isEnabled()) {
      this.moveIndicatorMat.alpha = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
    }
  }

  dispose(): void {
    if (this.isRotating) document.exitPointerLock();
    this.canvas?.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas?.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas?.removeEventListener('pointermove', this.handlePointerMoveForCamera);
    this.hideAOETargetCircle();
    this.aoeZoneMeshes.forEach((entry) => {
      entry.disc.dispose();
      entry.material.dispose();
    });
    this.aoeZoneMeshes.clear();
    this.navigationPlugin = null;
    this.navMeshReady = false;
    this.hideMoveIndicator();
    if (this.moveIndicator) { this.moveIndicator.dispose(); this.moveIndicator = null; }
    if (this.moveIndicatorMat) { this.moveIndicatorMat.dispose(); this.moveIndicatorMat = null; }
    this.meshes.forEach(group => {
      group.root.dispose();
      group.healthBarBg?.dispose();
      group.healthBarFg?.dispose();
      group.namePlate?.dispose();
      group.selectionCircle?.dispose();
    });
    this.meshes.clear();
    this.entityAnimations.clear();
    this.currentAnimation.clear();
    this.targetedEntityId = null;
    this.mapBuilder?.clear();
    this.assetManager?.dispose();
    this.scene?.dispose();
    this.engine?.dispose();
  }
}
