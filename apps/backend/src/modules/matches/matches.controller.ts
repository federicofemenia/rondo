import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createMatchInputSchema } from '@rondo/contracts';
import { cancelMatch, createMatch, findMatchWithRelations, listUserMatches, toMatchSummaryDto } from './matches.service.js';
import { MatchServiceError } from './errors.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerMatchRoutes(app: FastifyInstance): void {
  app.get('/api/v1/me/matches', { preHandler: app.requireAuth }, async (request: FastifyRequest, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const matches = await listUserMatches(request.currentUser.id);
    return { data: matches.map((match) => toMatchSummaryDto(match, request.currentUser!.id)) };
  });

  app.post<{ Body: unknown }>('/api/v1/matches', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const parsed = createMatchInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: 'Datos de partido inválidos.', details: parsed.error.issues },
      });
    }

    try {
      const match = await createMatch(request.currentUser.id, parsed.data);
      return reply.code(201).send({ data: toMatchSummaryDto(match, request.currentUser.id) });
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.get<{ Params: { matchId: string } }>('/api/v1/matches/:matchId', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const match = await findMatchWithRelations(request.params.matchId);
    if (!match) {
      return reply.code(404).send({ error: { code: 'MATCH_NOT_FOUND', message: 'El partido no existe.' } });
    }

    return { data: toMatchSummaryDto(match, request.currentUser.id) };
  });

  app.post<{ Params: { matchId: string }; Body: { reason?: string } }>(
    '/api/v1/matches/:matchId/cancellation',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        const match = await cancelMatch(request.params.matchId, request.currentUser.id, request.body?.reason);
        return { data: toMatchSummaryDto(match, request.currentUser.id) };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
