import { createClerkClient, verifyToken } from '@clerk/backend';
import type { AuthAdapter, AuthenticatedClerkProfile } from './authAdapter.js';

const BEARER_PREFIX = 'Bearer ';

export function createClerkAuthAdapter(secretKey: string): AuthAdapter {
  const clerkClient = createClerkClient({ secretKey });

  return {
    async authenticate(authorizationHeader) {
      if (!authorizationHeader?.startsWith(BEARER_PREFIX)) {
        return null;
      }

      const token = authorizationHeader.slice(BEARER_PREFIX.length);

      let clerkUserId: string;
      try {
        const claims = await verifyToken(token, { secretKey });
        clerkUserId = claims.sub;
      } catch {
        return null;
      }

      const user = await clerkClient.users.getUser(clerkUserId);
      // Email is no longer required to authenticate: the beta signs testers
      // up with username + password only, so an account may have none.
      const primaryEmail =
        user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;

      const metadata = user.unsafeMetadata as Record<string, unknown> | undefined;
      const metadataDisplayName = typeof metadata?.displayName === 'string' ? metadata.displayName : null;

      const profile: AuthenticatedClerkProfile = {
        clerkUserId: user.id,
        email: primaryEmail,
        username: user.username,
        displayName: metadataDisplayName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.imageUrl || null,
      };

      return profile;
    },
  };
}
