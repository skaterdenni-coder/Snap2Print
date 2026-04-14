import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_STORAGE_KEY = 'model_history';
const ACTIVE_TASKS_KEY = 'active_model_tasks';

export interface HistoryEntry {
  id: string;
  taskId: string;
  thumbnailUrl?: string;
  modelUrls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  createdAt: string;
  completedAt: string;
}

export interface ActiveTask {
  id: string;
  taskId: string;
  createdAt: string;
  progress: number;
}

export const [HistoryProvider, useHistory] = createContextHook(() => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedHistory = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (storedHistory) {
          setEntries(JSON.parse(storedHistory));
        }

        const storedTasks = await AsyncStorage.getItem(ACTIVE_TASKS_KEY);
        if (storedTasks) {
          setActiveTasks(JSON.parse(storedTasks));
        }
      } catch (e) {
        console.error('[History] Failed to load data:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  const persistHistory = useCallback((updated: HistoryEntry[]) => {
    AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
      console.error('[History] Failed to persist history:', e),
    );
  }, []);

  const persistActiveTasks = useCallback((updated: ActiveTask[]) => {
    AsyncStorage.setItem(ACTIVE_TASKS_KEY, JSON.stringify(updated)).catch((e) =>
      console.error('[History] Failed to persist active tasks:', e),
    );
  }, []);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.taskId === entry.taskId);
      if (exists) return prev;
      const updated = [entry, ...prev];
      persistHistory(updated);

      // Remove from active tasks when finished
      setActiveTasks(current => {
        const filtered = current.filter(t => t.taskId !== entry.taskId);
        persistActiveTasks(filtered);
        return filtered;
      });

      return updated;
    });
  }, [persistHistory, persistActiveTasks]);

  const addActiveTask = useCallback((task: ActiveTask) => {
    setActiveTasks(prev => {
      const updated = [task, ...prev];
      persistActiveTasks(updated);
      return updated;
    });
  }, [persistActiveTasks]);

  const updateTaskProgress = useCallback((taskId: string, progress: number) => {
    setActiveTasks(prev => {
      const updated = prev.map(t => t.taskId === taskId ? { ...t, progress } : t);
      // We don't persist every single progress step to save storage writes
      return updated;
    });
  }, []);

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
    updateTaskProgress,
    removeEntry,
    clearHistory,
    isLoaded
  };
});
