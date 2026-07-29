import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { buildDayOptions, timeRangeOptions } from './dateOptions';
import PageFooter from './PageFooter';
import { useSports } from './useSports';

export type MatchDraft = {
  sport: string;
  modality: string;
  minPlayers: string;
  maxPlayers: string;
  positions: string[];
  clubName: string;
  courtName: string | null;
  date: string;
  time: string | null;
};

type CreateMatchPageProps = {
  onCreateMatch?: (draft: MatchDraft) => void;
};

const positionOptions = ['Arquero', 'Defensor', 'Mediocampista', 'Delantero'];

const clubOptions = ['Club Señor Pato'];

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function CreateMatchPage({ onCreateMatch }: CreateMatchPageProps) {
  const dayOptions = useMemo(() => buildDayOptions(), []);
  const { sports, loading: sportsLoading, error: sportsError } = useSports();

  const sportModalities = useMemo(() => {
    const record: Record<string, string[]> = {};
    sports.forEach((sportOption) => {
      record[sportOption.name] = sportOption.modalities.map((modality) => modality.name);
    });
    return record;
  }, [sports]);
  const sportNames = Object.keys(sportModalities);

  const [sport, setSport] = useState('');
  const [modality, setModality] = useState('');
  const [minPlayers, setMinPlayers] = useState('4');
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [positions, setPositions] = useState<string[]>([]);
  const [clubName, setClubName] = useState(clubOptions[0]!);
  const [date, setDate] = useState(dayOptions[0]!.value);
  const [time, setTime] = useState('');

  useEffect(() => {
    if (!sport && sportNames.length > 0) {
      const firstSport = sportNames[0]!;
      setSport(firstSport);
      setModality(sportModalities[firstSport]?.[0] ?? '');
    }
  }, [sport, sportNames, sportModalities]);

  const handleSportChange = (nextSport: string) => {
    setSport(nextSport);
    setModality(sportModalities[nextSport]?.[0] ?? '');
    if (nextSport !== 'Fútbol') {
      setPositions([]);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreateMatch?.({
      sport,
      modality,
      minPlayers,
      maxPlayers,
      positions,
      clubName,
      courtName: null,
      date,
      time: time || null,
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
              Elegí el día del partido. El horario y la cancha podés definirlos más adelante.
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
                  {sportNames.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Modalidad"
                  value={modality}
                  onChange={(event) => setModality(event.target.value)}
                  slotProps={{ select: { native: true } }}
                  disabled={sportsLoading || !sport}
                  fullWidth
                >
                  {(sportModalities[sport] ?? []).map((option) => (
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
              <Typography sx={{ fontWeight: 700, mb: 3 }}>Información logística</Typography>
              <Stack spacing={4}>
                <TextField
                  select
                  label="Club"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                  slotProps={{ select: { native: true } }}
                  helperText="Solo se listan los clubes de los que sos miembro."
                  fullWidth
                >
                  {clubOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </TextField>

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
                  onChange={(event) => setDate(event.target.value)}
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
                  select
                  label="Horario (opcional)"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                  helperText="Elegí una franja: mañana, tarde o noche."
                  fullWidth
                >
                  <option value="">Sin definir</option>
                  {timeRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </TextField>
              </Stack>
            </Box>
          </Stack>
        </Card>
      </Box>

      <PageFooter>
        <Button type="submit" fullWidth variant="contained" size="large" disabled={sportsLoading || !sport} sx={{ borderRadius: 999 }}>
          Armar partido
        </Button>
      </PageFooter>
    </Box>
  );
}

export default CreateMatchPage;
