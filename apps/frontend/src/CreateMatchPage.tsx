import { useMemo, useState } from 'react';
import type { MatchVenueTypeDto } from '@rondo/contracts';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { buildDayOptions } from './dateOptions';
import ExactStartTimeInput from './ExactStartTimeInput';
import PageFooter from './PageFooter';
import { computeExactTimeBounds } from './scheduleFormat';
import TimeRangeInput, { DEFAULT_AVAILABILITY_RANGE } from './TimeRangeInput';
import { useMyClubs } from './useMyClubs';
import { useSports } from './useSports';

export type MatchDraft = {
  sportId: string;
  sport: string;
  modality: string;
  sportModalityId: string;
  minPlayers: string;
  maxPlayers: string;
  positions: string[];
  venueType: MatchVenueTypeDto;
  clubId: string | null;
  clubName: string | null;
  courtName: string | null;
  date: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  durationMinutes: number;
  startTimeMinutes: number | null;
};

type CreateMatchPageProps = {
  onCreateMatch?: (draft: MatchDraft) => void;
};

const positionOptions = ['Arquero', 'Defensor', 'Mediocampista', 'Delantero'];
const OTHER_CLUB_VALUE = '__other__';

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function CreateMatchPage({ onCreateMatch }: CreateMatchPageProps) {
  const dayOptions = useMemo(() => buildDayOptions(), []);
  const { sports, loading: sportsLoading, error: sportsError } = useSports();
  const { clubs, loading: clubsLoading } = useMyClubs();

  const sportModalities = useMemo(() => {
    const record: Record<string, { id: string; name: string; durationMinutes: number }[]> = {};
    sports.forEach((sportOption) => {
      record[sportOption.name] = sportOption.modalities.map((modality) => ({
        id: modality.id,
        name: modality.name,
        durationMinutes: modality.durationMinutes,
      }));
    });
    return record;
  }, [sports]);
  const sportNames = Object.keys(sportModalities);

  const [sport, setSport] = useState('');
  const [modality, setModality] = useState('');
  const [minPlayers, setMinPlayers] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [clubId, setClubId] = useState('');
  const [otherClubName, setOtherClubName] = useState('');
  const [date, setDate] = useState(dayOptions[0]!.value);
  const [availabilityRange, setAvailabilityRange] = useState<[number, number]>(DEFAULT_AVAILABILITY_RANGE);
  const [startTimeMinutes, setStartTimeMinutes] = useState<number | null>(null);
  // Defaults to the chosen modality's typical duration (see handleSportChange
  // / handleModalityChange below), but stays fully editable by the organizer.
  const [durationMinutes, setDurationMinutes] = useState(60);
  // Neither the franja slider nor the exact-time combo shows until this is
  // answered -- they're mutually exclusive, not two optional extras.
  const [hasExactTime, setHasExactTime] = useState<boolean | null>(null);

  const availabilityStartMinutes = availabilityRange[0] * 60;
  const availabilityEndMinutes = availabilityRange[1] * 60;
  const isToday = date === dayOptions[0]?.value;
  const [exactStartBound, exactEndBound] = computeExactTimeBounds(isToday);

  const handleHasExactTimeChange = (next: boolean) => {
    setHasExactTime(next);
    if (next) {
      setStartTimeMinutes((current) =>
        current !== null && current >= exactStartBound && current < exactEndBound ? current : exactStartBound,
      );
    } else {
      setStartTimeMinutes(null);
    }
  };

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    if (hasExactTime) {
      const nextBounds = computeExactTimeBounds(nextDate === dayOptions[0]?.value);
      setStartTimeMinutes((current) =>
        current !== null && current >= nextBounds[0] && current < nextBounds[1] ? current : nextBounds[0],
      );
    }
  };

  const handleSportChange = (nextSport: string) => {
    setSport(nextSport);
    const firstModality = sportModalities[nextSport]?.[0];
    setModality(firstModality?.name ?? '');
    setDurationMinutes(firstModality?.durationMinutes ?? 60);
    if (nextSport !== 'Fútbol') {
      setPositions([]);
    }
  };

  const isOtherClub = clubId === OTHER_CLUB_VALUE;
  const trimmedOtherClubName = otherClubName.trim();
  const venueType: MatchVenueTypeDto = isOtherClub ? 'CUSTOM' : clubId ? 'CLUB' : 'TO_BE_DEFINED';
  const isCustomVenueMissing = isOtherClub && !trimmedOtherClubName;
  const isDurationInvalid = !Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 600;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sportModalityId = sportModalities[sport]?.find((option) => option.name === modality)?.id;
    const sportId = sports.find((option) => option.name === sport)?.id;
    if (!sportModalityId || !sportId || isCustomVenueMissing || isDurationInvalid) {
      return;
    }
    const selectedClub = isOtherClub ? undefined : clubs.find((club) => club.id === clubId);
    onCreateMatch?.({
      sportId,
      sport,
      modality,
      sportModalityId,
      minPlayers,
      maxPlayers,
      positions,
      venueType,
      clubId: venueType === 'CLUB' ? clubId || null : null,
      clubName: venueType === 'CLUB' ? (selectedClub?.name ?? null) : venueType === 'CUSTOM' ? trimmedOtherClubName : null,
      courtName: null,
      date,
      availabilityStartMinutes: hasExactTime ? exactStartBound : availabilityStartMinutes,
      availabilityEndMinutes: hasExactTime ? exactEndBound : availabilityEndMinutes,
      durationMinutes,
      startTimeMinutes: hasExactTime ? startTimeMinutes : null,
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ minHeight: '100vh' }}>
      <Box sx={{ px: 2, pb: '120px' }}>
        <Card variant="outlined" sx={{ maxWidth: 480, mx: 'auto', p: 6, borderColor: 'divider' }}>
          <Box sx={{ mb: 6 }}>
            <Typography variant="h1" sx={{ mb: 1 }}>
              Armar partido
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Elegí el día y la franja horaria del partido. El club, el horario exacto y la cancha podés definirlos más adelante.
            </Typography>
          </Box>

          <Stack spacing={5}>
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 3 }}>Información deportiva</Typography>
              <Stack spacing={4}>
                <TextField
                  select
                  label="Deporte"
                  value={sport}
                  onChange={(event) => handleSportChange(event.target.value)}
                  slotProps={{ select: { native: true } }}
                  disabled={sportsLoading || sportNames.length === 0}
                  error={sportsError}
                  helperText={sportsError ? 'No pudimos cargar los deportes. Reintentá más tarde.' : undefined}
                  fullWidth
                >
                  <option value="">Seleccione un deporte</option>
                  {sportNames.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </TextField>

                <Stack direction="row" spacing={3}>
                  <TextField
                    label="Jugadores mínimo"
                    type="number"
                    value={minPlayers}
                    onChange={(event) => setMinPlayers(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Jugadores máximo"
                    type="number"
                    value={maxPlayers}
                    onChange={(event) => setMaxPlayers(event.target.value)}
                    fullWidth
                  />
                </Stack>

                {sport === 'Fútbol' ? (
                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Posiciones requeridas</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      Opcional. Se usa para filtrar candidatos compatibles.
                    </Typography>
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
              </Stack>
            </Box>

            <Divider sx={{ borderColor: 'divider' }} />

            <Box>
              <Typography sx={{ fontWeight: 700, mb: 3 }}>Lugar y horario</Typography>
              <Stack spacing={4}>
                <TextField
                  select
                  label="Sede"
                  value={clubId}
                  onChange={(event) => setClubId(event.target.value)}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                  disabled={clubsLoading}
                  helperText="Podés armar el partido sin definir la sede todavía."
                  fullWidth
                >
                  <option value="">Sede a definir</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                  <option value={OTHER_CLUB_VALUE}>Nombre del club</option>
                </TextField>

                {isOtherClub ? (
                  <TextField
                    label="Nombre de la sede o club"
                    value={otherClubName}
                    onChange={(event) => setOtherClubName(event.target.value)}
                    placeholder="Ej: Club Atlético Central, Complejo La Canchita, Cancha de Juan"
                    error={isCustomVenueMissing}
                    helperText={isCustomVenueMissing ? 'Ingresá un nombre para la sede.' : undefined}
                    fullWidth
                  />
                ) : null}

                <Box
                  sx={{
                    p: 3,
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Cancha
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>Sin definir</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 160, textAlign: 'right' }}>
                    Se define más adelante con una reserva
                  </Typography>
                </Box>

                <TextField
                  select
                  label="Día"
                  value={date}
                  onChange={(event) => handleDateChange(event.target.value)}
                  slotProps={{ select: { native: true } }}
                  fullWidth
                >
                  {dayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </TextField>

                <TextField
                  label="Duración del partido (minutos)"
                  type="number"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  slotProps={{ htmlInput: { min: 15, max: 600, step: 15 } }}
                  fullWidth
                />

                <FormControl>
                  <FormLabel id="has-exact-time-label">¿Tenés un horario exacto?</FormLabel>
                  <RadioGroup
                    row
                    aria-labelledby="has-exact-time-label"
                    value={hasExactTime === null ? '' : hasExactTime ? 'yes' : 'no'}
                    onChange={(event) => handleHasExactTimeChange(event.target.value === 'yes')}
                  >
                    <FormControlLabel value="yes" control={<Radio />} label="Sí" />
                    <FormControlLabel value="no" control={<Radio />} label="No" />
                  </RadioGroup>
                </FormControl>

                {hasExactTime === false ? (
                  <TimeRangeInput value={availabilityRange} onChange={setAvailabilityRange} label="Franja horaria disponible" />
                ) : null}

                {hasExactTime === true ? (
                  <ExactStartTimeInput
                    availabilityStartMinutes={exactStartBound}
                    availabilityEndMinutes={exactEndBound}
                    value={startTimeMinutes}
                    onChange={setStartTimeMinutes}
                    label="Horario exacto"
                  />
                ) : null}
              </Stack>
            </Box>
          </Stack>
        </Card>
      </Box>

      <PageFooter>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={sportsLoading || !sport || !minPlayers || !maxPlayers || isCustomVenueMissing || hasExactTime === null || isDurationInvalid}
          sx={{ borderRadius: 999 }}
        >
          Armar partido
        </Button>
      </PageFooter>
    </Box>
  );
}

export default CreateMatchPage;
