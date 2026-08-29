const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Fehler: dist-Ordner wurde nicht erstellt! Expo export ist fehlgeschlagen.');
  process.exit(1);
}

// 1. .nojekyll erstellen (verhindert, dass GitHub Ordner mit Unterstrich wie _expo ignoriert)
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
console.log('OK: .nojekyll erstellt.');

// 2. index.html anpassen (Pfade RELATIV machen) und nach 404.html kopieren
const indexHtmlPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Wir machen alle Pfade relativ, indem wir den führenden Schrägstrich entfernen
  // Beispiel: src="/_expo/..." wird zu src="_expo/..."
  html = html.replace(/src="\/_expo/g, 'src="_expo')
             .replace(/href="\/_expo/g, 'href="_expo')
             .replace(/"\/_expo/g, '"_expo');

  fs.writeFileSync(indexHtmlPath, html);

  // Kopie für 404.html (erlaubt Refresh auf Unterseiten)
  fs.copyFileSync(indexHtmlPath, path.join(distDir, '404.html'));
  console.log('OK: Pfade in index.html korrigiert und nach 404.html kopiert.');
} else {
  console.error('Fehler: dist/index.html wurde nicht gefunden!');
  process.exit(1);
}

console.log('Post-Build Fixes erfolgreich abgeschlossen.');
