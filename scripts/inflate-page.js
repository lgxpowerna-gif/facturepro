const fs = require('fs');
const path = require('path');
const dir = __dirname;
const parts = fs.readdirSync(dir).filter(f => f.startsWith('page.b64.')).sort((a,b) => {
  const na = parseInt(a.split('.').pop(), 10);
  const nb = parseInt(b.split('.').pop(), 10);
  return na - nb;
});
const b64 = parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
const content = Buffer.from(b64, 'base64').toString('utf8');
const out = path.join(__dirname, '..', 'app', 'page.tsx');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, content);
console.log('Wrote', out, content.length, 'bytes');
