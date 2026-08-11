const fs = require('fs');
const path = require('path');
const dir = __dirname;
const parts = fs.readdirSync(dir)
  .filter(f => /^page\.part\.\d+$/.test(f))
  .sort((a, b) => parseInt(a.split('.').pop(), 10) - parseInt(b.split('.').pop(), 10));
if (!parts.length) throw new Error('No page.part.* files');
const content = parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
const out = path.join(__dirname, '..', 'app', 'page.tsx');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, content);
console.log('Wrote', out, content.length, 'bytes');
