import type { ApiMode } from '@/lib/api/client';
import type { Task } from '@/types/task';

export function shouldUseLocalCommandSimulation(apiMode: ApiMode) {
  return apiMode === 'mock';
}

export function reconcileDispatchedTaskList({
  tasks,
  realTask,
  optimisticId,
  ownerUserId,
}: {
  tasks: Task[];
  realTask: Task;
  optimisticId: string | null;
  ownerUserId?: string;
}) {
  const taskWithOwner: Task = { ...realTask, ownerUserId };
  const existing = tasks.some((task) => task.id === realTask.id || task.id === optimisticId);
  if (!existing) return [taskWithOwner, ...tasks];
  return tasks.map((task) =>
    task.id === realTask.id || task.id === optimisticId ? taskWithOwner : task,
  );
}

export function removeOptimisticCommandTasks(tasks: Task[]) {
  return tasks.filter((task) => !task.id.startsWith('tmp-'));
}
