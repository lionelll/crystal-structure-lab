import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const url = process.env.QA_BASE_URL || 'http://127.0.0.1:5180/crystal/';
assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):\d+\//, 'QA must use a local server');
const output = 'docs/qa/crystal-drawing';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
const requestsFailed = [];
const checks = [];
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) requestsFailed.push(`${response.status()} ${response.url()}`); });
};
const pause = (page) => page.getByRole('button', { name: '暂停动画', exact: true }).click();
const drawButton = (page) => page.getByRole('button', { name: '绘制', exact: true });
const clear = (page) => page.getByRole('button', { name: '清除', exact: true }).click();
const canvasImage = async (page) => Buffer.from(await page.locator('.three-mount canvas').evaluate((canvas) => canvas.toDataURL('image/png').split(',')[1]), 'base64');
const settleOrbit = (page) => page.evaluate(() => new Promise((resolve) => {
  let frames = 0;
  const tick = () => ++frames >= 500 ? resolve() : requestAnimationFrame(tick);
  requestAnimationFrame(tick);
}));
const enter = async (page, values) => {
  for (let i = 0; i < 3; i++) await page.locator('.drawing-indices input').nth(i).fill(String(values[i]));
  await drawButton(page).click();
};
const modelPixels = async (page) => {
  const png = PNG.sync.read(await canvasImage(page));
  let colored = 0;
  let blue = 0;
  let red = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = png.data.subarray(i, i + 3);
    if (Math.max(r, g, b) > 65 && Math.max(r, g, b) - Math.min(r, g, b) > 25) colored++;
    if (b > r + 35 && b > g + 15 && b > 90) blue++;
    if (r > g + 50 && r > b + 50) red++;
  }
  assert.ok(colored > 60, `Blank/empty canvas: ${colored} colored pixels`);
  return { width: png.width, height: png.height, colored, blue, red };
};
const pixelDifference = (a, b) => {
  const first = PNG.sync.read(a), second = PNG.sync.read(b);
  assert.equal(first.width, second.width);
  assert.equal(first.height, second.height);
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    if ([0, 1, 2].some((j) => Math.abs(first.data[i + j] - second.data[i + j]) > 5)) changed++;
  }
  return changed / (first.width * first.height);
};

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  watch(page);
  await page.goto(url);
  await pause(page);
  await page.screenshot({ path: `${output}/design-qa-drawing-reference.png` });
  await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '未绘制');
  assert.ok((await page.getByRole('button', { name: '暂停动画', exact: true }).getAttribute('class')).includes('active'));
  await enter(page, [1, 1, 1]);
  await page.waitForTimeout(500);
  const planePixels = await modelPixels(page);
  assert.ok(planePixels.blue > 300, 'Plane must contain visible blue pixels');
  await page.screenshot({ path: `${output}/design-qa-drawing-implementation.png` });
  checks.push({ name: 'FCC (111) visible', pixels: planePixels });

  const canvas = page.locator('.three-mount canvas');
  const beforeInvalid = await canvasImage(page);
  await enter(page, [0, 0, 0]);
  assert.ok(await page.getByRole('alert').isVisible());
  assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '(111)');
  assert.ok(pixelDifference(beforeInvalid, await canvasImage(page)) < 0.0001, 'Invalid input changed the last valid rendering');

  await enter(page, [-2, 1, 0]);
  await page.waitForTimeout(500);
  assert.ok((await page.locator('.drawing-info').innerText()).includes('O = (1, 0, 0)'));
  assert.ok((await page.locator('.drawing-info').innerText()).includes('-1/2a'));
  await page.screenshot({ path: `${output}/design-qa-drawing-negative-plane.png` });
  await page.locator('.drawing-modes label').nth(1).click();
  assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '未绘制');
  await enter(page, [-2, 1, 3]);
  await page.waitForTimeout(500);
  const directionPixels = await modelPixels(page);
  assert.ok(directionPixels.red > 150);
  await page.screenshot({ path: `${output}/design-qa-drawing-direction.png` });
  checks.push({ name: 'Negative direction visible', pixels: directionPixels });

  // Capture the empty board after dragging, then ensure draw/clear never snaps it back.
  await clear(page);
  await page.locator('.drawing-controls-heading').click();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.65, { steps: 12 });
  await page.mouse.up();
  await settleOrbit(page);
  const dragged = await canvasImage(page);
  await page.locator('.drawing-controls-heading').click();
  await enter(page, [1, 1, 1]);
  await clear(page);
  await page.waitForTimeout(500);
  const continuityDifference = pixelDifference(dragged, await canvasImage(page));
  await writeFile(`${output}/continuity-before.png`, dragged);
  await writeFile(`${output}/continuity-after.png`, await canvasImage(page));
  assert.ok(continuityDifference < 0.0002, `View jumped: ${continuityDifference}`);
  checks.push({ name: 'Camera continuity after draw/clear', continuityDifference });
  for (const values of [[-1, -1, -1], [3, 0, 1], [1, -2, 0], [1, 1, 0]]) await enter(page, values);
  assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '[110]');
  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '[110]');

  await page.getByRole('button', { name: '自动旋转', exact: true }).click();
  const rotatingA = await canvasImage(page);
  await page.waitForTimeout(600);
  assert.ok(pixelDifference(rotatingA, await canvasImage(page)) > 0.001, 'Auto rotation did not move the model');
  await page.getByRole('button', { name: '晶胞模型', exact: true }).click();
  assert.ok((await page.getByRole('button', { name: '暂停动画', exact: true }).getAttribute('class')).includes('active'), 'Original paused state not restored');

  const metalModules = ['晶胞模型', '堆垛模型', '空间点阵', '密排面 / 密排方向', '配位数', '四面体间隙', '八面体间隙'];
  for (const crystal of ['FCC', 'BCC', 'HCP']) {
    await page.getByRole('combobox', { name: '纯金属的晶体结构', exact: true }).selectOption(crystal);
    for (const name of metalModules) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(100);
      await modelPixels(page);
    }
    if (crystal === 'HCP') assert.equal(await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).count(), 0);
  }
  checks.push({ name: '21 existing metal module views and HCP restriction', passed: true });
  await page.getByRole('combobox', { name: '纯金属的晶体结构', exact: true }).selectOption('BCC');
  await page.locator('.toggle-row').click();
  await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  assert.ok(await page.getByRole('checkbox').isDisabled());
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  await enter(page, [1, 1, 0]);
  await modelPixels(page);
  await page.getByRole('button', { name: '晶胞模型', exact: true }).click();
  assert.equal(await page.getByRole('checkbox').isChecked(), true, 'Supercell preference lost');
  await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  await page.getByRole('combobox', { name: '纯金属的晶体结构', exact: true }).selectOption('HCP');
  assert.equal(await page.locator('.stage-heading strong').innerText(), '晶胞模型');

  await page.getByRole('button', { name: '离子晶体结构', exact: true }).click();
  const ids = await page.getByRole('combobox', { name: '离子晶体结构', exact: true }).locator('option').evaluateAll((options) => options.map((option) => option.value));
  for (const id of ids) {
    await page.getByRole('combobox', { name: '离子晶体结构', exact: true }).selectOption(id);
    for (const name of ['晶胞模型', '空间点阵', '配位数', '离子位置']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(100);
      await modelPixels(page);
      if (name === '离子位置') {
        for (const button of await page.locator('.ionic-legend button').all()) {
          await button.click();
          await modelPixels(page);
        }
      }
    }
  }
  checks.push({ name: `${ids.length * 4} ionic views and ion selection`, passed: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  watch(mobile);
  await mobile.goto(url);
  await mobile.getByRole('button', { name: '功能模块', exact: true }).click();
  await mobile.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  await enter(mobile, [-1, 1, 0]);
  await mobile.waitForTimeout(500);
  const mobilePixels = await modelPixels(mobile);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const heading = await mobile.locator('.stage-heading').boundingBox();
  const controls = await mobile.locator('.drawing-controls').boundingBox();
  assert.ok(controls.y >= heading.y + heading.height, 'Controls overlap stage heading');
  await mobile.screenshot({ path: `${output}/design-qa-drawing-mobile-full.png`, fullPage: true });
  await mobile.locator('.drawing-controls-heading').click();
  assert.equal(await mobile.locator('#drawing-form').isVisible(), false);
  await mobile.locator('.drawing-controls-heading').click();
  await mobile.getByRole('button', { name: '清除', exact: true }).click();
  assert.equal(await mobile.locator('[data-testid=drawing-index]').innerText(), '未绘制');
  checks.push({ name: '390px mobile controls, overflow and canvas', pixels: mobilePixels });

  assert.deepEqual(errors, []);
  assert.deepEqual(requestsFailed, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ url, viewport: [1600, 1000], mobileViewport: [390, 844], dpr: 1, zoom: '100%', errors, requestsFailed, checks }, null, 2));
  console.log(JSON.stringify({ checks, errors, requestsFailed }, null, 2));
} finally {
  await browser.close();
}
