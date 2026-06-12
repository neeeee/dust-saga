import '@babylonjs/loaders/glTF';
import {
  Scene,
  SceneLoader,
  AbstractMesh,
  Vector3,
  AnimationGroup,
  Color3,
  StandardMaterial,
  MeshBuilder,
  DynamicTexture,
  AssetContainer,
  Mesh
} from '@babylonjs/core';

export class AssetManager {
  private scene: Scene;
  private containers: Map<string, AssetContainer> = new Map();
  private loadingPromises: Map<string, Promise<AssetContainer | null>> = new Map();
  private basePath: string = '/models/';

  private projectilePool: Array<{ mesh: AbstractMesh; active: boolean; from: Vector3; to: Vector3; elapsed: number; duration: number }> = [];

  showFireBreath(position: Vector3, radius: number): void {
    const sphere = MeshBuilder.CreateSphere(`fire_breath_${Date.now()}`, { diameter: 1, segments: 8 }, this.scene);
    const mat = new StandardMaterial(`fire_breath_mat_${Date.now()}`, this.scene);
    mat.diffuseColor = new Color3(1, 0.3, 0.05);
    mat.emissiveColor = new Color3(0.8, 0.2, 0);
    mat.alpha = 0.6;
    mat.disableLighting = true;
    sphere.material = mat;
    sphere.position = position.clone();
    sphere.position.y += 0.5;
    sphere.isPickable = false;

    const targetDiameter = radius * 2;
    let elapsed = 0;
    const anim = this.scene.onBeforeRenderObservable.add(() => {
      elapsed += this.scene.getEngine().getDeltaTime() / 1000;
      const t = Math.min(1, elapsed / 0.4);
      const scale = t * (targetDiameter / 1);
      sphere.scaling = new Vector3(scale, scale * 0.3, scale);
      mat.alpha = 0.6 * (1 - t);
      if (t >= 1) {
        this.scene.onBeforeRenderObservable.remove(anim);
        sphere.dispose();
        mat.dispose();
      }
    });
  }

  showEarthquake(position: Vector3, radius: number): void {
    const ring = MeshBuilder.CreateTorus(`earthquake_${Date.now()}`, { diameter: 1, thickness: 0.4, tessellation: 24 }, this.scene);
    const mat = new StandardMaterial(`earthquake_mat_${Date.now()}`, this.scene);
    mat.diffuseColor = new Color3(0.6, 0.4, 0.2);
    mat.emissiveColor = new Color3(0.4, 0.25, 0.1);
    mat.alpha = 0.7;
    mat.disableLighting = true;
    ring.material = mat;
    ring.position = position.clone();
    ring.position.y += 0.1;
    ring.isPickable = false;

    const targetDiameter = radius * 2;
    let elapsed = 0;
    const anim = this.scene.onBeforeRenderObservable.add(() => {
      elapsed += this.scene.getEngine().getDeltaTime() / 1000;
      const t = Math.min(1, elapsed / 0.6);
      const scale = t * (targetDiameter / 1);
      ring.scaling = new Vector3(scale, scale * 0.15, scale);
      mat.alpha = 0.7 * (1 - t);
      if (t >= 1) {
        this.scene.onBeforeRenderObservable.remove(anim);
        ring.dispose();
        mat.dispose();
      }
    });
  }

  constructor(scene: Scene) {
    this.scene = scene;
    for (let i = 0; i < 10; i++) {
      const sphere = MeshBuilder.CreateSphere(`proj_pool_${i}`, { diameter: 0.3, segments: 6 }, this.scene);
      const mat = new StandardMaterial(`proj_mat_${i}`, this.scene);
      mat.diffuseColor = new Color3(1, 0.8, 0.3);
      mat.emissiveColor = new Color3(0.6, 0.4, 0.1);
      mat.disableLighting = true;
      sphere.material = mat;
      sphere.setEnabled(false);
      sphere.isPickable = false;
      this.projectilePool.push({ mesh: sphere, active: false, from: Vector3.Zero(), to: Vector3.Zero(), elapsed: 0, duration: 300 });
    }
  }

