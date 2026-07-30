import type { FastifyInstance } from 'fastify';
import { getPendingTasks } from './pendingTasks.service.js';

export function registerPendingTaskRoutes(app: FastifyInstance): void {
  app.get('/api/v1/me/pending-tasks', { preHandler: app.requireAuth }, async (request, reply) => {
    if (!request.currentUser) {
      return reply;
    }

    const tasks = await getPendingTasks(request.currentUser.id);
    return { data: tasks };
  });
}
