import { 
  Engine, 
  Scene, 
  ArcRotateCamera, 
  Vector3 as BabylonVector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Mesh,
  AbstractMesh
} from '@babylonjs/core';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene | null = null;
  private camera: ArcRotateCamera | null = null;
  private meshes: Map<string, AbstractMesh> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
  }

  async initialize(): Promise<void> {
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.5, 0.7, 1.0, 1);

    this.camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      15,
      BabylonVector3.Zero(),
      this.scene
    );
    this.camera.attachControl(this.canvas, true);
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 50;
    this.camera.wheelPrecision = 50;

    const light = new HemisphericLight('light', new BabylonVector3(0, 1, 0), this.scene);
    light.intensity = 0.8;

    this.createGround();
    this.createEnvironment();

    this.engine.runRenderLoop(() => {
      if (this.scene) {
        this.scene.render();
      }
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  private createGround(): void {
    if (!this.scene) return;

    const ground = MeshBuilder.CreateGround('ground', {
      width: 100,
      height: 100,
      subdivisions: 20
    }, this.scene);

    const groundMaterial = new StandardMaterial('groundMat', this.scene);
    groundMaterial.diffuseColor = new Color3(0.3, 0.5, 0.3);
    groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    ground.material = groundMaterial;

    this.meshes.set('ground', ground);
  }

  private createEnvironment(): void {
    if (!this.scene) return;

    for (let i = 0; i < 20; i++) {
      const tree = this.createTree();
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      tree.position = new BabylonVector3(x, 0, z);
      this.meshes.set(`tree_${i}`, tree);
    }

    for (let i = 0; i < 10; i++) {
      const rock = this.createRock();
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      rock.position = new BabylonVector3(x, 0.5, z);
      this.meshes.set(`rock_${i}`, rock);
    }
  }

  private createTree(): Mesh {
    if (!this.scene) {
      throw new Error('Scene not initialized');
    }

    const trunk = MeshBuilder.CreateCylinder('trunk', {
      height: 3,
      diameter: 0.5
    }, this.scene);

    const trunkMaterial = new StandardMaterial('trunkMat', this.scene);
    trunkMaterial.diffuseColor = new Color3(0.4, 0.3, 0.2);
    trunk.material = trunkMaterial;

    const leaves = MeshBuilder.CreateCylinder('leaves', {
      height: 4,
      diameterTop: 0,
      diameterBottom: 3,
      tessellation: 6
    }, this.scene);

    const leavesMaterial = new StandardMaterial('leavesMat', this.scene);
    leavesMaterial.diffuseColor = new Color3(0.2, 0.6, 0.2);
    leaves.material = leavesMaterial;

    leaves.position.y = 3.5;

    const tree = Mesh.MergeMeshes([trunk, leaves], true, true, undefined, false, true);
    if (!tree) {
      throw new Error('Failed to create tree');
    }
    return tree;
  }

  private createRock(): Mesh {
    if (!this.scene) {
      throw new Error('Scene not initialized');
    }

    const rock = MeshBuilder.CreateBox('rock', {
      width: 1 + Math.random(),
      height: 0.5 + Math.random() * 0.5,
      depth: 1 + Math.random()
    }, this.scene);

    const rockMaterial = new StandardMaterial('rockMat', this.scene);
    rockMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
    rock.material = rockMaterial;

    return rock;
  }

  createPlayerMesh(entityId: string, position: BabylonVector3): Mesh {
    if (!this.scene) {
      throw new Error('Scene not initialized');
    }

    const player = MeshBuilder.CreateCapsule(`player_${entityId}`, {
      height: 2,
      radius: 0.4
    }, this.scene);

    const playerMaterial = new StandardMaterial(`playerMat_${entityId}`, this.scene);
    playerMaterial.diffuseColor = new Color3(0.2, 0.4, 0.8);
    player.material = playerMaterial;

    player.position = position;

    this.meshes.set(entityId, player);
    return player;
  }

  updateEntityPosition(entityId: string, position: BabylonVector3): void {
    const mesh = this.meshes.get(entityId);
    if (mesh) {
      mesh.position = position;
    }
  }

  updateEntityRotation(entityId: string, rotation: BabylonVector3): void {
    const mesh = this.meshes.get(entityId);
    if (mesh) {
      mesh.rotation = rotation;
    }
  }

  removeEntity(entityId: string): void {
    const mesh = this.meshes.get(entityId);
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(entityId);
    }
  }

  getScene(): Scene | null {
    return this.scene;
  }

  getEngine(): Engine {
    return this.engine;
  }

  dispose(): void {
    this.meshes.forEach(mesh => mesh.dispose());
    this.meshes.clear();
    this.scene?.dispose();
    this.engine.dispose();
  }
}