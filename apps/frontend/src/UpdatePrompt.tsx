import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Prompt-style service worker update: a new version sits waiting in the
 * background (registerType: 'prompt' in vite.config.ts) until the user
 * explicitly confirms here. `updateServiceWorker(true)` activates it and
 * reloads exactly once -- never a silent swap that could leave stale JS
 * talking to a newer index.html, never a reload loop.
 */
function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
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
        aria-labelledby="update-prompt-title"
        sx={{ width: '100%', maxWidth: 480, p: 4, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: 6 }}
      >
        <Stack direction="row" spacing={3} alignItems="flex-start">
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(77, 163, 255, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SystemUpdateAltRoundedIcon sx={{ color: 'info.main' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="update-prompt-title" variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
              Nueva versión disponible
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hay una nueva versión de Rondo disponible.
            </Typography>
          </Box>
          <IconButton aria-label="Cerrar" size="small" onClick={() => setNeedRefresh(false)}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Button variant="contained" fullWidth onClick={() => void updateServiceWorker(true)} sx={{ mt: 3 }}>
          Actualizar
        </Button>
      </Card>
    </Box>
  );
}

export default UpdatePrompt;
