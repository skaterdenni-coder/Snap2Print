import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Key, Eye, EyeOff, Sun, Moon, Rainbow, Check, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ThemeMode, rainbowGradient } from '@/constants/colors';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Hell', icon: Sun },
  { mode: 'dark', label: 'Dunkel', icon: Moon },
  { mode: 'rainbow', label: 'Regenbogen', icon: Rainbow },
];

export default function SettingsScreen() {
  const { colors, mode, setThemeMode } = useTheme();
  const { apiKey, setApiKey } = useSettings();
  const insets = useSafeAreaInsets();
  const [keyInput, setKeyInput] = useState<string>(apiKey);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const checkScale = useRef(new Animated.Value(0)).current;

  const isRainbow = mode === 'rainbow';

  const handleSaveKey = () => {
    setApiKey(keyInput.trim());
    setSaved(true);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(checkScale, { toValue: 0, duration: 600, delay: 1200, useNativeDriver: true }),
    ]).start(() => setSaved(false));
  };

  const handleThemeChange = (newMode: ThemeMode) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setThemeMode(newMode);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {isRainbow ? (
            <LinearGradient colors={rainbowGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.titleGradient}>
              <Text style={[styles.title, { color: '#FFF' }]}>Einstellungen</Text>
            </LinearGradient>
          ) : (
            <Text style={[styles.title, { color: colors.text }]}>Einstellungen</Text>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.accent + '15' }]}>
              <Key size={18} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Tripo API-Key</Text>

            </View>
          </View>

          <View style={[styles.inputRow, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
            <Shield size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="msy_xxxxxxxxxxxxxxxxxx"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
              testID="api-key-input"
            />
            <TouchableOpacity onPress={() => setShowKey(!showKey)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              {showKey ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: isRainbow ? undefined : colors.accent }]}
            onPress={handleSaveKey}
            activeOpacity={0.8}
            testID="save-api-key"
          >
            {isRainbow && (
              <LinearGradient
                colors={rainbowGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {saved ? (
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Check size={20} color="#FFF" />
              </Animated.View>
            ) : (
              <Text style={styles.saveButtonText}>Speichern</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.accent + '15' }]}>
              <Sun size={18} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Erscheinungsbild</Text>
              <Text style={[styles.sectionDescription, { color: colors.textTertiary }]}>
                Wähle dein bevorzugtes Design
              </Text>
            </View>
          </View>

          <View style={styles.themeGrid}>
            {THEME_OPTIONS.map((option) => {
              const isActive = mode === option.mode;
              const IconComp = option.icon;
              return (
                <TouchableOpacity
                  key={option.mode}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: isActive
                        ? option.mode === 'rainbow'
                          ? undefined
                          : colors.accent + '15'
                        : colors.inputBackground,
                      borderColor: isActive ? colors.accent : colors.inputBorder,
                      borderWidth: isActive ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleThemeChange(option.mode)}
                  activeOpacity={0.7}
                  testID={`theme-${option.mode}`}
                >
                  {isActive && option.mode === 'rainbow' && (
                    <LinearGradient
                      colors={rainbowGradient.map((c) => c + '20') as unknown as readonly [string, string, ...string[]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  {option.mode === 'rainbow' ? (
                    <LinearGradient
                      colors={rainbowGradient}
                      style={styles.themeIconGradient}
                    >
                      <IconComp size={22} color="#FFF" />
                    </LinearGradient>
                  ) : (
                    <IconComp
                      size={22}
                      color={isActive ? colors.accent : colors.textSecondary}
                    />
                  )}
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: isActive ? colors.accent : colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isActive && (
                    <View style={[styles.activeIndicator, { backgroundColor: colors.accent }]}>
                      <Check size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          Powered by Tripo.Ai V3.1.4• App Bachelor 2026
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 28,
  },
  titleGradient: {
    borderRadius: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  sectionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  sectionDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  saveButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    overflow: 'hidden',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    overflow: 'hidden',
    gap: 8,
  },
  themeIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  activeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 20,
  },
});
