// Run with Vercel Root Directory set to dist.
const fs = require('node:fs');
const path = require('node:path');
const files = ['index.html', 'style.css', 'app.mjs', 'core.mjs', 'eis.mjs', 'eis-core.mjs'];
const destination = path.join(__dirname, '.vercel', 'output', 'static');
for (const file of files) {
  if (!fs.statSync(path.join(__dirname, file)).isFile()) {
    throw new Error(`Missing static file: ${file}`);
  }
}
fs.mkdirSync(destination, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(__dirname, file), path.join(destination, file));
  console.log(`Static output: ${file}`);
}
fs.writeFileSync(path.join(__dirname, '.vercel', 'output', 'config.json'), JSON.stringify({ version: 3 }));
console.log('Vercel Build Output API v3: 6 static files prepared.');

