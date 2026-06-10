import {
  Scene,
  AbstractMesh,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  PointLight
} from '@babylonjs/core';
import { AssetManager } from './AssetManager';

export interface MapTeleporter {
  id: string;
  position: { x: number; y: number; z: number };
  targetZone: string;
  targetSpawn: string;
  radius: number;
  label: string;
}

export interface MapData {
  id: string;
  name: string;
  ground: {
    color: { r: number; g: number; b: number };
    size: number;
    heightVariation?: number;
  };
  fog: {
    color: { r: number; g: number; b: number };
    density: number;
  };
  playerSpawn: { x: number; y: number; z: number };
  objects: Array<{
    type: string;
    position: { x: number; y: number; z: number };
    scale: number;
    model?: string;
    rotation?: number;
  }>;
  structures: Array<{
    type: string;
    position: { x: number; y: number; z: number };
    size: { w: number; h: number; d: number };
    color: { r: number; g: number; b: number };
    wallsColor?: { r: number; g: number; b: number };
    roofColor?: { r: number; g: number; b: number };
  }>;
  teleporters: MapTeleporter[];
  lights: Array<{
    type: string;
    position: { x: number; y: number; z: number };
    intensity: number;
    range?: number;
    color: { r: number; g: number; b: number };
  }>;
}

function colorKey(r: number, g: number, b: number): string {
  return `${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)}`;
}

export class MapBuilder {
  private scene: Scene;
  private assetManager: AssetManager;
  private disposedMeshes: AbstractMesh[] = [];
  private teleporterPositions: Map<string, { position: Vector3; radius: number; data: MapTeleporter }> = new Map();

  private trunkMat: StandardMaterial | null = null;
  private leavesMat: StandardMaterial | null = null;
  private rockMat: StandardMaterial | null = null;
  private structMatCache: Map<string, StandardMaterial> = new Map();
  private sharedMats: StandardMaterial[] = [];

  constructor(scene: Scene, assetManager: AssetManager) {
    this.scene = scene;
    this.assetManager = assetManager;
  }

  private getTrunkMat(): StandardMaterial {
    if (!this.trunkMat) {
      this.trunkMat = new StandardMaterial('map_trunk_mat_shared', this.scene);
      this.trunkMat.diffuseColor = new Color3(0.4, 0.25, 0.15);
      this.trunkMat.freeze();
      this.sharedMats.push(this.trunkMat);
    }
    return this.trunkMat;
  }

  private getLeavesMat(): StandardMaterial {
    if (!this.leavesMat) {
      this.leavesMat = new StandardMaterial('map_leaves_mat_shared', this.scene);
      this.leavesMat.diffuseColor = new Color3(0.22, 0.6, 0.2);
      this.leavesMat.freeze();
      this.sharedMats.push(this.leavesMat);
    }
    return this.leavesMat;
  }

  private getRockMat(): StandardMaterial {
    if (!this.rockMat) {
      this.rockMat = new StandardMaterial('map_rock_mat_shared', this.scene);
      this.rockMat.diffuseColor = new Color3(0.5, 0.5, 0.5);
      this.rockMat.freeze();
      this.sharedMats.push(this.rockMat);
    }
    return this.rockMat;
  }

  private getStructMat(r: number, g: number, b: number, specular: boolean): StandardMaterial {
    const key = `${specular ? 's' : 'n'}_${colorKey(r, g, b)}`;
    let mat = this.structMatCache.get(key);
    if (!mat) {
      mat = new StandardMaterial(`map_struct_${key}`, this.scene);
      mat.diffuseColor = new Color3(r, g, b);
      mat.specularColor = specular ? new Color3(0.05, 0.05, 0.05) : Color3.Black();
      mat.freeze();
      this.structMatCache.set(key, mat);
      this.sharedMats.push(mat);
    }
    return mat;
  }

  async build(mapData: MapData): Promise<void> {
    this.clear();

    this.scene.clearColor = new Color4(mapData.fog.color.r, mapData.fog.color.g, mapData.fog.color.b, 1);
    this.scene.fogColor = new Color3(mapData.fog.color.r, mapData.fog.color.g, mapData.fog.color.b);
    this.scene.fogDensity = mapData.fog.density;

    this.buildGround(mapData.ground);
    await this.buildObjects(mapData.objects);
    this.buildStructures(mapData.structures);
    this.buildTeleporters(mapData.teleporters);
    this.buildLights(mapData.lights);
  }

  private buildGround(ground: MapData['ground']): void {
    const size = ground.size;
    const groundMesh = MeshBuilder.CreateGround('map_ground', {
      width: size,
      height: size,
      subdivisions: 64
    }, this.scene);

    const mat = new StandardMaterial('map_ground_mat', this.scene);
    mat.diffuseColor = new Color3(ground.color.r, ground.color.g, ground.color.b);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    groundMesh.material = mat;

    if (ground.heightVariation) {
      this.applyHeightVariation(groundMesh, ground.heightVariation);
    }

    groundMesh.receiveShadows = true;
    this.disposedMeshes.push(groundMesh);
  }

