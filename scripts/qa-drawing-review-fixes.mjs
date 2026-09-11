import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const url = process.env.QA_BASE_URL || 'http://127.0.0.1:5180/crystal/';
assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/crystal\/$/);
const production = process.env.QA_RENDER_HARNESS === '0';
const runName = process.env.QA_RUN_NAME || 'review-fixes';
assert.match(runName, /^[a-z0-9-]+$/);
const output = `docs/qa/crystal-drawing/${runName}${production ? '-build' : ''}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], failedRequests = [], checks = [];
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });
};
const draw = async (page, indices) => {
  for (let i = 0; i < 3; i++) await page.locator('.drawing-indices input').nth(i).fill(String(indices[i]));
  await page.getByRole('button', { name: '绘制', exact: true }).click();
};
const image = async (page) => Buffer.from(await page.locator('.three-mount canvas').evaluate((canvas) => canvas.toDataURL().split(',')[1]), 'base64');
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  let count = 0;
  // Match the existing drawing QA: wait for OrbitControls damping to converge.
  const tick = () => ++count === 500 ? resolve() : requestAnimationFrame(tick);
  requestAnimationFrame(tick);
}));
const difference = (a, b) => {
  const first = PNG.sync.read(a), second = PNG.sync.read(b);
  assert.equal(first.width, second.width);
  assert.equal(first.height, second.height);
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    if ([0, 1, 2].some((j) => Math.abs(first.data[i + j] - second.data[i + j]) > 5)) changed++;
  }
  return changed / (first.width * first.height);
};
const pixels = async (page) => {
  const png = PNG.sync.read(await image(page));
  let colored = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = png.data.subarray(i, i + 3);
    if (Math.max(r, g, b) > 65 && Math.max(r, g, b) - Math.min(r, g, b) > 25) colored++;
  }
  assert.ok(colored > 60, `Blank canvas: ${colored}`);
  return { width: png.width, height: png.height, colored };
};

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  watch(page);
  await page.goto(url);
  const paths = await page.locator('script[src],link[rel=stylesheet],link[rel=icon]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') || node.getAttribute('href')));
  assert.ok(paths.length >= 3 && paths.every((path) => path.startsWith('/crystal/')));
  for (const path of paths) assert.ok((await page.request.get(new URL(path, url).href)).ok());
  checks.push({ name: 'Subpath scripts, styles and icon requests', paths });
  await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  await draw(page, [1, 1, 1]);
  await settle(page);
  const initial = await image(page);
  await page.screenshot({ path: `${output}/desktop-plane.png` });
  const box = await page.locator('.three-mount canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.75, { steps: 18 });
  await page.mouse.up();
  await page.mouse.wheel(0, -220);
  await settle(page);
  const dragged = await image(page);
  assert.ok(difference(initial, dragged) > 0.001);
  await writeFile(`${output}/resize-before.png`, dragged);
  for (const width of [1500, 1920, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
  }
  await settle(page);
  const resized = await image(page);
  const resizeDifference = difference(dragged, resized);
  await writeFile(`${output}/resize-after.png`, resized);
  assert.ok(resizeDifference < 0.0002, `Resize reset the view: ${resizeDifference}`);
  checks.push({ name: 'Drag + zoom + repeated viewport round trip', resizeDifference });

  for (const crystal of ['FCC', 'BCC']) {
    await page.getByRole('combobox', { name: '纯金属的晶体结构', exact: true }).selectOption(crystal);
    await page.getByRole('button', { name: '重置视角', exact: true }).click();
    await page.locator('.drawing-modes label').nth(0).click();
    await draw(page, [-1, 1, 0]);
    await page.waitForTimeout(500);
    assert.ok((await page.locator('.drawing-info').innerText()).includes('O = (1, 0, 0)'));
    checks.push({ name: `${crystal} negative plane`, pixels: await pixels(page) });
    await page.locator('.drawing-modes label').nth(1).click();
    for (const values of [[1, 1, 0], [1, -1, -1], [-1, -1, -1]]) await draw(page, values);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${output}/desktop-${crystal.toLowerCase()}-negative-direction.png` });
    await page.getByRole('button', { name: '自动旋转', exact: true }).click();
    const before = await image(page);
    await page.waitForTimeout(800);
    assert.ok(difference(before, await image(page)) > 0.0005, 'Rotation is not moving');
    await page.getByRole('button', { name: '暂停动画', exact: true }).click();
    await page.getByRole('button', { name: '清除', exact: true }).click();
    assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '未绘制');
    assert.ok((await page.locator('.drawing-info').innerText()).includes('O = (0, 0, 0)'));
    checks.push({ name: `${crystal} direction, rotate, pause, clear`, pixels: await pixels(page) });
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  watch(mobile);
  await mobile.goto(url);
  await mobile.getByRole('button', { name: '功能模块', exact: true }).click();
  await mobile.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  await draw(mobile, [-1, 1, 0]);
  await mobile.waitForTimeout(500);
  const heading = await mobile.locator('.stage-heading').boundingBox();
  const controls = await mobile.locator('.drawing-controls').boundingBox();
  const canvas = await mobile.locator('.three-mount').boundingBox();
  assert.ok(controls.y >= heading.y + heading.height);
  assert.ok(canvas.y >= controls.y + controls.height, 'Mobile controls cover the drawing');
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.screenshot({ path: `${output}/mobile-plane-full.png`, fullPage: true });
  await mobile.locator('.drawing-modes label').nth(1).click();
  await draw(mobile, [1, -1, -1]);
  await mobile.waitForTimeout(500);
  await mobile.screenshot({ path: `${output}/mobile-negative-direction-full.png`, fullPage: true });
  await mobile.getByRole('button', { name: '自动旋转', exact: true }).click();
  const before = await image(mobile);
  await mobile.waitForTimeout(800);
  assert.ok(difference(before, await image(mobile)) > 0.0005);
  await mobile.getByRole('button', { name: '暂停动画', exact: true }).click();
  await mobile.locator('.drawing-controls-heading').click();
  assert.equal(await mobile.locator('#drawing-form').isVisible(), false);
  await mobile.locator('.drawing-controls-heading').click();
  await mobile.getByRole('button', { name: '清除', exact: true }).click();
  assert.equal(await mobile.locator('[data-testid=drawing-index]').innerText(), '未绘制');
  checks.push({ name: '390px drawing controls, plane/direction, rotation and clear', pixels: await pixels(mobile) });

  // Exercise the actual new render helpers with real WebGL and font textures.
  // This harness does not traverse or assess any released teaching module.
  const rendering = production ? null : await page.evaluate(async () => {
    const THREE = await import('/crystal/node_modules/.vite/deps/three.js');
    const api = await import('/crystal/src/render/crystalDrawingScene.ts');
    const { createCrystalDrawing, cubeCorners } = await import('/crystal/src/core/crystalDrawing.ts');
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x05070c);
    const scene = new THREE.Scene(), root = new THREE.Group();
    scene.add(root);
    const context = api.createDrawingScene(root);
    const camera = new THREE.PerspectiveCamera(45, 1.2, 0.1, 100);
    const target = new THREE.Vector3();
    const reference = { up: [0, 0, 1], position: [5.022, -4.536, 4.212], target: [0, 0, 0] };
    const results = [];
    try {
      for (const [width, height] of [[374, 290], [364, 550], [840, 700], [1260, 700]]) {
        renderer.setSize(width, height);
        api.setDrawingCamera(camera, target, new THREE.Vector2(width, height), reference);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        let overflow = -Infinity;
        for (const origin of cubeCorners) {
          api.updateDrawingScene(context, createCrystalDrawing('direction', origin.map((value) => value ? -1 : 1)));
          for (let degrees = 0; degrees < 360; degrees += 5) {
            root.rotation.z = degrees * Math.PI / 180;
            root.updateMatrixWorld(true);
            renderer.render(scene, camera);
            for (const object of context.axes.children) if (object.isSprite) {
              const point = object.getWorldPosition(new THREE.Vector3()).project(camera);
              const halfWidth = 18 * object.scale.x / object.scale.y;
              overflow = Math.max(overflow, Math.abs(point.x) + halfWidth * 2 / width - 1, Math.abs(point.y) + 36 / height - 1);
            }
          }
        }
        if (overflow >= 0) throw new Error(`Axis sprite clipped at ${width}x${height}: ${overflow}`);
        const gl = renderer.getContext(), rgba = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        let colored = 0;
        for (let i = 0; i < rgba.length; i += 4) if (Math.max(...rgba.subarray(i, i + 3)) > 65) colored++;
        if (colored < 60) throw new Error('Blank WebGL fixture');
        results.push({ viewport: [width, height], origins: 8, rotationSamplesPerOrigin: 72, maxSpriteOverflow: overflow, colored });
      }
      renderer.setSize(840, 700);
      api.setDrawingCamera(camera, target, new THREE.Vector2(840, 700), reference);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      for (const indices of [[1, 1, 0], [1, 0, 0], [-1, 1, 1]]) {
        root.rotation.z = 0;
        api.updateDrawingScene(context, createCrystalDrawing('direction', indices));
        const label = context.overlay.getObjectByName('drawing-index-label');
        let previous, largestStep = 0;
        for (let step = 0; step <= 3600; step++) {
          root.rotation.z = step * Math.PI / 1800;
          root.updateMatrixWorld(true);
          label.onBeforeRender(renderer, scene, camera, label.geometry, label.material, context.overlay);
          const point = label.getWorldPosition(new THREE.Vector3()).project(camera);
          const pixel = new THREE.Vector2(point.x * 420, point.y * 350);
          if (previous) largestStep = Math.max(largestStep, pixel.distanceTo(previous));
          previous = pixel;
        }
        if (largestStep >= 4) throw new Error(`Label jumped for ${indices}: ${largestStep}`);
        results.push({ indices, rotationSamples: 3601, maxLabelStepPx: largestStep });
      }
      return results;
    } finally { api.disposeDrawingLayer(root); renderer.dispose(); renderer.forceContextLoss(); }
  });
  if (rendering) checks.push({ name: 'Real WebGL full rotation and label continuity', results: rendering });
  await page.reload();
  await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  await draw(page, [1, 0, 0]);
  assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '(100)');
  await page.waitForTimeout(200);
  checks.push({ name: 'Reload and fresh drawing', pixels: await pixels(page) });
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  const results = { url, scope: 'feature/v1.2.0 drawing only', production, desktop: [1600, 900], mobile: [390, 844], dpr: 1, zoom: '100%', errors, failedRequests, checks };
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
