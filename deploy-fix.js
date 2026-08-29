const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Fehler: dist-Ordner wurde nicht erstellt! Expo export ist fehlgeschlagen.');
  process.exit(1);
}

// 1. .nojekyll erstellen (Zwingend für GitHub Pages, um _expo Ordner zu erlauben)
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
console.log('OK: .nojekyll erstellt.');

// 2. index.html nach 404.html kopieren (Zwingend für Routing im Web)
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexHtml, path.join(distDir, '404.html'));
  console.log('OK: index.html nach 404.html kopiert.');
} else {
  console.error('Fehler: dist/index.html wurde nicht gefunden!');
  process.exit(1);
}

console.log('Post-Build Fixes erfolgreich abgeschlossen.');
