// Captures the app's main states for review. Needs a running dev or preview server
// and Microsoft Edge or Chrome installed.
//
//   npx tsx scripts/screenshot.ts [baseUrl] [outDir]

import { existsSync, mkdirSync } from 'node:fs';
import puppeteer, { type Page } from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? '.impeccable/review';
mkdirSync(out, { recursive: true });

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];
const executablePath = browsers.find(existsSync);
if (!executablePath) throw new Error('No Edge or Chrome found');

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});

const T = '2027-03-14T06:00';
const SITE = '-89.4455,222.6860';
const CMP = `-89.4455,222.6860,${Date.parse('2027-03-14T06:00Z') / 60000};-89.4455,222.6860,${Date.parse('2027-03-28T06:00Z') / 60000};-85.9902,2.0920,${Date.parse('2027-03-14T06:00Z') / 60000};-84.7906,29.1957,${Date.parse('2027-03-14T06:00Z') / 60000}`;

async function settle(page: Page, ms = 2500) {
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, ms));
}

async function shot(name: string, hash: string, width: number, height: number, fullPage = false, after?: (p: Page) => Promise<void>) {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${base}#${hash}`, { waitUntil: 'networkidle0' });
  await settle(page);
  if (after) {
    await after(page);
    await settle(page, 1200);
  }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  console.log(`${name}.png${errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''}`);
  await page.close();
}

const only = process.argv[4];
const want = (n: string) => !only || only.split(',').includes(n);

const openAll = async (p: Page) => {
  await p.evaluate(() => document.querySelectorAll<HTMLDetailsElement>('details.more').forEach((d) => (d.open = true)));
};

if (want('default')) await shot('desktop-default', '', 1440, 900);
if (want('desktop')) await shot('desktop', `site=${SITE}&t=${T}`, 1440, 900);
if (want('map')) await shot('desktop-map', `site=${SITE}&t=${T}&view=map`, 1440, 900);
if (want('map-hover'))
  await shot('desktop-map-hover', `site=${SITE}&t=${T}&view=map`, 1440, 900, false, async (p) => {
    // Rest the pointer on the map so the live coordinate readout shows.
    await p.mouse.move(700, 330);
  });
if (want('analyse')) await shot('desktop-analyse', `site=${SITE}&t=${T}&tab=analyse`, 1440, 900);
if (want('earth'))
  await shot('desktop-analyse-earth', `site=-85.9902,2.0920&t=${T}&tab=analyse`, 1440, 900, false, async (p) => {
    await p.click('#face-earth');
    for (let i = 0; i < 4; i++) await p.click('#sky-in');
  });
if (want('away'))
  await shot('desktop-analyse-away', `site=${SITE}&t=${T}&tab=analyse`, 1440, 900, false, async (p) => {
    // Turn round: drag the sky so the Sun is behind the viewer.
    await p.mouse.move(600, 300);
    await p.mouse.down();
    await p.mouse.move(600 - 5000, 330, { steps: 4 });
    await p.mouse.up();
    for (let i = 0; i < 3; i++) await p.click('#sky-out');
  });
if (want('paths'))
  await shot('desktop-analyse-paths', `site=${SITE}&t=${T}&tab=analyse`, 1440, 900, false, async (p) => {
    await p.click('#paths');
  });
if (want('custom')) await shot('desktop-custom', `site=-87.2000,95.0000&t=${T}`, 1440, 900);
if (want('compare')) await shot('desktop-compare', `site=${SITE}&t=${T}&tab=compare&cmp=${CMP}`, 1440, 900);
if (want('about')) await shot('desktop-about', `site=${SITE}&t=${T}&tab=about`, 1440, 900, true);
if (want('mobile-about')) await shot('mobile-about', `site=${SITE}&t=${T}&tab=about`, 390, 844, true);
if (want('apollo')) await shot('desktop-apollo', `site=0.6742,23.4731&t=${T}&tab=analyse`, 1440, 900);
if (want('small')) await shot('desktop-1280', `site=${SITE}&t=${T}`, 1280, 720);
if (want('mobile')) await shot('mobile', `site=${SITE}&t=${T}`, 390, 844, true);
if (want('mobile-analyse')) await shot('mobile-analyse', `site=${SITE}&t=${T}&tab=analyse`, 390, 844, true);
// Last, because the app remembers which detail sections were opened.
if (want('open')) await shot('desktop-open', `site=${SITE}&t=${T}`, 1440, 900, false, openAll);
if (want('analyse-open')) await shot('desktop-analyse-open', `site=${SITE}&t=${T}&tab=analyse`, 1440, 900, false, openAll);

await browser.close();
