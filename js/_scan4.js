const fs = require('fs');
const path = require('path');

// For each file, find all lines with \ufffd that need fixing
const files = ['oobe.js', 'shortcuts.js', 'background.js', 'greeting.js', 'theme.js'];
const dir = path.join(__dirname);

for (const file of files) {
  const full = path.join(dir, file);
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n');
  
  console.log(`\n=== ${file} ===`);
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const lineNum = i + 1;
    
    if (!l.includes('\ufffd')) continue;
    
    // Check if it's a pure comment line (starts with // or *)
    const trimmed = l.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      // In comments - check if code is merged after //
      const m = l.match(/^(\s*\/\/.*?)\ufffd\s{2,}(\S.*)$/);
      if (m) {
        console.log(`  L${lineNum} [comment+code merge]: ${l.substring(0, 160)}`);
      }
      continue;
    }
    
    // Not a pure comment - this is a syntax issue
    console.log(`  L${lineNum} [code corruption]: ${l.substring(0, 160)}`);
  }
}
