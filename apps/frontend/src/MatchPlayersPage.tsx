import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { MatchParticipantSummaryDto, MatchParticipantsResponseDto, MatchStatusDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { ApiError, useApi } from './apiClient';
import PlayerProfileCardDialog from './PlayerProfileCardDialog';
import PlayerRatingCommentsDialog from './PlayerRatingCommentsDialog';
import PlayerRatingsSummary from './PlayerRatingsSummary';
import { useVisiblePolling } from './useVisiblePolling';

const POLL_INTERVAL_MS = 20_000;

type MatchPlayersPageProps = {
  matchId: string;
  isOrganizer: boolean;
  status: MatchStatusDto;
  participantsCount: number;
  maxPlayers: number;
  /** Needed to open a player's profile card (ratings are scoped per sport) -- see PlayerProfileCardDialog. */
  sportId: string;
  sportName?: string;
  searchingPlayers?: boolean;
  /** Rendered right below the summary card, above the roster (Organizador/Confirmados/...), while searchingPlayers is true. */
  candidatesSection?: ReactNode;
  /** Bump to force a fresh GET of the roster without unmounting this component (which would also tear down candidatesSection and lose its local state, e.g. "Invitación enviada"). */
  refreshToken?: number;
  onSearchPlayers?: () => void;
  onRosterChanged?: () => void;
  onLeftMatch?: () => void;
};

const NON_EDITABLE_STATUSES: MatchStatusDto[] = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatInvitationDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(new Date(iso));
}

