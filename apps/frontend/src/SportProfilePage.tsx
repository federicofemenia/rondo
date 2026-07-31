import { useEffect, useMemo, useState } from 'react';
import type { SportProfileDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { ApiError, useApi } from './apiClient';
import type { AvailabilitySlotDraft } from './availability';
import AvailabilityEditor from './AvailabilityEditor';
import { getPositionOptions } from './positionOptions';
import { useSports } from './useSports';

type SportProfilePageProps = {
  onBack?: () => void;
};

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

type SportProfileCardProps = {
  sportId: string;
  sportName: string;
  initialProfile: SportProfileDto | null;
  onSaved: (profile: SportProfileDto) => void;
  onDeleted: () => void;
  onDiscard: () => void;
};

function SportProfileCard({ sportId, sportName, initialProfile, onSaved, onDeleted, onDiscard }: SportProfileCardProps) {
  const api = useApi();
  const positionOptions = getPositionOptions(sportName);

  const [positions, setPositions] = useState<string[]>(initialProfile?.positions ?? []);
  const [isAvailableForInvitations, setIsAvailableForInvitations] = useState(initialProfile?.isAvailableForInvitations ?? true);
  const [slots, setSlots] = useState<AvailabilitySlotDraft[]>(
    (initialProfile?.availability ?? []).map((slot) => ({ dayOfWeek: slot.dayOfWeek, startMinutes: slot.startMinutes, endMinutes: slot.endMinutes })),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedMessage(false);
    try {
      await api.put<{ data: SportProfileDto }>(`/api/v1/me/sport-profiles/${sportId}`, { positions, isAvailableForInvitations });
      const availabilityResponse = await api.put<{ data: SportProfileDto }>(`/api/v1/me/sport-profiles/${sportId}/availability`, { slots });
      onSaved(availabilityResponse.data);
      setSavedMessage(true);
    } catch (caught) {
      setError(describeError(caught, 'No pudimos guardar tu perfil deportivo. Reintentá.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/api/v1/me/sport-profiles/${sportId}`);
      onDeleted();
    } catch (caught) {
      setError(describeError(caught, 'No pudimos eliminar este deporte. Reintentá.'));
      setDeleting(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ p: 4, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{sportName}</Typography>
        {initialProfile ? (
          <IconButton aria-label={`Eliminar ${sportName} de tu perfil`} onClick={() => void handleDelete()} disabled={deleting || saving}>
            <DeleteOutlineRoundedIcon />
          </IconButton>
        ) : (
          <Button size="small" onClick={onDiscard} disabled={saving}>
            Cancelar
          </Button>
        )}
      </Stack>

      <Stack spacing={4}>
        {positionOptions.length > 0 ? (
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Posiciones</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {positionOptions.map((position) => (
                <Chip
                  key={position}
                  label={position}
                  clickable
                  onClick={() => setPositions((current) => toggleValue(current, position))}
                  sx={{
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: positions.includes(position) ? 'primary.dark' : 'divider',
                    bgcolor: positions.includes(position) ? 'rgba(46, 204, 113, 0.16)' : 'background.paper',
                    color: positions.includes(position) ? 'primary.light' : 'text.primary',
                  }}
                />
              ))}
            </Stack>
          </Box>
        ) : null}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}
        >
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Disponible para recibir invitaciones</Typography>
            <Typography variant="caption" color="text.secondary">
              Si lo desactivás, no vas a recibir invitaciones nuevas.
            </Typography>
          </Box>
          <Switch
            checked={isAvailableForInvitations}
            onChange={(event) => setIsAvailableForInvitations(event.target.checked)}
            inputProps={{ 'aria-label': `Disponible para recibir invitaciones en ${sportName}` }}
          />
        </Stack>

        <Divider sx={{ borderColor: 'divider' }} />

        <AvailabilityEditor slots={slots} onChange={setSlots} />

        {error ? <Alert severity="error">{error}</Alert> : null}
        {savedMessage ? <Alert severity="success">Perfil deportivo guardado.</Alert> : null}

        <Button variant="contained" onClick={() => void handleSave()} disabled={saving} sx={{ borderRadius: 999 }}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </Stack>
    </Card>
  );
}

function SportProfilePage({ onBack }: SportProfilePageProps) {
  const api = useApi();
  const { sports, loading: sportsLoading } = useSports();

  const [profiles, setProfiles] = useState<SportProfileDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftSportIds, setDraftSportIds] = useState<string[]>([]);
  const [sportToAdd, setSportToAdd] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get<{ data: SportProfileDto[] }>('/api/v1/me/sport-profiles');
        if (!cancelled) {
          setProfiles(response.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(describeError(caught, 'No pudimos cargar tu perfil deportivo. Reintentá más tarde.'));
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
  }, []);

  const profileSportIds = useMemo(() => new Set((profiles ?? []).map((profile) => profile.sportId)), [profiles]);
  const availableSportsToAdd = sports.filter((sport) => !profileSportIds.has(sport.id) && !draftSportIds.includes(sport.id));

  const handleAddSport = () => {
    if (!sportToAdd) {
      return;
    }
    setDraftSportIds((current) => [...current, sportToAdd]);
    setSportToAdd('');
  };

  const handleSaved = (sportId: string, profile: SportProfileDto) => {
    setProfiles((current) => [...(current ?? []).filter((existing) => existing.sportId !== sportId), profile]);
    setDraftSportIds((current) => current.filter((id) => id !== sportId));
  };

  const handleDeleted = (sportId: string) => {
    setProfiles((current) => (current ?? []).filter((existing) => existing.sportId !== sportId));
  };

  const handleDiscardDraft = (sportId: string) => {
    setDraftSportIds((current) => current.filter((id) => id !== sportId));
  };

  const cards = [
    ...(profiles ?? []).map((profile) => ({ sportId: profile.sportId, sportName: profile.sportName, initialProfile: profile })),
    ...draftSportIds.map((sportId) => ({
      sportId,
      sportName: sports.find((sport) => sport.id === sportId)?.name ?? '',
      initialProfile: null as SportProfileDto | null,
    })),
  ];

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: 6 }}>
        <IconButton aria-label="Volver" onClick={onBack} sx={{ mb: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <ArrowBackRoundedIcon />
        </IconButton>

        <Typography variant="h1" sx={{ fontSize: '1.5rem', mb: 1 }}>
          Perfil deportivo
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 6 }}>
          Elegí tus deportes, posiciones y disponibilidad semanal.
        </Typography>

        {loading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress />
          </Stack>
        ) : loadError ? (
          <Alert severity="error">{loadError}</Alert>
        ) : (
          <Stack spacing={5}>
            {cards.length === 0 ? <Typography color="text.secondary">Todavía no configuraste ningún deporte.</Typography> : null}

            {cards.map((card) => (
              <SportProfileCard
                key={card.sportId}
                sportId={card.sportId}
                sportName={card.sportName}
                initialProfile={card.initialProfile}
                onSaved={(profile) => handleSaved(card.sportId, profile)}
                onDeleted={() => handleDeleted(card.sportId)}
                onDiscard={() => handleDiscardDraft(card.sportId)}
              />
            ))}

            <Box sx={{ p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Agregar deporte</Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  select
                  label="Deporte"
                  value={sportToAdd}
                  onChange={(event) => setSportToAdd(event.target.value)}
                  slotProps={{ select: { native: true } }}
                  disabled={sportsLoading || availableSportsToAdd.length === 0}
                  fullWidth
                >
                  <option value="" />
                  {availableSportsToAdd.map((sport) => (
                    <option key={sport.id} value={sport.id}>
                      {sport.name}
                    </option>
                  ))}
                </TextField>
                <Button variant="outlined" onClick={handleAddSport} disabled={!sportToAdd} sx={{ borderRadius: 999, flexShrink: 0 }}>
                  Agregar
                </Button>
              </Stack>
              {availableSportsToAdd.length === 0 && !sportsLoading ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Ya configuraste todos los deportes disponibles.
                </Typography>
              ) : null}
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export default SportProfilePage;
