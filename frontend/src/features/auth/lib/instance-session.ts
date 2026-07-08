export interface TrialInstanceInput {
  instanceName?: string;
  organizationName?: string;
}

export interface TrialInstance {
  instanceName: string;
  organizationName: string;
}

function normalizeValue(value?: string) {
  return value?.trim().slice(0, 80) ?? '';
}

export function normalizeTrialInstance(
  input: TrialInstanceInput,
): TrialInstance | null {
  const instanceName = normalizeValue(input.instanceName);
  const organizationName = normalizeValue(input.organizationName);

  if (!instanceName || !organizationName) return null;

  return {
    instanceName,
    organizationName,
  };
}
