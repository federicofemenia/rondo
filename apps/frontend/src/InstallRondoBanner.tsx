import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GetAppRoundedIcon from '@mui/icons-material/GetAppRounded';
import { dismissInstallPrompt, isInstallPromptDismissed } from './installDismissal';
import { isStandaloneDisplayMode } from './pwaDisplayMode';
import { useInstallPrompt } from './useInstallPrompt';

const DISMISSAL_STORAGE_KEY = 'rondo-install-banner-dismissed-at';

/**
 * Android/desktop Chrome-Edge install nudge, driven by the real
 * `beforeinstallprompt` event (never shown as a guess). Dismissing it -- by
 * "Ahora no" or by answering the native prompt with "dismissed" -- hides it
 * for 7 days; accepting installs the app and the `appinstalled` event (see
 * useInstallPrompt) clears the prompt on its own.
 */
function InstallRondoBanner() {
  const { isInstallable, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => isInstallPromptDismissed(DISMISSAL_STORAGE_KEY));

  const handleDismiss = () => {
    dismissInstallPrompt(DISMISSAL_STORAGE_KEY);
    setDismissed(true);
  };

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'dismissed') {
      handleDismiss();
    }
  };

  if (!isInstallable || dismissed || isStandaloneDisplayMode()) {
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
        aria-labelledby="install-rondo-banner-title"
        sx={{ width: '100%', maxWidth: 480, p: 4, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: 6 }}
      >
        <Stack direction="row" spacing={3} alignItems="flex-start">
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(46, 204, 113, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GetAppRoundedIcon sx={{ color: 'primary.main' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="install-rondo-banner-title" variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
              Instalá Rondo en tu celular
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Accedé más rápido desde tu pantalla de inicio.
            </Typography>
          </Box>
          <IconButton aria-label="Cerrar" size="small" onClick={handleDismiss}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button variant="outlined" fullWidth onClick={handleDismiss}>
            Ahora no
          </Button>
          <Button variant="contained" fullWidth onClick={() => void handleInstall()}>
            Instalar
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}

export default InstallRondoBanner;
