/**
 * Scenario checks. No browser needed.
 *
 *   node test/scenario.mjs
 *
 * The scenario is plain JS inside index.html, so a typo silently breaks a
 * round rather than failing loudly. These checks read the real data out of
 * the page and assert the properties the workshop depends on.
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const AXES_KEYS = ['rigor', 'tempo', 'trust', 'nerve'];

// Archetype shapes that are deliberately absent: in this scenario every
// trust-building action also demands courage or evidence discipline, so a
// trust-led profile cannot be played. Documented rather than papered over.
const KNOWN_GAPS = ['trust|nerve', 'trust|rigor', 'nerve|rigor'];

function load(file = new URL('../index.html', import.meta.url)) {
  const html = readFileSync(file, 'utf8');
  const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  // Enough of a DOM for the page's setup code to run to completion; we only
  // want the data structures it declares.
  const ctx = {
    document: {
      getElementById: stub, querySelector: stub, querySelectorAll: () => [],
      addEventListener() {}, createElement: stub,
      documentElement: { style: { setProperty() {} }, setAttribute() {} },
    },
    window: {
      matchMedia: () => ({ matches: false }), addEventListener() {},
      visualViewport: null, innerHeight: 800, scrollY: 0, scrollTo() {},
    },
    requestAnimationFrame() {}, setTimeout() {}, setInterval() {}, clearInterval() {},
    navigator: {}, location: {},
  };
  ctx.window.document = ctx.document;
  ctx.addEventListener = () => {};
  ctx.scrollTo = () => {};
  ctx.innerHeight = 800;
  ctx.scrollY = 0;
  ctx.matchMedia = () => ({ matches: false });
  ctx.globalThis = ctx;
  runInNewContext(src + ';globalThis.__data = { CAST, ROUNDS, ARCHETYPES, AXES };', ctx);
  return ctx.__data;

  function stub() {
    return { addEventListener() {}, appendChild() {}, remove() {}, querySelectorAll: () => [],
             querySelector: stub, classList: { add() {}, remove() {} }, style: {}, children: [],
             focus() {}, value: '', checked: false, setAttribute() {}, textContent: '' };
  }
}

const errs = [];
const fail = m => errs.push(m);
const { CAST, ROUNDS, ARCHETYPES } = load();

/* ---- shape of every round ---- */
const MSG_TYPES = ['msg', 'wire', 'article', 'post', 'you', 'sys'];
const cast = new Set(Object.keys(CAST));

if (ROUNDS.length !== 10) fail(`expected 10 rounds, got ${ROUNDS.length}`);

for (const r of ROUNDS) {
  const tag = `R${r.id}`;
  if (!r.act || !r.clock || !r.secs) fail(`${tag}: missing act/clock/secs`);
  if (!r.prompt || !r.q) fail(`${tag}: missing prompt or question`);
  if (r.options?.length !== 4) fail(`${tag}: ${r.options?.length} options, want 4`);
  if (!r.timeoutOpt) fail(`${tag}: no timeoutOpt — an expired clock must still be a decision`);

  const messages = (list, where) => (list || []).forEach(m => {
    if (!MSG_TYPES.includes(m.t)) fail(`${tag}/${where}: unknown message type "${m.t}"`);
    if (m.t === 'msg') {
      if (!cast.has(m.who)) fail(`${tag}/${where}: "${m.who}" is not in CAST`);
      if (!m.lines?.length) fail(`${tag}/${where}: message has no lines`);
    }
    if (m.t === 'wire' && !m.hed) fail(`${tag}/${where}: wire has no headline`);
    if (m.t === 'article' && !(m.h && m.kicker && m.p)) fail(`${tag}/${where}: article incomplete`);
    if (m.t === 'post' && !(m.text && m.handle && m.eng)) fail(`${tag}/${where}: post incomplete`);
    if (m.t === 'you' && !m.text) fail(`${tag}/${where}: player message has no text`);
  });

  messages(r.injects, 'injects');
  const keys = [];
  for (const [ix, o] of [...r.options, r.timeoutOpt].entries()) {
    const where = ix < 4 ? `option ${o.k}` : 'timeout';
    if (!o.label) fail(`${tag}/${where}: no label`);
    // The note is the teaching material; a round without one teaches nothing.
    if (!o.note) fail(`${tag}/${where}: no debrief note`);
    if (ix < 4) { if (!o.detail) fail(`${tag}/${where}: no detail line`); keys.push(o.k); }
    for (const k of AXES_KEYS) if (typeof o.s?.[k] !== 'number') fail(`${tag}/${where}: score .${k} is not a number`);
    messages(o.out, where);
  }
  if (keys.join('') !== 'ABCD') fail(`${tag}: option keys are "${keys.join('')}", want ABCD`);
}

