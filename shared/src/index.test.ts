import test from 'node:test';
import assert from 'node:assert';
import {
  generateKeyBetween,
  generateNKeysBetween,
  compareKeys,
} from './indexing/fractional.js';
import { Quadtree } from './indexing/quadtree.js';
import { createAABB, pointInPolygon, lassoSelectsElement } from './geometry/bounds.js';
import { recognizeStroke } from './geometry/ink-to-shape.js';
import { snapToRuler } from './geometry/ruler.js';
import { CanvasElement, StrokeElement } from './types/index.js';

test('Fractional Indexing: generates keys in strictly increasing order', () => {
  const k1 = generateKeyBetween(null, null); // 'a0'
  const k2 = generateKeyBetween(k1, null);
  const k0 = generateKeyBetween(null, k1);
  const kMid = generateKeyBetween(k1, k2);

  assert.ok(compareKeys(k0, k1) < 0, `Expected ${k0} < ${k1}`);
  assert.ok(compareKeys(k1, kMid) < 0, `Expected ${k1} < ${kMid}`);
  assert.ok(compareKeys(kMid, k2) < 0, `Expected ${kMid} < ${k2}`);

  const multi = generateNKeysBetween('a0', 'a5', 3);
  assert.strictEqual(multi.length, 3);
  for (let i = 0; i < multi.length - 1; i++) {
    assert.ok(compareKeys(multi[i], multi[i + 1]) < 0);
  }
});

test('Quadtree: expands dynamically and retrieves visible elements with culling', () => {
  const tree = new Quadtree(createAABB(-100, -100, 100, 100));

  const el1: CanvasElement = {
    id: 'shape-1',
    type: 'shape',
    shapeType: 'rectangle',
    x: 10,
    y: 10,
    width: 50,
    height: 50,
    strokeColor: '#000',
    fillColor: '#fff',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    zIndex: 'a0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Test unbounded coordinate expansion (far off at 25000, 25000)
  const elFar: CanvasElement = {
    id: 'shape-far',
    type: 'shape',
    shapeType: 'rectangle',
    x: 25000,
    y: 25000,
    width: 100,
    height: 100,
    strokeColor: '#000',
    fillColor: '#fff',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    zIndex: 'a1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  tree.insert(el1);
  tree.insert(elFar);

  assert.strictEqual(tree.size, 2);

  // Query viewport near origin
  const visibleNearOrigin = tree.query(createAABB(0, 0, 100, 100));
  assert.strictEqual(visibleNearOrigin.length, 1);
  assert.strictEqual(visibleNearOrigin[0].id, 'shape-1');

  // Query viewport far away
  const visibleFar = tree.query(createAABB(24000, 24000, 26000, 26000));
  assert.strictEqual(visibleFar.length, 1);
  assert.strictEqual(visibleFar[0].id, 'shape-far');

  // Query somewhere with no elements
  const visibleEmpty = tree.query(createAABB(-5000, -5000, -4000, -4000));
  assert.strictEqual(visibleEmpty.length, 0);

  // Remove el1
  tree.remove('shape-1');
  assert.strictEqual(tree.size, 1);
  assert.strictEqual(tree.query(createAABB(0, 0, 100, 100)).length, 0);
});

test('Geometry: Point-in-polygon and lasso detection', () => {
  const polygon = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  assert.ok(pointInPolygon({ x: 50, y: 50 }, polygon));
  assert.ok(!pointInPolygon({ x: 150, y: 50 }, polygon));

  const strokeIn: StrokeElement = {
    id: 's1',
    type: 'stroke',
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [{ x: 40, y: 40 }, { x: 60, y: 60 }],
    bounds: createAABB(40, 40, 60, 60),
    zIndex: 'a0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  assert.ok(lassoSelectsElement(polygon, strokeIn));
});

test('Ink-to-Shape: detects straight lines and circles', () => {
  // Line points
  const linePoints = [
    { x: 10, y: 10 },
    { x: 30, y: 30 },
    { x: 60, y: 60 },
    { x: 100, y: 100 },
  ];
  const detectedLine = recognizeStroke(linePoints);
  assert.ok(detectedLine !== null);
  assert.strictEqual(detectedLine?.shapeType, 'line');

  // Circle points
  const circlePoints: { x: number; y: number }[] = [];
  const cx = 100, cy = 100, r = 40;
  for (let deg = 0; deg <= 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    circlePoints.push({
      x: cx + Math.cos(rad) * r + (Math.random() * 2 - 1),
      y: cy + Math.sin(rad) * r + (Math.random() * 2 - 1),
    });
  }
  const detectedCircle = recognizeStroke(circlePoints);
  assert.ok(detectedCircle !== null);
  assert.strictEqual(detectedCircle?.shapeType, 'ellipse');
});

test('Ruler: snaps points within threshold to straight edge', () => {
  const ruler = {
    x: 0,
    y: 100,
    length: 500,
    width: 60,
    angleDeg: 0, // Horizontal along y=100
    visible: true,
  };

  const snapped = snapToRuler({ x: 50, y: 105 }, ruler, 20);
  assert.ok(snapped !== null);
  assert.strictEqual(snapped?.y, 100);
  assert.strictEqual(snapped?.x, 50);

  // Far point doesn't snap
  const noSnap = snapToRuler({ x: 50, y: 250 }, ruler, 20);
  assert.strictEqual(noSnap, null);
});
