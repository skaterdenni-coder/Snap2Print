import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  ActivityIndicator,
  Platform,
  Share,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { File as ExpoFile, Paths } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImagePlus, X, Sparkles, Box, Clock, CheckCircle, AlertCircle, Loader, Share2, HelpCircle } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createTripoTask, getTripoTaskStatus, mapTripoStatus, createTripoRefineTask, imageUriToBase64DataUrl, TripoApiError } from '@/utils/tripo';
import { rainbowGradient } from '@/constants/colors';
import { useHistory } from '@/contexts/HistoryContext';
import { resizeGLB, resizeGLBToBytes } from '@/utils/modelResizer';

interface SelectedImage {
  uri: string;
  id: string;
  label: string;
}

interface TaskEntry {
  id: string;
  taskId: string;
  tokens?: string[]; // Speichert die Tokens für scharfes Refinement
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  progress: number;
  thumbnailUrl?: string;
  modelUrls?: { glb?: string };
  createdAt: string;
  isRefining?: boolean;
  modelHeightMeters?: number;
}

const HELP_IMAGES: Record<string, any> = {
  p1: require('../../../assets/images/B1.png'),
  p2: require('../../../assets/images/B2.png'),
  p3: require('../../../assets/images/B3.png'),
  p4: require('../../../assets/images/B4.png'),
};

function parseModelHeightMeters(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Bitte gib eine gültige Modellhöhe in Metern ein.');
  }
  return parsed;
}