  createNamePlate(name: string, parentId: string): Mesh {
    const plane = MeshBuilder.CreatePlane(`name_${parentId}`, { width: 2, height: 0.3 }, this.scene);

    const texture = new DynamicTexture(`name_tex_${parentId}`, { width: 256, height: 48 }, this.scene, true);
    texture.hasAlpha = true;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 256, 48);
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(name, 128, 32);
    texture.update();

    const mat = new StandardMaterial(`name_mat_${parentId}`, this.scene);
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mat.useAlphaFromDiffuseTexture = true;
    plane.material = mat;
    plane.billboardMode = 7;

    return plane;
  }

  private async getContainer(name: string): Promise<AssetContainer | null> {
    const fileName = name.endsWith('.glb') ? name : `${name}.glb`;

    if (this.containers.has(fileName)) {
      return this.containers.get(fileName)!;
    }

    if (this.loadingPromises.has(fileName)) {
      return this.loadingPromises.get(fileName)!;
    }

    const promise = new Promise<AssetContainer | null>((resolve) => {
      SceneLoader.ImportMesh(
        '',
        this.basePath,
        fileName,
        this.scene,
        (meshes, _particleSystems, skeletons, animationGroups) => {
          animationGroups.forEach(ag => ag.stop());
          skeletons.forEach(s => s.returnToRest());
          meshes.forEach(m => {
            m.isVisible = false;
          });

          const container = new AssetContainer(this.scene);
          meshes.forEach(m => container.meshes.push(m));
          animationGroups.forEach(ag => container.animationGroups.push(ag));
          skeletons.forEach(s => container.skeletons.push(s));

          this.containers.set(fileName, container);
          this.loadingPromises.delete(fileName);
          resolve(container);
        },
        undefined,
        (_scene: Scene, message: string) => {
          console.warn(`Failed to load model ${fileName}:`, message);
          this.loadingPromises.delete(fileName);
          resolve(null);
        }
      );
    });

    this.loadingPromises.set(fileName, promise);
    return promise;
  }

  async instantiateModel(name: string, position?: Vector3): Promise<{ root: AbstractMesh; animations: AnimationGroup[] } | null> {
    const container = await this.getContainer(name);
    if (!container) return null;

    const result = container.instantiateModelsToScene();
    const root = result.rootNodes[0] as AbstractMesh | undefined;
    if (!root) return null;

    root.isVisible = true;
    root.getChildMeshes().forEach(m => { m.isVisible = true; });

    if (position) {
      root.position = position;
    }

    return { root, animations: result.animationGroups };
  }

  private static ELEMENT_COLORS: Record<string, string> = {
    fire: '#ff6600',
    ice: '#00ccff',
    lightning: '#ffee00',
    holy: '#eeeeff',
    dark: '#aa44ff',
    poison: '#44ff66',
  };

  createDamageNumber(value: number, position: Vector3, isCritical: boolean, element?: string, miss?: boolean): void {
    const plane = MeshBuilder.CreatePlane(`dmg_${Date.now()}`, { width: 1, height: 0.5 }, this.scene);
    const yOff = miss ? 2.2 : (element ? 2.4 : 2);
    plane.position = position.add(new Vector3((Math.random() - 0.5) * 0.5, yOff, (Math.random() - 0.5) * 0.5));
    plane.billboardMode = 7;

    const texture = new DynamicTexture(`dmg_tex_${Date.now()}`, { width: 128, height: 64 }, this.scene, true);
    texture.hasAlpha = true;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 128, 64);

    let color: string;
    if (miss) {
      color = '#888888';
      ctx.font = 'bold 22px Arial';
    } else if (element) {
      color = AssetManager.ELEMENT_COLORS[element] || '#ffcc00';
      ctx.font = 'bold 24px Arial';
    } else if (isCritical) {
      color = '#ff4444';
      ctx.font = 'bold 40px Arial';
    } else {
      color = '#ffcc00';
      ctx.font = 'bold 28px Arial';
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    const text = miss ? 'MISS' : ((!element && isCritical) ? `${value}!` : `${value}`);
    ctx.strokeText(text, 64, 44);
    ctx.fillText(text, 64, 44);
    texture.update();

    const mat = new StandardMaterial(`dmg_mat_${Date.now()}`, this.scene);
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.alpha = 1;
    plane.material = mat;

    let elapsed = 0;
    const anim = this.scene.onBeforeRenderObservable.add(() => {
      elapsed += this.scene.getEngine().getDeltaTime() / 1000;
      plane.position.y += 0.02;
      mat.alpha = Math.max(0, 1 - elapsed / 1.5);

      if (elapsed > 1.5) {
        this.scene.onBeforeRenderObservable.remove(anim);
        plane.dispose();
        texture.dispose();
        mat.dispose();
      }
    });
  }

  createLootBeacon(position: Vector3): AbstractMesh {
    const beacon = MeshBuilder.CreateCylinder(`loot_beacon_${Date.now()}`, {
      height: 0.1,
      diameter: 0.5,
      tessellation: 8
    }, this.scene);

    const mat = new StandardMaterial(`loot_mat_${Date.now()}`, this.scene);
    mat.diffuseColor = new Color3(1, 0.85, 0);
    mat.emissiveColor = new Color3(0.8, 0.65, 0);
    mat.alpha = 0.7;
    beacon.material = mat;

    beacon.position = position;

    let elapsed = 0;
    this.scene.onBeforeRenderObservable.add(() => {
      elapsed += this.scene.getEngine().getDeltaTime() / 1000;
      beacon.position.y = position.y + 0.3 + Math.sin(elapsed * 3) * 0.2;
      beacon.rotation.y += 0.03;
    });

    return beacon;
  }

  createHealthBar(entityId: string): { bg: AbstractMesh; fg: AbstractMesh } {
    const bg = MeshBuilder.CreatePlane(`hp_bg_${entityId}`, { width: 1.2, height: 0.12 }, this.scene);
    const bgMat = new StandardMaterial(`hp_bg_mat_${entityId}`, this.scene);
    bgMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
    bgMat.disableLighting = true;
    bgMat.backFaceCulling = false;
    bgMat.alpha = 0.7;
    bg.material = bgMat;
    bg.billboardMode = 7;
    bg.isPickable = false;

    const fg = MeshBuilder.CreatePlane(`hp_fg_${entityId}`, { width: 1.2, height: 0.12 }, this.scene);
    const fgMat = new StandardMaterial(`hp_fg_mat_${entityId}`, this.scene);
    fgMat.diffuseColor = new Color3(0.2, 0.8, 0.2);
    fgMat.emissiveColor = new Color3(0.1, 0.4, 0.1);
    fgMat.disableLighting = true;
    fgMat.backFaceCulling = false;
    fg.material = fgMat;
    fg.billboardMode = 7;
    fg.isPickable = false;

    fg.position.z = 0.001;

    return { bg, fg };
  }

  fireProjectile(from: Vector3, to: Vector3, color?: Color3): void {
    const entry = this.projectilePool.find(p => !p.active);
    if (!entry) return;
    entry.active = true;
    entry.from = from.clone();
    entry.to = to.clone();
    entry.elapsed = 0;
    entry.duration = 300;
    entry.mesh.position = from.clone();
    entry.mesh.setEnabled(true);
    if (color) {
      (entry.mesh.material as StandardMaterial).diffuseColor = color;
    }
  }

  tickProjectiles(dt: number): void {
    for (const entry of this.projectilePool) {
      if (!entry.active) continue;
      entry.elapsed += dt;
      const t = Math.min(1, entry.elapsed / entry.duration);
      entry.mesh.position = Vector3.Lerp(entry.from, entry.to, t);
      if (t >= 1) {
        entry.active = false;
        entry.mesh.setEnabled(false);
      }
    }
  }

  dispose(): void {
    for (const entry of this.projectilePool) {
      entry.mesh.dispose();
      (entry.mesh.material as StandardMaterial).dispose();
    }
    this.projectilePool.length = 0;
    this.containers.forEach(container => {
      container.dispose();
    });
    this.containers.clear();
  }
}
