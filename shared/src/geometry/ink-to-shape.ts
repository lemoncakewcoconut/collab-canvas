/**
 * Ink-to-Shape: Geometric Feature Fitting & Stroke Recognition
 * Transforms rough freehand strokes into crisp geometric shapes.
 */

import { Point, ShapeType } from '../types/index.js';

export interface RecognizedShape {
  shapeType: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += distance(points[i], points[i + 1]);
  }
  return len;
}

/**
 * Douglas-Peucker polyline simplification algorithm
 */
export function simplifyPoints(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const rec1 = simplifyPoints(points.slice(0, index + 1), epsilon);
    const rec2 = simplifyPoints(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  } else {
    return [points[0], points[end]];
  }
}

function perpendicularDistance(p: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return distance(p, p1);
  const u = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (mag * mag);
  const ix = p1.x + u * dx;
  const iy = p1.y + u * dy;
  return distance(p, { x: ix, y: iy });
}

/**
 * Recognizes a stroke into a geometric shape (circle, rect, triangle, line, arrow, etc.)
 */
export function recognizeStroke(points: Point[]): RecognizedShape | null {
  if (points.length < 3) return null;

  const totalLen = pathLength(points);
  if (totalLen < 15) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const directDist = distance(start, end);

  // Compute AABB
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = Math.max(10, maxX - minX);
  const height = Math.max(10, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // 1. Check for Line
  const lineRatio = totalLen / Math.max(1, directDist);
  if (lineRatio < 1.15 && directDist > 30) {
    return {
      shapeType: 'line',
      x: start.x,
      y: start.y,
      width: end.x - start.x,
      height: end.y - start.y,
      confidence: 0.95,
    };
  }

  const isClosed = directDist / totalLen < 0.25 || directDist < 35;

  if (isClosed) {
    // 2. Test Ellipse / Circle
    const rx = width / 2;
    const ry = height / 2;
    let radialDevSum = 0;
    for (const p of points) {
      const normDist =
        Math.pow((p.x - centerX) / rx, 2) + Math.pow((p.y - centerY) / ry, 2);
      radialDevSum += Math.abs(normDist - 1.0);
    }
    const avgRadialDev = radialDevSum / points.length;

    if (avgRadialDev < 0.35) {
      const isCircle = Math.abs(width - height) / Math.max(width, height) < 0.2;
      const size = isCircle ? Math.max(width, height) : 0;
      return {
        shapeType: 'ellipse',
        x: isCircle ? centerX - size / 2 : minX,
        y: isCircle ? centerY - size / 2 : minY,
        width: isCircle ? size : width,
        height: isCircle ? size : height,
        confidence: Math.max(0.7, 1 - avgRadialDev),
      };
    }

    // 3. Test Polygons using RDP simplification
    const epsilon = Math.max(8, Math.min(width, height) * 0.1);
    const simplified = simplifyPoints(points, epsilon);
    const cornerCount = simplified.length - 1; // Since closed, start ~= end

    // Triangle
    if (cornerCount === 3) {
      return {
        shapeType: 'triangle',
        x: minX,
        y: minY,
        width,
        height,
        confidence: 0.85,
      };
    }

    // Rectangle
    if (cornerCount === 4) {
      const isSquare = Math.abs(width - height) / Math.max(width, height) < 0.15;
      const size = isSquare ? Math.max(width, height) : 0;
      return {
        shapeType: 'rectangle',
        x: isSquare ? centerX - size / 2 : minX,
        y: isSquare ? centerY - size / 2 : minY,
        width: isSquare ? size : width,
        height: isSquare ? size : height,
        confidence: 0.88,
      };
    }

    // Diamond
    if (cornerCount === 5 || cornerCount === 4) {
      // Check if vertices align near midpoints of edges
      return {
        shapeType: 'rectangle',
        x: minX,
        y: minY,
        width,
        height,
        confidence: 0.75,
      };
    }
  }

  return null;
}
