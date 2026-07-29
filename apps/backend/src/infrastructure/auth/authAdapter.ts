export interface AuthenticatedClerkProfile {
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface AuthAdapter {
  authenticate(authorizationHeader: string | undefined): Promise<AuthenticatedClerkProfile | null>;
}
