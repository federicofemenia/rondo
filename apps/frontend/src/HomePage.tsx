import { useEffect, useRef, useState } from 'react';
import type { MatchInvitationDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import PercentRoundedIcon from '@mui/icons-material/PercentRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import NoClubMembershipCard from './NoClubMembershipCard';
import { describeSchedule } from './scheduleFormat';
import type { PendingAction } from './types';

export type UpcomingEventItem = {
  id: string;
  kind: 'match' | 'booking';
  title: string;
  subtitle: string;
  meta: string;
  chipLabel: string;
  chipColor: { bgcolor: string; color: string };
  onClick: () => void;
};

type HomePageProps = {
  playerName?: string;
  clubName?: string | null;
  connectionStatus?: string;
  /** ORGANIZING/FULL/IN_PROGRESS matches plus bookings -- section is hidden entirely when empty (no CTA card). */
  upcomingEvents?: UpcomingEventItem[];
  /** COMPLETED/CANCELLED/EXPIRED matches, all together regardless of age -- its own section, hidden entirely when empty. */
  finishedEvents?: UpcomingEventItem[];
  pendingInvitations?: MatchInvitationDto[];
  respondingInvitationId?: string | null;
  invitationRespondErrors?: Record<string, string>;
  /** Set when a push notification deep-linked to a specific pending invitation -- scrolls to and briefly highlights that card once. */
  highlightInvitationId?: string | null;
  /** Real, actionable tasks only (see App.tsx) -- section is hidden entirely when empty. */
  pendingTaskItems?: PendingAction[];
  onAcceptInvitation?: (invitationId: string) => void;
  onRejectInvitation?: (invitationId: string) => void;
  onReserveCourt?: () => void;
  onCreateMatch?: () => void;
};

const quickActions = [
  { key: 'create', label: 'Armar partido', icon: GroupsRoundedIcon },
  { key: 'reserve', label: 'Reservar cancha', icon: CalendarMonthRoundedIcon },
] as const;

const HIGHLIGHT_DURATION_MS = 2500;

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
      <Typography variant="h3" component="h2">
        {title}
      </Typography>
      {action ? (
        <Typography variant="body2" sx={{ color: 'primary.light', fontWeight: 700, cursor: 'pointer' }}>
          {action}
        </Typography>
      ) : null}
    </Stack>
  );
}

