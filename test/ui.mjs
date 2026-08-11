/**
 * Browser checks, on a phone profile — the device this is actually played on.
 *
 *   npm install            # once, for playwright
 *   node test/ui.mjs
 *
 * Each check here exists because it caught a real bug:
 *
 *   applies()    a stylesheet parse error silently discarded the .lobby rule,
 *                so the briefing lost its padding and stopped scrolling. The
 *                rule was declared correctly the whole time — only computed
 *                style on a live element can catch that.
 *   sheet()      the decision sheet was a shrinkable flex item, so the growing
 *                thread squeezed it until the options list was 24px tall.
 *   contrast()   several text styles failed WCAG AA on the old dark treatment.
 *   viewport()   the iOS keyboard left the app the wrong height once dismissed.
 */

import { chromium, devices } from 'playwright';
import { fileURLToPath } from 'node:url';

const PAGE = 'file://' + fileURLToPath(new URL('../index.html', import.meta.url));
const errs = [];
const fail = m => errs.push(m);
const ok = (cond, m) => { if (!cond) fail(m); return cond; };

/* Rules whose loss breaks the app. Declaring them is not evidence. */
const CRITICAL = [
  ['.lobby',  'paddingLeft', '24px'],
  ['.lobby',  'overflowY',   'auto'],
  ['.opts',   'overflowY',   'auto'],
  ['.thread', 'overflowY',   'auto'],
  ['.device', 'overflowX',   'hidden'],
];

const CONTRAST = `(() => {
  const lum = c => { const [r,g,b] = c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number)
    .map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b; };
  const bgOf = el => { let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba?\\(0, 0, 0, 0\\)|transparent/.test(bg)) return bg;
      n = n.parentElement; }
    return 'rgb(255,255,255)'; };
  const ratio = (a,b) => { const l1=lum(a), l2=lum(b), [hi,lo] = l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };
  const out = [], seen = new Set();
  document.querySelectorAll('body *').forEach(el => {
    const txt = [...el.childNodes].filter(n => n.nodeType===3).map(n=>n.textContent.trim()).join('');
    if (!txt) return;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') return;
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight) || 400;
    const need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
    const key = cs.color + bgOf(el) + Math.round(size);
    if (seen.has(key)) return; seen.add(key);
    out.push({ sample: txt.slice(0,30), size, ratio: +ratio(cs.color, bgOf(el)).toFixed(2), need });
  });
  return out;
})()`;

const start = async (p, { untimed = true } = {}) => {
  await p.goto(PAGE);
  await p.click('#openAlert');
  if (untimed) await p.check('#untimed');
  await p.click('#startBtn');
  await p.waitForSelector('.sheet', { timeout: 30000 });
  await p.waitForTimeout(800);
};

const open = async p => {
  if (await p.getAttribute('.sheet', 'data-open') === 'false') {
    await p.click('#sheetToggle'); await p.waitForTimeout(320);
  }
};

// CHROMIUM_PATH lets this run against a preinstalled browser, e.g. in a
// container where `npx playwright install` is not the way browsers arrive.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
p.on('pageerror', e => fail('uncaught page error: ' + e.message));
p.on('console', m => { if (m.type() === 'error') fail('console error: ' + m.text()); });

/* ---- the stylesheet actually applies ---- */
await start(p);
await p.evaluate(() => {
  const probe = document.createElement('div');
  probe.className = 'lobby'; probe.id = 'probe'; probe.style.visibility = 'hidden';
  document.querySelector('.device').appendChild(probe);
});
for (const [sel, prop, want] of CRITICAL) {
  const got = await p.evaluate(([s, pr]) =>
    getComputedStyle(document.querySelector(s === '.lobby' ? '#probe' : s))[pr], [sel, prop]);
  ok(got === want, `${sel} { ${prop} } computes to ${got}, expected ${want} — a parse error may be discarding the rule`);
}
await p.evaluate(() => document.getElementById('probe')?.remove());

