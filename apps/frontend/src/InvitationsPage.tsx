import { useEffect, useState } from 'react';
import type { MatchInvitationDto, MatchInvitationStatusDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { ApiError, useApi } from './apiClient';
import { describeSchedule } from './scheduleFormat';

type InvitationsPageProps = {
  onBack?: () => void;
  onRespond?: () => void;
  onViewMatch?: (matchId: string) => void;
};

const STATUS_LABELS: Record<MatchInvitationStatusDto, string> = {
  PENDING: 'Pendiente de confirmación',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const STATUS_STYLES: Record<MatchInvitationStatusDto, { bgcolor: string; color: string }> = {
  PENDING: { bgcolor: 'rgba(245, 197, 66, 0.16)', color: 'warning.main' },
  ACCEPTED: { bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light' },
  REJECTED: { bgcolor: 'rgba(255, 77, 79, 0.16)', color: 'error.main' },
  CANCELLED: { bgcolor: 'background.default', color: 'text.secondary' },
};

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function InvitationsPage({ onBack, onRespond, onViewMatch }: InvitationsPageProps) {
  const api = useApi();
  const [invitations, setInvitations] = useState<MatchInvitationDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondErrors, setRespondErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get<{ data: MatchInvitationDto[] }>('/api/v1/me/invitations');
        if (!cancelled) {
          setInvitations(response.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(describeError(caught, 'No pudimos cargar tus invitaciones. Reintentá más tarde.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = async (invitation: MatchInvitationDto, action: 'accept' | 'reject') => {
    setRespondingId(invitation.id);
    setRespondErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== invitation.id)));

    try {
      const response = await api.post<{ data: MatchInvitationDto }>(`/api/v1/invitations/${invitation.id}/${action}`);
      setInvitations((current) => (current ?? []).map((current_) => (current_.id === invitation.id ? response.data : current_)));
      onRespond?.();
    } catch (caught) {
      setRespondErrors((current) => ({
        ...current,
        [invitation.id]: describeError(caught, 'No pudimos procesar tu respuesta. Reintentá.'),
      }));
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: 12 }}>
      <IconButton aria-label="Volver" onClick={onBack} sx={{ mb: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <ArrowBackRoundedIcon />
      </IconButton>

      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Mis invitaciones
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Partidos a los que te invitaron otros organizadores.
        </Typography>

        {loading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress />
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (invitations ?? []).length === 0 ? (
          <Typography color="text.secondary">Todavía no tenés invitaciones.</Typography>
        ) : (
          <Stack spacing={3}>
            {(invitations ?? []).map((invitation) => {
              const schedule = describeSchedule(invitation);
              const isPending = invitation.status === 'PENDING';
              const isAccepted = invitation.status === 'ACCEPTED';
              const isResponding = respondingId === invitation.id;
              const respondError = respondErrors[invitation.id];

              return (
                <Card key={invitation.id} variant="outlined" sx={{ p: 4, bgcolor: 'background.default', borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="h3" component="h2">
                        {invitation.sportName} • {invitation.modalityName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Organiza {invitation.organizerDisplayName}
                        {invitation.clubName ? ` • ${invitation.clubName}` : ''}
                      </Typography>
                    </Box>
                    <Chip
                      label={STATUS_LABELS[invitation.status]}
                      size="small"
                      sx={{ fontWeight: 700, ...STATUS_STYLES[invitation.status] }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: isPending || (isAccepted && onViewMatch) ? 3 : 0 }}>
                    <Chip label={schedule.dateLabel} size="small" sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 700 }} />
                    <Chip
                      label={schedule.isConfirmed ? schedule.timeLabel : `Franja ${schedule.windowLabel}`}
                      size="small"
                      sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 700 }}
                    />
                    {invitation.position ? (
                      <Chip label={invitation.position} size="small" sx={{ bgcolor: 'background.paper', color: 'text.secondary', fontWeight: 700 }} />
                    ) : null}
                  </Stack>

                  {respondError ? (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {respondError}
                    </Alert>
                  ) : null}

                  {isPending ? (
                    <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        disabled={isResponding}
                        onClick={() => void respond(invitation, 'accept')}
                      >
                        {isResponding ? 'Enviando…' : 'Aceptar'}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        fullWidth
                        disabled={isResponding}
                        onClick={() => void respond(invitation, 'reject')}
                      >
                        Rechazar
                      </Button>
                    </Stack>
                  ) : null}

                  {isAccepted && onViewMatch ? (
                    <Button variant="outlined" fullWidth sx={{ mt: 3 }} onClick={() => onViewMatch(invitation.matchId)}>
                      Ver partido
                    </Button>
                  ) : null}
                </Card>
              );
            })}
          </Stack>
        )}
      </Card>
    </Box>
  );
}

export default InvitationsPage;
