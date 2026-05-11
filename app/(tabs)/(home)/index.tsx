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
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImagePlus, X, Sparkles, Box, Clock, CheckCircle, AlertCircle, Loader, Share2 } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createTripoTask, getTripoTaskStatus, mapTripoStatus, createTripoRefineTask, imageUriToBase64DataUrl } from '@/utils/tripo';
import { rainbowGradient } from '@/constants/colors';
import { useHistory } from '@/contexts/HistoryContext';

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
}

export default function HomeScreen() {
  const { colors, mode } = useTheme();
  const { apiKey, hasApiKey } = useSettings();
  const { t } = useLanguage();
  const {
    addEntry,
    activeTasks,
    addActiveTask,
    updateActiveTask,
    removeActiveTask,
    updateTaskProgress
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
  const pollIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const buttonScale = useRef(new Animated.Value(1)).current;

  const isRainbow = mode === 'rainbow';

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
        const currentThumb = tripoData.output?.rendered_image;
        const currentModel = tripoData.output?.pbr_model || tripoData.output?.model
          ? { glb: tripoData.output.pbr_model || tripoData.output.model }
          : undefined;

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
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          });
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
  }, [apiKey, addEntry, updateTaskProgress, updateActiveTask, removeActiveTask, t.model]);

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
            modelUrls: at.modelUrls
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
      return await createTripoTask(apiKey, imageUris);
    },
    onSuccess: ({ taskId, tokens }) => {
      const entry: TaskEntry = {
        id: `${Date.now()}`,
        taskId,
        tokens,
        status: 'PENDING',
        progress: 0,
        createdAt: new Date().toISOString()
      };

      addActiveTask({
        id: entry.id,
        taskId: entry.taskId,
        createdAt: entry.createdAt,
        progress: 0,
        status: 'PENDING'
      });

      setTasks((prev) => [entry, ...prev]);
      setImages([null, null, null, null]);
      startPolling(taskId);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => Alert.alert(t.error, error.message),
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

  const shareToLitterboxAndAR = useCallback(async (taskId: string, glbUrl: string) => {
    setUploadingTaskId(taskId);
    try {
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('time', '24h');
      // @ts-ignore
      formData.append('fileToUpload', { uri: glbUrl, name: 'model.glb', type: 'model/gltf-binary' });
      const uploadRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: formData });
      const litterboxUrl = await uploadRes.text();
      const viewerUrl = `https://skaterdenni-coder.github.io/AR-Viewer/?model=${encodeURIComponent(litterboxUrl.trim())}`;
      await Share.share({ message: `Check out my 3D model in AR: ${viewerUrl}`, url: viewerUrl, title: 'Share AR Model' });
    } catch (e) { Alert.alert(t.error, t.uploadFailed); } finally { setUploadingTaskId(null); }
  }, [t]);

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
          {images.map((img, idx) => (
            <View key={PLACEHOLDERS[idx].id} style={[styles.imageCard, { backgroundColor: colors.card, borderColor: isRainbow ? getRainbowColor(idx) : colors.cardBorder, borderWidth: isRainbow ? 2 : 1 }]}>
              {img ? (
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
            </View>
          ))}
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
                  </View>
                </View>
                {task.status === 'SUCCEEDED' && task.modelUrls && (
                  <View style={styles.downloadLinks}>
                    {task.modelUrls.glb && <TouchableOpacity style={[styles.shareChip, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]} onPress={() => task.modelUrls?.glb && shareToLitterboxAndAR(task.id, task.modelUrls.glb)} disabled={uploadingTaskId === task.id}>{uploadingTaskId === task.id ? <ActivityIndicator size="small" color={colors.success} /> : <><Share2 size={12} color={colors.success} /><Text style={[styles.shareChipText, { color: colors.success }]}>{t.arShare}</Text></>}</TouchableOpacity>}
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
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '600', width: 36, textAlign: 'right' },
  downloadLinks: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.2)' },
  shareChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  shareChipText: { fontSize: 12, fontWeight: '700' },
});
