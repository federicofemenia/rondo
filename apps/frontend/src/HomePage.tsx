import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PercentRoundedIcon from '@mui/icons-material/PercentRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

export type PendingAction = {
  id: string;
  label: string;
  onClick: () => void;
};

export type UpcomingEventItem = {
  id: string;
  kind: 'match' | 'booking';
  title: string;
  subtitle: string;
  meta: string;
  onClick: () => void;
};

type HomePageProps = {
  playerName?: string;
  clubName?: string;
  connectionStatus?: string;
  pendingActions?: PendingAction[];
  upcomingEvents?: UpcomingEventItem[];
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
  clubName = 'Club Señor Pato',
  connectionStatus,
  pendingActions = [],
  upcomingEvents = [],
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 3, mb: 5 }}>
        <Typography variant="h2" component="h1">
          Hola, {playerName} 👋
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton aria-label="Notificaciones" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <Badge color="warning" variant="dot">
              <NotificationsNoneRoundedIcon />
            </Badge>
          </IconButton>
          <IconButton aria-label="Chat" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <ChatBubbleOutlineRoundedIcon />
          </IconButton>
        </Stack>
      </Stack>

      <Button
        variant="outlined"
        startIcon={<Avatar sx={{ width: 24, height: 24, fontSize: '0.9rem', bgcolor: 'warning.main' }}>🍍</Avatar>}
        endIcon={<ExpandMoreRoundedIcon />}
        sx={{ mb: 8, borderRadius: 999, borderColor: 'divider', color: 'text.primary', justifyContent: 'flex-start', py: 1.5, px: 2 }}
      >
        {clubName}
      </Button>

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

      {pendingActions.length > 0 ? (
        <Box sx={{ mb: 8 }}>
          <SectionHeader title="Acciones pendientes" />
          <Stack spacing={2}>
            {pendingActions.map((action) => (
              <Card key={action.id} variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.paper' }}>
                <CardActionArea onClick={action.onClick} sx={{ p: 3, display: 'flex', gap: 3, alignItems: 'center' }}>
                  <WarningAmberRoundedIcon sx={{ color: 'warning.main', flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                    {action.label}
                  </Typography>
                  <ChevronRightRoundedIcon sx={{ color: 'text.secondary' }} />
                </CardActionArea>
              </Card>
            ))}
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
    </Box>
  );
}

export default HomePage;
