import type { FastifyInstance } from 'fastify';
import type { Sport, SportModality } from '@prisma/client';
import type { SportDto, SportModalityDto } from '@rondo/contracts';
import { prisma } from '../../infrastructure/database/prisma.js';

function toSportModalityDto(modality: SportModality): SportModalityDto {
  return {
    id: modality.id,
    code: modality.code,
    name: modality.name,
    playersCount: modality.playersCount,
    displayOrder: modality.displayOrder,
  };
}

function toSportDto(sport: Sport & { modalities: SportModality[] }): SportDto {
  return {
    id: sport.id,
    code: sport.code,
    name: sport.name,
    displayOrder: sport.displayOrder,
    modalities: sport.modalities.map(toSportModalityDto),
  };
}

export function registerSportRoutes(app: FastifyInstance): void {
  app.get('/api/v1/sports', async () => {
    const sports = await prisma.sport.findMany({
      include: { modalities: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });

    return { data: sports.map(toSportDto) };
  });
}
