import { useEffect, useState } from 'react';
import type { CandidateDto, MatchInvitationDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { ApiError, useApi } from './apiClient';
import PlayerProfileCardDialog from './PlayerProfileCardDialog';

export type CandidateMatchSummary = {
  sport: string;
  modality: string;
  clubName: string | null;
  positions: string[];
};

type MatchCandidatesSectionProps = {
  matchId: string;
  matchSummary?: CandidateMatchSummary | null;
  /** Fired right after a candidate is successfully invited, so a parent showing pending invitations elsewhere (e.g. MatchPlayersPage's roster) can refresh without a full page reload. */
  onInvited?: (candidateId: string) => void;
};

const positionAbbreviations: Record<string, string> = {
  Arquero: 'ARQ',
  Defensor: 'DEF',
  Mediocampista: 'MED',
  Delantero: 'DEL',
};

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function CandidateRatingsSummary({ ratings }: { ratings: CandidateDto['ratings'] }) {
  if (ratings.count === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Sin valoraciones
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Rating
          value={ratings.gameplayAverage ?? 0}
          precision={0.5}
          readOnly
          size="small"
          icon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'primary.main' }} />}
          emptyIcon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'divider' }} />}
        />
        <Typography variant="caption" color="text.secondary">
          Juego
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Rating
          value={ratings.conductAverage ?? 0}
          precision={0.5}
          readOnly
          size="small"
          icon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'primary.main' }} />}
          emptyIcon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'divider' }} />}
        />
        <Typography variant="caption" color="text.secondary">
          Conducta
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {ratings.count} {ratings.count === 1 ? 'valoración' : 'valoraciones'}
      </Typography>
    </Stack>
  );
}

/**
 * Fetches and renders the real matching candidates for a match: avatar,
 * positions, availability, ratings, a real Invitar button, and the public
 * player card dialog on tap. Shared by the standalone Candidatos wizard step
 * (CandidatesPage) and the embedded search inside the Jugadores tab
 * (MatchDetailPage) so the matching/inviting logic only lives in one place.
 */
function MatchCandidatesSection({ matchId, matchSummary, onInvited }: MatchCandidatesSectionProps) {
  const api = useApi();
  const [candidates, setCandidates] = useState<CandidateDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

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

  const handleInvite = async (candidate: CandidateDto) => {
    setInvitingId(candidate.id);
    setInviteErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== candidate.id)));

    try {
      await api.post<{ data: MatchInvitationDto }>(`/api/v1/matches/${matchId}/invitations`, { invitedUserId: candidate.id });
      setSentIds((current) => new Set(current).add(candidate.id));
      onInvited?.(candidate.id);
    } catch (caught) {
      setInviteErrors((current) => ({ ...current, [candidate.id]: describeError(caught, 'No pudimos enviar la invitación. Reintentá.') }));
    } finally {
      setInvitingId(null);
    }
  };

  const candidateList = candidates ?? [];

  return (
    <>
      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : candidateList.length === 0 ? (
        <Typography color="text.secondary">No encontramos jugadores compatibles para este partido.</Typography>
      ) : (
        <Stack spacing={3}>
          {candidateList.map((candidate) => {
            const isSent = sentIds.has(candidate.id);
            const isInviting = invitingId === candidate.id;
            const inviteError = inviteErrors[candidate.id];

            return (
              // Deliberately no role="button"/tabIndex here: the card
              // already contains a real, independently focusable button
              // (Invitar), and ARIA disallows nesting interactive
              // controls inside one another.
              <Card
                key={candidate.id}
                variant="outlined"
                onClick={() => setSelectedCandidateId(candidate.id)}
                sx={{ p: 4, bgcolor: 'background.default', borderColor: 'divider', cursor: 'pointer' }}
              >
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
                        {candidate.displayName}
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

                <Box sx={{ mt: 2 }}>
                  <CandidateRatingsSummary ratings={candidate.ratings} />
                </Box>

                {inviteError ? (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {inviteError}
                  </Alert>
                ) : null}

                <Button
                  variant={isSent ? 'text' : 'outlined'}
                  color="primary"
                  fullWidth
                  disabled={isSent || isInviting}
                  startIcon={isInviting ? <CircularProgress size={16} color="inherit" /> : isSent ? <CheckCircleRoundedIcon /> : null}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleInvite(candidate);
                  }}
                  sx={{ mt: 3 }}
                >
                  {isSent ? 'Invitación enviada' : isInviting ? 'Enviando…' : 'Invitar'}
                </Button>
              </Card>
            );
          })}
        </Stack>
      )}

      <PlayerProfileCardDialog
        open={selectedCandidateId !== null}
        userId={selectedCandidateId}
        sportName={matchSummary?.sport}
        onClose={() => setSelectedCandidateId(null)}
      />
    </>
  );
}

export default MatchCandidatesSection;
