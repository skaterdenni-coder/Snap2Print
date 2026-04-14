# Welcome to your Scan2XR

2D‑to‑XR Vehicle Modeler
Erstellt aus bis zu 4 Fotos automatisch ein 3D‑Modell und visualisiert es in Mixed Reality.  
Die App nutzt die Meshy.ai‑API, um aus 2D‑Bildern hochwertige 3D‑Meshes zu generieren.

Features
2D → 3D‑Konvertierung über die Meshy.ai‑API
Bis zu 4 Eingabebilder (Front, Seite, Heck, Detail)
Automatische Mesh‑Generierung (OBJ/GLB)
Direkte XR‑Visualisierung (z. B. HoloLens, Meta Quest, Smartphone‑AR)
API‑Key‑Konfiguration direkt in der App
Fahrzeug‑optimierte Pipeline für realistische Modelle

Funktionsweise
Nutzer lädt 1–4 Bilder eines Fahrzeugs hoch.
Die App sendet die Bilder an die Meshy.ai‑API.
Meshy erzeugt ein 3D‑Modell (Mesh + Texturen).
Das Modell wird in der App geladen und in XR dargestellt.
Nutzer kann das Modell skalieren, drehen und im Raum platzieren.

Installation & Setup
1. Repository klonen
bash
git clone https://github.com/<dein-user>/<dein-repo>.git
cd <dein-repo>
2. Abhängigkeiten installieren
(Beispiel für Node.js – passe es an deine Tech‑Stack an)
bash
npm install
3. Meshy.ai API‑Key eintragen
In der App‑Einstellungsseite oder in einer .env Datei:
env
MESHY_API_KEY=dein_api_key_hier
Den API‑Key erhältst du unter:
https://dashboard.meshy.ai

Nutzung
1. App starten
bash
npm run start
2. Bilder hochladen
Mindestens 1 Bild
Optimal 3–4 Bilder (Front, Seite, Heck)
3. 3D‑Modell generieren
Die App zeigt den Fortschritt der Meshy‑Generierung an.
4. Modell in XR ansehen
Modell wird automatisch geladen
Platzierung im Raum
Skalierung & Rotation
Ideal für Fahrzeug‑Showcases, MR‑Präsentationen oder Engineering‑Visualisierung

Beispiel‑API‑Call (Meshy.ai)
javascript
const formData = new FormData();
formData.append("image1", file1);
formData.append("image2", file2);
formData.append("image3", file3);
formData.append("image4", file4);
const response = await fetch("https://api.meshy.ai/v1/image-to-3d", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.MESHY_API_KEY}`
  },
  body: formData
});
const result = await response.json();
console.log(result.model_url);

Output‑Formate
Meshy.ai  liefert typischerweise:
GLB (empfohlen für XR)
OBJ + MTL + Texturen
PBR‑Materialien
Die App lädt automatisch das GLB‑Modell.

Tech‑Stack (Beispiel)
Frontend: React / Unity / Flutter (je nach Projekt)
Backend: Node.js / Python
XR‑Framework: WebXR, Unity XR, ARCore/ARKit
3D‑Engine: Three.js / Unity

