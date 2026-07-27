export function selectContractTaskCandidate({
  requestedTaskId,
}: {
  requestedTaskId: string | null;
  edictPrimaryTaskId: string | null;
  activeMemorialId: string | null;
}): string | null {
  const explicit = requestedTaskId?.trim();
  return explicit || null;
}
