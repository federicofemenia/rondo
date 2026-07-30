import { useEffect, useMemo, useState } from 'react';
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
import type { MatchRatingsResponseDto } from '@rondo/contracts';
import { useApi } from './apiClient';
import CandidatesPage from './CandidatesPage';
import { clubOptions } from './clubOptions';
import { buildDayOptions } from './dateOptions';
import EntityPickerDialog from './EntityPickerDialog';
import type { PickerItem } from './EntityPickerDialog';
import ExactStartTimeInput from './ExactStartTimeInput';
import InvitationsPage from './InvitationsPage';
import MatchChatPage from './MatchChatPage';
import MatchManagementPage from './MatchManagementPage';
import { MATCH_STATUS_CHIP_STYLES, MATCH_STATUS_LABELS } from './matchStatus';
import MatchRatingsPage from './MatchRatingsPage';
import { buildIsoDateTime, describeSchedule, isoTimeToMinutes } from './scheduleFormat';
import type { ScheduleUpdateInput } from './scheduleFormat';
import TimeRangeInput from './TimeRangeInput';
import type { MatchEntity, PlayerRating } from './types';

type MatchDetailPageProps = {
  match: MatchEntity;
  unlinkedBookings: PickerItem[];
  initialTab?: Tab;
  onBack?: () => void;
  onSendMessage?: (text: string) => void;
  onInviteCandidate?: (name: string) => void;
  onRemoveParticipant?: (name: string) => void;
  onCancelMatch?: () => void;
  onEditClub?: (clubName: string | null) => void;
  onEditSchedule?: (input: ScheduleUpdateInput) => Promise<void>;
  onRequestBooking?: () => void;
  onAssociateBooking?: (bookingId: string) => void;
};

export type Tab = 'datos' | 'invitar' | 'candidatos' | 'gestion' | 'chat' | 'valoraciones';

