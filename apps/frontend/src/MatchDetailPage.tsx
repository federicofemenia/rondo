import { useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import CandidatesPage from './CandidatesPage';
import { buildDayOptions, timeRangeOptions } from './dateOptions';
import EntityPickerDialog from './EntityPickerDialog';
import type { PickerItem } from './EntityPickerDialog';
import InvitationsPage from './InvitationsPage';
import MatchChatPage from './MatchChatPage';
import MatchManagementPage from './MatchManagementPage';
import { isMatchFinished, isMatchFull } from './matchStatus';
import MatchRatingsPage from './MatchRatingsPage';
import type { MatchEntity, PlayerRating } from './types';

type MatchDetailPageProps = {
  match: MatchEntity;
  unlinkedBookings: PickerItem[];
  onBack?: () => void;
  onSendMessage?: (text: string) => void;
  onInviteCandidate?: (name: string) => void;
  onRemoveParticipant?: (name: string) => void;
  onCancelMatch?: () => void;
  onRatePlayer?: (name: string, rating: PlayerRating) => void;
  onEditDate?: (date: string) => void;
  onEditTime?: (time: string) => void;
  onRequestBooking?: () => void;
  onAssociateBooking?: (bookingId: string) => void;
};

type Tab = 'datos' | 'candidatos' | 'invitar' | 'gestion' | 'chat' | 'valoraciones';

function StatusRow({ label, done, value }: { label: string; done: boolean; value?: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1.5 }}>
      {done ? (
        <CheckCircleRoundedIcon sx={{ color: 'primary.main', flexShrink: 0 }} />
      ) : (
        <WarningAmberRoundedIcon sx={{ color: 'warning.main', flexShrink: 0 }} />
      )}
      <Typography sx={{ fontWeight: 600, flex: 1 }}>{label}</Typography>
      {value ? (
        <Typography variant="body2" color="text.secondary">
          {value}
        </Typography>
      ) : null}
    </Stack>
  );
}

