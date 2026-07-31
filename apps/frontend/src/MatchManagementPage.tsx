import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

type MatchManagementPageProps = {
  onCancelMatch?: () => void;
};

function MatchManagementPage({ onCancelMatch }: MatchManagementPageProps) {
  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Gestión del partido
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Administrá a los jugadores confirmados y las invitaciones desde la pestaña Jugadores. Acá podés cancelar el
          partido si ya no se va a jugar.
        </Typography>
        <Button variant="outlined" color="error" onClick={onCancelMatch} sx={{ borderColor: 'divider', color: 'error.main' }}>
          Cancelar partido
        </Button>
      </Card>
    </Box>
  );
}

export default MatchManagementPage;
