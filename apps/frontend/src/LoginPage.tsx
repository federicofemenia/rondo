import { useState } from 'react';
import { useSignIn } from '@clerk/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import logo from './assets/logo.png';
import PageFooter from './PageFooter';
import { isSignUpEnabled } from './runtimeConfig';

type LoginPageProps = {
  onLogin?: () => void;
  onNavigateToRegister?: () => void;
  /** Defaults to the real VITE_BETA_SIGN_UP_ENABLED value; overridable for tests. */
  signUpEnabled?: boolean;
};

function LoginPage({ onLogin, onNavigateToRegister, signUpEnabled = isSignUpEnabled }: LoginPageProps) {
  const { signIn } = useSignIn();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [step, setStep] = useState<'password' | 'client-trust'>('password');
  const [trustCode, setTrustCode] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) {
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const { error } = await signIn.password({ identifier, password });
      if (error) {
        setErrorMessage(error.longMessage ?? error.message);
        return;
      }
      if (signIn.status === 'complete') {
        await signIn.finalize();
        onLogin?.();
        return;
      }
      if (signIn.status === 'needs_client_trust') {
        const { error: sendCodeError } = await signIn.mfa.sendEmailCode();
        if (sendCodeError) {
          setErrorMessage(sendCodeError.longMessage ?? sendCodeError.message);
          return;
        }
        setStep('client-trust');
        return;
      }
      setErrorMessage('Tu cuenta necesita un paso de verificación adicional. Contactá a soporte.');
    } catch {
      setErrorMessage('No pudimos iniciar sesión. Reintentá.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyClientTrust = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) {
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const { error } = await signIn.mfa.verifyEmailCode({ code: trustCode });
      if (error) {
        setErrorMessage(error.longMessage ?? error.message);
        return;
      }
      if (signIn.status === 'complete') {
        await signIn.finalize();
        onLogin?.();
        return;
      }
      setErrorMessage('El código no es válido o expiró. Reintentá.');
    } catch {
      setErrorMessage('No pudimos verificar el código. Reintentá.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'client-trust') {
    return (
      <Box component="form" onSubmit={handleVerifyClientTrust} sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Box sx={{ maxWidth: 400, mx: 'auto', px: 4, py: 8, pb: '120px', width: '100%' }}>
          <Typography variant="h1" sx={{ mb: 1 }}>
            Confirmá que sos vos
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 6 }}>
            Es la primera vez que iniciás sesión desde este dispositivo. Te enviamos un código de verificación.
          </Typography>

          <TextField label="Código de verificación" value={trustCode} onChange={(event) => setTrustCode(event.target.value)} fullWidth autoFocus />

          {errorMessage ? (
            <Typography variant="body2" color="error.main" sx={{ mt: 3, textAlign: 'center' }}>
              {errorMessage}
            </Typography>
          ) : null}
        </Box>

        <PageFooter>
          <Button type="submit" fullWidth variant="contained" size="large" disabled={submitting || !trustCode} sx={{ borderRadius: 999, py: 1.75 }}>
            {submitting ? 'Verificando…' : 'Verificar'}
          </Button>
        </PageFooter>
      </Box>
    );
  }

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
            label="Usuario"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Tu usuario"
            autoComplete="username"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonRoundedIcon fontSize="small" sx={{ color: 'primary.light' }} />
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
              autoComplete="current-password"
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

        {errorMessage ? (
          <Typography variant="body2" color="error.main" sx={{ mt: 3, textAlign: 'center' }}>
            {errorMessage}
          </Typography>
        ) : null}

        <Stack alignItems="center" spacing={1} sx={{ mt: 6 }}>
          {signUpEnabled ? (
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
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 320 }}>
              Esta beta requiere una cuenta asignada. Si sos parte de la beta, pedile tu usuario y contraseña al organizador.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 320 }}>
            Al continuar, aceptás nuestros Términos y Condiciones y nuestra Política de Privacidad.
          </Typography>
        </Stack>
      </Box>

      <PageFooter>
        <Button type="submit" fullWidth variant="contained" size="large" disabled={submitting || !signIn} sx={{ borderRadius: 999, py: 1.75 }}>
          {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </Button>
      </PageFooter>
    </Box>
  );
}

export default LoginPage;
