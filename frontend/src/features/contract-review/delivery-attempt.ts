export interface DeliveryAttemptIdentity {
  taskId: string;
  finalMemorialId: string;
  finalMemorialVersion: number;
  deliveryFormulaVersion: string;
}

function attemptIdentityKey(identity: DeliveryAttemptIdentity): string {
  return [
    identity.taskId,
    identity.finalMemorialId,
    identity.finalMemorialVersion,
    identity.deliveryFormulaVersion,
  ].join('\u0000');
}

export class DeliveryAttemptRegistry {
  private readonly keys = new Map<string, string>();

  constructor(private readonly createKey: () => string) {}

  keyFor(identity: DeliveryAttemptIdentity): string {
    const identityKey = attemptIdentityKey(identity);
    const existing = this.keys.get(identityKey);
    if (existing) return existing;
    const created = this.createKey();
    this.keys.set(identityKey, created);
    return created;
  }

  confirm(identity: DeliveryAttemptIdentity): void {
    this.keys.delete(attemptIdentityKey(identity));
  }
}
