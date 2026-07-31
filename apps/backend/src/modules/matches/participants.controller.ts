import type { FastifyInstance, FastifyReply } from 'fastify';
import { getMatchParticipants, leaveMatch, removeParticipant } from './participants.service.js';
import { MatchServiceError } from './errors.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerParticipantRoutes(app: FastifyInstance): void {
  app.get<{ Params: { matchId: string } }>(
    '/api/v1/matches/:matchId/participants',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        const participants = await getMatchParticipants(request.params.matchId);
        return { data: participants };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.delete<{ Params: { matchId: string; userId: string } }>(
    '/api/v1/matches/:matchId/participants/:userId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        await removeParticipant(request.params.matchId, request.currentUser.id, request.params.userId);
        return reply.code(204).send();
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: { matchId: string } }>('/api/v1/matches/:matchId/leave', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    try {
      await leaveMatch(request.params.matchId, request.currentUser.id);
      return reply.code(204).send();
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });
}
