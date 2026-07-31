import { useEffect, useState } from 'react';
import type { CandidateDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { ApiError, useApi } from './apiClient';
import PageFooter from './PageFooter';

export type CandidateMatchSummary = {
  sport: string;
  modality: string;
  clubName: string | null;
  positions: string[];
};

type CandidatesPageProps = {
  matchId: string;
  matchSummary?: CandidateMatchSummary | null;
  excludeNames?: string[];
  onInviteCandidate?: (name: string) => void;
  onFinish?: () => void;
};

const positionAbbreviations: Record<string, string> = {
  Arquero: 'ARQ',
  Defensor: 'DEF',
  Mediocampista: 'MED',
  Delantero: 'DEL',
};

function candidateDisplayName(candidate: CandidateDto): string {
  const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim();
  return fullName || 'Jugador';
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function CandidatesPage({ matchId, matchSummary, excludeNames = [], onInviteCandidate, onFinish }: CandidatesPageProps) {
  const api = useApi();
  const [candidates, setCandidates] = useState<CandidateDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitedName, setInvitedName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const response = await api.get<{ data: CandidateDto[] }>(`/api/v1/matches/${matchId}/candidates`);
        if (!cancelled) {
          setCandidates(response.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(describeError(caught, 'No pudimos cargar los candidatos. Reintentá más tarde.'));
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
  }, [matchId]);

  const handleInvite = (candidate: CandidateDto) => {
    const name = candidateDisplayName(candidate);
    setInvitedName(name);
    onInviteCandidate?.(name);
  };

  const visibleCandidates = (candidates ?? []).filter((candidate) => !excludeNames.includes(candidateDisplayName(candidate)));

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: onFinish ? '120px' : 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider', mb: 6 }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Candidatos compatibles
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
          {matchSummary?.sport ? (
            <Chip label={`Compatibles con ${matchSummary.sport}`} sx={{ bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light', fontWeight: 700 }} />
          ) : null}
          {matchSummary?.modality ? (
            <Chip label={matchSummary.modality} sx={{ bgcolor: 'background.default', color: 'info.main', fontWeight: 700 }} />
          ) : null}
          {matchSummary?.clubName ? (
            <Chip label={matchSummary.clubName} sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }} />
          ) : null}
        </Stack>

        {invitedName ? (
          <Typography sx={{ mb: 4, color: 'primary.light', fontWeight: 600 }}>Invitación enviada a {invitedName}.</Typography>
        ) : null}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress />
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : visibleCandidates.length === 0 ? (
          <Typography color="text.secondary">No encontramos jugadores compatibles para este partido.</Typography>
        ) : (
          <Stack spacing={3}>
            {visibleCandidates.map((candidate) => (
              <Card key={candidate.id} variant="outlined" sx={{ p: 4, bgcolor: 'background.default', borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={candidate.avatarUrl ?? undefined}
                      sx={{ width: 40, height: 40, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                    >
                      {!candidate.avatarUrl ? <PersonRoundedIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} /> : null}
                    </Avatar>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="h3" component="h2">
                        {candidateDisplayName(candidate)}
                      </Typography>
                      {candidate.positions.map((position) => (
                        <Tooltip key={position} title={position}>
                          <Chip
                            label={positionAbbreviations[position] ?? position}
                            size="small"
                            sx={{ bgcolor: 'background.paper', color: 'text.secondary', fontWeight: 700 }}
                          />
                        </Tooltip>
                      ))}
                    </Stack>
                  </Stack>
                  <Chip
                    label={candidate.matchingAvailability}
                    size="small"
                    sx={{ bgcolor: 'rgba(77, 163, 255, 0.16)', color: 'info.main', fontWeight: 700 }}
                  />
                </Stack>

                <Button variant="outlined" color="primary" fullWidth onClick={() => handleInvite(candidate)} sx={{ mt: 3 }}>
                  Invitar
                </Button>
              </Card>
            ))}
          </Stack>
        )}
      </Card>

      {onFinish ? (
        <PageFooter>
          <Button fullWidth variant="contained" size="large" onClick={onFinish} sx={{ borderRadius: 999 }}>
            Finalizar
          </Button>
        </PageFooter>
      ) : null}
    </Box>
  );
}

export default CandidatesPage;