function MatchDetailPage({
  match,
  unlinkedBookings,
  onBack,
  onSendMessage,
  onInviteCandidate,
  onRemoveParticipant,
  onCancelMatch,
  onRatePlayer,
  onEditDate,
  onEditTime,
  onRequestBooking,
  onAssociateBooking,
}: MatchDetailPageProps) {
  const dayOptions = useMemo(() => buildDayOptions(), []);
  const [tab, setTab] = useState<Tab>('datos');
  const [associateOpen, setAssociateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState(match.date);
  const [timeDraft, setTimeDraft] = useState(match.time ?? '');

  const full = isMatchFull(match);
  const finished = isMatchFinished(match);
  const statusLabel = finished ? 'Finalizado' : full ? 'Confirmado' : 'Buscando jugadores';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 5 }}>
          <IconButton aria-label="Volver" onClick={onBack} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{match.sport}</Typography>
          <Box sx={{ width: 40 }} />
        </Stack>

        <Tabs
          value={tab}
          onChange={(_event, value: Tab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minHeight: 0, mb: 4 }}
        >
          <Tab value="datos" label="Datos" sx={{ minHeight: 0 }} />
          <Tab value="candidatos" label="Candidatos" sx={{ minHeight: 0 }} />
          <Tab value="invitar" label="Invitar" sx={{ minHeight: 0 }} />
          <Tab value="gestion" label="Gestión" sx={{ minHeight: 0 }} />
          <Tab value="chat" label="Chat" sx={{ minHeight: 0 }} />
          {finished ? <Tab value="valoraciones" label="Valoraciones" sx={{ minHeight: 0 }} /> : null}
        </Tabs>
      </Box>

      {tab === 'datos' ? (
        <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
          <Card variant="outlined" sx={{ p: 6, borderColor: 'divider', mb: 6 }}>
            <Stack direction="row" spacing={3} alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
              <Stack direction="row" spacing={3} alignItems="center">
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(46, 204, 113, 0.16)' }}>
                  <SportsSoccerRoundedIcon sx={{ color: 'primary.main' }} />
                </Avatar>
                <Box>
                  <Typography variant="h1" sx={{ fontSize: '1.5rem' }}>
                    {match.sport}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {match.modality} • {match.clubName}
                  </Typography>
                </Box>
              </Stack>
              <Chip
                label={statusLabel}
                size="small"
                sx={{
                  fontWeight: 700,
                  bgcolor: finished ? 'background.default' : full ? 'rgba(46, 204, 113, 0.16)' : 'rgba(245, 197, 66, 0.16)',
                  color: finished ? 'text.secondary' : full ? 'primary.light' : 'warning.main',
                }}
              />
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Chip label={match.date} sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }} />
              <Chip
                label={`Jugadores ${match.minPlayers} - ${match.maxPlayers}`}
                sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }}
              />
              <Chip
                label={`${match.participants.length} / ${match.maxPlayers} confirmados`}
                sx={{ bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light', fontWeight: 700 }}
              />
              {match.positions.map((position) => (
                <Chip key={position} label={position} size="small" sx={{ bgcolor: 'background.paper', color: 'text.secondary', fontWeight: 700 }} />
              ))}
            </Stack>
          </Card>

          <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700, mb: 2 }}>Estado del evento</Typography>
            <Box sx={{ '& > div:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' } }}>
              <StatusRow label="Club seleccionado" done value={match.clubName} />
              <StatusRow label="Día confirmado" done value={match.date} />
              <StatusRow label={match.time ? 'Horario confirmado' : 'Horario pendiente'} done={Boolean(match.time)} value={match.time ?? undefined} />
              <StatusRow label={match.courtName ? 'Cancha confirmada' : 'Cancha pendiente'} done={Boolean(match.courtName)} value={match.courtName ?? undefined} />
            </Box>

            <Stack spacing={3} sx={{ mt: 4 }}>
              <TextField
                select
                label="Editar día"
                value={dateDraft}
                onChange={(event) => setDateDraft(event.target.value)}
                slotProps={{ select: { native: true } }}
                fullWidth
              >
                {!dayOptions.some((option) => option.value === dateDraft) ? <option value={dateDraft}>{dateDraft}</option> : null}
                {dayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>
              <TextField
                select
                label="Editar horario"
                value={timeDraft}
                onChange={(event) => setTimeDraft(event.target.value)}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                helperText="Elegí una franja: mañana, tarde o noche."
                fullWidth
              >
                <option value="">Sin definir</option>
                {timeDraft && !timeRangeOptions.some((option) => option.value === timeDraft) ? (
                  <option value={timeDraft}>{timeDraft}</option>
                ) : null}
                {timeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>
              <Button
                variant="outlined"
                onClick={() => {
                  onEditDate?.(dateDraft);
                  onEditTime?.(timeDraft);
                }}
              >
                Guardar día y horario
              </Button>

              {!match.courtName ? (
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Button variant="contained" onClick={onRequestBooking}>
                    Realizar una reserva
                  </Button>
                  <Button variant="outlined" onClick={() => setAssociateOpen(true)}>
                    Asociar una reserva existente
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Card>
        </Box>
      ) : null}

      {tab === 'candidatos' ? (
        <InvitationsPage
          invitedCandidates={match.invitedCandidates}
          participants={match.participants}
          declinedCandidates={match.declinedCandidates}
        />
      ) : null}

      {tab === 'invitar' ? (
        <CandidatesPage matchDraft={match} excludeNames={match.invitedCandidates} onInviteCandidate={onInviteCandidate} />
      ) : null}

      {tab === 'gestion' ? (
        <MatchManagementPage participants={match.participants} onRemoveParticipant={onRemoveParticipant} onCancelMatch={onCancelMatch} />
      ) : null}

      {tab === 'chat' ? <MatchChatPage initialMessages={match.chatMessages} onSendMessage={onSendMessage} /> : null}

      {tab === 'valoraciones' && finished ? (
        <MatchRatingsPage participants={match.participants} ratings={match.ratings} onRatePlayer={onRatePlayer} />
      ) : null}

      <EntityPickerDialog
        open={associateOpen}
        onClose={() => setAssociateOpen(false)}
        title="Asociar una reserva existente"
        items={unlinkedBookings}
        emptyLabel="No tenés reservas sin partido asociado."
        onSelect={(id) => {
          onAssociateBooking?.(id);
          setAssociateOpen(false);
        }}
      />
    </Box>
  );
}

export default MatchDetailPage;
