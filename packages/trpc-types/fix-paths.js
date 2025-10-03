const fs = require('fs');
const path = require('path');

// Fix path aliases in generated .d.ts files to use relative paths
const indexDts = path.join(__dirname, 'dist', 'index.d.ts');
const content = fs.readFileSync(indexDts, 'utf8');

// Replace @server-dist/ with ./server/
const fixed = content.replace(/@server-dist\//g, './server/');

fs.writeFileSync(indexDts, fixed, 'utf8');
console.log('✓ Fixed path aliases in dist/index.d.ts');