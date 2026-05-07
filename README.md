# Snap2XR AR Sharing Realisierung 🚀

**Snap2XR AR Sharing** ist eine mobile Anwendung, die mithilfe modernster KI-Technologie 2D-Fotos in hochwertige 3D-Modelle verwandelt und diese für Augmented Reality (AR) zugänglich macht.

## ✨ Hauptmerkmale

- **Tripo AI P1 Integration**: Nutzt die neueste Tripo AI Engine für schnelle und präzise 3D-Modellierung.
- **Automatisierter Multiview-Workflow**:
    - Lädt bis zu 4 Bilder (Vorne, Links, Rechts, Hinten) hoch.
    - Erstellt automatisch ein 3D-Mesh.
    - Startet nach der Mesh-Erstellung sofort ein **Texture Refinement** für fotorealistische PBR-Materialien.
- **Echtzeit-Tracking**: Live-Fortschrittsanzeige während der Generierung.
- **One-Click AR Sharing**:
    - Automatischer GLB-Upload zu **Litterbox (catbox.moe)**.
    - Generierung eines AR-Viewer Links für Android (Scene Viewer) und iOS (Quick Look).
- **Persistent State**: Aufgaben laufen im Hintergrund weiter und werden auch nach einem App-Neustart korrekt wieder aufgenommen.

## 🤖 Tripo AI API Funktionen

Die App implementiert den **Tripo V2 OpenAPI** Standard mit folgendem Ablauf:

1.  **`/upload` (Multipart/Form-Data)**: Jedes ausgewählte Bild wird einzeln hochgeladen, um einen `file_token` zu erhalten. Dies optimiert den Speicherverbrauch und die Stabilität gegenüber Base64-Transfers.
2.  **`/task` (multiview_to_model)**: Erstellt den ersten Entwurf des Modells.
    - **Modell**: `P1-20260311`
    - **Anordnung**: Automatische Sortierung der Bilder in die Tripo-Reihenfolge `[Front, Left, Back, Right]`.
    - **Parameter**: `face_limit: 4000`, `texture: true`, `pbr: true`.
3.  **`/task` (texture_model)**: Sobald der Entwurf fertig ist, wird automatisch dieser Task aufgerufen, um die Texturqualität massiv zu verbessern.
    - Nutzt `original_model_task_id` zur Verknüpfung mit dem Draft.
4.  **`/task/{task_id}` (Polling)**: Überwacht den Status (`queued`, `running`, `success`, `failed`) und den Fortschritt in Echtzeit.

## 🛠 Technologien

- **Frontend**: React Native mit Expo (TypeScript)
- **Styling**: Custom Theme mit Rainbow-Gradient Unterstützung
- **State Management**: TanStack Query & Zustand
- **Storage**: AsyncStorage & Expo SecureStore (für API-Keys)
- **Icons**: Lucide React Native

## 🚀 Schnellstart

1.  **Installation**:
    ```sh
    npm install --legacy-peer-deps
    ```
2.  **API Key**:
    Hole dir einen Key auf [tripo3d.ai](https://www.tripo3d.ai/) und trage ihn in den App-Einstellungen unter "Tripo API Key" ein.
3.  **Starten**:
    ```sh
    npx expo start -c
    ```

---
*Entwickelt für kreative Köpfe, die die Lücke zwischen 2D und AR schließen wollen.*
