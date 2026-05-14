import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { HistoryProvider, useHistory } from '@/contexts/HistoryContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isLoaded: langLoaded } = useLanguage();
  const { isLoaded: histLoaded } = useHistory();

  useEffect(() => {
    if (langLoaded && histLoaded) {
      SplashScreen.hideAsync();
    }
  }, [langLoaded, histLoaded]);

  if (!langLoaded || !histLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <LanguageProvider>
          <ThemeProvider>
            <SettingsProvider>
              <HistoryProvider>
                <RootLayoutNav />
              </HistoryProvider>
            </SettingsProvider>
          </ThemeProvider>
        </LanguageProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
