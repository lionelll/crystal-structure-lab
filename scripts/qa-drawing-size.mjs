import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const phase = process.argv[2];
assert.ok(['before', 'after'].includes(phase), 'Pass before or after');
const url = process.env.QA_BASE_URL || 'http://127.0.0.1:5180/crystal/';
assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/crystal\/$/);
const refinement = process.env.QA_SIZE_REFINEMENT === '1';
const output = `docs/qa/crystal-drawing/${refinement ? 'size-padding' : 'size-adjustment'}`;
await mkdir(`${output}/${phase}`, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], failedRequests = [], checks = [];

function frameBounds(buffer) {
  const png = PNG.sync.read(buffer);
  let left = png.width, right = -1, top = png.height, bottom = -1, pixels = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4;
    const rgb = [...png.data.subarray(i, i + 3)];
    // The empty drawing's neutral pixels are its cube edges, not the colored axes.
    if (Math.min(...rgb) > 65 && Math.max(...rgb) - Math.min(...rgb) < 25) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y); pixels++;
    }
  }
  assert.ok(pixels > 50, 'Missing cell frame');
  return { width: right - left + 1, height: bottom - top + 1, left, top, pixels };
}

try {
  for (const [device, viewport] of [['desktop', { width: 1600, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    for (const crystal of ['FCC', 'BCC']) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: device === 'mobile', hasTouch: device === 'mobile' });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', (response) => { if (response.status() >= 400) failedRequests.push(response.url()); });
      await page.goto(url);
      if (device === 'mobile') await page.getByRole('button', { name: '晶体选择', exact: true }).click();
      await page.getByRole('combobox', { name: '纯金属的晶体结构', exact: true }).selectOption(crystal);
      if (device === 'mobile') await page.getByRole('button', { name: '功能模块', exact: true }).click();
      await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
      await page.getByRole('button', { name: '重置视角', exact: true }).click();
      await page.waitForTimeout(300);
      const name = `${device}-${crystal.toLowerCase()}`;
      const canvas = page.locator('.three-mount canvas');
      const raw = Buffer.from(await canvas.evaluate((node) => node.toDataURL().split(',')[1]), 'base64');
      const bounds = frameBounds(raw);
      const canvasBox = await canvas.boundingBox();
      const controls = await page.locator('.drawing-controls').boundingBox();
      if (device === 'mobile') assert.ok(canvasBox.y >= controls.y + controls.height);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await writeFile(`${output}/${phase}/${name}-canvas.png`, raw);
      await page.screenshot({ path: `${output}/${phase}/${name}-full.png`, fullPage: true });
      const record = { name, viewport, canvas: [canvasBox.width, canvasBox.height], bounds };
      if (phase === 'after') {
        const baseline = JSON.parse(await readFile(`${output}/before/results.json`, 'utf8')).checks.find((item) => item.name === name);
        assert.deepEqual(record.canvas, baseline.canvas);
        const ratios = { width: bounds.width / baseline.bounds.width, height: bounds.height / baseline.bounds.height };
        const range = refinement ? (device === 'mobile' ? [1.035, 1.06] : [1.015, 1.025]) : [1.11, 1.145];
        assert.ok(Object.values(ratios).every((ratio) => ratio >= range[0] && ratio <= range[1]), `Unexpected enlargement: ${JSON.stringify(ratios)}`);
        record.ratios = ratios;
        const first = PNG.sync.read(await readFile(`${output}/before/${name}-canvas.png`));
        const second = PNG.sync.read(raw);
        const comparison = new PNG({ width: first.width * 2, height: first.height });
        PNG.bitblt(first, comparison, 0, 0, first.width, first.height, 0, 0);
        PNG.bitblt(second, comparison, 0, 0, second.width, second.height, first.width, 0);
        await writeFile(`${output}/${name}-comparison.png`, PNG.sync.write(comparison));
      }
      for (const [mode, indices] of [['plane', [1, 1, 1]], ['direction', [-1, 1, 0]]]) {
        await page.locator('.drawing-modes label').nth(mode === 'plane' ? 0 : 1).click();
        for (let i = 0; i < 3; i++) await page.locator('.drawing-indices input').nth(i).fill(String(indices[i]));
        await page.getByRole('button', { name: '绘制', exact: true }).click();
        await page.waitForTimeout(500);
        assert.notEqual(await page.locator('[data-testid=drawing-index]').innerText(), '未绘制');
        await page.screenshot({ path: `${output}/${phase}/${name}-${mode}-full.png`, fullPage: true });
      }
      checks.push(record);
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  const result = { phase, url, scope: 'feature/v1.2.0 drawing only', dpr: 1, zoom: '100%', errors, failedRequests, checks };
  await writeFile(`${output}/${phase}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
