import { useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { calculateAge } from './age';
import PageFooter from './PageFooter';
import PlayerReviewsDialog from './PlayerReviewsDialog';
import type { CandidateReview } from './PlayerReviewsDialog';

export type CandidateMatchSummary = {
  sport: string;
  modality: string;
  clubName: string | null;
  positions: string[];
};

type CandidatesPageProps = {
  matchDraft?: CandidateMatchSummary | null;
  excludeNames?: string[];
  onInviteCandidate?: (name: string) => void;
  onFinish?: () => void;
};

const positions: Record<string, string> = {
  Arquero: 'ARQ',
  Defensor: 'DEF',
  Mediocampista: 'MED',
  Delantero: 'DEL',
};

const candidates = [
  {
    id: 1,
    name: 'Mauro',
    sport: 'Fútbol',
    availability: 'Sábado • 18:00',
    position: 'Delantero',
    birthDate: '1996-03-14',
    photoUrl: null as string | null,
    conduct: 4.8,
    skill: 4.5,
    reviews: [
      { id: 1, author: 'Lina', conduct: 5, skill: 5, comment: 'Buenísima onda, siempre puntual.' },
      { id: 2, author: 'Tomás', conduct: 5, skill: 4, comment: 'Juega muy bien de delantero, buen finish.' },
      { id: 3, author: 'Valentina', conduct: 4, skill: 4, comment: 'Buen compañero de equipo.' },
    ] satisfies CandidateReview[],
  },
  {
    id: 2,
    name: 'Lina',
    sport: 'Fútbol',
    availability: 'Domingo • 17:00',
    position: 'Mediocampista',
    birthDate: '1999-08-02',
    photoUrl: null as string | null,
    conduct: 4.6,
    skill: 4.2,
    reviews: [
      { id: 1, author: 'Mauro', conduct: 5, skill: 4, comment: 'Reparte muy bien el juego.' },
      { id: 2, author: 'Diego', conduct: 4, skill: 4, comment: 'Siempre suma buena onda al equipo.' },
    ] satisfies CandidateReview[],
  },
  {
    id: 3,
    name: 'Tomás',
    sport: 'Básquet',
    availability: 'Viernes • 20:00',
    position: 'Defensor',
    birthDate: '1993-11-20',
    photoUrl: null as string | null,
    conduct: 4.9,
    skill: 4.7,
    reviews: [
      { id: 1, author: 'Andrés', conduct: 5, skill: 5, comment: 'Excelente defensa, muy comprometido.' },
    ] satisfies CandidateReview[],
  },
];

function CandidatesPage({ matchDraft, excludeNames = [], onInviteCandidate, onFinish }: CandidatesPageProps) {
  const [invitedName, setInvitedName] = useState<string | null>(null);
  const [reviewsFor, setReviewsFor] = useState<(typeof candidates)[number] | null>(null);
  const selectedSport = matchDraft?.sport ?? 'Fútbol';
  const candidatesForSport = useMemo(
    () => candidates.filter((candidate) => candidate.sport === selectedSport && !excludeNames.includes(candidate.name)),
    [selectedSport, excludeNames],
  );

  const handleInvite = (name: string) => {
    setInvitedName(name);
    onInviteCandidate?.(name);
  };

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: onFinish ? '120px' : 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider', mb: 6 }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Candidatos compatibles
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
          <Chip label={`Compatibles con ${selectedSport}`} sx={{ bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light', fontWeight: 700 }} />
          {matchDraft?.modality ? (
            <Chip label={matchDraft.modality} sx={{ bgcolor: 'background.default', color: 'info.main', fontWeight: 700 }} />
          ) : null}
          {matchDraft?.clubName ? (
            <Chip label={matchDraft.clubName} sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }} />
          ) : null}
        </Stack>

        {invitedName ? (
          <Typography sx={{ mb: 4, color: 'primary.light', fontWeight: 600 }}>Invitación enviada a {invitedName}.</Typography>
        ) : null}

        {candidatesForSport.length === 0 ? (
          <Typography color="text.secondary">No hay más candidatos disponibles para invitar.</Typography>
        ) : null}

        <Stack spacing={3}>
          {candidatesForSport.map((candidate) => {
            const age = calculateAge(candidate.birthDate);
            return (
            <Card key={candidate.id} variant="outlined" sx={{ p: 4, bgcolor: 'background.default', borderColor: 'divider' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    src={candidate.photoUrl ?? undefined}
                    sx={{ width: 40, height: 40, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                  >
                    {!candidate.photoUrl ? <PersonRoundedIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} /> : null}
                  </Avatar>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h3" component="h2">
                      {candidate.name}
                    </Typography>
                    <Tooltip title={candidate.position}>
                      <Chip label={positions[candidate.position] ?? candidate.position} size="small" sx={{ bgcolor: 'background.paper', color: 'text.secondary', fontWeight: 700 }} />
                    </Tooltip>
                  </Stack>
                </Stack>
                <Chip label="Disponible" size="small" sx={{ bgcolor: 'rgba(77, 163, 255, 0.16)', color: 'info.main', fontWeight: 700 }} />
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {candidate.sport}
                {age !== null ? ` • ${age} años` : ''} • {candidate.availability}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 3, color: 'text.secondary' }}>
                <StarRoundedIcon sx={{ fontSize: '1rem', color: 'warning.main' }} />
                <Typography variant="caption">Conducta {candidate.conduct.toFixed(1)}</Typography>
                <Typography variant="caption">•</Typography>
                <StarRoundedIcon sx={{ fontSize: '1rem', color: 'warning.main' }} />
                <Typography variant="caption">Juego {candidate.skill.toFixed(1)}</Typography>
                <Typography variant="caption">•</Typography>
                <Button variant="text" size="small" onClick={() => setReviewsFor(candidate)} sx={{ minWidth: 0, p: 0, fontWeight: 700 }}>
                  {candidate.reviews.length} comentarios
                </Button>
              </Stack>

              {matchDraft?.positions.includes(candidate.position) ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                  <CheckCircleRoundedIcon sx={{ fontSize: '1rem', color: 'primary.light' }} />
                  <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 700 }}>
                    Coincide con una posición requerida
                  </Typography>
                </Stack>
              ) : null}

              <Button variant="outlined" color="primary" fullWidth onClick={() => handleInvite(candidate.name)}>
                Invitar
              </Button>
            </Card>
            );
          })}
        </Stack>
      </Card>

      {onFinish ? (
        <PageFooter>
          <Button fullWidth variant="contained" size="large" onClick={onFinish} sx={{ borderRadius: 999 }}>
            Finalizar
          </Button>
        </PageFooter>
      ) : null}

      <PlayerReviewsDialog
        open={reviewsFor !== null}
        onClose={() => setReviewsFor(null)}
        playerName={reviewsFor?.name ?? ''}
        reviews={reviewsFor?.reviews ?? []}
      />
    </Box>
  );
}

export default CandidatesPage;
