import type { FastifyInstance, FastifyReply } from 'fastify';
import { getMatchCandidates } from './matching.service.js';
import { MatchServiceError } from './errors.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerCandidateRoutes(app: FastifyInstance): void {
  app.get<{ Params: { matchId: string } }>(
    '/api/v1/matches/:matchId/candidates',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        const candidates = await getMatchCandidates(request.params.matchId);
        return { data: candidates };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
