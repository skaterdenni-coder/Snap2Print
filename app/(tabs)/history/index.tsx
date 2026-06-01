import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Box, ExternalLink, Trash2, XCircle, Clock, Share2, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHistory, HistoryEntry } from '@/contexts/HistoryContext';
import { getTripoTaskStatus } from '@/utils/tripo';
import { resizeGLB, resizeGLBToBytes } from '@/utils/modelResizer';
import { rainbowGradient } from '@/constants/colors';

type ProcessingTask = {
  taskId: string;
  label: string;
  progress: number;
};

export default function HistoryScreen() {
  const { colors, mode } = useTheme();
  const { apiKey } = useSettings();
  const { t, language } = useLanguage();
  const { entries, removeEntry, clearHistory } = useHistory();
  const insets = useSafeAreaInsets();
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [processingTask, setProcessingTask] = useState<ProcessingTask | null>(null);
  const isRainbow = mode === 'rainbow';

  const getExpirationStatus = (completedAt: string) => {
    const start = new Date(completedAt).getTime();
    const now = new Date().getTime();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const expiryTime = start + fourteenDaysMs;
    const diff = expiryTime - now;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff <= 0) return { label: t.status.expired, color: colors.danger, urgent: true };
    if (days < 3) return { label: `${days}d ${hours}h ${t.timeLeft}`, color: '#FF9F43', urgent: true };
    return { label: `${days} ${t.daysLeft}`, color: colors.textTertiary, urgent: false };
  };

  const handleClearAll = useCallback(() => {
    if (entries.length === 0) return;
    Alert.alert(
      t.deleteHistoryTitle,
      t.deleteHistoryDesc,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            clearHistory();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ],
    );
  }, [entries.length, clearHistory, t]);

  const handleRemove = useCallback((taskId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    removeEntry(taskId);
  }, [removeEntry]);

  const createLocalGlbFileAsync = useCallback(async (
    glbUrl: string,
    targetHeightMeters?: number,
    onProgress?: (label: string, progress: number) => void,
  ): Promise<string> => {
    onProgress?.(targetHeightMeters ? 'Skaliere GLB-Modell...' : 'Lade GLB-Modell...', 20);

    const file = new ExpoFile(Paths.cache, `model-${Date.now()}.glb`);

    if (targetHeightMeters) {
      const bytes = await resizeGLBToBytes(glbUrl, targetHeightMeters);
      onProgress?.('Speichere Datei...', 75);
      file.write(bytes);
    } else {
      onProgress?.('Speichere Datei...', 75);
      await ExpoFile.downloadFileAsync(glbUrl, file, { idempotent: true });
    }

    onProgress?.('Bereite Teilen vor...', 95);
    return file.uri;
  }, []);

  const downloadFile = useCallback(async (taskId: string, format: string, targetHeightMeters?: number) => {
    if (!apiKey) {
      Alert.alert(t.error, 'No API Key found');
      return;
    }

    setProcessingTask({ taskId, label: 'Erneuere Download-Link...', progress: 10 });
    try {
      const tripoData = await getTripoTaskStatus(apiKey, taskId);
      const url = format === 'glb' ? tripoData.output?.pbr_model || tripoData.output?.model : tripoData.output?.[format.toLowerCase()];

      if (!url) {
        throw new Error('Download link could not be renewed');
      }

      if (Platform.OS === 'web') {
        setProcessingTask({ taskId, label: targetHeightMeters && format === 'glb' ? 'Skaliere GLB-Modell...' : 'Lade Datei...', progress: 35 });
        const blob = targetHeightMeters && format === 'glb'
          ? await resizeGLB(url, targetHeightMeters)
          : await (await fetch(url)).blob();
        setProcessingTask({ taskId, label: 'Bereite Download vor...', progress: 90 });
        const filename = `model-${taskId}.${format.toLowerCase()}`;
        const file = new File([blob], filename, { type: 'model/gltf-binary' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '3D Model', text: 'My 3D Model' });
        } else {
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }
      } else if (format === 'glb') {
        const fileUri = await createLocalGlbFileAsync(url, targetHeightMeters, (label, progress) => {
          setProcessingTask({ taskId, label, progress });
        });
        const sharingAvailable = await Sharing.isAvailableAsync();
        if (!sharingAvailable) {
          throw new Error('Sharing is not available on this device');
        }
        await Sharing.shareAsync(fileUri, {
          mimeType: 'model/gltf-binary',
          UTI: 'com.khronos.glb',
          dialogTitle: 'GLB-Modell teilen',
        });
      } else {
        Linking.openURL(url);
      }
    } catch (error) {
      console.error('Download/Refresh error:', error);
      Alert.alert(t.error, 'The download link could not be loaded.');
    } finally {
      setProcessingTask(null);
    }
  }, [apiKey, createLocalGlbFileAsync, t]);

  const shareToLitterboxAndAR = useCallback(async (taskId: string, targetHeightMeters?: number) => {
    if (!apiKey) return;
    setUploadingTaskId(taskId);
    setProcessingTask({ taskId, label: 'Erneuere GLB-Link...', progress: 10 });
    try {
      const tripoData = await getTripoTaskStatus(apiKey, taskId);
      const glbUrl = tripoData.output?.pbr_model || tripoData.output?.model;

      if (!glbUrl) throw new Error('GLB URL not found');

      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('time', '24h');

      if (targetHeightMeters) {
        if (Platform.OS === 'web') {
          setProcessingTask({ taskId, label: 'Skaliere GLB-Modell...', progress: 35 });
          const resizedBlob = await resizeGLB(glbUrl, targetHeightMeters);
          formData.append('fileToUpload', new File([resizedBlob], 'model.glb', { type: 'model/gltf-binary' }));
        } else {
          const fileUri = await createLocalGlbFileAsync(glbUrl, targetHeightMeters, (label, progress) => {
            setProcessingTask({ taskId, label, progress });
          });
          // @ts-ignore React Native accepts file descriptors in FormData.
          formData.append('fileToUpload', { uri: fileUri, name: 'model.glb', type: 'model/gltf-binary' });
        }
      } else {
        // @ts-ignore React Native accepts file descriptors in FormData.
        formData.append('fileToUpload', {
          uri: glbUrl,
          name: 'model.glb',
          type: 'model/gltf-binary',
        });
      }

      setProcessingTask({ taskId, label: 'Lade Modell fuer AR hoch...', progress: 80 });
      const uploadRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: formData,
      });

      const litterboxUrl = await uploadRes.text();

      if (!litterboxUrl.startsWith('http')) {
        throw new Error('Upload to Litterbox failed');
      }

      const viewerUrl = `https://skaterdenni-coder.github.io/AR-Viewer/?model=${encodeURIComponent(litterboxUrl.trim())}`;

      setProcessingTask({ taskId, label: 'Oeffne Teilen...', progress: 100 });
      await Share.share({
        message: `Check out my 3D model in AR: ${viewerUrl}`,
        url: viewerUrl,
        title: 'Share AR Model',
      });
    } catch (error) {
      console.error('Sharing error:', error);
      Alert.alert(t.error, 'The model could not be uploaded or shared.');
    } finally {
      setUploadingTaskId(null);
      setProcessingTask(null);
    }
  }, [apiKey, createLocalGlbFileAsync, t]);

  const renderItem = useCallback(({ item, index }: { item: HistoryEntry; index: number }) => {
    const expiry = getExpirationStatus(item.completedAt);
    const currentProcessing = processingTask?.taskId === item.taskId ? processingTask : null;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: expiry.urgent ? expiry.color : colors.cardBorder,
            borderWidth: expiry.urgent ? 1.5 : 1,
          },
        ]}
      >
        <View style={styles.cardTop}>
          {item.thumbnailUrl ? (
            <Image
              source={{ uri: item.thumbnailUrl }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.inputBackground }]}>
              <Box size={28} color={colors.textTertiary} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.name || `${t.model} #${entries.length - index}`}
            </Text>
            <View style={styles.dateRow}>
              <Clock size={12} color={colors.textTertiary} />
              <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                {new Date(item.completedAt).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.expiryRow}>
              {expiry.urgent ? <AlertTriangle size={12} color={expiry.color} /> : <Clock size={12} color={expiry.color} />}
              <Text style={[styles.expiryText, { color: expiry.color, fontWeight: expiry.urgent ? '700' : '500' }]}>
                {expiry.label}
              </Text>
            </View>
            {item.modelHeightMeters && (
              <Text style={[styles.heightText, { color: colors.textSecondary }]}>
                Hoehe: {item.modelHeightMeters} m
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.danger + '12' }]}
            onPress={() => handleRemove(item.taskId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {item.modelUrls && (
          <View style={styles.downloadRow}>
            {Object.entries(item.modelUrls).map(([format, url]) =>
              url ? (
                <TouchableOpacity
                  key={format}
                  style={[
                    styles.downloadChip,
                    {
                      backgroundColor: isRainbow ? undefined : colors.accent + '12',
                      borderColor: isRainbow ? 'transparent' : colors.accent + '30',
                      overflow: 'hidden',
                    },
                  ]}
                  onPress={() => downloadFile(item.taskId, format, item.modelHeightMeters)}
                  disabled={currentProcessing !== null}
                  activeOpacity={0.7}
                >
                  {isRainbow && (
                    <LinearGradient
                      colors={rainbowGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { opacity: 0.15 }]}
                    />
                  )}
                  <ExternalLink size={12} color={isRainbow ? '#FF6B6B' : colors.accent} />
                  <Text style={[styles.chipText, { color: isRainbow ? '#FF6B6B' : colors.accent }]}>
                    {format.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ) : null,
            )}
            {item.modelUrls.glb && (
              <TouchableOpacity
                style={[
                  styles.shareChip,
                  {
                    backgroundColor: colors.success + '12',
                    borderColor: colors.success + '30',
                  },
                ]}
                onPress={() => shareToLitterboxAndAR(item.taskId, item.modelHeightMeters)}
                disabled={uploadingTaskId === item.taskId || currentProcessing !== null}
              >
                {uploadingTaskId === item.taskId ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <>
                    <Share2 size={12} color={colors.success} />
                    <Text style={[styles.shareChipText, { color: colors.success }]}>{t.arShare}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
        {currentProcessing && (
          <View style={styles.processingBox}>
            <View style={styles.processingHeader}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.processingText, { color: colors.text }]}>
                {currentProcessing.label}
              </Text>
              <Text style={[styles.processingPercent, { color: colors.textSecondary }]}>
                {currentProcessing.progress}%
              </Text>
            </View>
            <View style={[styles.processingBarBg, { backgroundColor: colors.inputBackground }]}>
              <View style={[styles.processingBarFill, { width: `${currentProcessing.progress}%`, backgroundColor: colors.accent }]} />
            </View>
          </View>
        )}
      </View>
    );
  }, [colors, isRainbow, entries.length, handleRemove, downloadFile, processingTask, uploadingTaskId, shareToLitterboxAndAR, t]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.inputBackground }]}>
        <Box size={40} color={colors.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noModels}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {t.emptyHistory}
      </Text>
    </View>
  ), [colors, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerArea, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          {isRainbow ? (
            <LinearGradient
              colors={rainbowGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.titleGradient}
            >
              <Text style={[styles.title, { color: '#FFF' }]}>{t.historyTitle}</Text>
            </LinearGradient>
          ) : (
            <Text style={[styles.title, { color: colors.text }]}>{t.historyTitle}</Text>
          )}
          {entries.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={[styles.clearButton, { backgroundColor: colors.danger + '12' }]}
              activeOpacity={0.7}
            >
              <XCircle size={16} color={colors.danger} />
              <Text style={[styles.clearText, { color: colors.danger }]}>{t.deleteAll}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {entries.length} {entries.length === 1 ? t.model : t.models} {language === 'de' ? 'erstellt' : 'created'}
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.taskId}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
          entries.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: { paddingHorizontal: 20, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleGradient: { borderRadius: 8, paddingHorizontal: 4 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4 },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  clearText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  emptyListContent: { flex: 1, justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumbnail: { width: 72, height: 72, borderRadius: 14 },
  thumbnailPlaceholder: { width: 72, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 4, paddingTop: 2 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  expiryText: { fontSize: 12 },
  heightText: { fontSize: 12, fontWeight: '600' },
  deleteButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  downloadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.2)' },
  downloadChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },
  shareChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  shareChipText: { fontSize: 12, fontWeight: '700' },
  processingBox: { marginTop: 12, gap: 8 },
  processingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  processingText: { flex: 1, fontSize: 12, fontWeight: '600' },
  processingPercent: { fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right' },
  processingBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  processingBarFill: { height: '100%', borderRadius: 3 },
  emptyContainer: { alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
