// Drives the app through its main interactions and reports what happened.
// Needs a running dev or preview server:  npx tsx scripts/smoke.ts [baseUrl]

import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:5173/';
const executablePath = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
if (!executablePath) throw new Error('No Edge or Chrome found');

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${base}#site=-89.4455,222.6860&t=2027-03-14T06:00`, { waitUntil: 'networkidle0' });

const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));
const text = (sel: string) => page.$eval(sel, (el) => el.textContent?.trim() ?? '');
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
}

await wait(2500);
check('loads the connecting ridge', (await text('#s-no')) === 'LLS 01');
check('terrain loaded', (await text('#s-ll')).includes('ground'), await text('#s-ll'));

await page.click('.site[data-key="-85.9902,2.0920"]');
await wait();
check('list selects Malapert', (await text('#s-no')) === 'LLS 05', await text('#s-name'));

const box = (await (await page.$('.globe-canvas'))!.boundingBox())!;
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.42);
await wait(1200);
check('clicking the globe drops a custom pin', (await text('#s-no')) === 'Custom site', await text('#s-name'));

check('detail starts closed', !(await page.$eval('#d-goto', (el) => (el as HTMLDetailsElement).open)));
await page.click('#d-goto summary');
await page.type('#lat', 'abc');
await page.type('#lon', '10');
await page.click('#goto button');
await wait(200);
check('bad latitude shows an error', !(await page.$eval('#goto-err', (el) => (el as HTMLElement).hidden)), await text('#goto-err'));
await page.$eval('#lat', (el) => ((el as HTMLInputElement).value = ''));
await page.type('#lat', '88.5 S');
await page.$eval('#lon', (el) => ((el as HTMLInputElement).value = ''));
await page.type('#lon', '45');
await page.click('#goto button');
await wait();
check('coordinates accept "88.5 S"', (await text('#s-ll')).startsWith('88.50° S, 45.00° E'), await text('#s-ll'));

await page.click('[data-view="map"]');
await wait(1500);
const mapBox = (await (await page.$('#map'))!.boundingBox())!;
await page.mouse.click(mapBox.x + mapBox.width * 0.3, mapBox.y + mapBox.height * 0.3);
await wait();
const afterMap = await text('#s-ll');
check('clicking the map drops a pin', afterMap.includes('° S') && !afterMap.startsWith('88.50° S, 45.00° E'), afterMap);

await page.click('#add');
await wait();
check('add to compare confirms', (await text('#status')).startsWith('Added'), await text('#status'));
await page.click('#add');
await wait();
check('duplicate is refused', (await text('#status')).includes('already in Compare'), await text('#status'));

const before = await page.$eval('#date', (el) => (el as HTMLInputElement).value);
const ridge = (await (await page.$('.ridge'))!.boundingBox())!;
await page.mouse.click(ridge.x + ridge.width * 0.7, ridge.y + ridge.height * 0.25);
await wait();
const after = await page.$eval('#date', (el) => (el as HTMLInputElement).value);
check('clicking a ridge moves the date', before !== after, `${before} -> ${after}`);

await page.click('[data-shift="1"]');
await wait();
check('+1 d moves the date', (await page.$eval('#date', (el) => (el as HTMLInputElement).value)) !== after);