function formatCancelledAt(iso: string): string {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(date);
  const timePart = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `el ${datePart} a las ${timePart}`;
}

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
  initialTab,
  onBack,
  onSendMessage,
  onInviteCandidate,
  onRemoveParticipant,
  onCancelMatch,
  onEditClub,
  onEditSchedule,
  onRequestBooking,
  onAssociateBooking,
}: MatchDetailPageProps) {
  const api = useApi();
  const dayOptions = useMemo(() => buildDayOptions(), []);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'datos');
  const [associateOpen, setAssociateOpen] = useState(false);
  const [clubDraft, setClubDraft] = useState(match.clubName ?? '');
  const [dateDraft, setDateDraft] = useState(match.scheduledDate);
  const [availabilityRangeDraft, setAvailabilityRangeDraft] = useState<[number, number]>([
    match.availabilityStartMinutes / 60,
    match.availabilityEndMinutes / 60,
  ]);
  const [exactStartMinutesDraft, setExactStartMinutesDraft] = useState<number | null>(
    match.startsAt ? isoTimeToMinutes(match.startsAt) : null,
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [ratingsData, setRatingsData] = useState<MatchRatingsResponseDto | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsLoadError, setRatingsLoadError] = useState(false);

  const status = match.status;
  const cancelled = status === 'CANCELLED';
  const canEditSchedule = status !== 'COMPLETED' && status !== 'CANCELLED' && status !== 'EXPIRED';
  const visibleTabs: Tab[] = cancelled
    ? ['datos', 'valoraciones']
    : ['datos', 'invitar', 'candidatos', 'gestion', 'chat', 'valoraciones'];
  const statusChip = MATCH_STATUS_CHIP_STYLES[status];
  const schedule = describeSchedule(match);

  const handleAvailabilityRangeDraftChange = (range: [number, number]) => {
    setAvailabilityRangeDraft(range);
    const [startMinutes, endMinutes] = [range[0] * 60, range[1] * 60];
    setExactStartMinutesDraft((current) => (current !== null && (current < startMinutes || current >= endMinutes) ? null : current));
  };

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      onEditClub?.(clubDraft || null);
      await onEditSchedule?.({
        scheduledDate: dateDraft,
        availabilityStartMinutes: availabilityRangeDraft[0] * 60,
        availabilityEndMinutes: availabilityRangeDraft[1] * 60,
        startsAt: exactStartMinutesDraft !== null ? buildIsoDateTime(dateDraft, exactStartMinutesDraft) : null,
      });
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'No pudimos guardar el horario. Reintentá.');
    } finally {
      setScheduleSaving(false);
    }
  };

  useEffect(() => {
    if (tab !== 'valoraciones') {
      return;
    }
    let cancelledRequest = false;
    setRatingsLoading(true);
    setRatingsLoadError(false);
    api
      .get<{ data: MatchRatingsResponseDto }>(`/api/v1/matches/${match.id}/ratings`)
      .then((response) => {
        if (!cancelledRequest) {
          setRatingsData(response.data);
        }
      })
      .catch(() => {
        if (!cancelledRequest) {
          setRatingsLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelledRequest) {
          setRatingsLoading(false);
        }
      });
    return () => {
      cancelledRequest = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, match.id]);

  const handleRatePlayer = async (targetUserId: string, rating: PlayerRating) => {
    const response = await api.put<{ data: MatchRatingsResponseDto['participants'][number]['rating'] }>(
      `/api/v1/matches/${match.id}/ratings/${targetUserId}`,
      rating,
    );
    setRatingsData((current) =>
      current
        ? {
            ...current,
            pendingCount: current.participants.find((participant) => participant.userId === targetUserId)?.status === 'PENDING'
              ? Math.max(0, current.pendingCount - 1)
              : current.pendingCount,
            participants: current.participants.map((participant) =>
              participant.userId === targetUserId ? { ...participant, status: 'COMPLETED', rating: response.data } : participant,
            ),
          }
        : current,
    );
  };

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
          {visibleTabs.includes('invitar') ? <Tab value="invitar" label="Invitar" sx={{ minHeight: 0 }} /> : null}
          {visibleTabs.includes('candidatos') ? <Tab value="candidatos" label="Candidatos" sx={{ minHeight: 0 }} /> : null}
          {visibleTabs.includes('gestion') ? <Tab value="gestion" label="Gestión" sx={{ minHeight: 0 }} /> : null}
          {visibleTabs.includes('chat') ? <Tab value="chat" label="Chat" sx={{ minHeight: 0 }} /> : null}
          <Tab value="valoraciones" label="Valoraciones" sx={{ minHeight: 0 }} />
        </Tabs>
      </Box>

      {tab === 'datos' ? (
        <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
          {cancelled ? (
            <Card variant="outlined" sx={{ p: 6, mb: 6, borderColor: 'error.main', bgcolor: 'rgba(255, 77, 79, 0.08)' }}>
              <Typography variant="h3" component="h2" sx={{ color: 'error.main', mb: 1 }}>
                Partido cancelado
              </Typography>
              <Typography color="text.secondary">
                {match.cancelledByType === 'USER' && match.cancelledByName
                  ? `Cancelado por ${match.cancelledByName}${match.cancelledAt ? ` ${formatCancelledAt(match.cancelledAt)}` : ''}`
                  : 'Actualizado automáticamente por el sistema'}
              </Typography>
              {match.cancellationReason ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Motivo: {match.cancellationReason}
                </Typography>
              ) : null}
            </Card>
          ) : null}

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
                    {match.clubName ? `${match.modality} • ${match.clubName}` : `${match.modality} • Club a definir`}
                  </Typography>
                </Box>
              </Stack>
              <Chip
                label={MATCH_STATUS_LABELS[status]}
                size="small"
                sx={{ fontWeight: 700, bgcolor: statusChip.bgcolor, color: statusChip.color }}
              />
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Chip label={schedule.dateLabel} sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }} />
              <Chip
                label={schedule.isConfirmed ? schedule.timeLabel : `Franja ${schedule.windowLabel}`}
                sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }}
              />
              <Chip
                label={`Jugadores ${match.minPlayers} - ${match.maxPlayers}`}
                sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }}
              />
              <Chip
                label={`${match.participantsCount} / ${match.maxPlayers} confirmados`}
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
              <StatusRow label={match.clubName ? 'Club seleccionado' : 'Club pendiente'} done={Boolean(match.clubName)} value={match.clubName ?? undefined} />
              <StatusRow label="Día confirmado" done value={schedule.dateLabel} />
              <StatusRow
                label={schedule.isConfirmed ? 'Horario confirmado' : 'Horario pendiente de confirmación'}
                done={schedule.isConfirmed}
                value={schedule.isConfirmed ? schedule.timeLabel : `Franja elegida: ${schedule.windowLabel}`}
              />
              <StatusRow label={match.courtName ? 'Cancha confirmada' : 'Cancha pendiente'} done={Boolean(match.courtName)} value={match.courtName ?? undefined} />
            </Box>

            {canEditSchedule ? (
              <Stack spacing={3} sx={{ mt: 4 }}>
                <TextField
                  select
                  label="Editar club"
                  value={clubDraft}
                  onChange={(event) => setClubDraft(event.target.value)}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                  helperText="Solo se listan los clubes de los que sos miembro."
                  fullWidth
                >
                  <option value="">Sin definir</option>
                  {clubOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </TextField>
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
                <TimeRangeInput value={availabilityRangeDraft} onChange={handleAvailabilityRangeDraftChange} label="Editar franja horaria disponible" />
                <ExactStartTimeInput
                  availabilityStartMinutes={availabilityRangeDraft[0] * 60}
                  availabilityEndMinutes={availabilityRangeDraft[1] * 60}
                  value={exactStartMinutesDraft}
                  onChange={setExactStartMinutesDraft}
                  label="Editar horario exacto (opcional)"
                />
                {scheduleError ? (
                  <Typography variant="body2" color="error.main">
                    {scheduleError}
                  </Typography>
                ) : null}
                <Button variant="outlined" onClick={() => void handleSaveSchedule()} disabled={scheduleSaving}>
                  {scheduleSaving ? 'Guardando…' : 'Guardar cambios'}
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
            ) : null}
          </Card>
        </Box>
      ) : null}

      {tab === 'invitar' && visibleTabs.includes('invitar') ? (
        <CandidatesPage matchDraft={match} excludeNames={match.invitedCandidates} onInviteCandidate={onInviteCandidate} />
      ) : null}

      {tab === 'candidatos' && visibleTabs.includes('candidatos') ? (
        <InvitationsPage
          invitedCandidates={match.invitedCandidates}
          participants={match.participants}
          declinedCandidates={match.declinedCandidates}
        />
      ) : null}

      {tab === 'gestion' && visibleTabs.includes('gestion') ? (
        <MatchManagementPage participants={match.participants} onRemoveParticipant={onRemoveParticipant} onCancelMatch={onCancelMatch} />
      ) : null}

      {tab === 'chat' && visibleTabs.includes('chat') ? <MatchChatPage initialMessages={match.chatMessages} onSendMessage={onSendMessage} /> : null}

      {tab === 'valoraciones' ? (
        <MatchRatingsPage
          status={status}
          closed={ratingsData?.closed ?? false}
          loading={ratingsLoading}
          loadError={ratingsLoadError}
          participants={ratingsData?.participants}
          onRatePlayer={handleRatePlayer}
        />
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
