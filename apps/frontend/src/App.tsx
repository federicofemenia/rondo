import { useEffect, useState } from 'react';
import type { HealthResponse } from '@rondo/contracts';
import { appConfig } from '@rondo/config';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import AppHeader from './AppHeader';
import BookingDetailPage from './BookingDetailPage';
import CandidatesPage from './CandidatesPage';
import CreateMatchPage from './CreateMatchPage';
import type { MatchDraft } from './CreateMatchPage';
import EditProfilePage from './EditProfilePage';
import HomePage from './HomePage';
import type { PendingAction, UpcomingEventItem } from './HomePage';
import LoginPage from './LoginPage';
import MatchDetailPage from './MatchDetailPage';
import RegisterPage from './RegisterPage';
import ReservationFlowPage from './ReservationFlowPage';
import type { ConfirmedBooking } from './ReservationFlowPage';
import type { BookingEntity, MatchEntity, PlayerRating } from './types';

type View =
  | 'login'
  | 'register'
  | 'home'
  | 'create'
  | 'candidates'
  | 'reservation'
  | 'match-detail'
  | 'booking-detail'
  | 'edit-profile';

const wizardSteps = [
  { key: 'create', label: 'Armar partido' },
  { key: 'candidates', label: 'Candidatos' },
] as const;

type WizardStep = (typeof wizardSteps)[number]['key'];

