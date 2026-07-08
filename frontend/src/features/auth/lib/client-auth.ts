'use client';

export interface StoredAccount {
  username: string;
  account: string;
}

export interface StoredInstance {
  instanceName: string;
  organizationName: string;
}

const ACCOUNT_KEY = 'courtos:auth:account';
const INSTANCE_KEY = 'courtos:auth:instance';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readStoredAccount(): StoredAccount | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAccount;
  } catch {
    return null;
  }
}

export function saveStoredAccount(payload: StoredAccount) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(payload));
}

export function clearStoredAccount() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCOUNT_KEY);
}

export function readStoredInstance(): StoredInstance | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(INSTANCE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredInstance;
  } catch {
    return null;
  }
}

export function saveStoredInstance(payload: StoredInstance) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(INSTANCE_KEY, JSON.stringify(payload));
}

export function clearStoredInstance() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(INSTANCE_KEY);
}

export function hasStoredInstance() {
  return !!readStoredInstance();
}

export function clearStoredAuthState() {
  clearStoredAccount();
  clearStoredInstance();
}
