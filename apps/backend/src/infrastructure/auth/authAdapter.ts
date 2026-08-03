export interface AuthenticatedClerkProfile {
  clerkUserId: string;
  /** Optional: the beta authenticates via username, so an account may have no email at all. */
  email?: string | null;
  /** Set only if the Clerk instance has username enabled. */
  username?: string | null;
  /** From Clerk's unsafeMetadata, set at sign-up when the app collects a single "visible name" field. */
  displayName?: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface AuthAdapter {
  authenticate(authorizationHeader: string | undefined): Promise<AuthenticatedClerkProfile | null>;
}
