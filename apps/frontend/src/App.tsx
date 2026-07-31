import { useEffect, useState } from 'react';
import type { HealthResponse, MatchInvitationDto, MatchSummaryDto, PendingTaskDto, UserDto } from '@rondo/contracts';
import { appConfig } from '@rondo/config';
import { useAuth, useClerk } from '@clerk/react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import { ApiError, useApi } from './apiClient';
import AppHeader from './AppHeader';
import BookingDetailPage from './BookingDetailPage';
import CandidatesPage from './CandidatesPage';
import CreateMatchPage from './CreateMatchPage';
import type { MatchDraft } from './CreateMatchPage';
import EditProfilePage from './EditProfilePage';
import HomePage from './HomePage';
import type { PendingAction, UpcomingEventItem } from './HomePage';
import InvitationsPage from './InvitationsPage';
import LoginPage from './LoginPage';
import { matchSummaryToEntity } from './matchMapping';
import MatchDetailPage from './MatchDetailPage';
import type { Tab as MatchDetailTab } from './MatchDetailPage';
import { MATCH_STATUS_CHIP_STYLES, MATCH_STATUS_LABELS } from './matchStatus';
import RegisterPage from './RegisterPage';
import ReservationFlowPage from './ReservationFlowPage';
import type { ConfirmedBooking } from './ReservationFlowPage';
import { buildIsoDateTime, describeSchedule } from './scheduleFormat';
import type { ScheduleUpdateInput } from './scheduleFormat';
import SportProfilePage from './SportProfilePage';
import type { BookingEntity, MatchEntity } from './types';
import { useVisiblePolling } from './useVisiblePolling';

const HOME_POLL_INTERVAL_MS = 20_000;

const BOOKING_CHIP_COLOR = { bgcolor: 'rgba(77, 163, 255, 0.16)', color: 'info.main' };

type View =
  | 'login'
  | 'register'
  | 'home'
  | 'create'
  | 'candidates'
  | 'reservation'
  | 'match-detail'
  | 'booking-detail'
  | 'edit-profile'
  | 'sport-profile'
  | 'invitations';

const wizardSteps = [
  { key: 'create', label: 'Armar partido' },
  { key: 'candidates', label: 'Candidatos' },
] as const;

type WizardStep = (typeof wizardSteps)[number]['key'];

function isWizardStep(view: View): view is WizardStep {
  return view === 'create' || view === 'candidates';
}

function displayName(user: UserDto): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'Jugador';
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? appConfig.apiBaseUrl;

