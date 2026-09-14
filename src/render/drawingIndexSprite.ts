import * as THREE from 'three';
import { drawingIndexTokens, type DrawingMode, type Point3 } from '../core/crystalDrawing';

interface IndexRun {
  text: string;
  x: number;
  width: number;
  negative: boolean;
}

export function layoutDrawingIndex(
  mode: DrawingMode,
  indices: Point3,
  measure: (text: string) => number,
) {
  const open = mode === 'plane' ? '(' : '[';
  const close = mode === 'plane' ? ')' : ']';
  const separator = indices.some((value) => Math.abs(value) > 9) ? ' ' : '';
  const entries = [
    { text: open, negative: false },
    ...drawingIndexTokens(indices).flatMap((token, index) => index === 0
      ? [token]
      : [{ text: separator, negative: false }, token]),
    { text: close, negative: false },
  ];
  let x = 0;
  const runs: IndexRun[] = entries.map((entry) => {
    const width = measure(entry.text);
    const run = { ...entry, x, width };
    x += width;
    return run;
  });
  return { runs, width: x };
}

export function createDrawingIndexSprite(mode: DrawingMode, indices: Point3, color = '#ffffff', size = 40) {
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d')!;
  const font = `700 ${size}px Inter, system-ui, sans-serif`;
  measure.font = font;
  const padding = 28;
  const layout = layoutDrawingIndex(mode, indices, (text) => measure.measureText(text).width);
  canvas.width = Math.max(128, Math.min(1024, Math.ceil(layout.width + padding * 2)));
  canvas.height = Math.max(72, Math.ceil(size * 2.2));

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  const startX = (canvas.width - layout.width) / 2;
  const baseline = canvas.height / 2;
  for (const run of layout.runs) {
    const x = startX + run.x;
    ctx.fillText(run.text, x, baseline);
    if (!run.negative || run.width === 0) continue;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size / 18);
    ctx.lineCap = 'butt';
    const inset = Math.min(1.5, run.width * 0.06);
    const y = baseline - size * 0.52;
    ctx.beginPath();
    ctx.moveTo(x + inset, y);
    ctx.lineTo(x + run.width - inset, y);
    ctx.stroke();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set((canvas.width / canvas.height) * 0.3, 0.3, 1);
  return sprite;
}
