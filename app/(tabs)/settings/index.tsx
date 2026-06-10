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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Key, Eye, EyeOff, Sun, Moon, Rainbow, Check, Shield, Languages, HelpCircle, Zap, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings, QualityMode } from '@/contexts/SettingsContext';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { ThemeMode, rainbowGradient } from '@/constants/colors';

const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun }[] = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'rainbow', icon: Rainbow },
];

export default function SettingsScreen() {
  const { colors, mode, setThemeMode } = useTheme();
  const { apiKey, setApiKey, qualityMode, setQualityMode } = useSettings();
  const { language, setLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [keyInput, setKeyInput] = useState<string>(apiKey);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [darkClicks, setDarkClicks] = useState<number>(0);
  const [langSwitches, setLangSwitches] = useState<number>(0);
  const [lastLang, setLastLang] = useState<Language>(language);
  const [isRainbowUnlocked, setIsRainbowUnlocked] = useState<boolean>(mode === 'rainbow');
  const [isQualityUnlocked, setIsQualityUnlocked] = useState<boolean>(false);
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

    if (newMode === 'dark') {
      const nextClicks = darkClicks + 1;
      setDarkClicks(nextClicks);
      if (nextClicks >= 5) {
        setIsRainbowUnlocked(true);
      }
    } else {
      setDarkClicks(0);
    }

    setThemeMode(newMode);
  };

  const handleLanguageChange = (newLang: Language) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (newLang !== lastLang) {
      const nextSwitches = langSwitches + 1;
      setLangSwitches(nextSwitches);
      setLastLang(newLang);
      if (nextSwitches >= 10) { // 5 mal abwechselnd = 10 Wechsel
        if (!isQualityUnlocked) {
          setIsQualityUnlocked(true);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          Alert.alert("Secret Unlocked", "Quality Selector is now available!");
        }
      }
    }

    setLanguage(newLang);
  };

  const openHelp = () => {
    Linking.openURL('https://youtu.be/Sky7DNAcJPo');
  };

  const getThemeLabel = (mode: ThemeMode) => {
    if (mode === 'light') return t.light;
    if (mode === 'dark') return t.dark;
    return t.rainbow;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          {isRainbow ? (
            <LinearGradient colors={rainbowGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.titleGradient}>
              <Text style={[styles.title, { color: '#FFF' }]}>{t.settingsTitle}</Text>
            </LinearGradient>
          ) : (
            <Text style={[styles.title, { color: colors.text }]}>{t.settingsTitle}</Text>
          )}

          <TouchableOpacity
            style={[styles.helpButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={openHelp}
            accessibilityLabel={t.help}
          >
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>?</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.accent + '15' }]}>
              <Key size={18} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.apiKey}</Text>

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
              <Text style={styles.saveButtonText}>{t.save}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.accent + '15' }]}>
              <Sun size={18} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.appearance}</Text>
              <Text style={[styles.sectionDescription, { color: colors.textTertiary }]}>
                {t.appearanceDesc}
              </Text>
            </View>
          </View>

          <View style={styles.themeGrid}>
            {THEME_OPTIONS.filter(opt => opt.mode !== 'rainbow' || isRainbowUnlocked).map((option) => {
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
                    {getThemeLabel(option.mode)}
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

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.accent + '15' }]}>
              <Languages size={18} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.language}</Text>
              <Text style={[styles.sectionDescription, { color: colors.textTertiary }]}>
                {t.languageDesc}
              </Text>
            </View>
          </View>

          <View style={styles.themeGrid}>
            {(['de', 'en'] as const).map((lang) => {
              const isActive = language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: isActive ? colors.accent + '15' : colors.inputBackground,
                      borderColor: isActive ? colors.accent : colors.inputBorder,
                      borderWidth: isActive ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleLanguageChange(lang)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: isActive ? colors.accent : colors.textSecondary, fontSize: 16 },
                    ]}
                  >
                    {lang === 'de' ? 'Deutsch' : 'English'}
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

        {isQualityUnlocked && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: colors.accent + '15' }]}>
                <Sparkles size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Generation Quality</Text>
                <Text style={[styles.sectionDescription, { color: colors.textTertiary }]}>
                  Choose between speed and high fidelity
                </Text>
              </View>
            </View>

            <View style={styles.themeGrid}>
              {(['fast', 'detailed'] as const).map((q) => {
                const isActive = qualityMode === q;
                const Icon = q === 'fast' ? Zap : Sparkles;
                return (
                  <TouchableOpacity
                    key={q}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: isActive ? colors.accent + '15' : colors.inputBackground,
                        borderColor: isActive ? colors.accent : colors.inputBorder,
                        borderWidth: isActive ? 2 : 1,
                      },
                    ]}
                    onPress={() => {
                      setQualityMode(q);
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon size={22} color={isActive ? colors.accent : colors.textSecondary} />
                    <Text
                      style={[
                        styles.themeLabel,
                        { color: isActive ? colors.accent : colors.textSecondary, fontSize: 16 },
                      ]}
                    >
                      {q === 'fast' ? 'Fast' : 'Detailed'}
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
        )}

        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          created by Dennis Werner 2026 V0.5.6.IS3
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
  helpButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    fontSize: 18,
    fontWeight: '700' as const,
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
