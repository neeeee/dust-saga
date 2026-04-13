import '@babylonjs/loaders/glTF';
import {
  Scene,
  SceneLoader,
  AbstractMesh,
  Vector3,
  TransformNode,
  AnimationGroup,
  Color3,
  StandardMaterial,
  MeshBuilder,
  DynamicTexture
} from '@babylonjs/core';

export interface LoadedModel {
  root: TransformNode;
  meshes: AbstractMesh[];
  animations: AnimationGroup[];
}

export class AssetManager {
  private scene: Scene;
  private loadedModels: Map<string, LoadedModel> = new Map();
  private modelCache: Map<string, AbstractMesh[]> = new Map();
  private loadingPromises: Map<string, Promise<AbstractMesh[]>> = new Map();
  private basePath: string = '/models/';

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async loadModel(name: string): Promise<AbstractMesh[]> {
    const fileName = name.endsWith('.glb') ? name : `${name}.glb`;

    if (this.modelCache.has(fileName)) {
      return this.modelCache.get(fileName)!;
    }

    if (this.loadingPromises.has(fileName)) {
      return this.loadingPromises.get(fileName)!;
    }

    const promise = new Promise<AbstractMesh[]>((resolve) => {
      SceneLoader.ImportMesh(
        '',
        this.basePath,
        fileName,
        this.scene,
        (meshes) => {
          const rootMesh = meshes[0];
          if (rootMesh) {
            rootMesh.setEnabled(false);
            rootMesh.isVisible = false;
            meshes.forEach(m => {
              m.isVisible = false;
              m.setEnabled(false);
            });
          }

          this.modelCache.set(fileName, meshes);
          this.loadingPromises.delete(fileName);
          resolve(meshes);
        },
        undefined,
        (_scene, message) => {
          console.warn(`Failed to load model ${fileName}:`, message);
          this.loadingPromises.delete(fileName);
          resolve([]);
        }
      );
    });

    this.loadingPromises.set(fileName, promise);
    return promise;
  }

  async instantiateModel(name: string, position?: Vector3): Promise<AbstractMesh | null> {
    const sourceMeshes = await this.loadModel(name);

    if (sourceMeshes.length === 0) return null;

    const root = sourceMeshes[0].clone(`${name}_instance_${Date.now()}_${Math.random()}`, null);
    if (!root) return null;

    root.setEnabled(true);
    root.isVisible = true;

    if (position) {
      root.position = position;
    }

    root.getChildMeshes().forEach(m => {
      m.isVisible = true;
      m.setEnabled(true);
    });

    return root;
  }

  createHealthBar(parentId: string, width: number = 2, height: number = 0.2): { background: AbstractMesh; foreground: AbstractMesh } {
    const bg = MeshBuilder.CreatePlane(`hp_bg_${parentId}`, { width, height }, this.scene);
    const fg = MeshBuilder.CreatePlane(`hp_fg_${parentId}`, { width: width - 0.05, height: height - 0.05 }, this.scene);

    const bgMat = new StandardMaterial(`hp_bg_mat_${parentId}`, this.scene);
    bgMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
    bgMat.emissiveColor = new Color3(0.1, 0.1, 0.1);
    bgMat.backFaceCulling = false;
    bgMat.disableLighting = true;
    bg.material = bgMat;

    const fgMat = new StandardMaterial(`hp_fg_mat_${parentId}`, this.scene);
    fgMat.diffuseColor = new Color3(0.1, 0.8, 0.1);
    fgMat.emissiveColor = new Color3(0.1, 0.6, 0.1);
    fgMat.backFaceCulling = false;
    fgMat.disableLighting = true;
    fg.material = fgMat;

    fg.position.z = -0.01;

    bg.billboardMode = 7;
    fg.billboardMode = 7;

    return { background: bg, foreground: fg };
  }

  createNamePlate(name: string, parentId: string): AbstractMesh {
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

  updateHealthBar(_parentId: string, current: number, max: number, _bg: AbstractMesh, fg: AbstractMesh): void {
    const ratio = Math.max(0, Math.min(1, current / max));
    fg.scaling.x = ratio;
    fg.position.x = -(1 - ratio) * 0.5 * 2;

    const fgMat = fg.material as StandardMaterial;
    if (ratio > 0.5) {
      fgMat.diffuseColor = new Color3(0.1, 0.8, 0.1);
      fgMat.emissiveColor = new Color3(0.1, 0.6, 0.1);
    } else if (ratio > 0.25) {
      fgMat.diffuseColor = new Color3(0.8, 0.8, 0.1);
      fgMat.emissiveColor = new Color3(0.6, 0.6, 0.1);
    } else {
      fgMat.diffuseColor = new Color3(0.8, 0.1, 0.1);
      fgMat.emissiveColor = new Color3(0.6, 0.1, 0.1);
    }
  }

  createDamageNumber(value: number, position: Vector3, isCritical: boolean): void {
    const plane = MeshBuilder.CreatePlane(`dmg_${Date.now()}`, { width: 1, height: 0.5 }, this.scene);
    plane.position = position.add(new Vector3((Math.random() - 0.5) * 0.5, 2, (Math.random() - 0.5) * 0.5));
    plane.billboardMode = 7;

    const texture = new DynamicTexture(`dmg_tex_${Date.now()}`, { width: 128, height: 64 }, this.scene, true);
    texture.hasAlpha = true;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = isCritical ? 'bold 40px Arial' : 'bold 28px Arial';
    ctx.fillStyle = isCritical ? '#ff4444' : '#ffcc00';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    const text = isCritical ? `${value}!` : `${value}`;
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

  dispose(): void {
    this.loadedModels.forEach(model => {
      model.meshes.forEach(m => m.dispose());
    });
    this.loadedModels.clear();
    this.modelCache.clear();
  }
}