function PlayerRow({
  displayName,
  avatarUrl,
  subtitle,
  ratings,
  onOpenProfile,
  action,
}: {
  displayName: string;
  avatarUrl: string | null;
  subtitle?: string;
  /** Present only for the organizer and confirmed participants -- pending/rejected invitees never played, so they have no ratings and no profile card. */
  ratings?: MatchParticipantSummaryDto['ratings'];
  onOpenProfile?: () => void;
  action?: ReactNode;
}) {
  return (
    // Deliberately no role="button"/tabIndex here when onOpenProfile is
    // set: the card already contains a real, independently focusable
    // control (the Quitar button), and ARIA disallows nesting interactive
    // controls -- same convention as MatchCandidatesSection.
    <Card
      variant="outlined"
      onClick={onOpenProfile}
      sx={{ p: 4, bgcolor: 'background.default', borderColor: 'divider', cursor: onOpenProfile ? 'pointer' : undefined }}
    >
      <Stack direction="row" spacing={3} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar
            src={avatarUrl ?? undefined}
            sx={{ width: 40, height: 40, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
          >
            {!avatarUrl ? <PersonRoundedIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} /> : null}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" component="h2" sx={{ fontSize: '1rem' }} noWrap>
              {displayName}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>
        {action}
      </Stack>
      {ratings ? (
        <Box sx={{ mt: 3 }}>
          <PlayerRatingsSummary ratings={ratings} />
        </Box>
      ) : null}
    </Card>
  );
}

function MatchPlayersPage({
  matchId,
  isOrganizer,
  status,
  participantsCount,
  maxPlayers,
  sportId,
  sportName,
  searchingPlayers = false,
  candidatesSection,
  refreshToken = 0,
  onSearchPlayers,
  onRosterChanged,
  onLeftMatch,
}: MatchPlayersPageProps) {
  const api = useApi();
  const [roster, setRoster] = useState<MatchParticipantsResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeErrors, setRemoveErrors] = useState<Record<string, string>>({});
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [commentsUserId, setCommentsUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const response = await api.get<{ data: MatchParticipantsResponseDto }>(`/api/v1/matches/${matchId}/participants`);
        if (!cancelled) {
          setRoster(response.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(describeError(caught, 'No pudimos cargar los jugadores. Reintentá más tarde.'));
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
  }, [matchId, refreshToken]);

  // Background refresh while the Jugadores tab is mounted and visible:
  // organizer/confirmed/pending/rejected and cupos stay current without a
  // manual refresh. Silent — keeps the last known roster on a failed tick.
  useVisiblePolling({
    callback: async () => {
      try {
        const response = await api.get<{ data: MatchParticipantsResponseDto }>(`/api/v1/matches/${matchId}/participants`);
        setRoster(response.data);
      } catch {
        // silent: keep the last known roster, retry next tick
      }
    },
    intervalMs: POLL_INTERVAL_MS,
    runImmediately: false,
  });

  const rosterEditable = !NON_EDITABLE_STATUSES.includes(status);

  const handleRemoveParticipant = async (userId: string) => {
    setRemovingUserId(userId);
    setRemoveErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== userId)));

    try {
      await api.delete(`/api/v1/matches/${matchId}/participants/${userId}`);
      setRoster((current) =>
        current ? { ...current, confirmed: current.confirmed.filter((participant) => participant.userId !== userId) } : current,
      );
      onRosterChanged?.();
    } catch (caught) {
      setRemoveErrors((current) => ({ ...current, [userId]: describeError(caught, 'No pudimos quitar al jugador. Reintentá.') }));
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setCancellingInvitationId(invitationId);
    setCancelErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== invitationId)));

    try {
      await api.post(`/api/v1/invitations/${invitationId}/cancel`);
      setRoster((current) =>
        current ? { ...current, pending: current.pending.filter((invitation) => invitation.invitationId !== invitationId) } : current,
      );
    } catch (caught) {
      setCancelErrors((current) => ({
        ...current,
        [invitationId]: describeError(caught, 'No pudimos cancelar la invitación. Reintentá.'),
      }));
    } finally {
      setCancellingInvitationId(null);
    }
  };

  const handleLeaveMatch = async () => {
    setLeaving(true);
    setLeaveError(null);
    try {
      await api.post(`/api/v1/matches/${matchId}/leave`);
      onLeftMatch?.();
    } catch (caught) {
      setLeaveError(describeError(caught, 'No pudimos completar tu salida del partido. Reintentá.'));
      setLeaving(false);
    }
  };

  const isFull = status === 'FULL';
  const availableSpots = Math.max(0, maxPlayers - participantsCount);
  const pendingCount = roster?.pending.length ?? 0;

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider', mb: 6 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h1">Jugadores</Typography>
          <Typography sx={{ fontWeight: 700 }}>
            {participantsCount} / {maxPlayers} confirmados
          </Typography>
        </Stack>
        {pendingCount > 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {pendingCount === 1 ? '1 invitación pendiente' : `${pendingCount} invitaciones pendientes`}
          </Typography>
        ) : null}

        <Chip
          label={isFull ? 'Equipo completo' : `Quedan ${availableSpots} lugares`}
          sx={{
            fontWeight: 700,
            mb: 4,
            bgcolor: isFull ? 'rgba(46, 204, 113, 0.16)' : 'rgba(77, 163, 255, 0.16)',
            color: isFull ? 'primary.light' : 'info.main',
          }}
        />

        {isOrganizer && !isFull && rosterEditable ? (
          <Button variant="contained" fullWidth onClick={onSearchPlayers} sx={{ mb: 2 }}>
            {searchingPlayers ? 'Ocultar búsqueda de jugadores' : 'Buscar jugadores'}
          </Button>
        ) : null}

        {!isOrganizer && rosterEditable ? (
          <>
            {leaveError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {leaveError}
              </Alert>
            ) : null}
            <Button variant="outlined" color="error" fullWidth disabled={leaving} onClick={() => void handleLeaveMatch()}>
              {leaving ? 'Saliendo…' : 'Abandonar partido'}
            </Button>
          </>
        ) : null}
      </Card>

      {candidatesSection}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : roster ? (
        <Stack spacing={6}>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 3 }}>👑 Organizador</Typography>
            <PlayerRow
              displayName={roster.organizer.displayName}
              avatarUrl={roster.organizer.avatarUrl}
              ratings={roster.organizer.ratings}
              onOpenProfile={() => setSelectedProfileUserId(roster.organizer.userId)}
            />
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700, mb: 3 }}>🟢 Confirmados ({roster.confirmed.length})</Typography>
            {roster.confirmed.length === 0 ? (
              <Typography color="text.secondary">Todavía no hay jugadores confirmados.</Typography>
            ) : (
              <Stack spacing={2}>
                {roster.confirmed.map((participant) => (
                  <Box key={participant.userId}>
                    <PlayerRow
                      displayName={participant.displayName}
                      avatarUrl={participant.avatarUrl}
                      ratings={participant.ratings}
                      onOpenProfile={() => setSelectedProfileUserId(participant.userId)}
                      action={
                        isOrganizer && rosterEditable ? (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={removingUserId === participant.userId}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleRemoveParticipant(participant.userId);
                            }}
                          >
                            {removingUserId === participant.userId ? 'Quitando…' : 'Quitar'}
                          </Button>
                        ) : undefined
                      }
                    />
                    {removeErrors[participant.userId] ? (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {removeErrors[participant.userId]}
                      </Alert>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {roster.pending.length > 0 ? (
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 3 }}>🟡 Invitaciones pendientes</Typography>
              <Stack spacing={2}>
                {roster.pending.map((invitation) => (
                  <Box key={invitation.invitationId}>
                    <PlayerRow
                      displayName={invitation.displayName}
                      avatarUrl={invitation.avatarUrl}
                      subtitle={`Invitado el ${formatInvitationDate(invitation.createdAt)}${invitation.position ? ` • ${invitation.position}` : ''}`}
                      action={
                        isOrganizer && rosterEditable ? (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={cancellingInvitationId === invitation.invitationId}
                            onClick={() => void handleCancelInvitation(invitation.invitationId)}
                          >
                            {cancellingInvitationId === invitation.invitationId ? 'Cancelando…' : 'Cancelar invitación'}
                          </Button>
                        ) : undefined
                      }
                    />
                    {cancelErrors[invitation.invitationId] ? (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {cancelErrors[invitation.invitationId]}
                      </Alert>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}

          {roster.rejected.length > 0 ? (
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 3 }}>🔴 Invitaciones rechazadas</Typography>
              <Stack spacing={2}>
                {roster.rejected.map((invitation) => (
                  <PlayerRow key={invitation.invitationId} displayName={invitation.displayName} avatarUrl={invitation.avatarUrl} />
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      ) : null}

      <PlayerProfileCardDialog
        open={selectedProfileUserId !== null}
        userId={selectedProfileUserId}
        sportId={sportId}
        sportName={sportName}
        onClose={() => setSelectedProfileUserId(null)}
        onShowComments={() => {
          setCommentsUserId(selectedProfileUserId);
          setSelectedProfileUserId(null);
        }}
      />

      <PlayerRatingCommentsDialog
        open={commentsUserId !== null}
        userId={commentsUserId}
        sportId={sportId}
        sportName={sportName ?? ''}
        onClose={() => setCommentsUserId(null)}
      />
    </Box>
  );
}

export default MatchPlayersPage;
