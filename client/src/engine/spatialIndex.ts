import { CanvasElement, Quadtree } from '@collabcanvas/shared';
import { crdtBridge } from '../state/crdtBridge.js';
import { getVisibleWorldBounds } from './camera.js';

class SpatialIndexService {
  private tree: Quadtree;

  constructor() {
    this.tree = new Quadtree();
    this.initSync();
  }

  private initSync(): void {
    crdtBridge.subscribe(() => {
      this.rebuild();
    });
  }

  public rebuild(): void {
    this.tree.clear();
    const all = crdtBridge.getAllElements();
    for (const el of all) {
      this.tree.insert(el);
    }
  }

  public queryVisible(
    panX: number,
    panY: number,
    zoom: number,
    screenWidth: number,
    screenHeight: number
  ): CanvasElement[] {
    const searchBounds = getVisibleWorldBounds(panX, panY, zoom, screenWidth, screenHeight);
    return this.tree.query(searchBounds);
  }

  public getAll(): CanvasElement[] {
    return this.tree.getAll();
  }
}

export const spatialIndex = new SpatialIndexService();
