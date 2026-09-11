const fs = require('fs');
const path = require('path');

const files = ['app.js', 'settings.js', 'oobe.js', 'shortcuts.js', 'background.js', 'greeting.js', 'theme.js'];
const dir = path.join(__dirname);

for (const file of files) {
  const full = path.join(dir, file);
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  console.log(`\n=== ${file} ===`);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('\ufffd')) {
      console.log(`  L${i + 1}: ${l.substring(0, 150)}`);
    }
  }
}
