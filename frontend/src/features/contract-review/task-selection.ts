export function findRefreshedTaskSnapshot<T extends { id: string }>(
  selectedTaskId: string | null,
  serverTasks: readonly T[],
): T | null {
  const selected = selectedTaskId?.trim();
  if (!selected) return null;
  return serverTasks.find((task) => task.id === selected) ?? null;
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
