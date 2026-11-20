// Packs the app into one self-contained HTML page (CSS + all JS modules inlined), e.g. for
// publishing as a Claude artifact. The modules share one scope, so top-level names must stay unique.
// Usage: node beatbox/scripts/build-single.mjs out.html
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const ORDER = ['dsp', 'classify', 'pattern', 'drums', 'exporters', 'audio-io', 'synth-voice', 'app'];

const js = ORDER.map((m) => {
  const src = read(`js/${m}.js`)
    .replace(/^import [^;]+;\n/gm, '')
    .replace(/^export (?=(async )?(function|const|let|class) )/gm, '');
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`${m}.js has an import/export this script can't inline`);
  return `// ---- ${m}.js ----\n${src}`;
}).join('\n');
if (js.includes('</script')) throw new Error('inlined JS contains </script');

const html = read('index.html');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<link rel="stylesheet" href="style.css" \/>/, `<style>\n${read('style.css')}</style>`);
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/<script type="module" src="js\/app.js"><\/script>/, `<script type="module">\n${js}</script>`);

const out = process.argv[2] || join(root, 'dist-single.html');
writeFileSync(out, `${head.trim()}\n${body.trim()}\n`);
console.log(`wrote ${out} (${(Buffer.byteLength(head + body) / 1024).toFixed(0)} KB)`);
