import rough from 'roughjs';
import { RoughCanvas } from 'roughjs/bin/canvas';
import {
  AABB,
  CanvasElement,
  getElementBounds,
  LOD_THRESHOLD_SIMPLIFY,
  PAPER_COLORS,
  PaperColor,
  PaperStyle,
  Point,
  ShapeElement,
  StrokeElement,
  UserPresence,
} from '@collabcanvas/shared';
import { getFreehandOutline, renderStrokePath } from './freehand.js';
import { RulerState, ProtractorState } from '@collabcanvas/shared';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  overlayCtx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  panX: number;
  panY: number;
  zoom: number;
  paperStyle: PaperStyle;
  paperColor: PaperColor;
  isDark: boolean;
  selectedIds: string[];
  remotePresences: UserPresence[];
  activeStroke: { points: Point[]; tool: 'pen' | 'pencil' | 'highlighter'; color: string; size: number } | null;
  activeShapePreview: ShapeElement | null;
  activeLassoPoints: Point[] | null;
  ruler: RulerState;
  protractor: ProtractorState;
}

export class CanvasRenderer {
  private roughCanvas: RoughCanvas | null = null;
  private shapeCache = new Map<string, any>();

  public render(elements: CanvasElement[], rc: RenderContext): void {
    const { ctx, overlayCtx, width, height, dpr, panX, panY, zoom } = rc;

    // Initialize RoughCanvas on base ctx
    if (!this.roughCanvas || (this.roughCanvas as any).canvas !== ctx.canvas) {
      this.roughCanvas = rough.canvas(ctx.canvas);
    }

    // 1. Clear both canvases
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width * dpr, height * dpr);

    overlayCtx.save();
    overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    overlayCtx.clearRect(0, 0, width * dpr, height * dpr);

    // Apply DPR
    ctx.scale(dpr, dpr);
    overlayCtx.scale(dpr, dpr);

    // 2. Render Paper Background (Blank, Ruled, Grid)
    this.renderPaperBackground(ctx, rc);

    // 3. Setup World Transform for Base Canvas
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Render Scene Elements
    this.renderElements(ctx, elements, rc);

    // In-progress stroke or shape on base/overlay
    if (rc.activeStroke) {
      this.renderLiveStroke(ctx, rc.activeStroke);
    }
    if (rc.activeShapePreview) {
      this.renderShape(ctx, rc.activeShapePreview, rc.zoom);
    }

    ctx.restore(); // restore world transform
    ctx.restore(); // restore dpr

    // 4. Render Ephemeral Overlays (Lasso, Cursors, Selection Handles, Ruler, Protractor)
    overlayCtx.save();
    overlayCtx.translate(panX, panY);
    overlayCtx.scale(zoom, zoom);

    // World-space overlays
    this.renderSelectionBoxes(overlayCtx, elements, rc);
    this.renderLasso(overlayCtx, rc.activeLassoPoints);
    this.renderRuler(overlayCtx, rc.ruler, zoom);
    this.renderProtractor(overlayCtx, rc.protractor, zoom);
    this.renderRemotePresences(overlayCtx, rc.remotePresences, zoom);

