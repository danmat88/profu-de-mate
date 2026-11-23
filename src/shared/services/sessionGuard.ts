import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { authSessionIdentityKey } from './authSessionIdentity';

let generation = 0;

export type ActiveSession = {
  userId: string;
  sessionKey: string;
  generation: number;
};

export class SessionChangedError extends Error {
  readonly code = 'session/changed';

  constructor() {
    super('Contul s-a schimbat. Reia acțiunea din contul curent.');
    this.name = 'SessionChangedError';
  }
}

/** Invalidate callbacks immediately, before native authentication finishes. */
export function invalidateSessionOperations(): void {
  generation += 1;
}

export function currentSessionGeneration(): number {
  return generation;
}

export function captureSession(expectedUserId?: string): ActiveSession {
  const user = getAuth(getApp()).currentUser;
  const sessionKey = authSessionIdentityKey(user);
  if (!user || !sessionKey || (expectedUserId !== undefined && user.uid !== expectedUserId)) {
    throw new SessionChangedError();
  }
  return { userId: user.uid, sessionKey, generation };
}

export function assertSessionActive(session: ActiveSession): void {
  if (session.generation !== generation
    || authSessionIdentityKey(getAuth(getApp()).currentUser) !== session.sessionKey) {
    throw new SessionChangedError();
  }
}
