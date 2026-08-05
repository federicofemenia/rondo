import type { ClubAdminUserDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';
import { MatchServiceError } from '../matches/errors.js';
import { displayName } from '../users/users.service.js';

export async function getClubAdmins(clubId: string): Promise<ClubAdminUserDto[]> {
  const memberships = await prisma.clubMembership.findMany({
    where: { clubId, role: 'CLUB_ADMIN', status: 'ACTIVE' },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map((membership) => ({
    id: membership.user.id,
    displayName: displayName(membership.user),
    username: membership.user.username,
    avatarUrl: membership.user.avatarUrl,
  }));
}

/**
 * SUPERADMIN only (enforced by the controller). Creates an ACTIVE CLUB_ADMIN
 * membership if none exists, promotes an existing MEMBER, or reactivates an
 * INACTIVE one — the upsert on the (clubId, userId) unique constraint makes
 * all three the same operation, so a duplicate membership row can never be
 * created by assigning the same user twice.
 */
export async function assignClubAdmin(clubId: string, targetUserId: string): Promise<ClubAdminUserDto[]> {
  const [club, targetUser] = await Promise.all([
    prisma.club.findUnique({ where: { id: clubId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } }),
  ]);
  if (!club) {
    throw new MatchServiceError(404, 'CLUB_NOT_FOUND', 'El club no existe.');
  }
  if (!targetUser) {
    throw new MatchServiceError(404, 'USER_NOT_FOUND', 'El usuario indicado no existe.');
  }

  await prisma.clubMembership.upsert({
    where: { clubId_userId: { clubId, userId: targetUserId } },
    update: { role: 'CLUB_ADMIN', status: 'ACTIVE' },
    create: { clubId, userId: targetUserId, role: 'CLUB_ADMIN', status: 'ACTIVE' },
  });

  return getClubAdmins(clubId);
}

/**
 * SUPERADMIN only (enforced by the controller). Degrades the membership to
 * MEMBER rather than deleting the row, and unconditionally refuses to remove
 * a club's last active admin — even for a SUPERADMIN — so a club can never
 * end up with zero CLUB_ADMIN members through this endpoint. A SUPERADMIN
 * who genuinely needs to replace the sole admin should assign a new one
 * first, then remove the old one; this is the deliberate MVP decision for
 * the "removing the last admin" edge case the spec left open.
 */
export async function removeClubAdmin(clubId: string, targetUserId: string): Promise<ClubAdminUserDto[]> {
  const membership = await prisma.clubMembership.findUnique({ where: { clubId_userId: { clubId, userId: targetUserId } } });
  if (!membership || membership.role !== 'CLUB_ADMIN' || membership.status !== 'ACTIVE') {
    throw new MatchServiceError(404, 'CLUB_ADMIN_NOT_FOUND', 'Ese usuario no es administrador activo de este club.');
  }

  const activeAdminsCount = await prisma.clubMembership.count({ where: { clubId, role: 'CLUB_ADMIN', status: 'ACTIVE' } });
  if (activeAdminsCount <= 1) {
    throw new MatchServiceError(409, 'LAST_CLUB_ADMIN', 'No podés quitar al único administrador activo del club.');
  }

  await prisma.clubMembership.update({ where: { id: membership.id }, data: { role: 'MEMBER' } });
  return getClubAdmins(clubId);
}
