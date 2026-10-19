import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE = 'tripo_api_key';
const QUALITY_MODE_STORAGE = 'quality_mode';
export const DEFAULT_API_KEY = 'tsk_SlsRbNuJ1LlNsLUJlfqAsQxDSiuRxfC8Vpst3EJsmWq';
const OLD_KEY = 'tsk_gsgNHCOwT8ZE4QPgKSmX44Weni6RMM7NFLLZH4M7rgI';

export type QualityMode = 'fast' | 'detailed' | 'extreme';

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [apiKey, setApiKeyState] = useState<string>(DEFAULT_API_KEY);
  const [qualityMode, setQualityModeState] = useState<QualityMode>('detailed');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(API_KEY_STORAGE),
      SecureStore.getItemAsync(QUALITY_MODE_STORAGE)
    ]).then(([storedKey, storedMode]) => {
      if (storedKey && storedKey !== OLD_KEY) {
        setApiKeyState(storedKey);
      } else {
        setApiKeyState(DEFAULT_API_KEY);
        SecureStore.setItemAsync(API_KEY_STORAGE, DEFAULT_API_KEY);
      }
      if (storedMode === 'fast' || storedMode === 'detailed' || storedMode === 'extreme') {
        setQualityModeState(storedMode as QualityMode);
      }
      setIsLoaded(true);
    });
  }, []);

  const setApiKey = useCallback((key: string) => {
    const finalKey = key.trim() ? key.trim() : DEFAULT_API_KEY;
    setApiKeyState(finalKey);
    if (key.trim()) {
      SecureStore.setItemAsync(API_KEY_STORAGE, key.trim());
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
