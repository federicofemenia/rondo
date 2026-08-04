import type { FastifyInstance } from 'fastify';
import type { Club, ClubMembership, User } from '@prisma/client';
import type { UserClubDto, UserDto } from '@rondo/contracts';
import { updateProfileInputSchema } from '@rondo/contracts';
import { getRatingComments } from '../matches/ratings.service.js';
import { getPublicProfile } from './publicProfile.service.js';
import { displayName, getUserClubMemberships, updateProfile } from './users.service.js';

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: displayName(user),
    avatarUrl: user.avatarUrl,
    sex: user.sex,
    biography: user.biography,
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

  app.put<{ Body: unknown }>('/api/v1/me/profile', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const parsed = updateProfileInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: 'Datos de perfil inválidos.', details: parsed.error.issues },
      });
    }

    // The user being updated is always the authenticated caller (request.currentUser),
    // never something the client could point at via the request body.
    const user = await updateProfile(request.currentUser.id, parsed.data);
    return { data: toUserDto(user) };
  });

  app.get<{ Params: { id: string } }>('/api/v1/users/:id/public-profile', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const profile = await getPublicProfile(request.params.id);
    if (!profile) {
      return reply.code(404).send({ error: { code: 'USER_NOT_FOUND', message: 'El usuario indicado no existe.' } });
    }

    return { data: profile };
  });

  app.get<{ Params: { id: string } }>('/api/v1/users/:id/rating-comments', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const comments = await getRatingComments(request.params.id);
    return { data: comments };
  });
}
