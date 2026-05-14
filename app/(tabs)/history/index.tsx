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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Box, ExternalLink, Trash2, XCircle, Clock, Share2, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHistory, HistoryEntry } from '@/contexts/HistoryContext';
import { rainbowGradient } from '@/constants/colors';
import { resizeGLB, resizeGLBToBytes } from '@/utils/modelResizer';

type ProcessingTask = {
  taskId: string;
  label: string;
  progress: number;
};

export default function HistoryScreen() {
  const { colors, mode } = useTheme();
  const { entries, removeEntry, clearHistory } = useHistory();
  const insets = useSafeAreaInsets();
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [processingTask, setProcessingTask] = useState<ProcessingTask | null>(null);
  const isRainbow = mode === 'rainbow';

  const bytesToBase64 = useCallback((bytes: Uint8Array): string => {
    let binary = '';
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    return btoa(binary);
  }, []);

  const createLocalGlbFileAsync = useCallback(async (
    url: string,
    targetHeightMeters?: number,
    onProgress?: (label: string, progress: number) => void
  ): Promise<string> => {
    if (!FileSystem.cacheDirectory) {
      throw new Error('Cache-Verzeichnis nicht verfügbar.');
    }

    onProgress?.('GLB wird heruntergeladen...', 15);
    const bytes = targetHeightMeters
      ? (onProgress?.('Modell wird skaliert...', 40), await resizeGLBToBytes(url, targetHeightMeters))
      : new Uint8Array(await (await fetch(url)).arrayBuffer());

    onProgress?.('Datei wird vorbereitet...', 70);
    const base64 = bytesToBase64(bytes);
    const safeHeight = targetHeightMeters ? `-${String(targetHeightMeters).replace(/[^0-9.]/g, '_')}m` : '';
    const fileUri = `${FileSystem.cacheDirectory}modell-${Date.now()}${safeHeight}.glb`;

    onProgress?.('GLB wird lokal gespeichert...', 85);
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  }, [bytesToBase64]);

  const getExpirationStatus = (completedAt: string) => {
    const start = new Date(completedAt).getTime();
    const now = new Date().getTime();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const expiryTime = start + fourteenDaysMs;
    const diff = expiryTime - now;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff <= 0) return { label: 'Abgelaufen', color: colors.danger, urgent: true };
    if (days < 3) return { label: `${days}t ${hours}h übrig`, color: '#FF9F43', urgent: true };
    return { label: `${days} Tage übrig`, color: colors.textTertiary, urgent: false };
  };

  const handleClearAll = useCallback(() => {
    if (entries.length === 0) return;
    Alert.alert(
      'Historie löschen',
      'Möchtest du wirklich alle Einträge löschen? Dies kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
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
  }, [entries.length, clearHistory]);

  const handleRemove = useCallback((taskId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    removeEntry(taskId);
  }, [removeEntry]);

  const downloadFile = useCallback(async (taskId: string, url: string, format: string, targetHeightMeters?: number) => {
    const setProgress = (label: string, progress: number) => {
      setProcessingTask({ taskId, label, progress });
    };

    if (Platform.OS === 'web') {
      try {
        setProgress('GLB wird heruntergeladen...', 15);
        const blob = format.toLowerCase() === 'glb' && targetHeightMeters
          ? (setProgress('Modell wird skaliert...', 45), await resizeGLB(url, targetHeightMeters))
          : await (await fetch(url)).blob();
        setProgress('Datei wird vorbereitet...', 75);
        const filename = `modell-${Date.now()}.${format.toLowerCase()}`;
        const file = new File([blob], filename, { type: 'model/gltf-binary' });

        setProgress('Share Sheet wird geöffnet...', 95);
        // Prüfen, ob das Teilen von Dateien unterstützt wird
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '3D Modell',
            text: 'Mein generiertes 3D Modell',
          });
        } else {
          // Fallback: Direkter Download
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }
      } catch (error) {
        console.error('Share/Download error:', error);
        Linking.openURL(url);
      } finally {
        setProcessingTask(null);
      }
    } else if (format.toLowerCase() === 'glb') {
      try {
        const fileUri = await createLocalGlbFileAsync(url, targetHeightMeters, setProgress);
        const canShare = await Sharing.isAvailableAsync();

        if (!canShare) {
          setProgress('Datei wird geöffnet...', 95);
          await Linking.openURL(fileUri);
          return;
        }

        setProgress('Share Sheet wird geöffnet...', 95);
        await Sharing.shareAsync(fileUri, {
          mimeType: 'model/gltf-binary',
          UTI: 'com.khronos.glb',
          dialogTitle: 'GLB-Modell teilen',
        });
      } catch (error) {
        console.error('Native GLB share error:', error);
        Alert.alert('Fehler', 'Das GLB konnte nicht lokal vorbereitet werden.');
      } finally {
        setProcessingTask(null);
      }
    } else {
      Linking.openURL(url);
    }
  }, [createLocalGlbFileAsync]);

  const shareToLitterboxAndAR = useCallback(async (taskId: string, glbUrl: string, targetHeightMeters?: number) => {
    setUploadingTaskId(taskId);
    const setProgress = (label: string, progress: number) => {
      setProcessingTask({ taskId, label, progress });
    };

    try {
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('time', '24h');
      if (targetHeightMeters && Platform.OS === 'web') {
        setProgress('Modell wird skaliert...', 35);
        const resizedBlob = await resizeGLB(glbUrl, targetHeightMeters);
        const filename = `model-${targetHeightMeters}m.glb`;
        setProgress('Upload wird vorbereitet...', 65);
        formData.append('fileToUpload', new File([resizedBlob], filename, { type: 'model/gltf-binary' }));
      } else if (targetHeightMeters) {
        const fileUri = await createLocalGlbFileAsync(glbUrl, targetHeightMeters, setProgress);
        // @ts-ignore
        formData.append('fileToUpload', {
          uri: fileUri,
          name: `model-${targetHeightMeters}m.glb`,
          type: 'model/gltf-binary',
        });
      } else {
        setProgress('Upload wird vorbereitet...', 35);
        // @ts-ignore
        formData.append('fileToUpload', {
          uri: glbUrl,
          name: 'model.glb',
          type: 'model/gltf-binary',
        });
      }

      setProgress('Modell wird hochgeladen...', 85);
      const uploadRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      });

      const litterboxUrl = await uploadRes.text();

      if (!litterboxUrl.startsWith('http')) {
        throw new Error('Upload zu Litterbox fehlgeschlagen');
      }

      const viewerUrl = `https://skaterdenni-coder.github.io/AR-Viewer/?model=${encodeURIComponent(litterboxUrl.trim())}`;

      setProgress('AR-Link wird geteilt...', 95);
      await Share.share({
        message: `Schau dir mein 3D-Modell in AR an: ${viewerUrl}`,
        url: viewerUrl,
        title: 'AR Modell teilen',
      });
    } catch (error) {
      console.error('Sharing error:', error);
      Alert.alert('Fehler', 'Das Modell konnte nicht hochgeladen oder geteilt werden.');
    } finally {
      setUploadingTaskId(null);
      setProcessingTask(null);
    }
  }, [createLocalGlbFileAsync]);

  const renderItem = useCallback(({ item, index }: { item: HistoryEntry; index: number }) => {
    const formatCount = item.modelUrls
      ? Object.values(item.modelUrls).filter(Boolean).length
      : 0;

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
              {item.name || `Modell #${entries.length - index}`}
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
              <Text style={[styles.formatInfo, { color: colors.textSecondary }]}>
                Höhe: {item.modelHeightMeters} m
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.danger + '12' }]}
            onPress={() => handleRemove(item.taskId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`delete-history-${item.taskId}`}
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
                  onPress={() => downloadFile(item.taskId, url, format, item.modelHeightMeters)}
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
                onPress={() => item.modelUrls?.glb && shareToLitterboxAndAR(item.taskId, item.modelUrls.glb, item.modelHeightMeters)}
                disabled={uploadingTaskId === item.taskId || currentProcessing !== null}
              >
                {uploadingTaskId === item.taskId ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <>
                    <Share2 size={12} color={colors.success} />
                    <Text style={[styles.shareChipText, { color: colors.success }]}>AR TEILEN</Text>
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
              <View
                style={[
                  styles.processingBarFill,
                  {
                    width: `${currentProcessing.progress}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>
    );
  }, [colors, isRainbow, entries.length, handleRemove, downloadFile, uploadingTaskId, processingTask, shareToLitterboxAndAR]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.inputBackground }]}>
        <Box size={40} color={colors.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Keine Modelle</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Erstellte 3D-Modelle werden hier automatisch gespeichert.
      </Text>
    </View>
  ), [colors]);

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
              <Text style={[styles.title, { color: '#FFF' }]}>Historie</Text>
            </LinearGradient>
          ) : (
            <Text style={[styles.title, { color: colors.text }]}>Historie</Text>
          )}
          {entries.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={[styles.clearButton, { backgroundColor: colors.danger + '12' }]}
              activeOpacity={0.7}
              testID="clear-history-button"
            >
              <XCircle size={16} color={colors.danger} />
              <Text style={[styles.clearText, { color: colors.danger }]}>Alle löschen</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {entries.length} {entries.length === 1 ? 'Modell' : 'Modelle'} erstellt
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
  container: {
    flex: 1,
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleGradient: {
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 14,
  },
  thumbnailPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  expiryText: {
    fontSize: 12,
  },
  formatInfo: {
    fontSize: 13,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  downloadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  shareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  shareChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  processingBox: {
    marginTop: 12,
    gap: 8,
  },
  processingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  processingPercent: {
    width: 42,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  processingBarBg: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  processingBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
