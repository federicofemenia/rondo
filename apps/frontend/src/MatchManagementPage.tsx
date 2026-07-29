import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

type Participant = {
  id: number;
  name: string;
  status: 'Confirmado' | 'Pendiente';
};

type MatchManagementPageProps = {
  participants?: string[];
  onConfirm?: () => void;
  onFinish?: () => void;
};

const initialParticipants: Participant[] = [
  { id: 1, name: 'Mauro', status: 'Confirmado' },
  { id: 2, name: 'Lina', status: 'Pendiente' },
];

function MatchManagementPage({ participants = [], onConfirm, onFinish }: MatchManagementPageProps) {
  const [localParticipants, setLocalParticipants] = useState<Participant[]>(initialParticipants);

  const normalizedParticipants = useMemo(() => {
    const namesFromProps = participants.map((name, index) => ({ id: 100 + index, name, status: 'Confirmado' as const }));
    const merged = [...localParticipants, ...namesFromProps.filter((candidate) => !localParticipants.some((existing) => existing.name === candidate.name))];
    return merged;
  }, [localParticipants, participants]);

  const removeParticipant = (id: number) => {
    setLocalParticipants((current) => current.filter((participant) => participant.id !== id));
  };

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Gestión del partido
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          El organizador puede revisar el equipo y gestionar la participación antes de confirmar.
        </Typography>

        <Stack spacing={2}>
          {normalizedParticipants.map((participant) => (
            <Card
              key={participant.id}
              variant="outlined"
              sx={{ p: 4, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.default', borderColor: 'divider' }}
            >
              <Box>
                <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>
                  {participant.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Estado: {participant.status}
                </Typography>
              </Box>
              <Button variant="outlined" color="error" onClick={() => removeParticipant(participant.id)}>
                Quitar
              </Button>
            </Card>
          ))}
        </Stack>

        <Stack direction="row" spacing={3} sx={{ mt: 4 }} flexWrap="wrap" useFlexGap>
          <Button variant="contained" onClick={onConfirm}>
            Confirmar partido
          </Button>
          <Button variant="outlined" color="success" onClick={onFinish} sx={{ borderColor: 'primary.main', color: 'primary.light' }}>
            Finalizar partido
          </Button>
          <Button variant="outlined" sx={{ borderColor: 'divider', color: 'text.primary' }}>
            Cancelar partido
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}

export default MatchManagementPage;
