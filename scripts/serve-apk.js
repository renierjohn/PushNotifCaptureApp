// Mini LAN server to download Android build outputs (APK/AAB) onto a device.
// Usage: bun run serve:apk [port]   (default port 8080)
import { networkInterfaces } from 'node:os';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SEARCH_DIRS = [
  join(ROOT, 'android/app/build/outputs/apk'),
  join(ROOT, 'android/app/build/outputs/bundle'),
  join(ROOT, 'build'), // e.g. `eas build --local --output build/app.apk`
];
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(apk|aab)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

// Rescanned per request so fresh builds appear without restarting.
function listArtifacts() {
  return SEARCH_DIRS.flatMap((d) => walk(d))
    .map((path, i) => {
      const s = statSync(path);
      return { id: String(i), path, rel: relative(ROOT, path), size: s.size, mtime: s.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

const fmtSize = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const esc = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function page(items) {
  const rows = items.length
    ? items
        .map(
          (a) => `<li><a href="/download/${a.id}">${esc(a.rel.split('/').pop())}</a>
<small>${esc(a.rel)} · ${fmtSize(a.size)} · ${a.mtime.toLocaleString()}</small></li>`,
        )
        .join('')
    : '<li>No builds found. Run <code>bunx expo run:android</code> or <code>cd android && ./gradlew assembleRelease</code>.</li>';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Android Builds</title>
<style>body{font:16px system-ui;margin:0 auto;max-width:640px;padding:16px}
li{margin:12px 0;list-style:none}a{font-size:18px;display:block;padding:8px 0}
small{color:#666;word-break:break-all}</style></head>
<body><h1>PushNotifCaptureApp builds</h1><ul style="padding:0">${rows}</ul></body></html>`;
}

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(req) {
    const url = new URL(req.url);
    const items = listArtifacts();

    if (url.pathname === '/') {
      return new Response(page(items), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const m = url.pathname.match(/^\/download\/(\d+)$/);
    const item = m && items.find((a) => a.id === m[1]);
    if (item) {
      const name = item.rel.split('/').pop();
      return new Response(Bun.file(item.path), {
        headers: {
          'Content-Type': name.endsWith('.apk')
            ? 'application/vnd.android.package-archive'
            : 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${name}"`,
          'Content-Length': String(item.size),
        },
      });
    }

    return new Response('Not found', { status: 404 });
  },
});

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => `http://${n.address}:${server.port}`);

console.log(`Serving Android builds on port ${server.port}`);
console.log(`  local: http://localhost:${server.port}`);
lan.forEach((u) => console.log(`  LAN:   ${u}`));
console.log(`Found ${listArtifacts().length} build file(s). Ctrl+C to stop.`);
