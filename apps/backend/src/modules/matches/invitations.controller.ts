import type { FastifyInstance, FastifyReply } from 'fastify';
import { createInvitationInputSchema } from '@rondo/contracts';
import { acceptInvitation, cancelInvitation, createInvitation, listMyInvitations, rejectInvitation } from './invitations.service.js';
import { MatchServiceError } from './errors.js';

function sendServiceError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof MatchServiceError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function registerInvitationRoutes(app: FastifyInstance): void {
  app.get('/api/v1/me/invitations', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const invitations = await listMyInvitations(request.currentUser.id);
    return { data: invitations };
  });

  app.post<{ Params: { matchId: string }; Body: unknown }>(
    '/api/v1/matches/:matchId/invitations',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      const parsed = createInvitationInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'INVALID_INPUT', message: 'Datos de invitación inválidos.', details: parsed.error.issues },
        });
      }

      try {
        const invitation = await createInvitation(request.params.matchId, request.currentUser.id, parsed.data);
        return reply.code(201).send({ data: invitation });
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: { invitationId: string } }>(
    '/api/v1/invitations/:invitationId/accept',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        const invitation = await acceptInvitation(request.params.invitationId, request.currentUser.id);
        return { data: invitation };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: { invitationId: string } }>(
    '/api/v1/invitations/:invitationId/reject',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        const invitation = await rejectInvitation(request.params.invitationId, request.currentUser.id);
        return { data: invitation };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );

  app.post<{ Params: { invitationId: string } }>(
    '/api/v1/invitations/:invitationId/cancel',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      if (!request.currentUser) {
        return reply;
      }

      try {
        const invitation = await cancelInvitation(request.params.invitationId, request.currentUser.id);
        return { data: invitation };
      } catch (error) {
        return sendServiceError(reply, error);
      }
    },
  );
}
