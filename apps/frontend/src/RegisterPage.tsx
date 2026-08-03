import { useState } from 'react';
import { useSignUp } from '@clerk/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PageFooter from './PageFooter';

type RegisterPageProps = {
  onRegister?: () => void;
  onNavigateToLogin?: () => void;
};

function RegisterPage({ onRegister, onNavigateToLogin }: RegisterPageProps) {
  const { signUp } = useSignUp();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signUp) {
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      // No email/phone is collected for the beta, so this is a one-step
      // sign-up: username + password satisfy every requirement, with no
      // verification code in between.
      const { error } = await signUp.password({
        username,
        password,
        unsafeMetadata: { displayName },
      });
      if (error) {
        setErrorMessage(error.longMessage ?? error.message);
        return;
      }
      if (signUp.status === 'complete') {
        await signUp.finalize();
        onRegister?.();
        return;
      }
      setErrorMessage('No pudimos completar el registro. Reintentá.');
    } catch {
      setErrorMessage('No pudimos completar el registro. Reintentá.');
    } finally {
      setSubmitting(false);
    }
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
          Sumate a la beta de Rondo. Vas a poder completar tu perfil deportivo después de ingresar.
        </Typography>

        <Stack spacing={4}>
          <TextField
            label="Nombre visible"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Cómo te van a ver los demás jugadores"
            fullWidth
          />
          <TextField
            label="Usuario"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Sin espacios"
            autoComplete="username"
            fullWidth
          />
          <TextField
            label="Contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            fullWidth
          />
          <TextField
            label="Confirmar contraseña"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            fullWidth
          />

          <FormControlLabel
            control={<Checkbox checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />}
            label={
              <Typography variant="body2" color="text.secondary">
                Acepto los Términos y Condiciones y la Política de Privacidad.
              </Typography>
            }
          />
        </Stack>

        {errorMessage ? (
          <Typography variant="body2" color="error.main" sx={{ mt: 4, textAlign: 'center' }}>
            {errorMessage}
          </Typography>
        ) : null}

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>
          ¿Ya tenés cuenta?{' '}
          <Box component="span" onClick={onNavigateToLogin} sx={{ color: 'primary.light', fontWeight: 700, cursor: 'pointer' }}>
            Iniciar sesión
          </Box>
        </Typography>
      </Box>

      <PageFooter>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={!acceptedTerms || submitting || !signUp}
          sx={{ borderRadius: 999, py: 1.75 }}
        >
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </PageFooter>
    </Box>
  );
}

export default RegisterPage;
