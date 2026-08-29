const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Fehler: dist-Ordner wurde nicht erstellt!');
  process.exit(1);
}

// 1. .nojekyll erstellen
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
console.log('OK: .nojekyll erstellt.');

// 2. index.html Pfade RELATIV machen
const indexHtmlPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Wir entfernen JEDEN führenden Schrägstrich vor _expo oder assets, damit die Pfade relativ werden
  // Beispiel: src="/_expo/..." wird zu src="_expo/..."
  html = html.replace(/src="\/_expo/g, 'src="_expo')
             .replace(/href="\/_expo/g, 'href="_expo')
             .replace(/"\/_expo/g, '"_expo')
             .replace(/src="\/assets/g, 'src="assets')
             .replace(/href="\/assets/g, 'href="assets');

  fs.writeFileSync(indexHtmlPath, html);

  // Kopie für 404.html (erlaubt Refresh auf Unterseiten)
  fs.copyFileSync(indexHtmlPath, path.join(distDir, '404.html'));
  console.log('OK: Pfade in index.html auf RELATIV korrigiert und nach 404.html kopiert.');
}

console.log('Post-Build Fixes erfolgreich abgeschlossen.');
