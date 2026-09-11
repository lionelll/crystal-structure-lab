import * as THREE from 'three';

export function createTextSprite(text: string, color = '#ffffff', size = 36) {
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d')!;
  measure.font = `700 ${size}px Inter, system-ui, sans-serif`;
  const padding = 28;
  canvas.width = Math.max(128, Math.min(1024, Math.ceil(measure.measureText(text).width + padding * 2)));
  canvas.height = Math.max(72, Math.ceil(size * 2.2));
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set((canvas.width / canvas.height) * 0.3, 0.3, 1);
  return sprite;
}
