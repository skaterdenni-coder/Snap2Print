import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE = 'tripo_api_key';
const QUALITY_MODE_STORAGE = 'quality_mode';

export type QualityMode = 'fast' | 'detailed' | 'extreme';

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [apiKey, setApiKeyState] = useState<string>('');
  const [qualityMode, setQualityModeState] = useState<QualityMode>('detailed');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(API_KEY_STORAGE),
      SecureStore.getItemAsync(QUALITY_MODE_STORAGE)
    ]).then(([storedKey, storedMode]) => {
      if (storedKey) setApiKeyState(storedKey);
      if (storedMode === 'fast' || storedMode === 'detailed' || storedMode === 'extreme') {
        setQualityModeState(storedMode as QualityMode);
      }
      setIsLoaded(true);
    });
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    if (key) {
      SecureStore.setItemAsync(API_KEY_STORAGE, key);
    } else {
      SecureStore.deleteItemAsync(API_KEY_STORAGE);
    }
  }, []);

  const setQualityMode = useCallback((mode: QualityMode) => {
    setQualityModeState(mode);
    SecureStore.setItemAsync(QUALITY_MODE_STORAGE, mode);
  }, []);

  const hasApiKey = apiKey.length > 0;

  return { apiKey, setApiKey, hasApiKey, qualityMode, setQualityMode, isLoaded };
});
