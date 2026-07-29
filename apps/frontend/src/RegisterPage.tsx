import { useState } from 'react';
import type { ChangeEvent } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import PageFooter from './PageFooter';
import { useSports } from './useSports';

type RegisterPageProps = {
  onRegister?: () => void;
  onNavigateToLogin?: () => void;
};

const sportPositionOptions: Record<string, string[]> = {
  Fútbol: ['Arquero', 'Defensor', 'Mediocampista', 'Delantero'],
  Pádel: ['Drive', 'Revés'],
};
const sexOptions = ['Hombre', 'Mujer', 'Prefiero no informarlo'];

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function RegisterPage({ onRegister, onNavigateToLogin }: RegisterPageProps) {
  const { sports: sportCatalog, loading: sportsLoading, error: sportsError } = useSports();
  const sportOptions = sportCatalog.map((sportOption) => sportOption.name);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [positionsBySport, setPositionsBySport] = useState<Record<string, string[]>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const togglePositionForSport = (sport: string, position: string) => {
    setPositionsBySport((current) => ({
      ...current,
      [sport]: toggleValue(current[sport] ?? [], position),
    }));
  };

  const sportsWithPositions = sports.filter((sport) => sportPositionOptions[sport]);

  const handlePhotoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRegister?.();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: '120px' }}>
        <IconButton
          aria-label="Volver"
          onClick={onNavigateToLogin}
          sx={{ mb: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>

        <Typography variant="h1" sx={{ mb: 1 }}>
          Creá tu cuenta
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 6 }}>
          Sumate a Rondo y empezá a organizar partidos en minutos.
        </Typography>

        <Box>
          <Stack spacing={4}>
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Foto de perfil</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Opcional. Se mostrará como tu avatar para otros jugadores.
              </Typography>
              <Stack direction="row" spacing={3} alignItems="center">
                <Avatar
                  src={photoUrl ?? undefined}
                  sx={{ width: 72, height: 72, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                >
                  {!photoUrl ? <PersonRoundedIcon sx={{ color: 'text.secondary' }} /> : null}
                </Avatar>
                <Stack spacing={1.5}>
                  <Button component="label" variant="outlined" size="small" startIcon={<UploadRoundedIcon />} sx={{ borderRadius: 999 }}>
                    Seleccionar foto
                    <Box
                      component="input"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelected}
                      sx={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
                    />
                  </Button>
                  <Button component="label" variant="outlined" size="small" startIcon={<PhotoCameraRoundedIcon />} sx={{ borderRadius: 999 }}>
                    Tomar foto
                    <Box
                      component="input"
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handlePhotoSelected}
                      sx={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
                    />
                  </Button>
                </Stack>
              </Stack>
            </Box>

            <Stack direction="row" spacing={3}>
              <TextField label="Nombre" value={firstName} onChange={(event) => setFirstName(event.target.value)} fullWidth />
              <TextField label="Apellido" value={lastName} onChange={(event) => setLastName(event.target.value)} fullWidth />
            </Stack>
            <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth />
            <TextField label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+54 9 11 1234 5678" fullWidth />

            <Stack direction="row" spacing={3}>
              <TextField
                label="Fecha de nacimiento"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                select
                label="Sexo"
                value={sex}
                onChange={(event) => setSex(event.target.value)}
                slotProps={{ select: { native: true } }}
                fullWidth
              >
                <option value="" disabled></option>
                {sexOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </TextField>
            </Stack>

            <Stack direction="row" spacing={3}>
              <TextField
                label="Contraseña"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
              />
              <TextField
                label="Repetir contraseña"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                fullWidth
              />
            </Stack>

            <Box>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Deportes favoritos</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Opcional. Podés modificarlo luego desde tu perfil.
              </Typography>
              {sportsError ? (
                <Typography variant="body2" color="error.main">
                  No pudimos cargar los deportes. Reintentá más tarde.
                </Typography>
              ) : null}
              {sportsLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Cargando deportes…
                </Typography>
              ) : null}
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {sportOptions.map((sport) => (
                  <Chip
                    key={sport}
                    label={sport}
                    clickable
                    onClick={() => setSports((current) => toggleValue(current, sport))}
                    sx={{
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: sports.includes(sport) ? 'primary.dark' : 'divider',
                      bgcolor: sports.includes(sport) ? 'rgba(46, 204, 113, 0.16)' : 'background.paper',
                      color: sports.includes(sport) ? 'primary.light' : 'text.primary',
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {sportsWithPositions.length > 0 ? (
              <Box>
                <Typography sx={{ fontWeight: 700, mb: 2 }}>Posición preferida</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                  Opcional. Nos ayuda a mostrarte partidos y candidatos más compatibles.
                </Typography>
                <Stack spacing={3}>
                  {sportsWithPositions.map((sport) => {
                    const selectedPositions = positionsBySport[sport] ?? [];
                    return (
                      <Box key={sport}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          {sport}
                        </Typography>
                        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                          {sportPositionOptions[sport]!.map((position) => (
                            <Chip
                              key={position}
                              label={position}
                              clickable
                              onClick={() => togglePositionForSport(sport, position)}
                              sx={{
                                fontWeight: 700,
                                border: '1px solid',
                                borderColor: selectedPositions.includes(position) ? 'primary.dark' : 'divider',
                                bgcolor: selectedPositions.includes(position) ? 'rgba(46, 204, 113, 0.16)' : 'background.paper',
                                color: selectedPositions.includes(position) ? 'primary.light' : 'text.primary',
                              }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            ) : null}

            <FormControlLabel
              control={<Checkbox checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />}
              label={
                <Typography variant="body2" color="text.secondary">
                  Acepto los Términos y Condiciones y la Política de Privacidad.
                </Typography>
              }
            />
          </Stack>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>
          ¿Ya tenés cuenta?{' '}
          <Box component="span" onClick={onNavigateToLogin} sx={{ color: 'primary.light', fontWeight: 700, cursor: 'pointer' }}>
            Iniciar sesión
          </Box>
        </Typography>
      </Box>

      <PageFooter>
        <Button type="submit" fullWidth variant="contained" size="large" disabled={!acceptedTerms} sx={{ borderRadius: 999, py: 1.75 }}>
          Crear cuenta
        </Button>
      </PageFooter>
    </Box>
  );
}

export default RegisterPage;
