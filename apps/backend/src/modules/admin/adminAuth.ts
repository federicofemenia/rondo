import type { ClubMembership, User } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { MatchServiceError } from '../matches/errors.js';

/**
 * Global platform role vs. per-club role -- deliberately two different
 * questions, never conflated (see UserRole's doc comment in schema.prisma).
 * Every admin controller route calls one of these with the *authenticated*
 * user's id (request.currentUser.id) -- never a userId read from the body,
 * so a client can't escalate privileges by sending someone else's id.
 */

export async function requireSuperadmin(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'SUPERADMIN') {
    throw new MatchServiceError(403, 'SUPERADMIN_REQUIRED', 'Esta acción requiere permisos de administrador de la plataforma.');
  }
  return user;
}

/** An ACTIVE ClubMembership with role CLUB_ADMIN for *this specific* club -- never satisfied by being SUPERADMIN, nor by a membership in a different club. */
export async function requireClubAdmin(userId: string, clubId: string): Promise<ClubMembership> {
  const membership = await prisma.clubMembership.findUnique({ where: { clubId_userId: { clubId, userId } } });
  if (!membership || membership.role !== 'CLUB_ADMIN' || membership.status !== 'ACTIVE') {
    throw new MatchServiceError(403, 'CLUB_MANAGEMENT_ACCESS_DENIED', 'No tenés permisos para administrar este club.');
  }
  return membership;
}

export type ClubManagementAccess = { isSuperadmin: boolean };

/**
 * The actual guard every club/court-admin endpoint uses: SUPERADMIN can
 * manage any club; otherwise the user needs an ACTIVE CLUB_ADMIN membership
 * for *this* clubId specifically -- an arbitrary clubId in the URL never
 * grants access just because the user administers a *different* club.
 */
export async function requireClubManagementAccess(userId: string, clubId: string): Promise<ClubManagementAccess> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.role === 'SUPERADMIN') {
    return { isSuperadmin: true };
  }
  await requireClubAdmin(userId, clubId);
  return { isSuperadmin: false };
}