/* ---- archetypes ----
   Scores are additive and rounds independent, so greedily maximising a linear
   objective per round is an exact optimum. That makes reachability provable
   rather than assumed. */
const best = w => ROUNDS.reduce((s, r) => {
  const all = [...r.options, r.timeoutOpt];
  const pick = all.reduce((a, b) => AXES_KEYS.reduce((t, k) => t + w[k] * b.s[k], 0) >
                                    AXES_KEYS.reduce((t, k) => t + w[k] * a.s[k], 0) ? b : a);
  AXES_KEYS.forEach(k => s[k] += pick.s[k]);
  return s;
}, Object.fromEntries(AXES_KEYS.map(k => [k, 0])));

const label = s => {
  const v = AXES_KEYS.map(k => ({ k, v: s[k] })).sort((a, b) => b.v - a.v);
  const hi = v[0], lo = v[v.length - 1];
  const avg = v.reduce((t, x) => t + x.v, 0) / v.length;
  if (hi.v <= 2) return ARCHETYPES.passenger.t;
  if (hi.v - lo.v <= 8) return avg >= 6 ? ARCHETYPES.balanced.t : ARCHETYPES.passenger.t;
  return (ARCHETYPES[`${hi.k}|${lo.k}`] || (avg >= 6 ? ARCHETYPES.balanced : ARCHETYPES.passenger)).t;
};

for (const [k, a] of Object.entries(ARCHETYPES)) {
  if (!a.t || !a.d) fail(`archetype "${k}" is missing a name or description`);
}
for (const hi of AXES_KEYS) for (const lo of AXES_KEYS) {
  if (hi === lo) continue;
  const key = `${hi}|${lo}`;
  if (!ARCHETYPES[key] && !KNOWN_GAPS.includes(key)) fail(`archetype "${key}" is undefined and not a documented gap`);
  if (ARCHETYPES[key] && KNOWN_GAPS.includes(key)) fail(`archetype "${key}" is defined but listed as unreachable — update KNOWN_GAPS`);
}

const reached = new Set();
for (const hi of AXES_KEYS) for (const lo of AXES_KEYS) {
  if (hi === lo) continue;
  const w = Object.fromEntries(AXES_KEYS.map(k => [k, 0]));
  w[hi] = 1; w[lo] = -1;
  reached.add(label(best(w)));
}
reached.add(label(best(Object.fromEntries(AXES_KEYS.map(k => [k, 1])))));
reached.add(label(best(Object.fromEntries(AXES_KEYS.map(k => [k, -1])))));

const defined = [...new Set(Object.values(ARCHETYPES).map(a => a.t))];
const unreachable = defined.filter(t => !reached.has(t));
if (unreachable.length) fail(`archetypes no play can reach: ${unreachable.join(', ')}`);

/* ---- report ---- */
console.log(`rounds: ${ROUNDS.length} · cast: ${Object.keys(CAST).length} · archetypes: ${defined.length} (all reachable: ${!unreachable.length})`);
if (errs.length) {
  console.error('\n✗ scenario check failed:\n' + errs.map(e => '  ' + e).join('\n'));
  process.exit(1);
}
console.log('✓ scenario data valid');