export default function HomeScreen() {
  const { colors, mode } = useTheme();
  const { apiKey, hasApiKey, qualityMode } = useSettings();
  const { t, language } = useLanguage();
  const {
    addEntry,
    activeTasks,
    addActiveTask,
    updateActiveTask,
    removeActiveTask,
    updateTaskProgress,
    updateEntry,
    entries,
  } = useHistory();
  const insets = useSafeAreaInsets();

  const PLACEHOLDERS = [
    { id: 'p1', label: t.placeholders.front },
    { id: 'p2', label: t.placeholders.left },
    { id: 'p3', label: t.placeholders.right },
    { id: 'p4', label: t.placeholders.back },
  ];

  const [images, setImages] = useState<(SelectedImage | null)[]>([null, null, null, null]);
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [activeHelpIdx, setActiveHelpIdx] = useState<number | null>(null);
  const [modelHeightInput, setModelHeightInput] = useState<string>('');
  const pollIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const buttonScale = useRef(new Animated.Value(1)).current;

  const isRainbow = mode === 'rainbow';

  const createLocalGlbFileAsync = useCallback(async (glbUrl: string, targetHeightMeters: number): Promise<string> => {
    const bytes = await resizeGLBToBytes(glbUrl, targetHeightMeters);
    const file = new ExpoFile(Paths.cache, `scaled-model-${Date.now()}.glb`);
    file.write(bytes);
    return file.uri;
  }, []);

  const uploadToLitterbox = useCallback(async (glbUrl: string, targetHeightMeters?: number): Promise<string> => {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '72h');

    if (targetHeightMeters) {
      if (Platform.OS === 'web') {
        const resizedBlob = await resizeGLB(glbUrl, targetHeightMeters);
        formData.append('fileToUpload', new File([resizedBlob], 'model.glb', { type: 'model/gltf-binary' }));
      } else {
        const fileUri = await createLocalGlbFileAsync(glbUrl, targetHeightMeters);
        // @ts-ignore React Native accepts file descriptors in FormData.
        formData.append('fileToUpload', { uri: fileUri, name: 'model.glb', type: 'model/gltf-binary' });
      }
    } else {
      // @ts-ignore React Native accepts file descriptors in FormData.
      formData.append('fileToUpload', { uri: glbUrl, name: 'model.glb', type: 'model/gltf-binary' });
    }

    const uploadRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: formData });
    const litterboxUrl = (await uploadRes.text()).trim();
    return litterboxUrl;
  }, [createLocalGlbFileAsync]);

  // Hilfs-Ref, um in den Intervallen auf die aktuellsten Task-Daten zuzugreifen
  const tasksRef = useRef<TaskEntry[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const startPolling = useCallback((taskId: string, isRefining: boolean = false, baseTaskId?: string) => {
    if (pollIntervals.current[taskId]) return;
    if (!apiKey) return;

    const interval = setInterval(async () => {
      try {
        const tripoData = await getTripoTaskStatus(apiKey, taskId);
        if (!tripoData) return;

        const mappedStatus = mapTripoStatus(tripoData.status);
        const currentProgress = tripoData.progress;
        const currentThumb = tripoData.output?.rendered_image_url || tripoData.output?.rendered_image;
        const glbUrl = tripoData.output?.pbr_model || tripoData.output?.model_url || tripoData.output?.model;
        const currentModel = glbUrl ? { glb: glbUrl } : undefined;

        setTasks((prev) => prev.map((t) => t.taskId === taskId ? {
          ...t,
          status: mappedStatus,
          progress: currentProgress,
          thumbnailUrl: currentThumb || t.thumbnailUrl,
          modelUrls: currentModel || t.modelUrls
        } : t));

        updateTaskProgress(taskId, currentProgress, {
          status: mappedStatus,
          thumbnailUrl: currentThumb,
          modelUrls: currentModel
        });

        if (mappedStatus === 'SUCCEEDED') {
          clearInterval(interval);
          delete pollIntervals.current[taskId];
          const completedTask = tasksRef.current.find(t => t.taskId === taskId);

          // Versuchen einen Namen aus Tripo-Tags oder Prompt zu extrahieren (falls vorhanden)
          const tripoName = tripoData.input?.prompt || tripoData.output?.label || tripoData.output?.tag;
          const now = new Date();
          const day = now.getDate().toString().padStart(2, '0');
          const month = (now.getMonth() + 1).toString().padStart(2, '0');
          const hours = now.getHours().toString().padStart(2, '0');
          const minutes = now.getMinutes().toString().padStart(2, '0');
          const timestampName = `${day}.${month}. ${hours}:${minutes}`;
          const finalName = tripoName ? `${tripoName.charAt(0).toUpperCase() + tripoName.slice(1)}` : `${t.model} ${timestampName}`;

          addEntry({
            id: `${Date.now()}`,
            taskId,
            name: finalName,
            baseTaskId: isRefining ? baseTaskId : undefined,
            thumbnailUrl: currentThumb,
            modelUrls: currentModel,
            modelHeightMeters: completedTask?.modelHeightMeters,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          });

          // Hintergrund-Upload für AR starten
          if (currentModel?.glb) {
             uploadToLitterbox(currentModel.glb, completedTask?.modelHeightMeters)
              .then(rawUrl => {
                 const arUrl = `https://skaterdenni-coder.github.io/AR-Viewer/?model=${encodeURIComponent(rawUrl)}`;
                 updateEntry(taskId, { arUrl, arUrlGeneratedAt: new Date().toISOString() });
              })
              .catch(err => console.error('[AR] Background upload failed:', err));
          }

          removeActiveTask(taskId);
          setTasks(prev => prev.filter(t => t.taskId !== taskId));

          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (mappedStatus === 'FAILED' || mappedStatus === 'EXPIRED') {
          clearInterval(interval);
          delete pollIntervals.current[taskId];
          removeActiveTask(taskId);
          setTasks(prev => prev.filter(t => t.taskId !== taskId));
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (error: any) {
        console.error('[Tripo] Poll Fehler:', error);
      }
    }, 4000);
    pollIntervals.current[taskId] = interval;
  }, [apiKey, addEntry, updateTaskProgress, updateActiveTask, removeActiveTask, uploadToLitterbox, updateEntry, t.model]);

  useEffect(() => {
    if (hasApiKey && apiKey && activeTasks.length > 0) {
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.taskId));
        const resumedTasks: TaskEntry[] = activeTasks
          .filter(at => !existingIds.has(at.taskId))
          .map(at => ({
            id: at.id,
            taskId: at.taskId,
            status: at.status || 'IN_PROGRESS',
            progress: at.progress || 0,
            createdAt: at.createdAt,
            isRefining: at.isRefining,
            thumbnailUrl: at.thumbnailUrl,
            modelUrls: at.modelUrls,
            modelHeightMeters: at.modelHeightMeters,
          }));
        return [...prev, ...resumedTasks];
      });

      activeTasks.forEach(at => {
        startPolling(at.taskId, at.isRefining, at.baseTaskId);
      });
    }
  }, [hasApiKey, apiKey, activeTasks, startPolling]);

  useEffect(() => () => Object.values(pollIntervals.current).forEach(clearInterval), []);

  const pickImage = useCallback(async (index: number) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newImages = [...images];
        newImages[index] = {
          uri: result.assets[0].uri,
          id: `${Date.now()}-${index}`,
          label: PLACEHOLDERS[index].label,
        };
        setImages(newImages);
      }
    } catch (error) {
      console.error('ImagePicker Error:', error);
    }
  }, [images, PLACEHOLDERS]);

  const removeImage = useCallback((index: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newImages = [...images];
    newImages[index] = null;
    setImages(newImages);
  }, [images]);

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const imageUris = images.map(img => img?.uri || null);
      if (imageUris.filter(u => u !== null).length < 1) throw new Error(t.minOneImage);
      const modelHeightMeters = parseModelHeightMeters(modelHeightInput);
      const result = await createTripoTask(apiKey, imageUris, qualityMode);
      return { ...result, modelHeightMeters };
    },
    onSuccess: ({ taskId, tokens, modelHeightMeters }) => {
      const entry: TaskEntry = {
        id: `${Date.now()}`,
        taskId,
        tokens,
        status: 'PENDING',
        progress: 0,
        createdAt: new Date().toISOString(),
        modelHeightMeters,
      };

      addActiveTask({
        id: entry.id,
        taskId: entry.taskId,
        createdAt: entry.createdAt,
        progress: 0,
        status: 'PENDING',
        modelHeightMeters,
      });

      setTasks((prev) => [entry, ...prev]);
      setImages([null, null, null, null]);
      setModelHeightInput('');
      startPolling(taskId);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      if (error instanceof TripoApiError && error.isRetryable) {
        Alert.alert(t.error, `${error.message}\n\nBitte versuche es gleich noch einmal.`);
        return;
      }
      Alert.alert(t.error, error.message);
    },
  });

  const handleCreate = useCallback(() => {
    const activeImageCount = images.filter(img => img !== null).length;

    if (activeImageCount === 1) {
      Alert.alert(
        t.singleViewTitle,
        t.singleViewDesc,
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.create,
            onPress: () => {
              Animated.sequence([
                Animated.timing(buttonScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
                Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
              ]).start();
              createTaskMutation.mutate();
            }
          }
        ]
      );
    } else {
      Animated.sequence([
        Animated.timing(buttonScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
        Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      createTaskMutation.mutate();
    }
  }, [createTaskMutation, buttonScale, images, t]);

  const shareToLitterboxAndAR = useCallback(async (taskId: string, glbUrl: string, targetHeightMeters?: number) => {
    const existingEntry = entries.find(e => e.taskId === taskId);
    const EXPIRATION_MS = 71 * 60 * 60 * 1000;

    let isLinkValid = false;
    if (existingEntry?.arUrl && existingEntry.arUrlGeneratedAt) {
      const generatedAt = new Date(existingEntry.arUrlGeneratedAt).getTime();
      const now = new Date().getTime();
      if (now - generatedAt < EXPIRATION_MS) {
        isLinkValid = true;
      }
    }

    if (isLinkValid && existingEntry?.arUrl) {
      const msg = language === 'de' ? 'Schau dir mein 3D-Modell in AR an' : 'Check out my 3D model in AR';
      const shareUrl = existingEntry.arUrl;
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

    setUploadingTaskId(`${taskId}-ar`);
    try {
      const rawUrl = await uploadToLitterbox(glbUrl, targetHeightMeters ?? existingEntry?.modelHeightMeters);
      const viewerUrl = `https://skaterdenni-coder.github.io/AR-Viewer/?model=${encodeURIComponent(rawUrl)}`;

      updateEntry(taskId, { arUrl: viewerUrl, arUrlGeneratedAt: new Date().toISOString() });
      const msg = language === 'de' ? 'Schau dir mein 3D-Modell in AR an' : 'Check out my 3D model in AR';
      const shareUrl = viewerUrl;

      setTimeout(async () => {
        try {
          await Share.share({
            message: Platform.OS === 'android' ? `${msg}: ${shareUrl}` : msg,
            url: shareUrl
          });
        } catch (err) { console.error('Share dialog error:', err); }
        finally { setUploadingTaskId(null); }
      }, 500);
    } catch (e) {
      Alert.alert(t.error, t.uploadFailed);
      setUploadingTaskId(null);
    }
  }, [t, language, entries, uploadToLitterbox, updateEntry]);

  const shareToDownload = useCallback(async (taskId: string, glbUrl: string) => {
    const existingEntry = entries.find(e => e.taskId === taskId);
    const EXPIRATION_MS = 71 * 60 * 60 * 1000;

    let isLinkValid = false;
    if (existingEntry?.glbDownloadUrl && existingEntry.glbDownloadUrlGeneratedAt) {
      const generatedAt = new Date(existingEntry.glbDownloadUrlGeneratedAt).getTime();
      const now = new Date().getTime();
      if (now - generatedAt < EXPIRATION_MS) {
        isLinkValid = true;
      }
    }

    if (isLinkValid && existingEntry?.glbDownloadUrl) {
      const shareUrl = existingEntry.glbDownloadUrl;
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

    setUploadingTaskId(`${taskId}-glb`);
    try {
      const rawUrl = await uploadToLitterbox(glbUrl, existingEntry?.modelHeightMeters);
      const downloadUrl = `https://skaterdenni-coder.github.io/Snap2ModelDownload/?model=${encodeURIComponent(rawUrl)}`;

      updateEntry(taskId, {
        glbDownloadUrl: downloadUrl,
        glbDownloadUrlGeneratedAt: new Date().toISOString()
      });

      const shareUrl = downloadUrl;
      setTimeout(async () => {
        try {
          await Share.share({
            message: Platform.OS === 'android' ? `Download: ${shareUrl}` : `Download`,
            url: shareUrl
          });
        } catch (err) { console.error('Share dialog error:', err); }
        finally { setUploadingTaskId(null); }
      }, 500);
    } catch (e) {
      Alert.alert(t.error, 'Failed to prepare download link');
      setUploadingTaskId(null);
    }
  }, [t, entries, uploadToLitterbox, updateEntry]);

  const getRainbowColor = (index: number) => rainbowGradient[index % rainbowGradient.length];

  const getStatusLabel = (status: string) => {
    if (status === 'PENDING') return t.status.pending;
    if (status === 'IN_PROGRESS') return t.status.progress;
    if (status === 'SUCCEEDED') return t.status.success;
    if (status === 'FAILED') return t.status.failed;
    return t.status.expired;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Snap2XR</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Powered by Tripo AI V3.1</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.selectImages}</Text>
        </View>

        <View style={styles.imageGrid}>
          {images.map((img, idx) => {
            const isShowingHelp = activeHelpIdx === idx;
            return (
              <View key={PLACEHOLDERS[idx].id} style={[styles.imageCard, { backgroundColor: colors.card, borderColor: isRainbow ? getRainbowColor(idx) : colors.cardBorder, borderWidth: isRainbow ? 2 : 1 }]}>
                {isShowingHelp ? (
                  <View style={styles.imagePreview}>
                    <Image source={HELP_IMAGES[PLACEHOLDERS[idx].id]} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <View style={styles.helpOverlayLabel}>
                      <Text style={styles.helpOverlayText}>{t.help}</Text>
                    </View>
                  </View>
                ) : img ? (
                  <>
                    <Image source={{ uri: img.uri }} style={styles.imagePreview} contentFit="cover" />
                    <TouchableOpacity style={[styles.removeButton, { backgroundColor: colors.danger }]} onPress={() => removeImage(idx)}>
                      <X size={14} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.labelBadge}><Text style={styles.labelText}>{img.label}</Text></View>
                  </>
                ) : (
                  <TouchableOpacity style={styles.addImagePlaceholder} onPress={() => pickImage(idx)}>
                    <View style={[styles.addIconCircle, { backgroundColor: (isRainbow ? getRainbowColor(idx) : colors.accent) + '10' }]}>
                      <ImagePlus size={24} color={isRainbow ? getRainbowColor(idx) : colors.accent} />
                    </View>
                    <Text style={[styles.addImageText, { color: colors.textSecondary }]}>{PLACEHOLDERS[idx].label}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.helpBadge, { backgroundColor: colors.card + 'E6' }]}
                  onPressIn={() => setActiveHelpIdx(idx)}
                  onPressOut={() => setActiveHelpIdx(null)}
                  activeOpacity={0.8}
                >
                  <HelpCircle size={18} color={isShowingHelp ? colors.accent : colors.textSecondary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={[styles.scaleCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.scaleHeader}>
            <Text style={[styles.scaleTitle, { color: colors.text }]}>Modellhöhe</Text>
            <Text style={[styles.scaleUnit, { color: colors.textSecondary }]}>Meter</Text>
          </View>
          <TextInput
            value={modelHeightInput}
            onChangeText={setModelHeightInput}
            placeholder="z. B. 1,85"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={[styles.scaleInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.cardBorder }]}
          />
          <Text style={[styles.scaleHint, { color: colors.textSecondary }]}>
            Optional. Wenn gesetzt, wird die Höhe auf diesen Wert skaliert.
          </Text>
        </View>

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: isRainbow ? getRainbowColor(4) : colors.accent, opacity: images.every(img => img === null) || !hasApiKey || createTaskMutation.isPending ? 0.5 : 1 }]}
            onPress={handleCreate}
            disabled={images.every(img => img === null) || !hasApiKey || createTaskMutation.isPending}
          >
            {createTaskMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <><Text style={styles.createButtonText}>{t.createModel}</Text></>}
          </TouchableOpacity>
        </Animated.View>

        {tasks.length > 0 && (
          <View style={styles.tasksSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.activeTasks}</Text>
            {tasks.map((task, idx) => (
              <View key={task.id} style={[styles.taskCard, { backgroundColor: colors.card, borderColor: isRainbow ? getRainbowColor(idx + 5) : colors.cardBorder, borderWidth: isRainbow ? 2 : 1 }]}>
                <View style={styles.taskHeader}>
                  {task.thumbnailUrl ? <Image source={{ uri: task.thumbnailUrl }} style={styles.taskThumbnail} contentFit="cover" /> : <View style={[styles.taskThumbnailPlaceholder, { backgroundColor: colors.inputBackground }]}><Box size={24} color={colors.textTertiary} /></View>}
                  <View style={styles.taskInfo}>
                    <View style={styles.statusRow}>
                      {getStatusIcon(task.status)}
                      <Text style={[styles.statusText, { color: colors.text }]}>
                        {task.isRefining ? t.textureOptimization : getStatusLabel(task.status)}
                      </Text>
                    </View>
                    {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && <View style={styles.progressBarContainer}><View style={[styles.progressBarBg, { backgroundColor: colors.inputBackground }]}><View style={[styles.progressBarFill, { width: `${task.progress}%`, backgroundColor: isRainbow ? getRainbowColor(idx + 5) : colors.accent }]} /></View><Text style={[styles.progressText, { color: colors.textSecondary }]}>{task.progress}%</Text></View>}
                    {task.modelHeightMeters && (
                      <Text style={[styles.taskScaleText, { color: colors.textSecondary }]}>
                        Höhe: {task.modelHeightMeters} m
                      </Text>
                    )}
                  </View>
                </View>
                {task.status === 'SUCCEEDED' && task.modelUrls && (
                  <View style={styles.downloadLinks}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {task.modelUrls.glb && (
                        <TouchableOpacity
                          style={[styles.shareChip, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}
                          onPress={() => task.modelUrls?.glb && shareToLitterboxAndAR(task.id, task.modelUrls.glb, task.modelHeightMeters)}
                          disabled={uploadingTaskId === `${task.id}-ar`}
                        >
                          {uploadingTaskId === `${task.id}-ar` ? (
                            <ActivityIndicator size="small" color={colors.success} />
                          ) : (
                            <>
                              <Share2 size={12} color={colors.success} />
                              <Text style={[styles.shareChipText, { color: colors.success }]}>{t.arShare}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {task.modelUrls.glb && (
                        <TouchableOpacity
                          style={[styles.shareChip, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}
                          onPress={() => task.modelUrls?.glb && shareToDownload(task.taskId, task.modelUrls.glb)}
                          disabled={uploadingTaskId === `${task.id}-glb`}
                        >
                          {uploadingTaskId === `${task.id}-glb` ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                          ) : (
                            <>
                              <Share2 size={12} color={colors.accent} />
                              <Text style={[styles.shareChipText, { color: colors.accent }]}>GLB</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getStatusIcon(status: string) {
  if (status === 'PENDING') return <Clock size={16} color="#FF9F43" />;
  if (status === 'IN_PROGRESS') return <Loader size={16} color="#48DBFB" />;
  if (status === 'SUCCEEDED') return <CheckCircle size={16} color="#1DD1A1" />;
  return <AlertCircle size={16} color="#FF5E57" />;
}

function getStatusText(status: string) {
  const map: any = { PENDING: 'Wartend', IN_PROGRESS: 'Wird verarbeitet', SUCCEEDED: 'Fertig', FAILED: 'Fehlgeschlagen', EXPIRED: 'Abgelaufen' };
  return map[status] || status;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, marginTop: 6 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  imageCard: { width: '47%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  addImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, borderStyle: 'dashed', borderWidth: 1, borderRadius: 16, borderColor: '#ccc' },
  addIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  addImageText: { fontSize: 14, fontWeight: '600' },
  removeButton: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  labelBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  labelText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  helpBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpOverlayLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  helpOverlayText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scaleCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, gap: 10 },
  scaleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scaleTitle: { fontSize: 15, fontWeight: '700' },
  scaleUnit: { fontSize: 12, fontWeight: '600' },
  scaleInput: { height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 16, fontWeight: '600' },
  scaleHint: { fontSize: 12, lineHeight: 17 },
  createButton: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  createButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  tasksSection: { marginTop: 24 },
  taskCard: { borderRadius: 16, padding: 14, marginTop: 12 },
  taskHeader: { flexDirection: 'row', gap: 12 },
  taskThumbnail: { width: 64, height: 64, borderRadius: 12 },
  taskThumbnailPlaceholder: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  taskInfo: { flex: 1, gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 15, fontWeight: '600' },
  taskScaleText: { fontSize: 12, fontWeight: '600' },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '600', width: 36, textAlign: 'right' },
  downloadLinks: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.2)' },
  shareChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  shareChipText: { fontSize: 12, fontWeight: '700' },
});
