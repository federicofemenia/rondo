import type { FastifyInstance, FastifyReply } from 'fastify';
import { assignClubAdminInputSchema, createClubInputSchema, createCourtInputSchema, updateClubInputSchema, updateCourtInputSchema } from '@rondo/contracts';
import { requireClubManagementAccess, requireSuperadmin } from './adminAuth.js';
import { createClub, getAdminClubDetail, listAdminClubs, updateClub } from './adminClubs.service.js';
import { assignClubAdmin, getClubAdmins, removeClubAdmin } from './adminClubAdmins.service.js';
import { searchAdminUsers } from './adminUsers.service.js';
import { createCourt, listAdminCourts, updateCourt } from './adminCourts.service.js';
import { MatchServiceError } from '../matches/errors.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerAdminRoutes(app: FastifyInstance): void {
  app.get('/api/v1/admin/clubs', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }
    const clubs = await listAdminClubs(request.currentUser.id);
    return { data: clubs };
  });

  app.post<{ Body: unknown }>('/api/v1/admin/clubs', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const parsed = createClubInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Datos de club inválidos.', details: parsed.error.issues } });
    }

    try {
      await requireSuperadmin(request.currentUser.id);
      const club = await createClub(parsed.data);
      return reply.code(201).send({ data: club });
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.get<{ Params: { clubId: string } }>('/api/v1/admin/clubs/:clubId', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    try {
      const access = await requireClubManagementAccess(request.currentUser.id, request.params.clubId);
      const club = await getAdminClubDetail(request.params.clubId, access);
      return { data: club };
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.put<{ Params: { clubId: string }; Body: unknown }>(
    '/api/v1/admin/clubs/:clubId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = updateClubInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Datos de club inválidos.', details: parsed.error.issues } });
      }

      try {
        const access = await requireClubManagementAccess(request.currentUser.id, request.params.clubId);
        const club = await updateClub(request.params.clubId, access, parsed.data);
        return { data: club };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.get<{ Querystring: { q?: string } }>('/api/v1/admin/users/search', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    try {
      await requireSuperadmin(request.currentUser.id);
      const users = await searchAdminUsers(request.query.q ?? '');
      return { data: users };
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.get<{ Params: { clubId: string } }>(
    '/api/v1/admin/clubs/:clubId/admins',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        await requireClubManagementAccess(request.currentUser.id, request.params.clubId);
        const admins = await getClubAdmins(request.params.clubId);
        return { data: admins };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: { clubId: string }; Body: unknown }>(
    '/api/v1/admin/clubs/:clubId/admins',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = assignClubAdminInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Datos inválidos.', details: parsed.error.issues } });
      }

      try {
        await requireSuperadmin(request.currentUser.id);
        const admins = await assignClubAdmin(request.params.clubId, parsed.data.userId);
        return reply.code(201).send({ data: admins });
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.delete<{ Params: { clubId: string; userId: string } }>(
    '/api/v1/admin/clubs/:clubId/admins/:userId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        await requireSuperadmin(request.currentUser.id);
        const admins = await removeClubAdmin(request.params.clubId, request.params.userId);
        return { data: admins };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.get<{ Params: { clubId: string } }>(
    '/api/v1/admin/clubs/:clubId/courts',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        await requireClubManagementAccess(request.currentUser.id, request.params.clubId);
        const courts = await listAdminCourts(request.params.clubId);
        return { data: courts };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: { clubId: string }; Body: unknown }>(
    '/api/v1/admin/clubs/:clubId/courts',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = createCourtInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Datos de cancha inválidos.', details: parsed.error.issues } });
      }

      try {
        await requireClubManagementAccess(request.currentUser.id, request.params.clubId);
        const court = await createCourt(request.params.clubId, parsed.data);
        return reply.code(201).send({ data: court });
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.put<{ Params: { clubId: string; courtId: string }; Body: unknown }>(
    '/api/v1/admin/clubs/:clubId/courts/:courtId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = updateCourtInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Datos de cancha inválidos.', details: parsed.error.issues } });
      }

      try {
        await requireClubManagementAccess(request.currentUser.id, request.params.clubId);
        const court = await updateCourt(request.params.clubId, request.params.courtId, parsed.data);
        return { data: court };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
