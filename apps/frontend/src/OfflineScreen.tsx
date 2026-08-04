import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';

type OfflineScreenProps = {
  onRetry: () => void;
};

/**
 * Full-screen state for when nothing has loaded yet and the device itself
 * is offline -- distinct from the "Estamos iniciando el servidor de Rondo"
 * boot screen in App.tsx, which is for a reachable-but-sleeping backend.
 * Once something is already on screen, OfflineBanner's discreet strip is
 * used instead so existing content stays visible.
 */
function OfflineScreen({ onRetry }: OfflineScreenProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', px: 4, textAlign: 'center' }}>
      <WifiOffRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 4 }} />
      <Typography variant="h1" sx={{ mb: 2, fontSize: '1.5rem' }}>
        Sin conexión
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 6, maxWidth: 360 }}>
        Rondo necesita conexión para actualizar partidos, invitaciones y mensajes.
      </Typography>
      <Button variant="contained" onClick={onRetry}>
        Reintentar
      </Button>
    </Box>
  );
}

export default OfflineScreen;
