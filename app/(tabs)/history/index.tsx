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
  Modal,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Box, ExternalLink, Trash2, XCircle, Clock, Share2, AlertTriangle, Edit2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHistory, HistoryEntry } from '@/contexts/HistoryContext';
import { getTripoTaskStatus } from '@/utils/tripo';
import { uploadToLitterbox } from '@/utils/FileSharing';
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
  const { entries, removeEntry, clearHistory, updateEntry } = useHistory();
  const insets = useSafeAreaInsets();
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [processingTask, setProcessingTask] = useState<ProcessingTask | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameTaskId, setRenameTaskId] = useState<string | null>(null);
  const isRainbow = mode === 'rainbow';

  const getExpirationStatus = (completedAt: string) => {
    const start = new Date(completedAt).getTime();
    const now = new Date().getTime();
    const expiryTime = start + (365 * 24 * 60 * 60 * 1000); // 1 Jahr als Platzhalter
    const diff = expiryTime - now;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff <= 0) return { label: t.status.expired, color: colors.danger, urgent: true };
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

  const openRenameModal = (taskId: string, currentName: string) => {
    setRenameTaskId(taskId);
    setRenameValue(currentName);
    setRenameModalVisible(true);
  };

  const confirmRename = () => {
    if (renameTaskId && renameValue.trim()) {
      updateEntry(renameTaskId, { name: renameValue.trim() });
      setRenameModalVisible(false);
      setRenameTaskId(null);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

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
      const url = format === 'glb'
        ? (tripoData.output?.pbr_model || tripoData.output?.model_url || tripoData.output?.model)
        : (tripoData.output?.[format.toLowerCase()] || tripoData.output?.[`${format.toLowerCase()}_url`]);

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
    const item = entries.find(e => e.taskId === taskId);
    const EXPIRATION_MS = 71 * 60 * 60 * 1000;

    let isLinkValid = false;
    if (item?.arUrl && item.arUrlGeneratedAt) {
      const generatedAt = new Date(item.arUrlGeneratedAt).getTime();
      const now = new Date().getTime();
      if (now - generatedAt < EXPIRATION_MS) {
        isLinkValid = true;
      }
    }

    if (isLinkValid && item?.arUrl) {
      const msg = language === 'de' ? 'Schau dir mein 3D-Modell in AR an' : 'Check out my 3D model in AR';
      const shareUrl = item.arUrl;
      setTimeout(async () => {
        try {
          await Share.share({
            message: Platform.OS === 'android' ? `${msg}: ${shareUrl}` : msg,
            url: shareUrl
          });
        } catch (err) { console.error('Share dialog error:', err); }
      }, 500);
      return;
    }

    if (!apiKey) return;
    setUploadingTaskId(`${taskId}-ar`);
    setProcessingTask({ taskId, label: 'Bereite AR vor...', progress: 10 });
    try {
      const tripoData = await getTripoTaskStatus(apiKey, taskId);
      const glbUrl = tripoData.output?.pbr_model || tripoData.output?.model_url || tripoData.output?.model;
      if (!glbUrl) throw new Error('GLB URL not found');

      setProcessingTask({ taskId, label: 'Lade Modell hoch...', progress: 40 });
      const litterboxUrl = await uploadToLitterbox(glbUrl, targetHeightMeters ?? item?.modelHeightMeters);

      const viewerUrl = `https://skaterdenni-coder.github.io/AR-Viewer/?model=${encodeURIComponent(litterboxUrl.trim())}`;
      updateEntry(taskId, { arUrl: viewerUrl, arUrlGeneratedAt: new Date().toISOString() });

      setProcessingTask({ taskId, label: 'Oeffne Teilen...', progress: 100 });
      const msg = language === 'de' ? 'Schau dir mein 3D-Modell in AR an' : 'Check out my 3D model in AR';
      const shareUrl = viewerUrl;

      setTimeout(async () => {
        try {
          await Share.share({
            message: Platform.OS === 'android' ? `${msg}: ${shareUrl}` : msg,
            url: shareUrl,
            title: 'Share AR Model',
          });
        } catch (err) { console.error('Share dialog error:', err); }
        finally { setUploadingTaskId(null); setProcessingTask(null); }
      }, 500);
    } catch (error) {
      console.error('Sharing error:', error);
      Alert.alert(t.error, 'The model could not be uploaded or shared.');
      setUploadingTaskId(null);
      setProcessingTask(null);
    }
  }, [apiKey, createLocalGlbFileAsync, t, entries, language, updateEntry]);

  const shareToDownload = useCallback(async (taskId: string, targetHeightMeters?: number) => {
    const item = entries.find(e => e.taskId === taskId);
    const EXPIRATION_MS = 71 * 60 * 60 * 1000;

    let isLinkValid = false;
    if (item?.glbDownloadUrl && item.glbDownloadUrlGeneratedAt) {
      const generatedAt = new Date(item.glbDownloadUrlGeneratedAt).getTime();
      const now = new Date().getTime();
      if (now - generatedAt < EXPIRATION_MS) {
        isLinkValid = true;
      }
    }

    if (isLinkValid && item?.glbDownloadUrl) {
      const shareUrl = item.glbDownloadUrl;
      setTimeout(async () => {
        try {
          await Share.share({
            message: Platform.OS === 'android' ? `Download: ${shareUrl}` : `Download`,
            url: shareUrl
          });
        } catch (err) { console.error('Share dialog error:', err); }
      }, 500);
      return;
    }

    if (!apiKey) return;
    setUploadingTaskId(`${taskId}-glb`);
    setProcessingTask({ taskId, label: 'Bereite Download vor...', progress: 10 });
    try {
      const tripoData = await getTripoTaskStatus(apiKey, taskId);
      const glbUrl = tripoData.output?.pbr_model || tripoData.output?.model_url || tripoData.output?.model;
      if (!glbUrl) throw new Error('GLB URL not found');

      setProcessingTask({ taskId, label: 'Lade Modell hoch...', progress: 40 });
      const litterboxUrl = await uploadToLitterbox(glbUrl, targetHeightMeters ?? item?.modelHeightMeters);

      const downloadUrl = `https://skaterdenni-coder.github.io/Snap2ModelDownload/?model=${encodeURIComponent(litterboxUrl.trim())}`;
      updateEntry(taskId, { glbDownloadUrl: downloadUrl, glbDownloadUrlGeneratedAt: new Date().toISOString() });

      setProcessingTask({ taskId, label: 'Oeffne Teilen...', progress: 100 });
      const shareUrl = downloadUrl;

      setTimeout(async () => {
        try {
          await Share.share({
            message: Platform.OS === 'android' ? `Download: ${shareUrl}` : `Download`,
            url: shareUrl,
          });
        } catch (err) { console.error('Share dialog error:', err); }
        finally { setUploadingTaskId(null); setProcessingTask(null); }
      }, 500);
    } catch (error) {
      console.error('Download sharing error:', error);
      Alert.alert(t.error, 'Failed to prepare download link.');
      setUploadingTaskId(null);
      setProcessingTask(null);
    }
  }, [apiKey, createLocalGlbFileAsync, t, entries, language, updateEntry]);

  const renderItem = useCallback(({ item, index }: { item: HistoryEntry; index: number }) => {
    const expiry = getExpirationStatus(item.completedAt);
    const currentProcessing = processingTask?.taskId === item.taskId ? processingTask : null;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: 1,
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
            <TouchableOpacity
              style={styles.titleContainer}
              onPress={() => openRenameModal(item.taskId, item.name || `${t.model} #${entries.length - index}`)}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {item.name || `${t.model} #${entries.length - index}`}
              </Text>
              <Edit2 size={14} color={colors.textTertiary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
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
                  onPress={() => format === 'glb' ? shareToDownload(item.taskId, item.modelHeightMeters) : downloadFile(item.taskId, format, item.modelHeightMeters)}
                  disabled={currentProcessing !== null || uploadingTaskId === `${item.taskId}-${format}`}
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
                  {uploadingTaskId === `${item.taskId}-${format}` ? (
                    <ActivityIndicator size="small" color={isRainbow ? '#FF6B6B' : colors.accent} />
                  ) : (
                    <>
                      {format === 'glb' ? <Share2 size={12} color={isRainbow ? '#FF6B6B' : colors.accent} /> : <ExternalLink size={12} color={isRainbow ? '#FF6B6B' : colors.accent} />}
                      <Text style={[styles.chipText, { color: isRainbow ? '#FF6B6B' : colors.accent }]}>
                        {format.toUpperCase()}
                      </Text>
                    </>
                  )}
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
                disabled={uploadingTaskId === `${item.taskId}-ar` || currentProcessing !== null}
              >
                {uploadingTaskId === `${item.taskId}-ar` ? (
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
  }, [colors, isRainbow, entries.length, handleRemove, downloadFile, processingTask, uploadingTaskId, shareToLitterboxAndAR, shareToDownload, t, language, openRenameModal]);

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

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Modell umbenennen</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.accent, borderRadius: 10 }]}
                onPress={confirmRename}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>{t.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  titleContainer: { flexDirection: 'row', alignItems: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12 },
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
