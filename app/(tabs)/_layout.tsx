import { Tabs } from 'expo-router';
import { Box, Clock, Settings } from 'lucide-react-native';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { rainbowGradient } from '@/constants/colors';

export default function TabLayout() {
  const { colors, mode } = useTheme();
  const { t } = useLanguage();
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
          title: t.tabHome,
          tabBarIcon: ({ color, size }) => <Box size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t.tabHistory,
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabSettings,
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
