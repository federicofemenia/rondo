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
import type { MatchStatusDto } from '@rondo/contracts';
import RatePlayerDialog from './RatePlayerDialog';
import type { PlayerRating } from './types';

type MatchRatingsPageProps = {
  status: MatchStatusDto;
  ratingsOpen: boolean;
  participants?: string[];
  ratings?: Record<string, PlayerRating>;
  currentUserName?: string;
  onRatePlayer?: (name: string, rating: PlayerRating) => void;
};

function InfoMessage({ children }: { children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
      <Typography color="text.secondary">{children}</Typography>
    </Card>
  );
}

function MatchRatingsPage({
  status,
  ratingsOpen,
  participants = [],
  ratings = {},
  currentUserName = 'Federico',
  onRatePlayer,
}: MatchRatingsPageProps) {
  const [activePlayer, setActivePlayer] = useState<string | null>(null);

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

  if (!ratingsOpen) {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
        <InfoMessage>El período para valorar este partido finalizó.</InfoMessage>
      </Box>
    );
  }

  const rows = [...participants.map((name) => ({ name, isSelf: false })), { name: currentUserName, isSelf: true }];

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
          {rows.map((row) => {
            const rated = Boolean(ratings[row.name]);
            return (
              <Stack
                key={row.name}
                direction="row"
                alignItems="center"
                spacing={3}
                sx={{ p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}
              >
                <Avatar sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                  <PersonRoundedIcon sx={{ color: 'text.secondary' }} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{row.name}</Typography>
                  <Chip
                    label={row.isSelf ? 'Vos' : rated ? 'Valoración enviada' : 'Pendiente'}
                    size="small"
                    sx={{
                      mt: 0.5,
                      fontWeight: 700,
                      bgcolor: row.isSelf ? 'background.default' : rated ? 'rgba(46, 204, 113, 0.16)' : 'rgba(245, 197, 66, 0.16)',
                      color: row.isSelf ? 'text.secondary' : rated ? 'primary.light' : 'warning.main',
                    }}
                  />
                </Box>
                {!row.isSelf ? (
                  <Button variant={rated ? 'outlined' : 'contained'} size="small" onClick={() => setActivePlayer(row.name)}>
                    {rated ? 'Editar' : 'Valorar'}
                  </Button>
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      </Card>

      <RatePlayerDialog
        key={activePlayer ?? 'none'}
        open={activePlayer !== null}
        playerName={activePlayer ?? ''}
        initialRating={activePlayer ? (ratings[activePlayer] ?? null) : null}
        onClose={() => setActivePlayer(null)}
        onSubmit={(rating) => {
          if (activePlayer) {
            onRatePlayer?.(activePlayer, rating);
          }
        }}
      />
    </Box>
  );
}

export default MatchRatingsPage;
