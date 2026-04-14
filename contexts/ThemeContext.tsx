import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo } from 'react';
import themes, { ThemeColors, ThemeMode } from '@/constants/colors';

const THEME_STORAGE_KEY = 'app_theme_mode';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'rainbow') {
        setMode(stored);
      }
      setIsLoaded(true);
    });
  }, []);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  const colors: ThemeColors = useMemo(() => themes[mode], [mode]);

  return { mode, setThemeMode, colors, isLoaded };
});
