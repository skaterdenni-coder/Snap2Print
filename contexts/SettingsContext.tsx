import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE = 'tripo_api_key'; // Geändert von meshy_api_key

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [apiKey, setApiKeyState] = useState<string>('tsk_SlsRbNuJ1LlNsLUJlfqAsQxDSiuRxfC8Vpst3EJsmWq');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    SecureStore.getItemAsync(API_KEY_STORAGE).then((stored) => {
      if (stored) {
        setApiKeyState(stored);
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

  const hasApiKey = apiKey.length > 0;

  return { apiKey, setApiKey, hasApiKey, isLoaded };
});
