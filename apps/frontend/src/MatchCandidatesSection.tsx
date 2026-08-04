import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { CandidateDto, MatchInvitationDto, RatingCommentDto } from '@rondo/contracts';
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
        {ratings.count} {ratings.count === 1 ? 'valoración' : 'valoraciones'} · {ratings.commentsCount}{' '}
        {ratings.commentsCount === 1 ? 'comentario' : 'comentarios'}
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

  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentsByCandidate, setCommentsByCandidate] = useState<Record<string, RatingCommentDto[]>>({});
  const [commentsLoadingId, setCommentsLoadingId] = useState<string | null>(null);
  const [commentsErrorByCandidate, setCommentsErrorByCandidate] = useState<Record<string, string>>({});

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

  const handleToggleComments = async (event: MouseEvent, candidate: CandidateDto) => {
    event.stopPropagation();

    if (expandedCommentsId === candidate.id) {
      setExpandedCommentsId(null);
      return;
    }

    setExpandedCommentsId(candidate.id);
    if (commentsByCandidate[candidate.id] || commentsLoadingId === candidate.id) {
      return;
    }

    setCommentsLoadingId(candidate.id);
    setCommentsErrorByCandidate((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== candidate.id)));

    try {
      const response = await api.get<{ data: RatingCommentDto[] }>(`/api/v1/users/${candidate.id}/rating-comments`);
      setCommentsByCandidate((current) => ({ ...current, [candidate.id]: response.data }));
    } catch (caught) {
      setCommentsErrorByCandidate((current) => ({
        ...current,
        [candidate.id]: describeError(caught, 'No pudimos cargar los comentarios. Reintentá más tarde.'),
      }));
    } finally {
      setCommentsLoadingId(null);
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
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
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

                <Box sx={{ mt: 2 }}>
                  <CandidateRatingsSummary ratings={candidate.ratings} />
                </Box>

                {candidate.ratings.commentsCount > 0 ? (
                  <Button
                    variant="text"
                    size="small"
                    onClick={(event) => void handleToggleComments(event, candidate)}
                    sx={{ mt: 0.5, px: 0, minWidth: 0 }}
                  >
                    {expandedCommentsId === candidate.id ? 'Ocultar comentarios' : `Ver comentarios (${candidate.ratings.commentsCount})`}
                  </Button>
                ) : null}

                {expandedCommentsId === candidate.id ? (
                  <Box sx={{ mt: 1 }}>
                    {commentsLoadingId === candidate.id ? (
                      <Stack alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size={20} />
                      </Stack>
                    ) : commentsErrorByCandidate[candidate.id] ? (
                      <Alert severity="error">{commentsErrorByCandidate[candidate.id]}</Alert>
                    ) : (
                      <Stack spacing={1}>
                        {(commentsByCandidate[candidate.id] ?? []).map((comment) => (
                          <Box key={comment.id} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }} display="block">
                              {comment.authorDisplayName}
                            </Typography>
                            <Typography variant="body2">"{comment.comment}"</Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                ) : null}

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
