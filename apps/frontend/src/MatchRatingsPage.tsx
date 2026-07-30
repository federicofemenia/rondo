import { useState } from 'react';
import type { ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import type { MatchStatusDto, RatingsParticipantDto } from '@rondo/contracts';
import RatePlayerDialog from './RatePlayerDialog';
import type { PlayerRating } from './types';

type MatchRatingsPageProps = {
  status: MatchStatusDto;
  closed?: boolean;
  loading?: boolean;
  loadError?: boolean;
  participants?: RatingsParticipantDto[];
  onRatePlayer?: (targetUserId: string, rating: PlayerRating) => Promise<void> | void;
};

function InfoMessage({ children }: { children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
      <Typography color="text.secondary">{children}</Typography>
    </Card>
  );
}

function MatchRatingsPage({ status, closed = false, loading = false, loadError = false, participants = [], onRatePlayer }: MatchRatingsPageProps) {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const activeParticipant = participants.find((participant) => participant.userId === activePlayerId) ?? null;

  if (status === 'CANCELLED') {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
        <InfoMessage>Este partido fue cancelado y no admite valoraciones.</InfoMessage>
      </Box>
    );
  }

  if (status === 'EXPIRED') {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
        <InfoMessage>Este partido venció sin completarse y no admite valoraciones.</InfoMessage>
      </Box>
    );
  }

  if (status !== 'COMPLETED') {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
        <InfoMessage>Las valoraciones se habilitarán cuando finalice el partido.</InfoMessage>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
        <InfoMessage>Cargando valoraciones…</InfoMessage>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
        <InfoMessage>No pudimos cargar las valoraciones. Reintentá más tarde.</InfoMessage>
      </Box>
    );
  }

  if (closed) {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
        <InfoMessage>El período para valorar este partido finalizó.</InfoMessage>
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Valoraciones
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Valorá el nivel de juego y la conducta de cada participante. No podés valorarte a vos mismo.
        </Typography>

        <Stack spacing={2}>
          {participants.map((participant) => (
            <Stack
              key={participant.userId}
              direction="row"
              alignItems="center"
              spacing={3}
              sx={{ p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}
            >
              <Avatar
                src={participant.avatarUrl ?? undefined}
                sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}
              >
                {!participant.avatarUrl ? <PersonRoundedIcon sx={{ color: 'text.secondary' }} /> : null}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>{participant.displayName}</Typography>
                <Chip
                  label={participant.status === 'SELF' ? 'Vos' : participant.status === 'COMPLETED' ? 'Valoración enviada' : 'Pendiente'}
                  size="small"
                  sx={{
                    mt: 0.5,
                    fontWeight: 700,
                    bgcolor:
                      participant.status === 'SELF'
                        ? 'background.default'
                        : participant.status === 'COMPLETED'
                          ? 'rgba(46, 204, 113, 0.16)'
                          : 'rgba(245, 197, 66, 0.16)',
                    color: participant.status === 'SELF' ? 'text.secondary' : participant.status === 'COMPLETED' ? 'primary.light' : 'warning.main',
                  }}
                />
              </Box>
              {participant.status !== 'SELF' ? (
                <Button
                  variant={participant.status === 'COMPLETED' ? 'outlined' : 'contained'}
                  size="small"
                  onClick={() => setActivePlayerId(participant.userId)}
                >
                  {participant.status === 'COMPLETED' ? 'Editar' : 'Valorar'}
                </Button>
              ) : null}
            </Stack>
          ))}
        </Stack>
      </Card>

      <RatePlayerDialog
        key={activePlayerId ?? 'none'}
        open={activeParticipant !== null}
        playerName={activeParticipant?.displayName ?? ''}
        initialRating={
          activeParticipant?.rating
            ? {
                gameplayScore: activeParticipant.rating.gameplayScore,
                conductScore: activeParticipant.rating.conductScore,
                comment: activeParticipant.rating.comment ?? undefined,
              }
            : null
        }
        onClose={() => setActivePlayerId(null)}
        onSubmit={async (rating) => {
          if (activePlayerId) {
            await onRatePlayer?.(activePlayerId, rating);
          }
        }}
      />
    </Box>
  );
}

export default MatchRatingsPage;
