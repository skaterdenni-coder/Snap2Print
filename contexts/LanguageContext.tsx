import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'app_language';

export type Language = 'de' | 'en';

const translations = {
  de: {
    // Tabs
    tabHome: 'Erstellen',
    tabHistory: 'Historie',
    tabSettings: 'Einstellungen',

    // Home
    selectImages: 'Bilder auswählen',
    createModel: '3D-Modell erstellen',
    activeTasks: 'Aktive Aufgaben',
    textureOptimization: 'Textur-Optimierung...',
    arShare: 'AR TEILEN',
    minOneImage: 'Mindestens 1 Bild nötig.',
    singleViewTitle: 'Single-View Modus',
    singleViewDesc: 'Du hast nur ein Bild ausgewählt. Das 3D-Modell wird erstellt, aber das Ergebnis ist mit nur einer Ansicht oft weniger präzise als mit mehreren Bildern. Fortfahren?',
    cancel: 'Abbrechen',
    create: 'Erstellen',
    error: 'Fehler',
    uploadFailed: 'Upload fehlgeschlagen',
    processingFailed: 'Modell-Verarbeitung fehlgeschlagen',
    placeholders: {
      front: '45° Vorne',
      left: 'Links',
      right: 'Rechts',
      back: 'Hinten'
    },
    status: {
      pending: 'Wartend',
      progress: 'Wird verarbeitet',
      success: 'Fertig',
      failed: 'Fehlgeschlagen',
      expired: 'Abgelaufen'
    },

    // History
    historyTitle: 'Historie',
    deleteAll: 'Alle löschen',
    model: 'Modell',
    models: 'Modelle',
    noModels: 'Keine Modelle',
    emptyHistory: 'Erstellte 3D-Modelle werden hier automatisch gespeichert.',
    deleteHistoryTitle: 'Historie löschen',
    deleteHistoryDesc: 'Möchtest du wirklich alle Einträge löschen? Dies kann nicht rückgängig gemacht werden.',
    delete: 'Löschen',
    expiredLabel: 'Abgelaufen',
    timeLeft: 'übrig',
    daysLeft: 'Tage übrig',

    // Settings
    settingsTitle: 'Einstellungen',
    apiKey: 'Tripo API-Key',
    save: 'Speichern',
    appearance: 'Erscheinungsbild',
    appearanceDesc: 'Wähle dein bevorzugtes Design',
    light: 'Hell',
    dark: 'Dunkel',
    rainbow: 'Regenbogen',
    language: 'Sprache',
    languageDesc: 'Wähle die App-Sprache',
    help: 'Hilfe',
    aboutApp: 'Über diese App',
    aboutAppDesc: 'Hintergrund und Ziel dieser Anwendung',
    baInfoTitle: 'Snap2Print ',
    baInfoText: 'Diese App wurde von Dennis Werner entwickelt. Sie ist eine speziell für den 3D-Druck optimierte Erweiterung der Anwendung Snap2XR.\n\nDas Ziel des Projekts ist eine nutzerzentrierte Lösung, um die Hürden bei der Erstellung von 3D-Modellen zu senken. Durch den Einsatz moderner KI-Schnittstellen ermöglicht Snap2Print das Erzeugen hochwertiger 3D-Assets aus einfachen Fotos, um diese ohne Expertenwissen direkt für den 3D-Druck vorzubereiten.',
                close: 'Schließen',
  },
  en: {
    // Tabs
    tabHome: 'Create',
    tabHistory: 'History',
    tabSettings: 'Settings',

    // Home
    selectImages: 'Select Images',
    createModel: 'Create 3D Model',
    activeTasks: 'Active Tasks',
    textureOptimization: 'Texture Optimization...',
    arShare: 'SHARE AR',
    minOneImage: 'At least 1 image required.',
    singleViewTitle: 'Single-View Mode',
    singleViewDesc: 'You have only selected one image. The 3D model will be created, but the result is often less precise with only one view than with multiple images. Continue?',
    cancel: 'Cancel',
    create: 'Create',
    error: 'Error',
    uploadFailed: 'Upload failed',
    processingFailed: 'Model processing failed',
    placeholders: {
      front: '45° Front',
      left: 'Left',
      right: 'Right',
      back: 'Back'
    },
    status: {
      pending: 'Pending',
      progress: 'Processing',
      success: 'Finished',
      failed: 'Failed',
      expired: 'Expired'
    },

    // History
    historyTitle: 'History',
    deleteAll: 'Clear all',
    model: 'Model',
    models: 'Models',
    noModels: 'No models',
    emptyHistory: 'Created 3D models will be automatically saved here.',
    deleteHistoryTitle: 'Delete History',
    deleteHistoryDesc: 'Are you sure you want to delete all entries? This cannot be undone.',
    delete: 'Delete',
    expiredLabel: 'Expired',
    timeLeft: 'left',
    daysLeft: 'days left',

    // Settings
    settingsTitle: 'Settings',
    apiKey: 'Tripo API Key',
    save: 'Save',
    appearance: 'Appearance',
    appearanceDesc: 'Choose your preferred design',
    light: 'Light',
    dark: 'Dark',
    rainbow: 'Rainbow',
    language: 'Language',
    languageDesc: 'Select app language',
    help: 'Help',
    aboutApp: 'About this App',
    aboutAppDesc: 'Background and goal of this project ',
    baInfoTitle: 'Snap2Print ',
    baInfoText: 'This app was developed by Dennis Werner. It is an extension of the Snap2XR application specifically optimized for 3D printing.\n\nThe goal of the project is to provide a user-centered solution that lowers the barriers to creating 3D models. By leveraging modern AI interfaces, Snap2Print enables the generation of high-quality 3D assets from simple photos, preparing them directly for 3D printing without requiring expert knowledge.',
                close: 'Close',
  }
};

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [language, setLanguageState] = useState<Language>('de');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
      if (stored === 'enj' || stored === 'de') {
        setLanguageState(stored);
      }
      setIsLoaded(true);
    });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  const t = translations[language] || translations.de;

  return { language, setLanguage, t, isLoaded };
});
