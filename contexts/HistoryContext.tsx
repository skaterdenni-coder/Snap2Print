import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_STORAGE_KEY = 'model_history';
const ACTIVE_TASKS_KEY = 'active_model_tasks';

export interface HistoryEntry {
  id: string;
  taskId: string;
  name?: string;
  baseTaskId?: string;
  thumbnailUrl?: string;
  modelUrls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  modelHeightMeters?: number;
  createdAt: string;
  completedAt: string;
}

export interface ActiveTask {
  id: string;
  taskId: string;
  createdAt: string;
  progress: number;
  isRefining?: boolean;
  baseTaskId?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  thumbnailUrl?: string;
  modelUrls?: { glb?: string };
  modelHeightMeters?: number;
}

export const [HistoryProvider, useHistory] = createContextHook(() => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedHistory = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (storedHistory) setEntries(JSON.parse(storedHistory));

        const storedTasks = await AsyncStorage.getItem(ACTIVE_TASKS_KEY);
        if (storedTasks) setActiveTasks(JSON.parse(storedTasks));
      } catch (e) {
        console.error('[History] Load failed:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  const persistHistory = useCallback((updated: HistoryEntry[]) => {
    AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const persistActiveTasks = useCallback((updated: ActiveTask[]) => {
    AsyncStorage.setItem(ACTIVE_TASKS_KEY, JSON.stringify(updated));
  }, []);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const filtered = entry.baseTaskId
        ? prev.filter(e => e.taskId !== entry.baseTaskId)
        : prev;

      const exists = filtered.some((e) => e.taskId === entry.taskId);
      if (exists) return filtered;

      const updated = [entry, ...filtered];
      persistHistory(updated);
      return updated;
    });
  }, [persistHistory]);

  const addActiveTask = useCallback((task: ActiveTask) => {
    setActiveTasks(prev => {
      const updated = [task, ...prev];
      persistActiveTasks(updated);
      return updated;
    });
  }, [persistActiveTasks]);

  const updateActiveTask = useCallback((oldId: string, newData: Partial<ActiveTask>) => {
    setActiveTasks(prev => {
      const updated = prev.map(t => t.taskId === oldId ? { ...t, ...newData } : t);
      persistActiveTasks(updated);
      return updated;
    });
  }, [persistActiveTasks]);

  const removeActiveTask = useCallback((taskId: string) => {
    setActiveTasks(prev => {
      const updated = prev.filter(t => t.taskId !== taskId);
      persistActiveTasks(updated);
      return updated;
    });
  }, [persistActiveTasks]);

  const updateTaskProgress = useCallback((taskId: string, progress: number, extraData?: Partial<ActiveTask>) => {
    setActiveTasks(prev => {
      const updated = prev.map(t => t.taskId === taskId ? { ...t, progress, ...extraData } : t);
      // Wir persistieren nicht jeden 1%-Schritt, um die Performance zu schonen,
      // aber alle 10% oder bei Statusänderungen (extraData) schreiben wir auf die Disk.
      const currentTask = prev.find(t => t.taskId === taskId);
      if (extraData || (currentTask && Math.abs(currentTask.progress - progress) >= 10)) {
         persistActiveTasks(updated);
      }
      return updated;
    });
  }, [persistActiveTasks]);

  const removeEntry = useCallback((taskId: string) => {
    setEntries((prev) => {
      const updated = prev.filter((e) => e.taskId !== taskId);
      persistHistory(updated);
      return updated;
    });
  }, [persistHistory]);

  const clearHistory = useCallback(() => {
    setEntries([]);
    AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
  }, []);

  return {
    entries,
    activeTasks,
    addEntry,
    addActiveTask,
    updateActiveTask,
    removeActiveTask,
    updateTaskProgress,
    removeEntry,
    clearHistory,
    isLoaded
  };
});