/* ---- the sheet stays usable for all ten rounds ---- */
for (let r = 0; r < 10; r++) {
  await p.waitForSelector('.sheet', { timeout: 30000 });
  await p.waitForTimeout(240);

  ok(await p.getAttribute('.sheet', 'data-open') === 'false',
     `round ${r + 1}: sheet opened by itself — it must not cover the story unasked`);
  const thread = await p.evaluate(() => {
    const t = document.querySelector('.thread').getBoundingClientRect();
    return Math.round(t.height / document.querySelector('.device').getBoundingClientRect().height * 100);
  });
  ok(thread >= 60, `round ${r + 1}: collapsed sheet leaves the thread only ${thread}% of the screen`);

  await open(p);
  const reach = await p.evaluate(() => {
    const opts = document.querySelector('.opts');
    const dev = document.querySelector('.device').getBoundingClientRect();
    opts.scrollTop = 1e6;
    const last = [...document.querySelectorAll('.opt')].pop().getBoundingClientRect();
    const r = last.bottom <= dev.bottom + 1; opts.scrollTop = 0; return r;
  });
  ok(reach, `round ${r + 1}: the last option cannot be reached`);

  const rows = await p.evaluate(CONTRAST);
  rows.filter(x => x.ratio < x.need).forEach(x =>
    fail(`round ${r + 1}: contrast ${x.ratio}:1 (needs ${x.need}) on "${x.sample}"`));

  const btns = await p.$$('.opt');
  ok(btns.length === 4, `round ${r + 1}: ${btns.length} options, want 4`);
  await btns[r % 4].click();
  await p.waitForTimeout(240);
}

await p.waitForSelector('.debrief', { timeout: 30000 });
await p.waitForTimeout(1200);
const entries = await p.$$eval('.entry', els => els.length);
ok(entries === 10, `debrief lists ${entries} decisions, want 10`);
ok(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
   'the page scrolls sideways');
await ctx.close();

/* ---- the keyboard cycle leaves the layout intact ---- */
const ctx2 = await browser.newContext({ ...devices['iPhone 13'] });
const p2 = await ctx2.newPage();
p2.on('pageerror', e => fail('uncaught page error: ' + e.message));
await p2.goto(PAGE);
await p2.click('#openAlert');
await p2.fill('#playerName', 'Table 4');
await p2.setViewportSize({ width: 390, height: 430 });   // keyboard up
await p2.waitForTimeout(350);
await p2.evaluate(() => document.getElementById('playerName').blur());
await p2.setViewportSize({ width: 390, height: 844 });   // and dismissed
await p2.waitForTimeout(450);
const after = await p2.evaluate(() => {
  const s = document.querySelector('.stage').getBoundingClientRect();
  return { stage: Math.round(s.height), win: window.innerHeight, scrollY: Math.round(window.scrollY),
           gap: Math.round(window.innerHeight - s.bottom) };
});
ok(after.stage === after.win, `after the keyboard closes the app is ${after.stage}px in a ${after.win}px window`);
ok(after.scrollY === 0, `the document is left scrolled by ${after.scrollY}px`);
ok(Math.abs(after.gap) <= 1, `${after.gap}px of backdrop is showing below the app`);

/* ---- timed mode opens the sheet before the clock runs out ---- */
await p2.click('#startBtn');
await p2.evaluate(() => ROUNDS.forEach(r => r.secs = 14));
await p2.waitForSelector('.sheet', { timeout: 30000 });
await p2.waitForTimeout(600);
ok(await p2.getAttribute('.sheet', 'data-open') === 'false', 'timed mode did not start collapsed');
ok(await p2.$('.hcta .cd') !== null, 'the countdown is not on the decision button');
await p2.waitForTimeout(6500);
ok(await p2.getAttribute('.sheet', 'data-open') === 'true',
   'the sheet did not open at the last call — a decision could expire unseen');

await browser.close();

if (errs.length) {
  console.error('✗ ui check failed:\n' + errs.map(e => '  ' + e).join('\n'));
  process.exit(1);
}
console.log('✓ ui: stylesheet applies, sheet usable for all 10 rounds, WCAG AA throughout, viewport survives the keyboard');
