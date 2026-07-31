import type { FastifyInstance, FastifyReply } from 'fastify';
import { replaceAvailabilityInputSchema, upsertSportProfileInputSchema } from '@rondo/contracts';
import { deleteSportProfile, listSportProfiles, replaceAvailability, upsertSportProfile } from './sportProfiles.service.js';
import { SportProfileServiceError } from './errors.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof SportProfileServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerSportProfileRoutes(app: FastifyInstance): void {
  app.get('/api/v1/me/sport-profiles', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const profiles = await listSportProfiles(request.currentUser.id);
    return { data: profiles };
  });

  app.put<{ Params: { sportId: string }; Body: unknown }>(
    '/api/v1/me/sport-profiles/:sportId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = upsertSportProfileInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'INVALID_INPUT', message: 'Datos de perfil deportivo inválidos.', details: parsed.error.issues },
        });
      }

      try {
        const profile = await upsertSportProfile(request.currentUser.id, request.params.sportId, parsed.data);
        return { data: profile };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.put<{ Params: { sportId: string }; Body: unknown }>(
    '/api/v1/me/sport-profiles/:sportId/availability',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = replaceAvailabilityInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'INVALID_INPUT', message: 'Datos de disponibilidad inválidos.', details: parsed.error.issues },
        });
      }

      try {
        const profile = await replaceAvailability(request.currentUser.id, request.params.sportId, parsed.data);
        return { data: profile };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.delete<{ Params: { sportId: string } }>(
    '/api/v1/me/sport-profiles/:sportId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        await deleteSportProfile(request.currentUser.id, request.params.sportId);
        return reply.code(204).send();
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