await page.click('#go');
await wait(1500);
check('analyse hides the site list', (await page.$eval('.sites', (el) => getComputedStyle(el).display)) === 'none');
check('analyse shows window lanes', (await page.$$('#lanes svg rect')).length > 3);
check('analyse shows the horizon strip', (await page.$$('#strip .strip-sky')).length > 0);
await page.click('#face-earth');
await wait(300);
await page.$eval('#mast', (el) => {
  (el as HTMLInputElement).value = '50';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait();
check('power text is written', (await text('#power')).includes('W'), (await text('#power')).slice(0, 70));

const clock = () => page.evaluate(() => (document.getElementById('date') as HTMLInputElement).value + (document.getElementById('time') as HTMLInputElement).value);
const beforePlay = await clock();
await page.click('#play');
await wait(1500);
const duringPlay = await clock();
check('play runs the clock', duringPlay !== beforePlay && (await text('#play')) === 'Pause', `${beforePlay} -> ${duringPlay}`);
await page.click('#play');
await wait(300);
const paused = await clock();
await wait(500);
check('pause holds the clock', paused === (await clock()) && (await text('#play')) === 'Play');
await page.click('#paths');
check('paths can be switched on', (await page.$eval('#paths', (el) => el.getAttribute('aria-pressed'))) === 'true');

await page.click('#add');
await wait();
await page.click('[data-tab="compare"]');
await wait(800);
check('compare lists two scenarios', (await page.$$('.cmp tbody tr')).length === 2);
check('compare rows have bars', (await page.$$('.cmp-lanes svg rect')).length > 4);
await page.click('[data-remove="0"]');
await wait();
check('remove takes a row away', (await page.$$('.cmp tbody tr')).length === 1);

const hash = await page.evaluate(() => location.hash);
check('state is in the URL', hash.includes('tab=compare') && hash.includes('cmp='), hash);
const again = await browser.newPage();
await again.goto(`${base}${hash}`, { waitUntil: 'networkidle0' });
await wait(1500);
check('the URL restores the scenario', (await again.$$('.cmp tbody tr')).length === 1);

// With no date in the address, the app opens on the present and keeps the date out of the link.
const fresh = await browser.newPage();
await fresh.goto(base, { waitUntil: 'networkidle0' });
await wait(1500);
const shown = await fresh.$eval('#date', (el) => (el as HTMLInputElement).value);
check('opens on today', shown === new Date().toISOString().slice(0, 10), shown);
check('Now is marked as on', (await fresh.$eval('#now', (el) => el.getAttribute('aria-pressed'))) === 'true');
check('the link carries no date while following the clock', !(await fresh.evaluate(() => location.hash)).includes('t='));
await fresh.click('[data-shift="1"]');
await wait(600);
check('picking a date puts it in the link', (await fresh.evaluate(() => location.hash)).includes('t='));
await fresh.click('#now');
await wait(600);
check('Now takes the date back out', !(await fresh.evaluate(() => location.hash)).includes('t='));
await fresh.click('[data-tab="compare"]');
await wait(500);
check('compare hides coordinate entry', (await fresh.$eval('#d-goto', (el) => getComputedStyle(el).display)) === 'none');
await fresh.click('.site[data-key="-85.9902,2.0920"]');
await wait(800);
check('on Compare, the site list adds a scenario', (await fresh.$$('.cmp tbody tr')).length === 1, await fresh.$eval('#cmp-status', (el) => el.textContent ?? ''));

// My sites: save the pin, rename it, and find it again after a reload. Storage is this browser's only.
const mine = await browser.newPage();
await mine.goto(`${base}#site=-88.2000,40.0000`, { waitUntil: 'networkidle0' });
await wait(1500);
check('an unsaved pin offers to save', (await mine.$('[data-mine="save"]')) !== null);
await mine.click('[data-mine="save"]');
await wait(800);
check('saving gives it the next MY number', (await mine.$eval('#s-no', (el) => el.textContent)) === 'MY 01');
check('saving opens the name field', !(await mine.$eval('#rename', (el) => (el as HTMLElement).hidden)));
await mine.$eval('#rename-input', (el) => ((el as HTMLInputElement).value = ''));
await mine.type('#rename-input', 'Ridge <b>B</b>');
await mine.keyboard.press('Enter');
await wait(600);
check('the new name shows as text, not markup', (await mine.$eval('#s-name', (el) => el.textContent)) === 'Ridge <b>B</b>');
check('it is listed under My sites', (await mine.$$('#list-mine .site')).length === 1);
await mine.reload({ waitUntil: 'networkidle0' });
await wait(1500);
check('it is still there after a reload', (await mine.$eval('#s-no', (el) => el.textContent)) === 'MY 01');
await mine.click('#add');
await mine.click('.site[data-key="-85.9902,2.0920"]');
await wait(500);
await mine.click('#add');
await mine.click('[data-tab="compare"]');
await wait(800);
await mine.select('#f-source', 'mine');
await wait(800);
check('the Sites filter narrows the table', (await mine.$$('.cmp tbody tr')).length === 1, await mine.$eval('#f-count', (el) => el.textContent ?? ''));
check('and the site list beside it', (await mine.$$('.sites .site')).length === 1);
await mine.click('#f-clear');
await wait(600);
check('Clear filters brings them back', (await mine.$$('.cmp tbody tr')).length === 2);
await mine.select('#f-sort', 'sun');
await wait(600);
check('sorting marks the Sun column', (await mine.$$('.cmp thead th.sorted')).length === 1);

check('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
if (failed) process.exitCode = 1;
