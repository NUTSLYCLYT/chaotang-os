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
    if (!requestedTaskIsContract || activeMemorialId !== explicit) return null;
    return explicit;
  }
  if (!activeMemorialIsContract) return null;
  return activeMemorialId?.trim() || null;
}
