import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function HomeLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
