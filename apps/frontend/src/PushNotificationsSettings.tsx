import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import { usePushNotifications } from './usePushNotifications';

type StatusLabel = 'Activadas' | 'Desactivadas' | 'Bloqueadas' | 'No compatibles';

function statusLabelFor(supported: boolean, permission: string, enabled: boolean): StatusLabel {
  if (!supported) {
    return 'No compatibles';
  }
  if (permission === 'denied') {
    return 'Bloqueadas';
  }
  if (enabled) {
    return 'Activadas';
  }
  return 'Desactivadas';
}

/**
 * "Notificaciones" section of the profile screen: state label, and
 * Activar/Desactivar/Enviar prueba, all backed by usePushNotifications.
 * Deliberately its own component (not inlined in EditProfilePage) so it can
 * be reasoned about and tested independently of the sex/biography form.
 * All buttons use type="button" -- EditProfilePage wraps its whole content
 * in a <form>, and an un-typed MUI Button defaults to the browser's native
 * type="submit", which would otherwise trigger the profile save on click.
 */
function PushNotificationsSettings() {
  const { supported, permission, enabled, loading, error, enable, disable, sendTest } = usePushNotifications();
  const [testFeedback, setTestFeedback] = useState<'success' | 'error' | null>(null);

  const statusLabel = statusLabelFor(supported, permission, enabled);

  const handleSendTest = async () => {
    setTestFeedback(null);
    try {
      await sendTest();
      setTestFeedback('success');
    } catch {
      setTestFeedback('error');
    }
  };

  return (
    <Card variant="outlined" sx={{ p: 4, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={3} alignItems="flex-start" sx={{ mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(77, 163, 255, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <NotificationsActiveRoundedIcon sx={{ color: 'info.main' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            Notificaciones
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Estado: {statusLabel}
          </Typography>
        </Box>
      </Stack>

      {permission === 'denied' ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Las notificaciones están bloqueadas en el navegador. Podés habilitarlas desde la configuración del sitio.
        </Alert>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      {testFeedback === 'success' ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          Notificación de prueba enviada.
        </Alert>
      ) : null}
      {testFeedback === 'error' ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          No pudimos enviar la notificación de prueba.
        </Alert>
      ) : null}

      {supported ? (
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {enabled ? (
            <Button type="button" variant="outlined" disabled={loading} onClick={() => void disable()}>
              Desactivar
            </Button>
          ) : permission !== 'denied' ? (
            <Button type="button" variant="contained" disabled={loading} onClick={() => void enable()}>
              Activar
            </Button>
          ) : null}
          <Button type="button" variant="outlined" disabled={loading || !enabled} onClick={() => void handleSendTest()}>
            Enviar prueba
          </Button>
        </Stack>
      ) : null}
    </Card>
  );
}

export default PushNotificationsSettings;
