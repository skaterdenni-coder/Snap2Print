import { Tabs } from 'expo-router';
import { Box, Clock, Settings } from 'lucide-react-native';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { rainbowGradient } from '@/constants/colors';

export default function TabLayout() {
  const { colors, mode } = useTheme();
  const isRainbow = mode === 'rainbow';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isRainbow ? '#FF6B6B' : colors.accent,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Erstellen',
          tabBarIcon: ({ color, size }) => <Box size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historie',
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
