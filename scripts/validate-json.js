import { readFileSync } from 'fs';

const files = [
  'manifest.json',
  'manifest.firefox.json',
  '_locales/en/messages.json',
  '_locales/fr/messages.json'
];

let hasError = false;
for (const file of files) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
    console.log(`ok ${file}`);
  } catch (e) {
    console.error(`FAIL ${file}: ${e.message}`);
    hasError = true;
  }
}

// Check EN/FR key parity
const en = Object.keys(JSON.parse(readFileSync('_locales/en/messages.json', 'utf8')));
const fr = Object.keys(JSON.parse(readFileSync('_locales/fr/messages.json', 'utf8')));
const missingInFr = en.filter(k => !fr.includes(k));
if (missingInFr.length) {
  console.error(`FAIL Missing keys in FR: ${missingInFr.join(', ')}`);
  hasError = true;
} else {
  console.log('ok EN/FR key parity');
}

process.exit(hasError ? 1 : 0);
