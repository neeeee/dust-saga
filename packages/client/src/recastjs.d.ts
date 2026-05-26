declare module 'recastjs' {
  interface RecastInstance {
    Recast: new () => {
      loadTileState(data: ArrayBuffer): void;
      getNavMesh(): any;
      buildNavMesh(navMesh: any, params?: Record<string, number>): void;
      destroy(): void;
    };
  }
  export default function (): Promise<RecastInstance>;
}
