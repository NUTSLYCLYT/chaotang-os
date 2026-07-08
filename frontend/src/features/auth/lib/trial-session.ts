export interface TrialRegistrationInput {
  username?: string;
  account?: string;
}

export interface TrialRegistrationUser {
  username: string;
  account: string;
}

function normalizeValue(value?: string) {
  return value?.trim().slice(0, 64) ?? '';
}

export function normalizeTrialRegistration(
  input: TrialRegistrationInput,
): TrialRegistrationUser | null {
  const username = normalizeValue(input.username);
  const account = normalizeValue(input.account);

  if (!username || !account) return null;

  return {
    username,
    account,
  };
}

