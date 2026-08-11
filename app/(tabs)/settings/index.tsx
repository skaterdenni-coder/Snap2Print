import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Modal,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as KeepAwake from 'expo-keep-awake';
import { Key, Eye, EyeOff, Sun, Moon, Rainbow, Check, Shield, Languages, HelpCircle, Zap, Sparkles, Share2, RefreshCw, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings, QualityMode } from '@/contexts/SettingsContext';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useHistory } from '@/contexts/HistoryContext';
import { getTripoTaskStatus } from '@/utils/tripo';
import { uploadToLitterbox } from '@/utils/FileSharing';
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
  const { entries, updateEntry } = useHistory();
  const insets = useSafeAreaInsets();
  const [keyInput, setKeyInput] = useState<string>(apiKey);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [darkClicks, setDarkClicks] = useState<number>(0);
  const [deTaps, setDeTaps] = useState<number>(0);
  const [isSecretMenuVisible, setIsSecretMenuVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, label: '' });
  const [langSwitches, setLangSwitches] = useState<number>(0);
  const [lastLang, setLastLang] = useState<Language>(language);
  const [isRainbowUnlocked, setIsRainbowUnlocked] = useState<boolean>(mode === 'rainbow');
  const [isQualityUnlocked, setIsQualityUnlocked] = useState<boolean>(false);
  const checkScale = useRef(new Animated.Value(0)).current;

  const isRainbow = mode === 'rainbow';

  // Bildschirm aktiv halten während Synchronisation
  useEffect(() => {
    const handleKeepAwake = async () => {
      try {
        if (isSyncing) {
          await KeepAwake.activateKeepAwakeAsync();
        } else {
          await KeepAwake.deactivateKeepAwake();
        }
      } catch (e) {}
    };

    handleKeepAwake();
    return () => {
      KeepAwake.deactivateKeepAwake().catch(() => {});
    };
  }, [isSyncing]);

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

  const handleSecretExport = async () => {
    const validEntries = entries.filter(e => e.arUrl || e.glbDownloadUrl);
    if (validEntries.length === 0) {
      Alert.alert(t.error, language === 'de' ? 'Keine Links zum Teilen gefunden.' : 'No links found to share.');
      return;
    }

    let shareText = language === 'de' ? 'Meine 3D-Modelle:\n\n' : 'My 3D models:\n\n';
    validEntries.forEach((e, idx) => {
      const name = e.name || `${t.model} #${entries.length - idx}`;
      shareText += `• ${name}:\n`;
      if (e.arUrl) shareText += `  AR: ${e.arUrl}\n`;
      if (e.glbDownloadUrl) shareText += `  Download: ${e.glbDownloadUrl}\n`;
      shareText += '\n';
    });

    try {
      await Share.share({ message: shareText });
      setIsSecretMenuVisible(false);
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleSyncAll = async () => {
    if (!apiKey) return;
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: entries.length, label: 'Starte Synchronisation...' });

    try {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        setSyncProgress(prev => ({ ...prev, current: i + 1, label: `Verarbeite: ${entry.name || entry.taskId}` }));

        try {
          const tripoData = await getTripoTaskStatus(apiKey, entry.taskId);
          const glbUrl = tripoData.output?.pbr_model || tripoData.output?.model_url || tripoData.output?.model;

          if (glbUrl) {
            const litterboxUrl = await uploadToLitterbox(glbUrl, entry.modelHeightMeters);
            const viewerUrl = `https://skaterdenni-coder.github.io/AR-Viewer/?model=${encodeURIComponent(litterboxUrl)}`;
            const downloadUrl = `https://skaterdenni-coder.github.io/Snap2ModelDownload/?model=${encodeURIComponent(litterboxUrl)}`;

            updateEntry(entry.taskId, {
              arUrl: viewerUrl,
              arUrlGeneratedAt: new Date().toISOString(),
              glbDownloadUrl: downloadUrl,
              glbDownloadUrlGeneratedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.warn(`[Sync] Failed for ${entry.taskId}:`, err);
        }
      }
      Alert.alert(t.status.success, language === 'de' ? 'Alle Links wurden erfolgreich erneuert.' : 'All links have been successfully renewed.');
    } catch (err) {
      console.error('Sync all error:', err);
      Alert.alert(t.error, 'Synchronisation fehlgeschlagen.');
    } finally {
      setIsSyncing(false);
      setIsSecretMenuVisible(false);
    }
  };

  const handleLanguageChange = (newLang: Language) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (newLang === 'de') {
      const nextTaps = deTaps + 1;
      setDeTaps(nextTaps);
      if (nextTaps >= 10) {
        setDeTaps(0);
        setIsSecretMenuVisible(true);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      setDeTaps(0);
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
              placeholder="TSK_xxxxxxxxxxxxxxxxx"
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
              {(['fast', 'detailed', 'extreme'] as const).map((q) => {
                const isActive = qualityMode === q;
                const Icon = q === 'fast' ? Zap : q === 'detailed' ? Sparkles : Sparkles; // Might want another icon for extreme
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
                    {q === 'extreme' && isActive ? (
                      <LinearGradient
                        colors={rainbowGradient}
                        style={styles.themeIconGradient}
                      >
                        <Icon size={22} color="#FFF" />
                      </LinearGradient>
                    ) : (
                      <Icon size={22} color={isActive ? colors.accent : colors.textSecondary} />
                    )}
                    <Text
                      style={[
                        styles.themeLabel,
                        { color: isActive ? colors.accent : colors.textSecondary, fontSize: 13 },
                      ]}
                    >
                      {q === 'fast' ? 'Fast' : q === 'detailed' ? 'Detailed' : '8K (Extreme)'}
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
          created by Dennis Werner 2026 V0.5.11.FehlerCorrect2
        </Text>
      </ScrollView>

      <Modal
        visible={isSecretMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isSyncing && setIsSecretMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {language === 'de' ? 'Batch Sharing' : 'Secret Menu'}
              </Text>
              {!isSyncing && (
                <TouchableOpacity onPress={() => setIsSecretMenuVisible(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {isSyncing ? (
              <View style={styles.syncBox}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.syncLabel, { color: colors.text }]}>{syncProgress.label}</Text>
                <Text style={[styles.syncCount, { color: colors.textSecondary }]}>
                  {syncProgress.current} / {syncProgress.total}
                </Text>
                <View style={[styles.progressBarBg, { backgroundColor: colors.inputBackground }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: colors.accent,
                        width: `${(syncProgress.current / syncProgress.total) * 100}%`
                      }
                    ]}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.secretButtons}>
                <TouchableOpacity
                  style={[styles.secretButton, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}
                  onPress={handleSecretExport}
                >
                  <Share2 size={20} color={colors.accent} />
                  <Text style={[styles.secretButtonText, { color: colors.accent }]}>
                    {language === 'de' ? 'Alle Links exportieren' : 'Export all links'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secretButton, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}
                  onPress={handleSyncAll}
                >
                  <RefreshCw size={20} color={colors.success} />
                  <Text style={[styles.secretButtonText, { color: colors.success }]}>
                    {language === 'de' ? 'Alle synchronisieren' : 'Sync all models'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  secretButtons: {
    gap: 12,
  },
  secretButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  secretButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  syncBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  syncLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  syncCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
