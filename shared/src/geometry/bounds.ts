/**
 * Geometry & AABB Bounding Box Calculations
 */

import { AABB, CanvasElement, Point } from '../types/index.js';

export function createAABB(minX: number, minY: number, maxX: number, maxY: number): AABB {
  return {
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
  };
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

export function aabbContains(container: AABB, target: AABB): boolean {
  return (
    container.minX <= target.minX &&
    container.minY <= target.minY &&
    container.maxX >= target.maxX &&
    container.maxY >= target.maxY
  );
}

export function pointInAABB(p: Point, box: AABB): boolean {
  return (
    p.x >= box.minX &&
    p.x <= box.maxX &&
    p.y >= box.minY &&
    p.y <= box.maxY
  );
}

export function expandAABB(a: AABB, b: AABB): AABB {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function padAABB(box: AABB, padding: number): AABB {
  return {
    minX: box.minX - padding,
    minY: box.minY - padding,
    maxX: box.maxX + padding,
    maxY: box.maxY + padding,
  };
}

/**
 * Calculate accurate bounding box for any canvas element
 */
export function getElementBounds(element: CanvasElement): AABB {
  switch (element.type) {
    case 'stroke': {
      if (element.bounds) return element.bounds;
      if (!element.points || element.points.length === 0) {
        return createAABB(0, 0, 0, 0);
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of element.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = (element.size || 2) * 1.5;
      return createAABB(minX - pad, minY - pad, maxX + pad, maxY + pad);
    }

    case 'shape': {
      const pad = (element.strokeWidth || 1) / 2;
      return createAABB(
        element.x - pad,
        element.y - pad,
        element.x + element.width + pad,
        element.y + element.height + pad
      );
    }

    case 'text':
    case 'sticky':
    case 'equation':
    case 'media':
    case 'audio': {
      return createAABB(
        element.x,
        element.y,
        element.x + element.width,
        element.y + element.height
      );
    }

    case 'table': {
      const totalWidth = element.cellWidths?.reduce((a, b) => a + b, 0) || 300;
      const totalHeight = element.cellHeights?.reduce((a, b) => a + b, 0) || 150;
      return createAABB(
        element.x,
        element.y,
        element.x + totalWidth,
        element.y + totalHeight
      );
    }

    case 'tag': {
      return createAABB(element.x, element.y, element.x + 120, element.y + 32);
    }

    default:
      return createAABB(0, 0, 0, 0);
  }
}

/**
 * Raycasting Point-in-Polygon test (for Lasso selection)
 */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a polygon lasso selects an element AABB
 * Either any corner of AABB is inside polygon, or center is inside, or polygon points are inside AABB
 */
export function lassoSelectsElement(lassoPolygon: Point[], element: CanvasElement): boolean {
  const bounds = getElementBounds(element);

  // Check if center is in lasso
  const center: Point = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  if (pointInPolygon(center, lassoPolygon)) return true;

  // Check 4 corners
  const corners: Point[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  for (const c of corners) {
    if (pointInPolygon(c, lassoPolygon)) return true;
  }

  // Check if lasso points are inside element bounds
  for (const p of lassoPolygon) {
    if (pointInAABB(p, bounds)) return true;
  }

  return false;
}