    overlayCtx.restore();
    overlayCtx.restore();
  }

  /**
   * Render infinite paper background: blank, ruled lines, or grid lines
   */
  private renderPaperBackground(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
    const { width, height, panX, panY, zoom, paperColor, paperStyle, isDark } = rc;

    // Fill background color
    const bgColor = isDark
      ? (paperColor === 'white' ? '#18181B' : PAPER_COLORS[paperColor])
      : PAPER_COLORS[paperColor];
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    if (paperStyle === 'blank') return;

    // Line styles
    const lineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(37, 99, 235, 0.15)';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    let spacing = 28; // default college ruled
    if (paperStyle === 'ruled-narrow') spacing = 22;
    if (paperStyle === 'ruled-wide') spacing = 34;
    if (paperStyle === 'grid-small') spacing = 20;
    if (paperStyle === 'grid-medium') spacing = 30;
    if (paperStyle === 'grid-large') spacing = 45;

    const scaledSpacing = spacing * zoom;
    if (scaledSpacing < 8) return; // don't render ultra-dense grids

    const startX = panX % scaledSpacing;
    const startY = panY % scaledSpacing;

    ctx.beginPath();

    // Horizontal lines (for both ruled and grid)
    for (let y = startY; y <= height; y += scaledSpacing) {
      ctx.moveTo(0, Math.floor(y) + 0.5);
      ctx.lineTo(width, Math.floor(y) + 0.5);
    }

    // Vertical lines (for grid only)
    if (paperStyle.startsWith('grid')) {
      for (let x = startX; x <= width; x += scaledSpacing) {
        ctx.moveTo(Math.floor(x) + 0.5, 0);
        ctx.lineTo(Math.floor(x) + 0.5, height);
      }
    }

    ctx.stroke();

    // College / Narrow ruled margin line (OneNote signature vertical pink/red margin line)
    if (paperStyle.startsWith('ruled')) {
      const marginWorldX = 80;
      const marginScreenX = marginWorldX * zoom + panX;
      if (marginScreenX >= 0 && marginScreenX <= width) {
        ctx.strokeStyle = isDark ? 'rgba(244, 63, 94, 0.3)' : 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.floor(marginScreenX) + 0.5, 0);
        ctx.lineTo(Math.floor(marginScreenX) + 0.5, height);
        ctx.stroke();
      }
    }
  }

  /**
   * Render visible elements
   */
  private renderElements(
    ctx: CanvasRenderingContext2D,
    elements: CanvasElement[],
    rc: RenderContext
  ): void {
    // Separate highlighters to render with multiply blend mode
    const highlighters: StrokeElement[] = [];
    const regularItems: CanvasElement[] = [];

    for (const el of elements) {
      if (el.type === 'stroke' && el.tool === 'highlighter') {
        highlighters.push(el);
      } else {
        regularItems.push(el);
      }
    }

    // Render highlighters first (semi-transparent multiply blend)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (const stroke of highlighters) {
      this.renderStroke(ctx, stroke, rc.zoom);
    }
    ctx.restore();

    // Render regular items
    for (const el of regularItems) {
      switch (el.type) {
        case 'stroke':
          this.renderStroke(ctx, el, rc.zoom);
          break;
        case 'shape':
          this.renderShape(ctx, el, rc.zoom);
          break;
        case 'sticky':
          this.renderStickyPlaceholder(ctx, el);
          break;
        case 'text':
          this.renderTextPlaceholder(ctx, el);
          break;
        case 'table':
          this.renderTablePlaceholder(ctx, el);
          break;
        case 'equation':
          this.renderEquationPlaceholder(ctx, el);
          break;
        case 'media':
          this.renderMediaPlaceholder(ctx, el);
          break;
        case 'tag':
          this.renderTagPlaceholder(ctx, el);
          break;
      }
    }
  }

  private renderStroke(ctx: CanvasRenderingContext2D, stroke: StrokeElement, zoom: number): void {
    ctx.save();
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = stroke.opacity ?? 1.0;

    // Level-of-Detail (LOD): simplify points if far zoomed out
    let points = stroke.points;
    if (zoom < LOD_THRESHOLD_SIMPLIFY && points.length > 10) {
      points = points.filter((_, idx) => idx % 3 === 0);
    }

    const outline = getFreehandOutline(points, stroke.tool, stroke.size);
    renderStrokePath(ctx, outline);
    ctx.restore();
  }

  private renderLiveStroke(
    ctx: CanvasRenderingContext2D,
    stroke: { points: Point[]; tool: 'pen' | 'pencil' | 'highlighter'; color: string; size: number }
  ): void {
    ctx.save();
    ctx.fillStyle = stroke.color;
    if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.5;
    }
    const outline = getFreehandOutline(stroke.points, stroke.tool, stroke.size);
    renderStrokePath(ctx, outline);
    ctx.restore();
  }

  private getDeterministicSeed(id: string): number {
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) || 1;
  }

  private renderShape(ctx: CanvasRenderingContext2D, shape: ShapeElement, _zoom: number): void {
    if (!this.roughCanvas) return;
    const rc = this.roughCanvas;

    const seed = this.getDeterministicSeed(shape.id);
    const options = {
      stroke: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      fill: shape.fillColor !== 'transparent' ? shape.fillColor : undefined,
      fillStyle: 'solid',
      roughness: shape.roughness,
      seed,
      disableMultiStroke: shape.roughness === 0,
    };

    const { x, y, width, height, shapeType } = shape;

    switch (shapeType) {
      case 'rectangle':
        rc.rectangle(x, y, width, height, options);
        break;

      case 'ellipse':
        rc.ellipse(x + width / 2, y + height / 2, Math.abs(width), Math.abs(height), options);
        break;

      case 'line':
        rc.line(x, y, x + width, y + height, options);
        break;

      case 'arrow':
        this.renderArrow(rc, x, y, x + width, y + height, options);
        break;

      case 'double_arrow':
        this.renderDoubleArrow(rc, x, y, x + width, y + height, options);
        break;

      case 'triangle':
        rc.polygon(
          [
            [x + width / 2, y],
            [x + width, y + height],
            [x, y + height],
          ],
          options
        );
        break;

      case 'right_triangle':
        rc.polygon(
          [
            [x, y],
            [x + width, y + height],
            [x, y + height],
          ],
          options
        );
        break;

      case 'diamond':
        rc.polygon(
          [
            [x + width / 2, y],
            [x + width, y + height / 2],
            [x + width / 2, y + height],
            [x, y + height / 2],
          ],
          options
        );
        break;

      case 'parallelogram':
        const offset = width * 0.25;
        rc.polygon(
          [
            [x + offset, y],
            [x + width, y],
            [x + width - offset, y + height],
            [x, y + height],
          ],
          options
        );
        break;

      case 'trapezoid':
        const tOffset = width * 0.2;
        rc.polygon(
          [
            [x + tOffset, y],
            [x + width - tOffset, y],
            [x + width, y + height],
            [x, y + height],
          ],
          options
        );
        break;

      case 'pentagon':
        this.renderRegularPolygon(rc, x + width / 2, y + height / 2, Math.min(width, height) / 2, 5, options);
        break;

      case 'hexagon':
        this.renderRegularPolygon(rc, x + width / 2, y + height / 2, Math.min(width, height) / 2, 6, options);
        break;

      case 'star':
        this.renderStar(rc, x + width / 2, y + height / 2, Math.min(width, height) / 2, options);
        break;

      case 'cube':
        this.render3DCube(rc, x, y, width, height, options);
        break;

      case 'cylinder':
        this.renderCylinder(rc, x, y, width, height, options);
        break;

      case 'cone':
        this.renderCone(rc, x, y, width, height, options);
        break;

      case 'graph_axes':
        this.renderGraphAxes(rc, x, y, width, height, options);
        break;

      default:
        rc.rectangle(x, y, width, height, options);
    }
  }

  // --- Specialized 2D and 3D Shapes ---

  private renderArrow(rc: RoughCanvas, x1: number, y1: number, x2: number, y2: number, options: any): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;

    rc.line(x1, y1, x2, y2, options);
    const angle = Math.atan2(dy, dx);
    const headLen = Math.min(dist * 0.4, Math.max(16, (options.strokeWidth || 2) * 4));
    const seed = options.seed || 1;

    rc.line(
      x2,
      y2,
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6),
      { ...options, seed: seed + 10 }
    );
    rc.line(
      x2,
      y2,
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6),
      { ...options, seed: seed + 20 }
    );
  }

  private renderDoubleArrow(rc: RoughCanvas, x1: number, y1: number, x2: number, y2: number, options: any): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    rc.line(x1, y1, x2, y2, options);
    const angle = Math.atan2(dy, dx);
    const headLen = Math.min(dist * 0.35, Math.max(16, (options.strokeWidth || 2) * 4));
    const seed = options.seed || 1;

    // End Arrowhead
    rc.line(
      x2,
      y2,
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6),
      { ...options, seed: seed + 10 }
    );
    rc.line(
      x2,
      y2,
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6),
      { ...options, seed: seed + 20 }
    );

    // Start Arrowhead
    rc.line(
      x1,
      y1,
      x1 + headLen * Math.cos(angle - Math.PI / 6),
      y1 + headLen * Math.sin(angle - Math.PI / 6),
      { ...options, seed: seed + 30 }
    );
    rc.line(
      x1,
      y1,
      x1 + headLen * Math.cos(angle + Math.PI / 6),
      y1 + headLen * Math.sin(angle + Math.PI / 6),
      { ...options, seed: seed + 40 }
    );
  }

  private renderRegularPolygon(rc: RoughCanvas, cx: number, cy: number, r: number, sides: number, options: any): void {
    const points: [number, number][] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i * 2 * Math.PI) / sides - Math.PI / 2;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    rc.polygon(points, options);
  }

  private renderStar(rc: RoughCanvas, cx: number, cy: number, r: number, options: any): void {
    const points: [number, number][] = [];
    const innerR = r * 0.45;
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? r : innerR;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      points.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
    rc.polygon(points, options);
  }

  private render3DCube(rc: RoughCanvas, x: number, y: number, w: number, h: number, options: any): void {
    const d = Math.min(w, h) * 0.35;
    // Front face
    rc.rectangle(x, y + d, w - d, h - d, options);
    // Back face lines
    rc.rectangle(x + d, y, w - d, h - d, options);
    // Connect corners
    rc.line(x, y + d, x + d, y, options);
    rc.line(x + w - d, y + d, x + w, y, options);
    rc.line(x, y + h, x + d, y + h - d, options);
    rc.line(x + w - d, y + h, x + w, y + h - d, options);
  }

  private renderCylinder(rc: RoughCanvas, x: number, y: number, w: number, h: number, options: any): void {
    const ry = Math.min(h * 0.2, 25);
    // Top ellipse
    rc.ellipse(x + w / 2, y + ry, w, ry * 2, options);
    // Bottom ellipse
    rc.ellipse(x + w / 2, y + h - ry, w, ry * 2, options);
    // Side lines
    rc.line(x, y + ry, x, y + h - ry, options);
    rc.line(x + w, y + ry, x + w, y + h - ry, options);
  }

  private renderCone(rc: RoughCanvas, x: number, y: number, w: number, h: number, options: any): void {
    const ry = Math.min(h * 0.15, 20);
    // Base ellipse
    rc.ellipse(x + w / 2, y + h - ry, w, ry * 2, options);
    // Apex sides
    rc.line(x + w / 2, y, x, y + h - ry, options);
    rc.line(x + w / 2, y, x + w, y + h - ry, options);
  }

  private renderGraphAxes(rc: RoughCanvas, x: number, y: number, w: number, h: number, options: any): void {
    // X and Y axes with arrowheads
    const originY = y + h;
    const originX = x;
    this.renderArrow(rc, originX, originY, originX + w, originY, options); // X axis
    this.renderArrow(rc, originX, originY, originX, y, options); // Y axis
  }

  // --- Placeholders for DOM Overlay Elements ---

  private renderStickyPlaceholder(ctx: CanvasRenderingContext2D, el: any): void {
    ctx.save();
    ctx.fillStyle = el.color || '#FEF08A';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillRect(el.x, el.y, el.width, el.height);
    ctx.restore();
  }

  private renderTextPlaceholder(ctx: CanvasRenderingContext2D, el: any): void {
    // Text is mounted as interactive DOM overlay, canvas renders transparent box
  }

  private renderTablePlaceholder(ctx: CanvasRenderingContext2D, el: any): void {
    // Table is mounted as interactive DOM overlay
  }

  private renderEquationPlaceholder(ctx: CanvasRenderingContext2D, el: any): void {
    // Equation is mounted as interactive DOM overlay
  }

  private renderMediaPlaceholder(ctx: CanvasRenderingContext2D, el: any): void {
    // Media is mounted as interactive DOM overlay
  }

  private renderTagPlaceholder(ctx: CanvasRenderingContext2D, el: any): void {
    // Tag is mounted as interactive DOM overlay
  }

  // --- Ephemeral Overlays (Lasso, Selection, Cursors, Ruler) ---

  private renderSelectionBoxes(
    ctx: CanvasRenderingContext2D,
    elements: CanvasElement[],
    rc: RenderContext
  ): void {
    if (rc.selectedIds.length === 0) return;

    for (const id of rc.selectedIds) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;

      const b = getElementBounds(el);
      const pad = 4;

      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.5 / rc.zoom;
      ctx.setLineDash([4 / rc.zoom, 3 / rc.zoom]);
      ctx.strokeRect(b.minX - pad, b.minY - pad, b.maxX - b.minX + pad * 2, b.maxY - b.minY + pad * 2);

      // Render 8 control handles
      const handleSize = 8 / rc.zoom;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#2563EB';
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5 / rc.zoom;

      const corners = [
        [b.minX - pad, b.minY - pad],
        [b.maxX + pad, b.minY - pad],
        [b.minX - pad, b.maxY + pad],
        [b.maxX + pad, b.maxY + pad],
        [(b.minX + b.maxX) / 2, b.minY - pad],
        [(b.minX + b.maxX) / 2, b.maxY + pad],
        [b.minX - pad, (b.minY + b.maxY) / 2],
        [b.maxX + pad, (b.minY + b.maxY) / 2],
      ];

      for (const [hx, hy] of corners) {
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      }

      ctx.restore();
    }
  }

  private renderLasso(ctx: CanvasRenderingContext2D, points: Point[] | null): void {
    if (!points || points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private renderRuler(ctx: CanvasRenderingContext2D, ruler: RulerState, zoom: number): void {
    if (!ruler.visible) return;

    ctx.save();
    ctx.translate(ruler.x, ruler.y);
    ctx.rotate((ruler.angleDeg * Math.PI) / 180);

    // Semi-transparent acrylic ruler body
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    ctx.fillRect(0, 0, ruler.length, ruler.width);

    // Border
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, ruler.length, ruler.width);

    // Tick marks along top edge
    ctx.strokeStyle = '#334155';
    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';

    const tickInterval = 10;
    for (let x = 0; x <= ruler.length; x += tickInterval) {
      const isMajor = x % 50 === 0;
      const isMedium = x % 25 === 0;
      const tickH = isMajor ? 16 : isMedium ? 10 : 6;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tickH);
      ctx.stroke();

      if (isMajor && x > 0 && x < ruler.length) {
        ctx.fillText(`${x / 10}`, x - 4, tickH + 12);
      }
    }

    // Angle indicator in center
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${Math.round(ruler.angleDeg)}°`, ruler.length / 2 - 12, ruler.width / 2 + 4);

    ctx.restore();
  }

  private renderProtractor(ctx: CanvasRenderingContext2D, protractor: ProtractorState, _zoom: number): void {
    if (!protractor.visible) return;

    ctx.save();
    ctx.translate(protractor.x, protractor.y);

    // Semi-transparent circular protractor body
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, protractor.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Degree markings
    ctx.strokeStyle = '#475569';
    ctx.fillStyle = '#334155';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';

    for (let deg = 0; deg < 360; deg += 10) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 30 === 0;
      const tickLen = isMajor ? 14 : 7;

      const x1 = Math.cos(rad) * (protractor.radius - tickLen);
      const y1 = Math.sin(rad) * (protractor.radius - tickLen);
      const x2 = Math.cos(rad) * protractor.radius;
      const y2 = Math.sin(rad) * protractor.radius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (isMajor) {
        const textX = Math.cos(rad) * (protractor.radius - 22);
        const textY = Math.sin(rad) * (protractor.radius - 22) + 3;
        ctx.fillText(`${deg}°`, textX, textY);
      }
    }

    // Crosshair in center
    ctx.strokeStyle = '#2563EB';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.stroke();

    ctx.restore();
  }

  private renderRemotePresences(
    ctx: CanvasRenderingContext2D,
    presences: UserPresence[],
    _zoom: number
  ): void {
    for (const p of presences) {
      if (!p.cursor) continue;

      const { x, y } = p.cursor;
      ctx.save();
      ctx.translate(x, y);

      // SVG mouse cursor icon
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 16);
      ctx.lineTo(4, 12);
      ctx.lineTo(10, 18);
      ctx.lineTo(13, 15);
      ctx.lineTo(7, 9);
      ctx.lineTo(12, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Username badge
      ctx.font = '11px sans-serif';
      const text = p.username || 'User';
      const textWidth = ctx.measureText(text).width;
      const badgeW = textWidth + 12;
      const badgeH = 18;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(14, 12, badgeW, badgeH, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, 20, 25);

      ctx.restore();
    }
  }
}

export const canvasRenderer = new CanvasRenderer();
