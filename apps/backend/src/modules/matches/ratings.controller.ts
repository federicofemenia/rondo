import type { FastifyInstance, FastifyReply } from 'fastify';
import { rateParticipantInputSchema } from '@rondo/contracts';
import { getMatchRatings, rateParticipant } from './ratings.service.js';
import { MatchServiceError } from './errors.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerRatingRoutes(app: FastifyInstance): void {
  app.get<{ Params: { matchId: string } }>(
    '/api/v1/matches/:matchId/ratings',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        const ratings = await getMatchRatings(request.params.matchId, request.currentUser.id);
        return { data: ratings };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.put<{ Params: { matchId: string; targetUserId: string }; Body: unknown }>(
    '/api/v1/matches/:matchId/ratings/:targetUserId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = rateParticipantInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'INVALID_INPUT', message: 'Datos de valoración inválidos.', details: parsed.error.issues },
        });
      }

      try {
        const rating = await rateParticipant(request.params.matchId, request.currentUser.id, request.params.targetUserId, parsed.data);
        return { data: rating };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
