/**
 * Wraps the artifact sources into standalone HTML documents for GitHub Pages.
 *
 * index.html and facilitator.html are written as artifact *sources*: they carry
 * no <!doctype>, <html>, <head> or <body>, because the artifact runtime injects
 * that skeleton at publish time. Served raw from a static host they would have
 * no charset and — the one that actually breaks things — no viewport meta, so
 * phones would lay the simulation out at desktop width.
 *
 * This keeps the sources as the single place content is edited and generates
 * the deployable pages into docs/.
 *
 *   node build.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PAGES = [
  { src: 'index.html',       out: 'docs/index.html',       scheme: 'dark',
    desc: 'A live crisis simulation for science journalists. Ten timed decisions running a global science desk through a story that is only half true.' },
  { src: 'facilitator.html', out: 'docs/facilitator.html', scheme: 'light dark',
    desc: 'Facilitator run of show for the MONSOON crisis simulation: timings, discussion questions, assessment rubric and the ground truth.' },
];

mkdirSync('docs', { recursive: true });

for (const { src, out, scheme, desc } of PAGES) {
  let body = readFileSync(src, 'utf8');

  // Lift the <title> out of the body and into the head where it belongs.
  const title = (body.match(/<title>([\s\S]*?)<\/title>/) || [, 'MONSOON'])[1].trim();
  body = body.replace(/<title>[\s\S]*?<\/title>\s*/, '');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="color-scheme" content="${scheme}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='13' font-size='13'>${src === 'index.html' ? '📡' : '📋'}</text></svg>">
<style>:root{color-scheme:${scheme}}*{-webkit-text-size-adjust:100%}img{max-width:100%}</style>
</head>
<body>
${body.trim()}
</body>
</html>
`;

  writeFileSync(out, html);
  console.log(`${src.padEnd(18)} -> ${out.padEnd(24)} ${(html.length / 1024).toFixed(0)}KB`);
}

// Serve the files verbatim; no Jekyll pass.
writeFileSync('docs/.nojekyll', '');
console.log('docs/.nojekyll written');
