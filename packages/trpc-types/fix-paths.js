const fs = require('fs');
const path = require('path');

// Fix path aliases in generated .d.ts files to use relative paths
const indexDts = path.join(__dirname, 'dist', 'index.d.ts');
const content = fs.readFileSync(indexDts, 'utf8');

// Replace @server-dist/ with ./server/
const fixed = content.replace(/@server-dist\//g, './server/');

fs.writeFileSync(indexDts, fixed, 'utf8');
console.log('✓ Fixed path aliases in dist/index.d.ts');

// Delete all .js files in src directory
const srcDir = path.join(__dirname, '../../', 'src');
const files = fs.readdirSync(srcDir, { recursive: true });

files
    .filter(file => file.endsWith('.js') || file.endsWith('.js.map') || file.endsWith('.d.ts') || file.endsWith('d.ts.map'))
    .forEach(file => {
        const fullPath = path.join(srcDir, file);
        fs.unlinkSync(fullPath);
        console.log(`Deleted: ${file}`);
    });

console.log('✓ Deleted all .js/.js.map/.d.ts/.d.ts.map files in src directory');