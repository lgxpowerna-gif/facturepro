const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const dir = __dirname;
const parts = fs.readdirSync(dir)
  .filter(f => /^page\.gz\.b64\.\d+$/.test(f))
  .sort((a, b) => parseInt(a.split('.').pop(), 10) - parseInt(b.split('.').pop(), 10));
if (!parts.length) throw new Error('No page.gz.b64.* files');
const b64 = parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
const content = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
const out = path.join(__dirname, '..', 'app', 'page.tsx');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, content);
console.log('Wrote', out, content.length, 'bytes');
