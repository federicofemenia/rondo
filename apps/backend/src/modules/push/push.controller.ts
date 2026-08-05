import type { FastifyInstance, FastifyReply } from 'fastify';
import { deletePushSubscriptionInputSchema, pushSubscriptionInputSchema } from '@rondo/contracts';
import { MatchServiceError } from '../matches/errors.js';
import { deleteSubscription, listSubscriptions, saveSubscription, sendTestNotification } from './push.service.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerPushRoutes(app: FastifyInstance): void {
  app.get('/api/v1/me/push-subscriptions', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const status = await listSubscriptions(request.currentUser.id);
    return { data: status };
  });

  app.post<{ Body: unknown }>('/api/v1/me/push-subscriptions', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const parsed = pushSubscriptionInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: 'Datos de suscripción push inválidos.', details: parsed.error.issues },
      });
    }

    const userAgent = request.headers['user-agent'] ?? null;
    const status = await saveSubscription(request.currentUser.id, parsed.data, userAgent);
    return { data: status };
  });

  app.delete<{ Body: unknown }>('/api/v1/me/push-subscriptions', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const parsed = deletePushSubscriptionInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: 'endpoint es obligatorio y debe ser una URL válida.', details: parsed.error.issues },
      });
    }

    try {
      await deleteSubscription(request.currentUser.id, parsed.data.endpoint);
      return reply.code(204).send();
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.post('/api/v1/me/push-subscriptions/test', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    try {
      const result = await sendTestNotification(request.currentUser.id);
      return { data: result };
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });
}
