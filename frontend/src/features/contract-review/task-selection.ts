export function selectContractTaskCandidate({
  requestedTaskId,
  activeMemorialId,
  activeMemorialIsContract,
}: {
  requestedTaskId: string | null;
  edictPrimaryTaskId: string | null;
  activeMemorialId: string | null;
  activeMemorialIsContract: boolean;
}): string | null {
  const explicit = requestedTaskId?.trim();
  if (explicit) return explicit;
  if (!activeMemorialIsContract) return null;
  return activeMemorialId?.trim() || null;
}
