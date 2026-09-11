import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const url = 'http://127.0.0.1:4180/crystal/';
const errors = [];
const failures = [];
const evidence = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto(url);
  const paths = await page.locator('script[src],link[rel=stylesheet],link[rel=icon]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') || node.getAttribute('href')));
  assert.ok(paths.length >= 3);
  assert.ok(paths.every((path) => path.startsWith('/crystal/')));
  for (const path of paths) assert.ok((await page.request.get(new URL(path, url).href)).ok());
  // Ordinary modules are rotating before entry; drawing pauses without changing their preference.
  await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  assert.match(await page.getByRole('button', { name: '暂停动画', exact: true }).getAttribute('class'), /active/);
  await page.getByRole('button', { name: '绘制', exact: true }).click();
  await page.locator('.drawing-indices input').nth(0).fill('2');
  await page.locator('.drawing-indices input').nth(2).press('Enter');
  assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '(211)');
  for (const viewport of [{ width: 1600, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const styles = await page.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height, layoutWidth: style.width, fontSize: style.fontSize, fontWeight: style.fontWeight, gap: style.gap, padding: style.padding, transform: style.transform };
      };
      return { heading: read('.stage-heading'), title: read('.stage-heading strong'), logo: read('.stage-logo'), controls: read('.drawing-controls'), input: read('.drawing-indices input') };
    });
    evidence.push({ viewport, styles });
    await page.screenshot({ path: `docs/qa/crystal-drawing/design-qa-drawing-build-${viewport.width}.png` });
  }
  await page.getByRole('button', { name: '晶胞模型', exact: true }).click();
  assert.match(await page.getByRole('button', { name: '自动旋转', exact: true }).getAttribute('class'), /active/);
  await page.getByRole('button', { name: '晶面/晶向绘制', exact: true }).click();
  assert.equal(await page.locator('[data-testid=drawing-index]').innerText(), '未绘制');
  assert.match(await page.getByRole('button', { name: '暂停动画', exact: true }).getAttribute('class'), /active/);
  await page.reload();
  assert.equal(await page.locator('.stage-heading strong').innerText(), '晶胞模型');
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  const result = { url, dpr: 1, zoom: '100%', paths, errors, failures, rotationRestored: true, refreshPassed: true, evidence };
  await writeFile('docs/qa/crystal-drawing/build-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
