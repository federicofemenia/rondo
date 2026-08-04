import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Discreet, non-blocking strip shown whenever the device itself is offline
 * -- never a full-screen takeover, since any content already on screen
 * (e.g. Home with matches already loaded) should stay visible and usable
 * for reading while connectivity is briefly down. See OfflineScreen for the
 * full-screen case (nothing loaded yet).
 */
function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <Box
      role="status"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: (muiTheme) => muiTheme.zIndex.appBar + 1,
        bgcolor: 'warning.main',
        color: '#0B0D0F',
        py: 1,
        px: 3,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
        <WifiOffRoundedIcon fontSize="small" />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Sin conexión
        </Typography>
      </Stack>
    </Box>
  );
}

export default OfflineBanner;
