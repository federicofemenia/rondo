import { useState } from 'react';
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

type RegisterPageProps = {
  onRegister?: () => void;
  onNavigateToLogin?: () => void;
};

const sportOptions = ['Fútbol', 'Pádel', 'Tenis', 'Básquet', 'Vóley'];
const positionOptions = ['Arquero', 'Defensor', 'Mediocampista', 'Delantero'];
const sexOptions = ['Hombre', 'Mujer', 'Prefiero no informarlo'];

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function RegisterPage({ onRegister, onNavigateToLogin }: RegisterPageProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sex, setSex] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRegister?.();
  };

  return (
    <Box component="main" sx={{ minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: 12 }}>
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

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={4}>
            <Stack direction="row" spacing={3}>
              <TextField label="Nombre" value={firstName} onChange={(event) => setFirstName(event.target.value)} fullWidth />
              <TextField label="Apellido" value={lastName} onChange={(event) => setLastName(event.target.value)} fullWidth />
            </Stack>
            <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth />
            <TextField label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+54 9 11 1234 5678" fullWidth />

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

            <Box>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Posición preferida</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Opcional. Nos ayuda a mostrarte partidos y candidatos más compatibles.
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

            <FormControlLabel
              control={<Checkbox checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />}
              label={
                <Typography variant="body2" color="text.secondary">
                  Acepto los Términos y Condiciones y la Política de Privacidad.
                </Typography>
              }
            />

            <Button type="submit" variant="contained" size="large" disabled={!acceptedTerms} sx={{ borderRadius: 999, py: 1.75 }}>
              Crear cuenta
            </Button>
          </Stack>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>
          ¿Ya tenés cuenta?{' '}
          <Box component="span" onClick={onNavigateToLogin} sx={{ color: 'primary.light', fontWeight: 700, cursor: 'pointer' }}>
            Iniciar sesión
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}

export default RegisterPage;
