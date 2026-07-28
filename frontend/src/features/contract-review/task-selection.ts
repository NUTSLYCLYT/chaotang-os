export function findRefreshedTaskSnapshot<T extends { id: string }>(
  selectedTaskId: string | null,
  serverTasks: readonly T[],
): T | null {
  const selected = selectedTaskId?.trim();
  if (!selected) return null;
  return serverTasks.find((task) => task.id === selected) ?? null;
}

export function rememberServerContractTaskIds<
  T extends { id: string; contractTask?: boolean },
>(
  current: Set<string>,
  serverTasks: readonly T[],
): Set<string> {
  const newlyConfirmed = serverTasks.filter(
    (task) => task.contractTask === true && !current.has(task.id),
  );
  if (newlyConfirmed.length === 0) return current;
  const next = new Set(current);
  for (const task of newlyConfirmed) next.add(task.id);
  return next;
}

export function resolveSelectedTaskSnapshot<
  T extends { id: string; contractTask?: boolean },
>(
  selectedTask: T | null,
  serverTasks: readonly T[],
  confirmedContractTaskIds: ReadonlySet<string>,
): T | null {
  const refreshed = findRefreshedTaskSnapshot(
    selectedTask?.id ?? null,
    serverTasks,
  );
  if (refreshed) return refreshed;
  if (
    selectedTask
    && confirmedContractTaskIds.has(selectedTask.id)
    && selectedTask.contractTask !== true
  ) {
    return { ...selectedTask, contractTask: true };
  }
  return selectedTask;
}

export function selectContractTaskCandidate({
  requestedTaskId,
  requestedTaskIsContract,
  activeMemorialId,
  activeMemorialIsContract,
}: {
  requestedTaskId: string | null;
  requestedTaskIsContract: boolean;
  edictPrimaryTaskId: string | null;
  activeMemorialId: string | null;
  activeMemorialIsContract: boolean;
}): string | null {
  const explicit = requestedTaskId?.trim();
  if (explicit) {
    if (activeMemorialId === explicit) {
      return requestedTaskIsContract ? explicit : null;
    }
  }
  if (!activeMemorialIsContract) return null;
  return activeMemorialId?.trim() || null;
}