function App() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const api = useApi();

  const [status, setStatus] = useState('Verificando conexión…');
  const [currentView, setCurrentView] = useState<View>('login');
  const [playerName, setPlayerName] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [matches, setMatches] = useState<MatchEntity[]>([]);
  const [bookings, setBookings] = useState<BookingEntity[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTaskDto[]>([]);
  const [myInvitations, setMyInvitations] = useState<MatchInvitationDto[]>([]);

  const [matchDraft, setMatchDraft] = useState<MatchDraft | null>(null);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [initialMatchTab, setInitialMatchTab] = useState<MatchDetailTab | undefined>(undefined);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [reservationMatchContext, setReservationMatchContext] = useState<string | null>(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/health`);
        const payload: HealthResponse = await response.json();
        setStatus(payload.ok ? 'API conectada' : 'Respuesta inesperada de la API');
      } catch {
        setStatus('Sin conexión con la API');
      }
    };

    void loadStatus();
  }, []);

  useEffect(() => {
    if (!authLoaded) {
      return;
    }
    if (isSignedIn) {
      setCurrentView((current) => (current === 'login' || current === 'register' ? 'home' : current));
    } else {
      setCurrentView('login');
      setMatches([]);
      setPendingTasks([]);
      setMyInvitations([]);
      setPlayerName('');
    }
  }, [authLoaded, isSignedIn]);

  const loadAccountData = async (options?: { silent?: boolean }) => {
    try {
      const [meResponse, matchesResponse, tasksResponse, invitationsResponse] = await Promise.all([
        api.get<{ data: UserDto }>('/api/v1/me'),
        api.get<{ data: MatchSummaryDto[] }>('/api/v1/me/matches'),
        api.get<{ data: PendingTaskDto[] }>('/api/v1/me/pending-tasks'),
        api.get<{ data: MatchInvitationDto[] }>('/api/v1/me/invitations'),
      ]);
      setPlayerName(displayName(meResponse.data));
      setMatches((current) => matchesResponse.data.map((dto) => matchSummaryToEntity(dto, current.find((match) => match.id === dto.id))));
      setPendingTasks(tasksResponse.data);
      setMyInvitations(invitationsResponse.data);
    } catch (error) {
      // A silent (polling) refresh never surfaces an invasive error: keep
      // whatever was last shown and just retry on the next tick.
      if (!options?.silent) {
        setGlobalError(describeError(error, 'No pudimos cargar tu información. Reintentá más tarde.'));
      }
    }
  };

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    void loadAccountData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Lightweight "feels real-time" refresh for Home and MatchDetail: reuses
  // the same loadAccountData used after local mutations, just silenced and
  // scoped to the two screens that read from this state. Chat and the other
  // screens keep their own independent polling/lifecycles untouched. Gating
  // on currentView alone is enough: the app only ever reaches 'home' or
  // 'match-detail' while signed in (the sign-out effect above always routes
  // back to 'login' otherwise).
  useVisiblePolling({
    callback: () => loadAccountData({ silent: true }),
    intervalMs: HOME_POLL_INTERVAL_MS,
    enabled: currentView === 'home' || currentView === 'match-detail',
    runImmediately: false,
  });

  const openCreateFlow = () => {
    setMatchDraft(null);
    setCreatedMatchId(null);
    setCurrentView('create');
  };

  const openReservationFlow = () => {
    setReservationMatchContext(null);
    setCurrentView('reservation');
  };

  const openMatchDetail = (matchId: string, tab?: MatchDetailTab) => {
    setSelectedMatchId(matchId);
    setInitialMatchTab(tab);
    setCurrentView('match-detail');
  };

  const openBookingDetail = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setCurrentView('booking-detail');
  };

  // The match is created here, before moving into the Candidatos step, so
  // that step can fetch real matching candidates from the backend (it needs
  // a persisted matchId). Finalizar (handleFinishWizard) no longer creates
  // anything: the match already exists by the time the user reaches it.
  const handleCreateMatch = async (draft: MatchDraft) => {
    try {
      const response = await api.post<{ data: MatchSummaryDto }>('/api/v1/matches', {
        sportModalityId: draft.sportModalityId,
        clubId: draft.clubId,
        minPlayers: Number(draft.minPlayers),
        maxPlayers: Number(draft.maxPlayers),
        positions: draft.positions,
        scheduledDate: draft.date,
        availabilityStartMinutes: draft.availabilityStartMinutes,
        availabilityEndMinutes: draft.availabilityEndMinutes,
        startsAt: draft.startTimeMinutes !== null ? buildIsoDateTime(draft.date, draft.startTimeMinutes) : null,
      });
      setMatches((current) => [...current, matchSummaryToEntity(response.data)]);
      setMatchDraft(draft);
      setCreatedMatchId(response.data.id);
      setCurrentView('candidates');
    } catch (error) {
      setGlobalError(describeError(error, 'No pudimos crear el partido. Reintentá.'));
    }
  };

  const handleFinishWizard = () => {
    setMatchDraft(null);
    setCreatedMatchId(null);
    setCurrentView('home');
  };

  const handleRequestBookingForMatch = (matchId: string) => {
    setReservationMatchContext(matchId);
    setCurrentView('reservation');
  };

  const handleConfirmBooking = (confirmed: ConfirmedBooking) => {
    const bookingId = crypto.randomUUID();
    const newBooking: BookingEntity = {
      id: bookingId,
      clubName: 'Club Señor Pato',
      courtName: confirmed.courtName,
      courtSubtitle: confirmed.courtSubtitle,
      dateLabel: confirmed.dateLabel,
      time: confirmed.time,
      matchId: reservationMatchContext,
      createdAt: Date.now(),
    };
    setBookings((current) => [...current, newBooking]);

    if (reservationMatchContext) {
      const linkedMatchId = reservationMatchContext;
      setMatches((current) =>
        current.map((match) =>
          match.id === linkedMatchId
            ? {
                ...match,
                bookingId,
                clubName: match.clubName ?? newBooking.clubName,
                courtName: `${confirmed.courtName} · ${confirmed.courtSubtitle}`,
              }
            : match,
        ),
      );
      setReservationMatchContext(null);
      openMatchDetail(linkedMatchId);
    } else {
      openBookingDetail(bookingId);
    }
  };

  const linkMatchAndBooking = (matchId: string, bookingId: string) => {
    const booking = bookings.find((current) => current.id === bookingId);
    if (!booking) {
      return;
    }
    setBookings((current) => current.map((item) => (item.id === bookingId ? { ...item, matchId } : item)));
    setMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? {
              ...match,
              bookingId,
              clubName: match.clubName ?? booking.clubName,
              courtName: `${booking.courtName} · ${booking.courtSubtitle}`,
            }
          : match,
      ),
    );
  };

  const handleLeftMatch = () => {
    setCurrentView('home');
    void loadAccountData();
  };

  const handleCancelMatch = async (matchId: string) => {
    setCurrentView('home');
    try {
      const response = await api.post<{ data: MatchSummaryDto }>(`/api/v1/matches/${matchId}/cancellation`, {});
      setMatches((current) => current.map((match) => (match.id === matchId ? matchSummaryToEntity(response.data, match) : match)));
    } catch (error) {
      setGlobalError(describeError(error, 'No pudimos cancelar el partido. Reintentá.'));
    }
  };

  const handleEditMatchClub = (matchId: string, clubName: string | null) => {
    setMatches((current) => current.map((match) => (match.id === matchId ? { ...match, clubName } : match)));
  };

  const handleEditMatchSchedule = async (matchId: string, input: ScheduleUpdateInput) => {
    const response = await api.patch<{ data: MatchSummaryDto }>(`/api/v1/matches/${matchId}/schedule`, input);
    setMatches((current) => current.map((match) => (match.id === matchId ? matchSummaryToEntity(response.data, match) : match)));
  };

  const openEditProfile = () => setCurrentView('edit-profile');
  const openSportProfile = () => setCurrentView('sport-profile');
  const openInvitations = () => setCurrentView('invitations');

  const handleLogout = async () => {
    setCurrentView('login');
    await signOut();
  };

  const goToPreviousStep = () => {
    if (!isWizardStep(currentView)) {
      setCurrentView('home');
      return;
    }
    const stepIndex = wizardSteps.findIndex((step) => step.key === currentView);
    if (stepIndex <= 0) {
      setCurrentView('home');
      return;
    }
    setCurrentView(wizardSteps[stepIndex - 1]!.key);
  };

  const showAppHeader = currentView !== 'login' && currentView !== 'register';

  const renderView = () => {
    if (!authLoaded) {
      return null;
    }

    if (currentView === 'login') {
      return <LoginPage onLogin={() => setCurrentView('home')} onNavigateToRegister={() => setCurrentView('register')} />;
    }

    if (currentView === 'register') {
      return <RegisterPage onRegister={() => setCurrentView('home')} onNavigateToLogin={() => setCurrentView('login')} />;
    }

    if (currentView === 'edit-profile') {
      return <EditProfilePage onBack={() => setCurrentView('home')} />;
    }

    if (currentView === 'sport-profile') {
      return <SportProfilePage onBack={() => setCurrentView('home')} />;
    }

    if (currentView === 'match-detail') {
      const match = matches.find((current) => current.id === selectedMatchId);
      if (!match) {
        setCurrentView('home');
        return null;
      }
      const unlinkedBookings = bookings
        .filter((booking) => booking.matchId === null)
        .map((booking) => ({
          id: booking.id,
          title: `${booking.courtName} · ${booking.courtSubtitle}`,
          subtitle: `${booking.clubName} • ${booking.dateLabel} • ${booking.time}`,
        }));
      const myInvitation = myInvitations.find((invitation) => invitation.matchId === match.id) ?? null;

      return (
        <MatchDetailPage
          match={match}
          unlinkedBookings={unlinkedBookings}
          initialTab={initialMatchTab}
          myInvitationStatus={myInvitation?.status ?? null}
          onBack={() => setCurrentView('home')}
          onCancelMatch={() => void handleCancelMatch(match.id)}
          onEditClub={(clubName) => handleEditMatchClub(match.id, clubName)}
          onEditSchedule={(input) => handleEditMatchSchedule(match.id, input)}
          onRequestBooking={() => handleRequestBookingForMatch(match.id)}
          onAssociateBooking={(bookingId) => linkMatchAndBooking(match.id, bookingId)}
          onRosterChanged={() => void loadAccountData()}
          onLeftMatch={handleLeftMatch}
        />
      );
    }

    if (currentView === 'invitations') {
      return (
        <InvitationsPage
          onBack={() => setCurrentView('home')}
          onRespond={() => void loadAccountData()}
          onViewMatch={(matchId) => openMatchDetail(matchId)}
        />
      );
    }

    if (currentView === 'booking-detail') {
      const booking = bookings.find((current) => current.id === selectedBookingId);
      if (!booking) {
        setCurrentView('home');
        return null;
      }
      const linkedMatch = booking.matchId ? matches.find((match) => match.id === booking.matchId) : null;
      const unlinkedMatches = matches
        .filter((match) => match.bookingId === null)
        .map((match) => ({
          id: match.id,
          title: `${match.sport} • ${match.modality}`,
          subtitle: match.clubName ? `${match.clubName} • ${describeSchedule(match).dateLabel}` : describeSchedule(match).dateLabel,
        }));

      return (
        <BookingDetailPage
          booking={booking}
          linkedMatchSummary={linkedMatch ? { sport: linkedMatch.sport, modality: linkedMatch.modality } : null}
          unlinkedMatches={unlinkedMatches}
          onBack={() => setCurrentView('home')}
          onCreateMatch={() => {
            setReservationMatchContext(null);
            openCreateFlow();
          }}
          onAssociateMatch={(matchId) => linkMatchAndBooking(matchId, booking.id)}
          onOpenMatch={() => (booking.matchId ? openMatchDetail(booking.matchId) : undefined)}
        />
      );
    }

    if (currentView === 'reservation') {
      const contextMatch = reservationMatchContext ? matches.find((match) => match.id === reservationMatchContext) : null;
      return (
        <ReservationFlowPage
          onBack={() => setCurrentView('home')}
          onConfirm={handleConfirmBooking}
          contextLabel={contextMatch ? `Para tu partido de ${contextMatch.sport}` : undefined}
        />
      );
    }

    if (!isWizardStep(currentView)) {
      const pendingActions: PendingAction[] = [];
      matches.forEach((match) => {
        const isActive = match.status === 'ORGANIZING' || match.status === 'FULL';

        if (isActive && !match.clubName) {
          pendingActions.push({ id: `${match.id}-club`, label: `Tu partido de ${match.sport} todavía no tiene club.`, onClick: () => openMatchDetail(match.id) });
        }
        if (isActive && !match.startsAt) {
          pendingActions.push({ id: `${match.id}-time`, label: `Tu partido de ${match.sport} todavía no tiene horario confirmado.`, onClick: () => openMatchDetail(match.id) });
        }
        if (isActive && !match.courtName) {
          pendingActions.push({ id: `${match.id}-court`, label: `Tu partido de ${match.sport} todavía no tiene cancha.`, onClick: () => openMatchDetail(match.id) });
        }
      });

      const pendingInvitationsCount = myInvitations.filter((invitation) => invitation.status === 'PENDING').length;
      if (pendingInvitationsCount > 0) {
        pendingActions.push({
          id: 'pending-invitations',
          label: pendingInvitationsCount === 1 ? 'Tenés una invitación pendiente.' : `Tenés ${pendingInvitationsCount} invitaciones pendientes.`,
          onClick: openInvitations,
        });
      }

      pendingTasks.forEach((task) => {
        pendingActions.push({
          id: `${task.matchId}-${task.type}`,
          label: task.title,
          description: task.description,
          onClick: () => openMatchDetail(task.matchId, task.targetTab === 'ratings' ? 'valoraciones' : undefined),
        });
      });

      bookings.forEach((booking) => {
        if (!booking.matchId) {
          pendingActions.push({ id: `${booking.id}-no-match`, label: 'Tenés una reserva sin partido asociado.', onClick: () => openBookingDetail(booking.id) });
        }
      });

      const upcomingEvents: UpcomingEventItem[] = [...matches, ...bookings]
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((entity) => {
          if ('sport' in entity) {
            const schedule = describeSchedule(entity);
            const missingPlayers = Number(entity.maxPlayers) - entity.participantsCount;
            return {
              id: entity.id,
              kind: 'match' as const,
              title: `${entity.sport} • ${entity.modality}`,
              subtitle: schedule.isConfirmed
                ? `${schedule.dateLabel} • ${schedule.timeLabel}`
                : `${schedule.dateLabel} • Horario a confirmar (${schedule.windowLabel})`,
              meta:
                entity.status === 'FULL'
                  ? 'Equipo completo'
                  : missingPlayers === 1
                    ? 'Falta 1 jugador'
                    : `Faltan ${missingPlayers} jugadores`,
              chipLabel: MATCH_STATUS_LABELS[entity.status],
              chipColor: MATCH_STATUS_CHIP_STYLES[entity.status],
              onClick: () => openMatchDetail(entity.id),
            };
          }
          return {
            id: entity.id,
            kind: 'booking' as const,
            title: `${entity.courtName} • ${entity.clubName}`,
            subtitle: `${entity.dateLabel} • ${entity.time}`,
            meta: entity.matchId ? 'Con partido' : 'Sin partido',
            chipLabel: 'Reserva',
            chipColor: BOOKING_CHIP_COLOR,
            onClick: () => openBookingDetail(entity.id),
          };
        });

      return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <HomePage
            connectionStatus={status}
            playerName={playerName || undefined}
            pendingActions={pendingActions}
            upcomingEvents={upcomingEvents}
            onReserveCourt={openReservationFlow}
            onCreateMatch={openCreateFlow}
          />
        </Box>
      );
    }

    const stepIndex = wizardSteps.findIndex((step) => step.key === currentView);

    const renderWizardStep = () => {
      switch (currentView) {
        case 'candidates':
          if (!createdMatchId) {
            setCurrentView('home');
            return null;
          }
          return <CandidatesPage matchId={createdMatchId} matchSummary={matchDraft} onFinish={handleFinishWizard} />;
        case 'create':
        default:
          return <CreateMatchPage onCreateMatch={(draft) => void handleCreateMatch(draft)} />;
      }
    };

    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 5 }}>
            <IconButton aria-label="Volver" onClick={goToPreviousStep} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <ArrowBackRoundedIcon />
            </IconButton>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{wizardSteps[stepIndex]?.label ?? ''}</Typography>
            <IconButton aria-label="Ayuda" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <HelpOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box aria-label={`Paso ${stepIndex + 1} de ${wizardSteps.length}: ${wizardSteps[stepIndex]?.label ?? ''}`}>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              {wizardSteps.map((step, index) => (
                <Box
                  key={step.key}
                  sx={{ flex: 1, height: 4, borderRadius: 999, bgcolor: index <= stepIndex ? 'primary.main' : 'divider' }}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Paso {stepIndex + 1} de {wizardSteps.length}
            </Typography>
          </Box>

          {matchDraft && currentView !== 'create' ? (
            <Card
              variant="outlined"
              sx={{ mt: 4, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'divider', bgcolor: 'background.paper' }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: 'rgba(46, 204, 113, 0.16)' }}>
                  <SportsSoccerRoundedIcon sx={{ color: 'primary.main' }} />
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{matchDraft.sport}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {matchDraft.clubName ? `${matchDraft.modality} • ${matchDraft.clubName}` : matchDraft.modality}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          ) : null}
        </Box>

        {renderWizardStep()}
      </Box>
    );
  };

  return (
    <>
      {showAppHeader ? (
        <AppHeader
          onEditProfile={openEditProfile}
          onEditSportProfile={openSportProfile}
          onOpenInvitations={openInvitations}
          onLogout={() => void handleLogout()}
        />
      ) : null}
      {renderView()}
      <Snackbar open={globalError !== null} autoHideDuration={5000} onClose={() => setGlobalError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setGlobalError(null)} sx={{ width: '100%' }}>
          {globalError}
        </Alert>
      </Snackbar>
    </>
  );
}

export default App;
