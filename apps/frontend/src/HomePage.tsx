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
import NoClubMembershipCard from './NoClubMembershipCard';
import { describeSchedule } from './scheduleFormat';

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
  upcomingEvents?: UpcomingEventItem[];
  pendingInvitations?: MatchInvitationDto[];
  respondingInvitationId?: string | null;
  invitationRespondErrors?: Record<string, string>;
  onAcceptInvitation?: (invitationId: string) => void;
  onRejectInvitation?: (invitationId: string) => void;
  onReserveCourt?: () => void;
  onCreateMatch?: () => void;
};

const quickActions = [
  { key: 'create', label: 'Armar partido', icon: GroupsRoundedIcon },
  { key: 'reserve', label: 'Reservar cancha', icon: CalendarMonthRoundedIcon },
] as const;

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

function HomePage({
  playerName = 'Federico',
  clubName = null,
  connectionStatus,
  upcomingEvents = [],
  pendingInvitations = [],
  respondingInvitationId = null,
  invitationRespondErrors = {},
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

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
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

      {pendingInvitations.length > 0 ? (
        <Box sx={{ mb: 8 }}>
          <SectionHeader title="Invitaciones pendientes" />
          <Stack spacing={2}>
            {pendingInvitations.map((invitation) => {
              const schedule = describeSchedule(invitation);
              const isResponding = respondingInvitationId === invitation.id;
              const respondError = invitationRespondErrors[invitation.id];

              return (
                <Card key={invitation.id} variant="outlined" sx={{ p: 4, borderColor: 'divider', bgcolor: 'background.paper' }}>
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

      <Box sx={{ mb: 8 }}>
        <SectionHeader title="Próximos eventos" />
        {upcomingEvents.length > 0 ? (
          <Stack spacing={2}>
            {upcomingEvents.map((event) => (
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
        ) : (
          <Card variant="outlined" sx={{ p: 3, display: 'flex', gap: 3, alignItems: 'center', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Avatar sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <SportsSoccerRoundedIcon sx={{ color: 'text.secondary' }} />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                Todavía no tenés partidos ni reservas
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Empezá desde Acciones rápidas
              </Typography>
            </Box>
          </Card>
        )}
      </Box>

      {clubName ? (
        <Box>
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
        </Box>
      ) : (
        <Box>
          <NoClubMembershipCard />
        </Box>
      )}
    </Box>
  );
}

export default HomePage;
