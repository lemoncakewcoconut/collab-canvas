import {
  AABB,
  CanvasElement,
  createAABB,
  DEFAULT_ZOOM,
  getElementBounds,
  MAX_ZOOM,
  MIN_ZOOM,
  Point,
  VIEWPORT_CULLING_MARGIN,
} from '@collabcanvas/shared';

export function screenToWorld(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number
): Point {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  panX: number,
  panY: number,
  zoom: number
): Point {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  };
}

/**
 * Zoom centered on pointer position (e.g. mouse wheel or pinch gesture)
 */
export function zoomAroundPoint(
  currentZoom: number,
  zoomFactor: number,
  screenPos: Point,
  currentPan: { x: number; y: number }
): { zoom: number; panX: number; panY: number } {
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * zoomFactor));
  const worldPoint = screenToWorld(screenPos.x, screenPos.y, currentPan.x, currentPan.y, currentZoom);

  const newPanX = screenPos.x - worldPoint.x * newZoom;
  const newPanY = screenPos.y - worldPoint.y * newZoom;

  return {
    zoom: newZoom,
    panX: newPanX,
    panY: newPanY,
  };
}

/**
 * Get the visible world bounding box with extra culling margin
 */
export function getVisibleWorldBounds(
  panX: number,
  panY: number,
  zoom: number,
  screenWidth: number,
  screenHeight: number,
  margin: number = VIEWPORT_CULLING_MARGIN
): AABB {
  const topLeft = screenToWorld(-margin, -margin, panX, panY, zoom);
  const bottomRight = screenToWorld(screenWidth + margin, screenHeight + margin, panX, panY, zoom);

  return createAABB(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y);
}

/**
 * Zoom to fit all canvas content
 */
export function zoomToFitContent(
  elements: CanvasElement[],
  screenWidth: number,
  screenHeight: number,
  topOffset: number = 130
): { panX: number; panY: number; zoom: number } {
  const effectiveHeight = Math.max(200, screenHeight - topOffset);
  if (elements.length === 0) {
    return { panX: screenWidth / 2, panY: topOffset + effectiveHeight / 2, zoom: DEFAULT_ZOOM };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  const contentWidth = Math.max(50, maxX - minX);
  const contentHeight = Math.max(50, maxY - minY);
  const padding = 60;

  const scaleX = (screenWidth - padding * 2) / contentWidth;
  const scaleY = (effectiveHeight - padding * 2) / contentHeight;
  const zoom = Math.min(1.0, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const panX = screenWidth / 2 - centerX * zoom;
  const panY = topOffset + effectiveHeight / 2 - centerY * zoom;

  return { panX, panY, zoom };
}