function isWizardStep(view: View): view is WizardStep {
  return view === 'create' || view === 'candidates';
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? appConfig.apiBaseUrl;

function App() {
  const [status, setStatus] = useState('Verificando conexión…');
  const [currentView, setCurrentView] = useState<View>('login');

  const [matches, setMatches] = useState<MatchEntity[]>([]);
  const [bookings, setBookings] = useState<BookingEntity[]>([]);

  const [matchDraft, setMatchDraft] = useState<MatchDraft | null>(null);
  const [invitedCandidates, setInvitedCandidates] = useState<string[]>([]);

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
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

  const openCreateFlow = () => {
    setMatchDraft(null);
    setInvitedCandidates([]);
    setCurrentView('create');
  };

  const openReservationFlow = () => {
    setReservationMatchContext(null);
    setCurrentView('reservation');
  };

  const openMatchDetail = (matchId: string) => {
    setSelectedMatchId(matchId);
    setCurrentView('match-detail');
  };

  const openBookingDetail = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setCurrentView('booking-detail');
  };

  const handleCreateMatch = (draft: MatchDraft) => {
    setMatchDraft(draft);
    setCurrentView('candidates');
  };

  const handleInviteCandidate = (name: string) => {
    setInvitedCandidates((current) => (current.includes(name) ? current : [...current, name]));
  };

  const handleFinishWizard = () => {
    if (matchDraft) {
      const newMatch: MatchEntity = {
        id: crypto.randomUUID(),
        sport: matchDraft.sport,
        modality: matchDraft.modality,
        minPlayers: matchDraft.minPlayers,
        maxPlayers: matchDraft.maxPlayers,
        positions: matchDraft.positions,
        clubName: matchDraft.clubName,
        courtName: matchDraft.courtName,
        date: matchDraft.date,
        time: matchDraft.time,
        bookingId: null,
        invitedCandidates,
        declinedCandidates: [],
        participants: [],
        chatMessages: [],
        ratings: {},
        createdAt: Date.now(),
      };
      setMatches((current) => [...current, newMatch]);
    }
    setMatchDraft(null);
    setInvitedCandidates([]);
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
            ? { ...match, bookingId, courtName: `${confirmed.courtName} · ${confirmed.courtSubtitle}`, date: confirmed.dateLabel, time: confirmed.time }
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
          ? { ...match, bookingId, courtName: `${booking.courtName} · ${booking.courtSubtitle}`, date: booking.dateLabel, time: booking.time }
          : match,
      ),
    );
  };

  const handleSendMessage = (matchId: string, text: string) => {
    setMatches((current) =>
      current.map((match) => (match.id === matchId ? { ...match, chatMessages: [...match.chatMessages, { author: 'Vos', text }] } : match)),
    );
  };

  const handleInviteMoreCandidates = (matchId: string, name: string) => {
    setMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? { ...match, invitedCandidates: match.invitedCandidates.includes(name) ? match.invitedCandidates : [...match.invitedCandidates, name] }
          : match,
      ),
    );
  };

  const handleRemoveParticipant = (matchId: string, name: string) => {
    setMatches((current) =>
      current.map((match) =>
        match.id === matchId ? { ...match, participants: match.participants.filter((participant) => participant !== name) } : match,
      ),
    );
  };

  const handleCancelMatch = (matchId: string) => {
    setMatches((current) => current.filter((match) => match.id !== matchId));
    setCurrentView('home');
  };

  const handleRatePlayer = (matchId: string, name: string, rating: PlayerRating) => {
    setMatches((current) =>
      current.map((match) => (match.id === matchId ? { ...match, ratings: { ...match.ratings, [name]: rating } } : match)),
    );
  };

  const handleEditMatchDate = (matchId: string, date: string) => {
    setMatches((current) => current.map((match) => (match.id === matchId ? { ...match, date } : match)));
  };

  const handleEditMatchTime = (matchId: string, time: string) => {
    setMatches((current) => current.map((match) => (match.id === matchId ? { ...match, time: time || null } : match)));
  };

  const openEditProfile = () => setCurrentView('edit-profile');

  const handleLogout = () => setCurrentView('login');

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
    if (currentView === 'login') {
      return <LoginPage onLogin={() => setCurrentView('home')} onNavigateToRegister={() => setCurrentView('register')} />;
    }

    if (currentView === 'register') {
      return <RegisterPage onRegister={() => setCurrentView('home')} onNavigateToLogin={() => setCurrentView('login')} />;
    }

    if (currentView === 'edit-profile') {
      return <EditProfilePage onBack={() => setCurrentView('home')} />;
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

      return (
        <MatchDetailPage
          match={match}
          unlinkedBookings={unlinkedBookings}
          onBack={() => setCurrentView('home')}
          onSendMessage={(text) => handleSendMessage(match.id, text)}
          onInviteCandidate={(name) => handleInviteMoreCandidates(match.id, name)}
          onRemoveParticipant={(name) => handleRemoveParticipant(match.id, name)}
          onCancelMatch={() => handleCancelMatch(match.id)}
          onRatePlayer={(name, rating) => handleRatePlayer(match.id, name, rating)}
          onEditDate={(date) => handleEditMatchDate(match.id, date)}
          onEditTime={(time) => handleEditMatchTime(match.id, time)}
          onRequestBooking={() => handleRequestBookingForMatch(match.id)}
          onAssociateBooking={(bookingId) => linkMatchAndBooking(match.id, bookingId)}
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
          subtitle: match.date ? `${match.clubName} • ${match.date}` : match.clubName,
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
        if (!match.time) {
          pendingActions.push({ id: `${match.id}-time`, label: `Tu partido de ${match.sport} todavía no tiene horario.`, onClick: () => openMatchDetail(match.id) });
        }
        if (!match.courtName) {
          pendingActions.push({ id: `${match.id}-court`, label: `Tu partido de ${match.sport} todavía no tiene cancha.`, onClick: () => openMatchDetail(match.id) });
        }
        const pendingCandidatesCount = match.invitedCandidates.filter(
          (name) => !match.participants.includes(name) && !match.declinedCandidates.includes(name),
        ).length;
        if (pendingCandidatesCount > 0) {
          pendingActions.push({
            id: `${match.id}-invites`,
            label: `Tenés invitaciones pendientes en tu partido de ${match.sport}.`,
            onClick: () => openMatchDetail(match.id),
          });
        }
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
            return {
              id: entity.id,
              kind: 'match' as const,
              title: `${entity.sport} • ${entity.modality}`,
              subtitle: entity.time ? `${entity.date} • ${entity.time}` : `${entity.date} • Horario a definir`,
              meta: `${entity.participants.length}/${entity.maxPlayers}`,
              onClick: () => openMatchDetail(entity.id),
            };
          }
          return {
            id: entity.id,
            kind: 'booking' as const,
            title: `${entity.courtName} • ${entity.clubName}`,
            subtitle: `${entity.dateLabel} • ${entity.time}`,
            meta: entity.matchId ? 'Con partido' : 'Sin partido',
            onClick: () => openBookingDetail(entity.id),
          };
        });

      return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <HomePage
            connectionStatus={status}
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
          return <CandidatesPage matchDraft={matchDraft} onInviteCandidate={handleInviteCandidate} onFinish={handleFinishWizard} />;
        case 'create':
        default:
          return <CreateMatchPage onCreateMatch={handleCreateMatch} />;
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
                    {matchDraft.modality} • {matchDraft.clubName}
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
      {showAppHeader ? <AppHeader onEditProfile={openEditProfile} onLogout={handleLogout} /> : null}
      {renderView()}
    </>
  );
}

export default App;
