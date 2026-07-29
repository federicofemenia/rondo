import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import logo from './assets/logo.png';
import PageFooter from './PageFooter';

type LoginPageProps = {
  onLogin?: () => void;
  onNavigateToRegister?: () => void;
};

function LoginPage({ onLogin, onNavigateToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onLogin?.();
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <Box sx={{ maxWidth: 400, mx: 'auto', px: 4, py: 8, pb: '120px', width: '100%' }}>
        <Stack alignItems="center" sx={{ mb: 4 }}>
          <Box component="img" src={logo} alt="Rondo" sx={{ width: 180, height: 180, objectFit: 'contain' }} />
        </Stack>

        <Stack spacing={4}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineRoundedIcon fontSize="small" sx={{ color: 'primary.light' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box>
            <TextField
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresá tu contraseña"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon fontSize="small" sx={{ color: 'primary.light' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((current) => !current)} edge="end" size="small">
                        {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Typography variant="body2" sx={{ textAlign: 'right', mt: 1, color: 'primary.light', fontWeight: 700, cursor: 'pointer' }}>
              ¿Olvidaste tu contraseña?
            </Typography>
          </Box>
        </Stack>

        <Stack alignItems="center" spacing={1} sx={{ mt: 6 }}>
          <Typography variant="body2" color="text.secondary">
            ¿No tenés cuenta?{' '}
            <Box
              component="span"
              onClick={onNavigateToRegister}
              sx={{ color: 'primary.light', fontWeight: 700, cursor: 'pointer' }}
            >
              Registrate gratis
            </Box>
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 320 }}>
            Al continuar, aceptás nuestros Términos y Condiciones y nuestra Política de Privacidad.
          </Typography>
        </Stack>
      </Box>

      <PageFooter>
        <Button type="submit" fullWidth variant="contained" size="large" sx={{ borderRadius: 999, py: 1.75 }}>
          Iniciar sesión
        </Button>
      </PageFooter>
    </Box>
  );
}

export default LoginPage;
