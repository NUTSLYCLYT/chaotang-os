import { useAppStore } from '@/lib/store/app-store';

export function useScopedTasks() {
  return useAppStore((s) =>
    s.currentUserId
      ? s.tasks.filter((t) => !t.ownerUserId || t.ownerUserId === s.currentUserId)
      : s.tasks,
  );
}

export function useScopedCurrentTask() {
  return useAppStore((s) => {
    if (!s.currentTaskId) return null;
    const task = s.tasks.find((t) => t.id === s.currentTaskId);
    if (!task) return null;
    if (s.currentUserId && task.ownerUserId && task.ownerUserId !== s.currentUserId) return null;
    return task;
  });
}