  private applyHeightVariation(ground: AbstractMesh, variation: number): void {
    const positions = ground.getVerticesData('position');
    if (!positions) return;

    const newPositions = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      newPositions[i] = positions[i];
      newPositions[i + 1] = positions[i + 1] + (Math.random() - 0.5) * variation;
      newPositions[i + 2] = positions[i + 2];
    }

    ground.updateVerticesData('position', newPositions);
    ground.createNormals(true);
  }

  private async buildObjects(objects: MapData['objects']): Promise<void> {
    for (const obj of objects) {
      const pos = new Vector3(obj.position.x, obj.position.y, obj.position.z);

      if (obj.model) {
        const result = await this.assetManager.instantiateModel(obj.model, pos);
        if (result) {
          result.root.scaling = new Vector3(obj.scale, obj.scale, obj.scale);
          result.root.name = `map_${obj.type}_${obj.position.x}_${obj.position.z}`;
          if (obj.rotation) result.root.rotation.y = obj.rotation;
          this.disposedMeshes.push(result.root);
          continue;
        }
      }

      this.createFallbackObject(obj, pos);
    }
  }

  private createFallbackObject(obj: MapData['objects'][0], pos: Vector3): void {
    if (obj.type === 'tree') {
      this.createFallbackTree(pos, obj.scale);
    } else if (obj.type === 'rock') {
      this.createFallbackRock(pos, obj.scale);
    }
  }

  private createFallbackTree(position: Vector3, scale: number): void {
    const trunk = MeshBuilder.CreateCylinder(`map_tree_trunk_${Date.now()}_${Math.random()}`, {
      height: 3 * scale,
      diameter: 0.4 * scale
    }, this.scene);
    trunk.position = position.clone();
    trunk.position.y += 1.5 * scale;
    trunk.material = this.getTrunkMat();

    const leaves = MeshBuilder.CreateCylinder(`map_tree_leaves_${Date.now()}_${Math.random()}`, {
      height: 4 * scale,
      diameterTop: 0,
      diameterBottom: 2.5 * scale,
      tessellation: 6
    }, this.scene);
    leaves.position = position.add(new Vector3(0, 4 * scale, 0));
    leaves.material = this.getLeavesMat();

    this.disposedMeshes.push(trunk, leaves);
  }

  private createFallbackRock(position: Vector3, scale: number): void {
    const rock = MeshBuilder.CreateBox(`map_rock_${Date.now()}_${Math.random()}`, {
      width: (0.8 + Math.random() * 0.6) * scale,
      height: (0.4 + Math.random() * 0.3) * scale,
      depth: (0.8 + Math.random() * 0.6) * scale
    }, this.scene);
    rock.position = position.add(new Vector3(0, 0.25 * scale, 0));
    rock.rotation.y = Math.random() * Math.PI * 2;
    rock.material = this.getRockMat();

    this.disposedMeshes.push(rock);
  }

  private buildStructures(structures: MapData['structures']): void {
    for (const struct of structures) {
      switch (struct.type) {
        case 'platform':
        case 'path':
        case 'wall':
        case 'fence':
          this.buildBox(struct);
          break;
        case 'pillar':
          this.buildPillar(struct);
          break;
        case 'house':
          this.buildHouse(struct);
          break;
      }
    }
  }

  private buildBox(struct: MapData['structures'][0]): void {
    const mesh = MeshBuilder.CreateBox(`map_struct_${Date.now()}_${Math.random()}`, {
      width: struct.size.w,
      height: struct.size.h,
      depth: struct.size.d
    }, this.scene);
    mesh.position = new Vector3(struct.position.x, struct.position.y + struct.size.h / 2, struct.position.z);

    mesh.material = this.getStructMat(struct.color.r, struct.color.g, struct.color.b, true);
    mesh.receiveShadows = true;

    this.disposedMeshes.push(mesh);
  }

  private buildPillar(struct: MapData['structures'][0]): void {
    const mesh = MeshBuilder.CreateCylinder(`map_pillar_${Date.now()}_${Math.random()}`, {
      height: struct.size.h,
      diameter: Math.min(struct.size.w, struct.size.d)
    }, this.scene);
    mesh.position = new Vector3(struct.position.x, struct.position.y + struct.size.h / 2, struct.position.z);

    mesh.material = this.getStructMat(struct.color.r, struct.color.g, struct.color.b, true);

    this.disposedMeshes.push(mesh);
  }

  private buildHouse(struct: MapData['structures'][0]): void {
    const wallsColor = struct.wallsColor || struct.color;
    const roofColor = struct.roofColor || { r: 0.5, g: 0.2, b: 0.1 };

    const walls = MeshBuilder.CreateBox(`map_house_walls_${Date.now()}`, {
      width: struct.size.w,
      height: struct.size.h,
      depth: struct.size.d
    }, this.scene);
    walls.position = new Vector3(struct.position.x, struct.position.y + struct.size.h / 2, struct.position.z);
    walls.material = this.getStructMat(wallsColor.r, wallsColor.g, wallsColor.b, true);

    const roof = MeshBuilder.CreateCylinder(`map_house_roof_${Date.now()}`, {
      height: struct.size.d * 1.1,
      diameterTop: 0,
      diameterBottom: struct.size.w * 1.3,
      tessellation: 4
    }, this.scene);
    roof.position = new Vector3(struct.position.x, struct.position.y + struct.size.h + struct.size.w * 0.35, struct.position.z);
    roof.rotation.y = Math.PI / 4;
    roof.material = this.getStructMat(roofColor.r, roofColor.g, roofColor.b, true);

    this.disposedMeshes.push(walls, roof);
  }

  private buildTeleporters(teleporters: MapTeleporter[]): void {
    for (const tp of teleporters) {
      const pos = new Vector3(tp.position.x, tp.position.y, tp.position.z);

      const base = MeshBuilder.CreateCylinder(`tp_base_${tp.id}`, {
        height: 0.1,
        diameter: tp.radius * 2,
        tessellation: 24
      }, this.scene);
      base.position = pos;

      const baseMat = new StandardMaterial(`tp_base_mat_${tp.id}`, this.scene);
      baseMat.diffuseColor = new Color3(0.2, 0.5, 1);
      baseMat.emissiveColor = new Color3(0.1, 0.3, 0.8);
      baseMat.alpha = 0.6;
      base.material = baseMat;

      const pillar = MeshBuilder.CreateCylinder(`tp_pillar_${tp.id}`, {
        height: 3,
        diameter: 0.15,
        tessellation: 8
      }, this.scene);
      pillar.position = pos.add(new Vector3(0, 1.5, 0));

      const pillarMat = new StandardMaterial(`tp_pillar_mat_${tp.id}`, this.scene);
      pillarMat.diffuseColor = new Color3(0.3, 0.6, 1);
      pillarMat.emissiveColor = new Color3(0.2, 0.4, 0.9);
      pillar.material = pillarMat;

      const label = this.createLabel(tp.label, `tp_label_${tp.id}`);
      label.position = pos.add(new Vector3(0, 3.5, 0));

      this.teleporterPositions.set(tp.id, { position: pos, radius: tp.radius, data: tp });
      this.disposedMeshes.push(base, pillar, label);

      const startTime = Date.now();
      this.scene.onBeforeRenderObservable.add(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        baseMat.emissiveColor = new Color3(
          0.1 + Math.sin(elapsed * 2) * 0.1,
          0.3 + Math.sin(elapsed * 2) * 0.1,
          0.8
        );
        baseMat.alpha = 0.4 + Math.sin(elapsed * 3) * 0.2;
      });
    }
  }

  private createLabel(text: string, name: string): AbstractMesh {
    const plane = MeshBuilder.CreatePlane(name, { width: 3, height: 0.4 }, this.scene);

    const texture = new DynamicTexture(`${name}_tex`, { width: 512, height: 64 }, this.scene, true);
    texture.hasAlpha = true;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 512, 64);
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#88ccff';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText(text, 256, 40);
    ctx.fillText(text, 256, 40);
    texture.update();

    const mat = new StandardMaterial(`${name}_mat`, this.scene);
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mat.useAlphaFromDiffuseTexture = true;
    plane.material = mat;
    plane.billboardMode = 7;

    return plane;
  }

  private buildLights(lights: MapData['lights']): void {
    for (const light of lights) {
      if (light.type === 'point' && light.range) {
        const pl = new PointLight(
          `map_light_${Date.now()}_${Math.random()}`,
          new Vector3(light.position.x, light.position.y, light.position.z),
          this.scene
        );
        pl.intensity = light.intensity;
        pl.range = light.range;
        pl.diffuse = new Color3(light.color.r, light.color.g, light.color.b);
      }
    }
  }

  checkTeleport(position: Vector3): MapTeleporter | null {
    for (const [, tp] of this.teleporterPositions) {
      const dx = position.x - tp.position.x;
      const dz = position.z - tp.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < tp.radius) {
        return tp.data;
      }
    }
    return null;
  }

  getTeleporterPosition(id: string): Vector3 | null {
    return this.teleporterPositions.get(id)?.position || null;
  }

  clear(): void {
    this.disposedMeshes.forEach(m => {
      m.dispose();
    });
    this.disposedMeshes = [];
    this.sharedMats.forEach(m => m.dispose());
    this.sharedMats = [];
    this.structMatCache.clear();
    this.trunkMat = null;
    this.leavesMat = null;
    this.rockMat = null;
    this.teleporterPositions.clear();
  }
}
