/**
 * Spatial Indexing: Expanding Quadtree with Viewport Culling
 * Supports unbounded 2D infinite canvas coordinates.
 */

import { QUADTREE_MAX_DEPTH, QUADTREE_MAX_ITEMS } from '../constants.js';
import { aabbIntersects, createAABB, getElementBounds } from '../geometry/bounds.js';
import { AABB, CanvasElement } from '../types/index.js';

interface QuadtreeEntry {
  element: CanvasElement;
  bounds: AABB;
}

class QuadtreeNode {
  bounds: AABB;
  depth: number;
  entries: QuadtreeEntry[];
  children: QuadtreeNode[] | null = null;

  constructor(bounds: AABB, depth: number = 0) {
    this.bounds = bounds;
    this.depth = depth;
    this.entries = [];
  }

  isLeaf(): boolean {
    return this.children === null;
  }

  subdivide(): void {
    const { minX, minY, maxX, maxY } = this.bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const nextDepth = this.depth + 1;

    // 4 quadrants: NW, NE, SW, SE
    this.children = [
      new QuadtreeNode(createAABB(minX, minY, midX, midY), nextDepth), // NW
      new QuadtreeNode(createAABB(midX, minY, maxX, midY), nextDepth), // NE
      new QuadtreeNode(createAABB(minX, midY, midX, maxY), nextDepth), // SW
      new QuadtreeNode(createAABB(midX, midY, maxX, maxY), nextDepth), // SE
    ];

    // Re-distribute existing entries
    const existing = this.entries;
    this.entries = [];
    for (const entry of existing) {
      this.insertEntry(entry);
    }
  }

  insertEntry(entry: QuadtreeEntry): boolean {
    if (!aabbIntersects(this.bounds, entry.bounds)) {
      return false;
    }

    if (this.isLeaf()) {
      if (this.entries.length < QUADTREE_MAX_ITEMS || this.depth >= QUADTREE_MAX_DEPTH) {
        this.entries.push(entry);
        return true;
      }
      this.subdivide();
    }

    let inserted = false;
    if (this.children) {
      for (const child of this.children) {
        if (aabbIntersects(child.bounds, entry.bounds)) {
          if (child.insertEntry(entry)) {
            inserted = true;
          }
        }
      }
    }
    return inserted;
  }

  removeEntry(id: string): boolean {
    let removed = false;
    const initialLen = this.entries.length;
    this.entries = this.entries.filter(e => e.element.id !== id);
    if (this.entries.length !== initialLen) {
      removed = true;
    }

    if (this.children) {
      for (const child of this.children) {
        if (child.removeEntry(id)) {
          removed = true;
        }
      }
      // Check if children can be collapsed
      const totalInDescendants = this.countEntries();
      if (totalInDescendants <= QUADTREE_MAX_ITEMS) {
        const allEntries = this.collectEntries();
        this.children = null;
        this.entries = allEntries;
      }
    }
    return removed;
  }

  query(searchAABB: AABB, foundMap: Map<string, CanvasElement>): void {
    if (!aabbIntersects(this.bounds, searchAABB)) {
      return;
    }

    for (const entry of this.entries) {
      if (aabbIntersects(entry.bounds, searchAABB)) {
        foundMap.set(entry.element.id, entry.element);
      }
    }

    if (this.children) {
      for (const child of this.children) {
        child.query(searchAABB, foundMap);
      }
    }
  }

  countEntries(): number {
    let count = this.entries.length;
    if (this.children) {
      for (const child of this.children) {
        count += child.countEntries();
      }
    }
    return count;
  }

  collectEntries(): QuadtreeEntry[] {
    const map = new Map<string, QuadtreeEntry>();
    for (const entry of this.entries) {
      map.set(entry.element.id, entry);
    }
    if (this.children) {
      for (const child of this.children) {
        for (const entry of child.collectEntries()) {
          map.set(entry.element.id, entry);
        }
      }
    }
    return Array.from(map.values());
  }
}

export class Quadtree {
  private root: QuadtreeNode;
  private elementMap: Map<string, CanvasElement> = new Map();

  constructor(initialBounds: AABB = createAABB(-10000, -10000, 10000, 10000)) {
    this.root = new QuadtreeNode(initialBounds, 0);
  }

  public get size(): number {
    return this.elementMap.size;
  }

  /**
   * Expands the root node if the given bounds lie outside current root bounds.
   */
  private ensureBounds(bounds: AABB): void {
    while (!this.contains(this.root.bounds, bounds)) {
      const { minX, minY, maxX, maxY } = this.root.bounds;
      const width = maxX - minX;
      const height = maxY - minY;

      // Expand towards whichever direction the new item is in
      const expandX = bounds.minX < minX ? -1 : 1;
      const expandY = bounds.minY < minY ? -1 : 1;

      const newMinX = expandX === -1 ? minX - width : minX;
      const newMaxX = expandX === -1 ? maxX : maxX + width;
      const newMinY = expandY === -1 ? minY - height : minY;
      const newMaxY = expandY === -1 ? maxY : maxY + height;

      const newRootBounds = createAABB(newMinX, newMinY, newMaxX, newMaxY);
      const newRoot = new QuadtreeNode(newRootBounds, 0);

      // Re-insert all items into new root
      const allElements = Array.from(this.elementMap.values());
      this.root = newRoot;
      for (const el of allElements) {
        this.root.insertEntry({ element: el, bounds: getElementBounds(el) });
      }
    }
  }

  private contains(container: AABB, target: AABB): boolean {
    return (
      container.minX <= target.minX &&
      container.minY <= target.minY &&
      container.maxX >= target.maxX &&
      container.maxY >= target.maxY
    );
  }

  /**
   * Insert element into Quadtree
   */
  public insert(element: CanvasElement): void {
    const bounds = getElementBounds(element);
    this.ensureBounds(bounds);
    this.elementMap.set(element.id, element);
    this.root.insertEntry({ element, bounds });
  }

  /**
   * Update an element in the Quadtree
   */
  public update(element: CanvasElement): void {
    this.remove(element.id);
    this.insert(element);
  }

  /**
   * Remove an element by ID
   */
  public remove(id: string): boolean {
    if (!this.elementMap.has(id)) {
      return false;
    }
    this.elementMap.delete(id);
    return this.root.removeEntry(id);
  }

  /**
   * Query all elements intersecting the given search bounds (e.g., viewport + culling margin)
   */
  public query(searchBounds: AABB): CanvasElement[] {
    const foundMap = new Map<string, CanvasElement>();
    this.root.query(searchBounds, foundMap);
    return Array.from(foundMap.values());
  }

  /**
   * Get all elements stored in tree
   */
  public getAll(): CanvasElement[] {
    return Array.from(this.elementMap.values());
  }

  /**
   * Clear the tree completely
   */
  public clear(): void {
    this.elementMap.clear();
    this.root = new QuadtreeNode(createAABB(-10000, -10000, 10000, 10000), 0);
  }
}
