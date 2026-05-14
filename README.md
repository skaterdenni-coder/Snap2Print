# Snap2XR 2D zu 3D Anwendung

**Snap2XR** ist eine leistungsstarke mobile Anwendung, die mithilfe von KI-Technologie 2D-Fotos in hochwertige 3D-Modelle verwandelt und diese sofort für Augmented Reality (AR) bereitstellt.

## ✨ Hauptmerkmale

- **KI-gestützte 3D-Generierung**: Nutzt die Tripo AI Engine für die blitzschnelle Erstellung von 3D-Modellen aus Fotos.
- **Flexibler Workflow**:
    - **Single-View**: Erstelle ein Modell aus nur einem einzigen Foto (Ideal für schnelle Entwürfe).
    - **Multiview**: Nutze bis zu 4 Perspektiven (Vorne, Links, Rechts, Hinten) für hochpräzise Ergebnisse.
- **Intelligente Benennung**: 
    - Automatische Erkennung von Objekten durch Tripo AI Tags.
    - Fallback auf Zeitstempel-Format (z.B. "Modell 24.05. 14:30") für eine übersichtliche Historie.
- **Persistente Historie**: Deine erstellten Modelle werden lokal gespeichert und sind jederzeit wieder abrufbar.
- **One-Click AR Sharing**:
    - Schneller Upload zu Cloud-Speicherdiensten.
    - Sofortige AR-Vorschau für Android (Scene Viewer) und iOS (Quick Look).
- **Hintergrund-Synchronisation**: Aufgaben laufen weiter, auch wenn die App minimiert wird.

## 🤖 API & Logik

Die App implementiert den neuesten **Tripo OpenAPI** Standard:

1.  **Bild-Upload**: Optimierter Upload-Prozess für maximale Stabilität und geringen Datenverbrauch.
2.  **Task-Management**: Intelligente Unterscheidung zwischen `image_to_model` (Single-View) und `multiview_to_model` (Multiview).
3.  **Status-Polling**: Echtzeit-Überwachung des Fortschritts mit visueller Rückmeldung für den Nutzer.

## 🛠 Technologien

- **Framework**: React Native mit Expo (TypeScript)
- **Design**: Modernes UI-System mit adaptiven Themes (Hell, Dunkel & Rainbow-Mode)
- **State Management**: Zustand & TanStack Query
- **Storage**: AsyncStorage für die Historie & Expo SecureStore für sensible API-Keys
- **Icons**: Lucide React Native

## 🚀 Installation & Start

1.  **Dependencies installieren**:
    ```sh
    bun install
    ```
2.  **API Key konfigurieren**:
    Trage deinen API-Key von [tripo3d.ai](https://www.tripo3d.ai/) in den App-Einstellungen ein.
3.  **App starten**:
    ```sh
    bun start
    ```

---
*Snap2XR - Die Brücke zwischen Fotografie und Augmented Reality.*
