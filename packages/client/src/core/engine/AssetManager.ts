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

  constructor(scene: Scene) {
    this.scene = scene;
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

  dispose(): void {
    this.containers.forEach(container => {
      container.dispose();
    });
    this.containers.clear();
  }
}
