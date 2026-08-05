import { useEffect, useState } from 'react';
import type { HealthResponse, MatchInvitationDto, MatchStatusDto, MatchSummaryDto, PendingTaskDto, UserDto } from '@rondo/contracts';
import { useAuth, useClerk } from '@clerk/react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import { ApiError, useApi } from './apiClient';
import AdminDashboardPage from './AdminDashboardPage';
import AppHeader from './AppHeader';
import BookingDetailPage from './BookingDetailPage';
import ClubAdminPage from './ClubAdminPage';
import CandidatesPage from './CandidatesPage';
import CreateMatchPage from './CreateMatchPage';
import type { MatchDraft } from './CreateMatchPage';
import EditProfilePage from './EditProfilePage';
import HomePage from './HomePage';
import type { UpcomingEventItem } from './HomePage';
import InvitationsPage from './InvitationsPage';
import LoginPage from './LoginPage';
import { matchSummaryToEntity } from './matchMapping';
import MatchDetailPage from './MatchDetailPage';
import type { Tab as MatchDetailTab } from './MatchDetailPage';
import { MATCH_STATUS_CHIP_STYLES, MATCH_STATUS_LABELS } from './matchStatus';
import RegisterPage from './RegisterPage';
import ReservationFlowPage from './ReservationFlowPage';
import type { ConfirmedBooking } from './ReservationFlowPage';
import OfflineScreen from './OfflineScreen';
import InstallWelcomeDialog from './InstallWelcomeDialog';
import PushNotificationsBanner from './PushNotificationsBanner';
import { buildIsoDateTime, describeSchedule } from './scheduleFormat';
import type { ScheduleUpdateInput } from './scheduleFormat';
import SportProfilePage from './SportProfilePage';
import type { BookingEntity, MatchEntity, PendingAction } from './types';
import { apiBaseUrl } from './runtimeConfig';
import { retryWithBackoff } from './apiRetry';
import { useAdminClubs } from './useAdminClubs';
import { useMyClubs } from './useMyClubs';
import { useOnlineStatus } from './useOnlineStatus';
import { usePushNavigation } from './usePushNavigation';
import { useVisiblePolling } from './useVisiblePolling';

const HOME_POLL_INTERVAL_MS = 20_000;
/** How long a COMPLETED/CANCELLED/EXPIRED match stays visible on Home at all, under "Partidos finalizados" -- past this it drops off Home entirely (still reachable via MatchDetailPage directly, e.g. a push deep link). */
const FINISHED_MATCH_VISIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  | 'invitations'
  | 'admin-dashboard'
  | 'club-admin';

const wizardSteps = [
  { key: 'create', label: 'Armar partido' },
  { key: 'candidates', label: 'Candidatos' },
] as const;

type WizardStep = (typeof wizardSteps)[number]['key'];

