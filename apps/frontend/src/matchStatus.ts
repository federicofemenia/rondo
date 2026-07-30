import type { MatchStatusDto } from '@rondo/contracts';

export const MATCH_STATUS_LABELS: Record<MatchStatusDto, string> = {
  ORGANIZING: 'Organizando',
  FULL: 'Completo',
  IN_PROGRESS: 'En juego',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Vencido',
};

export const MATCH_STATUS_CHIP_STYLES: Record<MatchStatusDto, { bgcolor: string; color: string }> = {
  ORGANIZING: { bgcolor: 'rgba(245, 197, 66, 0.16)', color: 'warning.main' },
  FULL: { bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light' },
  IN_PROGRESS: { bgcolor: 'rgba(77, 163, 255, 0.16)', color: 'info.main' },
  COMPLETED: { bgcolor: 'background.default', color: 'text.secondary' },
  CANCELLED: { bgcolor: 'rgba(255, 77, 79, 0.16)', color: 'error.main' },
  EXPIRED: { bgcolor: 'background.default', color: 'text.secondary' },
};
