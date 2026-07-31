import type { FastifyInstance, FastifyReply } from 'fastify';
import { sendMatchChatMessageInputSchema } from '@rondo/contracts';
import { listChatMessages, sendChatMessage } from './chat.service.js';
import { MatchServiceError } from './errors.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerMatchChatRoutes(app: FastifyInstance): void {
  app.get<{ Params: { matchId: string } }>(
    '/api/v1/matches/:matchId/chat/messages',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        const chat = await listChatMessages(request.params.matchId, request.currentUser.id);
        return { data: chat };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: { matchId: string }; Body: unknown }>(
    '/api/v1/matches/:matchId/chat/messages',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = sendMatchChatMessageInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'INVALID_INPUT', message: 'El mensaje no es válido.', details: parsed.error.issues },
        });
      }

      try {
        const message = await sendChatMessage(request.params.matchId, request.currentUser.id, parsed.data);
        return reply.code(201).send({ data: message });
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