function isWizardStep(view: View): view is WizardStep {
  return view === 'create' || view === 'candidates';
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function App() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const api = useApi();
  const isOnline = useOnlineStatus();
  const { clubs: myClubs } = useMyClubs();
  const myClub = myClubs[0] ?? null;
  const { clubs: adminClubs } = useAdminClubs();
  const hasAdminAccess = adminClubs.length > 0;

  const [status, setStatus] = useState('Verificando conexión…');
  const [currentView, setCurrentView] = useState<View>('login');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);
  const [playerName, setPlayerName] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [matches, setMatches] = useState<MatchEntity[]>([]);
  const [bookings, setBookings] = useState<BookingEntity[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTaskDto[]>([]);
  const [myInvitations, setMyInvitations] = useState<MatchInvitationDto[]>([]);
  const [respondingInvitationId, setRespondingInvitationId] = useState<string | null>(null);
  const [invitationRespondErrors, setInvitationRespondErrors] = useState<Record<string, string>>({});

  const [matchDraft, setMatchDraft] = useState<MatchDraft | null>(null);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [initialMatchTab, setInitialMatchTab] = useState<MatchDetailTab | undefined>(undefined);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [reservationMatchContext, setReservationMatchContext] = useState<string | null>(null);
  const [selectedAdminClubId, setSelectedAdminClubId] = useState<string | null>(null);
  const [highlightInvitationId, setHighlightInvitationId] = useState<string | null>(null);

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

  const fetchAccountDataOnce = async () => {
    const [meResponse, matchesResponse, tasksResponse, invitationsResponse] = await Promise.all([
      api.get<{ data: UserDto }>('/api/v1/me'),
      api.get<{ data: MatchSummaryDto[] }>('/api/v1/me/matches'),
      api.get<{ data: PendingTaskDto[] }>('/api/v1/me/pending-tasks'),
      api.get<{ data: MatchInvitationDto[] }>('/api/v1/me/invitations'),
    ]);
    setPlayerName(meResponse.data.displayName);
    setMatches((current) => matchesResponse.data.map((dto) => matchSummaryToEntity(dto, current.find((match) => match.id === dto.id))));
    setPendingTasks(tasksResponse.data);
    setMyInvitations(invitationsResponse.data);
  };

  const loadAccountData = async (options?: { silent?: boolean }) => {
    try {
      await fetchAccountDataOnce();
    } catch (error) {
      // A silent (polling) refresh never surfaces an invasive error: keep
      // whatever was last shown and just retry on the next tick.
      if (!options?.silent) {
        setGlobalError(describeError(error, 'No pudimos cargar tu información. Reintentá más tarde.'));
      }
    }
  };

  // First load after sign-in gets a few limited, cancelable retries with
  // backoff: a free-tier Render backend waking up from sleep can take a few
  // seconds, and this is the moment a user would otherwise see a hard
  // failure right after logging in. Silent/polling refreshes never retry
  // this way — they just wait for the next cycle instead (see loadAccountData above).
  const [bootPhase, setBootPhase] = useState<'pending' | 'ready' | 'failed'>('pending');
  const [bootRetryToken, setBootRetryToken] = useState(0);

  useEffect(() => {
    if (!isSignedIn) {
      setBootPhase('pending');
      return;
    }

    let cancelled = false;
    setBootPhase('pending');

    retryWithBackoff(fetchAccountDataOnce, { attempts: 4, baseDelayMs: 1500, isCancelled: () => cancelled })
      .then(() => {
        if (!cancelled) {
          setBootPhase('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBootPhase('failed');
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, bootRetryToken]);

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

  // Resolves a push notification's matchId against whatever the app already
  // knows (matches state, populated from /me/matches at boot) before ever
  // hitting the network -- a match a push targets is almost always already
  // there, since every event that produces a push implies the recipient is
  // an organizer/participant. The network fallback only exists for the
  // rarer case of a fresh deep link the initial list hasn't caught up with
  // yet, and doubles as the source of real 404s; GET /api/v1/matches/:id has
  // no per-user access restriction today, so a 403 here is defensive (see
  // docs/WEB_PUSH.md) rather than something this endpoint can currently
  // produce.
  const resolveMatchForDeepLink = async (matchId: string): Promise<MatchEntity> => {
    const existing = matches.find((match) => match.id === matchId);
    if (existing) {
      return existing;
    }
    try {
      const response = await api.get<{ data: MatchSummaryDto }>(`/api/v1/matches/${matchId}`);
      const entity = matchSummaryToEntity(response.data);
      setMatches((current) => [...current, entity]);
      return entity;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new Error('El partido ya no está disponible.');
      }
      if (error instanceof ApiError && error.status === 403) {
        throw new Error('No tenés acceso a este partido.');
      }
      throw new Error('No pudimos abrir el partido. Reintentá.');
    }
  };

  // Applies a push notification's deep link (see pushNavigation.ts) once
  // Clerk, auth, and the initial account data are all ready -- never
  // before, so a link tapped while signed out waits at Login (the query
  // params just sit in the URL untouched, see docs/WEB_PUSH.md) and one
  // tapped mid-boot waits for bootPhase to actually reach 'ready'. Always
  // clears the pending destination when done, success or failure, so it can
  // never be re-applied on a later render or a page refresh.
  const { destination: pushDestination, clear: clearPushDestination } = usePushNavigation();

  useEffect(() => {
    if (!pushDestination || bootPhase !== 'ready') {
      return;
    }

    let cancelled = false;

    const apply = async () => {
      try {
        switch (pushDestination.type) {
          case 'INVITATIONS': {
            setCurrentView('home');
            setHighlightInvitationId(pushDestination.invitationId ?? null);
            break;
          }
          case 'MATCH_SUMMARY':
          case 'MATCH_PLAYERS':
          case 'MATCH_CHAT':
          case 'MATCH_RATINGS': {
            const tab: MatchDetailTab =
              pushDestination.type === 'MATCH_PLAYERS'
                ? 'jugadores'
                : pushDestination.type === 'MATCH_CHAT'
                  ? 'chat'
                  : pushDestination.type === 'MATCH_RATINGS'
                    ? 'valoraciones'
                    : 'datos';
            const match = await resolveMatchForDeepLink(pushDestination.matchId);
            if (!cancelled) {
              openMatchDetail(match.id, tab);
            }
            break;
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCurrentView('home');
          setGlobalError(error instanceof Error ? error.message : 'No pudimos abrir el contenido de la notificación.');
        }
      } finally {
        if (!cancelled) {
          clearPushDestination();
        }
      }
    };

    void apply();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushDestination, bootPhase]);

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
        venueType: draft.venueType,
        clubId: draft.venueType === 'CLUB' ? draft.clubId : null,
        customVenueName: draft.venueType === 'CUSTOM' ? draft.clubName : null,
        minPlayers: Number(draft.minPlayers),
        maxPlayers: Number(draft.maxPlayers),
        positions: draft.positions,
        scheduledDate: draft.date,
        availabilityStartMinutes: draft.availabilityStartMinutes,
        availabilityEndMinutes: draft.availabilityEndMinutes,
        durationMinutes: draft.durationMinutes,
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
      clubName: confirmed.clubName,
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

  const handleEditMatchSchedule = async (matchId: string, input: ScheduleUpdateInput) => {
    const response = await api.patch<{ data: MatchSummaryDto }>(`/api/v1/matches/${matchId}/schedule`, input);
    setMatches((current) => current.map((match) => (match.id === matchId ? matchSummaryToEntity(response.data, match) : match)));
  };

  // Drives the Invitaciones pendientes section on Home directly off the same
  // myInvitations state used everywhere else (no separate local copy). A
  // successful response refreshes matches/invitations/pending tasks in one
  // go, so accepting immediately surfaces the match under Próximos eventos
  // and drops it from the pending list; rejecting just drops it.
  const handleRespondInvitation = async (invitationId: string, action: 'accept' | 'reject') => {
    setRespondingInvitationId(invitationId);
    setInvitationRespondErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== invitationId)));

    try {
      await api.post<{ data: MatchInvitationDto }>(`/api/v1/invitations/${invitationId}/${action}`);
      await loadAccountData();
    } catch (error) {
      setInvitationRespondErrors((current) => ({
        ...current,
        [invitationId]: describeError(error, 'No pudimos procesar tu respuesta. Reintentá.'),
      }));
    } finally {
      setRespondingInvitationId(null);
    }
  };

  const openEditProfile = () => setCurrentView('edit-profile');
  const openSportProfile = () => setCurrentView('sport-profile');
  const openInvitations = () => setCurrentView('invitations');
  const openAdminDashboard = () => setCurrentView('admin-dashboard');
  const openClubAdmin = (clubId: string) => {
    setSelectedAdminClubId(clubId);
    setCurrentView('club-admin');
  };

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

  // Real, actionable tasks only -- deliberately excludes "no club",
  // "no court on a custom venue" (isActive && venueType === 'CLUB' already
  // guards that), inactive-status matches, and push-notification state
  // (that has its own dedicated banner, not a task item). Shared between
  // the header bell (pendingActions below) and Home's own "Tareas
  // pendientes" section (homePendingTasks) so both stay in sync without
  // duplicating this logic.
  const homePendingTasks: PendingAction[] = [];
  matches.forEach((match) => {
    const isActive = match.status === 'ORGANIZING' || match.status === 'FULL';

    // A venue that's still TO_BE_DEFINED is a real pending decision; CUSTOM
    // already has a real venue name (no warning) and CLUB always has clubName.
    if (isActive && match.venueType === 'TO_BE_DEFINED') {
      homePendingTasks.push({ id: `${match.id}-club`, label: `Tu partido de ${match.sport} todavía no tiene sede.`, onClick: () => openMatchDetail(match.id) });
    }
    if (isActive && !match.startsAt) {
      homePendingTasks.push({ id: `${match.id}-time`, label: `Tu partido de ${match.sport} todavía no tiene horario confirmado.`, onClick: () => openMatchDetail(match.id) });
    }
    // A missing court is only ever "pending" when there's an actual club to
    // book a court from -- CUSTOM/TO_BE_DEFINED venues never surface this.
    if (isActive && match.venueType === 'CLUB' && !match.courtName) {
      homePendingTasks.push({ id: `${match.id}-court`, label: `Tu partido de ${match.sport} todavía no tiene cancha.`, onClick: () => openMatchDetail(match.id) });
    }
  });

  pendingTasks.forEach((task) => {
    homePendingTasks.push({
      id: `${task.matchId}-${task.type}`,
      label: task.title,
      description: task.description,
      onClick: () => openMatchDetail(task.matchId, task.targetTab === 'ratings' ? 'valoraciones' : undefined),
    });
  });

  bookings.forEach((booking) => {
    if (!booking.matchId) {
      homePendingTasks.push({ id: `${booking.id}-no-match`, label: 'Tenés una reserva sin partido asociado.', onClick: () => openBookingDetail(booking.id) });
    }
  });

  // The bell keeps a broader summary (adds the invitations count on top of
  // the same task items) -- Home shows invitations in their own full
  // section instead, so homePendingTasks above never repeats them.
  const pendingActions: PendingAction[] = [...homePendingTasks];
  const pendingInvitationsCount = myInvitations.filter((invitation) => invitation.status === 'PENDING').length;
  if (pendingInvitationsCount > 0) {
    pendingActions.push({
      id: 'pending-invitations',
      label: pendingInvitationsCount === 1 ? 'Tenés una invitación pendiente.' : `Tenés ${pendingInvitationsCount} invitaciones pendientes.`,
      onClick: openInvitations,
    });
  }

  const renderView = () => {
    if (!authLoaded) {
      return null;
    }

    if (isSignedIn && bootPhase !== 'ready') {
      // Distinguish "no network at all" from "backend reachable but asleep"
      // -- retrying a truly offline device against a sleeping Render
      // instance would just show the wrong, more alarming message.
      if (!isOnline) {
        return <OfflineScreen onRetry={() => setBootRetryToken((token) => token + 1)} />;
      }
      if (bootPhase === 'failed') {
        return (
          <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', px: 4, textAlign: 'center' }}>
            <Typography variant="h1" sx={{ mb: 2, fontSize: '1.5rem' }}>
              No pudimos conectar con Rondo
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 6, maxWidth: 360 }}>
              El servidor puede haberse quedado inactivo por falta de uso. Esto puede tardar unos segundos en la beta.
            </Typography>
            <Button variant="contained" onClick={() => setBootRetryToken((token) => token + 1)}>
              Reintentar
            </Button>
          </Box>
        );
      }
      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', px: 4, textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 4 }} />
          <Typography variant="h1" sx={{ mb: 2, fontSize: '1.5rem' }}>
            Estamos iniciando el servidor de Rondo
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 360 }}>
            Esto puede tardar unos segundos en la beta.
          </Typography>
        </Box>
      );
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
          onEditSchedule={(input) => handleEditMatchSchedule(match.id, input)}
          onRequestBooking={() => handleRequestBookingForMatch(match.id)}
          onAssociateBooking={(bookingId) => linkMatchAndBooking(match.id, bookingId)}
          onRosterChanged={() => void loadAccountData()}
          onLeftMatch={handleLeftMatch}
        />
      );
    }

    if (currentView === 'admin-dashboard') {
      return <AdminDashboardPage onBack={() => setCurrentView('home')} onOpenClub={openClubAdmin} />;
    }

    if (currentView === 'club-admin') {
      if (!selectedAdminClubId) {
        setCurrentView('admin-dashboard');
        return null;
      }
      return <ClubAdminPage clubId={selectedAdminClubId} onBack={() => setCurrentView('admin-dashboard')} />;
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
          clubName={myClub?.name ?? null}
          onBack={() => setCurrentView('home')}
          onConfirm={handleConfirmBooking}
          contextLabel={contextMatch ? `Para tu partido de ${contextMatch.sport}` : undefined}
        />
      );
    }

    if (!isWizardStep(currentView)) {
      const now = Date.now();
      const upcomingEvents: UpcomingEventItem[] = [];
      const finishedEvents: UpcomingEventItem[] = [];
      const ACTIVE_MATCH_STATUSES: MatchStatusDto[] = ['ORGANIZING', 'FULL', 'IN_PROGRESS'];

      [...matches, ...bookings]
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach((entity) => {
          if ('sport' in entity) {
            const schedule = describeSchedule(entity);
            const missingPlayers = Number(entity.maxPlayers) - entity.participantsCount;
            const item: UpcomingEventItem = {
              id: entity.id,
              kind: 'match',
              title: `${entity.sport} • ${entity.modality}`,
              subtitle: schedule.isConfirmed
                ? `${schedule.dateLabel} • ${schedule.timeLabel}`
                : `${schedule.dateLabel} • Horario a confirmar (${schedule.windowLabel})`,
              meta:
                entity.status === 'FULL'
                  ? 'Equipo completo'
                  : entity.status === 'IN_PROGRESS'
                    ? 'Partido en juego'
                    : entity.status === 'COMPLETED'
                      ? 'Partido finalizado'
                      : entity.status === 'CANCELLED'
                        ? 'Partido cancelado'
                        : entity.status === 'EXPIRED'
                          ? 'Partido vencido'
                          : missingPlayers === 1
                            ? 'Falta 1 jugador'
                            : `Faltan ${missingPlayers} jugadores`,
              chipLabel: MATCH_STATUS_LABELS[entity.status],
              chipColor: MATCH_STATUS_CHIP_STYLES[entity.status],
              onClick: () => openMatchDetail(entity.id),
            };

            // Home keeps only ORGANIZING/FULL/IN_PROGRESS under "Próximos
            // partidos". Everything else (COMPLETED, CANCELLED, EXPIRED)
            // goes into one combined "Partidos finalizados" section, but
            // only for 24h after the status changed -- past that window it
            // drops off Home entirely (still fully viewable via
            // MatchDetailPage, e.g. from a push deep link).
            if (ACTIVE_MATCH_STATUSES.includes(entity.status)) {
              upcomingEvents.push(item);
            } else if (now - Date.parse(entity.statusChangedAt) < FINISHED_MATCH_VISIBILITY_WINDOW_MS) {
              finishedEvents.push(item);
            }
            return;
          }

          upcomingEvents.push({
            id: entity.id,
            kind: 'booking',
            title: `${entity.courtName} • ${entity.clubName}`,
            subtitle: `${entity.dateLabel} • ${entity.time}`,
            meta: entity.matchId ? 'Con partido' : 'Sin partido',
            chipLabel: 'Reserva',
            chipColor: BOOKING_CHIP_COLOR,
            onClick: () => openBookingDetail(entity.id),
          });
        });

      return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <HomePage
            connectionStatus={status}
            playerName={playerName || undefined}
            clubName={myClub?.name ?? null}
            upcomingEvents={upcomingEvents}
            finishedEvents={finishedEvents}
            pendingInvitations={myInvitations.filter((invitation) => invitation.status === 'PENDING')}
            respondingInvitationId={respondingInvitationId}
            invitationRespondErrors={invitationRespondErrors}
            highlightInvitationId={highlightInvitationId}
            pendingTaskItems={homePendingTasks}
            onAcceptInvitation={(invitationId) => void handleRespondInvitation(invitationId, 'accept')}
            onRejectInvitation={(invitationId) => void handleRespondInvitation(invitationId, 'reject')}
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
          onLogout={() => void handleLogout()}
          pendingActions={pendingActions}
          showAdmin={hasAdminAccess}
          onOpenAdmin={openAdminDashboard}
        />
      ) : null}
      {renderView()}
      {isSignedIn ? <InstallWelcomeDialog /> : null}
      {isSignedIn ? <PushNotificationsBanner /> : null}
      <Snackbar open={globalError !== null} autoHideDuration={5000} onClose={() => setGlobalError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setGlobalError(null)} sx={{ width: '100%' }}>
          {globalError}
        </Alert>
      </Snackbar>
    </>
  );
}

export default App;
