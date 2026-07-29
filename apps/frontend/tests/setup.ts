import { afterEach, beforeEach, vi } from 'vitest';
import type { SportDto } from '@rondo/contracts';

export const mockSportsCatalog: SportDto[] = [
  {
    id: 'sport-football',
    code: 'football',
    name: 'Fútbol',
    displayOrder: 1,
    modalities: [{ id: 'modality-football-5', code: 'football-5', name: 'Fútbol 5', playersCount: 10, displayOrder: 1 }],
  },
  {
    id: 'sport-padel',
    code: 'padel',
    name: 'Pádel',
    displayOrder: 2,
    modalities: [{ id: 'modality-padel-doubles', code: 'padel-doubles', name: 'Dobles', playersCount: 4, displayOrder: 1 }],
  },
];

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/v1/sports')) {
      return new Response(JSON.stringify({ data: mockSportsCatalog }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unhandled fetch in tests: ${url}`);
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});
