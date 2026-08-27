type AuthSessionIdentity = {
  uid: string;
  isAnonymous: boolean;
  providerData: ReadonlyArray<{ providerId: string }>;
};

/**
 * Produces local cache metadata for the complete visible auth state. A direct
 * anonymous-to-Google link keeps the Firebase UID, so UID alone is not enough
 * to decide whether an access snapshot still belongs to the active session.
 */
export function authSessionIdentityKey(user: AuthSessionIdentity | null): string | null {
  if (!user) return null;
  const providers = user.providerData
    .map((provider) => provider.providerId)
    .filter(Boolean)
    .sort()
    .join(',');
  return `${user.uid}|${user.isAnonymous ? 'anonymous' : 'identified'}|${providers}`;
}
