import { getStroke } from 'perfect-freehand';
import { Point } from '@collabcanvas/shared';

export interface StrokeOptions {
  size: number;
  thinning?: number;
  smoothing?: number;
  streamline?: number;
  easing?: (t: number) => number;
  start?: { taper: number | boolean; cap?: boolean };
  end?: { taper: number | boolean; cap?: boolean };
}

/**
 * Get stroke outline points using perfect-freehand configured for tool dynamics
 */
export function getFreehandOutline(
  points: Point[],
  tool: 'pen' | 'pencil' | 'highlighter',
  baseSize: number
): number[][] {
  let options: StrokeOptions;

  switch (tool) {
    case 'pen': // Ballpoint / Felt-tip
      options = {
        size: baseSize,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.55,
        start: { taper: 0, cap: true },
        end: { taper: 0, cap: true },
      };
      break;

    case 'pencil': // Texturized, sensitive pressure
      options = {
        size: baseSize,
        thinning: 0.75,
        smoothing: 0.35,
        streamline: 0.3,
        start: { taper: 5, cap: true },
        end: { taper: 5, cap: true },
      };
      break;

    case 'highlighter': // Uniform wide chisel stroke
      options = {
        size: baseSize,
        thinning: 0.0,
        smoothing: 0.5,
        streamline: 0.7,
        start: { taper: 0, cap: false },
        end: { taper: 0, cap: false },
      };
      break;
  }

  // perfect-freehand accepts [x, y, pressure]
  const inputPoints = points.map((p) => [p.x, p.y, p.pressure ?? 0.5]);
  return getStroke(inputPoints, options);
}

/**
 * Render outline polygon directly to Canvas 2D context
 */
export function renderStrokePath(ctx: CanvasRenderingContext2D, outline: number[][]): void {
  if (outline.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);

  for (let i = 1; i < outline.length - 1; i++) {
    const xc = (outline[i][0] + outline[i + 1][0]) / 2;
    const yc = (outline[i][1] + outline[i + 1][1]) / 2;
    ctx.quadraticCurveTo(outline[i][0], outline[i][1], xc, yc);
  }

  if (outline.length > 1) {
    const last = outline[outline.length - 1];
    ctx.lineTo(last[0], last[1]);
  }

  ctx.closePath();
  ctx.fill();
}
