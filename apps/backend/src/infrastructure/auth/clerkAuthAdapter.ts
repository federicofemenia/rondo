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
      const primaryEmail =
        user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress;

      if (!primaryEmail) {
        return null;
      }

      const profile: AuthenticatedClerkProfile = {
        clerkUserId: user.id,
        email: primaryEmail,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.imageUrl || null,
      };

      return profile;
    },
  };
}
