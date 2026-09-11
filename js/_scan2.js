const fs = require('fs');
const path = require('path');

const files = ['settings.js', 'oobe.js', 'shortcuts.js', 'background.js', 'greeting.js', 'theme.js'];
const dir = path.join(__dirname);

for (const file of files) {
  const full = path.join(dir, file);
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  console.log(`\n=== ${file} ===`);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Find lines where a // comment is followed by code (no newline between)
    // Pattern: something like "// text  code" where code isn't just whitespace
    if (/\/\/.*\S\s{2,}\S/.test(l) && !l.match(/^\s*\/\//) === false) {
      // Check if there's code after a comment-like pattern
      const match = l.match(/^(\s*\/\/[^]*?)\s{2,}(\S.*)$/);
      if (match && match[2] && !match[2].startsWith('//') && !match[2].startsWith('*')) {
        console.log(`  L${i + 1} [comment+code]: ${l.substring(0, 160)}`);
      }
    }
    // Find lines where */ is followed by code
    if (/\*\/\s*\S/.test(l) && !l.match(/^\s*\/\//)) {
      console.log(`  L${i + 1} [*/+code]: ${l.substring(0, 160)}`);
    }
    // Find unclosed strings (simple heuristic: odd number of unescaped quotes)
    // This is tricky, skip for now
  }
}
