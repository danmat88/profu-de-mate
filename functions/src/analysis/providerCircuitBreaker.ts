const DEFAULT_FAILURE_THRESHOLD = 4;
const DEFAULT_COOLDOWN_MS = 60_000;

export class ProviderCircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    private readonly cooldownMs = DEFAULT_COOLDOWN_MS,
  ) {}

  canRequest(now = Date.now()): boolean {
    if (this.openedAt === null) return true;
    if (now - this.openedAt < this.cooldownMs) return false;

    // Permit a new probe after the cooldown. A failed probe reopens the circuit.
    this.consecutiveFailures = this.failureThreshold - 1;
    this.openedAt = null;
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  recordFailure(now = Date.now()): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) this.openedAt = now;
  }
}
