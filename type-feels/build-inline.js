// Builds inline-version/: every page as ONE self-contained .html file,
// with the CSS inlined in <style> and the JavaScript inlined in <script>.
// Run after editing js-version/:   node build-inline.js
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'js-version');
const out = path.join(__dirname, 'inline-version');
fs.mkdirSync(out, { recursive: true });

const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8').trim();

for (const file of fs.readdirSync(src).filter((f) => f.endsWith('.html'))) {
  const html = read(file)
    .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, rel) =>
      `<style>\n/* ${rel} */\n${read(rel)}\n</style>`)
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, rel) =>
      `<script>\n/* ${rel} */\n${read(rel).replace(/<\/script/gi, '<\\/script')}\n</script>`);
  fs.writeFileSync(path.join(out, file), html + '\n');
  console.log(`inline-version/${file}  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
}
