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

const MIN_PASSWORD_LENGTH = 8;

/** Clerk's own field tags (snake_case, e.g. 'email_address') translated for a user-facing message -- falls back to the raw tag for anything not explicitly mapped, rather than hiding it. */
const MISSING_FIELD_LABELS: Record<string, string> = {
  password: 'la contraseña',
  username: 'el usuario',
  email_address: 'el email',
  phone_number: 'el teléfono',
  first_name: 'el nombre',
  last_name: 'el apellido',
  legal_accepted: 'la aceptación de los términos',
};

/**
 * Builds a concrete message for every way a sign-up can fail to reach
 * `status: 'complete'` *without* Clerk returning an `error` from
 * `signUp.password()` itself (e.g. `missing_requirements`, or a `complete`
 * status that -- unexpectedly -- has no session attached). Never a bare
 * "something went wrong": always names what Clerk is actually waiting on
 * when that information is available.
 */
function describeIncompleteSignUp(signUp: { status: string | null; missingFields: readonly string[] }): string {
  if (signUp.missingFields.length > 0) {
    const labels = signUp.missingFields.map((field) => MISSING_FIELD_LABELS[field] ?? field);
    return `Todavía falta completar: ${labels.join(', ')}.`;
  }
  return 'No pudimos completar el registro. Reintentá.';
}

function RegisterPage({ onRegister, onNavigateToLogin }: RegisterPageProps) {
  const { signUp } = useSignUp();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const isPasswordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH;

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Clear any error from a previous attempt as soon as the user tries
    // again, regardless of what happens next.
    setErrorMessage(null);
    if (!signUp) {
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }
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

      // A resolved signUp.password() call is not success by itself -- the
      // sign-up only actually exists once status is 'complete' *and*
      // Clerk attached a session to it. Bail out on anything short of
      // that (username taken but caught elsewhere, missing requirements,
      // a captcha/verification step this one-step flow doesn't handle,
      // etc.) with a real message, and never touch onRegister.
      if (signUp.status !== 'complete' || !signUp.createdSessionId) {
        setErrorMessage(describeIncompleteSignUp(signUp));
        return;
      }

      // finalize() is what actually activates the session (Clerk's
      // "Future" API equivalent of setActive({ session })) -- its own
      // { error } must be checked too, or a failure here would silently
      // read as success and let the app navigate to Home without ever
      // having signed the new user in.
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setErrorMessage(finalizeError.longMessage ?? finalizeError.message);
        return;
      }

      onRegister?.();
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
            error={isPasswordTooShort}
            helperText={isPasswordTooShort ? `Debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` : `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
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
          disabled={!acceptedTerms || !isPasswordValid || submitting || !signUp}
          sx={{ borderRadius: 999, py: 1.75 }}
        >
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </PageFooter>
    </Box>
  );
}

export default RegisterPage;
