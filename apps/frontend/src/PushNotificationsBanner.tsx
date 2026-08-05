import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import { dismissInstallPrompt, isInstallPromptDismissed } from './installDismissal';
import { useInstallWelcomeVisible } from './installWelcome';
import { isIosDevice, isStandaloneDisplayMode } from './pwaDisplayMode';
import { usePushNotifications } from './usePushNotifications';

const DISMISSAL_STORAGE_KEY = 'rondo-push-banner-dismissed-at';

/**
 * Contextual "activate push" nudge -- only ever mounted while the user is
 * authenticated (see App.tsx; never on Login/Register). Reuses the same
 * dismiss-with-expiry pattern as InstallWelcomeDialog (installDismissal.ts),
 * under its own storage key so dismissing one nudge never dismisses the
 * other. Permission is never requested automatically -- only "Activar" (a
 * real user interaction) triggers it, per docs/WEB_PUSH.md.
 *
 * Installing takes priority over activating push (see docs/PWA.md): while
 * InstallWelcomeDialog is eligible to show, this banner stays hidden so the
 * two never compete for the user's attention at once.
 */
function PushNotificationsBanner() {
  const { supported, permission, enable, loading } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => isInstallPromptDismissed(DISMISSAL_STORAGE_KEY));
  const installWelcomeVisible = useInstallWelcomeVisible();

  const handleDismiss = () => {
    dismissInstallPrompt(DISMISSAL_STORAGE_KEY);
    setDismissed(true);
  };

  if (dismissed || installWelcomeVisible) {
    return null;
  }

  // iOS Safari only supports Web Push once Rondo is installed to the home
  // screen -- before that, `Notification`/`PushManager` are typically
  // undefined (supported === false), so this branch is checked first and
  // independently of `supported`, or the message would never show at all.
  const iosNotInstalled = isIosDevice() && !isStandaloneDisplayMode();

  if (!iosNotInstalled && (!supported || permission !== 'default')) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (muiTheme) => muiTheme.zIndex.snackbar,
        display: 'flex',
        justifyContent: 'center',
        px: 4,
        pb: 'max(16px, env(safe-area-inset-bottom))',
        pt: 2,
      }}
    >
      <Card
        variant="outlined"
        role="region"
        aria-labelledby="push-notifications-banner-title"
        sx={{ width: '100%', maxWidth: 480, p: 4, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: 6 }}
      >
        <Stack direction="row" spacing={3} alignItems="flex-start">
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(77, 163, 255, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <NotificationsActiveRoundedIcon sx={{ color: 'info.main' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="push-notifications-banner-title" variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
              Activá las notificaciones
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {iosNotInstalled
                ? 'Para recibir notificaciones en iPhone, primero agregá Rondo a tu pantalla de inicio.'
                : 'Recibí avisos cuando te inviten a un partido o cambie algo importante.'}
            </Typography>
          </Box>
          <IconButton aria-label="Cerrar" size="small" onClick={handleDismiss}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        {iosNotInstalled ? null : (
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="outlined" fullWidth onClick={handleDismiss}>
              Ahora no
            </Button>
            <Button variant="contained" fullWidth disabled={loading} onClick={() => void enable()}>
              {loading ? 'Activando…' : 'Activar'}
            </Button>
          </Stack>
        )}
      </Card>
    </Box>
  );
}

export default PushNotificationsBanner;
