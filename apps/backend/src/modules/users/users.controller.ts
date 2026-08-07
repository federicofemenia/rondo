import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Club, ClubMembership, User } from '@prisma/client';
import type { UserClubDto, UserDto } from '@rondo/contracts';
import { avatarUploadUrlRequestSchema, sportIdQuerySchema, updateProfileInputSchema } from '@rondo/contracts';
import type { AvatarStorage } from '../../infrastructure/storage/avatarStorage.js';
import { MatchServiceError } from '../matches/errors.js';
import { getRatingComments } from '../matches/ratings.service.js';
import { getPublicProfile } from './publicProfile.service.js';
import { displayName, getUserClubMemberships, updateProfile } from './users.service.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

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

export function registerUserRoutes(app: FastifyInstance, avatarStorage: AvatarStorage | null): void {
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

    // avatarUrl must have actually been issued by our own storage for this
    // exact user -- otherwise this field would let any authenticated user
    // set an arbitrary URL (including another user's avatar) as their own.
    if (parsed.data.avatarUrl != null) {
      if (!avatarStorage || !avatarStorage.isOwnAvatarUrl(request.currentUser.id, parsed.data.avatarUrl)) {
        return reply.code(400).send({ error: { code: 'INVALID_AVATAR_URL', message: 'La URL de avatar no es válida.' } });
      }
    }

    // The user being updated is always the authenticated caller (request.currentUser),
    // never something the client could point at via the request body.
    const user = await updateProfile(request.currentUser.id, parsed.data);
    return { data: toUserDto(user) };
  });

  app.post<{ Body: unknown }>('/api/v1/me/avatar/upload-url', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    if (!avatarStorage) {
      return reply.code(503).send({ error: { code: 'AVATAR_STORAGE_NOT_CONFIGURED', message: 'La carga de avatar no está disponible en este momento.' } });
    }

    const parsed = avatarUploadUrlRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: 'Tipo de archivo inválido. Usá JPG, PNG o WEBP.', details: parsed.error.issues },
      });
    }

    const result = await avatarStorage.createUploadUrl(request.currentUser.id, parsed.data.contentType);
    return { data: result };
  });

  app.get<{ Params: { id: string }; Querystring: { sportId?: string } }>(
    '/api/v1/users/:id/public-profile',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = sportIdQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'INVALID_INPUT', message: 'sportId es obligatorio y debe ser un id válido.', details: parsed.error.issues },
        });
      }

      try {
        const profile = await getPublicProfile(request.params.id, parsed.data.sportId);
        return { data: profile };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { sportId?: string } }>(
    '/api/v1/users/:id/rating-comments',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = sportIdQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'INVALID_INPUT', message: 'sportId es obligatorio y debe ser un id válido.', details: parsed.error.issues },
        });
      }

      const comments = await getRatingComments(request.params.id, parsed.data.sportId);
      return { data: comments };
    },
  );
}
