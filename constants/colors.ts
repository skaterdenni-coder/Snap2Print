export type ThemeMode = 'light' | 'dark' | 'rainbow';

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSecondary: string;
  danger: string;
  success: string;
  warning: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarInactive: string;
  inputBackground: string;
  inputBorder: string;
  statusBarStyle: 'light' | 'dark';
}

const dark: ThemeColors = {
  background: '#0A0A0C',
  backgroundSecondary: '#111114',
  card: '#18181C',
  cardBorder: '#2A2A30',
  text: '#F0F0F2',
  textSecondary: '#8E8E93',
  textTertiary: '#5A5A5E',
  accent: '#00D4AA',
  accentSecondary: '#00A88A',
  danger: '#FF453A',
  success: '#30D158',
  warning: '#FFD60A',
  tabBar: '#0A0A0C',
  tabBarBorder: '#1C1C1E',
  tabBarInactive: '#5A5A5E',
  inputBackground: '#1C1C20',
  inputBorder: '#2A2A30',
  statusBarStyle: 'light',
};

const light: ThemeColors = {
  background: '#F2F2F7',
  backgroundSecondary: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#E5E5EA',
  text: '#1C1C1E',
  textSecondary: '#6B6B70',
  textTertiary: '#AEAEB2',
  accent: '#00A88A',
  accentSecondary: '#008F75',
  danger: '#FF3B30',
  success: '#34C759',
  warning: '#FFCC00',
  tabBar: '#FFFFFF',
  tabBarBorder: '#D1D1D6',
  tabBarInactive: '#AEAEB2',
  inputBackground: '#F2F2F7',
  inputBorder: '#D1D1D6',
  statusBarStyle: 'dark',
};

const rainbow: ThemeColors = {
  background: '#F8F9FD',
  backgroundSecondary: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#E8EAF6',
  text: '#1C1C1E',
  textSecondary: '#546E7A',
  textTertiary: '#90A4AE',
  accent: '#FF6B6B',
  accentSecondary: '#48DBFB',
  danger: '#FF5E57',
  success: '#1DD1A1',
  warning: '#FFC048',
  tabBar: '#FFFFFF',
  tabBarBorder: '#EEEEEE',
  tabBarInactive: '#AEAEB2',
  inputBackground: '#F2F2F7',
  inputBorder: '#E0E0E0',
  statusBarStyle: 'dark',
};

export const rainbowGradient: readonly [string, string, ...string[]] = [
  '#FF6B6B', // Red
  '#48DBFB', // Blue
  '#1DD1A1', // Green
  '#FECA57', // Yellow
  '#C084FC', // Purple
  '#FF9F43', // Orange
  '#FF9FF3'  // Pink
] as const;

const themes: Record<ThemeMode, ThemeColors> = { dark, light, rainbow };

export default themes;