function EventList({ events }: { events: UpcomingEventItem[] }) {
  return (
    <Stack spacing={2}>
      {events.map((event) => (
        <Card key={event.id} variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
          <CardActionArea onClick={event.onClick} sx={{ p: 3, display: 'flex', gap: 3, alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              {event.kind === 'match' ? (
                <SportsSoccerRoundedIcon sx={{ color: 'text.primary' }} />
              ) : (
                <PlaceRoundedIcon sx={{ color: 'info.main' }} />
              )}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Chip
                label={event.chipLabel}
                size="small"
                sx={{
                  mb: 1,
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: event.chipColor.bgcolor,
                  color: event.chipColor.color,
                }}
              />
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {event.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {event.subtitle}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'primary.light', fontWeight: 700, flexShrink: 0 }}>
              {event.meta}
            </Typography>
            <ChevronRightRoundedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );
}

function HomePage({
  playerName = 'Federico',
  clubName = null,
  connectionStatus,
  upcomingEvents = [],
  finishedEvents = [],
  pendingInvitations = [],
  respondingInvitationId = null,
  invitationRespondErrors = {},
  highlightInvitationId = null,
  pendingTaskItems = [],
  onAcceptInvitation,
  onRejectInvitation,
  onReserveCourt,
  onCreateMatch,
}: HomePageProps) {
  const actionHandlers: Record<(typeof quickActions)[number]['key'], (() => void) | undefined> = {
    reserve: onReserveCourt,
    create: onCreateMatch,
  };
  const isOffline = Boolean(connectionStatus) && connectionStatus !== 'API conectada';

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const appliedHighlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightInvitationId || appliedHighlightRef.current === highlightInvitationId) {
      return;
    }
    appliedHighlightRef.current = highlightInvitationId;

    const element = document.getElementById(`invitation-${highlightInvitationId}`);
    if (!element) {
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(highlightInvitationId);

    const timeout = setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [highlightInvitationId]);

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      {/* 1. Encabezado */}
      {isOffline ? (
        <Chip
          label={connectionStatus}
          size="small"
          sx={{ mt: 3, bgcolor: 'rgba(245, 197, 66, 0.16)', color: 'warning.main', fontWeight: 700 }}
        />
      ) : null}
      <Typography variant="h2" component="h1" sx={{ pt: 3, mb: 5 }}>
        Hola, {playerName} 👋
      </Typography>

      {clubName ? (
        <Button
          variant="outlined"
          startIcon={<Avatar sx={{ width: 24, height: 24, fontSize: '0.9rem', bgcolor: 'warning.main' }}>🍍</Avatar>}
          endIcon={<ExpandMoreRoundedIcon />}
          sx={{ mb: 8, borderRadius: 999, borderColor: 'divider', color: 'text.primary', justifyContent: 'flex-start', py: 1.5, px: 2 }}
        >
          {clubName}
        </Button>
      ) : null}

      {/* 2. Acciones rápidas -- back at the top, so it's the first thing after the header. */}
      <Box sx={{ mb: 8 }}>
        <SectionHeader title="Acciones rápidas" />
        <Stack direction="row" spacing={2}>
          {quickActions.map(({ key, label, icon: Icon }) => (
            <Card
              key={key}
              variant="outlined"
              component="button"
              onClick={actionHandlers[key]}
              sx={{
                flex: 1,
                p: 3,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                color: 'text.primary',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                font: 'inherit',
              }}
            >
              <Icon sx={{ color: 'primary.main' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'center' }}>
                {label}
              </Typography>
            </Card>
          ))}
        </Stack>
      </Box>

      {/* 3. Invitaciones -- only when there is at least one pending, shown directly (no separate screen). */}
      {pendingInvitations.length > 0 ? (
        <Box sx={{ mb: 8 }}>
          <SectionHeader title="Invitaciones" />
          <Stack spacing={2}>
            {pendingInvitations.map((invitation) => {
              const schedule = describeSchedule(invitation);
              const isResponding = respondingInvitationId === invitation.id;
              const respondError = invitationRespondErrors[invitation.id];
              const isHighlighted = highlightedId === invitation.id;

              return (
                <Card
                  key={invitation.id}
                  id={`invitation-${invitation.id}`}
                  variant="outlined"
                  sx={{
                    p: 4,
                    borderColor: isHighlighted ? 'primary.main' : 'divider',
                    bgcolor: 'background.paper',
                    transition: 'border-color 0.3s ease',
                    boxShadow: isHighlighted ? 4 : 'none',
                  }}
                >
                  <Stack direction="row" spacing={3} alignItems="flex-start">
                    <Avatar sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                      <MailOutlineRoundedIcon sx={{ color: 'warning.main' }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {invitation.organizerDisplayName} te invitó a {invitation.sportName} {invitation.modalityName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="p">
                        {schedule.dateLabel} • {schedule.isConfirmed ? schedule.timeLabel : `Franja ${schedule.windowLabel}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="p">
                        {invitation.clubName ?? 'Sede a definir'}
                      </Typography>
                    </Box>
                  </Stack>

                  {respondError ? (
                    <Alert severity="error" sx={{ mt: 3 }}>
                      {respondError}
                    </Alert>
                  ) : null}

                  <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                    <Button variant="contained" fullWidth disabled={isResponding} onClick={() => onAcceptInvitation?.(invitation.id)}>
                      {isResponding ? 'Enviando…' : 'Aceptar'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      fullWidth
                      disabled={isResponding}
                      onClick={() => onRejectInvitation?.(invitation.id)}
                    >
                      Rechazar
                    </Button>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </Box>
      ) : null}

      {/* 4. Próximos partidos -- hidden entirely (no empty-state card) when there is nothing upcoming. */}
      {upcomingEvents.length > 0 ? (
        <Box sx={{ mb: 8 }}>
          <SectionHeader title="Próximos partidos" />
          <EventList events={upcomingEvents} />
        </Box>
      ) : null}

      {/* Partidos finalizados -- everything that isn't ORGANIZING/FULL/IN_PROGRESS (COMPLETED, CANCELLED, EXPIRED), grouped together; hidden entirely when empty. */}
      {finishedEvents.length > 0 ? (
        <Box sx={{ mb: 8 }}>
          <SectionHeader title="Partidos finalizados" />
          <EventList events={finishedEvents} />
        </Box>
      ) : null}

      {/* 5. Tareas pendientes -- hidden entirely when there is nothing real to do. */}
      {pendingTaskItems.length > 0 ? (
        <Box sx={{ mb: 8 }}>
          <SectionHeader title="Tareas pendientes" />
          <Stack spacing={2}>
            {pendingTaskItems.map((task) => (
              <Card key={task.id} variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
                <CardActionArea onClick={task.onClick} sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                  <WarningAmberRoundedIcon sx={{ color: 'warning.main', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {task.label}
                    </Typography>
                    {task.description ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {task.description}
                      </Typography>
                    ) : null}
                  </Box>
                  <ChevronRightRoundedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </Box>
      ) : null}

      {/* 6. Club: novedades if there is an active membership, otherwise the no-club card -- never both. */}
      <Box>
        {clubName ? (
          <>
            <SectionHeader title={`Novedades de ${clubName}`} />
            <Card variant="outlined" sx={{ p: 4, display: 'flex', gap: 3, alignItems: 'center', borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                <PercentRoundedIcon sx={{ color: 'background.default' }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  20% OFF en todas las canchas de lunes a viernes
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Válido para socios
                </Typography>
              </Box>
            </Card>
          </>
        ) : (
          <NoClubMembershipCard />
        )}
      </Box>
    </Box>
  );
}

export default HomePage;
