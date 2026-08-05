import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GetAppRoundedIcon from '@mui/icons-material/GetAppRounded';
import { dismissInstallWelcome, useInstallWelcomeVisible } from './installWelcome';
import { isIosDevice, isIosSafariBrowser } from './pwaDisplayMode';
import { useInstallPrompt } from './useInstallPrompt';

const IOS_STEPS = [
  'Tocá el botón Compartir de Safari.',
  'Elegí "Agregar a pantalla de inicio".',
  'Abrí Rondo desde el nuevo ícono.',
  'Desde la app instalada vas a poder activar las notificaciones.',
];

/**
 * First-authenticated-visit install nudge (App.tsx mounts this only while
 * isSignedIn, never on Login/Register). Visibility is fully owned by
 * useInstallWelcomeVisible (installWelcome.ts) -- reactive to
 * beforeinstallprompt/appinstalled, and shared with PushNotificationsBanner
 * so the two never compete for attention at once.
 *
 * Deliberately a non-modal, prominent Card (not a MUI Dialog): a real
 * Dialog traps focus and marks the rest of the page aria-hidden while
 * open, which both fights "no bloquear el uso de Rondo" and makes the
 * background genuinely inaccessible while this shows -- same fixed-overlay
 * treatment as PushNotificationsBanner/the old install banners this
 * replaces, just centered instead of bottom-anchored to read as more of a
 * "welcome" moment.
 *
 * Replaces the old always-mounted, pre-login InstallRondoBanner +
 * IosInstallGuide bottom banners: same underlying capability (real
 * beforeinstallprompt for Android/Chromium, manual steps for iOS Safari),
 * now scoped to "first time signed in, not installed" with a shorter
 * 3-day dismissal instead of a standing 7-day one.
 */
function InstallWelcomeDialog() {
  const visible = useInstallWelcomeVisible();
  const { isInstallable, promptInstall } = useInstallPrompt();
  const isIos = isIosDevice() && isIosSafariBrowser();

  if (!visible) {
    return null;
  }

  const handleDismiss = () => dismissInstallWelcome();

  const handleInstallNow = async () => {
    const outcome = await promptInstall();
    // Both "dismissed" and "unavailable" (the prompt raced away) fall back
    // to a plain dismissal -- never claim success the user didn't confirm.
    // "accepted" also dismisses: `appinstalled` will persist the permanent
    // installed flag shortly after (installPrompt.ts), this just avoids a
    // visible gap while that event is in flight.
    dismissInstallWelcome();
    void outcome;
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (muiTheme) => muiTheme.zIndex.snackbar,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 4,
        py: 'max(16px, env(safe-area-inset-bottom))',
        pointerEvents: 'none',
      }}
    >
      <Card
        variant="outlined"
        role="region"
        aria-labelledby="install-welcome-title"
        sx={{ width: '100%', maxWidth: 420, p: 4, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: 8, pointerEvents: 'auto' }}
      >
        <Stack spacing={3}>
          <Stack direction="row" spacing={3} alignItems="flex-start">
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(46, 204, 113, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GetAppRoundedIcon sx={{ color: 'primary.main' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography id="install-welcome-title" variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
                Bienvenido a Rondo
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Instalá la app en tu celular para acceder más rápido y recibí notificaciones aunque no tengas Rondo abierta.
              </Typography>
            </Box>
          </Stack>

          {isIos ? (
            <Stack spacing={2}>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                Instalá Rondo en tu iPhone
              </Typography>
              <Stack component="ol" spacing={0.5} sx={{ m: 0, pl: 4, color: 'text.secondary' }}>
                {IOS_STEPS.map((step) => (
                  <Typography key={step} component="li" variant="body2">
                    {step}
                  </Typography>
                ))}
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" fullWidth onClick={handleDismiss}>
                  Recordarme más tarde
                </Button>
                <Button variant="contained" fullWidth onClick={handleDismiss}>
                  Entendido
                </Button>
              </Stack>
            </Stack>
          ) : isInstallable ? (
            <Stack spacing={2}>
              <Stack spacing={1}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  Instalá Rondo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Usala desde tu pantalla de inicio y recibí las novedades de tus partidos.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" fullWidth onClick={handleDismiss}>
                  Más tarde
                </Button>
                <Button variant="contained" fullWidth onClick={() => void handleInstallNow()}>
                  Instalar ahora
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Tu navegador todavía no habilitó la instalación directa. En cuanto esté disponible, vas a poder instalar Rondo desde acá.
              </Typography>
              <Button variant="outlined" fullWidth onClick={handleDismiss}>
                Más tarde
              </Button>
            </Stack>
          )}
        </Stack>
      </Card>
    </Box>
  );
}

export default InstallWelcomeDialog;
