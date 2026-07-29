import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

type MatchManagementPageProps = {
  participants?: string[];
  onRemoveParticipant?: (name: string) => void;
  onCancelMatch?: () => void;
};

function MatchManagementPage({ participants = [], onRemoveParticipant, onCancelMatch }: MatchManagementPageProps) {
  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Gestión del partido
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Acá aparecen los jugadores ya confirmados. El partido se confirma solo al completar el cupo y finaliza solo
          cuando pasa su horario.
        </Typography>

        {participants.length === 0 ? (
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Todavía no hay jugadores confirmados.
          </Typography>
        ) : (
          <Stack spacing={2} sx={{ mb: 4 }}>
            {participants.map((name) => (
              <Card
                key={name}
                variant="outlined"
                sx={{ p: 4, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.default', borderColor: 'divider' }}
              >
                <Box>
                  <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>
                    {name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Estado: Confirmado
                  </Typography>
                </Box>
                <Button variant="outlined" color="error" onClick={() => onRemoveParticipant?.(name)}>
                  Quitar
                </Button>
              </Card>
            ))}
          </Stack>
        )}

        <Button variant="outlined" color="error" onClick={onCancelMatch} sx={{ borderColor: 'divider', color: 'error.main' }}>
          Cancelar partido
        </Button>
      </Card>
    </Box>
  );
}

export default MatchManagementPage;
