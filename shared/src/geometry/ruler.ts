/**
 * Ruler and Protractor Math & Inking Snapping
 */

import { Point } from '../types/index.js';

export interface RulerState {
  x: number;
  y: number;
  length: number;
  width: number;
  angleDeg: number;
  visible: boolean;
}

export interface ProtractorState {
  x: number;
  y: number;
  radius: number;
  angleDeg: number;
  visible: boolean;
}

/**
 * Snap point to ruler straight edge if within snapDistance
 */
export function snapToRuler(
  point: Point,
  ruler: RulerState,
  snapDistance: number = 24
): Point | null {
  if (!ruler.visible) return null;

  const rad = (ruler.angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Ruler has two main drawing edges: Top edge and Bottom edge
  // Top edge starts at ruler (x, y) extending along angle by length
  const p0 = { x: ruler.x, y: ruler.y };
  const p1 = { x: ruler.x + cos * ruler.length, y: ruler.y + sin * ruler.length };

  const distToEdge = distanceToSegment(point, p0, p1);
  if (distToEdge <= snapDistance) {
    return projectToSegment(point, p0, p1);
  }

  // Bottom edge offset by perpendicular vector
  const perpX = -sin * ruler.width;
  const perpY = cos * ruler.width;
  const b0 = { x: p0.x + perpX, y: p0.y + perpY };
  const b1 = { x: p1.x + perpX, y: p1.y + perpY };

  const distToBottom = distanceToSegment(point, b0, b1);
  if (distToBottom <= snapDistance) {
    return projectToSegment(point, b0, b1);
  }

  return null;
}

/**
 * Snap point to protractor circular arc or angle rays
 */
export function snapToProtractor(
  point: Point,
  protractor: ProtractorState,
  snapDistance: number = 24
): Point | null {
  if (!protractor.visible) return null;

  const dx = point.x - protractor.x;
  const dy = point.y - protractor.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Check if near circular arc rim
  if (Math.abs(dist - protractor.radius) <= snapDistance) {
    const angle = Math.atan2(dy, dx);
    return {
      x: protractor.x + Math.cos(angle) * protractor.radius,
      y: protractor.y + Math.sin(angle) * protractor.radius,
      pressure: point.pressure,
      time: point.time,
    };
  }

  return null;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const proj = projectToSegment(p, a, b);
  const dx = p.x - proj.x;
  const dy = p.y - proj.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function projectToSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) return { ...a, pressure: p.pressure, time: p.time };

  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: a.x + t * abx,
    y: a.y + t * aby,
    pressure: p.pressure,
    time: p.time,
  };
}
