const fs = require('fs');
const path = require('path');

const resultsDir = path.join(__dirname, 'results');
const outputFile = path.join(__dirname, 'lyricsData.js');

let output = 'export const lyrics = {\n';

fs.readdirSync(resultsDir)
  .filter(file => file.endsWith('.lrc'))
  .forEach(file => {
    const content = fs.readFileSync(path.join(resultsDir, file), 'utf8');
    const escapedContent = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    output += `  "${file}": \`${escapedContent}\`,\n`;
  });

output += '};\n';

fs.writeFileSync(outputFile, output);
console.log('Lyrics data file generated!');