# Snap2XR AR Sharing 🚀

**Snap2XR AR Sharing** ist eine leistungsstarke mobile Anwendung, mit der du aus einfachen 2D-Bildern beeindruckende 3D-Modelle erstellen und diese sofort in Augmented Reality (AR) teilen kannst.

## ✨ Hauptmerkmale

- **Image-to-3D KI**: Verwandelt Fotos mithilfe der Meshy AI API in hochwertige 3D-Modelle (.glb).
- **Multi-View Support**: Nutze bis zu 4 Perspektiven (45°, Links, Rechts, Hinten), um die Genauigkeit und Details deiner 3D-Modelle zu maximieren.
- **AR Sharing Workflow**:
    1. Generiere dein Modell in der App.
    2. Lade es automatisch auf **Litterbox (catbox.moe)** hoch.
    3. Erhalte einen fertigen Link für den **Web AR-Viewer**.
    4. Teile den Link, damit andere dein Modell sofort in AR betrachten können.
- **Dauerhafte Aufgaben-Speicherung**: Schließe die App während der Generierung – der Fortschritt wird gespeichert und die App setzt die Arbeit beim nächsten Start automatisch fort.
- **Historie**: Behalte den Überblick über alle deine erstellten Modelle und teile sie jederzeit erneut.
- **Rainbow Theme**: Ein frisches, helles Design mit lebendigen Regenbogen-Farben für eine moderne Benutzererfahrung.

## 🛠 Technologien

- **Framework**: Expo / React Native (TypeScript)
- **KI-Integration**: Meshy AI Open API
- **Hosting**: Litterbox API (für temporäres Modell-Hosting)
- **AR-Viewer**: [Web-basierter AR-Viewer](https://skaterdenni-coder.github.io/AR-Viewer/)
- **State Management**: TanStack Query (React Query) & Zustand
- **Speicherung**: AsyncStorage für Historie und aktive Tasks

## 🚀 Installation & Start

1. **Abhängigkeiten installieren**:
   ```sh
   npm install
   bun install
   ```
2. **API-Key konfigurieren**:
   Hinterlege deinen Meshy AI API-Key in den App-Einstellungen.
3. **App auf dem Emulator/Handy starten**:
   ```sh
   npx expo run:android
   ```

## 📸 AR Viewer Integration

Die App ist nahtlos mit dem [AR Model Viewer](https://skaterdenni-coder.github.io/AR-Viewer/) verknüpft. Sobald ein Modell generiert und hochgeladen wurde, wird ein Link im Format:
`https://skaterdenni-coder.github.io/AR-Viewer/?model=DEIN_LITTERBOX_LINK`
erstellt, der direkt im Browser (Safari/Chrome) AR-Funktionen wie **Scene Viewer** (Android) und **Quick Look** (iOS) unterstützt.

---
Created by **Simba** | Snap2XR Project
