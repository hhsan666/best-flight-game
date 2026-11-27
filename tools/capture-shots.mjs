// Captures screenshots/ from the game itself: serves game/ on a local port, opens each staged
// scene (index.html?shot=<scene>) in headless Chromium at 768x480 CSS pixels with a device pixel
// ratio of 2 (the game renders at 1536x960), waits until the game reports the frame is drawn, and
// saves the browser's own JPEG capture at CSS size, so the browser's downsampling smooths the edges
// (lowering quality until it is at most 256 KiB). Nothing is edited or composited afterwards.
//
//   node tools/capture-shots.mjs [scene ...]     (needs Playwright with Chromium)
import { createServer } from 'node:http';
import { createReadStream, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gameRoot = join(root, 'game');
const SHOTS = [
  { file: '1-cover.jpg', scene: 'harbourPass' },
  { file: '2-cockpit-dusk.jpg', scene: 'cockpit' },
  { file: '3-squall-final.jpg', scene: 'squall' },
  { file: '4-results.jpg', scene: 'results' },
];
const MAX_BYTES = 262144;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(gameRoot, path));
  try {
    if (!file.startsWith(gameRoot + sep) || !statSync(file).isFile()) throw new Error('missing');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const wanted = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
mkdirSync(join(root, 'screenshots'), { recursive: true });
for (const shot of SHOTS.filter((s) => wanted.length === 0 || wanted.includes(s.scene))) {
  const page = await browser.newPage({ viewport: { width: 768, height: 480 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error(`[${shot.scene}] ${e.message}`));
  await page.goto(`${base}/index.html?shot=${shot.scene}&seed=7`);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
  let quality = 92;
  let bytes;
  do {
    bytes = await page.screenshot({ type: 'jpeg', quality, scale: 'css' });
    quality -= 4;
  } while (bytes.length > MAX_BYTES && quality > 30);
  writeFileSync(join(root, 'screenshots', shot.file), bytes);
  console.log(`${shot.file}: ${bytes.length} bytes at quality ${quality + 4}`);
  await page.close();
}
await browser.close();
server.close();
