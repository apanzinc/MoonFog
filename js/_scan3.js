const fs = require('fs');
const path = require('path');

const files = ['app.js', 'settings.js', 'oobe.js', 'shortcuts.js', 'background.js', 'greeting.js', 'theme.js'];
const dir = path.join(__dirname);

for (const file of files) {
  const full = path.join(dir, file);
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const lineNum = i + 1;
    
    // Pattern 1: comment // followed by code on same line (corrupted newline)
    // Match: // ... <garbage> ... <code>
    const commentCodeMatch = l.match(/^(\s*\/\//.*?)\ufffd\s{2,}(\S.*)$/);
    if (commentCodeMatch) {
      issues.push({ line: lineNum, type: 'comment+code', content: l.substring(0, 160) });
    }
    
    // Pattern 2: single-quoted string with ffdd before closing quote
    // e.g. 'text\ufffd' or 'text\ufffd,
    const sqStrIssue = l.match(/'[^']*\ufffd[^']*'/);
    if (sqStrIssue && !l.match(/^\s*\/\//) && !l.match(/^\s*\*/)) {
      issues.push({ line: lineNum, type: 'broken-sq-string', content: l.substring(0, 160) });
    }
    
    // Pattern 3: unclosed single-quoted string (fffd at end or before , or before ;)
    const unclosedSq = l.match(/'[^']*'\s*[,;]\s*$/);
    // This is fine - legitimate
    const unclosedSqBad = l.match(/'[^']*\ufffd\s*[,;]\s*$/);
    if (unclosedSqBad && !l.match(/^\s*\/\//) && !l.match(/^\s*\*/)) {
      issues.push({ line: lineNum, type: 'unclosed-sq-string', content: l.substring(0, 160) });
    }
  }
  
  if (issues.length > 0) {
    console.log(`\n=== ${file} ===`);
    for (const issue of issues) {
      console.log(`  L${issue.line} [${issue.type}]: ${issue.content}`);
    }
  }
}
