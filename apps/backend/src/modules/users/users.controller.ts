import type { FastifyInstance } from 'fastify';
import type { Club, ClubMembership, User } from '@prisma/client';
import type { UserClubDto, UserDto } from '@rondo/contracts';
import { getUserClubMemberships } from './users.service.js';

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function toUserClubDto(membership: ClubMembership & { club: Club }): UserClubDto {
  return {
    id: membership.club.id,
    code: membership.club.code,
    name: membership.club.name,
    role: membership.role,
    status: membership.status,
    isFavorite: membership.isFavorite,
  };
}

export function registerUserRoutes(app: FastifyInstance): void {
  app.get('/api/v1/me', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    return { data: toUserDto(request.currentUser) };
  });

  app.get('/api/v1/me/clubs', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const memberships = await getUserClubMemberships(request.currentUser.id);
    return { data: memberships.map(toUserClubDto) };
  });
}
