import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { dismissInstallPrompt, isInstallPromptDismissed } from './installDismissal';
import { isIosDevice, isIosSafariBrowser, isStandaloneDisplayMode } from './pwaDisplayMode';

const DISMISSAL_STORAGE_KEY = 'rondo-ios-install-guide-dismissed-at';

const STEPS = ['Tocá Compartir', 'Elegí "Agregar a pantalla de inicio"', 'Abrí Rondo desde el nuevo icono'];

/**
 * iOS Safari never fires `beforeinstallprompt` -- there's no native API to
 * hook into, so this is a manual, feature-detected guide instead of
 * InstallRondoBanner's real prompt. Shown only for actual iOS Safari, not
 * yet installed, and not recently dismissed (same 7-day window as Android's
 * banner, for consistency).
 */
function IosInstallGuide() {
  const [dismissed, setDismissed] = useState(() => isInstallPromptDismissed(DISMISSAL_STORAGE_KEY));

  const handleDismiss = () => {
    dismissInstallPrompt(DISMISSAL_STORAGE_KEY);
    setDismissed(true);
  };

  if (dismissed || isStandaloneDisplayMode() || !isIosDevice() || !isIosSafariBrowser()) {
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
        aria-labelledby="ios-install-guide-title"
        sx={{ width: '100%', maxWidth: 480, p: 4, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: 6 }}
      >
        <Stack direction="row" spacing={3} alignItems="flex-start">
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(46, 204, 113, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IosShareRoundedIcon sx={{ color: 'primary.main' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="ios-install-guide-title" variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
              Instalá Rondo
            </Typography>
            <Stack component="ol" spacing={0.5} sx={{ m: 0, pl: 4, color: 'text.secondary' }}>
              {STEPS.map((step) => (
                <Typography key={step} component="li" variant="body2">
                  {step}
                </Typography>
              ))}
            </Stack>
          </Box>
          <IconButton aria-label="Cerrar" size="small" onClick={handleDismiss}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Button variant="outlined" fullWidth onClick={handleDismiss} sx={{ mt: 3 }}>
          Entendido
        </Button>
      </Card>
    </Box>
  );
}

export default IosInstallGuide;
